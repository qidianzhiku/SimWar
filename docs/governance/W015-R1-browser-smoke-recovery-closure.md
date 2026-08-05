# W015 R1 Browser-Smoke Recovery Closure

## Status

- Mission: `SIMWAR-W015-R1-REQUIRED-BROWSER-SMOKE-DIAGNOSIS-AND-CLOSURE-RECOVERY-V1.0`
- Status: `COMPLETE_WITH_LIMITS`
- Browser classification: `TRANSIENT_ENVIRONMENT`
- Automatic successor: `false`
- Stabilization PR: `NONE`

## SHA Binding

| Fact | SHA or value |
| --- | --- |
| Reported baseline master | `e05052c85d5962af6e0ba83c551b280925d776c5` |
| PR #344 authorized head | `4cf8e4201c2c9e7200f246a411306b0cd7c03ee1` |
| PR #344 product merge | `f04e8c0a1ad8a0d8346c768440c006066c887ad8` |
| PR #345 governance merge/current master at closure preparation | `ed422914b0d6d5c8bf17d0629ce11de4b583b06c` |
| PR #344 changed-file manifest | `a37b399e3bc51912db542359696bd57827f5ce0d54927815ee32c950030e6d85` |

The delta after the product merge is governance-only. The five W015 product
files were not changed by the recovery diagnosis or by this closure record.

## Failure Fingerprint

The original required browser-smoke failure was in the unchanged
`tests/e2e-ui/student-smoke.spec.ts:147`, in the test
`lets the teacher browser publish the M1 JSON-runtime classroom result`.
The assertion waited for the literal `run created` and timed out after 10,000
milliseconds. Artifact-first trace inspection recorded successful login API
responses, no captured Create Run API request, and no deterministic causal path
through the five W015 files. Missing persistence and durable UI observations
remain `null`; they are not inferred.

## Bounded Rerun Ledger

| Run | Source | Result | Evidence |
| --- | --- | --- | --- |
| Original | PR #344 head, workflow `30977559871`, attempt 1 | Browser-smoke failed | Initial artifact/job `92214709181` |
| Head rerun | PR #344 head, workflow `30977559871`, attempt 2 | PASS | Browser job `92230887271`; one authorized rerun |
| Master control | `e05052c85d5962af6e0ba83c551b280925d776c5` | PASS | Reference run `30967114638` and one fresh local clone |

The rerun budget was `head=1/1`, `master-control=1/1`, total `2/2`. No third
rerun, retry-until-green loop, timeout increase, skip, quarantine, assertion
weakening, or product mutation was used.

## Post-Merge Evidence

The current-master fresh detached clone at
`ed422914b0d6d5c8bf17d0629ce11de4b583b06c` was clean and passed:

- default browser suite: 74 passed, 9 repository-defined skips, 0 failed;
- role-workflow suite: 1 passed, 0 failed;
- `student-smoke.spec.ts:147` Create Run flow: PASS;
- contract: 14 files / 37 tests;
- direct-store boundary: no new unapproved access;
- hidden Unicode, typecheck, lint, build, and `git diff --check`: PASS.

The product-merge fresh-clone receipt separately records W015 PostgreSQL
6/6, PostgreSQL replay 20/20, and the inherited full-Vitest Route-C baseline
limit. The full-suite anomaly remains explicitly classified as a baseline
environment/load limit, not as PASS and not as an R1 regression.

## Issue and Limits

- Issue #113 remains OPEN. One progress receipt was posted at
  `https://github.com/qidianzhiku/SimWar/issues/113#issuecomment-5189281693`.
- Issue #111 remains OPEN_KNOWN_LIMIT.
- Issue #118 remains OPEN_BLOCKED.
- `JSON_INTERNAL_ONLY` remains the active runtime authority.
- PostgreSQL runtime remains NOT_ACTIVE; RLS remains NOT_IMPLEMENTED.
- Human Validation, Pilot, Production, billing, external providers, durable
  recovery, and cross-process concurrency are not proven or authorized.

## Acceptance and Evidence

R1 frozen acceptance is `PASS=23`, `PASS_WITH_EXPLICIT_LIMIT=5`,
`FAIL=0`, `UNKNOWN=0`, `NOT_MAPPED=0`. The mission-owned evidence root is:

`C:/Users/Marshall/AppData/Local/Temp/E-SIMWAR-W015-R1-BROWSER-RECOVERY-20260805T152000Z`

Primary receipts:

- `diagnosis/03-failure-fingerprint.json`
- `reruns/04-head-rerun.json`
- `reruns/05-master-control.json`
- `postmerge/06-postmerge-receipt.json`
- `closure/07-acceptance-matrix.json`
- `closure/08-classification-decision.md`
- `closure/10-final-report.md`

Token telemetry was unavailable. Command durations, rerun counts, evidence
paths, and validation results were recorded without claiming platform token
totals.

## Non-Authorization

This closure does not authorize a successor mission, PostgreSQL activation,
RLS, Issue #111/#118 mutation, Pilot, Production, AI, billing, or any new
product change. The next mission remains `NOT_STARTED_PENDING_OWNER_DIRECTION`.
