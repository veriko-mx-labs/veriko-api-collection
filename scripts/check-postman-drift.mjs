/**
 * Candado: `postman/postman_collection.json` está al día con las peticiones
 * `.bru`.
 *
 * Mismo patrón que `check-generated-types.mjs` de veriko-js: se
 * regenera en un temporal y se compara, así nadie edita el export a mano ni
 * se olvida de regenerarlo tras cambiar una petición.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PROJECT_ROOT } from './lib/spec.mjs';

const GENERATED = join(PROJECT_ROOT, 'postman', 'postman_collection.json');
const GENERATOR = join(PROJECT_ROOT, 'scripts', 'generate-postman.mjs');

const temp = mkdtempSync(join(tmpdir(), 'veriko-postman-'));
const candidato = join(temp, 'postman_collection.json');

try {
  execFileSync(process.execPath, [GENERATOR, '--out', candidato], { stdio: 'inherit' });

  const actual = readFileSync(GENERATED, 'utf8').replace(/\r\n/g, '\n');
  const esperado = readFileSync(candidato, 'utf8').replace(/\r\n/g, '\n');

  if (actual !== esperado) {
    console.error(`\n${GENERATED} no está al día con las peticiones de flujo-tipico/.`);
    console.error('Regenera con: npm run gen:postman');
    process.exit(1);
  }

  console.log(`${GENERATED} está al día con flujo-tipico/.`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
