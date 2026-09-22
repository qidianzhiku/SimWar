# Product Macro: GSI Student Handoff

## Goal

Make the existing Teacher GSI exact-pair comparison reachable from a normal Teacher debrief by exposing an explicit Student handoff link. The link carries only the existing exact context required by the Student app and remains role-safe, read-only, and non-causal.

## Scope

- Add a source-derived handoff URL from the ready Teacher comparison state.
- Bind the Student base URL through the existing Teacher app/runtime configuration.
- Prove the URL contract with a focused unit test and the real-BFF browser journey.
- Make the browser journey consume the generated Teacher link rather than reconstructing the URL independently.

## Explicit non-goals

- No new API/BFF route, service, repository, store, writer, registry, truth, settlement, replay, or RBAC authority.
- No change to canonical Decision, SettlementResult, replay hash, or role-safe Student projection semantics.
- No route mocking, response fulfillment, static JSON substitution, Figma mutation, or production adoption.

## Verification

- RED: focused unit test fails before the handoff link exists.
- GREEN: focused Teacher/Admin and Student unit tests pass.
- Real BFF integration tests pass.
- Typecheck, build, lint, hidden-Unicode, and direct-store-boundary checks pass.
- The focused Playwright journey passes with a real BFF and no route interception. The default 60-second CLI timeout is insufficient; a bounded 120-second diagnostic run completes the journey in approximately 40 seconds of test time.
- Full `npm test` is retained as a baseline comparison; unrelated pre-existing timeout/output-root failures remain disclosed.

## Acceptance

The current exact master must expose a visible Teacher link only after an exact comparison is ready. The link targets the configured Student app and contains exactly `course_id`, `run_id`, `team_id`, `activity_id`, and `role_key`; it does not contain candidate or comparison digest identifiers. The browser journey follows Teacher -> generated Student URL -> Student role-safe projection -> existing Admin read-only checks without changing formal authority.
