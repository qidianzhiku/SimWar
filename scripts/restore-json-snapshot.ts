import {
  restoreSnapshotFromBackup,
  type SnapshotRestoreFromBackupResult
} from "../services/api/src/store.js";

const usage = [
  "Usage: npm run snapshot:restore -- [--json] [--pre-restore-backup-dir <directory>] <backup-file> <snapshot-file>",
  "",
  "Restore a local JSON snapshot from a valid v1 or legacy v0 backup file.",
  "The command creates a pre-restore backup when the target exists and writes",
  "with expected-current crash-safe atomic replacement. It does not implement",
  "cloud restore, UI restore, rollback, locking, or distributed coordination."
].join("\n");

function exitCodeFor(result: SnapshotRestoreFromBackupResult): number {
  switch (result.status) {
    case "restored":
      return 0;
    case "blocked":
      return 1;
    case "backup_not_found":
      return 3;
    case "pre_restore_backup_failed":
      return 4;
    case "write_failed":
      return 5;
    case "post_restore_validation_failed":
      return 6;
    case "cas_conflict":
      return 8;
  }
}

function versionLabel(
  value: SnapshotRestoreFromBackupResult["backupSnapshotVersion" | "restoredVersion"]
): string {
  if (value === null) {
    return "none";
  }

  return typeof value === "number" ? `v${value}` : value;
}

function printHuman(result: SnapshotRestoreFromBackupResult): void {
  const lines = [
    `Snapshot restore: ${result.status}`,
    `Backup: ${result.backupPath}`,
    `Target: ${result.targetPath}`,
    `Backup version: ${versionLabel(result.backupSnapshotVersion)}`,
    `Restored version: ${versionLabel(result.restoredVersion)}`,
    `Action: ${result.action}`,
    `Target existed before restore: ${result.targetExistedBeforeRestore ? "yes" : "no"}`,
    `Pre-restore backup: ${result.preRestoreBackupPath ?? "none"}`
  ];

  if (result.backupBytes !== undefined) {
    lines.push(`Backup bytes: ${result.backupBytes}`);
  }

  if (result.preRestoreBackupBytes !== undefined) {
    lines.push(`Pre-restore backup bytes: ${result.preRestoreBackupBytes}`);
  }

  if (result.targetBytesAfter !== undefined) {
    lines.push(`Target bytes after: ${result.targetBytesAfter}`);
  }

  for (const reason of result.reasons) {
    lines.push(`Reason: ${reason}`);
  }

  console.log(lines.join("\n"));
}

function main(): number {
  const args = process.argv.slice(2);
  let json = false;
  let preRestoreBackupDirectory: string | undefined;
  const paths: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--pre-restore-backup-dir") {
      const next = args[index + 1];
      if (!next || next.startsWith("-")) {
        console.error("--pre-restore-backup-dir requires a directory path.");
        console.error(usage);
        return 2;
      }

      preRestoreBackupDirectory = next;
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      console.error(`Unknown option: ${arg}`);
      console.error(usage);
      return 2;
    }

    paths.push(arg);
  }

  if (paths.length !== 2) {
    console.error(usage);
    return 2;
  }

  const result = restoreSnapshotFromBackup(
    paths[0]!,
    paths[1]!,
    preRestoreBackupDirectory === undefined ? {} : { preRestoreBackupDirectory }
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
  console.error("Snapshot restore failed internally.");
  process.exitCode = 7;
}
