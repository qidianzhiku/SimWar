import {
  planSnapshotMigrationDryRun,
  type SnapshotMigrationDryRunPlan
} from "../services/api/src/store.js";

const usage = [
  "Usage: npm run snapshot:migration:plan -- [--json] <snapshot-file>",
  "",
  "Read-only JSON snapshot migration planning. The command does not migrate, repair,",
  "backup, recover, quarantine, delete, move, or write the inspected snapshot."
].join("\n");

function exitCodeFor(plan: SnapshotMigrationDryRunPlan): number {
  if (plan.status === "not_found") {
    return 3;
  }

  if (plan.status === "blocked") {
    return 1;
  }

  return 0;
}

function printHuman(plan: SnapshotMigrationDryRunPlan): void {
  const lines = [
    `Snapshot migration plan: ${plan.status}`,
    `Path: ${plan.sourcePath}`,
    `Current version: ${plan.safeSummary.snapshotVersionLabel}`,
    `Target version: ${plan.targetVersion}`,
    `Action: ${plan.action}`,
    `Can apply in future: ${plan.canApplyInFuture ? "yes" : "no"}`,
    `Backup required before apply: ${plan.requiresBackupBeforeApply ? "yes" : "no"}`,
    "Mode: read-only dry-run"
  ];

  for (const reason of plan.reasons) {
    lines.push(`Reason: ${reason}`);
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
      console.error("Only one snapshot path may be planned at a time.");
      console.error(usage);
      return 2;
    }

    snapshotPath = arg;
  }

  if (!snapshotPath) {
    console.error(usage);
    return 2;
  }

  const plan = planSnapshotMigrationDryRun(snapshotPath);

  if (json) {
    console.log(JSON.stringify(plan, null, 2));
  } else {
    printHuman(plan);
  }

  return exitCodeFor(plan);
}

try {
  process.exitCode = main();
} catch {
  console.error("Snapshot migration planning failed internally.");
  process.exitCode = 4;
}
