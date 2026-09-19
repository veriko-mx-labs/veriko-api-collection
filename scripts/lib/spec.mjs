/**
 * Carga el spec público vendorizado y expone las mismas comprobaciones que
 * `operations.test.ts` de veriko-js: localizar la operación de una ruta,
 * resolver sus parámetros y decidir si es de máquina a máquina.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

export const PROJECT_ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const SPEC_PATH = new URL('../../spec/openapi.yaml', import.meta.url);

export function loadSpec() {
  return parse(readFileSync(SPEC_PATH, 'utf8'));
}

/**
 * `true` si la operación se usa de máquina a máquina: acepta la clave de API
 * o es pública y no pide autenticación. La que sólo acepta la cookie es de
 * la interfaz y no entra en la colección. Misma regla que `acceptsApiKey` en
 * `veriko-js/test/operations.test.ts`.
 */
export function acceptsApiKey(operation, spec) {
  const schemes = operation.security ?? spec.security ?? [];
  return schemes.length === 0 || schemes.some((alternative) => 'ApiKeyAuth' in alternative);
}

function resolveRef(spec, ref) {
  const name = ref.split('/').pop();
  if (ref.startsWith('#/components/parameters/')) return spec.components.parameters[name];
  if (ref.startsWith('#/components/schemas/')) return spec.components.schemas[name];
  return undefined;
}

export function resolveParameter(spec, parameter) {
  if (!parameter.$ref) return parameter;
  const resolved = resolveRef(spec, parameter.$ref);
  if (!resolved) throw new Error(`el spec no declara el parámetro ${parameter.$ref}`);
  return resolved;
}

export function resolveSchema(spec, schema) {
  if (!schema) return schema;
  if (schema.$ref) return resolveSchema(spec, resolveRef(spec, schema.$ref));
  return schema;
}

/** Nombres de propiedad declarados por un schema, siguiendo `allOf` y resolviendo `$ref`. */
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
 * Localiza la operación del spec para un método y una ruta concreta, donde
 * `{param}` en la ruta representa cualquier segmento. Las rutas literales
 * ganan sobre las que llevan parámetro, igual que en veriko-js.
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

/** Parámetros declarados (path item + operación) para una posición (`query` o `header`). */
export function declaredParameters(spec, template, operation, where) {
  const shared = spec.paths[template]?.parameters ?? [];
  return [...shared, ...(operation.parameters ?? [])]
    .map((parameter) => resolveParameter(spec, parameter))
    .filter((parameter) => parameter.in === where)
    .map((parameter) => parameter.name);
}
