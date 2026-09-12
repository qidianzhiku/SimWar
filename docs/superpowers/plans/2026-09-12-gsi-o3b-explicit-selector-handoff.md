# Feature Plan

## Goal

Complete Macro-07 by making the existing GSI cross-round comparison consumer reachable from the normal Teacher debrief flow through an explicit, user-visible candidate-pair selection, and by providing a generated Student handoff link that carries the same exact context. Preserve the current PR #512 lineage and produce fresh evidence that distinguishes product reachability from direct URL or API setup.

## Architecture

- Keep the existing `/api/v1/bff/{teacher|student}/gsi/candidates/compare` BFF and shared cross-round projection contracts as the only comparison authority.
- Lift GSI candidate creation receipts from the existing Teacher producer into the Teacher app so the debrief selector can offer only candidates created in the current exact run/team scope.
- Extend the existing shared `GsiCrossRoundInsightPanel` with opt-in selector controls. No candidate, activity, or role is selected implicitly; the existing URL/prop selector path remains backward compatible for fixture and deep-link use.
- Generate a Student handoff link only after the Teacher submits an exact pair and context. The Student panel continues to fail closed without exact context and renders only the existing role-safe Student projection.
- Do not add a backend route, service, store, registry, writer, discovery API, product truth path, settlement/replay mutation, or Figma dependency.

## Tech Stack

- React and TypeScript in `apps/teacher`, `apps/student`, and `packages/ui`.
- Existing shared GSI contracts and API BFF.
- Vitest component tests and the existing single-worker Playwright GSI browser journey.
- Existing npm workspace scripts; no new dependency.

## Spec

1. Refresh the Macro-07 baseline identity against PR #512 and record the no-Local-Knowledge judgement before any task-scoped retrieval.
2. Add receipt propagation from the existing Teacher GSI producer and exact-scope candidate option derivation in the Teacher app.
3. Add explicit from-candidate, to-candidate, activity, and role controls to the Teacher debrief consumer with reserved-value/equal-pair validation and an explicit submit action.
4. Preserve the existing compare request, projection state classification, digest checks, and Student redaction. Add a generated Student handoff link that contains only the exact selectors needed by the existing Student consumer.
5. Add focused tests for no implicit selection, explicit compare submission, generated handoff, backward compatibility, and role-safe Student rendering.
6. Update the browser journey so setup may use authorized fixture APIs, but the acceptance path performs candidate creation/selection and Teacher-to-Student handoff through visible product UI actions rather than manually editing a URL.
7. Run focused tests, typecheck, build, and the relevant browser test; inspect the diff and PR checks; package fresh Macro-07 evidence with exact changed files, limits, and a hard-stop verdict.

## Global Constraints

- Fresh repository/runtime/GitHub evidence controls current claims; historical Macro-06/V2.9 artifacts are context only.
- Follow the repository `AGENTS.md` truth, role-safety, small-PR, and worktree rules. The current clean PR worktree is the only mutation scope.
- Do not modify settlement, replay truth, canonical decisions, provider/database state, or unrelated worktree changes.
- Do not infer latest/current/default/first/last/newest candidates. Missing exact context remains fail-closed.
- Student must not receive candidate IDs, digests, raw proposals, or privileged provenance identifiers in its rendered projection.
- No merge or force-push; a normal same-lineage push is allowed only if fresh validation passes. `AUTOMATIC_NEXT_START=false` and hard stop remain in force.
