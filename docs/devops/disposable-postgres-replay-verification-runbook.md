# Disposable Postgres Replay Verification Runbook

## Purpose

This runbook explains how to run the explicit opt-in Postgres replay
verification harness that lives in
`scripts/postgres-replay-verification.test.ts`.

The harness verifies the replay persistence path against a real PostgreSQL 16
database without connecting Postgres to runtime and without changing the JSON
adapter default.

## Current Capability

The repository currently provides:

- `npm run test:postgres-replay`
- `scripts/postgres-replay-verification.test.ts`
- root `pg` dev dependency for this verification script only
- temporary schema isolation inside a user-supplied test database
- migration application from `db/migrations/0001_initial_repository_schema.sql`
- Postgres adapter replay save and read verification
- cleanup of the generated schema in `afterAll`

The harness does not:

- read `DATABASE_URL`
- fall back to production or shared runtime configuration
- connect Postgres through the repository provider
- make Postgres the default runtime
- execute settlement
- generate replay hashes
- call `buildReplayHash`

## Safety Boundary

Only this environment variable is allowed:

```text
SIMWAR_TEST_DATABASE_URL
```

Do not set or rely on:

```text
DATABASE_URL
```

The verification URL must point at a disposable test database. Do not use a
production, staging, shared, customer, or developer snapshot database.

Do not print:

- the full connection URL
- the database password
- connection options
- local `.env` content

When `SIMWAR_TEST_DATABASE_URL` is missing, the command must fail with:

```text
SIMWAR_TEST_DATABASE_URL is required for disposable Postgres verification
```

That failure is expected safety behavior.

## What The Harness Verifies

The current harness verifies:

- initial migration applies in a temporary schema
- `replay_records` table exists
- `append_sequence` exists as an identity column
- `record_type` rejects invalid values
- canonical `diff_report_id` exists
- old `replay_diff_report_id` column is absent
- `payload` is PostgreSQL `jsonb`
- four replay record types round-trip through the Postgres adapter:
  - `ReplayInputManifest`
  - `ReplayRun`
  - `ReplayReport`
  - `ReplayDiffReport`
- manifest explicit `source_result_id` matches payload
- report explicit `replay_run_id` matches payload
- report explicit `source_result_id` matches payload
- duplicate replay records are appended, not upserted
- internal row IDs differ for duplicate appends
- `append_sequence` increases
- replay reads return the first appended matching record
- tenant isolation is preserved
- hash fields are stored and returned unchanged
- replay persistence does not modify:
  - `decisions`
  - `simulation_rounds`
  - `settlement_results`

## Local Missing-Environment Check

Run this before a real database verification to confirm the safety boundary:

```powershell
Remove-Item Env:SIMWAR_TEST_DATABASE_URL -ErrorAction SilentlyContinue
npm run test:postgres-replay
```

Expected result:

- command fails
- error mentions `SIMWAR_TEST_DATABASE_URL`
- no connection URL is printed
- no password is printed
- no `DATABASE_URL` fallback occurs

Record this as:

```text
Missing-env safety check: passed
```

## Local PostgreSQL 16 Verification

Use a disposable local PostgreSQL 16 container. Do not reuse a running database
that may contain real or shared data.

Start a unique container:

```powershell
$containerName = "simwar-replay-verify-" + [guid]::NewGuid().ToString("N")
$testPassword = "[LOCAL_TEST_PASSWORD]"

docker run --rm -d `
  --name $containerName `
  -e POSTGRES_USER=simwar_test `
  -e POSTGRES_PASSWORD=$testPassword `
  -e POSTGRES_DB=simwar_test `
  -p 127.0.0.1::5432 `
  postgres:16
```

Wait for readiness with a bounded loop:

```powershell
$ready = $false

for ($attempt = 1; $attempt -le 30; $attempt++) {
  docker exec $containerName `
    pg_isready -U simwar_test -d simwar_test *> $null

  if ($LASTEXITCODE -eq 0) {
    $ready = $true
    break
  }

  Start-Sleep -Seconds 1
}

if (-not $ready) {
  throw "Disposable PostgreSQL container did not become ready"
}
```

Read the mapped host port:

```powershell
$portLine = (
  docker port $containerName 5432/tcp |
    Select-Object -First 1
).Trim()

if (-not $portLine) {
  throw "Could not determine disposable PostgreSQL host port"
}

$port = ($portLine -split ":")[-1]
```

Set the test URL only in the current PowerShell process. Do not echo it:

```powershell
$env:SIMWAR_TEST_DATABASE_URL =
  "postgresql://simwar_test:$testPassword@127.0.0.1:$port/simwar_test"
```

Run the verification:

```powershell
npm run test:postgres-replay
```

Clean up even when verification fails:

```powershell
Remove-Item Env:SIMWAR_TEST_DATABASE_URL -ErrorAction SilentlyContinue
docker rm -f $containerName
```

Confirm the container is gone:

```powershell
$remaining = docker ps -a `
  --filter "name=$containerName" `
  --format "{{.Names}}"

if ($remaining) {
  throw "Disposable PostgreSQL container cleanup failed"
}
```

## Harness Lifecycle

The script performs this lifecycle:

1. Validate `SIMWAR_TEST_DATABASE_URL`.
2. Connect with `pg`.
3. Generate a safe schema name with `randomUUID()`.
4. Create the temporary schema.
5. Apply the initial migration with `search_path` scoped to the schema.
6. Create a verification-only `PostgresQueryExecutor`.
7. Create the real Postgres repository adapter.
8. Run schema and replay persistence assertions.
9. Reset `search_path`.
10. Drop the generated schema with `CASCADE`.
11. Close the database client.

The generated schema name must match:

```text
simwar_replay_verify_[32 lowercase hex characters]
```

Do not allow user input to become a SQL identifier.

## CI Usage

The CI gate should run this harness only with a PostgreSQL 16 service and an
explicit `SIMWAR_TEST_DATABASE_URL` value.

CI must not:

- set ordinary `DATABASE_URL` for this check
- make Postgres the default repository runtime
- modify repository provider wiring
- print the full test URL
- persist database state between jobs

Recommended CI command:

```powershell
npm run test:postgres-replay
```

The CI job should run after dependency installation and before merge approval.
A failure should block the PR because the harness exercises real migration,
constraint, JSONB, append, first-match, tenant isolation, and truth-chain
boundaries.

## Expected Success Report

When verification passes, record these items as passed:

- migration apply
- temporary schema creation
- append sequence identity
- record type constraint
- diff report identity
- JSONB payload type
- manifest round-trip
- run round-trip
- report round-trip
- diff round-trip
- manifest explicit source result ID
- report explicit replay run ID
- report explicit source result ID
- duplicate append
- append sequence monotonicity
- first-match read behavior
- tenant isolation
- hash preservation
- decisions unchanged
- simulation rounds unchanged
- settlement results unchanged
- temporary schema cleanup
- container cleanup

## Troubleshooting

### Missing Environment Variable

Symptom:

```text
SIMWAR_TEST_DATABASE_URL is required for disposable Postgres verification
```

Action:

- Confirm this was the intended missing-env safety check, or
- Start a disposable PostgreSQL 16 container and set `SIMWAR_TEST_DATABASE_URL`
  only for the current process.

Do not fall back to `DATABASE_URL`.

### Container Did Not Become Ready

Actions:

- Check Docker is running.
- Remove the failed disposable container.
- Retry with a new container name.
- Do not replace the bounded readiness loop with an unbounded wait.

### Migration Failed

Actions:

- Stop and inspect the migration error.
- Do not edit the migration in a verification-only PR.
- Do not bypass the failing statement.
- Confirm the migration does not assume `public` schema state.

### JSONB Round-Trip Failed

Actions:

- Stop and inspect whether the adapter still sends payload through
  `JSON.stringify` and `::jsonb`.
- Do not weaken payload equality assertions.
- Do not switch to a JavaScript object parameter for JSONB.

### Explicit Column Mismatch

Actions:

- Stop and inspect the adapter write mapping.
- Manifest must write explicit `source_result_id`.
- Replay report must write explicit `replay_run_id` and `source_result_id`.
- Payload-only verification is not enough.

### Cleanup Failed

Actions:

- Confirm the schema name was generated by the harness.
- Drop only the generated schema after review.
- Remove only the disposable container created for this run.
- Do not drop the database.

## Red Lines

- No production database.
- No shared database.
- No ordinary `DATABASE_URL` fallback.
- No repository provider wiring.
- No Postgres default runtime switch.
- No settlement changes.
- No replay hash generation changes.
- No `buildReplayHash` calls.
- No truth-chain mutation.
- No weakening of harness assertions to get a green run.
