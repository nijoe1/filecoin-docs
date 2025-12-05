import { spawn, ChildProcess } from 'child_process';
import { watch, FSWatcher } from 'chokidar';
import { existsSync, renameSync } from 'fs';
import { resolve } from 'path';
import { log, spin, confirm } from './log';
import { NvmPaths, createNvmCommand } from './node-version';
import { getGitbookBin } from './gitbook';
import { killExistingServers } from './server';
import { CONFIG, rmRecursive, SERVE_PATH_PREFIX } from './constants';

type BuildState = 'idle' | 'building' | 'cancelling';

export interface WatchOptions {
  port: number;
  projectRoot: string;
  nvmPath: NvmPaths | null;
  verbose?: boolean;
}

class BuildManager {
  private bookPath: string;
  private tempPath: string;
  private serverProc: ChildProcess | null = null;
  private buildProc: ChildProcess | null = null;
  private buildPid: number | null = null;
  private watcher: FSWatcher | null = null;
  private state: BuildState = 'idle';
  private debounce: NodeJS.Timeout | null = null;
  private cancelTimeout: NodeJS.Timeout | null = null;
  private pending = new Set<string>();
  private current: string[] = [];

  constructor(private opts: WatchOptions) {
    this.bookPath = resolve(opts.projectRoot, '_book');
    this.tempPath = resolve(opts.projectRoot, '_book_temp');
  }

  async start() {
    log.debug(`Project: ${this.opts.projectRoot}`, this.opts.verbose);
    log.debug(`Book: ${this.bookPath}`, this.opts.verbose);
    log.debug(`Port: ${this.opts.port}`, this.opts.verbose);
    this.cleanup();

    if (existsSync(this.bookPath)) {
      log.info('Using existing _book...');
      if (await confirm('Rebuild before starting?')) {
        this.initialBuild();
      } else {
        this.startServer();
        this.setupWatcher();
      }
    } else {
      this.initialBuild();
    }
    this.setupSignals();
  }

  private cleanup() {
    try { if (existsSync(this.tempPath)) rmRecursive(this.tempPath); } catch { /* ignore */ }
  }

  private formatFiles(files: string[] | Set<string>): string {
    const arr = Array.isArray(files) ? files : [...files];
    if (arr.length <= CONFIG.MAX_FILES_TO_SHOW) return arr.join(', ');
    return `${arr.slice(0, CONFIG.MAX_FILES_TO_SHOW).join(', ')} +${arr.length - CONFIG.MAX_FILES_TO_SHOW} more`;
  }

  private startServer() {
    if (this.serverProc) return;
    const quiet = this.opts.verbose ? '' : ' --no-request-logging 2>/dev/null';
    const cmd = `${SERVE_PATH_PREFIX} npx --yes serve@14 "${this.bookPath}" -l ${this.opts.port}${quiet}`;
    log.debug(`Server: ${cmd}`, this.opts.verbose);

    this.serverProc = spawn(cmd, { stdio: 'inherit', shell: '/bin/bash', detached: true });
    this.serverProc.unref();
    this.serverProc.on('error', (e) => log.error(`Server error: ${e.message}`));
    this.serverProc.on('close', (code) => {
      if (code && code !== 0) log.error(`Server exited: ${code}`);
      this.serverProc = null;
    });
  }

  private swap(): boolean {
    try {
      if (existsSync(this.bookPath)) rmRecursive(this.bookPath);
      if (existsSync(this.tempPath)) { renameSync(this.tempPath, this.bookPath); return true; }
      return false;
    } catch (e) {
      log.error(`Swap failed: ${e}`);
      this.cleanup();
      return false;
    }
  }

  private rebuild() {
    this.current = [...this.pending];
    this.pending.clear();
    this.state = 'building';
    this.cleanup();

    const msg = this.current.length ? `Rebuilding (${this.formatFiles(this.current)})...` : 'Rebuilding...';
    spin.start(msg);

    const cmd = createNvmCommand(`"${getGitbookBin()}" build . "${this.tempPath}" 2>&1`, this.opts.nvmPath);
    log.debug(`Build: ${cmd}`, this.opts.verbose);

    this.buildProc = spawn(cmd, { stdio: 'pipe', shell: '/bin/bash', cwd: this.opts.projectRoot, detached: true });
    this.buildPid = this.buildProc.pid ? -this.buildProc.pid : null;

    let out = '';
    this.buildProc.stdout?.on('data', (d) => { out += d; });
    this.buildProc.stderr?.on('data', (d) => { out += d; });
    this.buildProc.on('close', (code, sig) => this.onBuildClose(code, sig, out));
    this.buildProc.on('error', () => this.onBuildError());
  }

  private onBuildClose(code: number | null, sig: NodeJS.Signals | null, out: string) {
    this.buildProc = null;
    this.buildPid = null;
    const cancelled = this.state === 'cancelling' || sig != null;
    this.state = 'idle';

    if (cancelled) {
      this.cleanup();
      this.current.forEach(f => this.pending.add(f));
      if (this.pending.size) this.rebuild();
      return;
    }

    if (this.opts.verbose && out) console.log(out);

    const ok = code === 0 || /generation finished with success/i.test(out);
    if (ok && this.swap()) {
      spin.succeed('Rebuild complete');
    } else {
      spin.fail('Rebuild failed');
      if (out) console.log(out);
      this.cleanup();
    }

    if (this.pending.size) this.rebuild();
  }

  private onBuildError() {
    this.buildProc = null;
    this.buildPid = null;
    this.state = 'idle';
    spin.fail('Build error');
    this.cleanup();
  }

  private cancelBuild() {
    if (!this.buildProc || this.state !== 'building') return;
    this.state = 'cancelling';
    if (this.buildPid) try { process.kill(this.buildPid, 'SIGTERM'); } catch { /* ignore */ }
    else this.buildProc.kill('SIGTERM');

    setTimeout(() => {
      if (this.buildPid) try { process.kill(this.buildPid, 'SIGKILL'); } catch { /* ignore */ }
      else this.buildProc?.kill('SIGKILL');
    }, 1000);
  }

  private onFileChange(file: string) {
    const isNew = !this.pending.has(file);
    this.pending.add(file);

    if (this.state !== 'idle') {
      if (isNew && this.opts.verbose) log.info(`Queued: ${file}`);
      if (this.cancelTimeout) clearTimeout(this.cancelTimeout);
      this.cancelTimeout = setTimeout(() => { if (this.state === 'building') this.cancelBuild(); }, 500);
      return;
    }

    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => {
      this.debounce = null;
      if (this.state === 'idle' && this.pending.size) this.rebuild();
    }, CONFIG.DEBOUNCE_MS);
  }

  private setupWatcher() {
    log.info('Watching...');
    const root = this.opts.projectRoot;
    this.watcher = watch(
      [resolve(root, '**/*.md'), resolve(root, 'book.json'), resolve(root, 'SUMMARY.md')],
      {
        ignored: [resolve(root, '_book/**'), resolve(root, '_book_temp/**'), resolve(root, 'node_modules/**'), resolve(root, 'gitbook-plugins/**')],
        ignoreInitial: true,
        persistent: true,
        awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
      }
    );
    const handle = (p: string) => this.onFileChange(p.replace(root + '/', ''));
    this.watcher.on('change', handle).on('add', handle).on('unlink', handle);
  }

  private initialBuild() {
    spin.start('Building...');
    this.state = 'building';

    const cmd = createNvmCommand(`"${getGitbookBin()}" build . "${this.tempPath}" 2>&1`, this.opts.nvmPath);
    log.debug(`Build: ${cmd}`, this.opts.verbose);

    this.buildProc = spawn(cmd, { stdio: 'pipe', shell: '/bin/bash', cwd: this.opts.projectRoot, detached: true });
    this.buildPid = this.buildProc.pid ? -this.buildProc.pid : null;

    let out = '';
    this.buildProc.stdout?.on('data', (d) => { out += d; });
    this.buildProc.stderr?.on('data', (d) => { out += d; });

    this.buildProc.on('close', (code) => {
      this.buildProc = null;
      this.buildPid = null;
      this.state = 'idle';

      if (this.opts.verbose && out) console.log(out);

      const ok = code === 0 || /generation finished with success/i.test(out);
      if (ok && this.swap()) {
        spin.succeed('Build complete');
        this.startServer();
        this.setupWatcher();
      } else {
        spin.fail('Build failed');
        if (out) console.log(out);
        this.cleanup();
        process.exit(1);
      }
    });
  }

  private setupSignals() {
    const exit = () => {
      if (this.debounce) clearTimeout(this.debounce);
      if (this.cancelTimeout) clearTimeout(this.cancelTimeout);
      this.watcher?.close();
      if (this.buildPid) try { process.kill(this.buildPid, 'SIGKILL'); } catch { /* ignore */ }
      else this.buildProc?.kill('SIGKILL');
      this.serverProc?.kill();
      killExistingServers(this.opts.port);
      this.cleanup();
      process.exit(0);
    };
    process.on('SIGINT', exit);
    process.on('SIGTERM', exit);
  }
}

export const watchAndServe = async (opts: WatchOptions) => new BuildManager(opts).start();
