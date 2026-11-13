/**
 * Check: `postman/postman_collection.json` and
 * `postman/production.postman_environment.json` are up to date with the `.bru`
 * files.
 *
 * The generator runs into a temporary directory and the result is compared, so
 * the exports are never edited by hand and never go stale after a change.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PROJECT_ROOT } from './lib/spec.mjs';

const FILES = ['postman_collection.json', 'production.postman_environment.json'];
const GENERATOR = join(PROJECT_ROOT, 'scripts', 'generate-postman.mjs');

const temp = mkdtempSync(join(tmpdir(), 'veriko-postman-'));

try {
  execFileSync(process.execPath, [GENERATOR, '--out', join(temp, FILES[0])], { stdio: 'inherit' });

  const stale = FILES.filter((file) => {
    const actual = readFileSync(join(PROJECT_ROOT, 'postman', file), 'utf8').replace(/\r\n/g, '\n');
    const expected = readFileSync(join(temp, file), 'utf8').replace(/\r\n/g, '\n');
    return actual !== expected;
  });

  if (stale.length > 0) {
    for (const file of stale)
      console.error(`\npostman/${file} is not up to date with the .bru files.`);
    console.error('Regenerate them with: npm run gen:postman');
    process.exit(1);
  }

  console.log('The files in postman/ are up to date.');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
