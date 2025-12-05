import { execSync } from 'child_process';
import { log } from './log';
import { DEFAULT_PORT, LIVERELOAD_PORT } from './constants';

function killProcessOnPort(port: number): void {
  try {
    const pids = execSync(`lsof -ti:${port}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (pids) {
      log.warn(`Killing server on port ${port} (PIDs: ${pids.replace(/\n/g, ', ')})`);
      execSync(`kill -9 ${pids.split('\n').join(' ')}`, { stdio: 'ignore' });
    }
  } catch { /* No process on port */ }
}

export const killExistingServers = (port = DEFAULT_PORT) => {
  killProcessOnPort(LIVERELOAD_PORT);
  killProcessOnPort(port);
};

export const getDefaultPort = () => DEFAULT_PORT;
