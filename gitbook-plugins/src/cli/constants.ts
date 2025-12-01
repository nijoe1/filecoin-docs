import { join } from 'path';

export const REQUIRED_NODE_VERSION = '10';
export const DEFAULT_PORT = 4003;
export const LIVERELOAD_PORT = 35729;
export const BOOK_DIR_NAME = '_book';
export const TEMP_BOOK_DIR_NAME = '_book_temp';

export const CONFIG = {
  DEBOUNCE_MS: 1000,
  MAX_FILES_TO_SHOW: 3,
} as const;

export function getBookPath(projectRoot: string): string {
  return join(projectRoot, BOOK_DIR_NAME);
}

export function getTempBookPath(projectRoot: string): string {
  return join(projectRoot, TEMP_BOOK_DIR_NAME);
}

