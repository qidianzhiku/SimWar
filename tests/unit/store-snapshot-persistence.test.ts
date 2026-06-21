import { spawnSync } from "node:child_process";
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
  createSnapshotBackupBeforeWrite,
  createP1Store,
  inspectPersistedSnapshotFile,
  type SnapshotInspectionResult,
  type SnapshotFileSystem,
  type SimWarStore
} from "../../services/api/src/store";

const tempDirs: string[] = [];
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const tsxCliPath = join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");

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
      encoding: "utf8"
    }
  );
}

function runNpmInspectionCommand(args: string[]) {
  if (process.platform === "win32") {
    const command = ["npm run --silent snapshot:inspect --", ...args].join(" ");
    return spawnSync("cmd.exe", ["/d", "/c", command], {
      cwd: process.cwd(),
      encoding: "utf8"
    });
  }

  return spawnSync(npmCommand, ["run", "--silent", "snapshot:inspect", "--", ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
}

function parseInspectionJsonOutput(output: string): SnapshotInspectionResult {
  return JSON.parse(output) as SnapshotInspectionResult;
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
    const result = runNpmInspectionCommand(["--json", snapshotPath]);

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
