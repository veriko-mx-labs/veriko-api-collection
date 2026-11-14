# Colección de la API de Veriko

Peticiones para la API de [Veriko](https://veriko.mx), que verifica transferencias SPEI contra el CEP de Banxico. La colección cubre las 75 operaciones que aceptan una clave de API o no piden autenticación. Está disponible como colección de [Bruno](https://www.usebruno.com/) y como exportación de Postman.

La referencia completa está en [docs.veriko.mx](https://docs.veriko.mx/es). Para integrar desde código, usa el [SDK de Python](https://github.com/veriko-mx-labs/veriko-python) o el [SDK de JavaScript](https://github.com/veriko-mx-labs/veriko-js).

## Qué es el CEP

El Comprobante Electrónico de Pago (CEP) es el documento que expide el Banco de México (Banxico) por cada transferencia que pasa por el SPEI, el sistema de pagos interbancarios de México. Lleva el sello digital y la cadena original de la institución receptora, así que acredita que una transferencia ocurrió y por qué monto. No tiene efectos fiscales ni sustituye a una factura.

La API consulta el CEP y devuelve un veredicto:

- `valid`: Banxico confirma la transferencia.
- `not_found`: ningún CEP coincide con los datos.
- `cep_unavailable`: Banxico no respondió a tiempo.
- `invalid`: Banxico no devolvió un veredicto reconocible.
- `returned`: la transferencia se liquidó y la institución receptora la devolvió después.
- `failed`: la validación se detuvo por los datos que enviaste.
- `error`: la validación se detuvo por una falla del servicio.

`queued` y `processing` no son estados finales. Con un veredicto `valid`, el CEP queda disponible en XML y en PDF.

## Preparación

1. Obtén una clave de API en el [panel](https://app.veriko.mx). Empieza con `veriko_`.
2. Ponla en la variable de entorno `VERIKO_API_KEY` o en un archivo `.env` en la raíz de la colección. `.env.example` muestra el formato y git ignora `.env`.
3. Abre la carpeta de la colección en Bruno con **Open Collection** y elige el entorno `production`.

El entorno `production`, en `environments/production.bru`, define estas variables:

| Variable               | Valor                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `base_url`             | `https://api.veriko.mx/v1`                                                                                |
| `api_key`              | Lee `VERIKO_API_KEY`.                                                                                     |
| `webhook_receiver_url` | Un receptor HTTPS público tuyo, por ejemplo un endpoint temporal de [webhook.site](https://webhook.site). |
| `receipt_image_url`    | La imagen o el PDF de un comprobante, servido por HTTPS, para las peticiones de OCR.                      |
| `receipt_image_base64` | El base64 de un comprobante, para `validations/validate-ocr-image`.                                       |

Las demás variables guardan identificadores y tokens que las peticiones conservan para las siguientes, como `validation_id`, `webhook_id`, `webhook_secret` e `import_id`.

## Uso

La carpeta `getting-started` (en Bruno aparece como «Flujo típico») es un flujo numerado. Córrelo del 01 al 13:

1. Validar por campos. Una respuesta `202` con `sync_deadline` pasa la validación al paso 05.
2. Validar por imagen.
3. Poner en cola por campos, con `?async=1`.
4. Poner en cola por imagen, con `POST /v1/validate-ocr?async=1`.
5. Sondear el veredicto hasta un estado final. El script espera `Retry-After` o `meta.next_poll_after_seconds`, envía el último `ETag` en `If-None-Match` y repite hasta 30 veces. Corre este paso con el ejecutor de colecciones.
6. Descargar el CEP.
7. Listar el historial de validaciones.
8. Registrar un endpoint de webhook. Espera `201` y guarda `webhook_id` y `webhook_secret`.
9. Probar el webhook.
10. Listar las entregas del webhook.
11. Listar los bancos SPEI.
12. Consultar el estado de Banxico.
13. Eliminar el endpoint de webhook.

Córrelo con la CLI de Bruno (`npm install -g @usebruno/cli`):

```bash
bru run getting-started --env production
```

Cada una de las otras carpetas trae una petición por operación y lleva el nombre de su etiqueta del spec:

| Carpeta           | Peticiones | Contenido                                                                                     |
| ----------------- | ---------- | --------------------------------------------------------------------------------------------- |
| `getting-started` | 13         | El flujo guiado de arriba. Repite operaciones de otras carpetas.                              |
| `validations`     | 21         | Validar, listar, consultar, CEP, reintentos, purga, y las variantes en cola e idempotentes.   |
| `beneficiaries`   | 15         | Cuentas guardadas. `imports/` trae las 8 peticiones de importación masiva.                    |
| `webhooks`        | 10         | Endpoints, rotación del secreto, prueba y entregas.                                           |
| `finance`         | 11         | Reportes mensuales. `cep-exports/` trae las 4 peticiones del archivo de CEP en segundo plano. |
| `usage`           | 7          | Cuota, límites y actividad.                                                                   |
| `insights`        | 4          | Métricas y tendencias.                                                                        |
| `users`           | 3          | Perfil y política de reintentos predeterminada.                                               |
| `public`          | 3          | Bancos, búsqueda de BIN y calendario SPEI. Sin clave de API.                                  |
| `banxico-status`  | 2          | Estado del servicio y serie de tiempo.                                                        |
| `plans`           | 2          | Catálogo público de planes. Sin clave de API.                                                 |
| `billing`         | 1          | Suscripción activa.                                                                           |
| `dashboard`       | 1          | Resumen de la cuenta.                                                                         |

Los docs de cada petición listan sus parámetros de consulta. Los opcionales vienen desactivados; activa los que necesites.

## Cuota y peticiones destructivas

`POST /v1/validate` y `POST /v1/validate-ocr` consumen cuota en cada petición aceptada, con `?async=1` o sin él. Un `not_found` se cobra igual que un `valid`, y un comprobante rechazado con `422` también se cobra. La API no tiene un servidor ni un modo de pruebas, y los datos de ejemplo devuelven `not_found`. Estas peticiones llevan la etiqueta `consumes-quota` y lo dicen en sus docs.

Las peticiones que modifican o borran datos llevan la etiqueta `destructive`, `(destructiva)` en su nombre y un aviso en sus docs. Son todos los `DELETE`, `PUT` y `PATCH`, los pasos de purga, `POST /v1/webhooks/{id}/regenerate-secret`, `POST /v1/beneficiaries/imports/{id}/commit` y `POST /v1/validations/{id}/cancel-retries`. Para correr una carpeta sin ellas:

```bash
bru run validations --env production --exclude-tags destructive
```

## Postman

`postman/postman_collection.json` es una Collection v2.1 generada a partir de los archivos de Bruno. Conserva las carpetas, los docs, las pruebas, `auth: none` en las peticiones públicas y los scripts que guardan identificadores. `postman/production.postman_environment.json` es el entorno que le corresponde.

1. Importa los dos archivos en Postman.
2. Elige el entorno `Veriko producción` y define `api_key`. Es una variable secreta y empieza vacía.
3. Define `webhook_receiver_url`, `receipt_image_url` y `receipt_image_base64` antes de correr las peticiones de webhooks o de OCR.

Las variables viven en dos lugares:

| Ámbito                | Variables                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entorno               | `base_url`, `api_key`, `webhook_receiver_url`, `receipt_image_url` y `receipt_image_base64`. Las defines tú.                                                                          |
| Variable de colección | Los identificadores, tokens y contadores que guardan las peticiones, como `validation_id` y `webhook_secret`. El entorno no las define: un valor ahí taparía el que guarda un script. |

La colección también trae las cinco variables del entorno con sus valores predeterminados, así que corre sin el entorno.

No edites los dos archivos a mano. `npm run gen:postman` los regenera y `npm run check:postman-fresh` falla cuando alguno difiere.

## Pruebas

```bash
npm ci
npm test
```

Ninguna comprobación envía peticiones. `npm test` corre:

- `check:spec-public`: `spec/openapi.yaml` es el contrato público.
- `validate`: cada petición coincide con su operación del spec: método, ruta, parámetros de consulta, cabeceras, campos del cuerpo, campos obligatorios, modo de autenticación, estados que se verifican y docs.
- `check:coverage`: la colección cubre las 75 operaciones de máquina a máquina del spec.
- `check:prose`: el texto es llano y no usa rayas largas.
- `check:postman-fresh`: la colección y el entorno de Postman coinciden con lo que produce el generador.

`npm run format:check` corre prettier y el formateador de `.bru`. `npm run format` corrige ambos.

## Contribuir

Consulta [`CONTRIBUTING.md`](CONTRIBUTING.md) para reportar un problema o proponer un cambio. Reporta las vulnerabilidades como indica [`SECURITY.md`](SECURITY.md).
