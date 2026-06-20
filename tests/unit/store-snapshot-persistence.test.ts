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
  unlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  StoreSnapshotError,
  createP1Store,
  type SnapshotFileSystem,
  type SimWarStore
} from "../../services/api/src/store";

const tempDirs: string[] = [];

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

function writeValidSnapshot(path: string): string {
  createP1Store({ persistenceFile: path });
  return readRaw(path);
}

function tempFilesFor(path: string): string[] {
  const prefix = `${basename(path)}.`;
  return readdirSync(join(path, "..")).filter(
    (entry) => entry.startsWith(prefix) && entry.endsWith(".tmp")
  );
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
      tenants: expect.any(Array),
      users: expect.any(Array),
      counters: expect.any(Object)
    });
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
        capacity: { planned_units: 120 },
        marketing: { channel_mix: { offline: 0.4, online: 0.6 } },
        operations: { service_quality_budget: 30000 },
        pricing: { base_price: 12000 }
      },
      round_id: "round_snapshot_context_1",
      round_no: 1,
      run_id: "run_snapshot_context",
      status: "submitted",
      submitted_by: "usr_student",
      team_id: "team_alpha",
      tenant_id: "tenant_demo",
      validation_report: { errors: [], warnings: [] },
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

    store.courses.push({
      course_id: "course_other_snapshot",
      created_by: "usr_other_teacher",
      parameter_set_id: "param_toy_approved_1",
      scenario_package_id: "scenario_eldercare_demo",
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
      parameter_set_id: "param_toy_approved_1",
      run_id: "run_other_snapshot",
      scenario_package_id: "scenario_eldercare_demo",
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
