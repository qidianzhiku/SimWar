# BASELINE_FAILURE_FINGERPRINT_REGISTRY

## Candidate full-suite fingerprint

- Command: `npm test`
- Concurrent result: 238/243 test files passed; 1459/1464 tests passed.
- Five failures were 5-second timeouts in:
  - `tests/unit/ui-teacher-refoundation.test.tsx` stale workspace response
  - `tests/unit/ui-admin-refoundation.test.tsx` stale Admin response
  - `tests/integration/shared-contracts-built-esm-startup.test.ts` built API startup
  - `tests/unit/pr4-visual-baseline-capture.test.ts` candidate SHA fail-closed CLI
  - `tests/unit/store-snapshot-persistence.test.ts` explicit CLI exit codes

## Serial characterization

- Command: same five files with `--no-file-parallelism --maxWorkers=1`
- Result: 5/5 files passed; 191/191 tests passed.
- Interpretation: concurrent resource/timing baseline fingerprint, not a reproducible M2-P4 regression.

## Other quality limits

- `npm run security:audit`: inherited 9 advisories (2 low, 7 high); no dependency changes or automatic remediation performed.
- This receipt does not relabel the full concurrent suite as green; both results remain visible.
