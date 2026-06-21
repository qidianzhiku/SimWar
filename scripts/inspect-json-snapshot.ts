import {
  inspectPersistedSnapshotFile,
  type SnapshotInspectionResult
} from "../services/api/src/store.js";

const usage = [
  "Usage: npm run snapshot:inspect -- [--json] <snapshot-file>",
  "",
  "Read-only JSON snapshot inspection. The command does not migrate, repair, backup,",
  "quarantine, delete, move, or write the inspected snapshot."
].join("\n");

function exitCodeFor(result: SnapshotInspectionResult): number {
  if (result.ok) {
    return 0;
  }

  if (result.status === "file_not_found") {
    return 3;
  }

  if (result.status === "internal_error") {
    return 4;
  }

  return 1;
}

function printHuman(result: SnapshotInspectionResult): void {
  const lines = [
    `Snapshot inspection: ${result.status}`,
    `Path: ${result.path}`,
    `Result: ${result.ok ? "valid" : "invalid"}`,
    "Mode: read-only"
  ];

  if (result.ok) {
    lines.push(`Snapshot version: ${result.snapshot_version ?? "legacy v0"}`);
    lines.push(`Legacy: ${result.legacy ? "yes" : "no"}`);
  } else {
    lines.push(`Error kind: ${result.error.kind}`);
    lines.push(`Error message: ${result.error.message}`);

    if (result.error.field) {
      lines.push(`Field: ${result.error.field}`);
    }
  }

  console.log(lines.join("\n"));
}

function main(): number {
  const args = process.argv.slice(2);
  let json = false;
  let snapshotPath: string | undefined;

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg.startsWith("-")) {
      console.error(`Unknown option: ${arg}`);
      console.error(usage);
      return 2;
    }

    if (snapshotPath) {
      console.error("Only one snapshot path may be inspected at a time.");
      console.error(usage);
      return 2;
    }

    snapshotPath = arg;
  }

  if (!snapshotPath) {
    console.error(usage);
    return 2;
  }

  const result = inspectPersistedSnapshotFile(snapshotPath);

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
  console.error("Snapshot inspection failed internally.");
  process.exitCode = 4;
}
