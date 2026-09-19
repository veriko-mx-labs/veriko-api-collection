/**
 * Enumera y normaliza las peticiones `.bru` de `flujo-tipico/` para que
 * `validate-requests.mjs` y `generate-postman.mjs` compartan la misma
 * lectura, en vez de cada uno parsear por su cuenta.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

import { bruToJsonV2 } from '@usebruno/lang';

import { PROJECT_ROOT } from './spec.mjs';

export const REQUESTS_DIR = join(PROJECT_ROOT, 'flujo-tipico');

/** Ruta con `{{base_url}}` y la cadena de consulta fuera, para localizarla en el spec. */
function pathnameOf(url) {
  const withoutBase = url.replace('{{base_url}}', '');
  const withoutQuery = withoutBase.split('?')[0];
  // Cualquier variable de Bruno en un segmento de ruta (p. ej. {{webhook_id}})
  // representa un identificador: no lleva '/', así que un token sin barras
  // basta para que case contra el comodín `{param}` del spec.
  return withoutQuery.replace(/\{\{[^}]+\}\}/g, 'x');
}

/** Lee y normaliza una petición `.bru`. Lanza si el cuerpo declarado no es JSON válido. */
export function readRequest(filename) {
  const raw = readFileSync(join(REQUESTS_DIR, filename), 'utf8');
  const json = bruToJsonV2(raw);

  const bodyRaw = json.body?.json;
  const bodyFields = bodyRaw !== undefined ? Object.keys(JSON.parse(bodyRaw)) : undefined;

  const query = (json.params ?? []).filter((param) => param.type === 'query' && param.enabled);
  const headers = (json.headers ?? []).filter((header) => header.enabled);

  return {
    filename,
    name: json.meta.name,
    seq: Number(json.meta.seq),
    method: json.http.method.toUpperCase(),
    url: json.http.url,
    pathname: pathnameOf(json.http.url),
    auth: json.http.auth,
    query,
    headers,
    queryParams: query.map((param) => param.name),
    headerNames: headers.map((header) => header.name),
    bodyRaw,
    bodyFields,
    raw,
    json,
  };
}

/** Todas las peticiones de `flujo-tipico/`, en orden de `seq`. */
export function readAllRequests() {
  return readdirSync(REQUESTS_DIR)
    .filter((filename) => extname(filename) === '.bru' && filename !== 'folder.bru')
    .map((filename) => readRequest(filename))
    .sort((a, b) => a.seq - b.seq);
}
