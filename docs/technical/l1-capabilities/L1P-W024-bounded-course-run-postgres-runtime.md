# L1P-W024 Bounded Course/Run PostgreSQL Runtime

**Status:** `CLOSED_AND_CURRENT_WITH_LIMITS`

**Product PR:** `#370`

**Product merge:** `a66c207bf23027d0245892879ec18b7920082113`

**Product candidate:** `eaa0842801e079b05d4eaf677ebe30a687164c08`

**Evidence root:** `C:/Temp/simwar-w024-postgres-durable-course-runtime-20260812T091327Z`

## Primary Outcome

W024 adds a bounded Course/Run PostgreSQL runtime cutover. JSON remains the
default runtime mode. Only an explicit `SIMWAR_REPOSITORY_MODE=postgres`
selection activates PostgreSQL, and Postgres mode fails closed when its
configuration or readiness is unavailable; it never silently falls back to
JSON.

The verified journey covers migration, Course/Run/round state, role workflow,
canonical decision, settlement, replay persistence, API restart before and
after settlement, exact retry reuse, conflicting retry fail-closed behavior,
tenant isolation and cleanup.

## Evidence

- Acceptance matrix: 149 rows, 0 unmapped.
- Post-merge disposable PostgreSQL journey: PASS.
- Default Vitest: 184 files / 1146 tests PASS.
- Contract: 19 files / 47 tests PASS.
- Browser: 80 passed / 9 skipped; role-workflow: 1 passed.
- Direct-store guard: new/stale/duplicate/broad = 0.
- Typecheck, lint, build and hidden-Unicode checks: PASS.
- Product PR checks: quality, browser-smoke, Analyze JavaScript and TypeScript,
  and CodeQL PASS.
- Independent review: BLOCKING=0 / MUST_FIX=0 / UNKNOWN=0.

## Authority and Limits

The bounded Postgres runtime is the sole persistence authority only for the
explicitly selected bounded Course/Run route. No dual active authority exists
within that route, and JSON is not a fallback in Postgres mode. This work does
not authorize RLS, general PostgreSQL application runtime, migration beyond
the bounded scope, Truth or formula changes, Student visibility widening,
Human Validation, Pilot, Production or W025.

Durable recovery beyond the verified restart journey remains unproven.
Security audit findings remain the inherited 2 low / 7 high non-critical
dependency baseline; no dependency change was made.

## Closure

W024 is closed after product merge, fresh detached post-merge validation,
Graph Companion readback and the single docs-only governance closure.
Resource locks are released after governance readback. `automatic_next_start`
remains `false`.
