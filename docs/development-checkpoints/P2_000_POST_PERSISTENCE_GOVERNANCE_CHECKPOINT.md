# P2-000 Post Persistence Governance Checkpoint

## 1. Verified Repository Baseline

| Item                       | Evidence                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| Verification date/time     | 2026-06-22T14:12:58.8192875+08:00                                                                |
| Branch                     | `codex/p2-000-post-persistence-governance-checkpoint`                                            |
| Worktree                   | `D:\codex\SimWar-p2-000-post-persistence-governance-checkpoint`                                  |
| origin/master              | `ec22782add00c8518033ab3e4a7b937d9ae17a86`                                                       |
| origin/master summary      | `ec22782 Merge pull request #155 from qidianzhiku/codex/p1-026-runtime-persist-cas-policy-audit` |
| Node.js                    | `v24.16.0`                                                                                       |
| npm                        | `11.13.0`                                                                                        |
| #138 state                 | `CLOSED`                                                                                         |
| #139 state                 | `CLOSED`                                                                                         |
| Main workspace observation | `D:\codex\SimWar` is dirty and behind `origin/master`; it was not modified by this checkpoint.   |

## 2. Completed Governance Lines

### #139 Migration / Recovery

| PR                                          | Merge commit                               | Capability summary                                                                                                |
| ------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| #144 - P1-015 Read-only snapshot inspection | `9be5f6eee13074a1ab4fd64d230da1511b33e629` | Added read-only JSON snapshot inspection for valid v1, legacy v0, invalid, corrupt, empty, and missing snapshots. |
| #145 - P1-016 Backup-before-write helper    | `1b65b4b5b722dec4690733627736f0d66ceb75c3` | Added explicit raw-byte backup-before-write helper.                                                               |
| #147 - P1-017 Migration dry-run planner     | `67ebc0721983c76a1d71ce8b7aff0cc3c531734e` | Added read-only migration planning with safe status output.                                                       |
| #148 - P1-018 Migration apply               | `f8b5070f1a4cd247fcc17fe078ad14a4bd2a84c9` | Added legacy v0 to current v1 migration apply with backup and crash-safe atomic write-back.                       |
| #149 - P1-019 Restore from backup           | `e43a75ba8931712444c73a7ee4511ce442119d90` | Added local restore-from-backup CLI and operator workflow.                                                        |

#139 is closed. Its closeout comment records local inspection, backup-before-write,
dry-run planning, migration apply, restore-from-backup, fail-closed behavior,
crash-safe atomic write-back, post-write validation, and quality gates.

### #138 CAS / Concurrency Governance

| PR                                                     | Merge commit                               | Capability summary                                                                                       |
| ------------------------------------------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| #150 - P1-022 No-CAS policy and characterization tests | `a9f2366dc01971e538f500d8b36fc2ed76948932` | Documented current no-CAS / no-lock runtime policy and added characterization tests.                     |
| #151 - P1-023 Write metadata helper                    | `ef0886dc9541b399882bc2c54364ddf8a4fc781a` | Added read-only raw file metadata helper with size, mtime, and SHA-256.                                  |
| #152 - P1-024 Explicit CAS-capable writer API          | `a46d637f5cb131782fed97012f914dfca3eb1812` | Added expected-current writer API and deterministic conflict error.                                      |
| #154 - P1-025 Apply / restore CAS wiring               | `7d9190a6baafc15f79e9ca3b2773200c9d6c361f` | Wired explicit CAS writer into migration apply and restore paths, including CLI conflict exit code `8`.  |
| #155 - P1-026 Runtime persist CAS policy audit         | `ec22782add00c8518033ab3e4a7b937d9ae17a86` | Audited runtime persist and documented that runtime persist remains intentionally no-CAS for this phase. |

#138 is closed. Its closeout comment records the completed local JSON snapshot
CAS governance boundary, runtime no-CAS policy, apply/restore CAS protection,
safe conflict output, and the explicit non-goals around locks and distributed
coordination.

## 3. Final Persistence Boundary

| Boundary                        | Final state                                                                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime persist                 | `createP1Store().persist` remains no-CAS / last successful atomic replace wins. It delegates to `persistSnapshotAtomically`.                    |
| Migration apply                 | CAS-protected through `persistSnapshotAtomicallyWithExpectedMetadata`; conflicts return `cas_conflict` and preserve newer target bytes.         |
| Restore from backup             | CAS-protected through `persistSnapshotAtomicallyWithExpectedMetadata`; conflicts return `cas_conflict` and preserve current/newer target bytes. |
| Inspection                      | Read-only. It does not write, migrate, restore, or create side files.                                                                           |
| Migration planner               | Read-only. It does not back up, write, or apply migration.                                                                                      |
| Backup helper                   | Explicit-only. It is called by migration apply, restore, and tests; it is not runtime automatic behavior.                                       |
| CLI CAS conflict                | Apply and restore map CAS conflict to exit code `8`.                                                                                            |
| Conflict output                 | Safe metadata only; no snapshot/entity/Decision payload or credentials.                                                                         |
| Lock / distributed coordination | Not implemented. This is an explicit non-goal for the closed #138/#139 line.                                                                    |
| Persisted snapshot format       | No mutation beyond the established current `snapshot_version: 1` write shape.                                                                   |
| Closed issues                   | #138 and #139 are closed.                                                                                                                       |

Future runtime CAS is not part of the closed line unless new product
requirements introduce a caller-facing expected-current contract for runtime
JSON writes.

## 4. Validation Snapshot

| Command                        | Result | Notes                                                                             |
| ------------------------------ | ------ | --------------------------------------------------------------------------------- |
| `npm ci`                       | PASS   | Installed declared dependencies; existing non-critical advisories remain.         |
| `npm run check:hidden-unicode` | PASS   | No hidden Unicode control characters found.                                       |
| `npm run format:check`         | PASS   | All matched files use Prettier style.                                             |
| `npm run lint`                 | PASS   | ESLint passed.                                                                    |
| `npm run typecheck`            | PASS   | TypeScript build references passed.                                               |
| `npm test`                     | PASS   | 25 files / 419 tests passed.                                                      |
| `npm run test:contract`        | PASS   | Contract baseline files and P0/P1 paths are present.                              |
| `npm run security:audit`       | PASS   | Passed at repository critical threshold; existing non-critical advisories remain. |
| `npm run build`                | PASS   | All workspaces built.                                                             |
| `npm run test:postgres-replay` | PASS   | Disposable PostgreSQL 16; 18 tests passed; container removed.                     |

Scripts confirmed absent and not run:

- `lint:boundaries`
- `check:unused`
- `test:coverage`
- `check:schemas`
- `check:migrations`

## 5. Risk Register

| Risk                                                                                               | Status                                                                    |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Local JSON persistence is not distributed coordination.                                            | Accepted and documented.                                                  |
| Runtime persist remains no-CAS by policy.                                                          | Accepted and covered by characterization tests.                           |
| Future product multi-process runtime writes may need a new issue/design.                           | Non-blocking follow-up if product requirements change.                    |
| PostgreSQL production adapter cutover remains separate.                                            | Separate persistence/runtime line; not part of #138/#139 closeout.        |
| Replay and settlement correctness remain separate truth-protection lines.                          | Separate Phase 2/3 and Replay governance work.                            |
| Backup retention, pruning, cloud restore, UI restore, and audit export remain future enhancements. | Post-#139 follow-ups, not blockers for the closed local tooling baseline. |

## 6. Do-Not-Reopen Boundaries

Do not restart these lines without a new product requirement or a real bug:

- P1-027 runtime CAS wiring;
- lock file, advisory lock, distributed lock, or stronger coordination as a continuation of #138;
- #139 migration/recovery reopen;
- persisted snapshot format mutation;
- duplicate inspection, backup, migration, apply, or restore tooling;
- Replay, settlement, simulation, Postgres, API/UI, or CI work under the old #138/#139 scope.

## 7. Next-Phase Options

| Candidate                                     | Value                                                                                               | Risk                                                                                                    | Readiness                                                                                      | Recommended?                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Student role-based access / decision workflow | Advances the product-facing Phase 2 decision loop and protects canonical Decision truth boundaries. | Medium; touches permissions, decision state, and settlement inputs.                                     | High; AGENTS.md lists role-based decision work as a current focus and architecture docs exist. | Yes, primary recommendation if the next goal is product workflow closure. |
| Postgres runtime adapter wiring               | Moves toward production persistence beyond local JSON.                                              | High; adapter cutover, transaction semantics, and parity gates must stay separate from JSON governance. | Medium; many Postgres adapter worktrees exist, but runtime opt-in remains guarded.             | Fallback if the next goal is persistence hardening for deployment.        |
| Teacher review dashboard / replay QA          | Improves teacher-facing review and replay confidence.                                               | Medium; UI and replay truth boundaries need careful separation.                                         | Medium; Replay docs and quality plans exist, but UI scope should be audited first.             | Not first unless review UX is the immediate product target.               |
| Scenario / settlement model hardening         | Protects simulation truth and Phase 3 quality.                                                      | High; settlement math and replay hashes are sensitive.                                                  | Medium; simulation-core and plugin docs exist, but scope must be narrow.                       | Good later Phase 3 candidate.                                             |
| CI quality gate tightening                    | Reduces regression risk before larger feature work.                                                 | Low to medium; may surface existing debt and slow PR flow.                                              | Medium; current package scripts exist, but several planned scripts remain absent.              | Fallback if the next goal is governance/tooling.                          |

## 8. Recommended Next Task

Primary recommendation:

```text
P2-001 - Student role-based access and decision workflow audit
```

Why first:

- Persistence governance is now closed, so the next highest-value path is the
  product decision workflow.
- AGENTS.md identifies Course, Team, Run, Round, Decision, simulation-core,
  settlement, contract, fixture, and Replay manifest as the current Phase 2/3
  closeout focus.
- Student role-based access and decision workflow is directly connected to
  canonical Decision protection, role drafts, team confirmation, and settlement
  truth boundaries.

Fallback recommendation:

```text
P2-001 - Postgres runtime adapter cutover readiness audit
```

Use this instead if the immediate business goal is persistence deployment
hardening rather than product workflow closure.

## 9. Final Conclusion

```text
PERSISTENCE GOVERNANCE CHECKPOINT READY
```
