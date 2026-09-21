# Exact-context Cross-capability Debrief Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one read-only, exact-context Decision Digital Thread Evidence Spine that composes the existing M2P6, Model Qualification, Strategic Portfolio, Industry Model, and GSI projections for Teacher, Student, and Admin without creating a second authority or persistence path.

**Architecture:** Keep the existing Decision Learning Role BFF/Application-Service family as the consumer seam. Add a thin derived composition contract and service that validates the trusted tenant/role/context, calls existing canonical readers, maps each source to explicit availability/limit states, and emits role-specific projections. Add one GET route under the existing BFF family, then render a single shared role-safe UI component from the existing debrief/audit surfaces. No source algorithm, official outcome, settlement state, or persistence record is recomputed or written.

**Tech Stack:** TypeScript, Node.js native HTTP server, npm workspaces, shared-contracts, OpenAPI, Vitest, existing Vite React apps, existing `@simwar/ui` patterns, synthetic in-memory fixtures for tests.

**Spec:** The execution package `DELIVERY_MAIN_MAIN-DDT-O1-EXACT-CONTEXT-CROSS-CAPABILITY-DEBRIEF-SPINE_20260912.zip` is treated as task constraints and historical evidence. Fresh repository, GitHub, contract, test, and runtime reads remain authoritative. The exact DDT Figma target is page `280:2` / root `280:3`, with role frames `280:11`, `280:15`, and `280:19`; the P2-B page `39:2` is reference-only. The current product macro has one Product PR and one RED integrator.

## Global Constraints

- Preserve one Kernel, Truth Engine, Settlement Authority, Enterprise State Authority, Writer, Store, Registry, comparator, and route family.
- The spine is read-only and has formal-write count `0`; it cannot recompute official Outcome, settle, score, rank, select a model, or activate Provider.
- Validate exact `tenant_id`, `course_id`, `run_id`, `team_id`, `round_id`, `round_no`, `role_key`, and `activity_id` from the trusted server-side context. Never infer `latest`, `current`, `default`, `first`, `last`, `newest`, array position, or cache order.
- Student responses must contain only allowlisted evidence summaries and safe context; omit candidate IDs/digests, admin provenance, hidden/unpublished records, model-call IDs, signal keys, raw proposals, and private judgment text.
- Preserve `AVAILABLE`, `LIMITED`, `CONTEXT_UNAVAILABLE`, `REBASE_REQUIRED`, and `STALE` distinctly. Missing data is not zero, and diagnostic/counterfactual/advisory evidence is not official outcome.
- Use focused RED tests before semantic implementation and run validation in targeted-first order. Do not weaken checks or use skip/xfail/continue-on-error/timeout inflation.
- Keep foreign worktrees/processes untouched. Use only the dedicated DDT worktree and mission-owned temporary fixtures/resources.

---

## Task 1: Freeze the shared DDT contract and exports

**Files:**

- Create `packages/shared-contracts/src/decision-thread-evidence-spine.ts`.
- Modify `packages/shared-contracts/src/index.ts`.
- Create `tests/unit/decision-thread-evidence-spine-contract.test.ts`.

- [ ] Read the exact current M2P6, Model Qualification, W4/Strategic Portfolio, Industry Model, and GSI types again and document their source/status mapping in the new contract.
- [ ] Define a versioned request context with all required exact identifiers and optional explicit GSI `from_round_id` / `to_round_id` selectors.
- [ ] Define source names `M2P6`, `MODEL_QUALIFICATION`, `STRATEGIC_PORTFOLIO`, `INDUSTRY_MODEL`, and `GSI`, with `AVAILABLE`, `LIMITED`, `CONTEXT_UNAVAILABLE`, `REBASE_REQUIRED`, and `STALE` status values and explicit ledger labels `OFFICIAL`, `DIAGNOSTIC`, `COUNTERFACTUAL`, and `ADVISORY`.
- [ ] Define Teacher/Admin envelopes that may include bounded provenance and a Student envelope that has no privileged provenance or identifier fields.
- [ ] Put `provider: "OFF"`, `non_causal: true`, `causal_proof: false`, and `official_truth_write: false` on the envelope contract.
- [ ] Export the contract from the shared-contract index without changing existing contract shapes.
- [ ] Write RED assertions for version, exact-context requirements, role-specific omission of privileged fields, source-status preservation, and the no-write/no-causality markers.
- [ ] Run the focused contract test and record its command, exit code, and exact head.

## Task 2: Implement the thin read-only composition service

**Files:**

- Create `services/api/src/decision-thread-evidence-spine.ts`.
- Create `tests/unit/decision-thread-evidence-spine-service.test.ts`.

- [ ] Define dependency ports for the existing M2P6 journey service, GSI pair-options/compare service, Model Qualification service, W4 enterprise-state projection, and Industry Model read-only projection.
- [ ] Validate trusted actor role, tenant, team, activity, run, round, and exact role before any source lookup; reject wrong tenant/team/role with the existing fail-closed error semantics.
- [ ] Compose each canonical source independently so one unavailable source does not fabricate zero or suppress other legal evidence.
- [ ] Use the existing role-safe projection methods and preserve their publication, active-role, selected-tenant, and known-limit semantics. Do not copy candidate algorithms into the spine.
- [ ] Require explicit GSI round selection; use the existing server-governed pair-options/round-pair resolver when present and route its result through the existing comparator/projection. With no selection, return `CONTEXT_UNAVAILABLE` for GSI and an actionable recovery message instead of choosing a default pair.
- [ ] Keep source ledger distinctions and exact-context bindings in the Teacher/Admin projections, while applying an explicit Student allowlist before serialization.
- [ ] Map stale/digest mismatch to `REBASE_REQUIRED` or `STALE`, not generic error; preserve `non_causal` and `causal_proof` values from the GSI boundary.
- [ ] Ensure the service performs no append/create/write call. Add a spy assertion proving all dependencies are read-only.
- [ ] Add RED tests for exact-context composition, wrong tenant/team/role, hidden/unpublished student evidence, partial availability, stale/rebase, no pair, explicit non-causal wording, and no write authority.
- [ ] Run the focused service test and record its command, exit code, and exact head.

## Task 3: Add the existing-family BFF route and OpenAPI contract

**Files:**

- Create `services/api/src/routes/decision-thread-evidence-spine-routes.ts`.
- Modify `services/api/src/server.ts`.
- Modify `contracts/openapi/p0-api.openapi.yaml`.
- Create `tests/contract/decision-thread-evidence-spine-openapi.test.ts`.
- Create `tests/integration/decision-thread-evidence-spine-route.test.ts`.

- [ ] Freeze the route as a read-only GET under `/api/v1/bff/{teacher|student|admin}/decision-thread/evidence-spine` using the existing trusted auth/context pipeline.
- [ ] Require the exact context query fields consistently with current route conventions; never accept a client-supplied tenant as an authority override.
- [ ] Make optional GSI selectors explicit and mutually complete; reject partial pairs rather than defaulting.
- [ ] Wire the route to the one composition service and existing role surface; do not introduce a second BFF, route family, Writer, Store, Registry, or direct JSON-store read.
- [ ] Add versioned role-specific response schemas to the canonical OpenAPI document and assert runtime-required parameters match OpenAPI requiredness.
- [ ] Preserve existing routes and response envelopes; add only the new derived composition surface.
- [ ] Add integration tests using memory/synthetic fixtures for Teacher/Student/Admin success, wrong tenant/team/role, unavailable source, rebase/stale, and Student serialization privacy. Assert route mocks are zero and writes are zero.
- [ ] Run focused contract/integration tests and record exact command, exit code, and head.

## Task 4: Reuse the exact DDT Figma target and implement the role-safe UI

**Files:**

- Create `packages/ui/src/components/DecisionThreadEvidenceSpine.tsx`.
- Create `packages/ui/src/components/decision-thread-evidence-spine.css`.
- Modify `packages/ui/src/index.ts`.
- Modify the existing Teacher debrief surface (`apps/teacher/src/P2BTeacherDebriefWorkspace.tsx` or the exact current owner after source readback).
- Modify the existing Student learning surface (`apps/student/src/P2BDecisionLearningJourney.tsx` or the exact current owner after source readback).
- Modify the existing Admin audit surface (`apps/admin/src/GovernedStakeholderIntelligenceAuditPanel.tsx` or the exact current owner after source readback).
- Add focused UI tests under the exact existing app test locations.

- [ ] Complete Figma Gate 1 rebind against page `280:2` / root `280:3` and the exact role/state nodes before changing UI semantics; keep page `39:2` and page `175:2` reference-only.
- [ ] Build one shared component with role-specific rendering, using existing Design System tokens and portal patterns rather than a new design system.
- [ ] Implement state transitions `IDLE`, `LOADING`, `READY`, `CONTEXT_UNAVAILABLE`, `STALE`, `REBASE_REQUIRED`, `PERMISSION_DENIED`, `ERROR`, and `RECOVERED` with customer-language recovery actions.
- [ ] Bind requests to a generation key containing principal/token/context/role/pair; clear old success/error state on context changes and ignore or abort late responses.
- [ ] Teacher view: task-first evidence rail with exact context, source status, bounded evidence, known limits, and recovery; technical refs remain inspector-only.
- [ ] Student view: allowlisted evidence timeline and reflection/transfer prompt only; no candidate IDs/digests, admin provenance, unpublished detail, private judgment, or causal language in DOM, storage, or logs.
- [ ] Admin view: selected-tenant audit evidence with source status/provenance/limits and no formal mutation CTA.
- [ ] Add keyboard/focus, semantic landmarks, non-color state text, reduced-motion-safe transitions, and responsive layout at the bound 1440/1280/1024/390 checkpoints without claiming full WCAG or human validation.
- [ ] Run focused UI tests/build checks and record exact command, exit code, and head.

## Task 5: Integrate, validate, and perform independent H2

**Files:**

- Modify only exact shared/App-root/integration files proven necessary by Tasks 1–4.
- Create `docs/evidence/ddt-o1/` receipts outside the product runtime but inside the repository only if the current macro’s evidence convention requires tracked evidence; otherwise write evidence to an external mission directory.

- [ ] RED-review every contribution for exact source SHA, owned paths, authority lineage, contract assumptions, and no-write behavior; choose `REPLAY`, `MANUAL_PORT`, or `REJECT_REWORK` explicitly for any prior work.
- [ ] Run targeted unit/contract tests, affected integration tests, tenant/role/privacy/no-write tests, and real-BFF/browser journeys with `route_mocks=0` using synthetic isolated fixtures.
- [ ] Verify the complete Teacher → Student → Admin exact-context evidence spine and recovery matrix, including one-source unavailable, limited, stale/rebase, re-auth, and late-response cases.
- [ ] Perform Pre-H2 review covering source ledger separation, Student allowlist, exact context, no second authority, Figma Gate 1/2 status, and no official outcome mutation.
- [ ] Freeze one exact candidate head and produce an H2 input pack. Use a separately named independent reviewer/worker that did not implement the final candidate; do not self-sign H2 and do not treat CodeQL/CI as H2.
- [ ] If H2 finds a material defect, keep it in this Macro and consume only the available rework budget; do not create a review-fix successor.

## Task 6: Figma Gate 2/3, final L5, one Product PR, and Atomic Closure

**Files:**

- No additional product files unless a fresh gate proves a directly scoped defect.
- External mission evidence pack for final receipts and handoff.

- [ ] Rebind implementation states/actions to exact Figma nodes for Gate 2.
- [ ] Capture real-BFF/browser evidence at applicable responsive widths and perform Gate 3 visual/semantic reconciliation, recording accepted deltas and known clipping/visual limits without claiming full parity.
- [ ] Freeze one final semantic head and run L5 once on that exact head: focused/affected tests, tenant/role/security/no-write, real BFF/browser, typecheck, lint, build, hidden-unicode, direct-store guard, and applicable contract checks.
- [ ] Re-read GitHub branch rules, required checks, reviews, and same-seam PRs on the exact head. Create exactly one DDT-O1 Product PR targeting fresh master; do not merge support PRs.
- [ ] Resolve material review findings on the exact final head. Any mutation after L5 invalidates H2/G3/remote freshness and requires re-evaluation.
- [ ] Ordinary non-force merge only after State B, H2, G3, L5, all required checks, and review closure pass.
- [ ] Read back exact merge SHA/tree, run detached clean L6/H3, record Capability Tombstone and Canonical Seam closure, produce Handoff, clean only mission-owned resources, verify `cleanup_residue=0`, and release the Product Clock.
- [ ] Package and independently verify the final result ZIP; record all missing metrics as `NOT_RECORDED`, and stop without starting N+1.

## Verification Commands

- [ ] `npm run typecheck`
- [ ] `npm test -- --runInBand` only if the current package scripts support this exact flag; otherwise use the repository’s real focused Vitest invocation.
- [ ] `npm run test:contract`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run check:hidden-unicode`

## Explicit Non-Proofs

- Automated browser evidence is not Human Validation.
- Focused accessibility evidence is not full WCAG certification.
- JSON/internal runtime evidence is not durable PostgreSQL/RLS production proof.
- Qualification, diagnostic, counterfactual, advisory, or stakeholder movement is not official Outcome or causal effect.
- A green local check, H2 receipt, or merged PR is not Product Complete until the full Atomic Closure chain is proven.
