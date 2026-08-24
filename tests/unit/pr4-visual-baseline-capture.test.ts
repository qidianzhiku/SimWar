import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = resolve(".");
const scriptPath = resolve(repositoryRoot, "scripts/capture-pr4-visual-baseline.mjs");
const scriptSource = readFileSync(scriptPath, "utf8");
const temporaryRoots: string[] = [];

function runCapture(args: string[]) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true
  });
}

function createCleanSource() {
  const root = mkdtempSync(join(tmpdir(), "simwar-pr4-capture-test-"));
  temporaryRoots.push(root);
  const sourceRoot = join(root, "source");
  const outputRoot = join(root, "evidence");
  mkdirSync(sourceRoot);
  writeFileSync(join(sourceRoot, "package.json"), '{"name":"pr4-capture-fixture"}\n');
  execFileSync("git", ["init", "--quiet", sourceRoot], { cwd: repositoryRoot });
  execFileSync("git", ["-C", sourceRoot, "config", "user.email", "pr4@example.invalid"]);
  execFileSync("git", ["-C", sourceRoot, "config", "user.name", "PR4 Capture Test"]);
  execFileSync("git", ["-C", sourceRoot, "add", "package.json"]);
  execFileSync("git", ["-C", sourceRoot, "commit", "--quiet", "-m", "fixture"]);
  const expectedSha = execFileSync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], {
    encoding: "utf8"
  }).trim();
  execFileSync("git", ["-C", sourceRoot, "checkout", "--quiet", "--detach", expectedSha]);
  return { sourceRoot, outputRoot, expectedSha };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("PR4 visual baseline capture CLI", () => {
  it("does not persist raw network or browser error text in evidence artifacts", () => {
    expect(scriptSource).not.toContain("data.captureError = stringifyError(error)");
    expect(scriptSource).toContain('data.captureError = "capture_failed"');
    expect(scriptSource).toContain('logLines.push("capture failed; details emitted to stderr")');
  });

  it.each([
    ["missing source", ["--output", "C:\\pr4-evidence", "--expected-sha", "a".repeat(40)]],
    ["missing output", ["--source-root", repositoryRoot, "--expected-sha", "a".repeat(40)]],
    ["missing expected SHA", ["--source-root", repositoryRoot, "--output", "C:\\pr4-evidence"]],
    [
      "invalid expected SHA",
      [
        "--source-root",
        repositoryRoot,
        "--output",
        "C:\\pr4-evidence",
        "--expected-sha",
        "not-a-sha"
      ]
    ],
    [
      "relative output",
      [
        "--source-root",
        repositoryRoot,
        "--output",
        "relative-evidence",
        "--expected-sha",
        "a".repeat(40)
      ]
    ],
    [
      "relative source",
      ["--source-root", ".", "--output", "C:\\pr4-evidence", "--expected-sha", "a".repeat(40)]
    ]
  ])("fails closed for %s", (_label, args) => {
    const result = runCapture(args);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/(required|absolute|SHA|source|output)/i);
  });

  it("fails closed when output is inside the source checkout", () => {
    const fixture = createCleanSource();
    const result = runCapture([
      "--source-root",
      fixture.sourceRoot,
      "--output",
      join(fixture.sourceRoot, "evidence"),
      "--expected-sha",
      fixture.expectedSha,
      "--dry-run"
    ]);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/outside.*source|source.*outside/i);
  });

  it("fails closed when evidence or store paths are inside the harness product checkout", () => {
    const fixture = createCleanSource();
    const insideProductOutput = join(repositoryRoot, "tmp", "pr4-baseline-capture-test-evidence");
    const result = runCapture([
      "--source-root",
      fixture.sourceRoot,
      "--output",
      insideProductOutput,
      "--expected-sha",
      fixture.expectedSha,
      "--dry-run"
    ]);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/outside.*product|product.*outside/i);

    const storeResult = runCapture([
      "--source-root",
      fixture.sourceRoot,
      "--output",
      fixture.outputRoot,
      "--store",
      join(repositoryRoot, "tmp", "pr4-baseline-capture-test-store.json"),
      "--expected-sha",
      fixture.expectedSha,
      "--dry-run"
    ]);
    expect(storeResult.status).not.toBe(0);
    expect(`${storeResult.stdout}\n${storeResult.stderr}`).toMatch(
      /outside.*product|product.*outside/i
    );
  }, 15_000);

  it("fails closed when the store is outside the controlled temporary store root", () => {
    const fixture = createCleanSource();
    const result = runCapture([
      "--source-root",
      fixture.sourceRoot,
      "--output",
      fixture.outputRoot,
      "--store",
      join(fixture.outputRoot, "arbitrary-store.json"),
      "--expected-sha",
      fixture.expectedSha,
      "--dry-run"
    ]);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/controlled.*temporary.*store/i);
  });

  it("fails closed when the BASE checkout is attached to a branch", () => {
    const fixture = createCleanSource();
    execFileSync("git", ["-C", fixture.sourceRoot, "switch", "--quiet", "master"]);
    const result = runCapture([
      "--source-root",
      fixture.sourceRoot,
      "--output",
      fixture.outputRoot,
      "--expected-sha",
      fixture.expectedSha,
      "--dry-run"
    ]);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/detached/i);
  });

  it("fails closed when a supplied candidate SHA does not match the harness checkout", () => {
    const fixture = createCleanSource();
    const result = runCapture([
      "--source-root",
      fixture.sourceRoot,
      "--output",
      fixture.outputRoot,
      "--expected-sha",
      fixture.expectedSha,
      "--candidate-sha",
      "0".repeat(40),
      "--dry-run"
    ]);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/candidate.*SHA.*mismatch/i);
  });

  it("emits a deterministic 20-surface dry-run contract", () => {
    const fixture = createCleanSource();
    const result = runCapture([
      "--source-root",
      fixture.sourceRoot,
      "--output",
      fixture.outputRoot,
      "--expected-sha",
      fixture.expectedSha,
      "--dry-run"
    ]);
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const manifestPath = join(fixture.outputRoot, "manifest.json");
    const receiptPath = join(fixture.outputRoot, "receipt.json");
    expect(existsSync(manifestPath)).toBe(true);
    expect(existsSync(receiptPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      schema_version: string;
      status: string;
      expected_pair_count: number;
      expected_names: string[];
      viewports: Array<{ width: number; height: number }>;
      capture_plan: Array<{
        name: string;
        viewport: { width: number; height: number };
        full_page: boolean;
        scroll_y: number;
        mouse: { x: number; y: number };
      }>;
    };
    const expectedViewports = [
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
      { width: 1024, height: 768 },
      { width: 390, height: 844 }
    ];
    const expectedNames = [
      "admin-admin-tenants-entitlements-ready",
      "enterprise-admin-enterprise-course-factory-ready",
      "teacher-teacher-blockers-ready",
      "student-student-cockpit-ready",
      "lab-lab-state-matrix-state-matrix"
    ]
      .flatMap((prefix) =>
        expectedViewports.map(({ width, height }) => `${prefix}-${width}x${height}.png`)
      )
      .sort();
    expect(manifest.schema_version).toBe("pr4-base-visual-capture.v1");
    expect(manifest.status).toBe("DRY_RUN");
    expect(manifest.expected_pair_count).toBe(20);
    expect(manifest.expected_names).toEqual(expectedNames);
    expect(manifest.viewports).toEqual(expectedViewports);
    expect(manifest.capture_plan).toHaveLength(20);
    expect(manifest.capture_plan.map((entry) => entry.name).sort()).toEqual(expectedNames);
    expect(manifest.capture_plan.every((entry) => entry.full_page === false)).toBe(true);
    expect(manifest.capture_plan.every((entry) => entry.scroll_y === 0)).toBe(true);
    expect(manifest.capture_plan.every((entry) => entry.mouse.x === 0 && entry.mouse.y === 0)).toBe(
      true
    );
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as {
      schema_version: string;
      status: string;
      expected_pair_count: number;
      actual_pair_count: number;
    };
    expect(receipt).toMatchObject({
      schema_version: "pr4-base-visual-receipt.v1",
      status: "DRY_RUN",
      expected_pair_count: 20,
      actual_pair_count: 0
    });
  }, 30_000);
});
