# MJP: N1 Regional Model Transfer Requalification Product

## Mission and scope

- Mission: `SIMWAR-MOD-DYNAMIC-MODEL-PRODUCT-MACRO-V1.2-20260830`
- Selected macro: `N1_REGIONAL_MODEL_TRANSFER_REQUALIFICATION_PRODUCT`
- Baseline: `origin/master@9ccfe8e56cef52a088ef773b79632cc7ca1f1939`
- State A: RT-O1 already composes an exact regional candidate and can publish a
  role-safe target-region context, but its qualification is a generic
  `READY_WITH_LIMITS` flag plus an unconditional requalification boolean. It
  does not expose a deterministic comparison of exact model version, source,
  rights, freshness, Reality Gap, and OOD for the baseline and target region.
- State B: the existing RT-O1 product emits and consumes an exact-bound,
  candidate-only regional comparison with explicit unknown/not-retrieved
  semantics and a bounded requalification/transfer decision. Teacher/Admin
  receive the audit evidence; Student receives only the safe target-region
  context and bounded status. No official truth, settlement, score, rank,
  replay truth, or formal ParameterSet write is introduced.

## Semantic completeness freeze

- Model identity: the exact `ParameterSet.model_version_ref` already returned
  by the formal source port; floating `latest`, `current`, `default`, and
  `fallback` selectors are rejected.
- Baseline and target: exact M4 package IDs, versions, and SHA-256 digests;
  the existing anchor/second-city package resolver remains authoritative.
- Qualification evidence: exact M5 support-pack digest and source revision are
  reused. M5's `NOT_RETRIEVED`, `NO_CURRENT_EVIDENCE`, conflict-preserved, and
  `NOT_ELIGIBLE` meanings remain explicit; no real regional calibration is
  inferred.
- Rights/freshness: `PUBLIC_SAFE` is retained only for the reused public
  reference shape; target-region source evidence is `UNKNOWN`/`NOT_RETRIEVED`
  unless a current source readback proves otherwise.
- Reality Gap/OOD: no synthetic zero or default is allowed. The product emits
  `NOT_PROVEN` with `null` metrics when the M5 evidence cannot compute a value.
- Decision: `REQUALIFICATION_REQUIRED` is a candidate decision, not a permit
  to use the model as official truth. The bounded transfer mode is
  `CANDIDATE_ONLY`; target source, rights, freshness, Reality Gap and OOD must
  be rechecked before any future formal consumer binding.
- Time basis: exact source observations and the M5 validation-as-of metadata;
  no new time-series or currency calculation is created.
- Writer/runtime: existing `RegionalTransferProductService` and its existing
  candidate persistence port; `JSON_INTERNAL_ONLY`; `formal_writer_mutations=0`.
- Product consumption: existing `REGIONAL_TRANSFER_PREVIEW_V1`,
  `REGIONAL_TRANSFER_VALIDATE_V1`, `REGIONAL_TRANSFER_STUDENT_PROJECTION_GET_V1`,
  and `REGIONAL_TRANSFER_ADMIN_AUDIT_GET_V1` paths. No new route or second
  runtime is added.

## File boundary and integration lease

The N1 worktree is separate from all open PR worktrees. This macro does not
touch the shared root integration files currently held by #471/#468/#474.

Allowed files:

- `packages/shared-contracts/src/regional-transfer.ts`
- `contracts/schemas/regional-transfer.v1.json`
- `services/api/src/regional-transfer-product-service.ts`
- `services/api/src/routes/regional-transfer-routes.ts` only if request/output
  validation needs a bounded existing-path update
- `apps/teacher/src/features/regional-transfer-workbench.tsx`
- `apps/teacher/src/features/regional-transfer-client.ts` only if the existing
  DTO type requires an update
- `apps/admin/src/features/regional-transfer-workbench.tsx`
- `apps/admin/src/features/regional-transfer-client.ts` only if the existing
  DTO type requires an update
- `apps/student/src/features/regional-transfer-projection.tsx`
- `apps/student/src/features/regional-transfer-client.ts` only if the existing
  DTO type requires an update
- `tests/unit/regional-transfer-product-service.test.ts`
- `tests/integration/regional-transfer-product-endpoint.test.ts`
- `tests/contract/regional-transfer-contract.test.ts`
- `tests/e2e-ui/regional-transfer-product-journey.spec.ts`
- `docs/technical/sh-next-support/m5-reality-qualification.md`
- this MJP

Forbidden files: `SettlementResult`, settlement, replay hash, canonical
Decision, official EnterpriseState, ParameterSet writer, Model Governance
writer, `services/api/src/server.ts`, `packages/shared-contracts/src/index.ts`,
all open PR files, database migrations, provider/API-key configuration,
external datasets/models, and unrelated workspace changes.

## Work packages

### WP0 — current reality, tombstone, and lease

Keep the current source/PR/policy receipts outside the product code. Reuse
RT-O1, M4, M5 and M6 rather than recreating their lifecycle, package resolver,
qualification support, persistence, or role projection authority.

### WP1 — contract and deterministic comparison

Add typed, schema-validated `RegionalTransferModelEvidence` and
`RegionalTransferRequalification` fields. The comparison must preserve exact
model identity, source identity, rights, freshness, Reality Gap, OOD, reason
codes, and no-write/replay exclusions. Every unknown or unavailable value is
explicit and stable.

### WP2 — product model State A -> State B

Build the comparison from the current exact ParameterSet model reference and
reused M5 source/qualification evidence. Use deterministic digesting, fail
closed on malformed floating identities, and return a bounded
`REQUALIFICATION_REQUIRED`/`CANDIDATE_ONLY` decision when target evidence is
not retrieved. Keep preview/validate/freeze/bind idempotency and immediate
exact-source revalidation intact.

### WP3 — existing MAIN consumer and role-safe BFF

Expose the new evidence through existing Regional Transfer DTOs and routes.
Teacher/Admin show the comparison and reasons. Student receives only target
region, bounded requalification status, and safe limits; provenance/source
digests, peer data, raw diagnostics, and governance internals remain hidden.

### WP4 — validation, recovery, and browser journey

Add contract, unit, integration, and real-BFF browser coverage for happy path,
unknown target source, stale/rights/OOD downgrade, floating identity,
cross-tenant/cross-course scope, source drift during bind, repeat bind, and
no-official-write/replay non-overwrite. Run Playwright and focused accessibility
checks for the changed journey; no Figma artifact is claimed unless a new
visual design is actually required.

### WP5 — review, H2/L5, PR, merge attempt, and archive

Freeze the MJP and full pack, perform independent review/repair, run H2 and one
exact-head L5, create one Product PR, and attempt ordinary merge under the
current policy. If the policy blocks ordinary merge, preserve the evidence as
`MERGE_BLOCKED_BY_REPOSITORY_POLICY`/`PLATFORM_CLOSURE_DEBT`; do not use admin,
auto, force, or branch-protection bypass. H3/L6 is conditional on a real
ordinary merge.

## Acceptance criteria

1. A valid exact RT-O1 candidate contains baseline and target evidence for
   region, exact model version, source/rights/freshness, Reality Gap and OOD.
2. The default synthetic/reference fixture explicitly reports missing target
   evidence and `REQUALIFICATION_REQUIRED`, never calibrated or official.
3. Exact model/package/source references reject floating selectors and digest
   drift before persistence or activation.
4. Teacher/Admin real BFF surfaces show the evidence and decision; Student's
   response contains no provenance digest, source revision, peer data, raw
   diagnostics, or official-truth fields.
5. Preview -> validate -> freeze -> candidate bind remains deterministic and
   idempotent; source changes fail closed at bind.
6. Tests prove `WANT != CAN != REALIZED`, no settlement/replay/score/rank
   mutation, role/tenant/course isolation, and schema parity.
7. Current required local gates and remote required checks are reported
   separately; no unrelated baseline failure is upgraded to a claim about N1.

## Rework rules

Any failing test, review finding, CI issue, or package mismatch is repaired in
this same N1 worktree and revalidated. No successor macro is created. If a
requested change would touch a forbidden/shared integration file, stop the
N1 implementation with `PRECONDITION_BLOCKED` rather than silently borrowing
an open PR's lease.
