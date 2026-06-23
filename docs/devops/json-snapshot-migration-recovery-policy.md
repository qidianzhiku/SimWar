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

## Migration Dry-Run Planner

The repository provides a read-only migration dry-run planner:

```powershell
npm run snapshot:migration:plan -- <snapshot-file>
npm run snapshot:migration:plan -- --json <snapshot-file>
```

The planner reuses the snapshot inspection, version, shape, and deep entity
validation boundary. It produces a safe migration plan for operator review, but
it does not perform migration apply.

The planner reports:

- source path;
- current version classification;
- target version;
- whether migration is needed;
- whether future apply can be planned;
- blocking reasons;
- whether future apply must create a backup before write-back;
- a safe summary that does not include full snapshot contents.

The planner is read-only. It does not:

- call the backup-before-write helper;
- call the runtime writer;
- write back to the snapshot;
- add `snapshot_version` to legacy v0 files;
- repair corrupted JSON;
- restore from backup;
- create quarantine files;
- create recovery outputs;
- create migration output files;
- delete, move, or replace files;
- automatically migrate on read.

Planner classification:

| Input snapshot                          | Plan result                             |
| --------------------------------------- | --------------------------------------- |
| Valid explicit v1                       | No-op / already current                 |
| Valid legacy v0                         | Future migration candidate              |
| Future version                          | Blocked as unsupported                  |
| Invalid explicit version                | Blocked as invalid                      |
| Malformed or empty JSON                 | Blocked pending inspection before retry |
| Shape or deep entity validation failure | Blocked pending inspection before retry |
| Missing file                            | Reported distinctly as not found        |

The planner's JSON and human-readable output must not expose full snapshots,
full entities, Decision payloads, password hashes, token hashes, database URLs,
secrets, private keys, or temporary credentials.

Future modifying migration apply tooling must call the explicit
backup-before-write helper before any write-back. Rollback, restore, recovery
apply, backup retention, and operator workflow remain future work.

## Migration Apply

The repository provides an explicit migration apply command for the only
currently supported migration path:

```powershell
npm run snapshot:migration:apply -- <snapshot-file>
npm run snapshot:migration:apply -- --json <snapshot-file>
```

The apply command supports valid legacy v0 snapshots only. It migrates a valid
legacy v0 snapshot to the current v1 persisted format by adding
`snapshot_version: 1` through the same persisted snapshot writer shape used by
normal store persistence.

Apply behavior:

| Input snapshot                          | Apply result                        |
| --------------------------------------- | ----------------------------------- |
| Valid explicit v1                       | No-op / already current             |
| Valid legacy v0                         | Backup, atomic write-back, valid v1 |
| Future version                          | Blocked as unsupported              |
| Invalid explicit version                | Blocked as invalid                  |
| Malformed or empty JSON                 | Blocked before backup or write-back |
| Shape or deep entity validation failure | Blocked before backup or write-back |
| Missing file                            | Reported distinctly as not found    |

For a valid legacy v0 apply, the command:

- creates a backup before write-back;
- preserves the source snapshot's original bytes in that backup;
- rereads and revalidates the source as legacy v0 after backup creation;
- writes the migrated v1 snapshot with the crash-safe atomic write path;
- reinspects the source after write-back and requires a valid v1 result;
- returns only safe metadata such as source path, backup path, versions, byte
  counts, status, action, and entity counts.

Apply exit codes:

| Exit code | Meaning                                               |
| --------- | ----------------------------------------------------- |
| 0         | Apply succeeded or the snapshot was already current   |
| 1         | Snapshot is blocked, invalid, corrupt, or unsupported |
| 2         | Usage error                                           |
| 3         | Source file was not found                             |
| 4         | Backup-before-write failed                            |
| 5         | Atomic write-back failed                              |
| 6         | Post-write validation failed                          |
| 7         | Unexpected internal error                             |

The apply command does not:

- run automatically during runtime load;
- run automatically during normal `persist()`;
- run from inspection or dry-run planning;
- migrate future versions;
- migrate invalid snapshots;
- repair corrupted snapshots;
- quarantine snapshots;
- restore from backup;
- rollback failed writes;
- implement backup retention;
- implement recovery CLI behavior;
- implement CAS, locking, or stale-writer prevention.

If write-back fails after backup creation, the command fails closed and relies
on the existing crash-safe atomic writer semantics to preserve the last valid
source snapshot where the platform replacement operation did not complete. It
does not attempt rollback or restore. If post-write validation fails, the
command reports failure and includes the backup path for future explicit
recovery tooling.

## Restore From Backup

The repository provides an explicit local restore-from-backup command:

```powershell
npm run snapshot:restore -- <backup-file> <snapshot-file>
npm run snapshot:restore -- --json <backup-file> <snapshot-file>
npm run snapshot:restore -- --pre-restore-backup-dir <directory> <backup-file> <snapshot-file>
```

The restore command supports backup files that inspect as:

- valid explicit v1 snapshots;
- valid legacy v0 snapshots.

Invalid, future-version, corrupted, empty, or deep-validation-failing backup
files are blocked before any target backup or write-back.

Restore behavior:

| Input backup / target state             | Restore result                                  |
| --------------------------------------- | ----------------------------------------------- |
| Valid v1 backup, target exists          | Pre-restore backup, atomic write-back, valid v1 |
| Valid legacy v0 backup, target exists   | Pre-restore backup, atomic write-back, valid v1 |
| Valid backup, target missing            | Creates target, no fake pre-restore backup      |
| Missing backup file                     | Blocked as backup not found                     |
| Future or invalid backup version        | Blocked before target backup or write-back      |
| Malformed or empty backup JSON          | Blocked before target backup or write-back      |
| Shape or deep entity validation failure | Blocked before target backup or write-back      |
| Pre-restore backup failure              | Fails closed before write-back                  |
| Atomic write-back failure               | Fails closed; no automatic rollback             |
| Post-restore validation failure         | Fails closed; no automatic rollback             |

For a successful restore, the command:

- inspects the backup source before modifying the target;
- creates a pre-restore backup when the target exists;
- reports `preRestoreBackupPath: null` when the target did not exist;
- reads the backup through the existing runtime snapshot conversion and deep
  validation path;
- writes the target with the crash-safe atomic write path;
- writes current v1 persisted format, including when the backup source was
  legacy v0;
- reinspects the target after write-back and requires a valid v1 result;
- returns only safe metadata such as backup path, target path, pre-restore
  backup path, versions, status, action, byte counts, and entity counts.

Restore exit codes:

| Exit code | Meaning                                          |
| --------- | ------------------------------------------------ |
| 0         | Restore succeeded                                |
| 1         | Restore blocked by invalid or unsupported backup |
| 2         | Usage error                                      |
| 3         | Backup file was not found                        |
| 4         | Pre-restore backup failed                        |
| 5         | Atomic write-back failed                         |
| 6         | Post-restore validation failed                   |
| 7         | Unexpected internal error                        |

The restore command is a local operator workflow only. It does not:

- run automatically during runtime load;
- run automatically during normal `persist()`;
- run from inspection, dry-run planning, or migration apply;
- discover or prune backups;
- implement backup retention policy;
- implement cloud restore;
- implement teacher or admin UI restore;
- implement multi-team restore;
- repair corrupted snapshots;
- quarantine snapshots;
- rollback failed writes;
- implement CAS, locking, distributed coordination, or stale-writer prevention.

If write-back fails after pre-restore backup creation, the command fails closed
and does not attempt rollback. If post-restore validation fails, the command
reports failure and includes the pre-restore backup path for manual operator
review. Backup retention policy, cloud restore, UI restore, and multi-team
restore remain future work.

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
backup-before-write helper only. P1-017 adds read-only migration dry-run
planning only. P1-018 adds explicit legacy v0 to current v1 migration apply
only. P1-019 adds local restore-from-backup CLI and a local operator workflow
only. These PRs do not implement cloud restore, UI restore, multi-team restore,
CAS, stale-writer detection, backup retention, or distributed coordination.

## Issue Relationship

This policy and its characterization tests relate to #139 by defining the JSON
snapshot migration and recovery design baseline. They do not deliver cloud
restore, UI restore, multi-team restore, backup retention, rollback commands,
CAS, stale-writer prevention, or distributed coordination. The migration
dry-run planner, legacy v0 to v1 apply command, and local restore-from-backup
CLI are building blocks. #139 remains open by default until issue closeout is
judged separately.

Issue #138 is not changed by this policy or helper. CAS, locking,
stale-writer detection, and multi-process write conflict prevention remain
separate future work.
