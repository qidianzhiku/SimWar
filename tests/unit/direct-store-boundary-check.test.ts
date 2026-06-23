import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "simwar-direct-store-boundary-"));
  tempDirs.push(dir);
  return dir;
}

function writeFixture(root: string, relativePath: string, contents: string): string {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
  return path;
}

function writeManifest(root: string, entries: unknown[]): string {
  const path = join(root, "direct-store-manifest.json");
  writeFileSync(
    path,
    JSON.stringify(
      {
        schemaVersion: 1,
        approvedExceptions: entries
      },
      null,
      2
    )
  );
  return path;
}

function approvedEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "server-route-request-runtime-store-read-001",
    file: "services/api/src/server.ts",
    symbol: "routeRequest",
    accessKind: "read",
    expression: "runtime.store",
    occurrence: 1,
    runtimeClass: "active runtime",
    businessArea: "other",
    boundaryStatus: "approved exception",
    justification: "Legacy direct store access frozen by P1-003A guard.",
    followUp: "Relates to #114",
    evidence: "fixture routeRequest runtime.store read",
    ...overrides
  };
}

function runGuard(args: string[]) {
  return spawnSync(process.execPath, ["scripts/check-direct-store-boundaries.mjs", ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

describe("direct store boundary guard", () => {
  it("accepts the approved inventory manifest", () => {
    const root = createTempDir();
    const file = writeFixture(
      root,
      "services/api/src/server.ts",
      [
        "export function routeRequest(runtime: { store: unknown }) {",
        "  const store = runtime.store;",
        "  return store;",
        "}"
      ].join("\n")
    );
    const manifest = writeManifest(root, [approvedEntry()]);

    const result = runGuard(["--root", root, "--manifest", manifest, "--files", file]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("approved-legacy-exception");
    expect(result.stdout).toContain("new-unapproved-runtime-direct-store-access: 0");
  });

  it("rejects an unapproved runtime direct-store access", () => {
    const root = createTempDir();
    const file = writeFixture(
      root,
      "services/api/src/server.ts",
      [
        "export function routeRequest(runtime: { store: { users: unknown[] } }) {",
        "  const store = runtime.store;",
        "  store.users.push({});",
        "}"
      ].join("\n")
    );
    const manifest = writeManifest(root, [approvedEntry()]);

    const result = runGuard(["--root", root, "--manifest", manifest, "--files", file]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("new-unapproved-runtime-direct-store-access");
    expect(result.stdout).toContain("store.users.push");
  });

  it("rejects a second call-site in an allowlisted file", () => {
    const root = createTempDir();
    const file = writeFixture(
      root,
      "services/api/src/server.ts",
      [
        "export function routeRequest(runtime: { store: unknown }) {",
        "  const store = runtime.store;",
        "  const second = runtime.store;",
        "  return second ?? store;",
        "}"
      ].join("\n")
    );
    const manifest = writeManifest(root, [approvedEntry()]);

    const result = runGuard(["--root", root, "--manifest", manifest, "--files", file]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("new-unapproved-runtime-direct-store-access");
    expect(result.stdout).toContain("occurrence=2");
  });

  it("classifies test-only direct-store syntax as excluded non-runtime path", () => {
    const root = createTempDir();
    const file = writeFixture(
      root,
      "tests/unit/direct-store-fixture.test.ts",
      "export function testHelper(runtime: { store: { users: unknown[] } }) { runtime.store.users.push({}); }"
    );
    const manifest = writeManifest(root, []);

    const result = runGuard(["--root", root, "--manifest", manifest, "--files", file]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("excluded-non-runtime-path");
    expect(result.stdout).toContain("new-unapproved-runtime-direct-store-access: 0");
  });

  it("rejects a stale approved exception", () => {
    const root = createTempDir();
    const file = writeFixture(
      root,
      "services/api/src/server.ts",
      "export function routeRequest() { return undefined; }"
    );
    const manifest = writeManifest(root, [approvedEntry()]);

    const result = runGuard(["--root", root, "--manifest", manifest, "--files", file]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("stale-approved-exception");
  });

  it("rejects duplicate approved exceptions", () => {
    const root = createTempDir();
    const file = writeFixture(
      root,
      "services/api/src/server.ts",
      "export function routeRequest(runtime: { store: unknown }) { return runtime.store; }"
    );
    const manifest = writeManifest(root, [approvedEntry(), approvedEntry()]);

    const result = runGuard(["--root", root, "--manifest", manifest, "--files", file]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("duplicate-approved-exception");
  });

  it("emits stable output for repeated violation scans", () => {
    const root = createTempDir();
    const file = writeFixture(
      root,
      "services/api/src/server.ts",
      [
        "export function routeRequest(runtime: { store: { users: unknown[] } }) {",
        "  const store = runtime.store;",
        "  store.users.push({});",
        "}"
      ].join("\n")
    );
    const manifest = writeManifest(root, [approvedEntry()]);

    const first = runGuard(["--root", root, "--manifest", manifest, "--files", file]);
    const second = runGuard(["--root", root, "--manifest", manifest, "--files", file]);

    expect(first.status).toBe(1);
    expect(second.status).toBe(1);
    expect(first.stdout).toBe(second.stdout);
  });

  it("accepts the current repository baseline inventory", () => {
    const result = runGuard([]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("approved-legacy-exception");
    expect(result.stdout).toContain("new-unapproved-runtime-direct-store-access: 0");
    expect(result.stdout).toContain(
      "evidence limitation: alias/indirect store access not fully statically detected"
    );
  });
});
