# Program VNext Operating Model Adoption

## Goal

Adopt the evidence-supported Model B operating rules as a conditional governance carrier on the fresh protected-master epoch without changing SimWar product source, contracts, database, truth, settlement, replay, RBAC, or runtime authority.

## Scope

- Add a machine-readable program event-ledger schema and a deterministic validator.
- Add a focused unit test proving complete cycles pass and incomplete cycles fail.
- Add the package script that runs the validator against an explicit ledger path.
- Add the governance document defining one Product Authority, lane delivery clocks, integration windows, layered validation, and Program Controller limits.
- Extend `docs/planning/current-cycle.yaml` with a source-bound conditional-adoption record; preserve historical cycle facts.
- Run focused, repository, and relevant quality checks; inspect the diff before commit.
- Use a normal PR/review/check/merge path if the exact head remains authoritative.

## Non-goals and guardrails

- No product source, contract, database, branch protection, Figma, or external system mutation.
- No second Product Authority, truth store, writer, settlement authority, replay authority, RBAC authority, or runtime database.
- No automatic Product Macro or successor start; current Product Macro remains owner-direction blocked.
- Unknown process fields remain `null`; the validator must not convert missing evidence into zero or estimated values.

## Implementation order

1. Add the failing unit test for `validateProgramEventLedger`.
2. Run the focused test to record the RED result.
3. Add the validator and package script; rerun the focused test for GREEN.
4. Add the schema, governance rules, and current-cycle conditional-adoption record.
5. Run typecheck, lint, hidden-unicode, direct-store-boundary, full test, and build checks that are real in the current package.
6. Review `git diff` and `git status`; ensure only scoped files changed.
7. Commit with a conventional message and publish through the existing normal PR path only if fresh authority and checks permit it.
8. After merge, fresh-read master and rebind all diagnostic artifacts before making any final claim.

## Acceptance criteria

- Focused validator test has a recorded RED then GREEN result.
- Complete six-cycle diagnostic ledger validates without inventing unknowns.
- An incomplete/open cycle is rejected with an actionable error.
- Governance text explicitly removes global one-clock waiting edges where Model B replaces them and states the Program Controller is coordination/evidence only.
- Current-cycle record is bound to the exact source SHA and keeps automatic-next-start, Human Validation, Pilot, and Production false/not authorized.
- No product-authority or product-code change is present in the diff.
