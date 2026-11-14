/**
 * Check: the collection covers exactly the machine-to-machine operations of
 * the spec. The set is derived from `spec/openapi.yaml`: the operations whose
 * security accepts `ApiKeyAuth` or is `[]`.
 *
 * Each operation needs a request in the folder of its tag. Requests in
 * `getting-started/` repeat operations on purpose and do not count.
 */

import { readFileSync } from 'node:fs';

import {
  PROJECT_ROOT,
  folderForTag,
  loadSpec,
  locateOperation,
  m2mOperations,
} from './lib/spec.mjs';
import { readAllRequests } from './lib/bru.mjs';

const spec = loadSpec();
const expected = m2mOperations(spec);
const requests = readAllRequests();
const failures = [];

const covered = new Map();
for (const request of requests) {
  if (request.folders[0] === 'getting-started') continue;
  const located = locateOperation(spec, request.method.toLowerCase(), request.pathname);
  if (!located) continue;
  const id = located.operation.operationId;
  covered.set(id, [...(covered.get(id) ?? []), request.file]);
}

for (const op of expected) {
  const files = covered.get(op.operationId) ?? [];
  const folder = folderForTag(op.tag);
  if (!files.some((file) => file.startsWith(`${folder}/`))) {
    failures.push(`${op.method} ${op.template} (${op.operationId}) has no request in ${folder}/`);
  }
}
const expectedIds = new Set(expected.map((op) => op.operationId));
for (const id of covered.keys())
  if (!expectedIds.has(id))
    failures.push(`${id} is not a machine-to-machine operation of the spec`);

const flowIds = new Set();
for (const request of requests.filter((r) => r.folders[0] === 'getting-started')) {
  const located = locateOperation(spec, request.method.toLowerCase(), request.pathname);
  if (located) flowIds.add(located.operation.operationId);
}

const readme = readFileSync(`${PROJECT_ROOT}README.md`, 'utf8');
if (!readme.includes(`${expected.length} operaciones`)) {
  failures.push(`README.md does not state "${expected.length} operaciones"`);
}

const perFolder = {};
for (const request of requests)
  perFolder[request.folders[0]] = (perFolder[request.folders[0]] ?? 0) + 1;

if (failures.length > 0) {
  console.error(`${failures.length} coverage problem(s):\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `Coverage: ${covered.size}/${expected.length} machine-to-machine operations (${requests.length} requests, ${flowIds.size} operations in getting-started).`,
);
console.log(
  Object.entries(perFolder)
    .map(([folder, n]) => `${folder}: ${n}`)
    .join(', '),
);
