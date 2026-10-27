/**
 * Genera `postman/postman_collection.json` (Collection v2.1) a partir de las
 * peticiones `.bru` de `flujo-tipico/`. Se ejecuta a mano con
 * `npm run gen:postman`; `check-postman-drift.mjs` es la comprobación que exige
 * que el resultado no se edite después a mano.
 *
 * Las tres peticiones que encadenan un identificador (`bru.setVar` en el
 * post-response) se traducen a un test script de Postman equivalente. Son
 * sólo tres patrones fijos, no un traductor genérico de JavaScript.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { readAllRequests } from './lib/bru.mjs';
import { PROJECT_ROOT } from './lib/spec.mjs';

const outFlagIndex = process.argv.indexOf('--out');
const OUTPUT =
  outFlagIndex !== -1
    ? process.argv[outFlagIndex + 1]
    : join(PROJECT_ROOT, 'postman', 'postman_collection.json');

const POST_RESPONSE_SCRIPTS = {
  '03-encolar-validacion.bru': [
    'pm.collectionVariables.set("queued_validation_id", pm.response.json().data.id);',
  ],
  '04-consultar-veredicto.bru': [
    'const etag = pm.response.headers.get("ETag");',
    'if (etag) {',
    '  pm.collectionVariables.set("queued_validation_etag", etag);',
    '}',
  ],
  '07-registrar-webhook.bru': [
    'if (pm.response.code === 200) {',
    '  pm.collectionVariables.set("webhook_id", pm.response.json().data.id);',
    '}',
  ],
};

function urlObject(request) {
  const withoutBase = request.url.replace('{{base_url}}', '');
  const [pathPart] = withoutBase.split('?');
  const path = pathPart.split('/').filter(Boolean);

  return {
    raw: request.url,
    host: ['{{base_url}}'],
    path,
    query: request.query.map((param) => ({ key: param.name, value: String(param.value) })),
  };
}

function itemFor(request) {
  const item = {
    name: request.name,
    request: {
      method: request.method,
      header: request.headers.map((header) => ({ key: header.name, value: header.value })),
      url: urlObject(request),
    },
  };

  if (request.bodyRaw !== undefined) {
    item.request.body = {
      mode: 'raw',
      raw: request.bodyRaw,
      options: { raw: { language: 'json' } },
    };
  }

  const script = POST_RESPONSE_SCRIPTS[request.filename];
  if (script) {
    item.event = [
      {
        listen: 'test',
        script: { type: 'text/javascript', exec: script },
      },
    ];
  }

  return item;
}

const requests = readAllRequests();

const collection = {
  info: {
    name: 'Veriko — validación SPEI contra el CEP',
    description:
      'Las diez llamadas del flujo típico de integración con la API de Veriko, generadas desde la colección Bruno de este repositorio. Ver README.md.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{api_key}}', type: 'string' }],
  },
  item: [
    {
      name: 'Flujo típico',
      item: requests.map(itemFor),
    },
  ],
  variable: [
    { key: 'base_url', value: 'https://api.veriko.mx/v1' },
    { key: 'api_key', value: '' },
    {
      key: 'webhook_receiver_url',
      value: 'https://webhook.site/reemplaza-esto-con-tu-url-de-prueba',
    },
  ],
};

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(collection, null, 2)}\n`);
console.log(`Generado: ${OUTPUT} (${requests.length} peticiones)`);
