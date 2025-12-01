import { spawn, ChildProcess } from 'child_process';
import { watch, FSWatcher } from 'chokidar';
import { existsSync, rmSync, renameSync } from 'fs';
import { resolve } from 'path';
import { log, spin, confirm } from './log';
import { getRequiredNodeVersion, NvmPaths } from './node-version';
import { killExistingServers } from './server';

const CONFIG = {
  DEBOUNCE_MS: 1000,
  MAX_FILES_TO_SHOW: 3,
} as const;

type BuildState = 'idle' | 'building' | 'cancelling';

export interface WatchOptions {
  port: number;
  projectRoot: string;
  nvmPath: NvmPaths | null;
  verbose?: boolean;
}

class BuildManager {
  private options: WatchOptions;
  private bookPath: string;
  private tempBookPath: string;

  private serverProcess: ChildProcess | null = null;
  private buildProcess: ChildProcess | null = null;
  private buildProcessPid: number | null = null;
  private watcher: FSWatcher | null = null;

  private buildState: BuildState = 'idle';
  private debounceTimer: NodeJS.Timeout | null = null;
  private cancelTimer: NodeJS.Timeout | null = null;

  private pendingFiles: Set<string> = new Set();
  private currentBuildFiles: string[] = [];

  constructor(options: WatchOptions) {
    this.options = options;
    this.bookPath = resolve(options.projectRoot, '_book');
    this.tempBookPath = resolve(options.projectRoot, '_book_temp');
  }

  public async start(): Promise<void> {
    this.cleanupTemp();

    if (existsSync(this.bookPath)) {
      log.info('Using existing _book...');
      const shouldRebuild = await confirm('Rebuild before starting?');
      if (shouldRebuild) {
        this.runInitialBuild();
      } else {
        this.startServer();
        this.setupWatcher();
      }
    } else {
      this.runInitialBuild();
    }

    this.setupSignalHandlers();
  }

  private createNvmCommand(command: string): string {
    const { nvmPath } = this.options;
    if (!nvmPath) return command;
    const version = getRequiredNodeVersion();
    return `export NVM_DIR="${nvmPath.dir}" && . "${nvmPath.script}" && nvm use ${version} 2>/dev/null && ${command}`;
  }

  private cleanupTemp(): void {
    try {
      if (existsSync(this.tempBookPath)) {
        rmSync(this.tempBookPath, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  private formatFiles(files: string[] | Set<string>): string {
    const arr = Array.isArray(files) ? files : Array.from(files);
    if (arr.length === 0) return '';
    if (arr.length <= CONFIG.MAX_FILES_TO_SHOW) return arr.join(', ');
    return `${arr.slice(0, CONFIG.MAX_FILES_TO_SHOW).join(', ')} +${arr.length - CONFIG.MAX_FILES_TO_SHOW} more`;
  }

  private startServer(): void {
    if (this.serverProcess) return;
    const serveCmd = `npx --yes serve "${this.bookPath}" -l ${this.options.port} --no-request-logging`;
    this.serverProcess = spawn(serveCmd, { stdio: 'inherit', shell: '/bin/bash' });
    this.serverProcess.on('error', (err) => log.error(`Server error: ${err.message}`));
    this.serverProcess.on('close', () => { this.serverProcess = null; });
    log.info(`Server: http://localhost:${this.options.port}`);
  }

  private swapBuildOutput(): boolean {
    try {
      if (existsSync(this.bookPath)) {
        rmSync(this.bookPath, { recursive: true, force: true });
      }
      if (existsSync(this.tempBookPath)) {
        renameSync(this.tempBookPath, this.bookPath);
        return true;
      }
      return false;
    } catch (err) {
      log.error(`Failed to swap build output: ${err}`);
      this.cleanupTemp();
      return false;
    }
  }

  private startBuild(): void {
    this.currentBuildFiles = Array.from(this.pendingFiles);
    this.pendingFiles.clear();
    this.buildState = 'building';
    this.cleanupTemp();

    const filesMsg = this.formatFiles(this.currentBuildFiles);
    spin.start(filesMsg ? `Rebuilding (${filesMsg})...` : 'Rebuilding...');

    const buildCmd = this.createNvmCommand(`gitbook build . "${this.tempBookPath}" 2>&1`);

    this.buildProcess = spawn(buildCmd, {
      stdio: 'pipe',
      shell: '/bin/bash',
      cwd: this.options.projectRoot,
      detached: true,
    });

    this.buildProcessPid = this.buildProcess.pid ? -this.buildProcess.pid : null;

    let output = '';
    this.buildProcess.stdout?.on('data', (data) => { output += data.toString(); });
    this.buildProcess.stderr?.on('data', (data) => { output += data.toString(); });

    this.buildProcess.on('close', (code, signal) => this.handleBuildClose(code, signal, output));
    this.buildProcess.on('error', () => this.handleBuildError());
  }

  private handleBuildClose(code: number | null, signal: NodeJS.Signals | null, output: string): void {
    this.buildProcess = null;
    this.buildProcessPid = null;
    const wasCancelled = this.buildState === 'cancelling' || signal != null;
    this.buildState = 'idle';

    if (wasCancelled) {
      this.cleanupTemp();
      this.currentBuildFiles.forEach(f => this.pendingFiles.add(f));
      if (this.pendingFiles.size > 0) this.startBuild();
      return;
    }

    const hasSuccess = /generation finished with success/i.test(output);
    if ((code === 0 || hasSuccess) && this.swapBuildOutput()) {
      spin.succeed('Rebuild complete');
    } else {
      spin.fail('Rebuild failed');
      this.logBuildErrors(output);
      this.cleanupTemp();
    }

    if (this.pendingFiles.size > 0) {
      this.startBuild();
    }
  }

  private handleBuildError(): void {
    this.buildProcess = null;
    this.buildProcessPid = null;
    this.buildState = 'idle';
    spin.fail('Build process error');
    this.cleanupTemp();
  }

  private logBuildErrors(output: string): void {
    const errorLines = output.split('\n').filter(line =>
      /Error:|error:|TypeError|ENOENT|Template render error/.test(line)
    );
    if (errorLines.length > 0) {
      log.error(errorLines.join('\n'));
    } else {
      log.error('See console for details');
      console.log(output.slice(-500));
    }
  }

  private cancelBuild(): void {
    if (!this.buildProcess || this.buildState !== 'building') return;
    this.buildState = 'cancelling';

    if (this.buildProcessPid) {
      try { process.kill(this.buildProcessPid, 'SIGTERM'); } catch { }
    } else if (this.buildProcess.pid) {
      this.buildProcess.kill('SIGTERM');
    }

    setTimeout(() => {
      if (this.buildProcessPid) {
        try { process.kill(this.buildProcessPid, 'SIGKILL'); } catch { }
      } else if (this.buildProcess?.pid) {
        this.buildProcess.kill('SIGKILL');
      }
    }, 1000);
  }

  private onFileChange(file: string): void {
    const isNewFile = !this.pendingFiles.has(file);
    this.pendingFiles.add(file);

    if (this.buildState === 'building' || this.buildState === 'cancelling') {
      if (isNewFile && this.options.verbose) {
        log.info(`Queued: ${file}`);
      }
      if (this.cancelTimer) clearTimeout(this.cancelTimer);
      this.cancelTimer = setTimeout(() => {
        if (this.buildState === 'building') this.cancelBuild();
      }, 500);
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      if (this.buildState === 'idle' && this.pendingFiles.size > 0) {
        this.startBuild();
      }
    }, CONFIG.DEBOUNCE_MS);
  }

  private setupWatcher(): void {
    log.info('Watching...');
    this.watcher = watch(
      [
        resolve(this.options.projectRoot, '**/*.md'),
        resolve(this.options.projectRoot, 'book.json'),
        resolve(this.options.projectRoot, 'SUMMARY.md'),
      ],
      {
        ignored: [
          resolve(this.options.projectRoot, '_book/**'),
          resolve(this.options.projectRoot, '_book_temp/**'),
          resolve(this.options.projectRoot, 'node_modules/**'),
          resolve(this.options.projectRoot, 'gitbook-plugins/**'),
        ],
        ignoreInitial: true,
        persistent: true,
        awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
      }
    );

    const handleChange = (filePath: string) => {
      this.onFileChange(filePath.replace(this.options.projectRoot + '/', ''));
    };

    this.watcher.on('change', handleChange);
    this.watcher.on('add', handleChange);
    this.watcher.on('unlink', handleChange);
  }

  private runInitialBuild(): void {
    spin.start('Building...');
    this.buildState = 'building';

    const buildCmd = this.createNvmCommand(`gitbook build . "${this.tempBookPath}" 2>&1`);

    this.buildProcess = spawn(buildCmd, {
      stdio: 'pipe',
      shell: '/bin/bash',
      cwd: this.options.projectRoot,
      detached: true,
    });

    this.buildProcessPid = this.buildProcess.pid ? -this.buildProcess.pid : null;
    let output = '';

    this.buildProcess.stdout?.on('data', (data) => { output += data.toString(); });
    this.buildProcess.stderr?.on('data', (data) => { output += data.toString(); });

    this.buildProcess.on('close', (code) => {
      this.buildProcess = null;
      this.buildProcessPid = null;
      this.buildState = 'idle';

      const hasSuccess = /generation finished with success/i.test(output);
      if ((code === 0 || hasSuccess) && this.swapBuildOutput()) {
        spin.succeed('Build complete');
        this.startServer();
        this.setupWatcher();
      } else {
        spin.fail('Initial build failed');
        this.logBuildErrors(output);
        this.cleanupTemp();
        process.exit(1);
      }
    });
  }

  private setupSignalHandlers(): void {
    const cleanup = () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      if (this.cancelTimer) clearTimeout(this.cancelTimer);
      this.watcher?.close();

      if (this.buildProcessPid) {
        try { process.kill(this.buildProcessPid, 'SIGKILL'); } catch { }
      } else if (this.buildProcess) {
        this.buildProcess.kill('SIGKILL');
      }

      if (this.serverProcess) this.serverProcess.kill();
      killExistingServers(this.options.port);
      this.cleanupTemp();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }
}

export async function watchAndServe(options: WatchOptions): Promise<void> {
  const manager = new BuildManager(options);
  await manager.start();
}
