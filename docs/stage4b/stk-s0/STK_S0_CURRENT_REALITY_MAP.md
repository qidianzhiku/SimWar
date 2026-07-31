# STK-S0 Current Reality Map

## Record

| Field                          | Value                                      |
| ------------------------------ | ------------------------------------------ |
| Candidate                      | `CAND-L1P-STK-S0-IMPACT-ADR`               |
| Lane                           | `AUTHORIZED_ACTIVE_READ_ONLY`              |
| Assessment Source Anchor SHA   | `1a13d81a43f667d80d3da2eaffe8aae8e48b45f8` |
| Current Master Revalidated SHA | `050fcd5093b2edf9612ee297e639c48329613ae4` |
| Runtime authority              | `JSON_INTERNAL_ONLY`                       |
| Stakeholder Plane runtime      | `NOT_IMPLEMENTED_OR_PROVEN`                |
| Stage 4B activation            | `NOT_IMPLEMENTED; EFFECTIVELY_INACTIVE`    |
| Product/contract mutation      | `FORBIDDEN_IN_STK-S0`                      |

This record was assessed at the anchor and revalidated against the current
master above. CodeGraph and Graphify are navigation evidence, not Runtime
Truth. The revalidated source tree has no
`stakeholder` or `stage 4b` symbol match under `apps/`, `services/`, `packages/`,
`contracts/`, or `tests/`. Absence from static graphs alone would not prove
absence; the exact-source search corroborates that no named Stage 4B runtime is
present. The intervening C2/C3 and M0 changes do not activate STK.

The external Program M / Stage 4B material is classified
`BASELINE_CANDIDATE / DOCUMENTED_ONLY`. The original artifact is
`D:\HuaweiMoveData\Users\Marshall\Desktop\SimWar开发\SimWarL2\BLP\SimWar_独立BLP_RCNL模型开发计划_V2.0_Stage4B整合版_20260727_排版审校版.docx`,
with SHA-256
`2B48C7B3C963D59F05A02675A66B13816EE0C1DDAF10ABF129653E394128D68B`.
The S0-readable derived artifact is
`C:\Users\Marshall\AppData\Local\Temp\E-SIMWAR-M0-BLP-FORMAL-REBASE-20260730T112225Z\reference-BLP-RCNL-plan-extract.txt`,
with SHA-256
`EFA1A1C5B6498EA22170468DE056CDB1B1BC3B4ACFDC55CD7E0B163EBB20E33A`.
The extract title, document ID, version, and status identify it as a text
summary of that V2.0 DOCX. The M0 evidence root does not contain a sealed
DOCX-to-extract transformation manifest, so the derivation itself is not
cryptographically proven. Neither artifact establishes current implementation.

## Evidence Classes

- `SOURCE_PROVEN`: current source or repository governance at the source SHA.
- `DOCUMENTED_ONLY`: approved or candidate documentation without current code proof.
- `INFERRED`: bounded architecture inference from existing seams.
- `UNKNOWN`: not established by current source, tests, or executable evidence.

## Fifteen Required Answers

### 1. What is the Stakeholder Plane?

`DOCUMENTED_ONLY`: a future, non-blocking Stage 4B shadow plane that may turn
authorized observations into bounded stakeholder proposals and deterministic
resolved signals. It is not a demand engine, product Truth source, formal
Decision writer, or currently active runtime.

### 2. What can it never write?

`SOURCE_PROVEN` boundary: it must never write canonical `Decision`,
`state_true`, `SettlementResult`, `Score`, `Rank`, `ParameterSet`,
`ModelVersion`, formal Replay results, or formal Course/Run bindings. It also
must not alter replay hashes or historical bindings.

### 3. What data could it read?

`INFERRED / CANDIDATE_ONLY`: only explicitly authorized, tenant-scoped safe
projections: Course and approved CourseBlueprint identity/metadata, Run/Round
status, team/role identifiers when required, student-safe `state_obs` and
`state_est`, published safe results, bounded Learning Evidence, and audit-safe
references. Raw `state_true`, private Replay evidence, role drafts, private
memory, hidden parameters, and other-team data are excluded.

### 4. What must be de-identified?

`SOURCE_PROVEN` policy: personal identifiers, tenant/customer identity,
enterprise-sensitive content, raw reflection, private team discussion,
free-form interview text, relationship edges, and any context that permits
re-identification. Synthetic or cohort-level representations are preferred.

### 5. What are the tenant/team/role boundaries?

`SOURCE_PROVEN`, limited to current seams: existing API/BFF projections carry
authenticated tenant context and enforce local tenant, team, role, and
student-safe projection boundaries in the inspected paths.

`INFERRED / DOCUMENTED_ONLY` for future STK: team and role must only narrow
access, cross-tenant and cross-team reads must fail closed, and every
Stakeholder context must carry explicit tenant, course, run, and visibility
scope. Current source does not prove this end-to-end STK chain; S1 requires
dedicated negative and fail-closed tests.

### 6. How does it relate to Teacher, Student, and Admin?

`INFERRED / CANDIDATE_ONLY`: Teacher may review a bounded, safe diagnostic or
proposal summary; Student may receive only an approved, redacted narrative with
no private memory or other-team content; Tenant Admin may see scoped status and
audit counts; Platform Admin may inspect governance metadata. No persona may use
the plane to write formal Truth.

### 7. How does it relate to CourseBlueprint?

`SOURCE_PROVEN` current boundary: `CourseBlueprintCommandService` remains the
sole lifecycle writer. STK-S0 reads the existing contract and C1 evidence only.
`DOCUMENTED_ONLY`: a later Stage 4B mode could be referenced by a new,
separately authorized CourseBlueprint version, but must not mutate an approved
version or its binding.

### 8. How does it relate to Learning Evidence?

`SOURCE_PROVEN`: current Learning Report output is `advisory_only: true` and
`formal_grade: false`. `INFERRED`: a future stakeholder narrative could become
a candidate learning-evidence input only after Teacher confirmation in Program
D. It cannot write formal grades or business outcomes.

### 9. How does it relate to AI Advisory?

`SOURCE_PROVEN`: `CoachOutput` and `ModelCallLog` are advisory-only contracts.
`DOCUMENTED_ONLY`: a future Agent may propose a stakeholder action, but a
deterministic resolver must bound it. AI/Agent output cannot write ModelVersion,
ParameterSet, Decision, Truth, Settlement, Score, or Rank.

### 10. Does it need Shared Contract changes?

`UNKNOWN`: S0 does not need or authorize them. A future S1 likely needs a narrow
contract for context projection, proposal, resolved signal, mode status, and
audit references. `packages/shared-contracts` is currently
`READ_ONLY_NOT_ACQUIRED`; any change requires a separate gate and single writer.

### 11. Which feature flags and off-switches are needed?

`INFERRED / CANDIDATE_ONLY`: global, tenant, course, run, and provider switches,
all default OFF. Global OFF has highest precedence. OFF must disable route
registration, provider calls, proposal writes, resolver execution, and product
projection while preserving exact existing runtime behavior.

### 12. Where is the future S1 write surface?

`DOCUMENTED_ONLY / NOT_AUTHORIZED`: only a separate bounded shadow store for
append-only `StakeholderProposal`, `ResolvedStakeholderSignal`, runtime
preference-state candidates, and audit records. The exact port, provider, path,
schema, retention, and writer are `UNKNOWN`. It must not reuse formal stores.

### 13. Which files could conflict with C2?

`SOURCE_PROVEN`: no current conflict because STK-S0 changes only this directory.
Future contract/runtime work would conflict with C2 ownership around
`packages/shared-contracts/**`, `services/api/src/server.ts`,
`services/api/src/course-blueprint-authority.ts`,
`services/api/src/teacher-course-blueprint-service.ts`,
`apps/teacher/src/App.tsx`, Teacher BFF surfaces, contract fixtures, and contract
tests. Those changes must be serialized after C2 and separately authorized.

### 14. Does it affect Run, Replay, or Settlement?

Current answer: `NO`. STK-S0 has no runtime mutation. A future Plane OFF path
must have exact parity with current Run, Golden, Replay digest, Settlement,
Score, and Rank. Shadow output must be isolated and must not overwrite formal
results. Official Replay must not call an external provider.

### 15. What must be deferred?

S1/S2 runtime code, shared contracts, provider integration, population/memory
stores, resolver implementation, BLP preference-state bridge, ModelVersion or
ParameterSet compatibility, Teacher/Student UI, Learning Evidence ingestion,
durable persistence, real-person data, real providers, Pilot, Production, and
any limited or official influence are deferred to independent gates.

## Current Reusable Source Patterns

| Pattern                         | Current evidence                                                                            | Classification                        |
| ------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------- |
| Persona-safe projections        | `createTeacherBffWorkspaceDto`, `createStudentBffCockpitDto`, `createTenantAdminSummaryDto` | `SOURCE_PROVEN`                       |
| Student truth redaction         | `StudentSafeTeamSettlement`, `findStudentResult`                                            | `SOURCE_PROVEN`                       |
| Advisory-only contracts         | `CoachOutput`, `ModelCallLog`, `LearningReportDTO`                                          | `SOURCE_PROVEN`                       |
| Exact CourseBlueprint authority | `CourseBlueprintVersion`, `CourseBlueprintCommandService`, exact references/digests         | `SOURCE_PROVEN`                       |
| Replay non-overwrite            | `RunReplayEvidence.replay_writes_formal_results: false`                                     | `SOURCE_PROVEN`                       |
| Stage 4B resolver/runtime       | No named current symbol                                                                     | `UNKNOWN / NOT_IMPLEMENTED_OR_PROVEN` |
| Plane OFF exact parity          | Required by candidate baseline; no current Stage 4B harness                                 | `DOCUMENTED_ONLY`                     |

## Evidence References

- Launch evidence `graphs/codegraph-required/CG-009.txt` and `CG-010.txt`.
- Launch evidence `graphs/graphify-required/GF-007.txt` and `GF-008.txt`.
- Launch evidence `09-file-ownership-matrix.json` and
  `10-shared-resource-lock-matrix.json`.
- `services/api/src/teacher-student-bff-dto.ts`.
- `services/api/src/course-blueprint-authority.ts`.
- `services/api/src/run-manifest-replay-evidence.ts`.
- `packages/shared-contracts/src/index.ts`.
- `docs/governance/L1_DEFINITION_OF_DONE.md`.
- `docs/governance/CODEX_TARGET_MODE_AUTHORITY_MATRIX.md`.
- `docs/product/data-privacy-case-community-rules.md`.
- Original Program M V2.0 DOCX and its S0-readable derived extract, with the
  paths, independent SHA-256 digests, and unsealed derivation limitation
  recorded above; both are `BASELINE_CANDIDATE / DOCUMENTED_ONLY`.
