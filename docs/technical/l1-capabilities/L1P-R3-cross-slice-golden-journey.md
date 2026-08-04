# L1P-R3 Cross-Slice Golden Journey

Capability ID: `L1P-R3`

Candidate ID: `CAND-L1P-R3-CROSS-SLICE-GOLDEN-JOURNEY`

Status: `CLOSED_AND_CURRENT_WITH_LIMITS`

## Primary Outcome

Teacher and Student can inspect the current integrated Golden Journey across
the D1-D6 evidence chain through safe, read-only projections. The journey
exposes exact CoursePackage identity, supported slices, safe receipts, allowed
actions, request correlation, and known limits without introducing a new
writer or a second runtime authority.

## Scope And Authority

- Runtime authority remains `JSON_INTERNAL_ONLY`.
- The sole integration projection is
  `GoldenJourneyIntegrationService_JSON_INTERNAL_ONLY`.
- No R3 writer is introduced. Existing D1-D6 writers remain authoritative.
- Teacher routes are read-only status, context, allowed-actions, and receipts
  projections; Student routes expose only the safe projection.
- Student output excludes D2/D3 private evidence, provenance, confirmation,
  and internal audit fields.

## Delivery Evidence

- Cell A PR #336 merged as `a4494906c556e70ad82d6f4544a34b8d11b0f18a`.
- Cell B PR #337 merged as `ce637e7102c174804116db624c35a96c3363acec`.
- Final current master and product evidence source:
  `ce637e7102c174804116db624c35a96c3363acec`.
- Acceptance freeze contains 36 rows with zero `UNKNOWN` and zero
  `NOT_MAPPED` rows.
- Post-merge fresh detached validation passed: contract, direct-store,
  hidden-Unicode, typecheck, lint, build, 157 Vitest files / 1018 tests, and
  browser validation (74 passed / 9 existing environment-gated skips plus one
  role-workflow test passed).
- Exact-head quality, browser-smoke, CodeQL, and independent review passed for
  both product PRs.

## Known Limits And Non-Proofs

- The journey is a synthetic internal validation flow, not Human Validation.
- JSON persistence remains the only active runtime authority.
- D5 and D6 inputs are synthetic or mock-backed where stated by their own
  capability records.
- Durable settlement, backup, restore, recovery, PostgreSQL authority, Pilot,
  and Production remain unproven or unauthorized.
- Issue #111 remains `OPEN_KNOWN_LIMIT`.
- CodeGraph was unavailable for this wave and is recorded as
  `GRAPH_EVIDENCE_GAP`.
- R3 does not prove causal learning outcomes, real-user usability, or any
  successor capability.

## Invalidation And Scheduling

The capability is invalidated by a product/runtime change, a D1-D6 shared
contract or authority change, a Golden or visibility change, or invalidated
post-merge evidence. Automatic successor start is `false`; no D4 or later
capability is authorized by this record.
