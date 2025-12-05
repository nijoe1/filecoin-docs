#!/usr/bin/env node

import { build, preview, serve, setup, stop } from './commands';
import { printBanner, printUsage } from './log';
import { getDefaultPort } from './server';

const parseArgs = (args: string[]) => {
  let command = 'build', port: number | undefined, verbose = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--verbose' || a === '-v') verbose = true;
    else if (a === '--port' || a === '-p') port = parseInt(args[++i], 10);
    else if (!a.startsWith('-')) command = a;
  }
  return { command, port, verbose };
};

const main = async () => {
  const { command, port, verbose } = parseArgs(process.argv.slice(2));
  printBanner();
  const opts = { port, verbose };

  switch (command) {
    case 'setup': await setup(opts); break;
    case 'build': await build(opts); break;
    case 'serve': await serve(opts); break;
    case 'preview': preview(opts); break;
    case 'stop': stop(opts); break;
    default: printUsage(getDefaultPort()); process.exit(1);
  }
};

main().catch((e) => { console.error('Fatal:', e instanceof Error ? e.message : e); process.exit(1); });
