# W5 Formal Rebase V5.8 Governance Delta

Status: `CURRENT_MISSION_GOVERNANCE_DELTA`

This document is the new docs-only governance delta for the V5.8 mission. It
does not rewrite historical W5 Governance PR #404 and does not promote any
model family, runtime, or release environment beyond the evidence and limits
listed here.

## Mission identity and historical boundary

| Field                       | Value                                                  |
| --------------------------- | ------------------------------------------------------ |
| Mission ID                  | `SIMWAR-W5-FORMAL-REBASE-COMPLETION-V5.8-20260820`     |
| Mission lineage             | `SIMWAR-W5-FORMAL-REBASE-V5.8-20260820T155612Z`        |
| Mission start               | `2026-08-20T15:56:12Z`                                 |
| Start master                | `9c04ccba8d79d2d0c3d903c88468da2fc110dda1`             |
| Historical W5 Product PR    | #402, predecessor evidence only                        |
| Historical W5 Governance PR | #404, predecessor evidence only                        |
| Completion Product PR       | [#406](https://github.com/qidianzhiku/SimWar/pull/406) |
| Completion Product head     | `fb20e2006a59d012da3c48250265154501833da6`             |
| Completion Product merge    | `97dd4cb66d2f244df94a332b15fcb6b782ebb988`             |
| Product merge tree          | `6743a1416d5ccf0d405f5c0df1e64cf20b59ad64`             |

PR #406 was the single substantive Product PR for this mission. It passed the
required `quality`, `browser-smoke`, and `Analyze JavaScript and TypeScript`
checks, with CodeQL also passing. Three review threads were addressed in the
same PR and then resolved; no force push, admin bypass, or auto-merge was used.

## Gate receipts

The Product PR added executable evidence under
`docs/evidence/w5-formal-rebase/`. The final merge was independently re-run in
one fresh detached checkout. Redacted, durable copies of the fresh receipts
are committed with this Governance Delta:

- [fresh M-RB1 receipt](./w5-formal-rebase-v5.8-fresh-rb1.json)
- [fresh M-RB2 receipt](./w5-formal-rebase-v5.8-fresh-rb2.json)
- [fresh M-RB3 receipt](./w5-formal-rebase-v5.8-fresh-rb3.json)
- [fresh verification receipt](./w5-formal-rebase-v5.8-fresh-verification.json)

The original external evidence copies are also retained at:

- `C:\Temp\simwar-w5-formal-rebase-20260820T155612Z\fresh-detached\2026-08-20-w5-formal-rebase-rb1.json`
- `C:\Temp\simwar-w5-formal-rebase-20260820T155612Z\fresh-detached\2026-08-20-w5-formal-rebase-rb2.json`
- `C:\Temp\simwar-w5-formal-rebase-20260820T155612Z\fresh-detached\2026-08-20-w5-formal-rebase-rb3.json`
- `C:\Temp\simwar-w5-formal-rebase-20260820T155612Z\fresh-detached\05-fresh-detached-verification.json`

The fresh detached receipt is lineage-addressed, uses merge commit
`97dd4cb66d2f244df94a332b15fcb6b782ebb988`, tree
`6743a1416d5ccf0d405f5c0df1e64cf20b59ad64`, and records a clean worktree.

### M-RB1: authority census — `PASS_WITH_LIMITS`

- 12 named families are inventoried with artifact identity, source/symbol,
  invocation path, input/output schema and units, data references, evaluator,
  seed, environment, version/digest, producer, consumer, formal writer,
  visibility, fallback, limits, and reproduction command.
- `UNKNOWN_COUNT=0`.
- `UNOWNED_FEATURE_COUNT=0`.
- `DOUBLE_PRODUCER_COUNT=0`.
- Causal feature ownership has one primary producer per economic meaning.
- The only official realized producer remains the existing Simulation Core
  projection and it does not write formal settlement truth.

### M-RB2: executable reproduction — `PASS_WITH_LIMITS`

The fresh runner executed five records after mission start:

1. Golden: Core, synthetic WANT, CAN constraints, and REALIZED projection.
2. Differential: bounded monthly-price perturbation with changed replay
   identity and no unsupported plane activation.
3. Replay: exact ModelVersion/Scenario/Parameter/seed evaluated twice; the
   replay digests matched and `replay_writes_official_results=false`.
4. Zero-signal/fallback: unavailable BLP/RCNL candidate falls back to the
   deterministic Core path; no second runtime is created.
5. Drift: `CODE_DRIFT`, `DATA_DRIFT`, `ENVIRONMENT_ANOMALY`,
   `MEASUREMENT_MISMATCH`, and `EXPECTED_MODEL_DIFFERENCE` are recorded.

Every record carries the current mission lineage, exact HEAD/tree, command,
environment fingerprint, input/output digests, exit code, result, and a
timestamp at or after mission start.

### M-RB3: current model/data baseline — `PASS_WITH_LIMITS`

The frozen identity is:

```text
ModelVersion: eldercare_w5_governed_v1@1.0.0
Scenario:    r7a-shanghai-eldercare-core-scenario-v2
Parameter:   exact digest in rb3 receipt
seed:        20260726
```

The baseline has exact binding, deterministic non-overwriting replay, the
`PLANE_OFF -> DETERMINISTIC_CORE` fallback, and Standard/Advanced parity.

## Model-family disposition

| Family                  | Disposition | Product meaning                                                |
| ----------------------- | ----------- | -------------------------------------------------------------- |
| Core Realized           | `CURRENT`   | Existing Simulation Core projection; no formal-result write    |
| Capacity                | `CURRENT`   | Deterministic core operations metric                           |
| Workforce               | `CURRENT`   | Deterministic synthetic scenario constraint                    |
| Quality / Risk          | `CURRENT`   | Bounded synthetic core signal, not clinical validation         |
| Finance                 | `CURRENT`   | Scenario projection, not a production ledger writer            |
| Shanghai                | `CURRENT`   | Synthetic/assumption-labelled; not calibrated                  |
| Synthetic WANT          | `CURRENT`   | `SYNTHETIC_HEURISTIC`, official=false                          |
| System Dynamics         | `SHADOW`    | `SHADOW_ONLY`, cannot overwrite official output                |
| BLP / RCNL              | `MISSING`   | No executable artifact, dependency, invocation, or calibration |
| Huff / Spatial          | `MISSING`   | No executable spatial-choice artifact or invocation            |
| Ideal Point / Lancaster | `DEFERRED`  | No executable artifact, invocation, or calibration             |
| Marketing               | `RESEARCH`  | No independent current marketing response engine               |

The Teacher model-readiness projection explicitly displays these classifications
and invocation-proof flags. Unsupported families are not presented as
`BLP_ACTIVE`, `RCNL_ACTIVE`, `IDEAL_POINT_ACTIVE`, or `LANCASTER_ACTIVE`.

## Shanghai, WANT, fallback, and truth boundaries

- Shanghai data is `SYNTHETIC_ASSUMPTION_NOT_CALIBRATED`; no external calibration
  or real-data claim is made.
- WANT is a synthetic heuristic and remains non-official.
- CAN is an eligibility/constraint projection and remains non-official.
- REALIZED is sourced from Simulation Core only.
- System Dynamics is shadow-only.
- Replay is deterministic and non-overwriting.
- No second Truth, Settlement, EnterpriseState, Score, or Rank writer was
  introduced.
- JSON internal runtime authority remains active. General PostgreSQL/RLS and
  external provider activation were not performed.

## Fresh detached validation and explicit limits

Fresh detached focused W5/core tests (13/13), contract tests (26 files / 59
tests), typecheck, lint, full build, focused W5 browser test (1/1), hidden
Unicode, and direct-store boundary checks passed. The full detached `npm test`
run passed 216/219 test files and 1356/1359 tests. Three existing
environment/baseline failures remain explicitly classified rather than
relabeled as PASS:

- settlement/replay characterization: integration request failed with `fetch
failed / bad port`;
- direct-store baseline inventory: detached/non-symbolic HEAD assumption and
  timeout;
- Teacher stale-workspace-response characterization: existing test timeout.

The Postgres replay command was not run to completion because
`SIMWAR_TEST_DATABASE_URL` was absent; its 20 tests were skipped and the
harness reported the required environment variable. This mission does not
authorize PG/RLS setup or provider activation.

The repository security audit passed at its configured critical threshold but
reported 7 high dependency advisories. No dependency remediation was added to
this narrowly scoped governance delta.

## Human and release boundary

```text
HV-B machine readiness: READY
Human Model Validation B: NOT_PERFORMED
Pilot: NOT_AUTHORIZED
Production: NOT_AUTHORIZED
General PostgreSQL/RLS: NOT_AUTHORIZED
W6: NOT_STARTED
Automatic successor: FALSE
```

This delta records machine evidence and readiness for a future Human Model
Validation B decision. It is not a WCAG, human validation, Pilot, Production,
or release approval.
