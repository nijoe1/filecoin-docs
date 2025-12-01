import ora, { Ora } from 'ora';
import pc from 'picocolors';
import * as readline from 'readline';

let currentSpinner: Ora | null = null;

export const log = {
  info: (msg: string) => console.log(`${pc.blue('ℹ')} ${msg}`),
  success: (msg: string) => console.log(`${pc.green('✓')} ${msg}`),
  warn: (msg: string) => console.log(`${pc.yellow('⚠')} ${msg}`),
  error: (msg: string) => console.log(`${pc.red('✗')} ${msg}`),
};

export const spin = {
  start: (msg: string) => {
    if (currentSpinner) {
      currentSpinner.text = msg;
      return currentSpinner;
    }
    currentSpinner = ora(msg).start();
    return currentSpinner;
  },
  succeed: (msg?: string) => {
    if (currentSpinner) {
      currentSpinner.succeed(msg);
      currentSpinner = null;
    }
  },
  fail: (msg?: string) => {
    if (currentSpinner) {
      currentSpinner.fail(msg);
      currentSpinner = null;
    }
  },
  stop: () => {
    if (currentSpinner) {
      currentSpinner.stop();
      currentSpinner = null;
    }
  },
};

export async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${pc.yellow('?')} ${question} (Y/n) `, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === '' || normalized === 'y' || normalized === 'yes');
    });
  });
}

export function printBanner(): void {
  console.log('');
  console.log(pc.cyan('========================================'));
  console.log(pc.cyan('  Filecoin Docs - GitBook Build Script'));
  console.log(pc.cyan('========================================'));
  console.log('');
}

export function printUsage(defaultPort: number): void {
  console.log('Usage: gitbook-cli <command> [options]');
  console.log('');
  console.log('Commands:');
  console.log(`  ${pc.green('setup')}    - Install Node 10 and gitbook-cli via nvm`);
  console.log(`  ${pc.green('build')}    - Build the gitbook (default)`);
  console.log(`  ${pc.green('serve')}    - Build and serve with live reload`);
  console.log(`  ${pc.green('preview')}  - Serve static _book (no rebuild)`);
  console.log(`  ${pc.green('stop')}     - Stop any running servers`);
  console.log('');
  console.log('Options:');
  console.log(`  --port <n>   Port number (default: ${defaultPort})`);
  console.log('  --verbose    Show detailed output');
}
