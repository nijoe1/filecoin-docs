import { execSync, spawn, ChildProcess } from 'child_process';
import { log } from './log';
import { DEFAULT_PORT, LIVERELOAD_PORT } from './constants';

function killProcessOnPort(port: number): void {
  try {
    // Find PID(s) using the port
    const pids = execSync(`lsof -ti:${port}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

    if (pids) {
      log.warn(`Killing existing server on port ${port} (PIDs: ${pids.replace(/\n/g, ', ')})...`);
      // Kill the processes
      execSync(`kill -9 ${pids.split('\n').join(' ')}`, { stdio: 'ignore' });
    }
  } catch {
    // No process on port or lsof failed, which is expected/fine
  }
}

export function killExistingServers(port: number = DEFAULT_PORT): void {
  killProcessOnPort(LIVERELOAD_PORT);
  killProcessOnPort(port);
}

export function getDefaultPort(): number {
  return DEFAULT_PORT;
}

export class ServerManager {
  private port: number;
  private process: ChildProcess | null = null;
  private bookPath: string;

  constructor(port: number, bookPath: string) {
    this.port = port;
    this.bookPath = bookPath;
  }

  public start(): void {
    if (this.process) return;
    const serveCmd = `npx --yes serve "${this.bookPath}" -l ${this.port} --no-request-logging`;
    this.process = spawn(serveCmd, { stdio: 'inherit', shell: '/bin/bash' });
    this.process.on('error', (err) => log.error(`Server error: ${err.message}`));
    this.process.on('close', () => { this.process = null; });
  }

  public stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}
