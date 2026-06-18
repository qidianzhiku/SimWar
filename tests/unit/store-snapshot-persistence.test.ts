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
  failure: "read-eacces" | "read-eperm" | "read-eio" | "write" | "fsync" | "rename"
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
