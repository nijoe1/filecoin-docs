import { log } from './log';
import { getRequiredNodeVersion, runWithNodeVersion, setupNodeVersion } from './node-version';

type NodeSetupResult = Awaited<ReturnType<typeof setupNodeVersion>>;

export function checkGitbookInstalled(nvmPath: NodeSetupResult['nvmPath']): boolean {
  try {
    const output = runWithNodeVersion('which gitbook', nvmPath, { silent: true });
    
    // If using NVM, verify the path matches the version
    if (nvmPath) {
      return output.includes(`v${getRequiredNodeVersion()}`);
    }

    // If native (nvmPath is null), we already verified Node version in setupNodeVersion.
    // So just existing is enough.
    return !!output.trim();
  } catch {
    return false;
  }
}

export async function ensureGitbookReady(): Promise<NodeSetupResult> {
  const nodeSetup = await setupNodeVersion();

  if (!checkGitbookInstalled(nodeSetup.nvmPath)) {
    log.error('gitbook-cli is not installed. Run "npm run setup" first.');
    process.exit(1);
  }

  return nodeSetup;
}
