/**
 * Loads the vendored public spec and exposes the checks the validators share:
 * locating the operation of a route, resolving its parameters and deciding
 * whether it is a machine-to-machine operation.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

export const PROJECT_ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const SPEC_PATH = new URL('../../spec/openapi.yaml', import.meta.url);
export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

export function loadSpec() {
  return parse(readFileSync(SPEC_PATH, 'utf8'));
}

/**
 * `true` when the operation is used machine to machine: it accepts the API key
 * or it is public and asks for no authentication.
 */
export function acceptsApiKey(operation, spec) {
  const schemes = operation.security ?? spec.security ?? [];
  return schemes.length === 0 || schemes.some((alternative) => 'ApiKeyAuth' in alternative);
}

/** `true` when the operation declares `security: []`, that is, it is public. */
export function isPublic(operation, spec) {
  return (operation.security ?? spec.security ?? []).length === 0;
}

function resolveRef(spec, ref) {
  return ref
    .replace(/^#\//, '')
    .split('/')
    .reduce((node, key) => node?.[key], spec);
}

export function resolveParameter(spec, parameter) {
  if (!parameter.$ref) return parameter;
  const resolved = resolveRef(spec, parameter.$ref);
  if (!resolved) throw new Error(`the spec does not declare ${parameter.$ref}`);
  return resolved;
}

export function resolveSchema(spec, schema) {
  if (!schema) return schema;
  if (schema.$ref) return resolveSchema(spec, resolveRef(spec, schema.$ref));
  return schema;
}

/** Property names a schema declares, following `allOf` and resolving `$ref`. */
export function schemaPropertyNames(spec, schema) {
  const resolved = resolveSchema(spec, schema);
  if (!resolved) return new Set();
  const names = new Set(Object.keys(resolved.properties ?? {}));
  for (const branch of resolved.allOf ?? []) {
    for (const name of schemaPropertyNames(spec, branch)) names.add(name);
  }
  return names;
}

/**
 * Required top-level fields of a body schema: `required` lists plus the
 * `anyOf` / `oneOf` groups, which are returned as alternatives to satisfy.
 */
export function bodyRequirements(spec, schema) {
  const required = new Set();
  const anyOf = [];
  const oneOf = [];
  const visit = (node) => {
    const resolved = resolveSchema(spec, node);
    if (!resolved) return;
    for (const name of resolved.required ?? []) required.add(name);
    if (resolved.anyOf)
      anyOf.push(resolved.anyOf.map((branch) => resolveSchema(spec, branch)?.required ?? []));
    if (resolved.oneOf)
      oneOf.push(resolved.oneOf.map((branch) => resolveSchema(spec, branch)?.required ?? []));
    for (const branch of resolved.allOf ?? []) visit(branch);
  };
  visit(schema);
  return { required, anyOf, oneOf };
}

/**
 * Finds the spec operation for a method and a concrete path, where `{param}`
 * matches any segment. Literal paths win over parameterized ones.
 */
export function locateOperation(spec, method, pathname) {
  const candidates = Object.entries(spec.paths)
    .filter(([template, item]) => {
      const pattern = new RegExp(`^${template.replace(/\{[^/]+\}/g, '[^/]+')}$`);
      return item[method] !== undefined && pattern.test(pathname);
    })
    .sort(([a], [b]) => Number(a.includes('{')) - Number(b.includes('{')));

  if (candidates.length === 0) return undefined;
  const [template, item] = candidates[0];
  return { template, operation: item[method] };
}

/** Declared parameters (path item plus operation), resolved. */
export function allParameters(spec, template, operation) {
  const shared = spec.paths[template]?.parameters ?? [];
  return [...shared, ...(operation.parameters ?? [])].map((parameter) =>
    resolveParameter(spec, parameter),
  );
}

/** Declared parameter names for one location (`query`, `header` or `path`). */
export function declaredParameters(spec, template, operation, where) {
  return allParameters(spec, template, operation)
    .filter((parameter) => parameter.in === where)
    .map((parameter) => parameter.name);
}

/** Every machine-to-machine operation, with its method, path template and tag. */
export function m2mOperations(spec) {
  const out = [];
  for (const [template, item] of Object.entries(spec.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = item[method];
      if (operation && acceptsApiKey(operation, spec)) {
        out.push({
          operationId: operation.operationId,
          method: method.toUpperCase(),
          template,
          tag: operation.tags?.[0],
          operation,
        });
      }
    }
  }
  return out;
}

/** Folder name for a spec tag: `Banxico Status` becomes `banxico-status`. */
export function folderForTag(tag) {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Every list under `x-terminal-values` in the spec. */
export function terminalValueLists(spec) {
  const lists = [];
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node['x-terminal-values'])) lists.push(node['x-terminal-values']);
    Object.values(node).forEach(visit);
  };
  visit(spec);
  return lists;
}
