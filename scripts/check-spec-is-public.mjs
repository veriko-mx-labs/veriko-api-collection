/**
 * `spec/openapi.yaml` es la copia del spec de https://docs.veriko.mx/openapi.yaml, y de ahí
 * se valida cada petición de la colección.
 *
 * Esta comprobación falla si la copia no cumple el contrato de esa API.
 */

import { readFileSync } from 'node:fs';

const SPEC = 'spec/openapi.yaml';

const fallos = [];

const spec = readFileSync(SPEC, 'utf8');
const rutas = spec.split('\n').filter((linea) => /^ {2}\/[a-z]/i.test(linea));
const rutasAdmin = rutas.filter((linea) => linea.trimStart().startsWith('/admin'));

if (rutasAdmin.length > 0) {
  fallos.push(`${SPEC} trae ${rutasAdmin.length} ruta(s) /admin. Es el bundle interno.`);
}
if (rutas.length === 0) {
  fallos.push(`${SPEC} no declara ninguna ruta.`);
}

for (const marca of ['x-visibility', 'x-permission', 'x-admin-notes']) {
  if (spec.includes(`${marca}:`)) {
    fallos.push(`${SPEC} conserva la extensión interna \`${marca}\`. Es el bundle sin sanear.`);
  }
}

if (fallos.length > 0) {
  console.error('El spec de este repositorio no es el público:\n');
  for (const fallo of fallos) console.error(`  · ${fallo}`);
  console.error('\nFuente correcta: https://docs.veriko.mx/openapi.yaml');
  process.exit(1);
}

console.log(`${SPEC}: ${rutas.length} rutas públicas.`);
