import { mkdirSync, mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SCRATCH_ROOT = resolve(import.meta.dir, '..', '.agents', 'local', 'tmp');

/** A new scratch folder inside the repository's gitignored `.agents/local/tmp`, never the system temp folder. */
export const makeScratch = (opts: { prefix: string }): string => {
  mkdirSync(SCRATCH_ROOT, { recursive: true });
  return mkdtempSync(join(SCRATCH_ROOT, opts.prefix));
};
