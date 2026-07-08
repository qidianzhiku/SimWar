# L1 Internal Validation Rehearsal Gate

## Status Boundary

```text
G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY

PostgreSQL runtime:
NOT_AUTHORIZED

Durable Settlement:
NOT_PROVEN
```

```text
INTERNAL_ONLY_DRAFT
NOT_RELEASED
NOT_REAL_TEACHER_REHEARSAL
NOT_PILOT
NOT_PRODUCTION
```

This document records Program 030 evidence after PR #213 entered `master`. The
purpose is to turn the controlled HTTP runtime entrypoint guard into an internal
validation rehearsal gate package. It does not release R8-G1, it does not mark
L1 ready, and it does not authorize PostgreSQL, Pilot, Production or durable
settlement work.

## Current Evidence Scope

Program 030 relies on the following evidence classes:

| Evidence area         | Current evidence                                                                                                                           | Evidence label                       | Non-proof                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ | ---------------------------------------------------- |
| PR #213 formalization | ordinary merge to `master` after current required checks passed                                                                            | `CURRENT_GITHUB_READBACK`            | ordinary merge does not grant `G0 PASS`              |
| Post-merge baseline   | fresh detached clone validation on PR #213 merge commit                                                                                    | `POSTMERGE_MASTER_EVIDENCE`          | local validation is not remote CI for future commits |
| Runtime entrypoint    | `tests/integration/l1-controlled-runtime-entrypoint-binding.test.ts` and `tests/integration/l1-internal-validation-rehearsal-gate.test.ts` | `RUNTIME_ENTRYPOINT_EVIDENCE`        | HTTP guard is not real teacher rehearsal             |
| Graphify              | code-only graph extraction without semantic clustering                                                                                     | `GRAPHIFY_PREFLIGHT_EVIDENCE`        | graph relation is not runtime proof                  |
| CodeGraph             | targeted trace of `createApiServer -> routeRequest -> createPublicResultView` and route symbols                                            | `CODEGRAPH_EVIDENCE`                 | CodeGraph relation is not runtime proof              |
| Security              | no new runtime implementation diff in Program 030; npm critical audit gate remains pass                                                    | `SECURITY_PLUGIN_EVIDENCE / NOT_RUN` | absence of a new scan is not complete security proof |
| Docs MCP              | not required for source truth; fallback is local source, tests and GitHub readback                                                         | `DOCS_MCP_NOT_AVAILABLE_FALLBACK`    | docs fallback is not external official proof         |

## L1 Internal Validation Rehearsal Gate Matrix

| Gate                              | Capability                                                   | Current Evidence                                                                                | Evidence Type        | Freshness                | Owner    | Expiry                      | Severity | No-Go Condition                                                               | Current Status         | Non-Proof                                   | Required Follow-Up                             |
| --------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------- | ------------------------ | -------- | --------------------------- | -------- | ----------------------------------------------------------------------------- | ---------------------- | ------------------------------------------- | ---------------------------------------------- |
| G0 repository governance          | required checks, ordinary merge discipline, source integrity | PR #213 current readback, required checks pass, ordinary merge, post-merge master readback      | `REMOTE_CHECK`       | current at PR #213 merge | Marshall | next master change          | P0       | checks fail, scope drift, closeout wording, protected main workspace use      | `PASS_WITH_LIMITATION` | not `G0 PASS`                               | independent evidence review                    |
| G1 quality baseline               | local quality and build baseline                             | fresh detached post-merge validation and Program 030 validation                                 | `LOCAL_TEST`         | current clone            | Marshall | next master change          | P0       | format, lint, typecheck, test, e2e or build failure                           | `PASS`                 | local run is not future CI proof            | repeat on PR branch                            |
| G2 source integrity               | hidden Unicode and changed-file safety                       | hidden Unicode gate plus raw changed-file scan                                                  | `SOURCE_READ`        | current diff             | Marshall | next diff                   | P0       | hidden control, Bidi marker or diff allowlist drift                           | `PASS`                 | source scan is not runtime proof            | repeat before merge                            |
| G3 security / tenant / projection | tenant, team and Student redaction                           | truth-field denial, cross-team denial, cross-tenant denial and Student result redaction         | `RUNTIME_ENTRYPOINT` | current integration run  | Marshall | next runtime route change   | P0       | Student sees protected truth, private replay, other-team or other-tenant data | `PASS`                 | not complete security proof                 | independent security review if runtime changes |
| G4 runtime entrypoint             | controlled HTTP path through API dispatcher                  | course, team, run, round, decision, internal settle, publish, result and audit routes           | `RUNTIME_ENTRYPOINT` | current integration run  | Marshall | next API route change       | P0       | helper-only or direct-store primary path                                      | `PASS`                 | not `L1 READY`                              | independent evidence review                    |
| G5 teaching flow                  | Student decision and feedback runtime                        | redacted result, debrief prompts and Teacher evidence                                           | `RUNTIME_ENTRYPOINT` | current integration run  | Marshall | next result contract change | P1       | feedback leaks protected truth or claims formal grade                         | `PASS_WITH_LIMITATION` | not real teacher rehearsal                  | human rehearsal remains separate               |
| G6 replay / shadow replay         | replay evidence and non-overwrite                            | Teacher replay evidence is matched and non-writing; duplicate settlement reuses official result | `RUNTIME_ENTRYPOINT` | current integration run  | Marshall | next replay change          | P1       | replay or shadow replay overwrites official result                            | `PASS_WITH_LIMITATION` | no dedicated shadow replay HTTP route proof | R4/R8 follow-up                                |
| G7 operational readiness          | internal operator package                                    | internal draft and Go / No-Go checklist                                                         | `DOC`                | current docs             | Marshall | next rehearsal decision     | P1       | draft claims release, Pilot, Production or PostgreSQL readiness               | `PASS_WITH_LIMITATION` | internal draft is not released kit          | human owner review                             |
| R8-G1 internal-only rehearsal kit | rehearsal packaging                                          | internal-only runbook, known limits and evidence ledger                                         | `DOC`                | current docs             | Marshall | next owner decision         | P1       | kit used with real users or customers                                         | `PASS_WITH_LIMITATION` | not R8-G1 released                          | independent evidence review                    |

`UNKNOWN` is not counted as `PASS`. Local tests are not counted as remote checks.
Security scan evidence is not counted as `G0 PASS`.

## Remote CI / Current Checks Evidence Ledger

| Check Name                        | Provider                        | Commit SHA                                 | Conclusion | Started At             | Completed At           | Required By Branch Protection             | Evidence Source       | Local Equivalent Command                                                                 | Local Equivalent Result                 | Mismatch       | Blocking Status          | Required Action          |
| --------------------------------- | ------------------------------- | ------------------------------------------ | ---------- | ---------------------- | ---------------------- | ----------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------- | -------------- | ------------------------ | ------------------------ |
| quality                           | GitHub Actions CI               | `6a540f8cd9fa2a49f3f267c6cfb223342cd4853b` | `SUCCESS`  | `2026-07-08T06:34:21Z` | `2026-07-08T06:35:51Z` | yes                                       | PR #213 status rollup | `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` | pass on post-merge baseline             | none observed  | non-blocking after merge | repeat on Program 030 PR |
| browser-smoke                     | GitHub Actions CI               | `6a540f8cd9fa2a49f3f267c6cfb223342cd4853b` | `SUCCESS`  | `2026-07-08T06:34:20Z` | `2026-07-08T06:35:17Z` | yes                                       | PR #213 status rollup | `npm run test:e2e:ui`                                                                    | pass on post-merge baseline             | none observed  | non-blocking after merge | repeat on Program 030 PR |
| Analyze JavaScript and TypeScript | CodeQL                          | `6a540f8cd9fa2a49f3f267c6cfb223342cd4853b` | `SUCCESS`  | `2026-07-08T06:34:20Z` | `2026-07-08T06:35:37Z` | yes                                       | PR #213 status rollup | source integrity and security gates                                                      | pass with non-critical audit advisories | none observed  | non-blocking after merge | repeat on Program 030 PR |
| CodeQL                            | GitHub code scanning projection | `6a540f8cd9fa2a49f3f267c6cfb223342cd4853b` | `SUCCESS`  | `2026-07-08T06:35:28Z` | `2026-07-08T06:35:30Z` | observed but not listed as required check | PR #213 status rollup | no exact local equivalent                                                                | not applicable                          | not applicable | non-blocking after merge | no action                |

## Synthetic Internal Application Harness V6

`tests/integration/l1-internal-validation-rehearsal-gate.test.ts` is the
Program 030 V6 harness. It enters through `createApiServer` and real HTTP
routes, then builds the rehearsal gate matrix from observed runtime responses.

The harness covers:

- Teacher Course Draft Create
- Approved Scenario Asset Selection through current course defaults
- Approved ParameterSet / Plugin / Seed Binding through current run binding
- Course Publish and duplicate publish idempotency
- Synthetic Run Create
- Two-Team Setup
- Round Open
- Student Team A and Team B Decision Submit
- Duplicate Decision Submit Idempotency
- Teacher Round Lock and duplicate lock idempotency
- Existing Internal Settlement Trigger and duplicate settlement idempotency
- Teacher Result Publish and duplicate publish idempotency
- Student Redacted Result Read
- Student debrief prompt read as current redacted feedback evidence
- Teacher Evidence Read with matched replay evidence
- Tenant Admin Scoped Summary Read
- Platform Admin Explicit Authority Read
- Replay Evidence Read through the Teacher result route
- Official Result Non-Overwrite and repeated settlement non-overwrite
- Cross-Team Denial
- Cross-Tenant Denial
- Student unauthorized lock and bind denial
- Controlled truth-field failure without private detail leakage

The current runtime does not expose a separate shadow replay HTTP route. Shadow
Replay remains covered by earlier synthetic helper and browser evidence and is
recorded in this gate as `PASS_WITH_LIMITATION`, not as complete route proof.

## Go / No-Go Pack

```text
GO_FOR_INDEPENDENT_EVIDENCE_REVIEW_ONLY
```

No-Go conditions:

- required checks regress on the Program 030 PR;
- hidden Unicode, Bidi marker or source-integrity drift appears;
- Student sees `state_true`, other-team result data, other-tenant data, private
  replay evidence, `canonical_evidence_digest` or private replay markers;
- replay or shadow replay writes formal result;
- repeated settlement changes the official result id or replay hash;
- the internal draft is used as real teacher rehearsal, Pilot or Production.

## Known Limits

- No real teacher rehearsal.
- No Pilot or Production readiness.
- No PostgreSQL runtime, SQL, migration, RLS or transaction proof.
- No durable settlement or crash recovery proof.
- No dedicated shadow replay HTTP route proof.
- No release of R8-G1 internal kit.
- No Issue #111, #114 or #115 closeout.

## Validation

Program 030 validation must include:

```powershell
npm run format:check
npm run check:hidden-unicode
npm run lint
npm run typecheck
npm test -- tests/integration/l1-internal-validation-rehearsal-gate.test.ts
npm test -- tests/integration/p0-flow.test.ts tests/integration/m1-teaching-loop.test.ts tests/integration/decision-submit-characterization.test.ts tests/integration/m1-run-manifest-replay-evidence.test.ts tests/integration/r3-runtime-boundary.test.ts tests/integration/l1-runtime-boundary.test.ts tests/integration/l1-shared-golden-m1-scenario.test.ts tests/integration/l1-synthetic-internal-application-exercise.test.ts tests/integration/course-runtime-v3-synthetic-execution.test.ts tests/integration/l1-internal-application-readiness.test.ts tests/integration/l1-golden-m1-course-runtime-consolidation.test.ts tests/integration/l1-internal-validation-ready-package.test.ts tests/integration/l1-runtime-path-activation.test.ts tests/integration/l1-controlled-runtime-entrypoint-binding.test.ts tests/integration/l1-internal-validation-rehearsal-gate.test.ts
npm run test:e2e:ui
npm run test:contract
npm run security:audit
npm run check:direct-store-boundaries
npm test
npm run build
git diff --check
npm audit --json
```

`npm audit --json` may still report the existing non-critical advisories. This
package does not authorize dependency or lockfile mutation.

## Issue Relationship

Relates to #111. Relates to #114. Relates to #115.
