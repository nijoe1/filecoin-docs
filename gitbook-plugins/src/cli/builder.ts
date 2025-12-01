import { spawn, ChildProcess } from 'child_process';
import { existsSync, rmSync, renameSync } from 'fs';
import { log, spin } from './log';
import { getRequiredNodeVersion, setupNodeVersion } from './node-version';
import { CONFIG, getBookPath, getTempBookPath } from './constants';

type NvmPath = Awaited<ReturnType<typeof setupNodeVersion>>['nvmPath'];
export type BuildState = 'idle' | 'building' | 'cancelling';

export class Builder {
  private projectRoot: string;
  private nvmPath: NvmPath;
  private verbose: boolean;
  private buildProcess: ChildProcess | null = null;
  private buildProcessPid: number | null = null;
  private state: BuildState = 'idle';

  constructor(projectRoot: string, nvmPath: NvmPath, verbose: boolean = false) {
    this.projectRoot = projectRoot;
    this.nvmPath = nvmPath;
    this.verbose = verbose;
  }

  public get currentState(): BuildState {
    return this.state;
  }

  public async build(files: string[] = []): Promise<boolean> {
    this.state = 'building';
    const tempBookPath = getTempBookPath(this.projectRoot);
    this.cleanupTemp();

    const filesMsg = this.formatFiles(files);
    spin.start(filesMsg ? `Rebuilding (${filesMsg})...` : 'Rebuilding...');

    return new Promise((resolve) => {
      const buildCmd = this.createNvmCommand(`gitbook build . "${tempBookPath}" 2>&1`);

      this.buildProcess = spawn(buildCmd, {
        stdio: 'pipe',
        shell: '/bin/bash',
        cwd: this.projectRoot,
        detached: true,
      });

      this.buildProcessPid = this.buildProcess.pid ? -this.buildProcess.pid : null;

      let output = '';
      this.buildProcess.stdout?.on('data', (data) => { output += data.toString(); });
      this.buildProcess.stderr?.on('data', (data) => { output += data.toString(); });

      this.buildProcess.on('close', (code, signal) => {
        const wasCancelled = this.state === 'cancelling' || signal != null;
        this.cleanupProcess();

        if (wasCancelled) {
          this.cleanupTemp();
          resolve(false);
          return;
        }

        const hasSuccess = /generation finished with success/i.test(output);
        if (code === 0 || hasSuccess) {
          if (this.swapBuildOutput()) {
            spin.succeed('Rebuild complete');
            resolve(true);
          } else {
            spin.fail('Build output missing');
            resolve(false);
          }
        } else {
          spin.fail('Rebuild failed');
          this.logErrors(output);
          this.cleanupTemp();
          resolve(false);
        }
      });

      this.buildProcess.on('error', () => {
        this.cleanupProcess();
        spin.fail('Build process error');
        this.cleanupTemp();
        resolve(false);
      });
    });
  }

  public cancel(): void {
    if (!this.buildProcess || this.state !== 'building') return;
    this.state = 'cancelling';

    if (this.buildProcessPid) {
      try {
        process.kill(this.buildProcessPid, 'SIGTERM');
      } catch {
        // Process might already be dead
      }
    } else if (this.buildProcess.pid) {
      this.buildProcess.kill('SIGTERM');
    }

    setTimeout(() => {
      if (this.buildProcessPid) {
        try {
          process.kill(this.buildProcessPid, 'SIGKILL');
        } catch {
          // Process might already be dead
        }
      } else if (this.buildProcess?.pid) {
        this.buildProcess.kill('SIGKILL');
      }
    }, 1000);
  }

  private cleanupProcess(): void {
    this.buildProcess = null;
    this.buildProcessPid = null;
    this.state = 'idle';
  }

  private createNvmCommand(command: string): string {
    if (!this.nvmPath) return command;
    const version = getRequiredNodeVersion();
    return `export NVM_DIR="${this.nvmPath.dir}" && . "${this.nvmPath.script}" && nvm use ${version} 2>/dev/null && ${command}`;
  }

  private cleanupTemp(): void {
    const tempPath = getTempBookPath(this.projectRoot);
    try {
      if (existsSync(tempPath)) {
        rmSync(tempPath, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  private swapBuildOutput(): boolean {
    const bookPath = getBookPath(this.projectRoot);
    const tempBookPath = getTempBookPath(this.projectRoot);

    try {
      if (existsSync(bookPath)) {
        rmSync(bookPath, { recursive: true, force: true });
      }
      if (existsSync(tempBookPath)) {
        renameSync(tempBookPath, bookPath);
        return true;
      }
      return false;
    } catch (err) {
      log.error(`Failed to swap build output: ${err}`);
      this.cleanupTemp();
      return false;
    }
  }

  private formatFiles(files: string[]): string {
    if (files.length === 0) return '';
    if (files.length <= CONFIG.MAX_FILES_TO_SHOW) return files.join(', ');
    return `${files.slice(0, CONFIG.MAX_FILES_TO_SHOW).join(', ')} +${files.length - CONFIG.MAX_FILES_TO_SHOW} more`;
  }

  private logErrors(output: string): void {
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
}

