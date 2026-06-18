import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApiServer } from "../../services/api/src/server";
import { StoreSnapshotError, createP1Store } from "../../services/api/src/store";

const tempDirs: string[] = [];
const TEST_SECURITY_CONFIG = {
  environment: "test" as const,
  internalServiceToken: "test-internal-service-token",
  jwtSecret: "test-jwt-secret-with-sufficient-length"
};

function createSnapshotPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "simwar-snapshot-startup-"));
  tempDirs.push(dir);
  return join(dir, "simwar-store.json");
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

describe("JSON snapshot startup behavior", () => {
  it("fails API startup when the configured JSON snapshot is corrupted", () => {
    const snapshotPath = createSnapshotPath();
    writeFileSync(snapshotPath, '{"users":', "utf8");

    expect(() =>
      createApiServer(createP1Store({ persistenceFile: snapshotPath }), {
        securityConfig: TEST_SECURITY_CONFIG
      })
    ).toThrow(StoreSnapshotError);

    expect(() =>
      createApiServer(createP1Store({ persistenceFile: snapshotPath }), {
        securityConfig: TEST_SECURITY_CONFIG
      })
    ).toThrow("store_snapshot_corrupted");
  });
});
