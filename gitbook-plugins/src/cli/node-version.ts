import { execSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { log, spin, confirm } from './log';

export const REQUIRED_NODE_VERSION = '10';

export interface NvmPaths {
  script: string;
  dir: string;
}

/**
 * Finds the NVM installation path.
 * Checks common locations: environment variable, home directory, and Homebrew paths.
 */
export function findNvmPath(): NvmPaths | null {
  const homeDir = process.env.HOME || '';
  const nvmDir = process.env.NVM_DIR || join(homeDir, '.nvm');

  const possiblePaths = [
    { dir: nvmDir, script: join(nvmDir, 'nvm.sh') },
    { dir: '/usr/local/opt/nvm', script: '/usr/local/opt/nvm/nvm.sh' },
    { dir: '/opt/homebrew/opt/nvm', script: '/opt/homebrew/opt/nvm/nvm.sh' },
  ];

  // Try to find via brew if available
  try {
    const brewPrefix = execSync('brew --prefix nvm', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    if (brewPrefix) {
      possiblePaths.push({ dir: brewPrefix, script: join(brewPrefix, 'nvm.sh') });
    }
  } catch {
    // Ignore if brew is not available
  }

  for (const path of possiblePaths) {
    if (existsSync(path.script)) {
      return path;
    }
  }
  return null;
}

function getNodeMajorVersion(): number {
  try {
    const version = execSync('node -v', { encoding: 'utf-8' }).trim();
    return parseInt(version.replace('v', '').split('.')[0], 10);
  } catch {
    return 0;
  }
}

function getCurrentNodeVersion(): string {
  try {
    return execSync('node -v', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

/**
 * Checks if a specific Node version is available in NVM.
 * Runs `nvm ls <version>` and checks for the version string in output.
 */
function checkNodeVersionAvailable(nvmPath: NvmPaths): boolean {
  try {
    const checkCmd = `
      export NVM_DIR="${nvmPath.dir}"
      . "${nvmPath.script}"
      nvm ls ${REQUIRED_NODE_VERSION} 2>/dev/null | grep -q "v${REQUIRED_NODE_VERSION}"
    `;
    execSync(checkCmd, { stdio: 'pipe', shell: '/bin/bash' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Installs the required Node version using NVM.
 */
async function installNodeVersion(nvmPath: NvmPaths): Promise<boolean> {
  spin.start(`Installing Node.js v${REQUIRED_NODE_VERSION} via nvm...`);
  try {
    const installCmd = `
      export NVM_DIR="${nvmPath.dir}"
      . "${nvmPath.script}"
      nvm install ${REQUIRED_NODE_VERSION} 2>&1
    `;
    execSync(installCmd, { stdio: 'pipe', shell: '/bin/bash' });
    spin.succeed(`Node.js v${REQUIRED_NODE_VERSION} installed successfully`);
    return true;
  } catch (err) {
    spin.fail(`Failed to install Node.js v${REQUIRED_NODE_VERSION}`);
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (errorMessage.includes('nvm: command not found')) {
      log.error('Reason: nvm command not available in shell');
    } else if (errorMessage.includes('No such file')) {
      log.error('Reason: nvm.sh script not found');
    } else if (errorMessage.includes('network')) {
      log.error('Reason: Network error during download');
    } else {
      log.error(`Reason: ${errorMessage}`);
    }
    return false;
  }
}

/**
 * Ensures the required Node version is installed and set up.
 * 1. Checks current Node version.
 * 2. If mismatch, finds NVM.
 * 3. Checks/Installs required Node version via NVM.
 * 4. Caches the PATH environment variable for the required Node version to speed up future executions.
 */
export async function setupNodeVersion(): Promise<{ originalVersion: string; nvmPath: NvmPaths | null }> {
  const originalVersion = getCurrentNodeVersion();
  const currentMajor = getNodeMajorVersion();

  if (currentMajor === parseInt(REQUIRED_NODE_VERSION, 10)) {
    log.success(`Node.js v${REQUIRED_NODE_VERSION} is already active`);
    return { originalVersion, nvmPath: null };
  }

  log.warn(`Gitbook-cli requires Node.js v${REQUIRED_NODE_VERSION}.x (current: v${currentMajor})`);

  const nvmPath = findNvmPath();
  if (!nvmPath) {
    log.error('nvm is not installed. Please install nvm first:');
    console.log('');
    console.log('  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash');
    console.log('');
    console.log(`Then install Node.js v${REQUIRED_NODE_VERSION}:`);
    console.log('');
    console.log(`  nvm install ${REQUIRED_NODE_VERSION}`);
    console.log('');
    process.exit(1);
  }

  // Check if Node 10 is installed via nvm, if not prompt to install it
  if (!checkNodeVersionAvailable(nvmPath)) {
    log.warn(`Node.js v${REQUIRED_NODE_VERSION} is not installed.`);

    const shouldInstall = await confirm(`Install Node.js v${REQUIRED_NODE_VERSION} via nvm?`);
    if (!shouldInstall) {
      log.info('Installation cancelled. Please install manually:');
      console.log('');
      console.log(`  nvm install ${REQUIRED_NODE_VERSION}`);
      console.log('');
      process.exit(0);
    }

    const installed = await installNodeVersion(nvmPath);
    if (!installed) {
      log.error('Please install manually:');
      console.log('');
      console.log(`  nvm install ${REQUIRED_NODE_VERSION}`);
      console.log('');
      process.exit(1);
    }
  }

  log.info(`Using nvm to switch to Node.js v${REQUIRED_NODE_VERSION}...`);

  return { originalVersion, nvmPath };
}

/**
 * Creates the command prefix to run commands in the correct NVM context.
 */
export function getNvmCommandPrefix(nvmPath: NvmPaths | null): string {
  if (!nvmPath) return '';
  return `export NVM_DIR="${nvmPath.dir}" && . "${nvmPath.script}" && nvm use ${REQUIRED_NODE_VERSION} 2>/dev/null &&`;
}

/**
 * Executes a command within the context of the required Node version.
 * Explicitly sources NVM script on every call to ensure correct environment.
 */
export function runWithNodeVersion(command: string, nvmPath: NvmPaths | null, options?: { silent?: boolean }): string {
  const stdio = options?.silent ? 'pipe' : 'inherit';

  if (!nvmPath) {
    const result = execSync(command, { stdio, encoding: 'utf-8', shell: '/bin/bash' });
    return result || '';
  }

  const prefix = getNvmCommandPrefix(nvmPath);
  const nvmCommand = `${prefix} ${command}`;

  const result = execSync(nvmCommand, { stdio, encoding: 'utf-8', shell: '/bin/bash' });
  return result || '';
}

/**
 * Spawns a child process within the context of the required Node version.
 * Handles signal propagation (SIGINT, SIGTERM) to the child process.
 */
export function spawnWithNodeVersion(command: string, nvmPath: NvmPaths | null): void {
  const nvmCommand = nvmPath
    ? `export NVM_DIR="${nvmPath.dir}" && . "${nvmPath.script}" && nvm use ${REQUIRED_NODE_VERSION} && ${command}`
    : command;

  const child = spawn(nvmCommand, {
    stdio: 'inherit',
    shell: '/bin/bash',
  });

  child.on('error', (err) => {
    console.error('Failed to start process:', err);
    process.exit(1);
  });

  const killChild = (signal: NodeJS.Signals) => {
    if (child.pid) child.kill(signal);
  };

  process.on('SIGINT', () => killChild('SIGINT'));
  process.on('SIGTERM', () => killChild('SIGTERM'));
}

export function getRequiredNodeVersion(): string {
  return REQUIRED_NODE_VERSION;
}
