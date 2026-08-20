# W4 Issue #398 Remediation Governance Delta

Status: `W4_REMEDIATION_COMPLETE_WITH_LIMITS`

This document is the bounded governance delta for the predecessor-integrity
remediation required by [Issue #398](https://github.com/qidianzhiku/SimWar/issues/398).
It supplements the historical W4 Product PR [#396](https://github.com/qidianzhiku/SimWar/pull/396)
and Governance PR [#397](https://github.com/qidianzhiku/SimWar/pull/397) without
rewriting either historical artifact. It records the exact remediation identity,
fresh detached evidence, and the remaining limits needed for the Issue #398
closure decision.

## Exact identities

| Item | Identity |
| --- | --- |
| Repository | `qidianzhiku/SimWar` |
| Issue | [#398](https://github.com/qidianzhiku/SimWar/issues/398) |
| Historical Product PR | [#396](https://github.com/qidianzhiku/SimWar/pull/396), immutable; merge `f6d147cbdbeac3c1294a49281f1b27a174ee9b3a` |
| Historical Governance PR | [#397](https://github.com/qidianzhiku/SimWar/pull/397), immutable; merge `1fcd8c7c8339d42b24e1500ecc658390cf89bd8f` |
| Remediation Product PR | [#399](https://github.com/qidianzhiku/SimWar/pull/399) |
| Remediation Product head | `db8d97ac92d34479b89751a2506bf9897f4fe1aa` |
| Remediation merge | `b95aaaf9b93a99261acc28780b5fbc4d92d8a79a` |
| Remediation base | `1fcd8c7c8339d42b24e1500ecc658390cf89bd8f` |
| Post-remediation master readback | `b95aaaf9b93a99261acc28780b5fbc4d92d8a79a` |

## 398-A — exact canonical W4 decision binding

The remediation makes the admitted W4 decision identity explicit and
replayable:

- `W4DecisionAdmission.decision_payload_digest` is the normalized digest of
  the W4 decision kind and payload.
- Formal `ROLE_WORKFLOW_REQUIRED` admission stores the ordinary canonical
  decision ID, merge commit ID, and team confirmation ID as an explicit link;
  the ordinary role-workflow payload is not incorrectly equated with the W4
  strategic payload.
- The W4 payload digest is carried into `W4Commitment`,
  `W4StrategicEffect`, and the official outcome replay manifest.
- Replay and shadow-replay evidence copies the official outcome's exact
  decision ID and payload-binding pair.
- Legacy JSON snapshots are normalized before the binding is enforced; an
  unknown historical decision reference remains blank and fails closed.

The negative evidence covers wrong admission digest, stale decision scope,
same decision ID with a different payload, mismatched manifest digest,
wrong decision ID, wrong round, replay-manifest mismatch, and noncanonical
admission. Historical official evidence was not rewritten.

## 398-B — route authorization matrix

The exact route matrix is enforced at the BFF/route boundary and recorded in
the W4 remediation control evidence:

| Dimension | Negative case | Result |
| --- | --- | --- |
| actor / tenant | token tenant and request tenant differ | `403 TENANT-403-001` |
| course | course does not own the Run | `409 W4_COURSE_SCOPE_CONFLICT` |
| run | unknown Run | `404 W4_RUN_NOT_FOUND` |
| round | unknown round, stale round, or round ID mismatched with path round | `409 W4_ROUND_SCOPE_CONFLICT` |
| team | learner requests another team | `409 W4_TEAM_SCOPE_CONFLICT` |
| role | student invokes teacher-only state creation | `403 D4_REPORT_SCOPE_VIOLATION` |
| activity | caller-supplied activity is ignored | fixed server activity `w4-enterprise-state-strategic-evolution`; caller activity is not authoritative |
| state reference | stale or unknown continuation reference | `409 W4_STATE_REF_CONFLICT` |

Admin history comparison recognizes `admin`, `tenant_admin`, and
`platform_admin`; no cross-tenant projection is introduced.

## Required validation evidence

The Product PR exact-head checks passed on `db8d97ac92d34479b89751a2506bf9897f4fe1aa`:

- `quality`: PASS
- `browser-smoke`: PASS, including core browser, PR4 browser, and external
  visual comparison
- `Analyze JavaScript and TypeScript`: PASS
- GitHub branch protection required conversation resolution: all five review
  threads resolved; no unresolved review blocker remained

Fresh detached validation was run from a new clean worktree at the exact merge
SHA `b95aaaf9b93a99261acc28780b5fbc4d92d8a79a`:

- W4 unit and endpoint tests: 18 passed
- Contract gate: 25 files / 58 tests passed
- Typecheck: PASS
- Lint: PASS
- Build: all workspace packages passed
- Hidden Unicode check: PASS
- Direct-store boundary check: 0 new unapproved runtime accesses, 0 stale,
  duplicate, or broad exceptions
- W4 Chromium journey: 1 passed using an external Playwright store and
  isolated ports
- Security audit: exit 0 at the repository's critical threshold; the existing
  2 low / 7 high dependency advisories remain visible and were not changed

The durable machine-readable route and binding receipts for this run are kept
under the external control root
`C:\Temp\simwar-w5-control-20260820T104645Z`, including the post-merge
detached receipt. The browser store and screenshots remain outside the
repository under the Playwright temporary evidence root.

## Authority and limits

This delta is documentation-only. It adds no writer, reader, fallback,
contract, workflow, API, migration, settlement authority, Enterprise State
authority, or model authority. The W4 JSON runtime and existing repository
boundaries remain unchanged.

The following remain explicitly outside this closure:

- Human Validation A and Human Model Validation B: not performed; at most
  `HV-B_READY` may be inferred by a future authorized process.
- Pilot and Production: not authorized.
- General PostgreSQL/RLS rollout: not authorized.
- W6 provider/agent execution: not authorized.
- Global accessibility, WCAG, or security PASS: not claimed.
- Historical PR #396/#397 rewrite, merge, or revalidation: not performed.

## Closure condition

After this governance delta itself passes its exact-head required checks and is
merged normally, Issue #398 may be closed as completed only after external
readback confirms:

1. remediation Product PR #399 is merged at the exact SHA above;
2. 398-A and 398-B are proven by the recorded tests and receipts;
3. this governance delta is present on current `master`;
4. the fresh detached validation is the exact merge SHA above; and
5. no historical PR was rewritten.

W5 starts only from a fresh read of the master branch after these conditions
are satisfied. No automatic successor, release, Pilot, or Production action
is implied by this document.
