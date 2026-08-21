# SimWar M2-P4 Live Round Operations V5.18 Evidence Index

- Mission: `SIMWAR-SH-M2-P4-LIVE-ROUND-OPS-V5.18-20260821`
- Mission type: `PRODUCT_MACRO`
- Product scope: Teacher Course Director live-round command center, exact Course/Run/Round scope, all-team canonical Decision readiness, explicit lock, existing settlement, Teacher-safe SETTLED preview, governed publication, Student own-team Project context/result and existing W3/P2-B handoff.
- Evidence timestamp: `2026-08-21T17:38:51Z`
- Initial authenticated `origin/master`: `d7ddfd62254364698819e2f89dbaf9939758084a`
- Current authenticated `origin/master`: `969bfd7457ea665946fe59a808694d31e2c815d0`
- Current candidate implementation head before evidence commit: `fad23afd34a32ad8eeeb60bc091b3b8e200a08f0`
- Current candidate tree before evidence commit: `6819d5d93bf2bca818dfa5e5ee0197ad0a01e360`

## Receipt map

| Receipt | Status | Evidence |
| --- | --- | --- |
| CURRENT_REALITY_RECEIPT | PASS_WITH_BASE_ADVANCE_REAUTH | [`CURRENT_REALITY_RECEIPT.md`](./CURRENT_REALITY_RECEIPT.md) |
| ACTIVE_PR_OVERLAP_RECEIPT | RESOLVED_BEFORE_PRODUCT_ACTION | [`ACTIVE_PR_OVERLAP_RECEIPT.md`](./ACTIVE_PR_OVERLAP_RECEIPT.md) |
| CODEGRAPH_RECEIPT | PASS | [`CODEGRAPH_RECEIPT.md`](./CODEGRAPH_RECEIPT.md) |
| GRAPHIFY_RECEIPT | PARTIAL_AST_EXTRACTION | [`GRAPHIFY_RECEIPT.md`](./GRAPHIFY_RECEIPT.md) |
| DUAL_KG_RECONCILIATION | SOURCE_AND_CODEGRAPH_AUTHORITATIVE | [`DUAL_KG_RECONCILIATION.md`](./DUAL_KG_RECONCILIATION.md) |
| HISTORICAL_REFERENCE_RECEIPT | NOT_REQUIRED_FOR_CURRENT_AUTHORITY | [`HISTORICAL_REFERENCE_RECEIPT.md`](./HISTORICAL_REFERENCE_RECEIPT.md) |
| LOCAL_VAULT_RETRIEVAL_ASSESSMENT | AVAILABLE_READ_ONLY_NO_QUERY_REQUIRED | [`LOCAL_VAULT_RETRIEVAL_ASSESSMENT.md`](./LOCAL_VAULT_RETRIEVAL_ASSESSMENT.md) |
| DESIGN_REUSE_RECEIPT | SOURCE_REUSE_FALLBACK | [`DESIGN_REUSE_RECEIPT.md`](./DESIGN_REUSE_RECEIPT.md) |
| COMPETITOR_OSS_PATTERN_LEDGER | NO_EXTERNAL_PATTERN_IMPORTED | [`COMPETITOR_OSS_PATTERN_LEDGER.md`](./COMPETITOR_OSS_PATTERN_LEDGER.md) |
| FILE_OWNERSHIP_MATRIX | PASS | [`FILE_OWNERSHIP_MATRIX.md`](./FILE_OWNERSHIP_MATRIX.md) |
| BASELINE_FAILURE_FINGERPRINT_REGISTRY | CURRENT_CANDIDATE_RECORDED | [`BASELINE_FAILURE_FINGERPRINT_REGISTRY.md`](./BASELINE_FAILURE_FINGERPRINT_REGISTRY.md) |
| PRODUCT_EXACT_HEAD_VALIDATION_RECEIPT | PASS_PENDING_FINAL_HEAD_UPDATE | [`PRODUCT_EXACT_HEAD_VALIDATION_RECEIPT.md`](./PRODUCT_EXACT_HEAD_VALIDATION_RECEIPT.md) |
| POST_MERGE_DETACHED_RECEIPT | PENDING_PRODUCT_MERGE | [`POST_MERGE_DETACHED_RECEIPT.md`](./POST_MERGE_DETACHED_RECEIPT.md) |
| FINAL_GOVERNANCE_READBACK_RECEIPT | PENDING_GOVERNANCE_CLOSURE | [`FINAL_GOVERNANCE_READBACK_RECEIPT.md`](./FINAL_GOVERNANCE_READBACK_RECEIPT.md) |

## Acceptance summary

- Shared contract and DTO projection: implemented and focused-tested.
- Teacher projection: server-owned exact scope, all-team project/role/canonical readiness, round command state, lock/settlement/publication receipts, and debrief handoff.
- Student projection: exact assigned ProjectProfile context, own-team result only after publication, no truth-field or cross-team projection.
- Dedicated browser: `@m2-p4-real`, mocks=0, retries=0, one test passed on current rebased candidate.
- Current code gates after rebase: typecheck, build, lint, contract, focused regression, hidden Unicode, and direct-store boundary guard passed.
- Full Vitest: 238/243 files and 1459/1464 tests passed in concurrent mode; 5 unrelated 5-second timeout fingerprints were reproduced as passing in a serial rerun of the 5 affected files (191/191). See the baseline receipt.
- Security audit: inherited 9 advisories (2 low, 7 high); no dependency mutation was authorized or performed.

## Explicit non-proofs

This evidence does not claim Human Validation, Pilot, Production, W6, PostgreSQL/RLS activation, provider activation, global accessibility pass, or automatic successor creation.
