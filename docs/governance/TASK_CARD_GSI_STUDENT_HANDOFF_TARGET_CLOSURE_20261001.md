# Task Card — GSI Student Handoff Target Closure

task_id: GSI-STUDENT-HANDOFF-TARGET-CLOSURE-20261001
task_title: GSI Student Handoff landing fragment, accessible focus, and scoped regression
task_type: implementation
risk_tier: T3

current_active_authority:
- JSON_INTERNAL_ONLY remains the runtime authority.
- Existing GSI exact context and existing role-safe BFF projections remain authoritative read sources.
- No Truth, Settlement, Replay, RBAC, repository-provider, or service authority changes are authorized.

target_durable_authority:
- unchanged

transition_authority:
- none

human_acceptance_artifact:
- docs/governance/owner-decisions/OWNER_TARGET_AUTHORIZATION_GSI_STUDENT_HANDOFF_20261001.json

triggered_omd:
- none currently identified; stop if fresh technical admission proves otherwise.

allowed_scope:
- apps/teacher/src/GovernedStakeholderIntelligenceWorkspace.tsx
- apps/student/src/GovernedStakeholderIntelligenceProjection.tsx
- tests/unit/gsi-xr-teacher-admin-experience.test.tsx
- tests/unit/gsi-xr-student-experience.test.tsx
- tests/e2e-ui/gsi-stakeholder-shadow-plane.spec.ts

forbidden_scope:
- packages/ui/**
- apps/student/src/styles.css
- apps/teacher/src/styles.css
- GSI BFF/service/contracts
- Truth/Settlement/Score/Rank
- Replay authority
- RBAC/tenant authority
- repository provider
- database/provider activation
- modifying or merging PR #516
- any Product mutation before technical admission

touched_domains:
- Teacher product UI
- Student product UI
- GSI role-safe projection
- browser-visible handoff/reflection journey
- scoped regression tests

active_routes:
- Existing GSI Student BFF read routes only; no route creation or mutation.

read_path:
Teacher GSI exact-pair ready state
→ existing generated Student handoff URL
→ Student App existing query-context parser
→ existing Student role-safe GSI BFF projection
→ Student cross-round reflection.

write_path:
- No formal Product write path is introduced.
- Mutation is limited to UI landing/focus behavior and tests after technical admission.

tenant_role_membership_guard:
- unchanged; existing role-safe BFF and tenant/course/team guards remain authoritative.
- no client-controlled authority expansion.

idempotency_behavior:
- unchanged; target is read/navigation/focus behavior only.

audit_behavior:
- unchanged; no audit writer added.

contract_delta:
- none.

required_gate_matrix_rows:
- `docs/governance/gate-command-matrix.md` Frontend / Browser Smoke.
- T3 Graph Gate and serial closure rules from `docs/governance/CODEX_TARGET_MODE_AUTHORITY_MATRIX.md`.
- Auth/Tenant/Membership negative coverage only if fresh diff reaches those guards.

required_commands:
- `npx vitest run tests/unit/gsi-xr-teacher-admin-experience.test.tsx tests/unit/gsi-xr-student-experience.test.tsx`
- `npx playwright test tests/e2e-ui/gsi-stakeholder-shadow-plane.spec.ts --config playwright.config.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run check:hidden-unicode`
- `npm run check:direct-store-boundaries`
- `npm test`
- GitHub required checks: `quality`, `browser-smoke`, `Analyze JavaScript and TypeScript`

fallback_evidence:
- If local Playwright is unavailable, CI browser-smoke may provide browser evidence, but the limitation must remain explicit.
- No source-only fallback is allowed for formal Graph Gate admission.

issue_111_delta:
- Current GitHub readback: OPEN.
- This target does not modify settlement idempotency/concurrency and does not close or advance #111.

issue_114_delta:
- Current GitHub readback: CLOSED.
- This target does not reopen or modify the direct-store closeout boundary.

issue_115_delta:
- Current GitHub readback: CLOSED.
- This target does not reopen or modify the contract-parity closeout boundary.

implementation_pr_issue_reference_policy:
- No `Relates to #111`, `Relates to #114`, or `Relates to #115` line is required for the implementation PR under the current five-file UI/test scope because those issue domains are not touched.
- The implementation PR must not use closing keywords for #111/#114/#115.
- If technical admission or the actual diff makes this target materially related to any of those issue domains, stop/replan and add the appropriate `Relates to #<issue>` reference before implementation continues.

postgres_gate_lift:
- none

main_worktree_protected:
- true; do not develop in the protected main worktree.

single_writer:
- Codex/CodexPro MAINLINE target executor owns only the exact five allowlisted files after technical admission.

PR_516_join_policy:
- Conditional parallel implementation is allowed because current PR #516 has no direct overlap with the five-file allowlist.
- Closure/merge is serial.
- If PR #516 merges first, re-read master/overlap and affected UI regression before this target enters closure.
- If this target merges first, PR #516 must rebind to the new master before closure.
- This task does not authorize modification or merge of PR #516.

known_limits:
- Historical local graph writer used an undefined-undefined repository key.
- Old daemon.log / daemon.pid changed without attribution.
- CLI graph success does not prove MCP success or formal Graph Gate admission.

stop_conditions:
- technical admission is incomplete
- formal Graph Gate is NOT_PROVEN
- protected master moves after the one-time PR #522 authorization-carrier merge exemption
- PR #516 expands into any allowlisted file
- an unapproved path becomes necessary
- Product/service/contract/authority scope must expand
- a T4 boundary is triggered

expected_final_status:
- TARGET_AUTHORIZATION_ACTIVE__READY_FOR_BOUNDED_IMPLEMENTATION after technical admission
- or DESIGN_GATE_BLOCKED / REPLAN_REQUIRED if any stop condition holds

next_allowed_task:
- Perform technical admission and, only if it passes, implement the approved five-file target.

automatic_next_start:
- false


authorization_carrier_merge_rule:
- PR #522 is the one-time repository authorization carrier and its ordinary governance-only merge does not expire this target.
- After PR #522 merges, technical admission must fresh-read the actual master SHA/tree and confirm that the carrier diff remained governance/planning-only and that no Product source drift occurred outside the three carrier files.
- Any later protected-master merge triggers the registered revalidation policy before closure or further mutation.
