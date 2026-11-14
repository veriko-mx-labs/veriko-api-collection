/**
 * Check: the text of the repository is plain.
 *
 * It rejects em and en dashes in the
 * requests, docs, README, CHANGELOG, SECURITY, scripts and workflows.
 */

import { readFileSync } from 'node:fs';

import { PROJECT_ROOT } from './lib/spec.mjs';
import { collectionFiles } from './lib/bru.mjs';

const SCANNED = /\.(bru|json|md|mjs|yml|csv)$/;
const SKIPPED = /^(spec\/|node_modules\/|package-lock\.json|postman\/|scripts\/check-prose\.mjs)/;
const FORBIDDEN = [[/[—–]/, 'em or en dash']];
const failures = [];

for (const file of collectionFiles()) {
  if (!SCANNED.test(file) || SKIPPED.test(file)) continue;
  const lines = readFileSync(`${PROJECT_ROOT}${file}`, 'utf8').split('\n');
  lines.forEach((line, index) => {
    for (const [pattern, label] of FORBIDDEN) {
      if (pattern.test(line)) failures.push(`${file}:${index + 1}: ${label}`);
    }
  });
}

if (failures.length > 0) {
  console.error(`${failures.length} prose problem(s):\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('Prose check passed.');
