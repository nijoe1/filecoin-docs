#!/usr/bin/env node

import { build, preview, serve, setup, stop } from './commands';
import { printBanner, printUsage } from './log';
import { getDefaultPort } from './server';

function parseArgs(args: string[]): { command: string; port?: number; verbose: boolean } {
  let command = 'build';
  let port: number | undefined;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (arg === '--port' || arg === '-p') {
      port = parseInt(args[++i], 10);
    } else if (!arg.startsWith('-')) {
      command = arg;
    }
  }

  return { command, port, verbose };
}

async function main(): Promise<void> {
  const { command, port, verbose } = parseArgs(process.argv.slice(2));

  printBanner();

  const options = { port, verbose };

  try {
    switch (command) {
      case 'setup':
        await setup();
        break;
      case 'build':
        await build();
        break;
      case 'serve':
        await serve(options);
        break;
      case 'preview':
        preview(options);
        break;
      case 'stop':
        stop(options);
        break;
      default:
        printUsage(getDefaultPort());
        process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
