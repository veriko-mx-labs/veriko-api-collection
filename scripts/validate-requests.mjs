/**
 * Comprobación: cada petición de `flujo-tipico/` es real contra
 * `spec/openapi.yaml` (el spec público) y es de máquina a máquina.
 *
 * Por cada `.bru` comprueba que el método y la ruta existen en el spec, que
 * los parámetros de consulta y las cabeceras que envía están declarados,
 * que los campos del cuerpo existen en el schema de la operación y que la
 * operación acepta la clave de API. Ninguna petición sale a la red: esto es
 * análisis estático contra el archivo del spec, no una corrida.
 */

import {
  acceptsApiKey,
  declaredParameters,
  loadSpec,
  locateOperation,
  schemaPropertyNames,
} from './lib/spec.mjs';
import { readAllRequests } from './lib/bru.mjs';

const spec = loadSpec();
const requests = readAllRequests();
const fallos = [];

function fallar(request, mensaje) {
  fallos.push(`${request.filename}: ${mensaje}`);
}

for (const request of requests) {
  if (request.pathname.startsWith('/admin') || request.pathname.includes('/admin/')) {
    fallar(request, `la ruta ${request.pathname} es de administración; no entra en la colección`);
    continue;
  }

  const located = locateOperation(spec, request.method.toLowerCase(), request.pathname);
  if (!located) {
    fallar(request, `el spec público no declara ${request.method} ${request.pathname}`);
    continue;
  }
  const { template, operation } = located;

  if (!acceptsApiKey(operation, spec)) {
    fallar(request, `${operation.operationId ?? template} no acepta la clave de API`);
  }

  const declaredQuery = new Set(declaredParameters(spec, template, operation, 'query'));
  for (const name of request.queryParams) {
    if (!declaredQuery.has(name)) {
      fallar(request, `el parámetro de consulta \`${name}\` no está declarado para ${template}`);
    }
  }

  const declaredHeaders = new Set(
    declaredParameters(spec, template, operation, 'header').map((name) => name.toLowerCase()),
  );
  for (const name of request.headerNames) {
    if (!declaredHeaders.has(name.toLowerCase())) {
      fallar(request, `la cabecera \`${name}\` no está declarada para ${template}`);
    }
  }

  if (request.bodyFields) {
    const schema = operation.requestBody?.content?.['application/json']?.schema;
    if (!schema) {
      fallar(request, `${template} no declara un cuerpo JSON, y la petición envía uno`);
    } else {
      const declaredFields = schemaPropertyNames(spec, schema);
      for (const field of request.bodyFields) {
        if (!declaredFields.has(field)) {
          fallar(request, `el campo \`${field}\` del cuerpo no existe en el schema de ${template}`);
        }
      }
    }
  }
}

if (fallos.length > 0) {
  console.error(`${fallos.length} problema(s) contra el spec público:\n`);
  for (const fallo of fallos) console.error(`  · ${fallo}`);
  process.exit(1);
}

console.log(`${requests.length} peticiones verificadas contra spec/openapi.yaml: todas M2M.`);
