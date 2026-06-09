# Postgres Adapter Disposable Database Verification

This document records the local disposable Postgres verification workflow for
repository migrations and Postgres adapter tests.

It is intentionally verification documentation only. It does not connect
Postgres to the SimWar runtime, change API handlers, change repository
migration behavior, or alter settlement / replay truth logic.

## Scope

Use this workflow to verify:

- SQL migrations can be applied to a disposable Postgres database.
- Postgres repository adapter tests run against a real database through
  `DATABASE_URL`.

This verification does not mean the API server uses Postgres at runtime.
Runtime wiring remains a separate change.

## Disposable Postgres

Use a local disposable container with a non-default host port so it does not
collide with an existing developer database:

```powershell
docker run --rm --name simwar-postgres-verify `
  -e POSTGRES_DB=simwar `
  -e POSTGRES_USER=simwar `
  -e POSTGRES_PASSWORD=<local-test-password> `
  -p 55432:5432 `
  postgres:16-alpine
```

In another terminal, point the verification commands at that database:

```powershell
$env:DATABASE_URL = "postgresql://simwar:<local-test-password>@localhost:55432/simwar"
```

The password above is an example placeholder for local testing. Do not commit
real credentials or local `.env` files.

## Migration Apply

Run the migration apply gate against the disposable database:

```powershell
npm run test:migration:apply
```

Expected behavior:

- The command reads `DATABASE_URL`.
- Migrations apply successfully to the disposable database.
- Re-running the gate remains stable for the same migration set.

## Postgres Adapter Tests

Run the Postgres adapter integration gate against the same disposable database:

```powershell
npm run test:postgres-adapter
```

Expected behavior:

- The command reads `DATABASE_URL`.
- Adapter tests use the disposable database only.
- Tests do not require API runtime Postgres wiring.

## Cleanup

Stop the disposable database container when verification is complete:

```powershell
docker stop simwar-postgres-verify
```

Because the container is started with `--rm` and without a named volume, its
database state is discarded after the container stops.

## Current Verification Result

Verification attempted on `origin/master` at commit `ca49fba`.

Commands that passed:

- `npm run security:audit`
- `npm run typecheck`
- `npm test`
- `npm run test:contract`
- `npm run build`

Commands that could not complete in this local run:

- `npm run format:check` reported existing repository formatting issues.
- `npm run test:migration:apply` could not run because the npm script is not
  present on this commit.
- `npm run test:postgres-adapter` could not run because the npm script is not
  present on this commit.

Additional repository findings on this commit:

- `db/migrations/` is not present.
- `services/api/src/postgres-repository-adapter.ts` is not present.
- `tests/integration/postgres-repository-adapter.test.ts` is not present.

Local environment finding:

- Docker CLI and Docker Compose were installed.
- Docker daemon was not running, so a disposable Postgres container could not
  be started in this local run.

Therefore this run did not verify real Postgres migrations or the Postgres
adapter against a live disposable database. The steps above are the expected
reproducible workflow once the migration scripts, adapter test scripts, and a
running Docker daemon are available.
