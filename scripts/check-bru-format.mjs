/**
 * Formateador de `.bru`: prettier no entiende el formato, así que este
 * candado normaliza a mano lo que sí se puede exigir en cualquier archivo de
 * texto: saltos de línea LF, ausencia de espacios colgantes y un único salto
 * final. Falla si algún archivo se guardó distinto. `npm run format` con
 * `FIX=1` reescribe los archivos que fallan.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { REQUESTS_DIR } from './lib/bru.mjs';
import { PROJECT_ROOT } from './lib/spec.mjs';

const FIX = process.argv.includes('--fix');

const archivos = [
  join(PROJECT_ROOT, 'bruno.json'),
  join(PROJECT_ROOT, 'collection.bru'),
  join(PROJECT_ROOT, 'environments', 'produccion.bru'),
  ...readdirSync(REQUESTS_DIR).map((f) => join(REQUESTS_DIR, f)),
];

function normalizar(contenido) {
  return contenido
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((linea) => linea.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n*$/, '\n');
}

const fallos = [];

for (const ruta of archivos) {
  const original = readFileSync(ruta, 'utf8');
  const esperado = normalizar(original);
  if (original !== esperado) {
    if (FIX) {
      writeFileSync(ruta, esperado);
      console.log(`corregido: ${ruta}`);
    } else {
      fallos.push(ruta);
    }
  }
}

if (fallos.length > 0) {
  console.error(
    `${fallos.length} archivo(s) sin formatear (CRLF, espacios colgantes o falta el salto final):\n`,
  );
  for (const ruta of fallos) console.error(`  · ${ruta}`);
  console.error('\nCorrige con: node scripts/check-bru-format.mjs --fix');
  process.exit(1);
}

console.log(`${archivos.length} archivo(s) .bru con formato correcto.`);
