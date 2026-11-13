/**
 * Check: every request of the collection is real against `spec/openapi.yaml`
 * (the public spec) and is machine to machine.
 *
 * Per `.bru` file it checks the method and path, the auth mode, query
 * parameters, headers, path parameters, the body (every field must exist in the
 * schema, and the required fields must be present), the asserted statuses, the docs block and the
 * destructive and quota markers. It does not send any request: this is static
 * analysis against the spec file.
 */

import {
  acceptsApiKey,
  allParameters,
  bodyRequirements,
  folderForTag,
  isPublic,
  loadSpec,
  locateOperation,
  resolveSchema,
  schemaPropertyNames,
  terminalValueLists,
} from './lib/spec.mjs';
import {
  assertedStatuses,
  readAllRequests,
  readEnvironments,
  savedVariables,
  usedVariables,
} from './lib/bru.mjs';

const spec = loadSpec();
const requests = readAllRequests();
const environmentVariables = new Set(
  readEnvironments().flatMap((env) => env.variables.map((v) => v.name)),
);
const failures = [];

const DESTRUCTIVE_OPERATIONS = new Set([
  'prepareValidationPurge',
  'executeValidationPurge',
  'regenerateWebhookSecret',
  'commitBeneficiaryImport',
  'cancelValidationRetries',
]);
const QUOTA_OPERATIONS = new Set(['validateDirect', 'validateOcr']);
const BUILT_IN_VARIABLES = /^(base_url|api_key|\$randomUUID|process\.env\..+)$/;

function fail(request, message) {
  failures.push(`${request.file}: ${message}`);
}

const terminalLists = terminalValueLists(spec).map((list) => [...list].sort().join(','));

for (const request of requests) {
  if (request.pathname.startsWith('/admin') || request.pathname.includes('/admin/')) {
    fail(
      request,
      `${request.pathname} is an administration route and does not belong in the collection`,
    );
    continue;
  }

  const located = locateOperation(spec, request.method.toLowerCase(), request.pathname);
  if (!located) {
    fail(request, `the public spec does not declare ${request.method} ${request.pathname}`);
    continue;
  }
  const { template, operation } = located;
  const parameters = allParameters(spec, template, operation);

  if (!acceptsApiKey(operation, spec))
    fail(request, `${operation.operationId ?? template} does not accept the API key`);

  const expectedAuth = isPublic(operation, spec) ? 'none' : 'inherit';
  if (request.auth !== expectedAuth)
    fail(request, `auth is \`${request.auth}\`, the spec requires \`${expectedAuth}\``);

  // Path parameters: the URL fills every segment of the template.
  const templateSegments = template.split('/').filter(Boolean);
  const urlSegments = request.pathname.split('/').filter(Boolean);
  if (templateSegments.length !== urlSegments.length)
    fail(request, `the URL does not fill every path parameter of ${template}`);
  if (/[{}:](?!\{)|\{[a-z_]+\}/.test(request.url.replace(/\{\{[^}]+\}\}/g, '').split('?')[0])) {
    fail(request, 'the URL path contains an unresolved parameter');
  }

  // Query parameters.
  const declaredQuery = parameters.filter((p) => p.in === 'query');
  const queryNames = new Set(request.allQuery.map((param) => param.name));
  for (const name of queryNames) {
    if (!declaredQuery.some((p) => p.name === name))
      fail(request, `query parameter \`${name}\` is not declared for ${template}`);
  }
  for (const p of declaredQuery) {
    const present = request.allQuery.find((param) => param.name === p.name);
    if (!present)
      fail(
        request,
        `query parameter \`${p.name}\` of ${template} is missing (add it disabled when optional)`,
      );
    else if (p.required && !present.enabled)
      fail(request, `required query parameter \`${p.name}\` is disabled`);
  }
  const urlQuery = (request.url.split('?')[1] ?? '')
    .split('&')
    .filter(Boolean)
    .map((pair) => pair.split('=')[0]);
  if ([...urlQuery].sort().join() !== [...request.queryParams].sort().join()) {
    fail(request, 'the query string of the URL does not match the enabled query parameters');
  }

  // Headers.
  const declaredHeaders = parameters.filter((p) => p.in === 'header');
  for (const header of request.allHeaders) {
    if (!declaredHeaders.some((p) => p.name.toLowerCase() === header.name.toLowerCase())) {
      fail(request, `header \`${header.name}\` is not declared for ${template}`);
    }
  }
  for (const p of declaredHeaders) {
    const present = request.allHeaders.find(
      (header) => header.name.toLowerCase() === p.name.toLowerCase(),
    );
    if (!present)
      fail(
        request,
        `header \`${p.name}\` of ${template} is missing (add it disabled when optional)`,
      );
    else if (p.required && !present.enabled)
      fail(request, `required header \`${p.name}\` is disabled`);
    else if (
      p.name === 'Idempotency-Key' &&
      present.enabled &&
      !/\{\{[^}]+\}\}/.test(present.value)
    ) {
      fail(request, 'Idempotency-Key must come from a variable such as `{{$randomUUID}}`');
    }
  }

  // Body.
  const body = operation.requestBody;
  const content = body?.content ?? {};
  if (body?.required && request.bodyMode === 'none') fail(request, `${template} requires a body`);
  if (request.bodyMode === 'json') {
    const schema = content['application/json']?.schema;
    if (!schema) fail(request, `${template} does not declare a JSON body`);
    else if (request.bodyJson && !Array.isArray(request.bodyJson)) {
      const declared = schemaPropertyNames(spec, schema);
      for (const field of request.bodyFields) {
        if (!declared.has(field))
          fail(request, `body field \`${field}\` does not exist in the schema of ${template}`);
      }
      const { required, anyOf, oneOf } = bodyRequirements(spec, schema);
      for (const field of required)
        if (!request.bodyFields.includes(field))
          fail(request, `required body field \`${field}\` is missing`);
      for (const group of anyOf) {
        if (!group.some((fields) => fields.every((f) => request.bodyFields.includes(f)))) {
          fail(request, `the body needs one of: ${group.map((g) => g.join('+')).join(' | ')}`);
        }
      }
      for (const group of oneOf) {
        const matched = group.filter((fields) =>
          fields.every((f) => request.bodyFields.includes(f)),
        );
        if (matched.length !== 1)
          fail(
            request,
            `the body needs exactly one of: ${group.map((g) => g.join('+')).join(' | ')}`,
          );
      }
    }
  } else if (request.bodyMode === 'multipartForm') {
    const schema = resolveSchema(spec, content['multipart/form-data']?.schema);
    if (!schema) fail(request, `${template} does not declare a multipart body`);
    else {
      const fields = (request.multipart ?? []).filter((f) => f.enabled).map((f) => f.name);
      const declared = schemaPropertyNames(spec, schema);
      for (const field of fields)
        if (!declared.has(field))
          fail(request, `form field \`${field}\` does not exist in the schema of ${template}`);
      for (const field of schema.required ?? [])
        if (!fields.includes(field)) fail(request, `required form field \`${field}\` is missing`);
    }
  } else if (request.bodyMode !== 'none') {
    fail(request, `unsupported body mode \`${request.bodyMode}\``);
  }

  // Tests: asserted statuses exist in the spec and include the success status.
  if (!request.tests) fail(request, 'no tests block');
  const statuses = assertedStatuses(request);
  const specStatuses = Object.keys(operation.responses ?? {}).map(Number);
  if (statuses.length === 0) fail(request, 'the tests do not assert an HTTP status');
  for (const status of statuses)
    if (!specStatuses.includes(status))
      fail(request, `asserts ${status}, which ${template} does not document`);
  if (statuses.length > 0 && !statuses.some((s) => s >= 200 && s < 300))
    fail(request, 'the tests do not assert a success status');

  // Docs.
  if (!request.docs.trim()) fail(request, 'no docs block');
  else if (!/https:\/\/docs\.veriko\.mx\/en\/\S+/.test(request.docs))
    fail(request, 'docs do not link to docs.veriko.mx/en');

  // Destructive and quota markers.
  const destructive =
    ['DELETE', 'PUT', 'PATCH'].includes(request.method) ||
    DESTRUCTIVE_OPERATIONS.has(operation.operationId);
  if (destructive) {
    if (!request.tags.includes('destructive'))
      fail(request, 'destructive request without the `destructive` tag');
    if (!/\(destructive\)/.test(request.name))
      fail(request, 'destructive request without "(destructive)" in its name');
    if (!/Destructive request\./.test(request.docs))
      fail(request, 'destructive request without a "Destructive request." warning in docs');
  } else if (request.tags.includes('destructive'))
    fail(request, 'tagged destructive but the operation only reads or creates');
  if (QUOTA_OPERATIONS.has(operation.operationId)) {
    if (!request.tags.includes('consumes-quota'))
      fail(request, 'quota-consuming request without the `consumes-quota` tag');
    if (!/Consumes quota\./.test(request.docs))
      fail(request, 'quota-consuming request without a "Consumes quota." note in docs');
  }

  // Variables.
  for (const name of usedVariables(request)) {
    if (!BUILT_IN_VARIABLES.test(name) && !environmentVariables.has(name))
      fail(request, `variable \`${name}\` is not declared in the environment`);
  }
  for (const name of savedVariables(request)) {
    if (!environmentVariables.has(name))
      fail(request, `\`bru.setVar\` writes \`${name}\`, which the environment does not declare`);
  }

  // Terminal states in polling scripts match the spec.
  const source = [request.preRequest, request.postResponse].filter(Boolean).join('\n');
  for (const match of source.matchAll(/const (TERMINAL\w*) = \[([^\]]*)\]/g)) {
    const values = [...match[2].matchAll(/"([^"]+)"/g)]
      .map((m) => m[1])
      .sort()
      .join(',');
    if (!terminalLists.includes(values))
      fail(request, `${match[1]} does not match any \`x-terminal-values\` list of the spec`);
  }

  // Folder placement.
  const [top] = request.folders;
  if (top !== 'getting-started' && top !== folderForTag(operation.tags?.[0] ?? '')) {
    fail(
      request,
      `lives in \`${top}/\`, but ${template} belongs to the \`${folderForTag(operation.tags?.[0] ?? '')}\` folder`,
    );
  }
}

// Names and sequence numbers are unique inside a folder.
const seen = new Map();
for (const request of requests) {
  const dir = request.folders.join('/');
  for (const [kind, value] of [
    ['name', request.name],
    ['seq', request.seq],
  ]) {
    const key = `${dir}|${kind}|${value}`;
    if (seen.has(key)) fail(request, `${kind} \`${value}\` is also used by ${seen.get(key)}`);
    else seen.set(key, request.file);
  }
}

if (failures.length > 0) {
  console.error(`${failures.length} problem(s) against the public spec:\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `${requests.length} requests verified against spec/openapi.yaml: all machine to machine.`,
);
