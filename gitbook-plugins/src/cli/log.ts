import ora, { Ora } from 'ora';
import pc from 'picocolors';
import * as readline from 'readline';

let spinner: Ora | null = null;

export const log = {
  info: (msg: string) => console.log(`${pc.blue('ℹ')} ${msg}`),
  success: (msg: string) => console.log(`${pc.green('✓')} ${msg}`),
  warn: (msg: string) => console.log(`${pc.yellow('⚠')} ${msg}`),
  error: (msg: string) => console.log(`${pc.red('✗')} ${msg}`),
  debug: (msg: string, verbose?: boolean) => verbose && console.log(`${pc.gray('DEBUG')} ${msg}`),
};

export const spin = {
  start: (msg: string) => {
    if (spinner) { spinner.text = msg; return spinner; }
    spinner = ora(msg).start();
    return spinner;
  },
  succeed: (msg?: string) => { spinner?.succeed(msg); spinner = null; },
  fail: (msg?: string) => { spinner?.fail(msg); spinner = null; },
};

export const confirm = (question: string): Promise<boolean> => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(`${pc.yellow('?')} ${question} (Y/n) `, (answer) => {
    rl.close();
    const a = answer.trim().toLowerCase();
    resolve(a === '' || a === 'y' || a === 'yes');
  });
});

export const printBanner = () => {
  console.log('');
  console.log(pc.cyan('========================================'));
  console.log(pc.cyan('  Filecoin Docs - GitBook Build Script'));
  console.log(pc.cyan('========================================'));
  console.log('');
};

export const printUsage = (defaultPort: number) => {
  console.log('Usage: gitbook-cli <command> [options]\n');
  console.log('Commands:');
  console.log(`  ${pc.green('setup')}    - Install Node 10 and gitbook-cli via nvm`);
  console.log(`  ${pc.green('build')}    - Build the gitbook (default)`);
  console.log(`  ${pc.green('serve')}    - Build and serve with live reload`);
  console.log(`  ${pc.green('preview')}  - Serve static _book (no rebuild)`);
  console.log(`  ${pc.green('stop')}     - Stop any running servers\n`);
  console.log('Options:');
  console.log(`  --port <n>   Port number (default: ${defaultPort})`);
  console.log('  --verbose    Show detailed output');
};
