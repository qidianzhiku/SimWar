# Postgres Adapter Verification Prerequisites And Gaps

This document records the prerequisites, current gaps, and future workflow for
verifying SimWar repository migrations and a Postgres repository adapter against
a disposable local Postgres database.

This is documentation only. It does not mean Postgres is connected to runtime,
and it does not change API handlers, repository behavior, settlement logic,
replay hashing, or canonical decision selection.

## Current Status

The current repository does not yet have the required implementation and
automation pieces for real Postgres adapter verification.

Current gaps:

- `npm run test:migration:apply` is not available in current master.
- `npm run test:postgres-adapter` is not available in current master.
- `db/migrations/` is not available in current master.
- `services/api/src/postgres-repository-adapter.ts` is not available in current
  master.
- `tests/integration/postgres-repository-adapter.test.ts` is not available in
  current master.
- Disposable database verification cannot run when Docker CLI is installed but
  the Docker daemon is not running.

Because these pieces are missing, current master cannot claim real Postgres
migration or adapter verification.

## Future Disposable Postgres Workflow

Once migrations, adapter implementation, tests, and npm scripts exist, use a
local disposable Postgres database for verification.

Start a temporary Postgres container:

```powershell
docker run --rm --name simwar-postgres-verify `
  -e POSTGRES_DB=simwar `
  -e POSTGRES_USER=simwar `
  -e POSTGRES_PASSWORD=<local-test-password> `
  -p 55432:5432 `
  postgres:16-alpine
```

In another terminal, point verification commands at the disposable database:

```powershell
$env:DATABASE_URL = "postgresql://simwar:<local-test-password>@localhost:55432/simwar"
```

The password above is a placeholder for local testing. Do not commit real
passwords, real `DATABASE_URL` values, local `.env` files, or machine-specific
secrets.

Apply migrations:

```powershell
npm run test:migration:apply
```

Run Postgres adapter tests:

```powershell
npm run test:postgres-adapter
```

Clean up the disposable database:

```powershell
docker stop simwar-postgres-verify
```

The example container uses `--rm` and no named volume, so its database state is
discarded when the container exits.

## Recommended PR Order

Use small, reviewable changes to build toward real Postgres verification:

1. `docs: document Postgres adapter migration plan`
2. `api: add Postgres repository adapter skeleton`
3. `test: add Postgres adapter contract/parity tests`
4. `chore: add Postgres verification scripts`
5. `test: verify postgres adapter against disposable database`
6. Only later: wire Postgres adapter into runtime behind explicit configuration

## Red Lines

Postgres verification work must preserve these boundaries:

- Do not connect Postgres to runtime in a verification-only PR.
- Do not modify API handlers as part of documentation or verification setup.
- Do not modify settlement logic.
- Do not modify `replay_hash` behavior.
- Do not modify canonical decision selection.
- Do not commit real `DATABASE_URL` values or secrets.
- Do not treat a disposable database test as production readiness.
