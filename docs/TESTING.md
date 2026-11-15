# Reproducible local validation

Use Node24.22 and PostgreSQL16. The integration harness only accepts a loopback PostgreSQL admin URL whose database is `postgres` or `template1`; it creates a random owned database and drops that exact database in finally. It never cleans the demo/application database.

```sh
npm ci
npm run build
npm test
TEST_PG_ADMIN_URL=postgresql://postgres@127.0.0.1:55464/postgres npm run test:integration
```

The wrapper generates isolated session/encryption secrets, chooses a free API port, migrates, starts an all-role server, waits for readiness, runs tests serially, terminates the server and verifies database cleanup. Logs are in `.data/validation-logs`. Browser tests require Google Chrome at `/usr/bin/google-chrome` and block outbound browser requests outside loopback. Every HTTP probe targets a local fixture. Standalone scheduler/socket/migration cases own additional disposable databases and child processes.

The user cancelled the 4,000-monitor capacity exercise on2026-11-14. The default suite omits the4,000 pagination fixture and bulk4,000 Bruno case. Existing bounded browser/permission/race/worker cases remain. Developers can explicitly run the historical scale regressions with `npm run test:integration -- --include-scale`; that is not part of this delivery's capacity acceptance.

A single test file can be passed to the wrapper, for example `npm run test:integration -- tests/maintenance.integration.test.ts`. For debugging against an already running local server, set DATABASE_URL/TEST_BASE_URL/APP_ENCRYPTION_KEY and run `node --import tsx --test --test-concurrency=1 tests/maintenance.integration.test.ts` directly.

Full Nuxt typecheck is currently nonzero; diagnostics have not all been classified against the original baseline. Release reports record the actual current count and changed-file classification; a successful production build is not described as a successful typecheck.
