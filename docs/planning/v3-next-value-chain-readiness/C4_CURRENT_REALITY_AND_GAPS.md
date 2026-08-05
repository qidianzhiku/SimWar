# C4 Current Reality And Gaps

**Candidate:** `CAND-L1P-C4-INSTRUCTOR-DEBRIEF-KIT`
**Status:** `CLOSED_AND_CURRENT_WITH_LIMITS`
**Product merge:** `#347` / `ac78124bfeba4d76fd079199039954b3dabfde97`
**Source anchor:** `c6563104d03d85ef2042d2310ca8880fc0083a42`

## Current Product State

The Teacher surface now reads a deterministic instructor debrief artifact
from the existing published instructor asset, exact Run/Round scope, and the
official published SettlementResult through the Teacher BFF. The artifact
exposes its exact source binding, replay hash, baseline binding, deterministic
digest, and explicit known limits. JSON and Markdown exports use the same
artifact digest and safe deterministic filename.

| C4 state                                   | Current evidence                                      | Status               |
| ------------------------------------------ | ----------------------------------------------------- | -------------------- |
| Briefing bound to Course/Blueprint version | `course_blueprint_ref` and published instructor asset | `CLOSED_AND_CURRENT` |
| Teacher discussion prompts                 | Existing deterministic kit inside artifact            | `CLOSED_AND_CURRENT` |
| Debrief linked to published result         | Official `settlement_result_id` and `replay_hash`     | `CLOSED_AND_CURRENT` |
| FAQ/Known Limits presentation              | Artifact and Markdown Known Limits                    | `CLOSED_AND_CURRENT` |
| Exact JSON/Markdown export                 | Teacher BFF export routes and browser receipt         | `CLOSED_AND_CURRENT` |

## Boundaries And Known Limits

- The artifact is an on-demand teacher-safe read model, not a second store,
  Event authority, Truth writer, SettlementResult writer, Replay authority or
  final-grade mechanism.
- It does not copy arbitrary private event payloads and does not add a Student
  route or Student UI.
- `JSON_INTERNAL_ONLY` remains the sole runtime authority.
- PostgreSQL, durable cross-process recovery, Human Validation, Pilot,
  Production and successor work remain outside this closure.
- Existing Issue #111, #113 and #118 states are unchanged.
- No current CodeGraph index was available; explicit source and diff review
  was used as the documented fallback.

## Evidence

- Product PR #347 passed quality, browser-smoke and CodeQL.
- Product exact-head review recorded `BLOCKING=0` and `MUST_FIX=0` in the
  local fallback receipt.
- Fresh detached clone at `ac78124bfeba4d76fd079199039954b3dabfde97` passed the
  targeted, contract, boundary, type, lint, build, browser and full Vitest
  receipts; browser used isolated ports after default-port environment residue.
- Evidence root: `C:/Temp/simwar-w016-c4-20260805T165028`.

This document does not authorize D3, C5, D4, AI, PostgreSQL, Pilot,
Production, or automatic successor work.
