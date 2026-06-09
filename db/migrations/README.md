# Postgres Migrations

This directory contains the initial repository schema skeleton for future
Postgres adapter work.

## Current Status

- `0001_initial_repository_schema.sql` defines conservative repository-backed
  tables for courses, simulation runs, rounds, decisions, settlement results,
  audit logs, state snapshots, and replay records.
- The schema keeps complex contract-shaped data in `jsonb` payload and metadata
  fields so future adapter work can preserve existing TypeScript object shapes.
- There is no migration runner in the current repository.
- There is no Postgres adapter runtime wiring.
- This schema does not mean production uses Postgres.

## Future Verification

Later PRs should add:

- a migration apply script such as `npm run test:migration:apply`;
- Postgres adapter parity or integration tests;
- `DATABASE_URL` documentation for local disposable database verification;
- disposable Postgres verification results in the devops verification docs.

Do not commit real `DATABASE_URL` values, local `.env` files, passwords,
tokens, or machine-specific secrets.
