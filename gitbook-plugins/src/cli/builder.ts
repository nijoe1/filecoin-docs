import { spawn } from 'child_process';
import { existsSync, renameSync } from 'fs';
import { log, spin } from './log';
import { setupNodeVersion, createNvmCommand } from './node-version';
import { getGitbookBin } from './gitbook';
import { CONFIG, getBookPath, getTempBookPath, rmRecursive } from './constants';

type NvmPath = Awaited<ReturnType<typeof setupNodeVersion>>['nvmPath'];

export class Builder {
  constructor(
    private projectRoot: string,
    private nvmPath: NvmPath,
    private verbose = false
  ) {}

  async build(files: string[] = []): Promise<boolean> {
    const tempPath = getTempBookPath(this.projectRoot);
    const bookPath = getBookPath(this.projectRoot);
    this.cleanup(tempPath);

    log.debug(`Build output: ${bookPath}`, this.verbose);
    log.debug(`Temp output: ${tempPath}`, this.verbose);

    const isRebuild = files.length > 0;
    const filesMsg = this.formatFiles(files);
    spin.start(isRebuild ? `Rebuilding (${filesMsg})...` : 'Building...');

    return new Promise((resolve) => {
      const cmd = createNvmCommand(`"${getGitbookBin()}" build . "${tempPath}" 2>&1`, this.nvmPath);
      log.debug(`Build command: ${cmd}`, this.verbose);

      const proc = spawn(cmd, { stdio: 'pipe', shell: '/bin/bash', cwd: this.projectRoot, detached: true });
      let output = '';

      proc.stdout?.on('data', (d) => { output += d; });
      proc.stderr?.on('data', (d) => { output += d; });

      proc.on('close', (code) => {
        if (this.verbose && output) console.log(output);

        const success = code === 0 || /generation finished with success/i.test(output);
        if (success && this.swap(tempPath, bookPath)) {
          spin.succeed(isRebuild ? 'Rebuild complete' : 'Build complete');
          resolve(true);
        } else {
          spin.fail(isRebuild ? 'Rebuild failed' : 'Build failed');
          if (output) console.log(output);
          this.cleanup(tempPath);
          resolve(false);
        }
      });

      proc.on('error', () => {
        spin.fail('Build process error');
        this.cleanup(tempPath);
        resolve(false);
      });
    });
  }

  private cleanup(path: string) {
    try { if (existsSync(path)) rmRecursive(path); } catch { /* ignore */ }
  }

  private swap(tempPath: string, bookPath: string): boolean {
    try {
      if (existsSync(bookPath)) rmRecursive(bookPath);
      if (existsSync(tempPath)) { renameSync(tempPath, bookPath); return true; }
      return false;
    } catch (err) {
      log.error(`Failed to swap build output: ${err}`);
      this.cleanup(tempPath);
      return false;
    }
  }

  private formatFiles(files: string[]): string {
    if (files.length === 0) return '';
    if (files.length <= CONFIG.MAX_FILES_TO_SHOW) return files.join(', ');
    return `${files.slice(0, CONFIG.MAX_FILES_TO_SHOW).join(', ')} +${files.length - CONFIG.MAX_FILES_TO_SHOW} more`;
  }
}
