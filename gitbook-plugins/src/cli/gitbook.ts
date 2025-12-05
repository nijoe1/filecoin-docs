import { existsSync } from 'fs';
import { resolve } from 'path';
import { log } from './log';
import { runWithNodeVersion, setupNodeVersion } from './node-version';

type NvmPath = Awaited<ReturnType<typeof setupNodeVersion>>['nvmPath'];

const getGitbookDir = () => resolve(__dirname, '..', '..', '..', '.gitbook', 'cli');

export const getGitbookBin = () => resolve(getGitbookDir(), 'node_modules', '.bin', 'gitbook');

export const checkGitbookInstalled = () => existsSync(getGitbookBin());

export async function installGitbook(nvmPath: NvmPath): Promise<boolean> {
  const dir = getGitbookDir();
  try {
    runWithNodeVersion(`mkdir -p "${dir}" && cd "${dir}" && npm init -y && npm install gitbook-cli@2.3.2`, nvmPath, { silent: false });
    return checkGitbookInstalled();
  } catch (err) {
    log.error(`Install error: ${err}`);
    return false;
  }
}

export async function ensureGitbookReady(): Promise<{ originalVersion: string; nvmPath: NvmPath }> {
  const result = await setupNodeVersion();
  if (!checkGitbookInstalled()) {
    log.error('gitbook-cli is not installed. Run "npm run setup" first.');
    process.exit(1);
  }
  return result;
}
