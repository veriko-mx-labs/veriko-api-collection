# Registro de cambios

Formato de [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); las versiones siguen [SemVer](https://semver.org/lang/es/).

## [No publicado]

### Agregado

- Una petición para cada una de las 75 operaciones de máquina a máquina de la API, en una carpeta por etiqueta: `validations`, `beneficiaries` (con `imports/`), `webhooks`, `finance` (con `cep-exports/`), `usage`, `insights`, `users`, `public`, `banxico-status`, `plans`, `billing` y `dashboard`.
- Variantes de `POST /v1/validate` y `POST /v1/validate-ocr`: en cola con `?async=1`, idempotente con `Idempotency-Key` e imagen enviada en base64.
- Sondeo que respeta `Retry-After` y `meta.next_poll_after_seconds`, envía `If-None-Match` y se detiene en cualquiera de los siete estados finales.
- Manejo de la respuesta `202` con `meta.async_reason: sync_deadline` en la validación síncrona.
- Todos los parámetros de consulta y las cabeceras de cada operación, desactivados cuando son opcionales.
- Etiquetas `consumes-quota` y `destructive`, con avisos en los docs de cada petición.
- Docs en cada petición, con su descripción y enlaces a docs.veriko.mx.
- Variables de entorno para los identificadores y tokens que guardan las peticiones, y `receipt_image_url` y `receipt_image_base64` para las peticiones de OCR.
- `samples/beneficiaries.csv` para la importación masiva y `.env.example` con `VERIKO_API_KEY`.
- `postman/production.postman_environment.json`, con `base_url`, un `api_key` secreto y las demás variables que defines tú.
- La exportación de Postman tiene carpetas anidadas, docs, pruebas y `auth: none` en las peticiones públicas.

### Cambiado

- El flujo guiado vive en `getting-started/` y el entorno en `environments/production.bru`; usa `--env production`.
- La clave de API sale de la variable de entorno `VERIKO_API_KEY`.

### Corregido

- La documentación y los mensajes vuelven a estar en español.
- La petición que crea un webhook espera `201 Created` y guarda `webhook_id` y `webhook_secret`.
- La prueba del webhook verifica `delivered`, porque `POST /v1/webhooks/{id}/test` responde `200` aunque el receptor falle.

## [1.0.0] - 2026-09-18

Primera versión: una colección de Bruno con el flujo típico de integración: validación por campos y por imagen, modo asíncrono con sondeo por ETag, descarga del CEP, historial, webhooks, catálogo de bancos y exportación a Postman.
