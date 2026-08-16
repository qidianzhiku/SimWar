# MW2-GOV-00｜PX1-PG-01 Publication Gate Safety
# Governance Closure Record V1.0

## Document control

- Mission: `SIMWAR-MW2-PX1-PG-01-PUBLICATION-GATE-SAFETY-V1.0`
- Document: `MW2-GOV-00`
- Document type: `GOVERNANCE_CLOSURE_RECORD`
- Status: `DOCUMENTATION_ONLY_CLOSURE_CANDIDATE`
- Authoring source SHA: `563410a72294834f4f6199894a19a056047d3dcb`
- Authoring source tree: `619284dc40d1f303e329be81fd89c813a966896f`
- Product outcome: `PX1-PG-01_PUBLICATION_GATE_SAFETY`
- Product PR: [#381](https://github.com/qidianzhiku/SimWar/pull/381)
- Product merge: `563410a72294834f4f6199894a19a056047d3dcb`
- Governance mutation: this document and its machine-readable register only
- Human validation: `NOT_PERFORMED`
- Pilot / Production: `NOT_AUTHORIZED`
- Automatic next start: `FALSE`

This record is intentionally documentation-only. It does not implement a new Product capability, reopen a completed Product outcome, change a planning carrier, or grant authority to merge or start a successor.

## 1. Closure decision

`MW2-GOV-00 = CLOSURE_CANDIDATE_WITH_LIMITS`

The Product Mainline outcome is complete at the implementation and ordinary-merge boundary with explicit limits. The single Product PR changed only the shared error constant, API projection enforcement, OpenAPI response documentation, and the two publication-gate acceptance tests. The existing Round publication command remains the formal publication writer.

The closure is limited by the known missing PostgreSQL test environment, two unrelated detached-harness full-test timeouts, inherited format/dependency debt, automated-only browser evidence, and incomplete post-merge Graphify artifact generation. None of these limits is silently promoted to a Product failure or silently waived.

## 2. Frozen current reality

The fresh current-master read at authoring time produced:

| Fact | Evidence |
|---|---|
| Master SHA | `563410a72294834f4f6199894a19a056047d3dcb` |
| Master tree | `619284dc40d1f303e329be81fd89c813a966896f` |
| Merge parents | `b01ccb026ce414d4016342f15da696f7dcddfa4d`, `a44fb731f50428875af76f253d3816c5d71f75cf` |
| Product PR | #381, merged ordinarily |
| Required checks | `quality`, `browser-smoke`, `Analyze JavaScript and TypeScript` all PASS |
| Open governance collision | PR #374 remains open, conflicting, and unchanged |
| Product WIP | released after Product PR #381 merge |

The pre-merge reference SHA was used only as a starting anchor. All implementation and post-merge claims above are bound to the fresh current source and exact merge evidence.

## 3. Primary user-state transition

The closed vertical slice is:

`SETTLED + Student requests result`
→ `safe metadata only / stable pre-publication error`
→ `Teacher Publish`
→ `Round = PUBLISHED`
→ `existing role-safe Student result`

The following Student ingress surfaces are server-gated before publication:

- direct round result route: `409 RESULT-409-001`;
- Student BFF cockpit: no settlement-derived result, state, score, rank, or learning prompt fields;
- demo-state bootstrap: `latest_result` omitted;
- Student UI: existing empty/progress state remains driven by the safe server projection.

Authorized Teacher/classroom preview remains available through the existing internal projection. `SETTLED` remains distinct from `PUBLISHED`; publication is not inferred from settlement and no frontend calculates publication readiness.

## 4. Authority and truth-boundary closure

The governance record freezes the following boundaries as current contract:

- Formal publication writer: existing Round publish command / Round authority.
- Student safety enforcement: server-side projection boundary in `services/api/src/server.ts`.
- Result schema and settlement truth: unchanged.
- Replay hash and manifest schema: unchanged.
- Frontend: task/projection layer only; no new publication authority.
- BFF: projection only; no new publication writer.
- Teacher preview: role-safe internal preview, not publication.
- Learning evidence: not retrofitted into a round publication binding by this wave.

No Publication Registry, duplicate Round writer, result writer, replay authority, or frontend authority was created.

## 5. Evidence and acceptance

### Product PR evidence

- Product commit: `a44fb731f50428875af76f253d3816c5d71f75cf`.
- Product merge: `563410a72294834f4f6199894a19a056047d3dcb`.
- Exact Product changed-file denominator: 5 files.
- Protected checks: all required contexts green.
- Product browser journey: 1 pass; automated evidence only.

### Fresh detached post-merge evidence

A fresh detached clone read back the merged master SHA and tree, initially clean, and confirmed the changed-file manifest and source symbols. Focused post-merge publication integration passed 2 tests, the contract gate passed 20 files / 48 tests, and the publication Browser/API journey passed once.

The full detached-clone suite reported 198 of 200 files and 1,278 of 1,280 tests passing. The two timeouts were classified `FRESH_DETACHED_HARNESS_LIMIT`: both rely on a symbolic `HEAD` baseline assumption that is incompatible with the required detached readback. No test was changed to hide this limitation.

Post-merge PostgreSQL replay remains `BLOCKED_SIMWAR_TEST_DATABASE_URL_MISSING`; this wave did not activate PostgreSQL, RLS, or migrations.

## 6. Methodology and efficiency baseline carried forward

The Completion Frozen Pack classified the methodology gate as `PASS_WITH_LIMITS` before code. The observed optimization outcomes are preserved here:

| Objective | Current evidence-based classification |
|---|---|
| Outcome throughput | `OBSERVED`, medium confidence; one bounded Product PR plus one governance closure boundary in this wave |
| Rework ratio | `UNKNOWN`; no normalized event ledger |
| Coordination overhead | `HIGH_QUALITATIVE`; shared server/contracts and detached validation require serialization |
| Parallel efficiency | `UNKNOWN_WITH_SAFE_LIMIT`; read-only cells parallelized, high-risk writer and heavy browser lane serialized |
| Merge conflict rate | `UNKNOWN_WITH_ONE_OBSERVED_CONFLICT`; PR #374 is one observed conflicting PR, not a complete denominator |
| Evidence density | `UNKNOWN`; no stable cross-wave denominator |
| Graphify ROI | `POSITIVE_WITH_SOURCE_READBACK`; baseline/navigation aid only |
| CodeGraph ROI | `POSITIVE_WITH_SOURCE_READBACK`; caller/impact discovery confirmed by source |
| Check convergence cost | `UNKNOWN`; retry/queue event ledger unavailable |

The process controls that remain legal for the next owner are one Product Mainline outcome, one high-risk writer, disjoint-only experience work after P0 freeze, read-only support cells, one serial heavy-validation lane, source/test closure for graph findings, and no automatic successor.

## 7. Historical evidence and PR #374

PR #374 remains open and unchanged:

- title: `docs: close W025 durable validation launch`;
- head: `98bc740f87cdebad87fce9a21f3e2b83fa71c615`;
- base: `8bb489c8f92d04919bcea98cc95fc3c4d4a18bc0`;
- state: `OPEN`;
- mergeability: `CONFLICTING` / `DIRTY`;
- changed-file count: 4;
- classification: `STALE_BUT_PRESERVE`.

Its unique planning and W025 documentation delta was not absorbed into this closure. No current-cycle or portfolio carrier was mutated, and no governance reclosure was attempted. Its future treatment remains a fresh W6 review from the current master, subject to separate Owner direction.

All MW1, PX1-CA-01, and prior historical merge/closure evidence remains immutable. This document does not rewrite historical claims.

## 8. Resource ownership reset

The Product hot-file ownership used by PX1-PG-01 is released at the Product merge boundary. No persistent lock is acquired by this record.

| Resource family | Closure state | Future rule |
|---|---|---|
| `packages/shared-contracts/**` | released | one future Product writer per outcome |
| `contracts/openapi/**` | released | contract-first ownership; no support-lane writes |
| `services/api/src/server.ts` | released | one formal route/authority writer |
| Student/Teacher BFF projection paths | released | preserve role-safe server projection |
| settlement/replay | untouched and released | no latest-result or replay authority regression |
| migrations/PostgreSQL/RLS | untouched | separate explicit authorization only |
| current-cycle / portfolio | untouched | do not resolve PR #374 drift in this closure |

Violation of these rules in a successor requires a fresh owner authorization and a new exact-SHA collision review. This record does not reserve a future file lock.

## 9. Known limits and non-claims

- `BROWSER_VERIFIED` means automated browser evidence only; `HUMAN_VALIDATED` is not claimed.
- `TESTED` is limited to the named local and protected checks; the missing PostgreSQL environment is not represented as parity.
- The detached-harness timeouts are not converted into a green full-suite claim.
- Graph indexes are navigation aids, not repository truth; post-merge Graphify remains `GRAPH_STALE_WITH_SOURCE_FALLBACK`.
- No Pilot, Production, real AI provider, BLP runtime, Shanghai formal join, Small Model, Multi-Agent runtime, general PostgreSQL, or RLS activation occurred.
- No selected-round repair, DecisionTrace, six-role expansion, UI refoundation, or Publication Gate successor work occurred.

## 10. Closure and successor boundary

After this Governance Closure PR is ordinarily merged, the controller must perform a fresh detached master readback and generate an external post-governance evidence record. That record may list at most three successor candidates and select exactly one for owner consideration. Selection does not authorize execution.

`automatic_next_start = FALSE` is permanent for this wave. The next Product Mainline cannot begin until the Owner provides a separate mission and the new mission performs its own fresh current-reality and collision review.
