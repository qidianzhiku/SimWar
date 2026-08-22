# SimWar M2-P4 live Course round operations governance closure

Date: 2026-08-21

Mission: `SIMWAR-SH-M2-P4-LIVE-ROUND-OPS-V5.18-20260821`

Target outcome: `TEACHER_LIVE_ROUND_OPERATIONS_AND_STUDENT_SAFE_PROJECT_RESULT_FLOW`

## Closure decision

`PASS_WITH_LIMITS` for the authorized M2-P4 live-round operations scope.

This is the single docs-only Governance Closure for Product PR #434. The
Product PR was merged only after its exact head passed the required GitHub
quality, browser-smoke, JavaScript/TypeScript analysis and CodeQL checks, all
review conversations were resolved, and the merge used the ordinary
non-admin, non-auto, non-force path.

This closure does not create a second Course, Run, Round, RoleWorkflow,
Settlement, Replay, Publication, EnterpriseState, ProjectProfile, provider,
model, or debrief authority. It records read-only projections over the
existing authorities and the bounded evidence that the merged tree preserves
those boundaries.

## Exact Product and source readback

- Product PR: [#434](https://github.com/qidianzhiku/SimWar/pull/434)
- Product PR base at merge: `969bfd7457ea665946fe59a808694d31e2c815d0`
- Product head before merge: `2ab9b0a0c1f117b9cf048885e77f6a07c88a118e`
- Product merge commit: `fbda560081e880bc4a3daf185d3c8e57092ea18a`
- Product merge tree: `2d7b092947e9757500a38452040602172fb75fa0`
- Fresh detached post-merge worktree:
  `D:\\codex\\SimWar-m2-p4-v518-postmerge-20260821`
- Fresh detached validation checkout:
  `fbda560081e880bc4a3daf185d3c8e57092ea18a`
- The exact Product merge and detached validation are recorded in
  `docs/evidence/m2p4-live-round-ops-v5.18/POST_MERGE_DETACHED_RECEIPT.md`.
- Governance PR #435 merge commit: `3c101e5c4a4ed431c0b20f88ffc8ee52bb723636`.
- GitHub `master` and `git ls-remote` matched that SHA at the final governance
  readback. The final readback receipt records the detached checkout and
  release event.

## Delivered Product scope

- Teacher receives a server-owned live-round projection scoped to the exact
  tenant, Course, Run, Round and Team set.
- Every participating Team exposes Project, Role and canonical Decision
  readiness, with explicit blocker state and source authority. The projection
  honors both the role-workflow admission policy and the legacy direct-decision
  policy without inferring permission in the frontend.
- Lock readiness is derived from the existing formal admission path and emits
  a stable lock-batch receipt. The existing sole Settlement writer remains the
  only settlement authority; the existing Publication path remains the only
  visibility writer.
- Teacher can see a safe `SETTLED` preview, but no result is exposed to a
  Student before governed publication.
- Student receives only the exact assigned ProjectProfile context and own-team
  result after publication. Cross-team access remains denied and no
  cross-team outcome or truth field is projected.
- Existing W4 lineage and W3/P2-B debrief handoff references remain reused;
  no new EnterpriseState, debrief or counterfactual writer is introduced.
- Contracts, shared types, service projections, UI presentation, focused
  tests and the dedicated real-BFF browser fixture were changed only in the
  Product PR scope documented by the evidence index.

## Authority and safety boundaries

The existing Course, Run, Round, RoleWorkflow, canonical Decision admission,
Settlement, Publication, ProjectLibrary, W4, Student BFF and W3/P2-B paths
remain authoritative for their respective domains. M2-P4 adds read-only DTO
projection and presentation-level status rendering only.

The following remain explicit non-claims and non-authorities:

- no provider or model activation;
- no PostgreSQL application-runtime activation, RLS activation, or migration
  rollout;
- no W6, Human Validation, teaching-effectiveness claim, Pilot, Production,
  release approval, or automatic successor;
- no full WCAG or accessibility PASS; known accessibility limits remain
  visible and are not waived by this closure;
- no change to settlement truth, Replay truth hashes, canonical/latest
  decision selection, or formal writer topology.

## Validation

### Product PR exact-head checks

At the final Product head `2ab9b0a0c1f117b9cf048885e77f6a07c88a118e`:

- `quality`: `SUCCESS`;
- `browser-smoke`: `SUCCESS`;
- `Analyze JavaScript and TypeScript`: `SUCCESS`;
- additional `CodeQL`: `SUCCESS`;
- all four review threads: resolved;
- PR state before merge: `OPEN`, non-Draft, `MERGEABLE`, `CLEAN`.

### Fresh detached validation

From detached `fbda560081e880bc4a3daf185d3c8e57092ea18a`:

- `npm ci`: `PASS`;
- `npm run typecheck`: `PASS`;
- `npm run lint`: `PASS`;
- `npm run build`: `PASS` for all workspaces;
- `npm run test:contract`: `PASS`, 29 files / 68 tests;
- full local `npm test`: 243 files passed and 1 file failed in concurrent
  scheduling, with 1468/1469 tests passed. The affected
  `store-snapshot-persistence` file was rerun serially and passed 147/147.
  This remains a local scheduling limitation, not a reclassified Product
  pass; the required remote quality job passed on the exact Product head;
- local `npm run test:postgres-replay`: `BLOCKED_ENVIRONMENT` because
  `SIMWAR_TEST_DATABASE_URL` was absent and the Docker daemon was unavailable.
  The exact-head remote quality job ran the PostgreSQL service-backed gate and
  passed. This closure does not activate PostgreSQL runtime authority;
- dedicated `@m2-p4-real` browser journey: `PASS`, 1/1 test, mocks=0,
  retries=0, isolated ports 3200-3203. The default 3100 attempt was recorded
  as an environment port EACCES and no unrelated process was stopped.

The complete receipt map is retained in
`docs/evidence/m2p4-live-round-ops-v5.18/M2P4_EVIDENCE_INDEX.md`.

## Known limits and evidence interpretation

- Automated browser evidence is not Human Validation and does not prove
  teaching effectiveness or human usability.
- The local PostgreSQL limitation is environmental; it is not evidence that
  PostgreSQL application runtime is active.
- `npm ci` reported 2 low and 7 high inherited dependency advisories; no
  dependency or lockfile change was made by this mission.
- The M2-P4 CodeGraph receipt records a current index and the Graphify receipt
  retains its partial-extraction limitation; neither tool is runtime
  authority.
- The closure status is `PASS_WITH_LIMITS`, not a full accessibility or
  release approval.

## Planning pointer and resource-lock release

The mutable planning pointers are reconciled to M2-P4, Product PR #434,
Governance PR #435 and Governance merge
`3c101e5c4a4ed431c0b20f88ffc8ee52bb723636`. The M2-P4 Product, Governance and
closure-lane locks were released after the successful normal Governance merge
and exact GitHub readback. No next candidate is started automatically; the
candidate backlog remains pending explicit owner direction.

Rollback is the normal reviewed revert of Product PR #434. This docs-only
Governance Closure does not mutate runtime Course, Run, Round, Settlement,
Replay, Publication, provider, deployment or Production state.
