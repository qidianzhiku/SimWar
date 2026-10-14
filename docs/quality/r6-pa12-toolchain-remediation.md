# R6 PA12 toolchain remediation

Tracking: [#531](https://github.com/qidianzhiku/SimWar/issues/531), related to the
[audit tracker #120](https://github.com/qidianzhiku/SimWar/issues/120) and original
consumer [PR #528](https://github.com/qidianzhiku/SimWar/pull/528).

## Exact engineering scope

- Pin the application toolchain to official Vite **8.3.4**. Do not rebuild or
  hand-edit its generated bundle and do not migrate SimWar to pnpm.
- Override root/transitive `ws` to **8.22.0**. Updating that package alone is not a
  substitute for correcting Vite's separately bundled WebSocket implementation.
- Retain Chrome107, Edge107, Firefox104 and Safari16 application build targets:
  Vite8 otherwise raises the default targets. Keep existing role-app ports.
- Set the three role-app development/preview scripts and development config to
  loopback explicitly. Previously those scripts supplied `--host 0.0.0.0`, which
  overrides config defaults. LAN exposure now requires an explicit separate
  invocation and must not be mistaken for the validated default.

The locked Windows native path uses Rolldown **1.2.13** and its matching
`@rolldown/binding-win32-x64-msvc` package, plus Lightning CSS **1.33.0** and its
matching platform package. Do not reuse the earlier 1.2.12 admission as proof of
the 1.2.13 bytes. Other operating systems have different optional bindings and
need their own install/CI evidence.

## Installation, trust and execution

The task installation uses `npm ci --ignore-scripts` with task-owned npm
user/global config and cache. No native source build or package lifecycle is
needed for the admitted prebuilt Windows libraries. This is task file/config
separation, **not** an OS sandbox or network/filesystem enforcement claim.

Admission records official registry metadata, SHA512 SRI, safe archive members,
license text, loader-to-platform-package relationships and actual installed
member SHA256s. Registry ECDSA verification uses the public key obtained from
the official registry over HTTPS; it is not independent publisher identity,
SLSA verification, transparency-log verification or reproducible-build proof.
No cosign execution is implied.

Controlled runtime clears native/WASI/library-path overrides and enforces the
generated loader's package-version check. WS optional native acceleration is
disabled for the task checks. A missing or mismatched native binding must not be
repaired by silently enabling an unreviewed download/build fallback.

## Validation and limits

The compatibility test resolves the actual three Vite configurations. It first
failed on Vite8's raised browser targets, then passed with the explicit retained
targets. Existing focused GSI tests protect the consumer behavior. Typecheck,
production builds, full tests, bounded static-browser smoke, CI and independent
review are separate evidence categories; a test not actually run is not PASS.

The Oxc compatibility pass also removes one duplicate type-only import from the
M4 test, retaining its repository-port type source. No M4 behavior is changed.
Local fixture validation uses a task-owned process-scoped TEMP/TMP directory
and an explicit 15-second per-test ceiling, preserving every assertion. The
initial full run and subsequent diagnostic failures remain in the audit logs;
they are not silently relabeled as baseline passes.

Builds may report pre-existing `__dirname` future-config-loader warnings and
ineffective dynamic-import chunk-splitting warnings. These are recorded, not
suppressed or presented as native-loader failure.

This is partial PA12 engineering remediation. It does not recreate the missing
085732Z archive/sidecars, establish historical listener/NTLM/SMB/browser controls,
close every inherited advisory, sign PA12/PA13, prove WCAG runtime conformance,
or authorize Pilot/Production. Historical FE/MAIN/G13 decisions are not
automatically transferred to the repair consumer.

## Rollback

Revert the dedicated repair commit through the protected PR workflow to restore
the former toolchain/configuration. No database, settlement, canonical Decision,
Replay truth, tenant authorization or API contract changes are included. Such a
revert also restores the previous known toolchain risks; it is not risk acceptance.
