import { execSync } from 'child_process';
import { join } from 'path';

// Version requirements
export const REQUIRED_NODE_VERSION = '10';
export const REQUIRED_GITBOOK_VERSION = '3.2.3';

// Server ports
export const DEFAULT_PORT = 4003;
export const LIVERELOAD_PORT = 35729;

// PATH prefix to use modern Node for serve (not nvm Node 10)
export const SERVE_PATH_PREFIX = 'PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"';

// Watch mode config
export const CONFIG = {
  DEBOUNCE_MS: 1000,
  MAX_FILES_TO_SHOW: 3,
} as const;

// Path helpers
export const getBookPath = (root: string): string => join(root, '_book');
export const getTempBookPath = (root: string): string => join(root, '_book_temp');

// Node 10 compatible rm -rf
export const rmRecursive = (path: string): void => {
  execSync(`rm -rf "${path}"`, { stdio: 'pipe' });
};
