# POST_MERGE_DETACHED_RECEIPT

Status: `PASS_WITH_LIMITS`

## Product merge readback

- Product PR: [#434](https://github.com/qidianzhiku/SimWar/pull/434)
- Product PR base at merge: `969bfd7457ea665946fe59a808694d31e2c815d0`
- Exact Product PR head before merge: `2ab9b0a0c1f117b9cf048885e77f6a07c88a118e`
- Product merge commit: `fbda560081e880bc4a3daf185d3c8e57092ea18a`
- Remote `master` readback through GitHub API and `git ls-remote`:
  `fbda560081e880bc4a3daf185d3c8e57092ea18a`
- Product PR state after merge: `MERGED`

## Fresh detached validation

- Worktree: `D:\\codex\\SimWar-m2-p4-v518-postmerge-20260821`
- Checkout: detached `fbda560081e880bc4a3daf185d3c8e57092ea18a`
- `npm ci`: `PASS`; the install reported the inherited `2 low / 7 high`
  dependency advisories and no dependency mutation was made.
- `npm run typecheck`: `PASS`
- `npm run lint`: `PASS`
- `npm run build`: `PASS` for shared-contracts, services, and all three apps.
- `npm run test:contract`: `PASS`, 29 files / 68 tests.
- `npm test`: local concurrent run recorded 243 passing files and 1 failing
  file (1468/1469 tests passed). The one failure was the existing
  shell-metacharacter snapshot CLI subprocess timing out with `status=null`
  under concurrent scheduling. The affected file was rerun serially with
  `--no-file-parallelism --maxWorkers=1`: 147/147 passed. The required remote
  `quality` check on exact Product head also passed.
- `npm run test:postgres-replay`: local execution was
  `BLOCKED_ENVIRONMENT`; `SIMWAR_TEST_DATABASE_URL` was absent and the Docker
  daemon was unavailable. The exact-head remote `quality` job ran the same
  gate with its PostgreSQL service and passed.
- `npm run test:e2e:ui:m2-p4`: default ports were
  `BLOCKED_ENVIRONMENT` because `127.0.0.1:3100` returned `EACCES`; no
  unrelated process was stopped. The same mocks=0, retries=0 journey was
  rerun on isolated ports 3200-3203 and passed 1/1 test with the complete
  teacher lock -> settle -> publish -> student isolation -> debrief handoff
  flow.

## Limits retained

This receipt is automated engineering evidence, not Human Validation. It does
not claim a full accessibility/WCAG pass, PostgreSQL application-runtime
activation, provider/model activation, W6, Pilot, Production, release
approval, or an automatic successor.
