import {
  applySnapshotMigrationToCurrentVersion,
  type SnapshotMigrationApplyResult
} from "../services/api/src/store.js";

const usage = [
  "Usage: npm run snapshot:migration:apply -- [--json] [--backup-dir <directory>] <snapshot-file>",
  "",
  "JSON snapshot migration apply for valid legacy v0 snapshots only. The command",
  "creates a backup before write-back and uses crash-safe atomic replacement.",
  "It uses expected-current conflict detection but does not recover, restore,",
  "rollback, repair, quarantine, lock, or provide distributed coordination."
].join("\n");

function exitCodeFor(result: SnapshotMigrationApplyResult): number {
  switch (result.status) {
    case "applied":
    case "already_current":
      return 0;
    case "blocked":
      return 1;
    case "not_found":
      return 3;
    case "backup_failed":
      return 4;
    case "write_failed":
      return 5;
    case "post_write_validation_failed":
      return 6;
    case "cas_conflict":
      return 8;
  }
}

function versionLabel(
  value: SnapshotMigrationApplyResult["beforeVersion" | "afterVersion"]
): string {
  if (value === null) {
    return "none";
  }

  return typeof value === "number" ? `v${value}` : value;
}

function printHuman(result: SnapshotMigrationApplyResult): void {
  const lines = [
    `Snapshot migration apply: ${result.status}`,
    `Path: ${result.sourcePath}`,
    `Before version: ${versionLabel(result.beforeVersion)}`,
    `After version: ${versionLabel(result.afterVersion)}`,
    `Target version: ${result.targetVersion}`,
    `Action: ${result.action}`,
    `Can apply in future: ${result.canApplyInFuture ? "yes" : "no"}`
  ];

  if (result.backupPath) {
    lines.push(`Backup: ${result.backupPath}`);
  }

  if (result.backupBytes !== undefined) {
    lines.push(`Backup bytes: ${result.backupBytes}`);
  }

  if (result.sourceBytesBefore !== undefined) {
    lines.push(`Source bytes before: ${result.sourceBytesBefore}`);
  }

  if (result.sourceBytesAfter !== undefined) {
    lines.push(`Source bytes after: ${result.sourceBytesAfter}`);
  }

  for (const reason of result.reasons) {
    lines.push(`Reason: ${reason}`);
  }

  console.log(lines.join("\n"));
}

function main(): number {
  const args = process.argv.slice(2);
  let backupDirectory: string | undefined;
  let json = false;
  let snapshotPath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--backup-dir") {
      const next = args[index + 1];
      if (!next || next.startsWith("-")) {
        console.error("--backup-dir requires a directory path.");
        console.error(usage);
        return 2;
      }

      backupDirectory = next;
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      console.error(`Unknown option: ${arg}`);
      console.error(usage);
      return 2;
    }

    if (snapshotPath) {
      console.error("Only one snapshot path may be migrated at a time.");
      console.error(usage);
      return 2;
    }

    snapshotPath = arg;
  }

  if (!snapshotPath) {
    console.error(usage);
    return 2;
  }

  const result = applySnapshotMigrationToCurrentVersion(
    snapshotPath,
    backupDirectory === undefined ? {} : { backupDirectory }
  );

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHuman(result);
  }

  return exitCodeFor(result);
}

try {
  process.exitCode = main();
} catch {
  console.error("Snapshot migration apply failed internally.");
  process.exitCode = 7;
}
