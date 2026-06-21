# JSON Snapshot Migration And Recovery Policy

## Purpose

This document defines the current migration and recovery boundary for the local
JSON snapshot store. It is a design baseline for future offline tooling. It
does not change runtime loader behavior, writer behavior, simulation,
settlement, Replay, Postgres, repository facade, API, UI, permissions,
dependencies, package-manager configuration, or CI configuration.

## Current Snapshot Format

The current persisted JSON snapshot format is snapshot version 1. Versioned
snapshots contain:

```json
{
  "snapshot_version": 1
}
```

alongside the runtime snapshot collections and counters.

The runtime store does not expose `snapshot_version` after loading. The writer
adds `snapshot_version: 1` when `persist()` writes a snapshot.

## Supported Versions

The runtime loader supports:

- current explicit version 1 snapshots;
- valid legacy v0 snapshots, represented by the absence of a
  `snapshot_version` field.

Explicit unknown future versions fail closed. Explicit invalid versions, such
as strings, decimals, zero, negative numbers, unsafe integers, arrays, objects,
booleans, or null, fail closed.

## Legacy v0 Policy

Valid legacy v0 snapshots remain readable for compatibility. Reading a legacy
v0 snapshot does not automatically add `snapshot_version`, does not rewrite the
source file, and does not perform migration-on-read.

A future migration tool may choose to transform legacy v0 to version 1, but that
must be an explicit offline action with dry-run output, backup-before-write,
validation, atomic write-back, and rollback instructions.

## Invalid And Future Version Policy

Explicit future versions and invalid explicit versions are not downgraded,
rewritten, repaired, or partially loaded by the runtime loader. They fail closed
before runtime restoration.

Future tooling must never rewrite an unknown version automatically. A tool may
only inspect and report unsupported versions unless a reviewed version-to-version
migration rule exists for the exact source and target versions.

## Corruption Policy

Malformed JSON, empty snapshot files, scalar roots, array roots, and snapshots
missing required top-level collections are treated as corruption by the runtime
loader. Runtime load failure must preserve the source snapshot bytes.

The runtime loader does not return a default store, delete the file, repair the
file, create a backup, create a quarantine copy, or write a recovered snapshot
when corruption is detected.

## Deep Validation Failure Policy

Deep entity validation failures fail closed before runtime restoration.
Malformed collection members, invalid nested structures, invalid enums, invalid
counters, or invalid primitive fields are not skipped, repaired, filtered, or
default-filled.

The runtime loader preserves the original snapshot and reports only safe error
paths. It must not leak full snapshot contents, full entities, Decision payloads,
passwords, tokens, secrets, database URLs, or temporary recovery credentials.

## Runtime Loader Non-Goals

The runtime JSON snapshot loader is not a migration or recovery system. It does
not perform:

- migration-on-read;
- automatic repair;
- automatic legacy v0 rewrite;
- automatic downgrade;
- automatic backup;
- automatic restore;
- quarantine file creation;
- partial load;
- invalid-entity filtering;
- default store fallback after read or validation failure;
- operator audit report generation.

Those behaviors belong in future offline tooling, not in the runtime load path.

## Current Backup And Quarantine Status

No automatic runtime backup, restore, quarantine, retention, or recovery
side-file policy is implemented today. Runtime load failures leave the target
directory without new backup, quarantine, or recovery files.

The crash-safe writer uses temporary files for single-writer persistence, but
those temp files are not backups and are not recovery artifacts.

## Explicit Backup-Before-Write Helper

The repository provides an explicit backup-before-write helper for future
offline migration and recovery tooling. The helper is not wired into runtime
load, normal `persist()`, or read-only inspection.

The helper:

- is called only by an explicit tool/helper path;
- copies the source snapshot's raw bytes to a backup file;
- does not parse, validate, migrate, repair, downgrade, or rewrite the source;
- can back up corrupted JSON and legacy v0 snapshots as raw bytes;
- creates the backup directory when requested;
- uses a unique backup filename and exclusive creation so existing backups are
  not overwritten;
- returns the source path, backup path, creation time, and byte count;
- fails closed when the source cannot be read or the backup cannot be created.

The helper does not:

- create quarantine files;
- create recovery outputs;
- delete or move files;
- call the runtime writer;
- call the inspection command;
- implement rollback or restore.

Future modifying migration or recovery tools must call the helper before any
write-back, record the backup path in audit output, and stop before modifying
the source snapshot if backup creation fails.

## Read-Only Inspection Dry Run

The repository provides a read-only snapshot inspection command:

```powershell
npm run snapshot:inspect -- <snapshot-file>
npm run snapshot:inspect -- --json <snapshot-file>
```

The command reuses the runtime snapshot version, shape, and deep entity
validation logic, but it does not create a store and does not call the writer.
It only reads the target file and reports a classification.

Supported statuses are:

| Status                | Exit code | Meaning                                      |
| --------------------- | --------- | -------------------------------------------- |
| `valid_v1`            | 0         | Explicit version 1 snapshot is valid         |
| `valid_legacy_v0`     | 0         | Legacy snapshot without `snapshot_version`   |
| `file_not_found`      | 3         | Target file does not exist                   |
| `empty_file`          | 1         | Target file is empty or whitespace-only      |
| `corrupt_json`        | 1         | Target file cannot be parsed as JSON         |
| `invalid_version`     | 1         | Explicit `snapshot_version` has invalid type |
| `unsupported_version` | 1         | Explicit version is valid but unsupported    |
| `invalid_snapshot`    | 1         | Shape or deep entity validation failed       |
| `internal_error`      | 4         | Inspection tool failed unexpectedly          |

Usage errors, such as a missing path or unknown option, return exit code 2.

The `--json` mode emits a machine-readable result with only safe metadata:
status, path, version classification, details, and a sanitized error object.
The default mode emits a compact human-readable summary.

Inspection is not migration tooling and is not recovery tooling. It does not:

- write back to the snapshot;
- add `snapshot_version` to legacy v0 files;
- repair corrupted JSON;
- delete, move, or replace files;
- create backup, quarantine, recovery, or `.tmp` files;
- expose full snapshots, full entities, Decision payloads, password hashes,
  token hashes, database URLs, secrets, private keys, or temporary credentials.

The command is a dry-run foundation for future operator tooling. Future
modifying tools must still combine explicit backup-before-write with atomic
write-back, source preservation, audit output, rollback, and operator
documentation.

## Future Migration Tooling Requirements

Future migration tooling must be explicit, offline, and testable. A reviewed
tool should include:

- exact source and target snapshot versions;
- machine-readable dry-run output;
- validation before migration;
- backup-before-write;
- source snapshot preservation until the full migration succeeds;
- atomic write-back using same-directory temporary files and replace semantics;
- post-write validation of the migrated snapshot;
- safe audit output without secrets or full payload leakage;
- clear failure codes;
- rollback or restore instructions;
- tests for valid current version, valid legacy v0, invalid version, future
  version, corrupted JSON, and deep validation failure cases.

Migration rules must not modify simulation truth, settlement formulas, Replay
hash inputs, canonical Decision semantics, Postgres adapter behavior,
repository facade behavior, API contracts, UI behavior, or permission rules.

## Future Recovery Tooling Requirements

Future recovery tooling must be explicit and operator-driven. A reviewed tool
should include:

- read-only inspection by default;
- dry-run as the default mode;
- backup-before-write for every modifying operation;
- atomic write-back for any recovered snapshot;
- source snapshot preservation when recovery fails;
- no silent repair;
- no partial runtime loading as a recovery shortcut;
- no automatic overwrite of corrupted snapshots;
- audit output describing inspected file, detected issue, selected action, and
  generated backup path;
- rollback or restore path from the backup;
- tests proving the original file is preserved until successful recovery.

Recovery must not require production code fallbacks or a default-store runtime
escape hatch.

## Windows And POSIX File-System Considerations

Future modifying tools must account for Windows and POSIX differences in rename
replacement, open-file handling, directory fsync support, antivirus or indexer
interference, path length, permissions, and cross-device moves.

Any write-back protocol should keep temporary files in the target directory to
avoid cross-device replacement. Directory sync should remain best-effort where a
platform does not support it, and the tool must report that limitation.

## Relationship To Prior Persistence Work

This policy builds on the current persistence baseline:

- P1-010: crash-safe JSON snapshot write path;
- P1-011: `snapshot_version: 1` and readable legacy v0 snapshots;
- P1-012: deep structural entity validation before runtime restoration;
- P1-013: crash-safe single-writer concurrency policy characterization.

P1-014 does not change those semantics. It records that migration, backup, and
recovery remain explicit future tooling concerns.

P1-015 adds read-only inspection only. P1-016 adds the explicit
backup-before-write helper only. Neither PR implements migration apply,
recovery apply, rollback, restore, CAS, stale-writer detection, or operator
workflow.

## Issue Relationship

This policy and its characterization tests relate to #139 by defining the JSON
snapshot migration and recovery design baseline. They do not deliver migration
tooling, recovery tooling, backup retention, rollback commands, restore
commands, or an operator CLI.

Issue #138 is not changed by this policy or helper. CAS, locking,
stale-writer detection, and multi-process write conflict prevention remain
separate future work.
