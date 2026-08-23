# M2-P5 post-merge detached receipt

Status: `PASS_WITH_LIMITS`

## Product merge readback

- Product PR: [#442](https://github.com/qidianzhiku/SimWar/pull/442)
- Product PR state after merge: `MERGED`
- Product merge commit: `2fe9650ee7299cc5c506a75741bdeb97eda3e4b4`
- Detached checkout: `2fe9650ee7299cc5c506a75741bdeb97eda3e4b4`
- `origin/master` readback after Product merge:
  `2fe9650ee7299cc5c506a75741bdeb97eda3e4b4`
- Fresh detached worktree:
  `D:\codex\SimWar-m2p5-post-merge-20260823`

## Detached validation

- `npm ci`: `PASS`; npm reported inherited 2 low / 7 high advisories and no
  dependency or lockfile mutation was made.
- `npm run test:contract`: `PASS`, 33 files / 79 tests.
- Build prerequisites and UI build invoked by the browser command: `PASS`.
- Real-BFF M2-P5 browser journey: `PASS`, 1/1 test, mocks=0, retries=0.
- Browser validation used isolated ports 3320-3323 and an external temporary
  JSON store path.
- The initial default-port attempt was `ENV BLOCKED` because
  `127.0.0.1:3100` returned `EACCES`; no unrelated process was stopped. The
  same command passed after the port/store isolation was supplied.

The browser run is automated engineering evidence only. It does not claim
Human Validation, teaching effectiveness, full WCAG/accessibility acceptance,
PostgreSQL application-runtime activation, provider/model activation, Pilot,
Production or release approval.
