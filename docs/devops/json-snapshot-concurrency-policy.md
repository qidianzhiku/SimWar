# JSON Snapshot Writer Concurrency Policy

## Purpose

This document defines the current concurrency policy for the local JSON
snapshot writer. It covers the default JSON adapter only. It does not change
simulation, settlement, Replay, Postgres, repository facade, API, UI,
permissions, or package-manager behavior.

## Current Policy

The JSON snapshot writer supports crash-safe single-writer persistence.

Multiple processes or independently loaded store instances writing the same
snapshot path at the same time are not a supported runtime mode. Operators and
test harnesses must treat a snapshot file path as owned by one active writer at
a time.

This policy is intentionally narrower than a compare-and-swap or file-locking
contract. The current implementation does not claim to be concurrency-safe.

## Guaranteed

For a single active writer, the current writer is expected to:

- write to a temporary file in the same directory as the target snapshot;
- use a temp path containing the target basename, process id, timestamp, and a
  random UUID;
- create the temporary file with exclusive creation flags;
- write the full JSON snapshot before replacement;
- fsync the temporary file before replacement;
- close the temporary file before replacement;
- replace the target via one rename operation;
- best-effort sync the containing directory after replacement;
- clean up its own temporary file on write, fsync, close, or rename failure;
- leave the previous committed snapshot readable when a pre-rename failure
  occurs.

These guarantees are crash-safety and single-writer durability guarantees, not
multi-writer coordination guarantees.

## Not Guaranteed

The current writer does not guarantee:

- file locking;
- distributed locking;
- lock-file ownership;
- compare-and-swap;
- snapshot revision checks;
- snapshot generation checks;
- mtime checks;
- stale-writer detection;
- retry scheduling;
- preservation of newer authoritative state when an older independently loaded
  writer writes later;
- deterministic winner selection when multiple writers race to replace the same
  target.

If two writers both succeed, the final snapshot is whichever complete
replacement the file system leaves at the target path. That can be a stale
writer's snapshot.

## Crash Safety Versus Concurrency Safety

Crash safety means a writer should not expose a partially written JSON file as
the target snapshot when a write, sync, close, or rename operation fails.

Concurrency safety would require detecting or preventing conflicting writers,
for example by using an expected revision, compare-and-swap, or a reliable lock
protocol. The current JSON writer does not implement those mechanisms.

## Multi-Process Writes

Multi-process writes to the same snapshot path are unsupported.

The current temp-file scheme reduces temp path collisions across processes, but
it does not coordinate ownership of the target snapshot. A complete but older
snapshot can overwrite a newer snapshot when a stale store instance persists
after another store has already committed.

This is acceptable only for local development and test scenarios that enforce a
single active writer per snapshot file. Production or shared deployments should
use the repository path designed for coordinated persistence instead of sharing
one JSON file across multiple writers.

## Windows And POSIX Notes

The implementation assumes the platform `rename` operation can replace the
target snapshot with a completed temporary file. Windows and POSIX differ in
details around replacing open files, antivirus or indexer interference,
cross-device renames, and directory fsync support.

The current writer keeps temporary files in the target directory to avoid
cross-device replacement. Directory fsync is best-effort because not every
platform and file system supports opening and syncing a directory.

No platform-specific file lock is used.

## Current Tests

`tests/unit/store-snapshot-persistence.test.ts` covers:

- successful same-directory temp-file replacement;
- distinct temp files for independent writers targeting one snapshot path;
- a stale independently loaded writer overwriting a newer complete snapshot;
- no leftover temp files after successful replacement;
- write, fsync, close, and rename failure behavior;
- corrupted snapshot fail-closed behavior;
- versioned and legacy snapshot loading;
- deep entity validation before runtime restoration.

The stale-writer test is characterization. It documents unsupported behavior;
it does not make stale overwrites acceptable for shared runtime use.

## Future CAS Or Lock Direction

Closing the multi-writer gap requires a separate design. Viable options include:

- adding a persisted snapshot revision or generation field;
- loading an expected revision into each store instance;
- checking the expected revision before replacement;
- failing closed when the current on-disk revision differs;
- designing legacy v0 and snapshot version 1 compatibility;
- defining retry behavior for identical writes versus conflicting writes;
- evaluating cross-platform file-lock behavior separately from revision CAS.

Those changes would affect persisted-format semantics and must be reviewed as a
separate PR before they are implemented.

## Issue Relationship

This document and the corresponding characterization tests relate to #138 by
making the current writer concurrency policy explicit. They do not implement
CAS, stale-writer prevention, or a multi-process lock protocol.
