/**
 * Generates `postman/postman_collection.json` (Collection v2.1) from the Bruno
 * tree: folders (nested), requests, docs, tests, scripts and auth. It also
 * writes `postman/production.postman_environment.json` next to it, with the
 * variables that the user provides. Run it with
 * `npm run gen:postman`; `check-postman-drift.mjs` fails when the committed
 * file differs from what this generator produces.
 *
 * Scripts are written in the subset of JavaScript that Bruno and Postman share
 * (`res.getStatus()`, `res.getHeader()`, `res.body`, `bru.setVar()`,
 * `bru.getVar()`, `bru.interpolate()`, `bru.sleep()`, `bru.runner.setNextRequest()`,
 * `test()` and `expect()`), so the translation is a set of mechanical
 * replacements. The generator fails when a translated script does not parse.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { readEnvironments, readTree } from './lib/bru.mjs';
import { PROJECT_ROOT } from './lib/spec.mjs';

const outFlagIndex = process.argv.indexOf('--out');
const OUTPUT =
  outFlagIndex !== -1
    ? process.argv[outFlagIndex + 1]
    : join(PROJECT_ROOT, 'postman', 'postman_collection.json');

const ENVIRONMENT_OUTPUT = join(dirname(OUTPUT), 'production.postman_environment.json');

// The variables that the user provides. The environment holds only these: a
// variable that a script saves with `pm.collectionVariables.set()` must not
// exist in the environment, because an environment value hides the collection
// value that the script sets.
const USER_VARIABLES = [
  'base_url',
  'api_key',
  'webhook_receiver_url',
  'receipt_image_url',
  'receipt_image_base64',
];
const SECRET_VARIABLES = new Set(['api_key']);

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const REPLACEMENTS = [
  [/bru\.runner\.setNextRequest\(/g, 'pm.execution.setNextRequest('],
  [/bru\.setVar\(/g, 'pm.collectionVariables.set('],
  [/bru\.getVar\(/g, 'pm.collectionVariables.get('],
  [/bru\.interpolate\(/g, 'pm.variables.replaceIn('],
  [/await bru\.sleep\(([^;]+)\);/g, 'await new Promise((resolve) => setTimeout(resolve, $1));'],
  [/res\.getStatus\(\)/g, 'pm.response.code'],
  [/res\.getHeader\(/g, 'pm.response.headers.get('],
  [/res\.body/g, 'pm.response.json()'],
  [/(?<![.\w])test\(/g, 'pm.test('],
  [/(?<![.\w])expect\(/g, 'pm.expect('],
];

function translate(source, where) {
  let out = source;
  for (const [pattern, replacement] of REPLACEMENTS) out = out.replace(pattern, replacement);
  if (/\b(bru|res)\./.test(out))
    throw new Error(`${where}: a Bruno-only call is left after translation`);
  try {
    new AsyncFunction('pm', out);
  } catch (error) {
    throw new Error(`${where}: the translated script does not parse (${error.message})`);
  }
  return out.split('\n');
}

function urlObject(request) {
  const [pathPart] = request.url.replace('{{base_url}}', '').split('?');
  return {
    raw: request.url,
    host: ['{{base_url}}'],
    path: pathPart.split('/').filter(Boolean),
    query: request.allQuery.map((param) => ({
      key: param.name,
      value: String(param.value),
      ...(param.enabled ? {} : { disabled: true }),
    })),
  };
}

function bodyObject(request) {
  if (request.bodyRaw !== undefined) {
    return { mode: 'raw', raw: request.bodyRaw, options: { raw: { language: 'json' } } };
  }
  if (request.multipart) {
    return {
      mode: 'formdata',
      formdata: request.multipart.map((field) =>
        field.type === 'file'
          ? { key: field.name, type: 'file', src: field.value[0] }
          : { key: field.name, value: field.value, type: 'text' },
      ),
    };
  }
  return undefined;
}

function itemFor(request) {
  const item = {
    name: request.name,
    request: {
      method: request.method,
      header: request.allHeaders.map((header) => ({
        key: header.name,
        value: header.value,
        ...(header.enabled ? {} : { disabled: true }),
      })),
      url: urlObject(request),
      description: request.docs,
    },
  };

  if (request.auth === 'none') item.request.auth = { type: 'noauth' };
  const body = bodyObject(request);
  if (body) item.request.body = body;

  const events = [];
  if (request.preRequest) {
    events.push({
      listen: 'prerequest',
      script: {
        type: 'text/javascript',
        exec: translate(request.preRequest, `${request.file} pre-request`),
      },
    });
  }
  const testSource = [request.postResponse, request.tests].filter(Boolean).join('\n');
  if (testSource) {
    events.push({
      listen: 'test',
      script: { type: 'text/javascript', exec: translate(testSource, `${request.file} tests`) },
    });
  }
  if (events.length > 0) item.event = events;
  return item;
}

function folderFor(node) {
  return {
    name: node.name,
    ...(node.docs ? { description: node.docs } : {}),
    item: [...node.folders.map(folderFor), ...node.requests.map(itemFor)],
  };
}

const tree = readTree();
const [environment] = readEnvironments();
const countRequests = (node) =>
  node.requests.length + node.folders.reduce((sum, child) => sum + countRequests(child), 0);

const variables = environment.variables.map((variable) => ({
  key: variable.name,
  value: variable.value.includes('{{process.env.') ? '' : variable.value,
}));

const collection = {
  info: {
    name: 'Veriko API: SPEI transfer verification against the Banxico CEP',
    description:
      'Requests for every public machine-to-machine operation of the Veriko API, generated from the Bruno collection in this repository. Import the `Veriko production` environment, set `api_key` and start with the Getting started folder. Requests that validate a transfer consume quota. See README.md.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{api_key}}', type: 'string' }],
  },
  item: [...tree.folders.map(folderFor), ...tree.requests.map(itemFor)],
  variable: variables,
};

const environmentValues = USER_VARIABLES.map((name) => {
  const variable = variables.find((candidate) => candidate.key === name);
  if (!variable) throw new Error(`environments/production.bru does not define \`${name}\``);
  return {
    key: name,
    value: SECRET_VARIABLES.has(name) ? '' : variable.value,
    type: SECRET_VARIABLES.has(name) ? 'secret' : 'default',
    enabled: true,
  };
});
const postmanEnvironment = {
  name: 'Veriko production',
  values: environmentValues,
  _postman_variable_scope: 'environment',
};

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(collection, null, 2)}\n`);
writeFileSync(ENVIRONMENT_OUTPUT, `${JSON.stringify(postmanEnvironment, null, 2)}\n`);
console.log(`Generated: ${OUTPUT} (${countRequests(tree)} requests) and ${ENVIRONMENT_OUTPUT}`);
