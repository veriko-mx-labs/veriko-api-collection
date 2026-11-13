# Contributing

Issues and pull requests are welcome.

## Report a bug or request a change

Open an issue with the [bug report](https://github.com/veriko-mx-labs/veriko-api-collection/issues/new?template=bug_report.yml) or [feature request](https://github.com/veriko-mx-labs/veriko-api-collection/issues/new?template=feature_request.yml) form. Search the open issues first.

A bug report needs the versions you use, the steps that reproduce it and, when the API answered with an error, its `request_id`. Remove API keys, receipts, account numbers and customer data from anything you paste.

Do not open a public issue for a security vulnerability. Follow [SECURITY.md](SECURITY.md).

## Propose a change

1. For anything larger than a fix, open an issue first so the change can be agreed before you write it.
2. Fork the repository and create a branch from `main`.
3. Make the change. Add or update the request, and keep `npm test` passing.
4. Run the checks of this repository:

   ```bash
   npm ci
   npm run format:check
   npm test
   ```

   `npm run format` fixes the formatting. `npm test` sends no request and does not need an API key. Use Node.js 18 or later.

5. Update README.md and CHANGELOG.md when the behavior that users see changes.
6. Open a pull request against `main` and fill in the template.

Write commit messages in English, in the imperative, and keep one change in each commit.

After you change a `.bru` file, run `npm run gen:postman` and commit the regenerated files in `postman/`. `npm run check:postman-fresh` fails when they differ from the `.bru` requests.

Keep the text of every request in English, and mark a request that consumes quota with the `consumes-quota` tag and one that changes data with the `destructive` tag.

## The API contract

The API contract is the public spec at <https://docs.veriko.mx/openapi.yaml>. `spec/openapi.yaml` is a copy that a scheduled workflow syncs. Do not edit it by hand. When the API behaves differently from the spec, open an issue.
