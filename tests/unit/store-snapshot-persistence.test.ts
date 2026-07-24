import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  StoreSnapshotError,
  applySnapshotMigrationToCurrentVersion,
  createSnapshotBackupBeforeWrite,
  createP1Store,
  inspectPersistedSnapshotFile,
  persistSnapshotAtomicallyWithExpectedMetadata,
  planSnapshotMigrationDryRun,
  readSnapshotWriteMetadata,
  restoreSnapshotFromBackup,
  type SnapshotMigrationApplyResult,
  type SnapshotMigrationDryRunPlan,
  type SnapshotInspectionResult,
  type SnapshotRestoreFromBackupResult,
  type SnapshotFileSystem,
  type SimWarStore
} from "../../services/api/src/store";

const tempDirs: string[] = [];
const tsxCliPath = join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
const snapshotPackageScripts = {
  "snapshot:inspect":
    "tsx --tsconfig scripts/tsconfig.snapshot-inspect.json scripts/inspect-json-snapshot.ts",
  "snapshot:migration:apply":
    "tsx --tsconfig scripts/tsconfig.snapshot-migration-apply.json scripts/apply-json-snapshot-migration.ts",
  "snapshot:migration:plan":
    "tsx --tsconfig scripts/tsconfig.snapshot-migration-plan.json scripts/plan-json-snapshot-migration.ts",
  "snapshot:restore":
    "tsx --tsconfig scripts/tsconfig.snapshot-restore.json scripts/restore-json-snapshot.ts"
} as const;

type SnapshotPackageScript = keyof typeof snapshotPackageScripts;

function assertSnapshotPackageScript(script: SnapshotPackageScript): void {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    scripts?: Record<string, unknown>;
  };
  const actual = packageJson.scripts?.[script];
  const expected = snapshotPackageScripts[script];

  if (actual !== expected) {
    throw new Error(`Unexpected package.json script for ${script}.`);
  }
}

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "simwar-snapshot-"));
  tempDirs.push(dir);
  return dir;
}

function createSnapshotPath(name = "simwar-store.json"): string {
  return join(createTempDir(), name);
}

function readRaw(path: string): string {
  return readFileSync(path, "utf8");
}

function writeRaw(path: string, contents: string): string {
  writeFileSync(path, contents, "utf8");
  return contents;
}

function readSnapshot(path: string): Record<string, unknown> {
  return JSON.parse(readRaw(path)) as Record<string, unknown>;
}

function writeSnapshot(path: string, snapshot: Record<string, unknown>): string {
  const raw = `${JSON.stringify(snapshot, null, 2)}\n`;
  writeFileSync(path, raw, "utf8");
  return raw;
}

function writeValidSnapshot(path: string): string {
  createP1Store({ persistenceFile: path });
  return readRaw(path);
}

function createLegacySnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const snapshotPath = createSnapshotPath("legacy-source.json");
  const store = createP1Store({ persistenceFile: snapshotPath });

  store.courses.push({
    course_id: "course_legacy_snapshot",
    created_by: "usr_teacher",
    parameter_set_id: "param_toy_approved_1",
    scenario_package_id: "scenario_eldercare_demo",
    status: "draft",
    tenant_id: "tenant_demo",
    title: "Legacy Snapshot"
  });
  store.persist();

  const snapshot = readSnapshot(snapshotPath);
  delete snapshot.snapshot_version;

  return { ...snapshot, ...overrides };
}

function cloneLegacySnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return structuredClone(createLegacySnapshot(overrides)) as Record<string, unknown>;
}

function tempFilesFor(path: string): string[] {
  const prefix = `${basename(path)}.`;
  return readdirSync(join(path, "..")).filter(
    (entry) => entry.startsWith(prefix) && entry.endsWith(".tmp")
  );
}

function expectNoInspectionSideFiles(path: string): void {
  expect(readdirSync(join(path, "..")).sort()).toEqual([basename(path)]);
}

function defaultBackupDirectoryFor(path: string): string {
  return join(path, "..", ".snapshot-backups");
}

function backupFilesFor(path: string): string[] {
  const backupDirectory = defaultBackupDirectoryFor(path);

  return existsSync(backupDirectory) ? readdirSync(backupDirectory).sort() : [];
}

function runInspectionCommand(args: string[]) {
  return spawnSync(
    process.execPath,
    [
      tsxCliPath,
      "--tsconfig",
      "scripts/tsconfig.snapshot-inspect.json",
      "scripts/inspect-json-snapshot.ts",
      ...args
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      shell: false,
      timeout: 4_000
    }
  );
}

function runDeclaredInspectionCommand(args: string[]) {
  assertSnapshotPackageScript("snapshot:inspect");
  return runInspectionCommand(args);
}

function runMigrationPlanCommand(args: string[]) {
  return spawnSync(
    process.execPath,
    [
      tsxCliPath,
      "--tsconfig",
      "scripts/tsconfig.snapshot-migration-plan.json",
      "scripts/plan-json-snapshot-migration.ts",
      ...args
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      shell: false,
      timeout: 4_000
    }
  );
}

function runDeclaredMigrationPlanCommand(args: string[]) {
  assertSnapshotPackageScript("snapshot:migration:plan");
  return runMigrationPlanCommand(args);
}

type TimedCommandResult = {
  signal: NodeJS.Signals | null;
  status: number | null;
  stderr: string;
  stdout: string;
};

function terminateChildProcessTree(child: ChildProcess): void {
  if (child.pid === undefined) {
    child.kill();
    return;
  }

  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill();
    }
    return;
  }

  const terminator = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
    shell: false,
    stdio: "ignore",
    windowsHide: true
  });
  terminator.once("error", () => {
    child.kill();
  });
  terminator.once("close", (status) => {
    if (status !== 0) {
      child.kill();
    }
  });
}

function runNodeCommandWithDeadline(
  args: string[],
  timeoutMs: number
): Promise<TimedCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      detached: process.platform !== "win32",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    let settled = false;
    let stderr = "";
    let stdout = "";
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      terminateChildProcessTree(child);
    }, timeoutMs);

    const settle = (callback: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      callback();
    };

    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      settle(() => reject(error));
    });
    child.once("close", (status, signal) => {
      settle(() => {
        if (timedOut) {
          reject(new Error(`Command did not complete within ${timeoutMs}ms.`));
          return;
        }

        resolve({ signal, status, stderr, stdout });
      });
    });
  });
}

function runMigrationApplyCommandWithDeadline(args: string[]): Promise<TimedCommandResult> {
  return runNodeCommandWithDeadline(
    [
      tsxCliPath,
      "--tsconfig",
      "scripts/tsconfig.snapshot-migration-apply.json",
      "scripts/apply-json-snapshot-migration.ts",
      ...args
    ],
    4_000
  );
}

function runDeclaredMigrationApplyCommandWithDeadline(args: string[]): Promise<TimedCommandResult> {
  assertSnapshotPackageScript("snapshot:migration:apply");
  return runMigrationApplyCommandWithDeadline(args);
}

function runSnapshotRestoreCommandWithDeadline(args: string[]): Promise<TimedCommandResult> {
  return runNodeCommandWithDeadline(
    [
      tsxCliPath,
      "--tsconfig",
      "scripts/tsconfig.snapshot-restore.json",
      "scripts/restore-json-snapshot.ts",
      ...args
    ],
    4_000
  );
}

function runDeclaredSnapshotRestoreCommandWithDeadline(
  args: string[]
): Promise<TimedCommandResult> {
  assertSnapshotPackageScript("snapshot:restore");
  return runSnapshotRestoreCommandWithDeadline(args);
}

describe("snapshot CLI process completion", () => {
  it("fails a deliberately blocked child within its per-child deadline", async () => {
    const startedAt = Date.now();

    await expect(
      runNodeCommandWithDeadline(["-e", "setInterval(() => {}, 1_000)"], 100)
    ).rejects.toThrow("Command did not complete within 100ms.");

    expect(Date.now() - startedAt).toBeLessThan(2_000);
  }, 2_000);

  it("passes shell metacharacter snapshot paths as one npm script argument", () => {
    const snapshotPath = createSnapshotPath("npm path & (percent%) caret^ bang!.json");
    writeValidSnapshot(snapshotPath);

    const result = runDeclaredInspectionCommand(["--json", snapshotPath]);

    expect(result.status, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`).toBe(0);
    expect(parseInspectionJsonOutput(result.stdout).path).toBe(snapshotPath);
  });

  it("does not execute path-like shell syntax in npm snapshot arguments", () => {
    const directory = createTempDir();
    const markerPath = join(directory, "shell-injection-marker.txt");
    const pathLikeArgument = `${join(
      directory,
      "missing-snapshot.json"
    )} & echo simwar-codeql-marker>${markerPath}`;

    runDeclaredInspectionCommand(["--json", pathLikeArgument]);

    expect(existsSync(markerPath)).toBe(false);
  });
});

function parseInspectionJsonOutput(output: string): SnapshotInspectionResult {
  return JSON.parse(output) as SnapshotInspectionResult;
}

function parseMigrationPlanJsonOutput(output: string): SnapshotMigrationDryRunPlan {
  return JSON.parse(output) as SnapshotMigrationDryRunPlan;
}

function parseMigrationApplyJsonOutput(output: string): SnapshotMigrationApplyResult {
  return JSON.parse(output) as SnapshotMigrationApplyResult;
}

function parseSnapshotRestoreJsonOutput(output: string): SnapshotRestoreFromBackupResult {
  return JSON.parse(output) as SnapshotRestoreFromBackupResult;
}

function expectSnapshotError(action: () => unknown, code: string): StoreSnapshotError {
  try {
    action();
    throw new Error("expected store snapshot error");
  } catch (error) {
    expect(error).toBeInstanceOf(StoreSnapshotError);
    expect((error as StoreSnapshotError).code).toBe(code);
    expect((error as Error).message).not.toContain("tenant_demo");
    expect((error as Error).message).not.toContain("P0 Teacher");
    return error as StoreSnapshotError;
  }
}

function expectSnapshotFieldError(action: () => unknown, field: string): StoreSnapshotError {
  const error = expectSnapshotError(action, "store_snapshot_corrupted");
  expect(error.cause).toEqual({ field });
  return error;
}

function addCompleteRuntimeCollections(snapshot: Record<string, unknown>): void {
  const parameterSets = snapshot.parameterSets as Record<string, unknown>[];
  parameterSets[0] = {
    ...parameterSets[0],
    parameters: {
      cost_structure: {
        partnership_discount_rate: 0.08,
        partnership_discount_threshold: 4
      },
      demand_curve: {
        max_quality_lift: 0.18,
        price_friction_scale: 5000,
        price_sensitivity: 0.85,
        quality_budget_per_utility: 15000,
        quality_lift_weight: 0.4,
        reference_price: 12000
      },
      operations_constraints: {
        max_capacity_modifier: 1.25,
        min_service_quality_budget: 25000
      },
      schema_version: "wellness.parameters.v1",
      scoring_weights: {
        max_service_quality_bonus: 8,
        service_quality_bonus_per_budget: 0.0001,
        underfunded_service_penalty: 5
      }
    }
  };
  snapshot.sessions = [
    {
      created_at: "2026-06-20T00:00:00.000Z",
      expires_at: "2026-06-21T00:00:00.000Z",
      session_id: "session_structural_snapshot",
      tenant_id: "tenant_demo",
      token_hash: "token_hash_structural_snapshot",
      user_id: "usr_teacher"
    }
  ];
  snapshot.runs = [
    {
      course_id: "course_demo",
      parameter_set_id: "param_toy_approved_1",
      run_id: "run_structural_snapshot",
      scenario_package_id: "scenario_eldercare_demo",
      seed: 20260620,
      status: "active",
      tenant_id: "tenant_demo"
    }
  ];
  snapshot.rounds = [
    {
      decision_batch_id: "batch_structural_snapshot",
      replay_hash: "replay-hash-structural-round",
      round_id: "round_structural_snapshot",
      round_no: 1,
      run_id: "run_structural_snapshot",
      status: "published",
      tenant_id: "tenant_demo"
    }
  ];
  snapshot.decisions = [
    {
      canonical_source: "legacy_direct",
      decision_id: "decision_structural_snapshot",
      merge_commit_id: "merge_structural_snapshot",
      payload: {
        capacity_plan: "hold",
        cash_buffer_target: 0.2,
        marketing_budget: 180000,
        pricing: { base_price: 12000 },
        service_quality_budget: 30000,
        strategy_statement: "Persist a structurally valid strategy."
      },
      round_id: "round_structural_snapshot",
      round_no: 1,
      run_id: "run_structural_snapshot",
      status: "validated",
      submitted_by: "usr_student",
      team_confirmation_id: "confirmation_structural_snapshot",
      team_id: "team_alpha",
      tenant_id: "tenant_demo",
      validation_report: [{ field: "payload", reason: "valid" }],
      version: 1
    }
  ];
  snapshot.settlementResults = [
    {
      parameter_set_id: "param_toy_approved_1",
      replay_hash: "replay-hash-structural-settlement",
      round_id: "round_structural_snapshot",
      round_no: 1,
      run_id: "run_structural_snapshot",
      scenario_package_id: "scenario_eldercare_demo",
      settlement_result_id: "settlement_structural_snapshot",
      team_results: [
        {
          state_est: {
            explanation: "structurally valid settlement",
            next_round_risk: "balanced",
            recommended_focus: "maintain service quality"
          },
          state_obs: {
            demand_band: "medium",
            profit_band: "healthy",
            rank: 1,
            revenue: 1200000,
            score: 88,
            served_demand: 100
          },
          state_true: {
            cash_flow: 250000,
            cost: 950000,
            demand: 110,
            market_share: 1,
            profit: 250000,
            rank: 1,
            revenue: 1200000,
            score: 88,
            served_demand: 100,
            settlement_status: "settled"
          },
          team_id: "team_alpha",
          team_name: "Alpha snapshot"
        }
      ],
      tenant_id: "tenant_demo"
    }
  ];
  snapshot.auditLogs = [
    {
      action: "snapshot.load",
      actor_id: "usr_teacher",
      actor_role: "teacher",
      after: { status: "loaded" },
      audit_id: "audit_structural_snapshot",
      before: { status: "stored" },
      created_at: "2026-06-20T00:00:00.000Z",
      request_id: "request_structural_snapshot",
      resource_id: "snapshot_structural",
      resource_type: "store_snapshot",
      tenant_id: "tenant_demo"
    }
  ];
  snapshot.counters = {
    ...((snapshot.counters as Record<string, unknown> | undefined) ?? {}),
    structural_snapshot: 1
  };
}

function createFailingFileSystem(
  failure: "read-eacces" | "read-eperm" | "read-eio" | "write" | "fsync" | "close" | "rename"
): SnapshotFileSystem {
  const failureError = Object.assign(new Error(`${failure} failure`), {
    code:
      failure === "read-eacces"
        ? "EACCES"
        : failure === "read-eperm"
          ? "EPERM"
          : failure === "read-eio"
            ? "EIO"
            : "TEST_FAILURE"
  });
  let closeFailuresRemaining = failure === "close" ? 1 : 0;

  return {
    readFile(path) {
      if (failure === "read-eacces" || failure === "read-eperm" || failure === "read-eio") {
        throw failureError;
      }

      return readFileSync(path, "utf8");
    },
    mkdir(path) {
      mkdirSync(path, { recursive: true });
    },
    open(path, flags, mode) {
      return openSync(path, flags, mode);
    },
    writeFile(file, data) {
      if (failure === "write") {
        throw failureError;
      }

      writeFileSync(file, data, "utf8");
    },
    fsync(file) {
      if (failure === "fsync") {
        throw failureError;
      }

      fsyncSync(file);
    },
    close(file) {
      if (closeFailuresRemaining > 0) {
        closeFailuresRemaining -= 1;
        throw failureError;
      }

      closeSync(file);
    },
    rename(source, target) {
      if (failure === "rename") {
        throw failureError;
      }

      renameSync(source, target);
    },
    unlink(path) {
      unlinkSync(path);
    }
  };
}

function createRecordingFileSystem(openedPaths: string[]): SnapshotFileSystem {
  return {
    readFile(path) {
      return readFileSync(path, "utf8");
    },
    mkdir(path) {
      mkdirSync(path, { recursive: true });
    },
    open(path, flags, mode) {
      openedPaths.push(path);
      return openSync(path, flags, mode);
    },
    writeFile(file, data) {
      writeFileSync(file, data, "utf8");
    },
    fsync(file) {
      fsyncSync(file);
    },
    close(file) {
      closeSync(file);
    },
    rename(source, target) {
      renameSync(source, target);
    },
    unlink(path) {
      unlinkSync(path);
    }
  };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

describe("JSON store snapshot persistence", () => {
  it("allows a missing snapshot file to initialize and persist the seed snapshot", () => {
    const snapshotPath = createSnapshotPath();

    const store = createP1Store({ persistenceFile: snapshotPath });

    expect(store.persistenceFile).toBe(snapshotPath);
    expect(store.tenants.some((tenant) => tenant.tenant_id === "tenant_demo")).toBe(true);
    expect(existsSync(snapshotPath)).toBe(true);
    expect(JSON.parse(readRaw(snapshotPath))).toMatchObject({
      snapshot_version: 1,
      tenants: expect.any(Array),
      users: expect.any(Array),
      counters: expect.any(Object)
    });
  });

  it("writes the current integer snapshot version on new and replacement snapshots", () => {
    const snapshotPath = createSnapshotPath();
    const store = createP1Store({ persistenceFile: snapshotPath });

    expect(readSnapshot(snapshotPath).snapshot_version).toBe(1);
    expect(Number.isInteger(readSnapshot(snapshotPath).snapshot_version)).toBe(true);

    store.counters.version_replacement = 1;
    store.persist();
    expect(readSnapshot(snapshotPath).snapshot_version).toBe(1);

    store.counters.version_replacement = 2;
    store.persist();
    expect(readSnapshot(snapshotPath).snapshot_version).toBe(1);
  });

  it("does not expose the persisted snapshot version on the runtime store", () => {
    const snapshotPath = createSnapshotPath();
    const store = createP1Store({ persistenceFile: snapshotPath });
    const restored = createP1Store({ persistenceFile: snapshotPath });

    expect("snapshot_version" in store).toBe(false);
    expect("snapshot_version" in restored).toBe(false);
  });

  it("loads an explicit current-version snapshot as normal runtime state", () => {
    const snapshotPath = createSnapshotPath();
    const rawSnapshot = writeSnapshot(snapshotPath, {
      snapshot_version: 1,
      ...createLegacySnapshot({ counters: { current_version: 7 } })
    });

    const store = createP1Store({ persistenceFile: snapshotPath });

    expect(store.counters.current_version).toBe(7);
    expect(store.courses.some((course) => course.course_id === "course_legacy_snapshot")).toBe(
      true
    );
    expect(readRaw(snapshotPath)).toBe(rawSnapshot);
  });

  it("fails closed for an explicit future snapshot version without rewriting the file", () => {
    const snapshotPath = createSnapshotPath();
    const rawSnapshot = writeSnapshot(snapshotPath, {
      snapshot_version: 2,
      ...createLegacySnapshot({ counters: { unsupported_version: 1 } })
    });

    expectSnapshotError(
      () => createP1Store({ persistenceFile: snapshotPath }),
      "store_snapshot_unsupported_version"
    );
    expect(readRaw(snapshotPath)).toBe(rawSnapshot);
  });

  it("fails closed for a large explicit future snapshot version", () => {
    const snapshotPath = createSnapshotPath();
    writeSnapshot(snapshotPath, {
      snapshot_version: Number.MAX_SAFE_INTEGER,
      ...createLegacySnapshot()
    });

    expectSnapshotError(
      () => createP1Store({ persistenceFile: snapshotPath }),
      "store_snapshot_unsupported_version"
    );
  });

  it.each([
    ["string", "1"],
    ["null", null],
    ["boolean", true],
    ["array", [1]],
    ["object", { version: 1 }],
    ["decimal", 1.5],
    ["zero", 0],
    ["negative", -1],
    ["unsafe integer", Number.MAX_SAFE_INTEGER + 1]
  ])("fails closed for an invalid %s snapshot version", (_label, snapshotVersion) => {
    const snapshotPath = createSnapshotPath();
    writeSnapshot(snapshotPath, {
      snapshot_version: snapshotVersion,
      ...createLegacySnapshot()
    });

    expectSnapshotError(
      () => createP1Store({ persistenceFile: snapshotPath }),
      "store_snapshot_invalid_version"
    );
  });

  it("loads a complete legacy v0 snapshot without adding a version field", () => {
    const snapshotPath = createSnapshotPath();
    const rawSnapshot = writeSnapshot(snapshotPath, createLegacySnapshot());

    const store = createP1Store({ persistenceFile: snapshotPath });

    expect(store.courses.some((course) => course.course_id === "course_legacy_snapshot")).toBe(
      true
    );
    expect("snapshot_version" in store).toBe(false);
    expect(readRaw(snapshotPath)).toBe(rawSnapshot);
    expect(readSnapshot(snapshotPath).snapshot_version).toBeUndefined();
  });

  it("loads a structurally valid snapshot containing every persisted collection", () => {
    const snapshotPath = createSnapshotPath();
    const snapshot = cloneLegacySnapshot();
    addCompleteRuntimeCollections(snapshot);
    const tenants = snapshot.tenants as Record<string, unknown>[];
    tenants[0] = { ...tenants[0], unknown_extra: { retained: true } };
    const rawSnapshot = writeSnapshot(snapshotPath, snapshot);

    const store = createP1Store({ persistenceFile: snapshotPath });

    expect(store.sessions).toHaveLength(1);
    expect(store.runs.some((run) => run.run_id === "run_structural_snapshot")).toBe(true);
    expect(store.rounds.some((round) => round.round_id === "round_structural_snapshot")).toBe(true);
    expect(
      store.decisions.some((decision) => decision.decision_id === "decision_structural_snapshot")
    ).toBe(true);
    expect(
      store.settlementResults.some(
        (settlement) => settlement.settlement_result_id === "settlement_structural_snapshot"
      )
    ).toBe(true);
    expect(
      store.auditLogs.some((auditLog) => auditLog.audit_id === "audit_structural_snapshot")
    ).toBe(true);
    expect(store.counters.structural_snapshot).toBe(1);
    expect((store.tenants[0] as Record<string, unknown>).unknown_extra).toEqual({
      retained: true
    });
    expect(readRaw(snapshotPath)).toBe(rawSnapshot);
  });

  it.each([
    ["ordinary object", { hello: "world" }],
    ["incomplete legacy object", { tenants: [], counters: {} }]
  ])("does not treat an unversioned %s as a legacy v0 snapshot", (_label, snapshot) => {
    const snapshotPath = createSnapshotPath();
    const rawSnapshot = writeSnapshot(snapshotPath, snapshot);

    expectSnapshotError(
      () => createP1Store({ persistenceFile: snapshotPath }),
      "store_snapshot_corrupted"
    );
    expect(readRaw(snapshotPath)).toBe(rawSnapshot);
  });

  it("fails loudly for malformed JSON without overwriting the corrupted snapshot", () => {
    const snapshotPath = createSnapshotPath();
    const corrupted = '{"tenants": [';
    writeFileSync(snapshotPath, corrupted, "utf8");

    const error = expectSnapshotError(
      () => createP1Store({ persistenceFile: snapshotPath }),
      "store_snapshot_corrupted"
    );

    expect(error.snapshotPath).toBe(snapshotPath);
    expect(readRaw(snapshotPath)).toBe(corrupted);
  });

  it("treats an empty existing snapshot file as corrupted instead of missing", () => {
    const snapshotPath = createSnapshotPath();
    writeFileSync(snapshotPath, "", "utf8");

    expectSnapshotError(
      () => createP1Store({ persistenceFile: snapshotPath }),
      "store_snapshot_corrupted"
    );

    expect(readRaw(snapshotPath)).toBe("");
  });

  it("treats snapshots missing required top-level collections as corrupted", () => {
    const snapshotPath = createSnapshotPath();
    const incompleteSnapshot = JSON.stringify({ counters: {} });
    writeFileSync(snapshotPath, incompleteSnapshot, "utf8");

    expectSnapshotError(
      () => createP1Store({ persistenceFile: snapshotPath }),
      "store_snapshot_corrupted"
    );

    expect(readRaw(snapshotPath)).toBe(incompleteSnapshot);
  });

  it.each([
    [
      "tenants collection member id",
      (snapshot: Record<string, unknown>) => {
        const tenants = snapshot.tenants as Record<string, unknown>[];
        tenants[0] = { ...tenants[0], tenant_id: 42 };
      },
      "tenants[0].tenant_id"
    ],
    [
      "users collection required password hash",
      (snapshot: Record<string, unknown>) => {
        const users = snapshot.users as Record<string, unknown>[];
        users[0] = { ...users[0] };
        delete users[0].password_hash;
      },
      "users[0].password_hash"
    ],
    [
      "roles collection permission key array",
      (snapshot: Record<string, unknown>) => {
        const roles = snapshot.roles as Record<string, unknown>[];
        roles[0] = { ...roles[0], permission_keys: [42] };
      },
      "roles[0].permission_keys[0]"
    ],
    [
      "permissions collection key enum",
      (snapshot: Record<string, unknown>) => {
        const permissions = snapshot.permissions as Record<string, unknown>[];
        permissions[0] = { ...permissions[0], key: "not:a-permission" };
      },
      "permissions[0].key"
    ],
    [
      "userRoles collection role id",
      (snapshot: Record<string, unknown>) => {
        const userRoles = snapshot.userRoles as Record<string, unknown>[];
        userRoles[0] = { ...userRoles[0], role_id: 42 };
      },
      "userRoles[0].role_id"
    ],
    [
      "rolePermissions collection permission id",
      (snapshot: Record<string, unknown>) => {
        const rolePermissions = snapshot.rolePermissions as Record<string, unknown>[];
        rolePermissions[0] = { ...rolePermissions[0], permission_id: 42 };
      },
      "rolePermissions[0].permission_id"
    ],
    [
      "sessions collection token hash",
      (snapshot: Record<string, unknown>) => {
        addCompleteRuntimeCollections(snapshot);
        const sessions = snapshot.sessions as Record<string, unknown>[];
        sessions[0] = { ...sessions[0], token_hash: 42 };
      },
      "sessions[0].token_hash"
    ],
    [
      "scenarios collection plugin package id array",
      (snapshot: Record<string, unknown>) => {
        const scenarios = snapshot.scenarios as Record<string, unknown>[];
        scenarios[0] = { ...scenarios[0], plugin_package_ids: [42] };
      },
      "scenarios[0].plugin_package_ids[0]"
    ],
    [
      "parameterSets collection numeric seed",
      (snapshot: Record<string, unknown>) => {
        const parameterSets = snapshot.parameterSets as Record<string, unknown>[];
        parameterSets[0] = { ...parameterSets[0], seed: "44" };
      },
      "parameterSets[0].seed"
    ],
    [
      "parameterSets collection optional wellness parameter structure",
      (snapshot: Record<string, unknown>) => {
        addCompleteRuntimeCollections(snapshot);
        const parameterSets = snapshot.parameterSets as Record<string, unknown>[];
        const parameterSet = parameterSets[0] as Record<string, unknown>;
        const parameters = parameterSet.parameters as Record<string, unknown>;
        const demandCurve = parameters.demand_curve as Record<string, unknown>;
        parameterSet.parameters = {
          ...parameters,
          demand_curve: { ...demandCurve, reference_price: "12000" }
        };
      },
      "parameterSets[0].parameters.demand_curve.reference_price"
    ],
    [
      "courses collection scenario package id",
      (snapshot: Record<string, unknown>) => {
        const courses = snapshot.courses as Record<string, unknown>[];
        courses[0] = { ...courses[0], scenario_package_id: 42 };
      },
      "courses[0].scenario_package_id"
    ],
    [
      "teams collection member role slot",
      (snapshot: Record<string, unknown>) => {
        const teams = snapshot.teams as Record<string, unknown>[];
        teams[0] = {
          ...teams[0],
          members: [{ display_name: "P0 Student", role_slot: "CIO", user_id: "usr_student" }]
        };
      },
      "teams[0].members[0].role_slot"
    ],
    [
      "runs collection parameter set id",
      (snapshot: Record<string, unknown>) => {
        addCompleteRuntimeCollections(snapshot);
        const runs = snapshot.runs as Record<string, unknown>[];
        runs[0] = { ...runs[0], parameter_set_id: 42 };
      },
      "runs[0].parameter_set_id"
    ],
    [
      "rounds collection run id",
      (snapshot: Record<string, unknown>) => {
        addCompleteRuntimeCollections(snapshot);
        const rounds = snapshot.rounds as Record<string, unknown>[];
        rounds[0] = { ...rounds[0], run_id: 42 };
      },
      "rounds[0].run_id"
    ],
    [
      "decisions collection payload",
      (snapshot: Record<string, unknown>) => {
        addCompleteRuntimeCollections(snapshot);
        const decisions = snapshot.decisions as Record<string, unknown>[];
        const decision = decisions[0] as Record<string, unknown>;
        decision.payload = {
          ...(decision.payload as Record<string, unknown>),
          pricing: { base_price: "12000" }
        };
      },
      "decisions[0].payload.pricing.base_price"
    ],
    [
      "settlementResults collection nested truth field",
      (snapshot: Record<string, unknown>) => {
        addCompleteRuntimeCollections(snapshot);
        const settlementResults = snapshot.settlementResults as Record<string, unknown>[];
        const settlement = settlementResults[0] as Record<string, unknown>;
        const teamResults = settlement.team_results as Record<string, unknown>[];
        const teamResult = teamResults[0] as Record<string, unknown>;
        const stateTrue = teamResult.state_true as Record<string, unknown>;
        teamResult.state_true = { ...stateTrue, profit: "250000" };
      },
      "settlementResults[0].team_results[0].state_true.profit"
    ],
    [
      "auditLogs collection actor role",
      (snapshot: Record<string, unknown>) => {
        addCompleteRuntimeCollections(snapshot);
        const auditLogs = snapshot.auditLogs as Record<string, unknown>[];
        auditLogs[0] = { ...auditLogs[0], actor_role: "owner" };
      },
      "auditLogs[0].actor_role"
    ],
    [
      "counters object numeric value",
      (snapshot: Record<string, unknown>) => {
        const counters = snapshot.counters as Record<string, unknown>;
        counters.bad_counter = "1";
      },
      "counters.bad_counter"
    ]
  ])(
    "treats a snapshot containing a malformed %s as corrupted with a safe path",
    (_label, mutate, field) => {
      const snapshotPath = createSnapshotPath();
      const snapshot = cloneLegacySnapshot();
      mutate(snapshot);
      const rawSnapshot = writeSnapshot(snapshotPath, snapshot);

      expectSnapshotFieldError(() => createP1Store({ persistenceFile: snapshotPath }), field);
      expect(readRaw(snapshotPath)).toBe(rawSnapshot);
    }
  );

  it("reports deep validation errors without leaking sensitive payload values", () => {
    const snapshotPath = createSnapshotPath();
    const sensitiveSentinel = "SENSITIVE_SENTINEL_PASSWORD_TOKEN";
    const snapshot = cloneLegacySnapshot();
    addCompleteRuntimeCollections(snapshot);
    const decisions = snapshot.decisions as Record<string, unknown>[];
    const decision = decisions[0] as Record<string, unknown>;
    decision.payload = {
      ...(decision.payload as Record<string, unknown>),
      pricing: { base_price: "12000" },
      strategy_statement: sensitiveSentinel
    };
    const rawSnapshot = writeSnapshot(snapshotPath, snapshot);

    const error = expectSnapshotFieldError(
      () => createP1Store({ persistenceFile: snapshotPath }),
      "decisions[0].payload.pricing.base_price"
    );

    expect(error.message).not.toContain(sensitiveSentinel);
    expect(JSON.stringify(error.cause)).not.toContain(sensitiveSentinel);
    expect(readRaw(snapshotPath)).toBe(rawSnapshot);
  });

  it("does not create backup, quarantine, or recovery side files during load failures", () => {
    const cases: Array<{
      code: string;
      name: string;
      write: (path: string) => string;
    }> = [
      {
        code: "store_snapshot_unsupported_version",
        name: "future version",
        write(path) {
          return writeSnapshot(path, {
            snapshot_version: 2,
            ...createLegacySnapshot()
          });
        }
      },
      {
        code: "store_snapshot_invalid_version",
        name: "invalid version",
        write(path) {
          return writeSnapshot(path, {
            snapshot_version: "1",
            ...createLegacySnapshot()
          });
        }
      },
      {
        code: "store_snapshot_corrupted",
        name: "corrupted JSON",
        write(path) {
          const raw = '{"tenants": [';
          writeFileSync(path, raw, "utf8");
          return raw;
        }
      },
      {
        code: "store_snapshot_corrupted",
        name: "deep validation failure",
        write(path) {
          const snapshot = cloneLegacySnapshot();
          const users = snapshot.users as Record<string, unknown>[];
          users[0] = { ...users[0] };
          delete users[0].password_hash;
          return writeSnapshot(path, snapshot);
        }
      }
    ];

    for (const { code, name, write } of cases) {
      const snapshotPath = createSnapshotPath(`${name.replace(/\W+/g, "-")}.json`);
      const rawSnapshot = write(snapshotPath);
      const expectedEntries = [basename(snapshotPath)];

      expect(readdirSync(join(snapshotPath, "..")).sort()).toEqual(expectedEntries);
      expectSnapshotError(() => createP1Store({ persistenceFile: snapshotPath }), code);
      expect(readRaw(snapshotPath)).toBe(rawSnapshot);
      expect(readdirSync(join(snapshotPath, "..")).sort()).toEqual(expectedEntries);
    }
  });

  it("fails read errors without falling back to seed data", () => {
    const snapshotPath = createSnapshotPath();

    for (const failure of ["read-eacces", "read-eperm", "read-eio"] as const) {
      expectSnapshotError(
        () =>
          createP1Store({
            fileSystem: createFailingFileSystem(failure),
            persistenceFile: snapshotPath
          }),
        "store_snapshot_read_failed"
      );
    }
  });

  it("persists through a same-directory temp file and leaves no temp file after success", () => {
    const snapshotPath = createSnapshotPath();
    const store = createP1Store({ persistenceFile: snapshotPath });

    store.courses.push({
      course_id: "course_snapshot_success",
      created_by: "usr_teacher",
      parameter_set_id: "param_toy_approved_1",
      scenario_package_id: "scenario_eldercare_demo",
      status: "draft",
      tenant_id: "tenant_demo",
      title: "Snapshot Success"
    });
    store.persist();

    const persisted = JSON.parse(readRaw(snapshotPath)) as SimWarStore;
    expect(persisted.courses.some((course) => course.course_id === "course_snapshot_success")).toBe(
      true
    );
    expect(tempFilesFor(snapshotPath)).toEqual([]);
  });

  it("round-trips a newly created snapshot through disk", () => {
    const snapshotPath = createSnapshotPath();
    const store = createP1Store({ persistenceFile: snapshotPath });

    store.courses.push({
      course_id: "course_roundtrip_new",
      created_by: "usr_teacher",
      parameter_set_id: "param_toy_approved_1",
      scenario_package_id: "scenario_eldercare_demo",
      status: "draft",
      tenant_id: "tenant_demo",
      title: "New Snapshot Round Trip"
    });
    store.persist();

    const restored = createP1Store({ persistenceFile: snapshotPath });
    expect(restored.courses.some((course) => course.course_id === "course_roundtrip_new")).toBe(
      true
    );
    expect(tempFilesFor(snapshotPath)).toEqual([]);
  });

  it("safely replaces an existing snapshot and reloads only the committed contents", () => {
    const snapshotPath = createSnapshotPath();
    const original = writeValidSnapshot(snapshotPath);
    const store = createP1Store({ persistenceFile: snapshotPath });

    store.counters.safe_replace = 1;
    store.persist();

    const replacement = readRaw(snapshotPath);
    const restored = createP1Store({ persistenceFile: snapshotPath });
    expect(replacement).not.toBe(original);
    expect(restored.counters.safe_replace).toBe(1);
    expect(tempFilesFor(snapshotPath)).toEqual([]);
  });

  it("uses distinct temp files for independent writers targeting the same snapshot path", () => {
    const snapshotPath = createSnapshotPath();
    writeValidSnapshot(snapshotPath);
    const openedPaths: string[] = [];
    const fileSystem = createRecordingFileSystem(openedPaths);
    const firstStore = createP1Store({ fileSystem, persistenceFile: snapshotPath });
    const secondStore = createP1Store({ fileSystem, persistenceFile: snapshotPath });

    firstStore.counters.concurrent_writer_first = 1;
    secondStore.counters.concurrent_writer_second = 1;
    firstStore.persist();
    secondStore.persist();

    const tempPaths = openedPaths.filter((path) => path.endsWith(".tmp"));
    expect(tempPaths).toHaveLength(2);
    expect(new Set(tempPaths).size).toBe(2);
    for (const path of tempPaths) {
      expect(path).toContain(`${basename(snapshotPath)}.`);
    }
    expect(tempFilesFor(snapshotPath)).toEqual([]);
  });

  it("characterizes unsupported stale writer overwrite as a complete replacement", () => {
    const snapshotPath = createSnapshotPath();
    writeValidSnapshot(snapshotPath);
    const staleStore = createP1Store({ persistenceFile: snapshotPath });
    const newerStore = createP1Store({ persistenceFile: snapshotPath });

    staleStore.counters.stale_writer = 1;
    newerStore.counters.newer_writer = 1;
    newerStore.persist();
    const newerRaw = readRaw(snapshotPath);
    expect(readSnapshot(snapshotPath).counters).toMatchObject({ newer_writer: 1 });

    staleStore.persist();

    const finalRaw = readRaw(snapshotPath);
    const finalSnapshot = readSnapshot(snapshotPath);
    const restored = createP1Store({ persistenceFile: snapshotPath });
    expect(finalRaw).not.toBe(newerRaw);
    expect(finalSnapshot.counters).toMatchObject({ stale_writer: 1 });
    expect(finalSnapshot.counters).not.toHaveProperty("newer_writer");
    expect(restored.counters.stale_writer).toBe(1);
    expect(restored.counters.newer_writer).toBeUndefined();
    expect(tempFilesFor(snapshotPath)).toEqual([]);
  });

  it.each([
    ["write", "store_snapshot_write_failed"],
    ["fsync", "store_snapshot_sync_failed"],
    ["rename", "store_snapshot_rename_failed"]
  ] as const)(
    "preserves the existing snapshot and cleans temp files when temp %s fails",
    (failure, code) => {
      const snapshotPath = createSnapshotPath();
      const original = writeValidSnapshot(snapshotPath);
      const store = createP1Store({
        fileSystem: createFailingFileSystem(failure),
        persistenceFile: snapshotPath
      });

      store.counters.failure_case = 1;

      expectSnapshotError(() => store.persist(), code);
      expect(readRaw(snapshotPath)).toBe(original);
      expect(tempFilesFor(snapshotPath)).toEqual([]);
    }
  );

  it("reports temp close failures against the authoritative snapshot path", () => {
    const snapshotPath = createSnapshotPath();
    const original = writeValidSnapshot(snapshotPath);
    const store = createP1Store({
      fileSystem: createFailingFileSystem("close"),
      persistenceFile: snapshotPath
    });

    store.counters.close_failure = 1;

    const error = expectSnapshotError(() => store.persist(), "store_snapshot_sync_failed");
    expect(error.snapshotPath).toBe(snapshotPath);
    expect(readRaw(snapshotPath)).toBe(original);
    expect(tempFilesFor(snapshotPath)).toEqual([]);
  });

  it("can persist normally after a failed write attempt", () => {
    const snapshotPath = createSnapshotPath();
    const original = writeValidSnapshot(snapshotPath);
    const failingStore = createP1Store({
      fileSystem: createFailingFileSystem("rename"),
      persistenceFile: snapshotPath
    });

    failingStore.counters.failed_attempt = 1;
    expectSnapshotError(() => failingStore.persist(), "store_snapshot_rename_failed");
    expect(readRaw(snapshotPath)).toBe(original);

    const recoveredStore = createP1Store({ persistenceFile: snapshotPath });
    recoveredStore.counters.recovered_attempt = 1;
    recoveredStore.persist();

    const restored = createP1Store({ persistenceFile: snapshotPath });
    expect(restored.counters.failed_attempt).toBeUndefined();
    expect(restored.counters.recovered_attempt).toBe(1);
    expect(tempFilesFor(snapshotPath)).toEqual([]);
  });

  it.each([
    ["empty file", ""],
    ["truncated JSON", '{"tenants": ['],
    ["illegal JSON", "{not json"],
    ["wrong root array", "[]"],
    ["wrong root scalar", "42"],
    ["missing required collections", JSON.stringify({ counters: {} })]
  ])("treats %s as corruption instead of missing or seed data", (_label, contents) => {
    const snapshotPath = createSnapshotPath();
    writeFileSync(snapshotPath, contents, "utf8");

    expectSnapshotError(
      () => createP1Store({ persistenceFile: snapshotPath }),
      "store_snapshot_corrupted"
    );
    expect(readRaw(snapshotPath)).toBe(contents);
  });

  it("round-trips representative multi-round simulation state", () => {
    const snapshotPath = createSnapshotPath();
    const store = createP1Store({ persistenceFile: snapshotPath });

    store.runs.push({
      course_id: "course_demo",
      parameter_set_id: "param_toy_approved_1",
      run_id: "run_snapshot_context",
      scenario_package_id: "scenario_eldercare_demo",
      seed: 20260620,
      status: "active",
      tenant_id: "tenant_demo"
    });
    store.rounds.push(
      {
        round_id: "round_snapshot_context_1",
        round_no: 1,
        run_id: "run_snapshot_context",
        status: "published",
        tenant_id: "tenant_demo"
      },
      {
        round_id: "round_snapshot_context_2",
        round_no: 2,
        run_id: "run_snapshot_context",
        status: "open",
        tenant_id: "tenant_demo"
      }
    );
    store.decisions.push({
      decision_id: "decision_snapshot_context_1",
      payload: {
        capacity_plan: "hold",
        cash_buffer_target: 0.2,
        marketing_budget: 180000,
        pricing: { base_price: 12000 },
        service_quality_budget: 30000,
        strategy_statement: "Persist a balanced multi-round strategy."
      },
      round_id: "round_snapshot_context_1",
      round_no: 1,
      run_id: "run_snapshot_context",
      status: "submitted",
      submitted_by: "usr_student",
      team_id: "team_alpha",
      tenant_id: "tenant_demo",
      validation_report: [],
      version: 1
    });
    store.settlementResults.push({
      parameter_set_id: "param_toy_approved_1",
      replay_hash: "replay-hash-snapshot-context",
      round_id: "round_snapshot_context_1",
      round_no: 1,
      run_id: "run_snapshot_context",
      scenario_package_id: "scenario_eldercare_demo",
      settlement_result_id: "settlement_snapshot_context_1",
      team_results: [
        {
          state_est: {
            explanation: "round one persisted",
            next_round_risk: "balanced",
            recommended_focus: "maintain service quality"
          },
          state_obs: {
            demand_band: "medium",
            profit_band: "healthy",
            rank: 1,
            revenue: 1200000,
            score: 88,
            served_demand: 100
          },
          state_true: {
            cash_flow: 250000,
            cost: 950000,
            demand: 110,
            market_share: 1,
            profit: 250000,
            rank: 1,
            revenue: 1200000,
            score: 88,
            served_demand: 100,
            settlement_status: "settled"
          },
          team_id: "team_alpha",
          team_name: "Alpha snapshot"
        }
      ],
      tenant_id: "tenant_demo"
    });
    store.persist();

    const restored = createP1Store({ persistenceFile: snapshotPath });
    expect(restored.runs.find((run) => run.run_id === "run_snapshot_context")?.seed).toBe(20260620);
    expect(
      restored.rounds
        .filter((round) => round.run_id === "run_snapshot_context")
        .map((round) => round.round_no)
    ).toEqual([1, 2]);
    expect(
      restored.decisions.find((decision) => decision.decision_id === "decision_snapshot_context_1")
        ?.payload.pricing.base_price
    ).toBe(12000);
    expect(
      restored.settlementResults.find(
        (settlement) => settlement.settlement_result_id === "settlement_snapshot_context_1"
      )?.team_results[0]?.state_true.profit
    ).toBe(250000);
  });

  it("keeps tenant, course, team, and run boundaries intact across snapshot reload", () => {
    const snapshotPath = createSnapshotPath();
    const store = createP1Store({ persistenceFile: snapshotPath });

    store.scenarios.push({
      name: "Other Tenant Snapshot Scenario",
      plugin_package_ids: [],
      scenario_package_id: "scenario_other_snapshot",
      status: "approved",
      tenant_id: "tenant_other",
      version: "1.0.0"
    });
    store.parameterSets.push({
      base_capacity: 90,
      base_market_size: 180,
      fixed_cost: 90000,
      model_family: "toy_logit",
      parameter_set_id: "param_other_snapshot",
      seed: 44,
      status: "approved",
      tenant_id: "tenant_other",
      unit_cost: 4000,
      version: "1.0.0"
    });
    store.courses.push({
      course_id: "course_other_snapshot",
      created_by: "usr_other_teacher",
      parameter_set_id: "param_other_snapshot",
      scenario_package_id: "scenario_other_snapshot",
      status: "published",
      tenant_id: "tenant_other",
      title: "Other Tenant Snapshot Course"
    });
    store.teams.push({
      captain_user_id: "usr_other_teacher",
      course_id: "course_other_snapshot",
      members: [{ display_name: "Other Teacher", role_slot: "CEO", user_id: "usr_other_teacher" }],
      name: "Other tenant team",
      team_id: "team_other_snapshot",
      tenant_id: "tenant_other"
    });
    store.runs.push({
      course_id: "course_other_snapshot",
      parameter_set_id: "param_other_snapshot",
      run_id: "run_other_snapshot",
      scenario_package_id: "scenario_other_snapshot",
      seed: 44,
      status: "active",
      tenant_id: "tenant_other"
    });
    store.persist();

    const restored = createP1Store({ persistenceFile: snapshotPath });
    expect(
      restored.courses.find((course) => course.course_id === "course_other_snapshot")
    ).toMatchObject({ course_id: "course_other_snapshot", tenant_id: "tenant_other" });
    expect(restored.teams.find((team) => team.team_id === "team_other_snapshot")).toMatchObject({
      course_id: "course_other_snapshot",
      team_id: "team_other_snapshot",
      tenant_id: "tenant_other"
    });
    expect(restored.runs.find((run) => run.run_id === "run_other_snapshot")).toMatchObject({
      course_id: "course_other_snapshot",
      run_id: "run_other_snapshot",
      tenant_id: "tenant_other"
    });
    expect(restored.teams.find((team) => team.team_id === "team_alpha")).toMatchObject({
      course_id: "course_demo",
      tenant_id: "tenant_demo"
    });
  });

  it("fails serialization before changing the existing snapshot", () => {
    const snapshotPath = createSnapshotPath();
    const original = writeValidSnapshot(snapshotPath);
    const store = createP1Store({ persistenceFile: snapshotPath });
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    store.counters.cyclic = cyclic as never;

    expect(() => store.persist()).toThrow(TypeError);
    expect(readRaw(snapshotPath)).toBe(original);
    expect(tempFilesFor(snapshotPath)).toEqual([]);
  });
});

describe("JSON snapshot concurrency policy characterization", () => {
  it("characterizes current unsupported stale-writer behavior as last successful replace wins", () => {
    const snapshotPath = createSnapshotPath("no-cas-stale-writer.json");
    writeValidSnapshot(snapshotPath);
    const writerA = createP1Store({ persistenceFile: snapshotPath });
    const writerB = createP1Store({ persistenceFile: snapshotPath });

    writerA.counters.no_cas_writer_a = 1;
    writerB.counters.no_cas_writer_b = 1;
    writerA.persist();
    expect(readSnapshot(snapshotPath).counters).toMatchObject({ no_cas_writer_a: 1 });

    writerB.persist();

    const finalSnapshot = readSnapshot(snapshotPath);
    expect(finalSnapshot.counters).toMatchObject({ no_cas_writer_b: 1 });
    expect(finalSnapshot.counters).not.toHaveProperty("no_cas_writer_a");
    expect(createP1Store({ persistenceFile: snapshotPath }).counters.no_cas_writer_b).toBe(1);
    expect(tempFilesFor(snapshotPath)).toEqual([]);
  });

  it("shows crash-safe temp replacement is separate from stale-writer detection", () => {
    const snapshotPath = createSnapshotPath("crash-safe-not-cas.json");
    writeValidSnapshot(snapshotPath);
    const openedPaths: string[] = [];
    const fileSystem = createRecordingFileSystem(openedPaths);
    const firstWriter = createP1Store({ fileSystem, persistenceFile: snapshotPath });
    const secondWriter = createP1Store({ fileSystem, persistenceFile: snapshotPath });

    firstWriter.counters.crash_safe_first = 1;
    secondWriter.counters.crash_safe_second = 1;
    firstWriter.persist();
    secondWriter.persist();

    const tempPaths = openedPaths.filter((path) => path.endsWith(".tmp"));
    const finalSnapshot = readSnapshot(snapshotPath);
    expect(tempPaths).toHaveLength(2);
    expect(new Set(tempPaths).size).toBe(2);
    expect(finalSnapshot.counters).toMatchObject({ crash_safe_second: 1 });
    expect(finalSnapshot.counters).not.toHaveProperty("crash_safe_first");
    expect(tempFilesFor(snapshotPath)).toEqual([]);
  });

  it("characterizes explicit migration apply and restore as CAS-protected maintenance paths", () => {
    const applyPath = createSnapshotPath("cas-protected-apply.json");
    const restoreBackupPath = createSnapshotPath("cas-protected-restore-backup.bak");
    const restoreTargetPath = createSnapshotPath("cas-protected-restore-target.json");
    writeSnapshot(applyPath, createLegacySnapshot({ counters: { apply_cas_protected: 1 } }));
    writeSnapshot(restoreBackupPath, {
      snapshot_version: 1,
      ...createLegacySnapshot({ counters: { restore_cas_protected: 1 } })
    });
    writeValidSnapshot(restoreTargetPath);

    const applyResult = applySnapshotMigrationToCurrentVersion(applyPath);
    const restoreResult = restoreSnapshotFromBackup(restoreBackupPath, restoreTargetPath);

    expect(applyResult).toMatchObject({
      action: "migrated_legacy_to_current",
      status: "applied"
    });
    expect(applyResult.backupPath).toBeTruthy();
    expect(inspectPersistedSnapshotFile(applyPath)).toMatchObject({ ok: true, status: "valid_v1" });
    expect(restoreResult).toMatchObject({
      action: "restored_backup_to_target",
      status: "restored",
      targetExistedBeforeRestore: true
    });
    expect(restoreResult.preRestoreBackupPath).toBeTruthy();
    expect(inspectPersistedSnapshotFile(restoreTargetPath)).toMatchObject({
      ok: true,
      status: "valid_v1"
    });
    expect(tempFilesFor(applyPath)).toEqual([]);
    expect(tempFilesFor(restoreTargetPath)).toEqual([]);
  });

  it("documents the runtime persist CAS policy audit and future #138 direction", () => {
    const policy = readFileSync(
      join(process.cwd(), "docs/devops/json-snapshot-concurrency-policy.md"),
      "utf8"
    );

    expect(policy).toContain("Runtime store persist remains not");
    expect(policy).toContain("stale-writer-safe");
    expect(policy).toContain(
      "The runtime store persist policy is last successful atomic replace wins"
    );
    expect(policy).toContain(
      "Explicit migration apply and restore use expected-current conflict detection"
    );
    expect(policy).toContain("Runtime store persist does not");
    expect(policy).toContain("There is no lock");
    expect(policy).toContain("store_snapshot_write_conflict");
    expect(policy).toContain("snapshot_version is a persisted format version only");
    expect(policy).toContain("entity updated_at is not a snapshot write precondition");
    expect(policy).toContain("replay_hash is not a snapshot CAS token");
    expect(policy).toContain("CAS Wiring For Explicit Migration Apply And Restore");
    expect(policy).toContain("Runtime Persist CAS Policy Audit");
    expect(policy).toContain("Runtime `createP1Store().persist` remains no-CAS by policy");
    expect(policy).toContain("Runtime persist CAS is not required for #138 closeout");
    expect(policy).toContain("READY TO CLOSE #138");
    expect(policy).toContain("P1-026B - Close #138 with final evidence comment");
    expect(policy).toContain("Future CAS Direction After #138");
    expect(policy).toContain("#139 local migration/recovery tooling is complete and closed");
  });
});

describe("JSON snapshot write metadata", () => {
  function sha256Hex(raw: string): string {
    return createHash("sha256").update(raw, "utf8").digest("hex");
  }

  it("returns safe raw file metadata for a valid v1 snapshot", () => {
    const snapshotPath = createSnapshotPath("write-metadata-valid-v1.json");
    const rawSnapshot = writeValidSnapshot(snapshotPath);

    const metadata = readSnapshotWriteMetadata(snapshotPath);

    expect(metadata).toMatchObject({
      contentSha256: sha256Hex(rawSnapshot),
      filePath: snapshotPath,
      sizeBytes: Buffer.byteLength(rawSnapshot, "utf8"),
      status: "found"
    });
    if (metadata.status !== "found") {
      throw new Error("expected found metadata");
    }
    expect(metadata.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(metadata.mtimeMs).toBeGreaterThan(0);
    expect(metadata.mtimeIso).toBe(new Date(metadata.mtimeMs).toISOString());
    expect(JSON.stringify(metadata)).not.toContain("tenants");
    expect(JSON.stringify(metadata)).not.toContain("password_hash");
    expect(JSON.stringify(metadata)).not.toContain("payload");
    expect(tempFilesFor(snapshotPath)).toEqual([]);
    expect(backupFilesFor(snapshotPath)).toEqual([]);
  });

  it("returns not_found for a missing snapshot without creating files or directories", () => {
    const missingDirectory = join(createTempDir(), "missing-metadata-directory");
    const missingPath = join(missingDirectory, "missing-snapshot.json");

    const metadata = readSnapshotWriteMetadata(missingPath);

    expect(metadata).toEqual({
      filePath: missingPath,
      status: "not_found"
    });
    expect(existsSync(missingPath)).toBe(false);
    expect(existsSync(missingDirectory)).toBe(false);
  });

  it("returns raw metadata for corrupt JSON without treating it as valid snapshot data", () => {
    const snapshotPath = createSnapshotPath("write-metadata-corrupt.json");
    const rawSnapshot = '{"snapshot_version":1,"payload":"SENSITIVE_DECISION_PAYLOAD_SENTINEL",';
    writeRaw(snapshotPath, rawSnapshot);

    const metadata = readSnapshotWriteMetadata(snapshotPath);

    expect(metadata).toMatchObject({
      contentSha256: sha256Hex(rawSnapshot),
      filePath: snapshotPath,
      sizeBytes: Buffer.byteLength(rawSnapshot, "utf8"),
      status: "found"
    });
    expect(JSON.stringify(metadata)).not.toContain("SENSITIVE_DECISION_PAYLOAD_SENTINEL");
    expect(JSON.stringify(metadata)).not.toContain("payload");
    expect(inspectPersistedSnapshotFile(snapshotPath)).toMatchObject({
      ok: false,
      status: "corrupt_json"
    });
    expect(readRaw(snapshotPath)).toBe(rawSnapshot);
  });

  it("provides stable raw-byte checksums for identical bytes and different checksums for changes", () => {
    const firstPath = createSnapshotPath("write-metadata-first.json");
    const secondPath = createSnapshotPath("write-metadata-second.json");
    const firstRaw = writeRaw(firstPath, '{"snapshot_version":1}\n');
    writeRaw(secondPath, firstRaw);

    const firstMetadata = readSnapshotWriteMetadata(firstPath);
    const secondMetadata = readSnapshotWriteMetadata(secondPath);
    writeRaw(secondPath, '{"snapshot_version":1,"changed":true}\n');
    const changedMetadata = readSnapshotWriteMetadata(secondPath);

    expect(firstMetadata.status).toBe("found");
    expect(secondMetadata.status).toBe("found");
    expect(changedMetadata.status).toBe("found");
    if (
      firstMetadata.status !== "found" ||
      secondMetadata.status !== "found" ||
      changedMetadata.status !== "found"
    ) {
      throw new Error("expected found metadata");
    }
    expect(firstMetadata.contentSha256).toBe(secondMetadata.contentSha256);
    expect(changedMetadata.contentSha256).not.toBe(firstMetadata.contentSha256);
    expect(changedMetadata.contentSha256).toBe(sha256Hex(readRaw(secondPath)));
  });

  it("does not prevent the current unsupported stale-writer overwrite behavior", () => {
    const snapshotPath = createSnapshotPath("write-metadata-not-cas.json");
    writeValidSnapshot(snapshotPath);
    const writerA = createP1Store({ persistenceFile: snapshotPath });
    const writerB = createP1Store({ persistenceFile: snapshotPath });
    const beforeMetadata = readSnapshotWriteMetadata(snapshotPath);

    writerA.counters.metadata_writer_a = 1;
    writerB.counters.metadata_writer_b = 1;
    writerA.persist();
    writerB.persist();

    const afterMetadata = readSnapshotWriteMetadata(snapshotPath);
    const finalSnapshot = readSnapshot(snapshotPath);
    expect(beforeMetadata.status).toBe("found");
    expect(afterMetadata.status).toBe("found");
    expect(finalSnapshot.counters).toMatchObject({ metadata_writer_b: 1 });
    expect(finalSnapshot.counters).not.toHaveProperty("metadata_writer_a");
  });
});

describe("JSON snapshot CAS-capable writer API", () => {
  function snapshotContentsWithCounter(name: string, value: number): string {
    const sourcePath = createSnapshotPath(`${name}.json`);
    const store = createP1Store({ persistenceFile: sourcePath });
    store.counters[name] = value;
    store.persist();
    return readRaw(sourcePath);
  }

  function expectConflict(error: unknown): StoreSnapshotError {
    expect(error).toBeInstanceOf(StoreSnapshotError);
    const snapshotError = error as StoreSnapshotError;
    expect(snapshotError.code).toBe("store_snapshot_write_conflict");
    return snapshotError;
  }

  it("writes when expected found metadata matches the current snapshot", () => {
    const snapshotPath = createSnapshotPath("cas-writer-found-success.json");
    writeValidSnapshot(snapshotPath);
    const expectedMetadata = readSnapshotWriteMetadata(snapshotPath);
    const replacement = snapshotContentsWithCounter("cas_writer_replacement", 1);

    persistSnapshotAtomicallyWithExpectedMetadata(snapshotPath, replacement, expectedMetadata);

    expect(readSnapshot(snapshotPath).counters).toMatchObject({ cas_writer_replacement: 1 });
    expect(inspectPersistedSnapshotFile(snapshotPath)).toMatchObject({
      ok: true,
      status: "valid_v1"
    });
    expect(tempFilesFor(snapshotPath)).toEqual([]);
    expect(backupFilesFor(snapshotPath)).toEqual([]);
  });

  it("throws a deterministic conflict and preserves current bytes when expected found metadata is stale", () => {
    const snapshotPath = createSnapshotPath("cas-writer-found-conflict.json");
    const original = writeValidSnapshot(snapshotPath);
    const staleMetadata = readSnapshotWriteMetadata(snapshotPath);
    const current = snapshotContentsWithCounter("cas_writer_current", 2);
    const staleWrite = snapshotContentsWithCounter("cas_writer_stale", 3);
    writeRaw(snapshotPath, current);

    let thrown: unknown;
    try {
      persistSnapshotAtomicallyWithExpectedMetadata(snapshotPath, staleWrite, staleMetadata);
    } catch (error) {
      thrown = error;
    }

    const snapshotError = expectConflict(thrown);
    expect(snapshotError.snapshotPath).toBe(snapshotPath);
    expect(JSON.stringify(snapshotError)).toContain("store_snapshot_write_conflict");
    expect(JSON.stringify(snapshotError)).toContain("found");
    expect(JSON.stringify(snapshotError)).toContain("contentSha256");
    expect(JSON.stringify(snapshotError)).not.toContain("cas_writer_stale");
    expect(JSON.stringify(snapshotError)).not.toContain("tenants");
    expect(JSON.stringify(snapshotError)).not.toContain(original);
    expect(readRaw(snapshotPath)).toBe(current);
    expect(tempFilesFor(snapshotPath)).toEqual([]);
    expect(backupFilesFor(snapshotPath)).toEqual([]);
  });

  it("creates a missing target when expected metadata is not_found", () => {
    const missingDirectory = createTempDir();
    const snapshotPath = join(missingDirectory, "cas-writer-missing-success.json");
    const expectedMetadata = readSnapshotWriteMetadata(snapshotPath);
    const replacement = snapshotContentsWithCounter("cas_writer_missing_create", 4);

    persistSnapshotAtomicallyWithExpectedMetadata(snapshotPath, replacement, expectedMetadata);

    expect(readSnapshot(snapshotPath).counters).toMatchObject({
      cas_writer_missing_create: 4
    });
    expect(inspectPersistedSnapshotFile(snapshotPath)).toMatchObject({
      ok: true,
      status: "valid_v1"
    });
    expect(tempFilesFor(snapshotPath)).toEqual([]);
    expect(backupFilesFor(snapshotPath)).toEqual([]);
  });

  it("throws conflict and preserves existing target when expected metadata is not_found but target exists", () => {
    const snapshotPath = createSnapshotPath("cas-writer-missing-conflict.json");
    const missingMetadata = readSnapshotWriteMetadata(snapshotPath);
    const current = snapshotContentsWithCounter("cas_writer_existing_after_missing", 5);
    const staleWrite = snapshotContentsWithCounter("cas_writer_missing_stale", 6);
    writeRaw(snapshotPath, current);

    let thrown: unknown;
    try {
      persistSnapshotAtomicallyWithExpectedMetadata(snapshotPath, staleWrite, missingMetadata);
    } catch (error) {
      thrown = error;
    }

    expectConflict(thrown);
    expect(readRaw(snapshotPath)).toBe(current);
    expect(tempFilesFor(snapshotPath)).toEqual([]);
    expect(backupFilesFor(snapshotPath)).toEqual([]);
  });

  it("uses content identity instead of mtime for identical retry and rejects conflicting bytes", () => {
    const snapshotPath = createSnapshotPath("cas-writer-identical-retry.json");
    const original = writeValidSnapshot(snapshotPath);
    const originalMetadata = readSnapshotWriteMetadata(snapshotPath);
    if (originalMetadata.status !== "found") {
      throw new Error("expected found metadata");
    }
    const diagnosticMtimeOnlyMetadata = {
      ...originalMetadata,
      mtimeIso: "1970-01-01T00:00:00.000Z",
      mtimeMs: 0
    };
    const identicalRetry = snapshotContentsWithCounter("cas_writer_identical_retry", 7);
    const conflictingRetry = snapshotContentsWithCounter("cas_writer_conflicting_retry", 8);
    writeRaw(snapshotPath, original);

    persistSnapshotAtomicallyWithExpectedMetadata(
      snapshotPath,
      identicalRetry,
      diagnosticMtimeOnlyMetadata
    );
    const retryMetadata = readSnapshotWriteMetadata(snapshotPath);
    writeRaw(snapshotPath, conflictingRetry);

    let thrown: unknown;
    try {
      persistSnapshotAtomicallyWithExpectedMetadata(snapshotPath, original, retryMetadata);
    } catch (error) {
      thrown = error;
    }

    expectConflict(thrown);
    expect(readRaw(snapshotPath)).toBe(conflictingRetry);
    expect(readSnapshot(snapshotPath)).not.toHaveProperty("contentSha256");
    expect(readSnapshot(snapshotPath)).not.toHaveProperty("etag");
    expect(readSnapshot(snapshotPath)).not.toHaveProperty("generation");
    expect(readSnapshot(snapshotPath)).not.toHaveProperty("revision");
  });

  it("leaves runtime persist, migration apply, restore, inspection, and planner paths unchanged", () => {
    const persistPath = createSnapshotPath("cas-boundary-persist.json");
    const applyPath = createSnapshotPath("cas-boundary-apply.json");
    const restoreBackupPath = createSnapshotPath("cas-boundary-restore-backup.bak");
    const restoreTargetPath = createSnapshotPath("cas-boundary-restore-target.json");
    const inspectPath = createSnapshotPath("cas-boundary-inspect.json");
    const planPath = createSnapshotPath("cas-boundary-plan.json");
    const store = createP1Store({ persistenceFile: persistPath });
    store.counters.cas_boundary_persist = 1;
    store.persist();
    writeValidSnapshot(applyPath);
    writeValidSnapshot(restoreBackupPath);
    writeValidSnapshot(restoreTargetPath);
    writeValidSnapshot(inspectPath);
    writeValidSnapshot(planPath);

    expect(applySnapshotMigrationToCurrentVersion(applyPath).status).toBe("already_current");
    expect(restoreSnapshotFromBackup(restoreBackupPath, restoreTargetPath).status).toBe("restored");
    expect(inspectPersistedSnapshotFile(inspectPath)).toMatchObject({
      ok: true,
      status: "valid_v1"
    });
    expect(planSnapshotMigrationDryRun(planPath)).toMatchObject({
      action: "none",
      status: "already_current"
    });
    expect(readSnapshot(persistPath).counters).toMatchObject({ cas_boundary_persist: 1 });
    expect(tempFilesFor(persistPath)).toEqual([]);
    expect(backupFilesFor(persistPath)).toEqual([]);
  });
});

describe("JSON snapshot inspection dry-run", () => {
  it("prints usage without a stack trace when no path is provided", () => {
    const result = runInspectionCommand([]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Usage:");
    expect(result.stderr).not.toContain("Stack");
    expect(result.stderr).not.toContain("at ");
  });

  it("rejects unknown options without a stack trace", () => {
    const result = runInspectionCommand(["--apply"]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Unknown option");
    expect(result.stderr).not.toContain("Stack");
    expect(result.stderr).not.toContain("at ");
  });

  it("reports file-not-found without creating the target file", () => {
    const snapshotPath = join(createTempDir(), "missing.json");
    const result = runInspectionCommand(["--json", snapshotPath]);
    const parsed = parseInspectionJsonOutput(result.stdout);

    expect(result.status).toBe(3);
    expect(parsed.ok).toBe(false);
    expect(parsed.status).toBe("file_not_found");
    expect(parsed.path).toBe(snapshotPath);
    expect(existsSync(snapshotPath)).toBe(false);
    expect(readdirSync(join(snapshotPath, ".."))).toEqual([]);
  });

  it("reports valid v1 snapshots as machine-readable JSON", () => {
    const snapshotPath = createSnapshotPath();
    const rawSnapshot = writeValidSnapshot(snapshotPath);
    const result = runInspectionCommand(["--json", snapshotPath]);
    const parsed = parseInspectionJsonOutput(result.stdout);

    expect(result.status).toBe(0);
    expect(parsed).toMatchObject({
      ok: true,
      status: "valid_v1",
      snapshot_version: 1,
      legacy: false,
      path: snapshotPath,
      details: []
    });
    expect(readRaw(snapshotPath)).toBe(rawSnapshot);
    expectNoInspectionSideFiles(snapshotPath);
  });

  it("exposes the npm snapshot inspection script", () => {
    const snapshotPath = createSnapshotPath("npm-script.json");
    writeValidSnapshot(snapshotPath);
    const result = runDeclaredInspectionCommand(["--json", snapshotPath]);

    expect(result.status, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`).toBe(0);
    expect(parseInspectionJsonOutput(result.stdout).status).toBe("valid_v1");
  });

  it("reports valid legacy v0 snapshots without rewriting them", () => {
    const snapshotPath = createSnapshotPath("legacy.json");
    const rawSnapshot = writeSnapshot(snapshotPath, createLegacySnapshot());
    const result = inspectPersistedSnapshotFile(snapshotPath);

    expect(result).toMatchObject({
      ok: true,
      status: "valid_legacy_v0",
      snapshot_version: null,
      legacy: true,
      path: snapshotPath,
      details: []
    });
    expect(readRaw(snapshotPath)).toBe(rawSnapshot);
    expect(readSnapshot(snapshotPath)).not.toHaveProperty("snapshot_version");
    expectNoInspectionSideFiles(snapshotPath);
  });

  it("keeps unknown compatible fields unchanged during inspection", () => {
    const snapshotPath = createSnapshotPath("unknown-fields.json");
    const snapshot = createLegacySnapshot({
      inspector_unknown_field: "SENSITIVE_UNKNOWN_FIELD_SENTINEL"
    });
    const rawSnapshot = writeSnapshot(snapshotPath, {
      snapshot_version: 1,
      ...snapshot
    });
    const result = runInspectionCommand(["--json", snapshotPath]);

    expect(result.status).toBe(0);
    expect(parseInspectionJsonOutput(result.stdout).status).toBe("valid_v1");
    expect(readRaw(snapshotPath)).toBe(rawSnapshot);
    expect(result.stdout).not.toContain("SENSITIVE_UNKNOWN_FIELD_SENTINEL");
  });

  it.each([
    {
      expectedStatus: "empty_file",
      name: "empty file",
      write(path: string) {
        return writeRaw(path, "");
      }
    },
    {
      expectedStatus: "corrupt_json",
      name: "malformed JSON",
      write(path: string) {
        return writeRaw(path, '{"tenants": [');
      }
    },
    {
      expectedStatus: "unsupported_version",
      name: "future version",
      write(path: string) {
        return writeSnapshot(path, {
          snapshot_version: 2,
          ...createLegacySnapshot()
        });
      }
    },
    {
      expectedStatus: "invalid_version",
      name: "invalid explicit version",
      write(path: string) {
        return writeSnapshot(path, {
          snapshot_version: "1",
          ...createLegacySnapshot()
        });
      }
    },
    {
      expectedStatus: "invalid_snapshot",
      name: "deep validation failure",
      write(path: string) {
        const snapshot = createLegacySnapshot();
        const users = snapshot.users as Record<string, unknown>[];
        users[0] = {
          ...users[0],
          password_hash: "SENSITIVE_PASSWORD_HASH_SENTINEL"
        };
        snapshot.sessions = [
          {
            created_at: "2026-06-21T00:00:00.000Z",
            expires_at: "2026-06-22T00:00:00.000Z",
            session_id: "session_sensitive_sentinel",
            tenant_id: "tenant_demo",
            token_hash: "SENSITIVE_TOKEN_HASH_SENTINEL",
            user_id: "usr_teacher"
          }
        ];
        snapshot.decisions = [
          {
            decision_id: "decision_sensitive_sentinel",
            payload: {
              capacity_plan: "hold",
              cash_buffer_target: 0.2,
              marketing_budget: 120000,
              pricing: { base_price: 12000 },
              service_quality_budget: 90000,
              strategy_statement: "SENSITIVE_DECISION_PAYLOAD_SENTINEL"
            },
            round_id: "round_sensitive_sentinel",
            round_no: 1,
            run_id: "run_sensitive_sentinel",
            status: "validated",
            submitted_by: 42,
            team_id: "team_sensitive_sentinel",
            tenant_id: "tenant_demo",
            validation_report: [],
            version: 1
          }
        ];
        return writeSnapshot(path, {
          snapshot_version: 1,
          ...snapshot
        });
      }
    }
  ])("reports $name without modifying source or side files", ({ expectedStatus, name, write }) => {
    const snapshotPath = createSnapshotPath(`${name.replace(/\W+/g, "-")}.json`);
    const rawSnapshot = write(snapshotPath);
    const mtimeMs = statSync(snapshotPath).mtimeMs;
    const result = runInspectionCommand(["--json", snapshotPath]);
    const parsed = parseInspectionJsonOutput(result.stdout);

    expect(result.status).toBe(1);
    expect(parsed.ok).toBe(false);
    expect(parsed.status).toBe(expectedStatus);
    expect(parsed.path).toBe(snapshotPath);
    expect(readRaw(snapshotPath)).toBe(rawSnapshot);
    expect(statSync(snapshotPath).mtimeMs).toBe(mtimeMs);
    expectNoInspectionSideFiles(snapshotPath);
    expect(result.stdout).not.toContain("SENSITIVE_PASSWORD_HASH_SENTINEL");
    expect(result.stdout).not.toContain("SENSITIVE_TOKEN_HASH_SENTINEL");
    expect(result.stdout).not.toContain("SENSITIVE_DECISION_PAYLOAD_SENTINEL");
  });

  it("prints a compact human-readable summary by default", () => {
    const snapshotPath = createSnapshotPath("human.json");
    writeValidSnapshot(snapshotPath);
    const result = runInspectionCommand([snapshotPath]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("valid_v1");
    expect(result.stdout).toContain("read-only");
    expect(result.stdout).not.toContain('"tenants"');
    expect(result.stdout).not.toContain('"users"');
  });
});

describe("JSON snapshot migration dry-run planner", () => {
  function expectNoMigrationSideFiles(path: string): void {
    expect(readdirSync(join(path, "..")).sort()).toEqual([basename(path)]);
    expect(backupFilesFor(path)).toEqual([]);
  }

  function expectSafePlanOutput(output: string): void {
    expect(output).not.toContain("SENSITIVE_PASSWORD_HASH_SENTINEL");
    expect(output).not.toContain("SENSITIVE_TOKEN_HASH_SENTINEL");
    expect(output).not.toContain("SENSITIVE_DECISION_PAYLOAD_SENTINEL");
    expect(output).not.toContain("SENSITIVE_DATABASE_URL_SENTINEL");
    expect(output).not.toContain("password_hash");
    expect(output).not.toContain("token_hash");
    expect(output).not.toContain("strategy_statement");
    expect(output).not.toContain('"payload"');
    expect(output).not.toContain('"tenants"');
    expect(output).not.toContain('"users"');
  }

  it("returns an already-current no-op plan for a valid v1 snapshot without touching the file", () => {
    const snapshotPath = createSnapshotPath("current-v1-plan.json");
    const rawSnapshot = writeValidSnapshot(snapshotPath);
    const mtimeMs = statSync(snapshotPath).mtimeMs;

    const plan = planSnapshotMigrationDryRun(snapshotPath);

    expect(plan).toMatchObject({
      action: "none",
      canApplyInFuture: false,
      currentVersion: 1,
      requiresBackupBeforeApply: false,
      sourcePath: snapshotPath,
      status: "already_current",
      targetVersion: 1
    });
    expect(plan.reasons).toContain("Snapshot is already at the current version.");
    expect(plan.safeSummary.snapshotVersionLabel).toBe("v1");
    expect(JSON.stringify(plan)).not.toContain("tenant_demo");
    expect(JSON.stringify(plan)).not.toContain("P0 Teacher");
    expect(readRaw(snapshotPath)).toBe(rawSnapshot);
    expect(statSync(snapshotPath).mtimeMs).toBe(mtimeMs);
    expectNoMigrationSideFiles(snapshotPath);
  });

  it("returns a future migration candidate for valid legacy v0 without backup or write-back", () => {
    const snapshotPath = createSnapshotPath("legacy-plan.json");
    const rawSnapshot = writeSnapshot(snapshotPath, createLegacySnapshot());

    const plan = planSnapshotMigrationDryRun(snapshotPath);

    expect(plan).toMatchObject({
      action: "would_migrate_legacy_to_current",
      canApplyInFuture: true,
      currentVersion: "legacy",
      requiresBackupBeforeApply: true,
      sourcePath: snapshotPath,
      status: "ready",
      targetVersion: 1
    });
    expect(plan.reasons).toContain(
      "Legacy v0 snapshot can be migrated by future explicit apply tooling."
    );
    expect(plan.safeSummary.snapshotVersionLabel).toBe("legacy v0");
    expect(readRaw(snapshotPath)).toBe(rawSnapshot);
    expect(readSnapshot(snapshotPath)).not.toHaveProperty("snapshot_version");
    expectNoMigrationSideFiles(snapshotPath);
  });

  it.each([
    {
      action: "unsupported",
      currentVersion: 2,
      expectedReason: "Unsupported future snapshot version.",
      name: "future version",
      status: "blocked",
      write(path: string) {
        return writeSnapshot(path, {
          snapshot_version: 2,
          ...createLegacySnapshot()
        });
      }
    },
    {
      action: "unsupported",
      currentVersion: "unknown",
      expectedReason: "Invalid explicit snapshot version.",
      name: "invalid explicit version",
      status: "blocked",
      write(path: string) {
        return writeSnapshot(path, {
          snapshot_version: "1",
          ...createLegacySnapshot()
        });
      }
    },
    {
      action: "inspect_before_retry",
      currentVersion: "unknown",
      expectedReason: "Snapshot JSON is malformed.",
      name: "malformed JSON",
      status: "blocked",
      write(path: string) {
        return writeRaw(path, '{"snapshot_version": 1,');
      }
    },
    {
      action: "inspect_before_retry",
      currentVersion: "unknown",
      expectedReason: "Snapshot file is empty.",
      name: "empty file",
      status: "blocked",
      write(path: string) {
        return writeRaw(path, "");
      }
    },
    {
      action: "inspect_before_retry",
      currentVersion: "unknown",
      expectedReason: "Snapshot failed shape or deep entity validation.",
      name: "deep validation failure",
      status: "blocked",
      write(path: string) {
        const snapshot = createLegacySnapshot();
        const users = snapshot.users as Record<string, unknown>[];
        users[0] = {
          ...users[0],
          password_hash: "SENSITIVE_PASSWORD_HASH_SENTINEL"
        };
        snapshot.sessions = [
          {
            created_at: "2026-06-21T00:00:00.000Z",
            expires_at: "2026-06-22T00:00:00.000Z",
            session_id: "session_sensitive_sentinel",
            tenant_id: "tenant_demo",
            token_hash: "SENSITIVE_TOKEN_HASH_SENTINEL",
            user_id: "usr_teacher"
          }
        ];
        snapshot.decisions = [
          {
            decision_id: "decision_sensitive_sentinel",
            payload: {
              capacity_plan: "hold",
              cash_buffer_target: 0.2,
              marketing_budget: 120000,
              pricing: { base_price: 12000 },
              service_quality_budget: 90000,
              strategy_statement: "SENSITIVE_DECISION_PAYLOAD_SENTINEL"
            },
            round_id: "round_sensitive_sentinel",
            round_no: 1,
            run_id: "run_sensitive_sentinel",
            status: "validated",
            submitted_by: 42,
            team_id: "team_sensitive_sentinel",
            tenant_id: "tenant_demo",
            validation_report: [],
            version: 1
          }
        ];
        return writeSnapshot(path, {
          snapshot_version: 1,
          ...snapshot
        });
      }
    }
  ])(
    "returns a blocked safe plan for $name",
    ({ action, currentVersion, expectedReason, name, status, write }) => {
      const snapshotPath = createSnapshotPath(`${name.replace(/\W+/g, "-")}-plan.json`);
      const rawSnapshot = write(snapshotPath);
      const mtimeMs = statSync(snapshotPath).mtimeMs;

      const plan = planSnapshotMigrationDryRun(snapshotPath);

      expect(plan).toMatchObject({
        action,
        canApplyInFuture: false,
        currentVersion,
        requiresBackupBeforeApply: false,
        sourcePath: snapshotPath,
        status,
        targetVersion: 1
      });
      expect(plan.reasons).toContain(expectedReason);
      expect(readRaw(snapshotPath)).toBe(rawSnapshot);
      expect(statSync(snapshotPath).mtimeMs).toBe(mtimeMs);
      expectNoMigrationSideFiles(snapshotPath);
      expectSafePlanOutput(JSON.stringify(plan));
    }
  );

  it("returns a distinct not-found plan without creating the missing file", () => {
    const snapshotPath = join(createTempDir(), "missing-plan.json");

    const plan = planSnapshotMigrationDryRun(snapshotPath);

    expect(plan).toMatchObject({
      action: "inspect_before_retry",
      canApplyInFuture: false,
      currentVersion: "unknown",
      requiresBackupBeforeApply: false,
      sourcePath: snapshotPath,
      status: "not_found",
      targetVersion: 1
    });
    expect(plan.reasons).toContain("Snapshot file was not found.");
    expect(existsSync(snapshotPath)).toBe(false);
    expect(readdirSync(join(snapshotPath, ".."))).toEqual([]);
  });

  it("prints a compact human-readable no-op plan for valid v1 snapshots", () => {
    const snapshotPath = createSnapshotPath("human-current-plan.json");
    writeValidSnapshot(snapshotPath);

    const result = runMigrationPlanCommand([snapshotPath]);

    expect(result.status, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Snapshot migration plan: already_current");
    expect(result.stdout).toContain("Action: none");
    expect(result.stdout).toContain("Mode: read-only dry-run");
    expectSafePlanOutput(result.stdout);
  });

  it("prints human and JSON plans for valid legacy v0 snapshots", () => {
    const snapshotPath = createSnapshotPath("legacy-cli-plan.json");
    const rawSnapshot = writeSnapshot(snapshotPath, createLegacySnapshot());

    const human = runMigrationPlanCommand([snapshotPath]);
    const machine = runMigrationPlanCommand(["--json", snapshotPath]);
    const parsed = parseMigrationPlanJsonOutput(machine.stdout);

    expect(human.status, `stdout:\n${human.stdout}\nstderr:\n${human.stderr}`).toBe(0);
    expect(human.stdout).toContain("would_migrate_legacy_to_current");
    expect(human.stdout).toContain("Backup required before apply: yes");
    expect(machine.status, `stdout:\n${machine.stdout}\nstderr:\n${machine.stderr}`).toBe(0);
    expect(parsed).toMatchObject({
      action: "would_migrate_legacy_to_current",
      currentVersion: "legacy",
      requiresBackupBeforeApply: true,
      status: "ready",
      targetVersion: 1
    });
    expect(readRaw(snapshotPath)).toBe(rawSnapshot);
    expectNoMigrationSideFiles(snapshotPath);
    expectSafePlanOutput(human.stdout);
    expectSafePlanOutput(machine.stdout);
  });

  it("uses explicit exit codes for blocked, usage, missing-file, and unexpected errors", () => {
    const invalidPath = createSnapshotPath("invalid-cli-plan.json");
    writeSnapshot(invalidPath, { snapshot_version: 2, ...createLegacySnapshot() });
    const missingPath = join(createTempDir(), "missing-cli-plan.json");

    expect(runMigrationPlanCommand(["--json", invalidPath]).status).toBe(1);
    expect(runMigrationPlanCommand(["--apply", invalidPath]).status).toBe(2);
    expect(runMigrationPlanCommand(["--json", missingPath]).status).toBe(3);
  });

  it("exposes the npm migration plan script", () => {
    const snapshotPath = createSnapshotPath("npm-plan.json");
    writeValidSnapshot(snapshotPath);

    const result = runDeclaredMigrationPlanCommand(["--json", snapshotPath]);

    expect(result.status, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`).toBe(0);
    expect(parseMigrationPlanJsonOutput(result.stdout).status).toBe("already_current");
  });

  it("leaves inspection, runtime load, normal persist, and backup explicit-only boundaries unchanged", () => {
    const inspectPath = createSnapshotPath("inspection-boundary-plan.json");
    const loadPath = createSnapshotPath("load-boundary-plan.json");
    const persistPath = createSnapshotPath("persist-boundary-plan.json");
    const backupPath = createSnapshotPath("backup-boundary-plan.json");
    const rawInspect = writeValidSnapshot(inspectPath);
    writeSnapshot(loadPath, { snapshot_version: 2, ...createLegacySnapshot() });
    writeValidSnapshot(backupPath);

    const inspection = inspectPersistedSnapshotFile(inspectPath);
    expect(inspection.ok).toBe(true);
    expect(readRaw(inspectPath)).toBe(rawInspect);
    expectNoMigrationSideFiles(inspectPath);

    expectSnapshotError(
      () => createP1Store({ persistenceFile: loadPath }),
      "store_snapshot_unsupported_version"
    );
    expectNoMigrationSideFiles(loadPath);

    const store = createP1Store({ persistenceFile: persistPath });
    store.counters.migration_plan_boundary = 1;
    store.persist();
    expect(backupFilesFor(persistPath)).toEqual([]);
    expect(tempFilesFor(persistPath)).toEqual([]);

    const backup = createSnapshotBackupBeforeWrite(backupPath);
    expect(readRaw(backup.backupPath)).toBe(readRaw(backupPath));
    expect(tempFilesFor(backupPath)).toEqual([]);
  });
});

describe("JSON snapshot migration apply", () => {
  function nodeFileSystem(overrides: Partial<SnapshotFileSystem> = {}): SnapshotFileSystem {
    return {
      close: closeSync,
      fsync: fsyncSync,
      mkdir: (path) => mkdirSync(path, { recursive: true }),
      open: openSync,
      readFile: readRaw,
      rename: renameSync,
      unlink: unlinkSync,
      writeFile: (file, data) => writeFileSync(file, data),
      ...overrides
    };
  }

  function expectSafeApplyOutput(output: string): void {
    expect(output).not.toContain("SENSITIVE_PASSWORD_HASH_SENTINEL");
    expect(output).not.toContain("SENSITIVE_TOKEN_HASH_SENTINEL");
    expect(output).not.toContain("SENSITIVE_DECISION_PAYLOAD_SENTINEL");
    expect(output).not.toContain("SENSITIVE_DATABASE_URL_SENTINEL");
    expect(output).not.toContain("password_hash");
    expect(output).not.toContain("token_hash");
    expect(output).not.toContain("strategy_statement");
    expect(output).not.toContain('"payload"');
  }

  it("returns a no-op for valid v1 without backup or write-back", () => {
    const snapshotPath = createSnapshotPath("apply-current-v1.json");
    const rawSnapshot = writeValidSnapshot(snapshotPath);
    const mtimeMs = statSync(snapshotPath).mtimeMs;

    const result = applySnapshotMigrationToCurrentVersion(snapshotPath);

    expect(result).toMatchObject({
      action: "none",
      afterVersion: 1,
      beforeVersion: 1,
      sourcePath: snapshotPath,
      status: "already_current",
      targetVersion: 1
    });
    expect(result.backupPath).toBeUndefined();
    expect(result.reasons).toContain("Snapshot is already at the current version.");
    expect(readRaw(snapshotPath)).toBe(rawSnapshot);
    expect(statSync(snapshotPath).mtimeMs).toBe(mtimeMs);
    expect(backupFilesFor(snapshotPath)).toEqual([]);
    expect(tempFilesFor(snapshotPath)).toEqual([]);
  });

  it("applies valid legacy v0 to v1 after creating a raw-byte backup", () => {
    const snapshotPath = createSnapshotPath("apply-legacy-v0.json");
    const legacySnapshot = createLegacySnapshot();
    const rawLegacy = writeSnapshot(snapshotPath, legacySnapshot);
    const beforeCourseCount = (legacySnapshot.courses as unknown[]).length;

    const result = applySnapshotMigrationToCurrentVersion(snapshotPath);
    const migrated = readSnapshot(snapshotPath);
    const postInspection = inspectPersistedSnapshotFile(snapshotPath);

    expect(result).toMatchObject({
      action: "migrated_legacy_to_current",
      afterVersion: 1,
      beforeVersion: "legacy",
      sourceBytesBefore: Buffer.byteLength(rawLegacy),
      sourcePath: snapshotPath,
      status: "applied",
      targetVersion: 1
    });
    expect(result.backupPath).toBeTruthy();
    expect(result.backupBytes).toBe(Buffer.byteLength(rawLegacy));
    expect(result.safeSummary.entityCounts?.courses).toBe(beforeCourseCount);
    expect(readRaw(result.backupPath!)).toBe(rawLegacy);
    expect(migrated.snapshot_version).toBe(1);
    expect(migrated).toHaveProperty("courses");
    expect(postInspection).toMatchObject({ ok: true, status: "valid_v1" });
    expect(readRaw(snapshotPath)).not.toBe(rawLegacy);
    expect(tempFilesFor(snapshotPath)).toEqual([]);
    expectSafeApplyOutput(JSON.stringify(result));
  });

  it.each([
    {
      expectedStatus: "blocked",
      name: "future version",
      write(path: string) {
        return writeSnapshot(path, {
          snapshot_version: 2,
          ...createLegacySnapshot()
        });
      }
    },
    {
      expectedStatus: "blocked",
      name: "invalid explicit version",
      write(path: string) {
        return writeSnapshot(path, {
          snapshot_version: "1",
          ...createLegacySnapshot()
        });
      }
    },
    {
      expectedStatus: "blocked",
      name: "malformed JSON",
      write(path: string) {
        return writeRaw(path, '{"snapshot_version": 1,');
      }
    },
    {
      expectedStatus: "blocked",
      name: "empty file",
      write(path: string) {
        return writeRaw(path, "");
      }
    },
    {
      expectedStatus: "blocked",
      name: "deep validation failure",
      write(path: string) {
        const snapshot = createLegacySnapshot();
        const users = snapshot.users as Record<string, unknown>[];
        users[0] = {
          ...users[0],
          password_hash: 42
        };
        return writeSnapshot(path, {
          snapshot_version: 1,
          ...snapshot
        });
      }
    }
  ])("fails closed for $name without backup or write-back", ({ expectedStatus, name, write }) => {
    const snapshotPath = createSnapshotPath(`${name.replace(/\W+/g, "-")}-apply.json`);
    const rawSnapshot = write(snapshotPath);

    const result = applySnapshotMigrationToCurrentVersion(snapshotPath);

    expect(result.status).toBe(expectedStatus);
    expect(result.canApplyInFuture).toBe(false);
    expect(result.backupPath).toBeUndefined();
    expect(readRaw(snapshotPath)).toBe(rawSnapshot);
    expect(backupFilesFor(snapshotPath)).toEqual([]);
    expect(tempFilesFor(snapshotPath)).toEqual([]);
    expectSafeApplyOutput(JSON.stringify(result));
  });

  it("returns not_found for a missing file without creating side files", () => {
    const snapshotPath = join(createTempDir(), "missing-apply.json");

    const result = applySnapshotMigrationToCurrentVersion(snapshotPath);

    expect(result).toMatchObject({
      action: "none",
      afterVersion: null,
      beforeVersion: "unknown",
      sourcePath: snapshotPath,
      status: "not_found"
    });
    expect(result.backupPath).toBeUndefined();
    expect(existsSync(snapshotPath)).toBe(false);
    expect(readdirSync(join(snapshotPath, ".."))).toEqual([]);
  });

  it("fails closed when backup creation fails before write-back", () => {
    const snapshotPath = createSnapshotPath("backup-failure-apply.json");
    const rawSnapshot = writeSnapshot(snapshotPath, createLegacySnapshot());
    const blockedBackupDirectory = join(snapshotPath, "..", "blocked-backup-target");
    writeRaw(blockedBackupDirectory, "not a directory");

    const result = applySnapshotMigrationToCurrentVersion(snapshotPath, {
      backupDirectory: blockedBackupDirectory
    });

    expect(result.status).toBe("backup_failed");
    expect(result.backupPath).toBeUndefined();
    expect(readRaw(snapshotPath)).toBe(rawSnapshot);
    expect(readRaw(blockedBackupDirectory)).toBe("not a directory");
    expect(tempFilesFor(snapshotPath)).toEqual([]);
  });

  it("fails closed when atomic write-back fails after backup", () => {
    const snapshotPath = createSnapshotPath("write-failure-apply.json");
    const rawSnapshot = writeSnapshot(snapshotPath, createLegacySnapshot());

    const result = applySnapshotMigrationToCurrentVersion(snapshotPath, {
      fileSystem: nodeFileSystem({
        rename() {
          throw new Error("forced atomic rename failure");
        }
      })
    });

    expect(result.status).toBe("write_failed");
    expect(result.backupPath).toBeTruthy();
    expect(readRaw(result.backupPath!)).toBe(rawSnapshot);
    expect(readRaw(snapshotPath)).toBe(rawSnapshot);
    expect(tempFilesFor(snapshotPath)).toEqual([]);
  });

  it("fails closed when post-write validation fails and keeps the backup path", () => {
    const snapshotPath = createSnapshotPath("post-validation-failure-apply.json");
    const rawSnapshot = writeSnapshot(snapshotPath, createLegacySnapshot());

    const result = applySnapshotMigrationToCurrentVersion(snapshotPath, {
      fileSystem: nodeFileSystem({
        rename(source, target) {
          renameSync(source, target);
          writeRaw(target, "{}");
        }
      })
    });

    expect(result.status).toBe("post_write_validation_failed");
    expect(result.backupPath).toBeTruthy();
    expect(readRaw(result.backupPath!)).toBe(rawSnapshot);
    expect(inspectPersistedSnapshotFile(snapshotPath)).toMatchObject({
      ok: false,
      status: "invalid_snapshot"
    });

    writeRaw(snapshotPath, readRaw(result.backupPath!));
    const retry = applySnapshotMigrationToCurrentVersion(snapshotPath);
    expect(retry.status).toBe("applied");
    expect(tempFilesFor(snapshotPath)).toEqual([]);
  });

  it("prints human and JSON apply output and exposes the npm entrypoint", async () => {
    const humanPath = createSnapshotPath("apply-human.json");
    const jsonPath = createSnapshotPath("apply-json.json");
    const npmPath = createSnapshotPath("apply-npm.json");
    writeSnapshot(humanPath, createLegacySnapshot());
    writeSnapshot(jsonPath, createLegacySnapshot());
    writeSnapshot(npmPath, createLegacySnapshot());

    const human = await runMigrationApplyCommandWithDeadline([humanPath]);
    const machine = await runMigrationApplyCommandWithDeadline(["--json", jsonPath]);
    const npm = await runDeclaredMigrationApplyCommandWithDeadline(["--json", npmPath]);
    const parsed = parseMigrationApplyJsonOutput(machine.stdout);

    expect(human.status, `stdout:\n${human.stdout}\nstderr:\n${human.stderr}`).toBe(0);
    expect(human.stdout).toContain("Snapshot migration apply: applied");
    expect(human.stdout).toContain("Action: migrated_legacy_to_current");
    expect(human.stdout).toContain("Backup:");
    expect(machine.status, `stdout:\n${machine.stdout}\nstderr:\n${machine.stderr}`).toBe(0);
    expect(parsed).toMatchObject({
      action: "migrated_legacy_to_current",
      afterVersion: 1,
      beforeVersion: "legacy",
      status: "applied"
    });
    expect(npm.status, `stdout:\n${npm.stdout}\nstderr:\n${npm.stderr}`).toBe(0);
    expect(parseMigrationApplyJsonOutput(npm.stdout).status).toBe("applied");
    expectSafeApplyOutput(human.stdout);
    expectSafeApplyOutput(machine.stdout);
    expectSafeApplyOutput(npm.stdout);
  }, 10_000);

  it("uses explicit CLI exit codes for no-op, blocked, usage, missing, and backup failures", async () => {
    const currentPath = createSnapshotPath("apply-exit-current.json");
    const blockedPath = createSnapshotPath("apply-exit-blocked.json");
    const backupFailurePath = createSnapshotPath("apply-exit-backup-failure.json");
    const backupFailureTarget = join(backupFailurePath, "..", "blocked-backup-target");
    const missingPath = join(createTempDir(), "missing-apply-cli.json");
    writeValidSnapshot(currentPath);
    writeRaw(blockedPath, "");
    writeSnapshot(backupFailurePath, createLegacySnapshot());
    writeRaw(backupFailureTarget, "not a directory");

    expect((await runMigrationApplyCommandWithDeadline(["--json", currentPath])).status).toBe(0);
    expect((await runMigrationApplyCommandWithDeadline(["--json", blockedPath])).status).toBe(1);
    expect((await runMigrationApplyCommandWithDeadline(["--unknown", currentPath])).status).toBe(2);
    expect((await runMigrationApplyCommandWithDeadline(["--json", missingPath])).status).toBe(3);
    expect(
      (
        await runMigrationApplyCommandWithDeadline([
          "--json",
          "--backup-dir",
          backupFailureTarget,
          backupFailurePath
        ])
      ).status
    ).toBe(4);
  }, 12_000);

  it("leaves runtime load, inspection, dry-run planning, and normal persist boundaries unchanged", () => {
    const inspectPath = createSnapshotPath("apply-inspection-boundary.json");
    const loadPath = createSnapshotPath("apply-load-boundary.json");
    const planPath = createSnapshotPath("apply-plan-boundary.json");
    const persistPath = createSnapshotPath("apply-persist-boundary.json");
    const rawInspect = writeSnapshot(inspectPath, createLegacySnapshot());
    const rawLoad = writeSnapshot(loadPath, createLegacySnapshot());
    const rawPlan = writeSnapshot(planPath, createLegacySnapshot());

    const inspection = inspectPersistedSnapshotFile(inspectPath);
    expect(inspection).toMatchObject({ ok: true, status: "valid_legacy_v0" });
    expect(readRaw(inspectPath)).toBe(rawInspect);
    expect(backupFilesFor(inspectPath)).toEqual([]);

    createP1Store({ persistenceFile: loadPath });
    expect(readRaw(loadPath)).toBe(rawLoad);
    expect(backupFilesFor(loadPath)).toEqual([]);

    const plan = planSnapshotMigrationDryRun(planPath);
    expect(plan.status).toBe("ready");
    expect(readRaw(planPath)).toBe(rawPlan);
    expect(backupFilesFor(planPath)).toEqual([]);

    writeValidSnapshot(persistPath);
    const store = createP1Store({ persistenceFile: persistPath });
    store.counters.migration_apply_boundary = 1;
    store.persist();
    expect(backupFilesFor(persistPath)).toEqual([]);
    expect(tempFilesFor(persistPath)).toEqual([]);
  });
});

describe("JSON snapshot restore from backup", () => {
  function nodeFileSystem(overrides: Partial<SnapshotFileSystem> = {}): SnapshotFileSystem {
    return {
      close: closeSync,
      fsync: fsyncSync,
      mkdir: (path) => mkdirSync(path, { recursive: true }),
      open: openSync,
      readFile: readRaw,
      rename: renameSync,
      unlink: unlinkSync,
      writeFile: (file, data) => writeFileSync(file, data),
      ...overrides
    };
  }

  function expectSafeRestoreOutput(output: string): void {
    expect(output).not.toContain("SENSITIVE_PASSWORD_HASH_SENTINEL");
    expect(output).not.toContain("SENSITIVE_TOKEN_HASH_SENTINEL");
    expect(output).not.toContain("SENSITIVE_DECISION_PAYLOAD_SENTINEL");
    expect(output).not.toContain("SENSITIVE_DATABASE_URL_SENTINEL");
    expect(output).not.toContain("password_hash");
    expect(output).not.toContain("token_hash");
    expect(output).not.toContain("strategy_statement");
    expect(output).not.toContain('"payload"');
  }

  function createSensitiveLegacySnapshot(): Record<string, unknown> {
    const snapshot = createLegacySnapshot();
    const courses = snapshot.courses as Record<string, unknown>[];
    courses[0] = {
      ...courses[0],
      title: "SENSITIVE_DECISION_PAYLOAD_SENTINEL"
    };
    return snapshot;
  }

  it("restores an existing target from a valid v1 backup after pre-restore backup", () => {
    const backupPath = createSnapshotPath("restore-v1-backup.bak");
    const targetPath = createSnapshotPath("restore-v1-target.json");
    const backupSnapshot = {
      snapshot_version: 1,
      ...createSensitiveLegacySnapshot()
    };
    const rawBackup = writeSnapshot(backupPath, backupSnapshot);
    const rawTarget = writeValidSnapshot(targetPath);

    const result = restoreSnapshotFromBackup(backupPath, targetPath);
    const restored = readSnapshot(targetPath);
    const inspection = inspectPersistedSnapshotFile(targetPath);

    expect(result).toMatchObject({
      action: "restored_backup_to_target",
      backupPath,
      backupSnapshotVersion: 1,
      restoredVersion: 1,
      status: "restored",
      targetExistedBeforeRestore: true,
      targetPath
    });
    expect(result.preRestoreBackupPath).toBeTruthy();
    expect(readRaw(result.preRestoreBackupPath!)).toBe(rawTarget);
    expect(result.safeSummary.entityCounts?.courses).toBe(
      (backupSnapshot.courses as unknown[]).length
    );
    expect(restored.snapshot_version).toBe(1);
    expect(restored.courses).toEqual(backupSnapshot.courses);
    expect(inspection).toMatchObject({ ok: true, status: "valid_v1" });
    expect(readRaw(backupPath)).toBe(rawBackup);
    expect(tempFilesFor(targetPath)).toEqual([]);
    expectSafeRestoreOutput(JSON.stringify(result));
  });

  it("restores a missing target from a valid legacy v0 backup without fake pre-restore backup", () => {
    const backupPath = createSnapshotPath("restore-legacy-backup.bak");
    const targetPath = join(createTempDir(), "missing-target.json");
    const legacySnapshot = createLegacySnapshot();
    const rawBackup = writeSnapshot(backupPath, legacySnapshot);

    const result = restoreSnapshotFromBackup(backupPath, targetPath);
    const restored = readSnapshot(targetPath);

    expect(result).toMatchObject({
      action: "restored_backup_to_target",
      backupPath,
      backupSnapshotVersion: "legacy",
      preRestoreBackupPath: null,
      restoredVersion: 1,
      status: "restored",
      targetExistedBeforeRestore: false,
      targetPath
    });
    expect(restored.snapshot_version).toBe(1);
    expect(restored.courses).toEqual(legacySnapshot.courses);
    expect(inspectPersistedSnapshotFile(targetPath)).toMatchObject({
      ok: true,
      status: "valid_v1"
    });
    expect(readRaw(backupPath)).toBe(rawBackup);
    expect(backupFilesFor(targetPath)).toEqual([]);
  });

  it.each([
    {
      expectedStatus: "backup_not_found",
      name: "missing backup",
      writeBackup(_path: string) {
        return undefined;
      }
    },
    {
      expectedStatus: "blocked",
      name: "future version backup",
      writeBackup(path: string) {
        return writeSnapshot(path, {
          snapshot_version: 2,
          ...createLegacySnapshot()
        });
      }
    },
    {
      expectedStatus: "blocked",
      name: "invalid version backup",
      writeBackup(path: string) {
        return writeSnapshot(path, {
          snapshot_version: "1",
          ...createLegacySnapshot()
        });
      }
    },
    {
      expectedStatus: "blocked",
      name: "malformed JSON backup",
      writeBackup(path: string) {
        return writeRaw(path, '{"snapshot_version": 1,');
      }
    },
    {
      expectedStatus: "blocked",
      name: "empty backup",
      writeBackup(path: string) {
        return writeRaw(path, "");
      }
    },
    {
      expectedStatus: "blocked",
      name: "deep validation failure backup",
      writeBackup(path: string) {
        const snapshot = createLegacySnapshot();
        const users = snapshot.users as Record<string, unknown>[];
        users[0] = {
          ...users[0],
          password_hash: 42
        };
        return writeSnapshot(path, {
          snapshot_version: 1,
          ...snapshot
        });
      }
    }
  ])(
    "fails closed for $name without modifying the target",
    ({ expectedStatus, name, writeBackup }) => {
      const backupPath = join(createTempDir(), `${name.replace(/\W+/g, "-")}.bak`);
      const targetPath = createSnapshotPath(`${name.replace(/\W+/g, "-")}-target.json`);
      const rawTarget = writeValidSnapshot(targetPath);
      writeBackup(backupPath);

      const result = restoreSnapshotFromBackup(backupPath, targetPath);

      expect(result.status).toBe(expectedStatus);
      expect(result.preRestoreBackupPath).toBeNull();
      expect(readRaw(targetPath)).toBe(rawTarget);
      expect(backupFilesFor(targetPath)).toEqual([]);
      expect(tempFilesFor(targetPath)).toEqual([]);
      expectSafeRestoreOutput(JSON.stringify(result));
    }
  );

  it("fails closed when pre-restore backup cannot be created", () => {
    const backupPath = createSnapshotPath("restore-pre-backup-source.bak");
    const targetPath = createSnapshotPath("restore-pre-backup-target.json");
    const blockedBackupDirectory = join(targetPath, "..", "blocked-restore-backup-target");
    writeSnapshot(backupPath, { snapshot_version: 1, ...createLegacySnapshot() });
    const rawTarget = writeValidSnapshot(targetPath);
    writeRaw(blockedBackupDirectory, "not a directory");

    const result = restoreSnapshotFromBackup(backupPath, targetPath, {
      preRestoreBackupDirectory: blockedBackupDirectory
    });

    expect(result.status).toBe("pre_restore_backup_failed");
    expect(result.preRestoreBackupPath).toBeNull();
    expect(readRaw(targetPath)).toBe(rawTarget);
    expect(readRaw(blockedBackupDirectory)).toBe("not a directory");
    expect(tempFilesFor(targetPath)).toEqual([]);
  });

  it("fails closed when atomic write-back fails after pre-restore backup", () => {
    const backupPath = createSnapshotPath("restore-write-failure-source.bak");
    const targetPath = createSnapshotPath("restore-write-failure-target.json");
    writeSnapshot(backupPath, { snapshot_version: 1, ...createLegacySnapshot() });
    const rawTarget = writeValidSnapshot(targetPath);

    const result = restoreSnapshotFromBackup(backupPath, targetPath, {
      fileSystem: nodeFileSystem({
        rename() {
          throw new Error("forced restore rename failure");
        }
      })
    });

    expect(result.status).toBe("write_failed");
    expect(result.preRestoreBackupPath).toBeTruthy();
    expect(readRaw(result.preRestoreBackupPath!)).toBe(rawTarget);
    expect(readRaw(targetPath)).toBe(rawTarget);
    expect(tempFilesFor(targetPath)).toEqual([]);
  });

  it("fails closed when post-restore validation fails and allows a later retry", () => {
    const backupPath = createSnapshotPath("restore-post-validation-source.bak");
    const targetPath = createSnapshotPath("restore-post-validation-target.json");
    writeSnapshot(backupPath, { snapshot_version: 1, ...createLegacySnapshot() });
    const rawTarget = writeValidSnapshot(targetPath);

    const result = restoreSnapshotFromBackup(backupPath, targetPath, {
      fileSystem: nodeFileSystem({
        rename(source, target) {
          renameSync(source, target);
          writeRaw(target, "{}");
        }
      })
    });

    expect(result.status).toBe("post_restore_validation_failed");
    expect(result.preRestoreBackupPath).toBeTruthy();
    expect(readRaw(result.preRestoreBackupPath!)).toBe(rawTarget);
    expect(inspectPersistedSnapshotFile(targetPath)).toMatchObject({
      ok: false,
      status: "invalid_snapshot"
    });

    const retry = restoreSnapshotFromBackup(backupPath, targetPath);
    expect(retry.status).toBe("restored");
    expect(inspectPersistedSnapshotFile(targetPath)).toMatchObject({
      ok: true,
      status: "valid_v1"
    });
    expect(tempFilesFor(targetPath)).toEqual([]);
  });

  it("prints human and JSON restore output and exposes the npm entrypoint", async () => {
    const humanBackupPath = createSnapshotPath("restore-human-source.bak");
    const humanTargetPath = createSnapshotPath("restore-human-target.json");
    const jsonBackupPath = createSnapshotPath("restore-json-source.bak");
    const jsonTargetPath = createSnapshotPath("restore-json-target.json");
    const npmBackupPath = createSnapshotPath("restore-npm-source.bak");
    const npmTargetPath = createSnapshotPath("restore-npm-target.json");
    writeSnapshot(humanBackupPath, { snapshot_version: 1, ...createSensitiveLegacySnapshot() });
    writeValidSnapshot(humanTargetPath);
    writeSnapshot(jsonBackupPath, createLegacySnapshot());
    writeValidSnapshot(jsonTargetPath);
    writeSnapshot(npmBackupPath, createLegacySnapshot());
    writeValidSnapshot(npmTargetPath);

    const human = await runSnapshotRestoreCommandWithDeadline([humanBackupPath, humanTargetPath]);
    const machine = await runSnapshotRestoreCommandWithDeadline([
      "--json",
      jsonBackupPath,
      jsonTargetPath
    ]);
    const npm = await runDeclaredSnapshotRestoreCommandWithDeadline([
      "--json",
      npmBackupPath,
      npmTargetPath
    ]);
    const parsed = parseSnapshotRestoreJsonOutput(machine.stdout);

    expect(human.status, `stdout:\n${human.stdout}\nstderr:\n${human.stderr}`).toBe(0);
    expect(human.stdout).toContain("Snapshot restore: restored");
    expect(human.stdout).toContain("Action: restored_backup_to_target");
    expect(human.stdout).toContain("Pre-restore backup:");
    expect(machine.status, `stdout:\n${machine.stdout}\nstderr:\n${machine.stderr}`).toBe(0);
    expect(parsed).toMatchObject({
      action: "restored_backup_to_target",
      restoredVersion: 1,
      status: "restored"
    });
    expect(npm.status, `stdout:\n${npm.stdout}\nstderr:\n${npm.stderr}`).toBe(0);
    expect(parseSnapshotRestoreJsonOutput(npm.stdout).status).toBe("restored");
    expectSafeRestoreOutput(human.stdout);
    expectSafeRestoreOutput(machine.stdout);
    expectSafeRestoreOutput(npm.stdout);
  }, 10_000);

  it("uses explicit CLI exit codes for success, blocked, usage, missing backup, and pre-restore backup failure", async () => {
    const successBackupPath = createSnapshotPath("restore-exit-success-source.bak");
    const successTargetPath = createSnapshotPath("restore-exit-success-target.json");
    const blockedBackupPath = createSnapshotPath("restore-exit-blocked-source.bak");
    const blockedTargetPath = createSnapshotPath("restore-exit-blocked-target.json");
    const missingBackupPath = join(createTempDir(), "missing-restore-source.bak");
    const preBackupFailureSource = createSnapshotPath("restore-exit-pre-backup-source.bak");
    const preBackupFailureTarget = createSnapshotPath("restore-exit-pre-backup-target.json");
    const blockedBackupDirectory = join(preBackupFailureTarget, "..", "blocked-restore-dir");
    writeSnapshot(successBackupPath, { snapshot_version: 1, ...createLegacySnapshot() });
    writeValidSnapshot(successTargetPath);
    writeRaw(blockedBackupPath, "");
    writeValidSnapshot(blockedTargetPath);
    writeSnapshot(preBackupFailureSource, { snapshot_version: 1, ...createLegacySnapshot() });
    writeValidSnapshot(preBackupFailureTarget);
    writeRaw(blockedBackupDirectory, "not a directory");

    expect(
      (
        await runSnapshotRestoreCommandWithDeadline([
          "--json",
          successBackupPath,
          successTargetPath
        ])
      ).status
    ).toBe(0);
    expect(
      (
        await runSnapshotRestoreCommandWithDeadline([
          "--json",
          blockedBackupPath,
          blockedTargetPath
        ])
      ).status
    ).toBe(1);
    expect(
      (
        await runSnapshotRestoreCommandWithDeadline([
          "--unknown",
          successBackupPath,
          successTargetPath
        ])
      ).status
    ).toBe(2);
    expect(
      (
        await runSnapshotRestoreCommandWithDeadline([
          "--json",
          missingBackupPath,
          successTargetPath
        ])
      ).status
    ).toBe(3);
    expect(
      (
        await runSnapshotRestoreCommandWithDeadline([
          "--json",
          "--pre-restore-backup-dir",
          blockedBackupDirectory,
          preBackupFailureSource,
          preBackupFailureTarget
        ])
      ).status
    ).toBe(4);
  }, 12_000);

  it("leaves runtime load, inspection, dry-run, apply, and normal persist boundaries unchanged", () => {
    const inspectPath = createSnapshotPath("restore-inspection-boundary.json");
    const loadPath = createSnapshotPath("restore-load-boundary.json");
    const planPath = createSnapshotPath("restore-plan-boundary.json");
    const applyPath = createSnapshotPath("restore-apply-boundary.json");
    const persistPath = createSnapshotPath("restore-persist-boundary.json");
    const rawInspect = writeSnapshot(inspectPath, createLegacySnapshot());
    const rawLoad = writeSnapshot(loadPath, createLegacySnapshot());
    const rawPlan = writeSnapshot(planPath, createLegacySnapshot());
    const rawApply = writeValidSnapshot(applyPath);

    expect(inspectPersistedSnapshotFile(inspectPath)).toMatchObject({
      ok: true,
      status: "valid_legacy_v0"
    });
    expect(readRaw(inspectPath)).toBe(rawInspect);
    expect(backupFilesFor(inspectPath)).toEqual([]);

    createP1Store({ persistenceFile: loadPath });
    expect(readRaw(loadPath)).toBe(rawLoad);
    expect(backupFilesFor(loadPath)).toEqual([]);

    expect(planSnapshotMigrationDryRun(planPath).status).toBe("ready");
    expect(readRaw(planPath)).toBe(rawPlan);
    expect(backupFilesFor(planPath)).toEqual([]);

    expect(applySnapshotMigrationToCurrentVersion(applyPath).status).toBe("already_current");
    expect(readRaw(applyPath)).toBe(rawApply);
    expect(backupFilesFor(applyPath)).toEqual([]);

    writeValidSnapshot(persistPath);
    const store = createP1Store({ persistenceFile: persistPath });
    store.counters.restore_boundary = 1;
    store.persist();
    expect(backupFilesFor(persistPath)).toEqual([]);
    expect(tempFilesFor(persistPath)).toEqual([]);
  });
});

describe("JSON snapshot CAS apply and restore wiring", () => {
  const migrationApplyScriptPath = join(process.cwd(), "scripts/apply-json-snapshot-migration.ts");
  const restoreScriptPath = join(process.cwd(), "scripts/restore-json-snapshot.ts");

  function expectSafeConflictOutput(output: string): void {
    expect(output).toContain("store_snapshot_write_conflict");
    expect(output).not.toContain("SENSITIVE_PASSWORD_HASH_SENTINEL");
    expect(output).not.toContain("SENSITIVE_TOKEN_HASH_SENTINEL");
    expect(output).not.toContain("SENSITIVE_DECISION_PAYLOAD_SENTINEL");
    expect(output).not.toContain("SENSITIVE_DATABASE_URL_SENTINEL");
    expect(output).not.toContain("password_hash");
    expect(output).not.toContain("token_hash");
    expect(output).not.toContain("strategy_statement");
    expect(output).not.toContain('"payload"');
  }

  function snapshotContentsWithCounter(name: string, value: number): string {
    const sourcePath = createSnapshotPath(`${name}.json`);
    const store = createP1Store({ persistenceFile: sourcePath });
    store.counters[name] = value;
    store.persist();
    return readRaw(sourcePath);
  }

  it("keeps migration apply success behavior while using the CAS write path", () => {
    const snapshotPath = createSnapshotPath("cas-apply-success.json");
    const rawLegacy = writeSnapshot(snapshotPath, createLegacySnapshot());

    const result = applySnapshotMigrationToCurrentVersion(snapshotPath);

    expect(result).toMatchObject({
      action: "migrated_legacy_to_current",
      afterVersion: 1,
      beforeVersion: "legacy",
      sourcePath: snapshotPath,
      status: "applied",
      targetVersion: 1
    });
    expect(result.backupPath).toBeTruthy();
    expect(readRaw(result.backupPath!)).toBe(rawLegacy);
    expect(inspectPersistedSnapshotFile(snapshotPath)).toMatchObject({
      ok: true,
      status: "valid_v1"
    });
    expect(JSON.stringify(result)).not.toContain("store_snapshot_write_conflict");
    expect(JSON.stringify(result)).not.toContain('"payload"');
  });

  it("fails migration apply with a safe CAS conflict when the target changes before write-back", () => {
    const snapshotPath = createSnapshotPath("cas-apply-conflict.json");
    const rawLegacy = writeSnapshot(snapshotPath, createLegacySnapshot());
    const newerBytes = snapshotContentsWithCounter("cas_apply_newer_state", 11);

    const result = applySnapshotMigrationToCurrentVersion(snapshotPath, {
      beforeCasWriteForTesting() {
        writeRaw(snapshotPath, newerBytes);
      }
    });

    expect(result).toMatchObject({
      action: "blocked",
      afterVersion: null,
      beforeVersion: "legacy",
      sourcePath: snapshotPath,
      status: "cas_conflict",
      targetVersion: 1
    });
    expect(result.backupPath).toBeTruthy();
    expect(readRaw(result.backupPath!)).toBe(rawLegacy);
    expect(readRaw(snapshotPath)).toBe(newerBytes);
    expect(result.error?.code).toBe("store_snapshot_write_conflict");
    expect(result.reasons).toContain(
      "Snapshot changed before CAS write-back; newer target bytes were preserved."
    );
    expect(tempFilesFor(snapshotPath)).toEqual([]);
    expectSafeConflictOutput(JSON.stringify(result));
  });

  it("keeps restore success behavior for existing and missing targets while using CAS writes", () => {
    const existingBackupPath = createSnapshotPath("cas-restore-existing-backup.bak");
    const existingTargetPath = createSnapshotPath("cas-restore-existing-target.json");
    const missingBackupPath = createSnapshotPath("cas-restore-missing-backup.bak");
    const missingTargetPath = join(createTempDir(), "cas-restore-missing-target.json");
    writeSnapshot(existingBackupPath, { snapshot_version: 1, ...createLegacySnapshot() });
    writeValidSnapshot(existingTargetPath);
    writeSnapshot(missingBackupPath, createLegacySnapshot());

    const existing = restoreSnapshotFromBackup(existingBackupPath, existingTargetPath);
    const missing = restoreSnapshotFromBackup(missingBackupPath, missingTargetPath);

    expect(existing.status).toBe("restored");
    expect(existing.preRestoreBackupPath).toBeTruthy();
    expect(inspectPersistedSnapshotFile(existingTargetPath)).toMatchObject({
      ok: true,
      status: "valid_v1"
    });
    expect(missing).toMatchObject({
      preRestoreBackupPath: null,
      status: "restored",
      targetExistedBeforeRestore: false
    });
    expect(inspectPersistedSnapshotFile(missingTargetPath)).toMatchObject({
      ok: true,
      status: "valid_v1"
    });
  });

  it("fails restore with a safe CAS conflict when an existing target changes before write-back", () => {
    const backupPath = createSnapshotPath("cas-restore-conflict-backup.bak");
    const targetPath = createSnapshotPath("cas-restore-conflict-target.json");
    writeSnapshot(backupPath, { snapshot_version: 1, ...createLegacySnapshot() });
    const rawTarget = writeValidSnapshot(targetPath);
    const newerBytes = snapshotContentsWithCounter("cas_restore_newer_state", 12);

    const result = restoreSnapshotFromBackup(backupPath, targetPath, {
      beforeCasWriteForTesting() {
        writeRaw(targetPath, newerBytes);
      }
    });

    expect(result).toMatchObject({
      action: "blocked",
      backupPath,
      preRestoreBackupPath: expect.any(String),
      restoredVersion: null,
      status: "cas_conflict",
      targetExistedBeforeRestore: true,
      targetPath
    });
    expect(readRaw(result.preRestoreBackupPath!)).toBe(rawTarget);
    expect(readRaw(targetPath)).toBe(newerBytes);
    expect(result.error?.code).toBe("store_snapshot_write_conflict");
    expect(result.reasons).toContain(
      "Target changed before CAS restore write-back; newer target bytes were preserved."
    );
    expect(tempFilesFor(targetPath)).toEqual([]);
    expectSafeConflictOutput(JSON.stringify(result));
  });

  it("fails restore with a safe CAS conflict when a missing target is created before write-back", () => {
    const backupPath = createSnapshotPath("cas-restore-missing-conflict-backup.bak");
    const targetPath = join(createTempDir(), "cas-restore-missing-conflict-target.json");
    writeSnapshot(backupPath, { snapshot_version: 1, ...createLegacySnapshot() });
    const createdBytes = snapshotContentsWithCounter("cas_restore_created_target", 13);

    const result = restoreSnapshotFromBackup(backupPath, targetPath, {
      beforeCasWriteForTesting() {
        writeRaw(targetPath, createdBytes);
      }
    });

    expect(result).toMatchObject({
      action: "blocked",
      backupPath,
      preRestoreBackupPath: null,
      restoredVersion: null,
      status: "cas_conflict",
      targetExistedBeforeRestore: false,
      targetPath
    });
    expect(readRaw(targetPath)).toBe(createdBytes);
    expect(result.error?.code).toBe("store_snapshot_write_conflict");
    expectSafeConflictOutput(JSON.stringify(result));
  });

  it("maps apply and restore CAS conflicts to safe CLI output and exit code", () => {
    const applyScript = readFileSync(migrationApplyScriptPath, "utf8");
    const restoreScript = readFileSync(restoreScriptPath, "utf8");

    for (const script of [applyScript, restoreScript]) {
      expect(script).toContain('case "cas_conflict":');
      expect(script).toContain("return 8;");
      expect(script).toContain("JSON.stringify(result, null, 2)");
      expect(script).toContain("result.status");
      expect(script).toContain("result.reasons");
      expect(script).toContain("expected-current");
      expect(script).toContain("distributed coordination");
      expect(script).not.toContain("password_hash");
      expect(script).not.toContain("token_hash");
      expect(script).not.toContain("strategy_statement");
    }
  });
});

describe("JSON snapshot backup-before-write helper", () => {
  it("copies an existing v1 snapshot to a unique backup without changing source", () => {
    const snapshotPath = createSnapshotPath("source-v1.json");
    const rawSnapshot = writeValidSnapshot(snapshotPath);
    const sourceMtimeMs = statSync(snapshotPath).mtimeMs;

    const result = createSnapshotBackupBeforeWrite(snapshotPath);

    expect(result.sourcePath).toBe(snapshotPath);
    expect(result.backupPath).toContain(".snapshot-backups");
    expect(result.bytes).toBe(Buffer.byteLength(rawSnapshot));
    expect(new Date(result.createdAt).toISOString()).toBe(result.createdAt);
    expect(readRaw(result.backupPath)).toBe(rawSnapshot);
    expect(readRaw(snapshotPath)).toBe(rawSnapshot);
    expect(statSync(snapshotPath).mtimeMs).toBe(sourceMtimeMs);
    expect(backupFilesFor(snapshotPath)).toEqual([basename(result.backupPath)]);
  });

  it("creates the requested backup directory when it is missing", () => {
    const snapshotPath = createSnapshotPath("source-custom-dir.json");
    const backupDirectory = join(snapshotPath, "..", "operator-backups");
    const rawSnapshot = writeValidSnapshot(snapshotPath);

    const result = createSnapshotBackupBeforeWrite(snapshotPath, { backupDirectory });

    expect(result.backupPath).toContain("operator-backups");
    expect(readRaw(result.backupPath)).toBe(rawSnapshot);
    expect(readRaw(snapshotPath)).toBe(rawSnapshot);
  });

  it("backs up legacy v0 and corrupt snapshots as raw bytes without parsing", () => {
    const legacyPath = createSnapshotPath("legacy-backup.json");
    const corruptPath = createSnapshotPath("corrupt-backup.json");
    const rawLegacy = writeSnapshot(legacyPath, createLegacySnapshot());
    const rawCorrupt = writeRaw(corruptPath, '{"snapshot_version": 1,');

    const legacyBackup = createSnapshotBackupBeforeWrite(legacyPath, { label: "legacy-v0" });
    const corruptBackup = createSnapshotBackupBeforeWrite(corruptPath, { label: "corrupt-json" });

    expect(readRaw(legacyBackup.backupPath)).toBe(rawLegacy);
    expect(readRaw(corruptBackup.backupPath)).toBe(rawCorrupt);
    expect(readRaw(legacyPath)).toBe(rawLegacy);
    expect(readRaw(corruptPath)).toBe(rawCorrupt);
  });

  it("creates distinct backups without overwriting earlier backups", () => {
    const snapshotPath = createSnapshotPath("collision-safe.json");
    const rawSnapshot = writeValidSnapshot(snapshotPath);

    const firstBackup = createSnapshotBackupBeforeWrite(snapshotPath, { label: "operator-copy" });
    const secondBackup = createSnapshotBackupBeforeWrite(snapshotPath, { label: "operator-copy" });

    expect(secondBackup.backupPath).not.toBe(firstBackup.backupPath);
    expect(readRaw(firstBackup.backupPath)).toBe(rawSnapshot);
    expect(readRaw(secondBackup.backupPath)).toBe(rawSnapshot);
    expect(backupFilesFor(snapshotPath).sort()).toEqual(
      [basename(firstBackup.backupPath), basename(secondBackup.backupPath)].sort()
    );
  });

  it("fails clearly for a missing source without creating a default backup directory", () => {
    const snapshotPath = join(createTempDir(), "missing-source.json");

    const error = expectSnapshotError(
      () => createSnapshotBackupBeforeWrite(snapshotPath),
      "store_snapshot_backup_failed"
    );

    expect((error.cause as NodeJS.ErrnoException).code).toBe("ENOENT");
    expect(existsSync(defaultBackupDirectoryFor(snapshotPath))).toBe(false);
  });

  it("fails closed when the backup destination cannot be created", () => {
    const snapshotPath = createSnapshotPath("blocked-backup-dir.json");
    const rawSnapshot = writeValidSnapshot(snapshotPath);
    const backupDirectory = join(snapshotPath, "..", "blocked-backups");
    writeRaw(backupDirectory, "not a directory");

    const error = expectSnapshotError(
      () => createSnapshotBackupBeforeWrite(snapshotPath, { backupDirectory }),
      "store_snapshot_backup_failed"
    );

    expect(["EEXIST", "ENOTDIR"]).toContain((error.cause as NodeJS.ErrnoException).code);
    expect(readRaw(snapshotPath)).toBe(rawSnapshot);
    expect(readRaw(backupDirectory)).toBe("not a directory");
  });

  it("does not add backups during inspection, runtime load failure, or normal persist", () => {
    const inspectPath = createSnapshotPath("inspection-no-backup.json");
    const invalidLoadPath = createSnapshotPath("load-no-backup.json");
    const persistPath = createSnapshotPath("persist-no-backup.json");
    const invalidSnapshot = createLegacySnapshot({ snapshot_version: 2 });
    writeValidSnapshot(inspectPath);
    writeSnapshot(invalidLoadPath, invalidSnapshot);

    const inspection = inspectPersistedSnapshotFile(inspectPath);
    expect(inspection.ok).toBe(true);
    expect(backupFilesFor(inspectPath)).toEqual([]);

    expectSnapshotError(
      () => createP1Store({ persistenceFile: invalidLoadPath }),
      "store_snapshot_unsupported_version"
    );
    expect(backupFilesFor(invalidLoadPath)).toEqual([]);

    const store = createP1Store({ persistenceFile: persistPath });
    store.counters.backup_regression = 1;
    store.persist();
    expect(backupFilesFor(persistPath)).toEqual([]);
  });
});
