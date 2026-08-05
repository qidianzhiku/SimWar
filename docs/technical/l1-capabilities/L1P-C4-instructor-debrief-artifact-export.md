# L1P-C4: Instructor Debrief Artifact And Exact-Source Export

**Status:** `CLOSED_AND_CURRENT_WITH_LIMITS`

**Candidate:** `CAND-L1P-C4-INSTRUCTOR-DEBRIEF-KIT`

**Product merge:** `#347` / `ac78124bfeba4d76fd079199039954b3dabfde97`

**Product candidate:** `700bbe3182c4e73ebe23efc1607b7f23bd0b3f8e`

**Runtime authority:** `JSON_INTERNAL_ONLY`

## Product Outcome

The Teacher BFF now returns a deterministic `InstructorDebriefArtifactDTO`
derived from a published instructor asset, a published Round, the exact
official SettlementResult, and a Teacher-safe PublicResultView. The artifact
contains its exact CourseBlueprint reference, settlement/result identity,
replay hash, baseline binding, digest, advisory-only class, AI-off state and
known limits.

The Teacher workbench displays the artifact receipt and supports JSON and
Markdown exports. Export filenames are deterministic and digest-bound. Scope
changes clear the artifact, and the existing request sequence/cancellation
guards prevent stale responses from replacing the current Teacher scope.

## Evidence And Validation

- PR #347: one ordinary merge, exact base/head verified.
- Changed files: 14; manifest SHA-256:
  `a8f07f42fad34b24c718e8b332f274a90effaefb639f39b2d008cd8e254e07ac`.
- Contract: 15 files / 40 tests; 19 schema/fixture groups.
- Full Vitest: 160 files / 1029 tests; 0 skipped.
- Browser: focused C4 Teacher journey and JSON/Markdown download passed in
  the product candidate and fresh detached merge clone.
- Direct-store boundary, hidden Unicode, typecheck, lint and build passed.
- Independent local fallback review: `BLOCKING=0`, `MUST_FIX=0`.

## Boundaries And Non-Proofs

- No second store, registry authority, resolver, Truth writer, SettlementResult
  writer, Score/Rank writer, Replay writer, Student route or final-grade path
  was introduced.
- The artifact is an on-demand read model and does not provide durable
  cross-process recovery or crash-safe persistence.
- AI remains off and advisory-only; Human Validation was not performed.
- PostgreSQL, D3, C5, D4, Pilot, Production, billing and successor work are
  not authorized.
- Existing dependency advisories and open Issue #111/#113/#118 remain known
  limits and were not changed by this closure.

## Closure

This capability is closed for the W016 product scope. Resource locks are
released only after the governance closure merge and final master readback.
`automatic_next_start: false`.
