# R8-G1 Limited Internal Application Pack Manifest

## Status Boundary

```text
Mission:
SIMWAR-P6-R8G1-REL-040-LIMITED-INTERNAL-PACK

Current master anchor:
695cf955b3c9ab1d96b7fb59ac92671cf82dfdcf

Phase 5 Outcome:
L1_GATE_EXCEPTION_WITH_OWNER_AND_EXPIRY

Phase 6 Delivery State:
PHASE6_PACK_PR_CANDIDATE

G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY

Phase 7:
NOT_AUTHORIZED

R8-G1 Status:
LIMITED_INTERNAL_PACK_CANDIDATE_UNDER_G0_EXCEPTION

PostgreSQL runtime:
NOT_AUTHORIZED

Controlled Pilot:
NOT_AUTHORIZED

Production:
NOT_AUTHORIZED

Durable Settlement:
NOT_PROVEN
```

This manifest freezes one internal-only docs-and-tests pack. It does not release
R8-G1, complete Phase 6 closure, start Phase 7, authorize a real Teacher
rehearsal, or authorize Pilot, Production, PostgreSQL, SQL, migration, Replay
execution changes or settlement changes.

## G0 Exception

```text
Owner:
Marshall

Scope:
PHASE6_INTERNAL_PACK_PREPARATION_ONLY

Absolute expiry:
2026-07-21T23:59:59+08:00

Required postmerge action:
POSTMERGE_PHASE6_CLOSURE_REQUIRED
```

The exception expires earlier on master, required-check, branch-protection,
ruleset, workflow, package/lockfile, auth/tenant, Replay/settlement,
reset/cleanup, Known Limits, material open-PR, auto-merge, merge-queue or Owner
revocation change.

## Accepted Gate Boundary

```text
G0 = EXCEPTION
G1 = PASS
G2 = PASS
G3 = PASS
G4 = PASS
G5 = PASS_WITH_LIMITS
G6 = PASS_WITH_LIMITS
G7 = PASS
```

- G5 limitations: no dedicated Shadow Replay HTTP route; Replay is not backup,
  durable recovery or durable settlement proof.
- G6 limitations: synthetic in-memory reset only; no crash, cross-process,
  backup/restore, retention or production cleanup proof.

## Exact Pack Manifest

| Component                           | File                                                                   | Purpose                                                 | Evidence type                                | Explicit non-proof                                |
| ----------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------- |
| Teacher Kit and session preparation | `docs/operations/l1-teacher-kit-internal-only.md`                      | roles, preparation and Teacher flow                     | `PHASE6_LIMITED_PACK_EVIDENCE / DOCS_ONLY`   | not real Teacher rehearsal                        |
| Operator runbook                    | `docs/operations/l1-session-runbook-lite.md`                           | synthetic flow, stop controls and evidence preservation | `PHASE6_LIMITED_PACK_EVIDENCE / DOCS_ONLY`   | not operational execution proof                   |
| Abort, reset and cleanup            | `docs/operations/l1-synthetic-data-reset-and-abort.md`                 | bounded synthetic reset and cleanup checklist           | `ABORT_RESET_EVIDENCE / DOCS_ONLY`           | not durable recovery or production cleanup        |
| Replay review                       | `docs/operations/l1-replay-evidence-review-checklist.md`               | role-safe replay review and non-overwrite boundary      | `REPLAY_REVIEW_EVIDENCE / DOCS_ONLY`         | not backup or dedicated Shadow Replay route proof |
| Escalation and no-go                | `docs/operations/l1-issue-escalation-procedure.md`                     | severity, stop and Owner handoff                        | `ESCALATION_EVIDENCE / DOCS_ONLY`            | not Issue mutation or closeout                    |
| Evidence capture template           | `docs/operations/phase6-limited-internal-evidence-capture-template.md` | bounded synthetic evidence record                       | `PHASE6_CANDIDATE_EVIDENCE_PACK / DOCS_ONLY` | not an executed session record                    |
| Pack manifest                       | `docs/operations/r8-g1-internal-application-pack-index.md`             | source, scope, expiry and component freeze              | `PACK_MANIFEST_EVIDENCE / DOCS_ONLY`         | not release or merge evidence                     |
| Known Limits and exception notice   | `docs/quality/l1-known-limits-and-release-note.md`                     | accepted limits and internal release note               | `KNOWN_LIMITS_EVIDENCE / DOCS_ONLY`          | not external release readiness                    |
| Pack contract test                  | `tests/unit/phase6-limited-internal-pack-contract.test.ts`             | manifest, expiry and non-promotion contract             | `UNIT_TEST_EVIDENCE`                         | not operational correctness                       |
| Product alignment smoke             | `tests/integration/phase6-runbook-product-alignment.test.ts`           | align runbook with current read-only product boundaries | `INTEGRATION_TEST_EVIDENCE`                  | not internal validation execution                 |

All components are bound to source SHA
`695cf955b3c9ab1d96b7fb59ac92671cf82dfdcf` and the same exception expiry.

## Validation Profile

- `npm run format:check`
- `npm run check:hidden-unicode`
- `npm run lint`
- `npm run typecheck`
- `npm run test:contract`
- `npm run security:audit`
- `npm run check:direct-store-boundaries`
- full serial Vitest with `maxWorkers=1` and `testTimeout=15000`
- pack contract, product alignment, Known Limits, G6 abort/reset and G5 Replay
  non-overwrite tests
- `npm run build`
- `git diff --check`

Local validation does not equal future remote checks. Passing checks do not
equal merge, postmerge closure, G0 PASS, L1 READY or Phase 7 authorization.

## Independent Review Handoff

An exact-head independent review must confirm:

1. the base still descends from the fixed source anchor;
2. the diff contains only the exact docs-and-tests allowlist;
3. the exception is still active;
4. all required local and remote checks are attributable to the reviewed head;
5. no product, runtime, fixture, package, lockfile, workflow or authority change exists;
6. no component overclaims Phase 6 closure, Phase 7, Pilot, Production,
   PostgreSQL, durable recovery or durable settlement;
7. postmerge Phase 6 closure remains a separately authorized action.

## Issue Relationship

Relates to #111.

Relates to #114.

Relates to #115.

No Issue mutation or closeout is authorized.

## Non-Proofs

```text
G0 exception acceptance != G0 PASS
Phase 6 pack candidate != Phase 6 closure
Phase 6 pack candidate != Phase 7 authorization
Teacher Kit != completed Teacher rehearsal
Runbook != executed operational validation
Abort/reset checklist != crash or transaction recovery
Cleanup checklist != durable or production cleanup
Replay checklist != backup, recovery or durable settlement
Contract/alignment tests != operational correctness
PR creation != merge
Checks pass != postmerge Phase 6 closure
JSON runtime != PostgreSQL parity
```
