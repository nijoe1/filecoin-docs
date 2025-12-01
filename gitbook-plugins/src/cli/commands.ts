import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { confirm, log, spin } from './log';
import { checkGitbookInstalled, ensureGitbookReady } from './gitbook';
import { getDefaultPort, killExistingServers } from './server';
import { Builder } from './builder';
import { watchAndServe } from './watch';
import { getRequiredNodeVersion, runWithNodeVersion, setupNodeVersion } from './node-version';

export interface CommandOptions {
  port?: number;
  verbose?: boolean;
}

function getProjectRoot(): string {
  return resolve(__dirname, '..', '..', '..');
}

export async function build(): Promise<void> {
  const { nvmPath } = await ensureGitbookReady();
  const projectRoot = getProjectRoot();
  const builder = new Builder(projectRoot, nvmPath);
  await builder.build();
}

export async function serve(options: CommandOptions = {}): Promise<void> {
  const port = options.port || getDefaultPort();
  const verbose = options.verbose || false;
  const projectRoot = getProjectRoot();
  const { nvmPath } = await ensureGitbookReady();

  killExistingServers(port);
  await watchAndServe({ port, projectRoot, nvmPath, verbose });
}

export function preview(options: CommandOptions = {}): void {
  const port = options.port || getDefaultPort();
  const projectRoot = getProjectRoot();
  const bookPath = resolve(projectRoot, '_book');

  if (!existsSync(bookPath)) {
    log.error('No _book directory found. Run "npm run build" first.');
    process.exit(1);
  }

  killExistingServers(port);
  log.info(`Serving static files from _book on port ${port}...`);
  log.info('Press Ctrl+C to stop the server');
  console.log('');

  try {
    execSync(`npx --yes serve "${bookPath}" -l ${port} --no-request-logging`, { stdio: 'inherit' });
  } catch {
    try {
      execSync(`python3 -m http.server ${port} --directory "${bookPath}"`, { stdio: 'inherit' });
    } catch {
      log.error('Could not start static server. Install serve: npm install -g serve');
      process.exit(1);
    }
  }
}

export function stop(options: CommandOptions = {}): void {
  const port = options.port || getDefaultPort();
  log.info('Stopping any running gitbook servers...');
  killExistingServers(port);
  log.success('Servers stopped');
}

export async function setup(): Promise<void> {
  const nodeVersion = getRequiredNodeVersion();

  // Step 1 & 2: Check/install nvm and Node version (reusing logic)
  const { nvmPath } = await setupNodeVersion();

  // Step 3: Check/install gitbook-cli
  log.info('Checking for gitbook-cli...');
  const hasGitbook = checkGitbookInstalled(nvmPath);

  if (!hasGitbook) {
    const shouldInstall = await confirm('gitbook-cli is not installed. Install it now?');
    if (!shouldInstall) {
      log.info('Skipped. Install manually with:');
      console.log(`  nvm use ${nodeVersion} && npm install -g gitbook-cli`);
      process.exit(0);
    }

    spin.start('Installing gitbook-cli...');
    try {
      // Suppress npm warnings by redirecting stderr
      runWithNodeVersion('npm install -g gitbook-cli 2>/dev/null', nvmPath, { silent: true });
      spin.succeed('gitbook-cli installed');
    } catch (err) {
      spin.fail('Failed to install gitbook-cli');
      const msg = err instanceof Error ? err.message : String(err);
      log.error(msg);
      process.exit(1);
    }
  } else {
    log.success('gitbook-cli is installed');
  }

  console.log('');
  log.success('Setup complete! You can now run:');
  console.log('');
  console.log('  npm run build   # Build the docs');
  console.log('  npm run dev     # Build and serve with live reload');
  console.log('');
}
