# L1P-D6 TransferEvidence Research Design

Status: CLOSED_AND_CURRENT_WITH_LIMITS

## Product Outcome

Teacher and Admin can define, preview, freeze, revise, retire, and audit a
synthetic transfer research design bound to exact D1-D5 references. The D6
surface exposes research scope, context factors, research questions,
deterministic synthetic previews, immutable revisions, duplicate/conflict
semantics, lifecycle state, audit records, and safe Teacher/Admin projections.

## Evidence Binding

- Product PR: #334
- Product merge SHA: d252df2a45c19ea41fe1fd308fc7fe0bde185601
- Candidate head: 12c694262857130c984e584417e2d109c8774b54
- Candidate commits: 8
- Changed files: 27
- Changed-file manifest SHA-256:
  9cb989d7de27eb4bb7d29d287c2133b9ed01cb1235f2775523ea480f8086e783
- Post-merge fresh clone:
  C:/Users/Marshall/AppData/Local/Temp/E-SIMWAR-W010-D6-TRANSFER-EVIDENCE-20260804T103417Z/integration/fresh-clone/post-merge-d252df2
- Evidence Root:
  C:/Users/Marshall/AppData/Local/Temp/E-SIMWAR-W010-D6-TRANSFER-EVIDENCE-20260804T103417Z

## Authority and Boundaries

TransferResearchDesignCommandService is the sole writer for D6 design records
inside the JSON runtime. Formal EvidenceArtifact creation remains owned by
the existing D2 EvidenceCaptureCommandService. D6 does not create a second
EvidenceArtifact writer, Event Store, Truth writer, Settlement writer,
Score/Rank writer, Replay authority, Student route, or AI final-grade path.

D6 remains synthetic-only and descriptive/associational. It does not accept
real workplace or external-system data, make causal claims, produce HR/talent
or compensation outcomes, activate PostgreSQL, or authorize Pilot or
Production.

## Acceptance and Validation

- Acceptance rows A01-A30: no UNKNOWN and no NOT_MAPPED rows.
- Local fallback review: BLOCKING 0, MUST_FIX 0.
- Contract: 13 files / 32 tests; 17 schema groups.
- D6 targeted tests: 3 files / 6 tests.
- Browser: 1 / 1 PASS.
- Full Vitest: 155 files / 1011 tests PASS.
- Direct-store new violations: 0.
- Typecheck, lint, build, hidden-Unicode, quality, browser-smoke and CodeQL:
  PASS.

## Known Limits

- JSON_INTERNAL_ONLY remains the active runtime authority.
- Synthetic evidence is not real workplace transfer evidence.
- Causal claims are disabled.
- Human Validation was not performed.
- Issue #111 remains an open known limit.
- PostgreSQL, durable recovery, Pilot and Production remain inactive or
  unauthorized.
- No source-bound CodeGraph index was available; explicit source fallback was
  used.
- npm audit reported 2 low and 6 high pre-existing advisories; dependency
  files were not changed.

Automatic successor start: false.
