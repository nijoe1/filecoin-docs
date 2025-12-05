import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { confirm, log, spin } from './log';
import { checkGitbookInstalled, ensureGitbookReady, getGitbookBin, installGitbook } from './gitbook';
import { getDefaultPort, killExistingServers } from './server';
import { Builder } from './builder';
import { watchAndServe } from './watch';
import { runWithNodeVersion, setupNodeVersion } from './node-version';
import { REQUIRED_GITBOOK_VERSION, SERVE_PATH_PREFIX } from './constants';

export interface CommandOptions {
  port?: number;
  verbose?: boolean;
}

const getRoot = () => resolve(__dirname, '..', '..', '..');

export async function build(opts: CommandOptions = {}) {
  const verbose = opts.verbose ?? false;
  const { nvmPath } = await ensureGitbookReady();
  const root = getRoot();
  log.debug(`Project: ${root}`, verbose);
  await new Builder(root, nvmPath, verbose).build();
}

export async function serve(opts: CommandOptions = {}) {
  const port = opts.port ?? getDefaultPort();
  const verbose = opts.verbose ?? false;
  const root = getRoot();
  log.debug(`Serving on ${port} from ${root}`, verbose);
  const { nvmPath } = await ensureGitbookReady();
  killExistingServers(port);
  await watchAndServe({ port, projectRoot: root, nvmPath, verbose });
}

export function preview(opts: CommandOptions = {}) {
  const port = opts.port ?? getDefaultPort();
  const verbose = opts.verbose ?? false;
  const bookPath = resolve(getRoot(), '_book');
  log.debug(`Preview: ${bookPath} on ${port}`, verbose);

  if (!existsSync(bookPath)) {
    log.error('No _book directory. Run "npm run build" first.');
    process.exit(1);
  }

  killExistingServers(port);
  log.info(`Serving _book on port ${port}...`);
  log.info('Ctrl+C to stop');
  console.log('');

  const quiet = verbose ? '' : ' --no-request-logging 2>/dev/null';
  try {
    execSync(`${SERVE_PATH_PREFIX} npx --yes serve@14 "${bookPath}" -l ${port}${quiet}`, { stdio: 'inherit' });
  } catch {
    try {
      execSync(`python3 -m http.server ${port} --directory "${bookPath}"`, { stdio: 'inherit' });
    } catch {
      log.error('Could not start server. Install serve: npm install -g serve');
      process.exit(1);
    }
  }
}

export function stop(opts: CommandOptions = {}) {
  const port = opts.port ?? getDefaultPort();
  log.debug(`Stop port: ${port}`, opts.verbose);
  log.info('Stopping servers...');
  killExistingServers(port);
  log.success('Stopped');
}

export async function setup(opts: CommandOptions = {}) {
  const verbose = opts.verbose ?? false;
  const { nvmPath } = await setupNodeVersion();

  log.info('Checking gitbook-cli...');
  if (!checkGitbookInstalled()) {
    if (!await confirm('gitbook-cli not installed. Install now?')) {
      log.info('Run "npm run setup" when ready.');
      process.exit(0);
    }
    spin.start('Installing gitbook-cli...');
    if (!await installGitbook(nvmPath)) {
      spin.fail('Install failed');
      process.exit(1);
    }
    spin.succeed('gitbook-cli installed');
  } else {
    log.success('gitbook-cli installed');
  }

  const bin = getGitbookBin();
  log.debug(`Binary: ${bin}`, verbose);
  const quiet = verbose ? '' : ' 2>/dev/null';

  let installed = false;
  try {
    const out = runWithNodeVersion(`"${bin}" ls${quiet}`, nvmPath, { silent: true, verbose });
    log.debug(`ls: ${out}`, verbose);
    installed = out.includes(REQUIRED_GITBOOK_VERSION);
  } catch { /* assume not installed */ }

  if (installed) {
    log.success(`GitBook v${REQUIRED_GITBOOK_VERSION} installed`);
  } else {
    spin.start(`Fetching GitBook v${REQUIRED_GITBOOK_VERSION}...`);
    try {
      runWithNodeVersion(`"${bin}" fetch ${REQUIRED_GITBOOK_VERSION}${quiet}`, nvmPath, { silent: true, verbose });
      spin.succeed(`GitBook v${REQUIRED_GITBOOK_VERSION} installed`);
    } catch {
      spin.fail(`Failed to fetch GitBook v${REQUIRED_GITBOOK_VERSION}`);
      process.exit(1);
    }
  }

  console.log('');
  log.success('Setup complete! Run:');
  console.log('\n  npm run build   # Build docs\n  npm run dev     # Dev server\n');
}
