# Colección de peticiones para la API de Veriko

Colección de peticiones para probar la API de [Veriko](https://veriko.mx) contra el CEP de Banco
de México, antes de programar contra ella.

## Qué es el CEP

El **Comprobante Electrónico de Pago (CEP)** es el documento que expide el **Banco de México
(Banxico)** por cada transferencia que pasa por el SPEI, el sistema de pagos interbancarios
mexicano. Contiene el sello digital y la cadena original de la institución receptora, de modo que
acredita que una transferencia ocurrió y por qué importe.

El CEP no tiene efectos fiscales: no sustituye a una factura. Su consulta manual se hace en el
portal de Banxico, un comprobante a la vez.

## Qué resuelve la API

La API de Veriko consulta el CEP y devuelve un veredicto: `valid` cuando Banxico confirma la
transferencia, `not_found` cuando no hay CEP con esos datos, `cep_unavailable` cuando Banxico no
respondió a tiempo, `returned` cuando el pago se liquidó y la institución beneficiaria lo devolvió
después, y `error` ante un fallo interno. Con veredicto `valid`, el comprobante queda disponible en
XML y en PDF.

Cubre validación manual por campos y validación a partir de la imagen de un comprobante (OCR), en
modo síncrono o encolado, con webhooks para notificar el resultado en vez de sondear.

La referencia completa está en [docs.veriko.mx](https://docs.veriko.mx). Para integrar desde
código en vez de explorar la API a mano, están el [SDK de
Python](https://github.com/veriko-mx-labs/veriko-python) y el [SDK de
JavaScript](https://github.com/veriko-mx-labs/veriko-js).

## Alcance de la colección

Cubre sólo operaciones de máquina a máquina: las que aceptan la clave de API o son públicas sin
autenticación. Las que sólo aceptan la cookie de sesión son de la interfaz web y no entran aquí, en
ninguna versión — es el mismo criterio que aplican los dos SDK.

Se genera y valida contra el spec público de la API
([docs.veriko.mx/openapi.yaml](https://docs.veriko.mx/openapi.yaml)), nunca contra el spec interno:
`npm run validate` (ver [Cómo se prueba](#cómo-se-prueba)) falla si alguna petición se sale de esa
superficie.

## Cómo abrir la colección

Las peticiones son archivos [Bruno](https://www.usebruno.com/) en texto plano — no requieren cuenta
ni sincronización con la nube. Con la aplicación de escritorio: **Open Collection** y selecciona la
carpeta raíz de este repositorio. Con la CLI (`npm install -g @usebruno/cli`), las peticiones
también se pueden correr una a una:

```bash
bru run flujo-tipico/01-validar-por-campos.bru --env produccion
```

## Cómo rellenar el entorno

El entorno `produccion` (en `environments/produccion.bru`) trae dos variables con valor por
defecto y una en blanco:

| variable               | valor                                          |
| ----------------------- | ------------------------------------------------------------------------------ |
| `base_url`              | `https://api.veriko.mx/v1` — no hace falta cambiarlo                            |
| `api_key`               | en blanco a propósito. Se obtiene en el panel ([app.veriko.mx](https://app.veriko.mx)) y empieza con `veriko_` |
| `webhook_receiver_url`  | apunta a un receptor de prueba propio (por ejemplo, uno temporal de [webhook.site](https://webhook.site)) antes de correr las peticiones 7 a 9 |

`api_key` está declarada como variable secreta: Bruno la guarda sólo en tu máquina, nunca en este
repositorio. No hay, ni debe haber, ninguna clave real ni de prueba versionada aquí.

## El recorrido de las diez llamadas

Las peticiones de `flujo-tipico/` están numeradas en el orden en que tienen sentido para un
integrador nuevo, y las que dependen de una anterior reutilizan lo que ésta devolvió mediante
variables de la colección. Son diez llamadas del flujo típico en once archivos: la última agrupa
el catálogo de bancos y el estado de Banxico, dos peticiones sin cuerpo que se leen juntas.

1. **Validar por campos** — valida una transferencia manualmente y trae el veredicto en la misma
   respuesta.
2. **Validar desde la imagen del comprobante** — el mismo veredicto, extrayendo los datos por OCR
   de una imagen.
3. **Encolar una validación (modo asíncrono)** — con `?async=1`, la respuesta es inmediata (202) y
   trae sólo el identificador; guarda `queued_validation_id` para las dos peticiones siguientes.
4. **Consultar el veredicto** — sondea `queued_validation_id` enviando en `If-None-Match` el `ETag`
   de la última respuesta. Ejecútala dos veces seguidas: la segunda, si el estado no avanzó,
   responde 304 sin cuerpo.
5. **Descargar el CEP** — el comprobante oficial de esa misma validación, una vez que su veredicto
   es `valid`.
6. **Listar el historial** — con filtros de estado y de fecha; no depende de las anteriores.
7. **Registrar un endpoint de webhook** — da de alta `webhook_receiver_url` y guarda
   `webhook_id` para las dos peticiones siguientes.
8. **Enviar un evento de prueba** — una entrega sintética a ese endpoint, para confirmar que
   responde antes de dirigirle tráfico real.
9. **Consultar el historial de entregas** — los intentos de ese endpoint, incluida la entrega de
   prueba anterior.
10. **Catálogo de bancos SPEI y estado del servicio de Banxico** — el catálogo es el único recurso
    público de la colección (no requiere clave de API); el estado del servicio es útil antes de
    una corrida de validaciones síncronas.

## La misma colección en Postman

`postman/postman_collection.json` es una Collection v2.1 generada desde las peticiones de
`flujo-tipico/` — mismas rutas, mismos cuerpos, y las tres variables que encadenan una petición con
la siguiente traducidas a un test script equivalente. Se importa directamente en Postman; la
variable de entorno se define ahí igual que en `environments/produccion.bru`.

No se edita a mano: sale de `npm run gen:postman`, y `npm run check:postman-fresh` falla en CI si
el archivo versionado no coincide con lo que el generador produce hoy.

## Cómo se prueba

```bash
npm install
npm test
```

Corre tres candados, ninguno hace una petición real:

- `check:spec-public` — `spec/openapi.yaml` (una copia del spec público) no es el bundle interno.
- `validate` — cada petición de `flujo-tipico/` existe en ese spec, con sus parámetros, cabeceras y
  campos del cuerpo declarados, y es de máquina a máquina.
- `check:postman-fresh` — el candado de deriva descrito arriba.

`npm run format:check` corre aparte, en el mismo CI: prettier para JSON, JavaScript y Markdown, y un
formateador propio para los archivos `.bru` (que prettier no entiende). Ambos se corrigen con
`npm run format`.
