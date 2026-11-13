# Changelog

Format of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [Unreleased]

### Added

- One request for each of the 75 machine-to-machine operations of the public spec, in a folder per spec tag: `validations`, `beneficiaries` (with `imports/`), `webhooks`, `finance` (with `cep-exports/`), `usage`, `insights`, `users`, `public`, `banxico-status`, `plans`, `billing` and `dashboard`.
- Variants for `POST /v1/validate` and `POST /v1/validate-ocr`: queued with `?async=1`, idempotent with `Idempotency-Key`, and image sent as base64.
- Step 04 of `getting-started`: `POST /v1/validate-ocr?async=1`.
- Polling that honors `Retry-After` and `meta.next_poll_after_seconds`, sends `If-None-Match`, and stops on any of the seven terminal states, including `invalid` and `failed`.
- Handling of the `202` response with `meta.async_reason: sync_deadline` on the synchronous validation requests.
- `Idempotency-Key`, `If-None-Match` and every query parameter of each operation, disabled when optional.
- Tags `consumes-quota` and `destructive`, with warnings in the docs of each request.
- A docs block on every request with its description and links to docs.veriko.mx.
- Environment variables for the ids and tokens that requests save, and `receipt_image_url` and `receipt_image_base64` for the OCR requests.
- `samples/beneficiaries.csv` for the bulk import request.
- `.env.example` with `VERIKO_API_KEY`.
- `postman/production.postman_environment.json`, with `base_url`, a secret `api_key` and the other variables that you set.
- Checks for spec coverage, prose and required fields, and a check that every asserted status exists in the spec.

### Changed

- Requests use the field names of the public contract.
- Requests, folders, docs and text are in English. The guided flow lives in `getting-started/` and the environment in `environments/production.bru`; use `--env production`.
- The API key comes from the `VERIKO_API_KEY` environment variable instead of a secret variable of the environment.
- The Postman export has nested folders, docs, tests, `auth: none` on public requests, every post-response script, and declares the variables that requests save.
- The validator checks required fields, path parameters, field names, asserted statuses and the auth mode of each request.

### Fixed

- `POST /v1/webhooks` expects `201 Created`. The request saves `webhook_id` and `webhook_secret`, so the following webhook requests resolve.
- The terminal states list includes `invalid` and `failed`.
- The webhook test asserts `delivered`, because `POST /v1/webhooks/{id}/test` responds `200` even when the receiver fails.

## [1.0.0] - 2026-09-18

First version: a Bruno collection with the typical integration flow: validation by fields and by image, asynchronous mode with ETag polling, CEP download, history, webhooks, bank catalog, Postman export, and drift checks against that export and the public spec.
