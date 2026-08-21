# M2-P4 Live Course Operations / Round-to-Debrief

## Objective

Implement the V5.18 M2-P4 product macro on top of the existing Course/Run/Round,
RoleWorkflow, sole Settlement writer, visibility-only Publication, ProjectAware,
W4 lineage, and W3/P2-B Debrief authorities. The implementation must expose a
server-owned Teacher live-round projection and a Student-safe exact Project
context without introducing a second truth, settlement, round, publication,
enterprise-state, or debrief writer.

## Guardrails

- Work only in the isolated branch `codex/m2-p4-v518-live-round-ops-20260821`.
- Preserve the original shared workspace and all pre-existing changes.
- No provider/model activation, PostgreSQL runtime activation, W6, Pilot,
  Production, Human Validation, automatic successor, or direct protected-master
  mutation.
- Reuse existing repository ports, RoleWorkflow admission, settlement writer,
  W4 service, and W3/P2-B routes.
- New projections are read-only; frontend never infers formal permission or
  computes official results.
- New non-2xx behavior uses the existing `ApiErrorEnvelope` path and any
  contract changes stay synchronized with tests/OpenAPI.

## Execution steps

1. Add failing unit/integration coverage for the M2-P4 projection contract:
   exact Project/Role/Decision readiness for every Team, explicit round and
   settlement/publication task states, exact lock-batch receipt, unpublished
   Student result firewall, own-team Project context, cross-scope denial, and
   W3/P2-B handoff references.
2. Add shared-contract types and a pure server-side projection module that
   derives those read-only views from existing repository/service inputs.
3. Extend the existing Teacher BFF workspace to include the projection, using
   server `allowed_actions` and exact ProjectAware/RoleWorkflow snapshots; keep
   the existing Teacher preview and sole Settlement/Publication commands.
4. Extend the existing Student BFF cockpit with an exact, role-safe
   `ProjectProfileStudentBrief` context and explicit publication availability;
   preserve the pre-publication no-result/no-outcome-derived-learning firewall.
5. Update Teacher UI command gating and status surfaces to consume the server
   projection, not a frontend-derived decision/permission approximation; add
   only presentation-level status/readiness rendering.
6. Update the OpenAPI response schemas/receipts and add focused contract and
   authorization regression coverage without changing runtime authority.
7. Run the focused CELL tests first, then the required M2-P3/role/W3/W4/
   contract/security/browser gates and the bounded full-suite commands; record
   baseline fingerprints and all known limits in the durable M2-P4 evidence
   index.
8. Perform exact-head Product PR/review/merge only after required checks are
   green, run one fresh detached post-merge validation, create one docs-only
   Governance Closure, merge it exact-head, then perform final external
   readback and release the M2-P4 resource lock. Keep Human Validation,
   Pilot, Production, and automatic successor explicitly not performed.

## Acceptance mapping

- A05-A06: Teacher session command and full Team Monitor projection.
- A07-A11: existing canonical admission/sole Settlement path plus lock/settle
  receipts and idempotency tests.
- A12-A16: publication visibility firewall, Teacher preview, Student own-team
  projection, and tenant/team negative matrix.
- A17-A21: matched-arena identity/read-only W4 lineage/counterfactual firewall/
  existing W3/P2-B Debrief handoff.
- A22-A26: structured error/OpenAPI, authorization, direct-store boundary.
- A27-A30: exact-head Product/Governance lifecycle and final external readback.

## Verification commands

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm run test:contract`
- focused M2-P4 unit/integration tests
- relevant M2-P3, role-workflow, W3/P2-B, W4, and security tests
- dedicated M2-P4 real-BFF browser command with mocks disabled
- `npm test`, `npm run build`, `npm run check:hidden-unicode`, and
  `npm run check:direct-store-boundaries` where the current package scripts
  expose them
