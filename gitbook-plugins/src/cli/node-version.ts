import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { log, spin, confirm } from './log';
import { REQUIRED_NODE_VERSION } from './constants';

export interface NvmPaths {
  script: string;
  dir: string;
}

function findNvmPath(): NvmPaths | null {
  const homeDir = process.env.HOME || '';
  const nvmDir = process.env.NVM_DIR || join(homeDir, '.nvm');

  const paths = [
    { dir: nvmDir, script: join(nvmDir, 'nvm.sh') },
    { dir: '/usr/local/opt/nvm', script: '/usr/local/opt/nvm/nvm.sh' },
    { dir: '/opt/homebrew/opt/nvm', script: '/opt/homebrew/opt/nvm/nvm.sh' },
  ];

  // Try brew prefix
  try {
    const brewPrefix = execSync('brew --prefix nvm', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (brewPrefix) paths.push({ dir: brewPrefix, script: join(brewPrefix, 'nvm.sh') });
  } catch { /* brew not available */ }

  return paths.find(p => existsSync(p.script)) || null;
}

function getNodeMajorVersion(): number {
  try {
    return parseInt(execSync('node -v', { encoding: 'utf-8' }).trim().replace('v', '').split('.')[0], 10);
  } catch {
    return 0;
  }
}

function checkNodeVersionAvailable(nvmPath: NvmPaths): boolean {
  try {
    execSync(`export NVM_DIR="${nvmPath.dir}" && . "${nvmPath.script}" && nvm ls ${REQUIRED_NODE_VERSION} 2>/dev/null | grep -q "v${REQUIRED_NODE_VERSION}"`, { stdio: 'pipe', shell: '/bin/bash' });
    return true;
  } catch {
    return false;
  }
}

async function installNodeVersion(nvmPath: NvmPaths): Promise<boolean> {
  spin.start(`Installing Node.js v${REQUIRED_NODE_VERSION} via nvm...`);
  try {
    execSync(`export NVM_DIR="${nvmPath.dir}" && . "${nvmPath.script}" && nvm install ${REQUIRED_NODE_VERSION} 2>&1`, { stdio: 'pipe', shell: '/bin/bash' });
    spin.succeed(`Node.js v${REQUIRED_NODE_VERSION} installed`);
    return true;
  } catch (err) {
    spin.fail(`Failed to install Node.js v${REQUIRED_NODE_VERSION}`);
    log.error(err instanceof Error ? err.message : String(err));
    return false;
  }
}

function getNvmPrefix(nvmPath: NvmPaths): string {
  return `unset npm_config_prefix && export NVM_DIR="${nvmPath.dir}" && . "${nvmPath.script}" && nvm use ${REQUIRED_NODE_VERSION} 2>/dev/null &&`;
}

export async function setupNodeVersion(): Promise<{ originalVersion: string; nvmPath: NvmPaths | null }> {
  const originalVersion = execSync('node -v', { encoding: 'utf-8' }).trim();
  const currentMajor = getNodeMajorVersion();

  if (currentMajor === parseInt(REQUIRED_NODE_VERSION, 10)) {
    log.success(`Node.js v${REQUIRED_NODE_VERSION} is already active`);
    return { originalVersion, nvmPath: null };
  }

  log.warn(`Gitbook-cli requires Node.js v${REQUIRED_NODE_VERSION}.x (current: v${currentMajor})`);

  const nvmPath = findNvmPath();
  if (!nvmPath) {
    log.error('nvm is not installed. Please install nvm first:');
    console.log('\n  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash\n');
    console.log(`Then: nvm install ${REQUIRED_NODE_VERSION}\n`);
    process.exit(1);
  }

  if (!checkNodeVersionAvailable(nvmPath)) {
    log.warn(`Node.js v${REQUIRED_NODE_VERSION} is not installed.`);
    const shouldInstall = await confirm(`Install Node.js v${REQUIRED_NODE_VERSION} via nvm?`);

    if (!shouldInstall) {
      log.info(`Cancelled. Run: nvm install ${REQUIRED_NODE_VERSION}`);
      process.exit(0);
    }

    if (!await installNodeVersion(nvmPath)) {
      log.error(`Run manually: nvm install ${REQUIRED_NODE_VERSION}`);
      process.exit(1);
    }
  }

  log.info(`Using nvm to switch to Node.js v${REQUIRED_NODE_VERSION}...`);
  return { originalVersion, nvmPath };
}

export function createNvmCommand(command: string, nvmPath: NvmPaths | null): string {
  return nvmPath ? `${getNvmPrefix(nvmPath)} ${command}` : command;
}

export function runWithNodeVersion(command: string, nvmPath: NvmPaths | null, options?: { silent?: boolean; verbose?: boolean }): string {
  const silent = options?.silent && !options?.verbose;
  const fullCmd = nvmPath ? `${getNvmPrefix(nvmPath)} ${command}` : command;
  return execSync(fullCmd, { stdio: silent ? 'pipe' : 'inherit', encoding: 'utf-8', shell: '/bin/bash' }) || '';
}
