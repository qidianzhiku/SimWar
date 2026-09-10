# KG shadow support preamble v1

This preamble defines the lane-neutral support boundary for the KG-O3B2
shadow-evidence work. It applies to MAIN, SH, MOD, AGT, and FE engineering
tasks when a graph companion may help an investigator navigate a seam. It is
an evidence preamble, not a Product feature specification and not a release
gate.

## What this support plane is

Graph Companion, CodeGraph, Graphify, and the small historical-evidence
helpers are derived engineering evidence. They can reduce navigation cost,
surface candidate callers/callees, and record a bounded investigation. Source
readback, contracts, tests, and the owning Product authority remain the
decision authority. A graph result never becomes Product Truth, a canonical
Decision, SettlementResult, score, rank, registry, writer, or a second
controller.

Selective routing is expected:

| Risk seam | Support route | Required source evidence |
| --- | --- | --- |
| G0 documentation or non-authority visual work | source-only | direct source/document read |
| G1 local module logic | source first; graph optional | direct source read |
| G2 BFF, schema, OpenAPI, freshness, or consumer path | CodeGraph when qualified | exact source readback |
| G3 writer, permission, settlement, truth, or cross-cell path | qualified CodeGraph; Graphify only when applicable | exact source readback and mandatory tests |

An unavailable or unknown tool is a seam-local fallback. It does not create a
global HOLD and does not require a dual-graph call for every lane or every
question. `INSTALLED`, `AVAILABLE`, `CALLED`, `RELEVANT`, and `MATERIAL` are
separate observations.

## Historical shadow boundary

Historical calibration is read-only and must be bound to one exact commit SHA
and tree SHA. A cell is not valid when it uses a branch name, short SHA,
unresolved worktree, or a source snapshot whose identity differs from the
historical target. The source snapshot is labelled `HISTORICAL_SNAPSHOT` and
must not be marked current, repaired, or worktree-derived.

The current repaired source may be recorded as provenance metadata so an
operator can prove it was excluded. It must never be the blind input to a
historical control or treatment cell. The O3B2 helper rejects an explicit
current/repaired snapshot and rejects a source/target identity mismatch.

Each comparison has two isolated cells:

- `SOURCE_ONLY` is the control cell.
- `KG_ASSISTED` is the treatment cell.

The cells receive the same historical target, task framing, and time budget.
Do not copy findings, navigation notes, answer-key fields, or post-review
patch details from one cell into the other. Create cells first, then seal each
cell. Until both cells are sealed, the comparison result contains only cell
status and `answer_key_status: WITHHELD`; it does not contain an answer key or
a finding classification. The answer key is supplied only to the final
post-seal comparison.

The resulting labels are bounded observations, not statistical claims:
`MATERIAL`, `CONFIRMATORY`, `NO_MATERIAL`, `FP`, `FN`, or
`NOT_COMPUTED`. A small historical sample does not prove p95 latency,
statistical significance, production value, or a generalized KPI lift.

## Forward pilot boundary

Historical HC-07 is calibration only. The PR509 first material-review commit,
`14e577bf9c8745e3b8694812efb88fe3f4188e4a`, is a locator for that historical
question, not a Product source to alter and not a forward-pilot candidate.

Forward selection requires an explicitly marked, open, pre-review Product
task. Completed, merged, post-review, engineering-only, shadow, and historical
tasks are excluded. Selection is deterministic and returns only a bounded task
summary. If no eligible task is supplied, the selector returns the exact state
`WAITING_FOR_NEXT_PRE_REVIEW_PRODUCT_TASK`. That state is a stop condition for
this support lane; it is not permission to invent a task or start a successor.

## Operational non-goals

- No Product runtime, database/provider, settlement, replay truth, score, rank,
  or frontend mutation.
- No answer-key access before both cells seal.
- No use of current repaired source as historical blind input.
- No inference of actual development value from a recommendation, graph health,
  or shadow observation alone.
- No automatic next start; the owner retains selection and review gates.
