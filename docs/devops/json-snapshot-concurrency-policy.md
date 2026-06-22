# JSON Snapshot Concurrency Policy

## 1. Current Policy

JSON snapshot writer is crash-safe but not stale-writer-safe.

Writes use a same-directory temporary file followed by atomic replace
semantics. The temporary file path contains the target basename, process id,
timestamp, and random UUID. The writer creates the temp file exclusively, writes
the complete JSON payload, fsyncs and closes the temp file, renames it over the
target, and then best-effort syncs the containing directory.

The current policy is last successful atomic replace wins.

There is no CAS.

There is no lock.

There is no stale-writer conflict error.

snapshot_version is a persisted format version only. It is not a writer
revision, generation, etag, checksum, or expected-current precondition.

entity updated_at is not a snapshot write precondition. Entity timestamps
belong to domain data and cannot prove that the whole snapshot file is current.

replay_hash is not a snapshot CAS token. Replay data protects replay
semantics; it is not a local JSON writer coordination mechanism.

Crash-safety means a failed write, fsync, close, or rename should not expose a
partial target snapshot. It does not mean a stale store instance is detected
before it writes a complete older snapshot.

## 2. Current Write Paths

| Write Path            | Caller                                                      | Atomic Writer               | CAS | Lock | Current Behavior                                                                                                                                                               |
| --------------------- | ----------------------------------------------------------- | --------------------------- | --- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Runtime store persist | `createP1Store().persist`                                   | `persistSnapshotAtomically` | no  | no   | Serializes the in-memory runtime store and atomically replaces the snapshot. If two loaded stores write the same file, the last successful replace wins.                       |
| Initial file creation | `createP1Store` calls `store.persist()` when no file exists | `persistSnapshotAtomically` | no  | no   | Seeds the initial local snapshot atomically when the configured snapshot file is missing.                                                                                      |
| Migration apply       | `applySnapshotMigrationToCurrentVersion`                    | `persistSnapshotAtomically` | no  | no   | Explicit command path backs up valid legacy v0 raw bytes, revalidates, and atomically writes current v1. It does not enforce an expected-current precondition.                 |
| Restore from backup   | `restoreSnapshotFromBackup`                                 | `persistSnapshotAtomically` | no  | no   | Explicit command path optionally backs up the target, validates backup input, and atomically writes restored current v1. It does not enforce an expected-current precondition. |

Inspection and migration planning remain read-only paths. They do not call the
writer and do not participate in concurrency control.

## 3. Read-Only Write Metadata Helper

`readSnapshotWriteMetadata` reads current local file metadata only.

For an existing snapshot file, it returns raw file metadata such as:

- file path;
- byte size;
- filesystem mtime in milliseconds;
- filesystem mtime as ISO text;
- SHA-256 of the current raw file bytes.

For a missing file, it returns `not_found`.

The helper does not validate snapshot correctness. A corrupt existing file can
still have size, mtime, and SHA-256 metadata. Snapshot validity remains the job
of `snapshot:inspect` and the inspection helpers.

The helper does not enforce CAS. It does not prevent stale writers, create
locks, create temporary files, create backups, write files, or mutate the
persisted snapshot format.

This helper is intended as a future CAS building block only. Future #138 work
must still define expected-current semantics, the conflict error shape,
identical retry behavior, and which write paths should enforce the precondition.

Corrupt existing file metadata is not the same as valid snapshot inspection.

## 4. Explicit Expected-Current Writer API

`persistSnapshotAtomicallyWithExpectedMetadata` is an explicit expected-current
writer API for future #138 CAS work.

The API compares current raw file metadata from `readSnapshotWriteMetadata`
with caller-supplied expected metadata before delegating to the existing
crash-safe atomic writer.

The current identity basis is:

- metadata status;
- `sizeBytes`;
- `contentSha256`.

`mtimeMs` and `mtimeIso` are diagnostics only. They are not the sole conflict
basis and are not required to match when the raw bytes are identical.

If expected and current metadata do not match, the API fails closed with a
deterministic `store_snapshot_write_conflict` error. The conflict error carries
safe metadata only: target path, expected status, actual status, byte size, and
SHA-256 where available. It must not include full snapshot payloads, entities,
Decision payloads, credentials, database URLs, or secrets.

If expected and current metadata match, the API delegates to
`persistSnapshotAtomically` and preserves the existing crash-safe write
semantics.

This API is not wired into runtime store persist.

It is not wired into migration apply.

It is not wired into restore from backup.

It does not create backups.

It does not create locks.

It does not provide distributed coordination.

It does not mutate the persisted snapshot format.

It does not fully prevent all concurrent writer races; it only gives explicit
callers a deterministic expected-current precondition boundary. Future #138 work
must decide where to enforce it and whether stronger locking or coordination is
needed.

## 5. What This Policy Does Not Guarantee

This policy does not prevent stale writer overwrite.

It does not coordinate multi-process writers.

It does not provide distributed locking.

It does not merge divergent snapshots.

It does not protect against business-level concurrent decision conflicts.

It does not replace Postgres transaction semantics.

It does not make local JSON persistence a distributed coordination mechanism.

## 6. Future CAS direction for #138

Future #138 work should be split into small PRs. Candidate design direction:

- define snapshot revision, checksum, or generation metadata;
- add an explicit expected-current precondition to write APIs that need stale
  writer prevention;
- return a deterministic conflict error when the current on-disk snapshot does
  not match the expected-current precondition;
- preserve the current crash-safe atomic writer for the final replacement step;
- distinguish identical retry from conflicting retry;
- decide separately whether runtime persist, migration apply, and restore all
  enforce CAS;
- keep Postgres CAS and cloud CAS separate from the local JSON snapshot CAS
  design.

This document does not choose the final CAS token or locking strategy. It only
records the current no-CAS behavior and the boundary for #138 design.

Recommended next PR:

```text
P1-025 - Wire explicit CAS writer into migration apply and restore paths
```

Runtime persist CAS should be evaluated separately because it may require a
broader product decision about local JSON store writer ownership and conflict
surfacing.

## 7. Relationship To #139

#139 local migration/recovery tooling is complete and closed.

#138 is separate.

Migration apply and restore remain explicit-only. They are not runtime
automatic behavior and they are not inspection behavior.

This PR does not change #139 tooling behavior. It only documents the current
JSON snapshot no-CAS policy and adds characterization tests for future #138
work.

Relates to #138.
