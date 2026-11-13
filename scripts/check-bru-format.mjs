/**
 * Formatter for `.bru` files and the other text files prettier does not read.
 * Prettier does not understand Bruno, so this script enforces what any text
 * file needs: LF line endings, no trailing whitespace and one final newline.
 *
 * It fails when a file differs. Run it with `--fix` to rewrite the files.
 */

import { readFileSync, writeFileSync } from 'node:fs';

import { PROJECT_ROOT } from './lib/spec.mjs';
import { collectionFiles } from './lib/bru.mjs';

const FIX = process.argv.includes('--fix');
const files = collectionFiles().filter((file) => /\.bru$/.test(file));

function normalize(content) {
  return content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n*$/, '\n');
}

const failures = [];

for (const file of files) {
  const path = `${PROJECT_ROOT}${file}`;
  const original = readFileSync(path, 'utf8');
  const expected = normalize(original);
  if (original !== expected) {
    if (FIX) {
      writeFileSync(path, expected);
      console.log(`fixed: ${file}`);
    } else failures.push(file);
  }
}

if (failures.length > 0) {
  console.error(
    `${failures.length} file(s) not formatted (CRLF, trailing whitespace or missing final newline):\n`,
  );
  for (const file of failures) console.error(`  - ${file}`);
  console.error('\nFix with: node scripts/check-bru-format.mjs --fix');
  process.exit(1);
}

console.log(`${files.length} .bru files formatted.`);
