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

## Bundle regression repair

The root `@simwar/ui` runtime barrel was shared by eager shell components and
already-lazy workspaces. Under Rolldown this promoted heavy workspace UI into
the eager static closure. Role-app runtime imports now use stable public
`components/*` and `workbenches/*` subpaths pointing to the same existing files.
The root barrel and type-only imports remain compatible. No component behavior,
lazy declaration, manual chunk rule, minifier, browser target or CSS timing is
changed. No broad `sideEffects: false` claim is introduced.

The existing entry-only raw/gzip baseline and 10% cap are unchanged. The new
real-build regression additionally starts from emitted HTML, follows static and
dynamic dependencies plus CSS, accounts for shared chunks and rejects orphan
runtime outputs. Vite-elided empty CSS-only JS placeholders are resolved to their
recorded CSS, not silently ignored. Complete static, lazy and total transfer are
reported separately: the entry-only baseline is not misrepresented as a numeric
full-closure or total-transfer baseline. Actual full initial JS must decrease
from the exact failing `1f860dc` candidate, so renaming/splitting an entry without
reducing its static closure cannot satisfy the repair regression.

## Current-contract follow-up (partial nine-finding remediation)

The directly adopted current contract is
`SIMWAR-SAME-R6-CURRENT-PRODUCT-ACCEPTANCE-CONTRACT-02`. It is a new requirement
contract, not restoration of a missing legacy acceptance matrix or acceptance
signature. Legacy applicability, human validation, FE/MAIN consumption and
PA12/PA13 remain separate actual decisions. The prior locator overrun (15 against 12) is recorded, not retroactively authorized or refunded; its excluded outputs
are not used by this repair.

The minimum available, non-deprecated same-major candidates admitted from exact
official metadata are Babel core/generator 7.29.6, Vitest and its coupled modules
4.1.11, baseline-browser-mapping 2.11.0, brace-expansion 1.1.21 and 5.0.12 on their
respective parent lines, browserslist 4.28.7, fast-uri 3.1.8 and js-yaml 4.3.2.
Browserslist also requires matching caniuse-lite, node-releases and
electron-to-chromium updates. Vite 8.3.4, WS 8.22.0, browser targets, npm, bundle
policy, role/tenant rules and all truth-chain semantics are unchanged.

The dependency-floor regression is independently runnable without installing a
test framework:

```text
node --test scripts/r6-dependency-security-floor.test.mjs
```

It checks every locked instance for the eight admitted findings, including both
brace-expansion parent lines, stable same-major floors and registry integrity
bindings. Its old-lock failure and candidate success are separate receipts. It
does not close esbuild or substitute for a current advisory audit.

The esbuild 0.28.0 finding is intentionally still open. The proposed 0.28.1 update
needs correct metadata/SRI for its 26 platform optional packages in the portable
lock. Those additional official reads exceed this window's remaining metadata
budget. No platform is deleted, no integrity value is invented and no unadmitted
native fallback is run. A later exact source/native/lock authorization is needed;
this partial PR must not use an issue-closing keyword.

New artifacts receive SHA512 SRI, safe-member, license and official-registry ECDSA
metadata-signature checks. This remains the limited registry trust model above,
not independent SLSA, transparency-log or reproducible-build verification. The
installation is offline with lifecycle scripts disabled, using new admitted
tarballs and exact old task-cache content addressed by lock integrity. No shared
cache or user/global config is modified.

The existing real-BFF browser case additionally asserts GSI region horizontal
containment at 390/1024/1280/1440, the Student unavailable status's polite live
region and keyboard activation of Admin provenance. These are automated checks,
not human or full WCAG acceptance. Their runtime outcome must be read from actual
validation receipts; source assertions alone are not PASS.

## Rollback

Revert the dedicated repair commit through the protected PR workflow to restore
the former toolchain/configuration. No database, settlement, canonical Decision,
Replay truth, tenant authorization or API contract changes are included. Such a
revert also restores the previous known toolchain risks; it is not risk acceptance.
