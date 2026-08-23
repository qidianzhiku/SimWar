# M2-P5 Product exact-head validation receipt

Status: `PASS_WITH_LIMITS`

## Exact identity

- Product PR: [#442](https://github.com/qidianzhiku/SimWar/pull/442)
- Base branch: `master`
- Product base: `6a5e4fcc563706de2acab81945588fbe8869213f`
- Product head before merge: `e6134ce9a28d2546df514f4b2a728b2f524e1204`
- Product merge commit: `2fe9650ee7299cc5c506a75741bdeb97eda3e4b4`
- Product merge tree: `bbc0bb1d8fb8244219b3b03a0bd18d975a449d8d`
- Pre-merge PR state: `OPEN / NON_DRAFT / MERGEABLE / CLEAN`
- Merge method: ordinary merge; admin bypass, auto-merge and force push were
  not used.

## Required remote checks

All required checks completed successfully on the exact Product head:

- `quality`: `SUCCESS`;
- `browser-smoke`: `SUCCESS`;
- `Analyze JavaScript and TypeScript`: `SUCCESS`;
- additional CodeQL check: `SUCCESS`.

All four review threads were resolved before merge. The last CodeQL thread was
answered with the finding-specific explanation that the test sends only
deterministic digest/reference metadata to a local `127.0.0.1` server; it does
not send file contents, credentials or arbitrary paths to an external address.

## Product local evidence

- Targeted typecheck: `PASS`.
- Lint: `PASS`.
- M2-P5 focused unit/integration/browser-related checks: `PASS`.
- Contract gate: `PASS`, 33 files / 79 tests.
- Repository-wide local concurrent `npm test` was not promoted to a full pass
  because unrelated timeout-sensitive tests intermittently failed under the
  local harness; the affected focused tests were rerun successfully and the
  required remote `quality` job passed on this exact head.

This receipt is engineering evidence only. It is not Human Validation, a full
accessibility pass, release approval, Pilot or Production evidence.
