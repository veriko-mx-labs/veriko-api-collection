/**
 * Reads the Bruno collection tree so the validators and the Postman generator
 * share one view of it: folders (with `folder.bru`), requests and environments.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { bruToEnvJsonV2, bruToJsonV2, collectionBruToJson } from '@usebruno/lang';

import { PROJECT_ROOT } from './spec.mjs';

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.github',
  'spec',
  'scripts',
  'postman',
  'environments',
  'samples',
]);

/** Route with `{{base_url}}` and the query string removed, so it can be matched against the spec. */
function pathnameOf(url) {
  const withoutBase = url.replace('{{base_url}}', '');
  const withoutQuery = withoutBase.split('?')[0];
  // Any Bruno variable in a path segment stands for an identifier: a token
  // without slashes matches the `{param}` wildcard of the spec.
  return withoutQuery.replace(/\{\{[^}]+\}\}/g, 'x');
}

/** Reads and normalizes one `.bru` request. Throws if a declared JSON body is not valid JSON. */
export function readRequest(absolutePath) {
  const raw = readFileSync(absolutePath, 'utf8');
  const json = bruToJsonV2(raw);
  const file = relative(PROJECT_ROOT, absolutePath).split('\\').join('/');

  const bodyRaw = json.body?.json;
  const bodyJson = bodyRaw !== undefined ? JSON.parse(bodyRaw) : undefined;
  const multipart = json.body?.multipartForm;

  const allQuery = (json.params ?? []).filter((param) => param.type === 'query');
  const query = allQuery.filter((param) => param.enabled);
  const allHeaders = json.headers ?? [];
  const headers = allHeaders.filter((header) => header.enabled);
  const segments = file.split('/');

  return {
    file,
    folders: segments.slice(0, -1),
    name: json.meta.name,
    seq: Number(json.meta.seq),
    tags: json.meta.tags ?? [],
    method: json.http.method.toUpperCase(),
    url: json.http.url,
    pathname: pathnameOf(json.http.url),
    auth: json.http.auth,
    bodyMode: json.http.body,
    allQuery,
    query,
    allHeaders,
    headers,
    queryParams: query.map((param) => param.name),
    headerNames: headers.map((header) => header.name),
    bodyRaw,
    bodyJson,
    bodyFields: bodyJson && !Array.isArray(bodyJson) ? Object.keys(bodyJson) : undefined,
    multipart,
    preRequest: json.script?.req,
    postResponse: json.script?.res,
    tests: json.tests,
    docs: json.docs ?? '',
    raw,
    json,
  };
}

function bySeqThenName(a, b) {
  return a.seq - b.seq || a.name.localeCompare(b.name);
}

/** Folder tree: `{ name, seq, docs, dir, folders, requests }`, ordered by `seq`. */
export function readTree(absoluteDir = PROJECT_ROOT, isRoot = true) {
  const entries = readdirSync(absoluteDir);
  const requests = [];
  const folders = [];
  for (const entry of entries) {
    const full = join(absoluteDir, entry);
    if (statSync(full).isDirectory()) {
      if (isRoot && SKIP_DIRS.has(entry)) continue;
      if (entry.startsWith('.')) continue;
      folders.push(readTree(full, false));
    } else if (entry.endsWith('.bru') && entry !== 'folder.bru' && entry !== 'collection.bru') {
      requests.push(readRequest(full));
    }
  }
  let meta = { name: relative(PROJECT_ROOT, absoluteDir), seq: 0, docs: '' };
  if (!isRoot) {
    const folderBru = collectionBruToJson(readFileSync(join(absoluteDir, 'folder.bru'), 'utf8'));
    meta = {
      name: folderBru.meta.name,
      seq: Number(folderBru.meta.seq ?? 0),
      docs: folderBru.docs ?? '',
    };
  }
  requests.sort(bySeqThenName);
  folders.sort(bySeqThenName);
  return { ...meta, dir: relative(PROJECT_ROOT, absoluteDir), folders, requests };
}

/** Every request of the collection, depth first, in folder and `seq` order. */
export function readAllRequests() {
  const flat = [];
  const visit = (node) => {
    flat.push(...node.requests);
    node.folders.forEach(visit);
  };
  visit(readTree());
  return flat;
}

export function readEnvironments() {
  const dir = join(PROJECT_ROOT, 'environments');
  return readdirSync(dir)
    .filter((file) => file.endsWith('.bru'))
    .map((file) => ({
      file: `environments/${file}`,
      name: file.replace(/\.bru$/, ''),
      variables: bruToEnvJsonV2(readFileSync(join(dir, file), 'utf8')).variables,
    }));
}

/** Every file of the repository, as relative paths with forward slashes. */
export function collectionFiles() {
  const out = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === 'node_modules' || entry === '.git') continue;
        visit(full);
      } else out.push(full);
    }
  };
  visit(PROJECT_ROOT);
  return out.map((full) => relative(PROJECT_ROOT, full).split('\\').join('/'));
}

/** HTTP statuses a request asserts or branches on in its tests and scripts. */
export function assertedStatuses(request) {
  const source = [request.tests, request.postResponse].filter(Boolean).join('\n');
  const found = new Set();
  for (const match of source.matchAll(/getStatus\(\)\)?\s*(?:===?|!==?)\s*(\d{3})/g))
    found.add(Number(match[1]));
  for (const match of source.matchAll(/getStatus\(\)\)\.to\.equal\((\d{3})\)/g))
    found.add(Number(match[1]));
  for (const match of source.matchAll(
    /expect\(\[([\d,\s]+)\]\)\.to\.include\(res\.getStatus\(\)\)/g,
  )) {
    for (const code of match[1].split(',')) found.add(Number(code.trim()));
  }
  for (const match of source.matchAll(/\[([\d,\s]+)\]\.includes\(res\.getStatus\(\)\)/g)) {
    for (const code of match[1].split(',')) found.add(Number(code.trim()));
  }
  return [...found];
}

/** Variables a request writes with `bru.setVar`. */
export function savedVariables(request) {
  const source = [request.preRequest, request.postResponse].filter(Boolean).join('\n');
  return [...source.matchAll(/bru\.setVar\(\s*"([^"]+)"/g)].map((match) => match[1]);
}

/** Variables a request reads with `{{name}}` in its URL, headers, body and form fields. */
export function usedVariables(request) {
  const source = [
    request.url,
    request.bodyRaw ?? '',
    JSON.stringify(request.allHeaders),
    JSON.stringify(request.multipart ?? []),
  ].join('\n');
  return [...source.matchAll(/\{\{([^}]+)\}\}/g)].map((match) => match[1].trim());
}
