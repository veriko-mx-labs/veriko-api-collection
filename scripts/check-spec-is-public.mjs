/**
 * `spec/openapi.yaml` is the copy of https://docs.veriko.mx/openapi.yaml that
 * every request is validated against.
 *
 * This check fails when the copy is not the public contract: it has
 * administration routes, internal extensions or no routes at all.
 */

import { loadSpec } from './lib/spec.mjs';

const SPEC = 'spec/openapi.yaml';
const INTERNAL_EXTENSIONS = ['x-visibility', 'x-permission', 'x-admin-notes'];
const failures = [];

const spec = loadSpec();
const paths = Object.keys(spec.paths ?? {});
const adminPaths = paths.filter((path) => path.startsWith('/admin'));

if (adminPaths.length > 0)
  failures.push(`${SPEC} has ${adminPaths.length} /admin route(s). It is the internal bundle.`);
if (paths.length === 0) failures.push(`${SPEC} does not declare any route.`);

const found = new Set();
const visit = (node) => {
  if (Array.isArray(node)) return node.forEach(visit);
  if (!node || typeof node !== 'object') return;
  for (const key of Object.keys(node)) {
    if (INTERNAL_EXTENSIONS.includes(key)) found.add(key);
  }
  Object.values(node).forEach(visit);
};
visit(spec);
for (const extension of found)
  failures.push(
    `${SPEC} keeps the internal extension \`${extension}\`. It is the unsanitized bundle.`,
  );

if (failures.length > 0) {
  console.error('The spec in this repository is not the public one:\n');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error('\nCorrect source: https://docs.veriko.mx/openapi.yaml');
  process.exit(1);
}

console.log(`${SPEC}: ${paths.length} public routes.`);
