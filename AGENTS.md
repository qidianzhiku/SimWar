# SimWar Development Guardrails for Codex

## Project Context

- SimWar is a SaaS and AI business simulation platform for executive training.
- The project uses incremental small PRs to migrate repository persistence toward Postgres while keeping the JSON adapter as the default runtime.
- Settlement, replay, and decision truth-chain behavior are safety-critical.

## Required Workflow

- One task equals one small PR.
- Start every task from the latest origin/master.
- Use an independent branch and worktree for every PR.
- Do not develop inside a dirty main workspace.
- Do not reuse old feature worktrees or branches after merge.
- Do not use git add -A.
- Stage only the explicitly allowed files for the current PR.
- Keep each PR narrowly scoped.
- Include Summary, Validation, and Scope Notes in every PR body.
- If gh CLI is unavailable, push the branch and provide the GitHub PR creation link.

## Worktree Baseline Commands

Use these commands at the start of each task:

- git fetch origin --prune
- git log --oneline -10 origin/master
- git worktree list
- git worktree add [WORKTREE_PATH] origin/master -b [BRANCH_NAME]
- cd [WORKTREE_PATH]
- git status
- git branch --show-current
- git log --oneline -5 HEAD
- git diff --name-only

## Standard Validation Commands

Run these before completing a PR unless the task explicitly says otherwise:

- npm run format:check
- npm run security:audit
- npm run typecheck
- npm test
- npm run test:contract
- npm run build
- git diff --check
- npm run lint

For migration or schema PRs, also run:

- npm run check:migrations
- npm run test:migration:apply

For targeted tests, prefer:

- npx vitest run [TEST_FILE]

For changed files, run:

- npx prettier --check [CHANGED_FILES]

If a script does not exist or SQL Prettier is unsupported, do not add dependencies or scripts. Report it as unavailable or unsupported.

## Postgres Migration Rules

- JSON adapter remains the default runtime until an explicit opt-in provider wiring PR.
- Do not connect Postgres runtime unless the task explicitly allows it.
- Do not read DATABASE_URL unless the task explicitly allows runtime wiring.
- Do not add pg or any new database dependency unless explicitly requested.
- Implement repository migration in this order: audit, docs/spec, schema, read mapping, write mapping, parity tests, disposable DB verification, opt-in runtime wiring.
- Never skip parity tests for truth-chain-sensitive paths.

## Repository Parity Rules

When implementing Postgres mappings, preserve JSON adapter behavior:

- Missing get returns null.
- Missing list returns [].
- Tenant boundaries must be explicit.
- Upsert identity must match JSON adapter behavior.
- Ordering must be deterministic and documented.
- Full contract objects must be preserved unless a separate spec says otherwise.
- Optional fields must be cleared with null on write when absent, not accidentally retained.
- Do not silently change canonical/latest selection behavior.

## Settlement and Replay Truth Chain Red Lines

Do not change:

- settlement logic
- settlement result shape
- replay_hash generation
- buildReplayHash inputs
- canonical/latest decision selection
- replay idempotency behavior
- round settled marker behavior
- API route contracts
- response body shape
- response status codes

Never allow these into settlement truth inputs unless a dedicated architecture PR explicitly changes the model:

- role drafts
- AI advice
- learning evidence
- prompt output
- analytics-only data

## Decision Rules

- Decision mapping is truth-chain-sensitive.
- Decision writes must preserve decision_id, tenant_id, run_id, round_id, round_no, team_id, status, version, payload, validation_report, submitted_by, and optional canonical fields.
- Decision upsert identity is tenant_id + decision_id.
- Do not treat decision_id as globally unique.
- Do not unify repository canonical lookup with settlement latest-version selection unless a dedicated parity PR changes that behavior.

## Settlement Result Rules

- Settlement results are truth-chain-sensitive.
- replay_hash must be preserved, not recalculated inside persistence mapping.
- team_results must be preserved according to the documented persistence layout.
- Settlement result upsert identity must match JSON adapter behavior.
- Do not implement settlement/replay mapping until schema/layout docs and guardrail tests exist.

## AI and Role Draft Boundaries

- AI advice may assist users but must not automatically submit decisions.
- AI advice must not enter settlement truth.
- Role drafts must not enter settlement truth.
- Only approved team decisions and canonical settlement inputs can affect settlement.

## Low Token Codex Mode

Prefer short task cards with:

- Task
- Allowed files
- Forbidden files
- First step
- Validation
- Output

Do not perform broad repository searches unless the target files are unknown.

Prefer this flow:

- read exact files first
- output a short plan
- wait for confirmation before editing high-risk areas

Use /compact after long tasks and /new after each merged PR when continuing in Codex.

## PR Body Template

Every PR body should include:

Summary

- Describe what changed.

Validation

- npm run format:check
- npm run security:audit
- npm run typecheck
- npm test
- npm run test:contract
- npm run build
- git diff --check
- npm run lint

Scope Notes

- Changed only the intended files.
- Did not modify unrelated application code.
- Did not connect Postgres runtime or read DATABASE_URL.
- Did not modify settlement logic, replay_hash, buildReplayHash inputs, settlement result shape, or canonical/latest decision selection.
- Did not allow role drafts, AI advice, or learning evidence to enter settlement truth.

## Stop Conditions

Stop and report instead of guessing when:

- required schema fields are missing
- JSONB layout is unspecified
- parity behavior is unclear
- typecheck reveals contract mismatch
- tests require production behavior changes outside the PR scope
- worktree is dirty before starting
- origin/master does not contain the required previous PR
- validation fails for reasons unrelated to the current PR
