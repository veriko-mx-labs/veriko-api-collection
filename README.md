# Veriko API collection

Requests for the [Veriko](https://veriko.mx) API, which verifies SPEI transfers against the Banxico CEP. The collection covers all 75 operations that accept an API key or need no authentication. It is available as a [Bruno](https://www.usebruno.com/) collection and as a Postman export.

The full reference is at [docs.veriko.mx](https://docs.veriko.mx/en). To integrate from code, use the [Python SDK](https://github.com/veriko-mx-labs/veriko-python) or the [JavaScript SDK](https://github.com/veriko-mx-labs/veriko-js).

## What the CEP is

The Electronic Payment Receipt (CEP, from the Spanish _Comprobante Electronico de Pago_) is the document that Banco de Mexico (Banxico) issues for each transfer that goes through SPEI, the Mexican interbank payment system. It carries the digital seal and the original string of the receiving institution, so it proves that a transfer happened and for how much. It has no tax effect and does not replace an invoice.

The API queries the CEP and returns a verdict:

- `valid`: Banxico confirms the transfer.
- `not_found`: no CEP matches the data.
- `cep_unavailable`: Banxico did not answer in time.
- `invalid`: Banxico did not return a recognizable verdict.
- `returned`: the transfer settled and the receiving institution returned it later.
- `failed`: the validation stopped because of the data sent.
- `error`: the validation stopped because of a service failure.

`queued` and `processing` are not terminal. With a `valid` verdict, the CEP is available as XML and PDF.

## Setup

1. Get an API key from the [console](https://app.veriko.mx). It starts with `veriko_`.
2. Put it in the `VERIKO_API_KEY` environment variable, or in a `.env` file at the collection root. `.env.example` shows the format and `.env` is ignored by git.
3. Open the collection folder in Bruno with **Open Collection** and select the `production` environment.

The `production` environment in `environments/production.bru` defines these variables:

| Variable               | Value                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `base_url`             | `https://api.veriko.mx/v1`                                                                                       |
| `api_key`              | Reads `VERIKO_API_KEY`.                                                                                          |
| `webhook_receiver_url` | A public HTTPS receiver of your own, for example a temporary endpoint from [webhook.site](https://webhook.site). |
| `receipt_image_url`    | A receipt image or PDF served over HTTPS, for the OCR requests.                                                  |
| `receipt_image_base64` | The base64 of a receipt, for `validations/validate-ocr-image`.                                                   |

The other variables hold ids and tokens that the requests save for the next ones, such as `validation_id`, `webhook_id`, `webhook_secret` and `import_id`.

## Usage

The `getting-started` folder is a numbered flow. Run it from 01 to 13:

1. Validate by fields. A `202` response with `sync_deadline` hands the validation to step 05.
2. Validate by image.
3. Enqueue by fields with `?async=1`.
4. Enqueue by image with `POST /v1/validate-ocr?async=1`.
5. Poll the verdict until a terminal state. The script waits for `Retry-After` or `meta.next_poll_after_seconds`, sends the last `ETag` in `If-None-Match`, and repeats up to 30 times. Run this step with the runner.
6. Download the CEP.
7. List the validation history.
8. Register a webhook endpoint. It expects `201` and saves `webhook_id` and `webhook_secret`.
9. Test the webhook.
10. List the webhook deliveries.
11. List the SPEI banks.
12. Check the Banxico status.
13. Delete the webhook endpoint.

Run it with the Bruno CLI (`npm install -g @usebruno/cli`):

```bash
bru run getting-started --env production
```

Every other folder holds one request per operation, named after its spec tag:

| Folder            | Requests | Content                                                                        |
| ----------------- | -------- | ------------------------------------------------------------------------------ |
| `getting-started` | 13       | The guided flow above. It repeats operations from other folders.               |
| `validations`     | 21       | Validate, list, get, CEP, retries, purge, plus queued and idempotent variants. |
| `beneficiaries`   | 15       | Saved accounts. `imports/` holds the 8 bulk import requests.                   |
| `webhooks`        | 10       | Endpoints, secret rotation, test and deliveries.                               |
| `finance`         | 11       | Monthly reports. `cep-exports/` holds the 4 background CEP archive requests.   |
| `usage`           | 7        | Quota, limits and activity.                                                    |
| `insights`        | 4        | Metrics and trends.                                                            |
| `users`           | 3        | Profile and default retry policy.                                              |
| `public`          | 3        | Banks, BIN lookup and SPEI calendar. No API key.                               |
| `banxico-status`  | 2        | Service status and time series.                                                |
| `plans`           | 2        | Public plan catalog. No API key.                                               |
| `billing`         | 1        | Active subscription.                                                           |
| `dashboard`       | 1        | Account summary.                                                               |

Each request lists its query parameters in its docs. Optional parameters are disabled; enable the ones you need.

## Quota and destructive requests

`POST /v1/validate` and `POST /v1/validate-ocr` consume quota on every accepted request, with or without `?async=1`. A `not_found` is billed like a `valid`, and a receipt rejected with `422` is billed too. The API has no test host or test mode, and the example data returns `not_found`. These requests carry the `consumes-quota` tag and say so in their docs.

Requests that change or delete data carry the `destructive` tag, `(destructive)` in their name and a warning in their docs. They are every `DELETE`, `PUT` and `PATCH`, the purge steps, `POST /v1/webhooks/{id}/regenerate-secret`, `POST /v1/beneficiaries/imports/{id}/commit` and `POST /v1/validations/{id}/cancel-retries`. To run a folder without them:

```bash
bru run validations --env production --exclude-tags destructive
```

## Postman

`postman/postman_collection.json` is a Collection v2.1 generated from the Bruno files. It keeps the folders, docs, tests, `auth: none` on public requests and the scripts that save ids. `postman/production.postman_environment.json` is the matching environment.

1. Import both files in Postman.
2. Select the `Veriko production` environment and set `api_key`. It is a secret variable and starts empty.
3. Set `webhook_receiver_url`, `receipt_image_url` and `receipt_image_base64` before you run the webhook or OCR requests.

Variables live in two places:

| Scope               | Variables                                                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Environment         | `base_url`, `api_key`, `webhook_receiver_url`, `receipt_image_url` and `receipt_image_base64`. You set them.                                                                              |
| Collection variable | The ids, tokens and counters that the requests save, such as `validation_id` and `webhook_secret`. The environment does not define them: a value there would hide the one a script saves. |

The collection also carries the five variables of the environment with their defaults, so it runs without the environment.

Do not edit the two files by hand. `npm run gen:postman` regenerates them, and `npm run check:postman-fresh` fails when either differs.

## Tests

```bash
npm ci
npm test
```

No check sends a request. `npm test` runs:

- `check:spec-public`: `spec/openapi.yaml` is the public contract.
- `validate`: every request matches its operation in the spec: method, path, query parameters, headers, body fields, required fields, auth mode, asserted statuses and docs.
- `check:coverage`: the collection covers the 75 machine-to-machine operations of the spec.
- `check:prose`: the text is English.
- `check:postman-fresh`: the Postman collection and environment match the generator output.

`npm run format:check` runs prettier and the `.bru` formatter. `npm run format` fixes both.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) to report a problem or propose a change. Report vulnerabilities as described in [`SECURITY.md`](SECURITY.md).
