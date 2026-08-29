# Shanghai M7–M12 Productization Evidence and Handoff

## Scope and authority

This document records the bounded M7–M12 candidate-only productization spine
implemented from the V6 mission package. It is a generic contract/service
layer; Shanghai is represented by fixtures and does not create a Shanghai
kernel, runtime, registry, app, or formal writer.

The formal writer boundaries remain explicit:

- ScenarioPackage: `MAIN_SCENARIO_PACKAGE_AUTHORITY`
- Model governance: `MAIN_MODEL_GOVERNANCE`
- CoursePackage: `MAIN_COURSE_PACKAGE_AUTHORITY`
- Product release and withdrawal: `MAIN_PRODUCT_RELEASE_AUTHORITY`

No `SettlementResult`, canonical Decision, score, rank, truth hash, replay
hash, ParameterSet formal state, entitlement ledger, production database, or
provider state is written by this layer. Provider calls remain zero.

## State transition

```text
STATE_A: exact source references and upstream qualification evidence are
         available only as bounded inputs; no productization spine exists.
STATE_B: M7 catalog/selection -> M8 authoring/fork -> M9 qualification-aware
         model-evidence candidate -> M10 course-package candidate -> M11
         rights/delivery candidate -> M12 lifecycle/history candidate.
```

Every mutation in STATE_B returns an immutable candidate snapshot. Exact
tenant, identity, version, and content digest references are required. The
service rejects implicit `latest`, wildcard, fallback, and unresolved version
selection.

## Macro handoff

### M7 — Catalog and selection

`compileScenarioCatalog`, filtering, exact selection, and role projections
carry source metadata, qualification, rights, freshness, compatibility,
known limits, and consumer readiness. Student projection is an allowlist and
does not include source metadata or content digests. `UNKNOWN`, `STALE`, and
`NOT_ELIGIBLE` entries remain visible but cannot be selected for binding.

### M8 — Authoring and fork

Drafts require an exact base reference, an upstream source-admission snapshot,
valid/fresh/eligible rights, `fork_allowed`, and `SH:`-owned editable asset
references. Forking does not mutate its parent. Compare and validation share
the same qualification-impact rule for geography, cohort, and policy edits;
freezing is candidate-only and is permitted only from `DRAFT`.

### M9 — Qualification-aware model evidence

Model evidence candidates require an exact upstream qualification-pack
reference, explicit governance context, exact ModelVersion and ParameterSet
references, dated source evidence, units, geography, period, and expiry
checks. The output records `NOT_CALIBRATED`, `formal_join=false`,
`replay_truth_write=false`, and an explicit `why_not_bind` list. A candidate
status is not a model activation or a calibration claim.

### M10 — Experiment course package

Course assembly requires an M9 binding candidate and checks every round's
Scenario/Parameter/Model reference against that binding. It emits a deterministic
candidate digest and a `MAIN_COURSE_PACKAGE_AUTHORITY` binding request with
`formal_activation=false`. Standard and Advanced profiles share one
`simulation-core` kernel; Student projection omits model/parameter details.

### M11 — Enterprise rights and delivery

Course catalog registration validates rights shape. Copy and fork candidates
require the corresponding action, valid non-expired rights, exact tenant
scope, and retain source lineage without copying raw restricted data.
Delivery configuration carries its rights snapshot and requires `DELIVER` in
the authorized territory. Sponsor-safe aggregation rejects forbidden truth,
private, other-team, and model-coefficient fields and blocks cohorts below the
five-participant small-cell floor.

### M12 — Portfolio lifecycle and history

Portfolio candidates expose compatibility impact, exact history, constrained
status transitions, release gate, and rollback dry-run. A blocked compatibility
candidate starts in `DRAFT`; withdrawal appends history and never deletes it.
Historical resolution returns the most recent state for an exact reference.
Rollback requires that the target exists in candidate history and never writes
formal product state.

## Reuse and non-claims

The existing C5 CoursePackage writer, formal ScenarioPackage authority, model
governance plane, D5 export/delivery path, W4 enterprise-state path, and
historical scenario resolver remain separate authorities. This work does not
replace or write to any of them. M1–M6 are reused as an upstream tombstone;
the M9 input carries an explicit pack id/digest instead of silently converting
an upstream status into calibration.

Current consumer readiness is `C1_NAMED_FORWARD`/`C2_PLATFORM_REUSE` at the
candidate contract level only. HTTP/BFF wiring, durable registry persistence,
formal CoursePackage creation, entitlement activation, enterprise delivery
jobs, product release/withdrawal commands, and human validation remain
outside this bounded mission and are not proven by these artifacts.

## Verification handoff

The final handoff must attach current-head receipts for focused unit and
contract tests, typecheck, lint, contract validation, build, full-suite
result (with pre-existing failures separated), PR checks/CodeQL, ordinary
merge, detached post-merge verification, and the independent final ZIP
member/hash/semantic checks. Any unavailable Local Reference Vault,
CodeGraph, or Graphify result must be recorded as unavailable rather than
presented as a successful query.
