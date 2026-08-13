/** @vitest-environment jsdom */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "../../apps/student/src/App";

const root = resolve(".");
const runNode = (script: string, args: string[] = []) =>
  execFileSync(process.execPath, [resolve(root, script), ...args], {
    cwd: root,
    encoding: "utf8"
  });
const runNodeResult = (script: string, args: string[] = []) =>
  spawnSync(
    process.execPath,
    [resolve(root, script), ...args, ...(script.includes("assemble-pr4") ? ["--allow-dirty"] : [])],
    {
      cwd: root,
      encoding: "utf8"
    }
  );
const blackPixelPng =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4AWMAgv8AAQQBAP8H9UQAAAAASUVORK5CYII=";
const redPixelPng =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWP4z8DwHwAFAAH/e+m+7wAAAABJRU5ErkJggg==";
const writePng = (path: string, base64: string) =>
  writeFileSync(path, Buffer.from(base64, "base64"));
const playwrightRequire = createRequire(import.meta.url);

describe("Product PR4 integration contracts", () => {
  it("declares the shared UI workspace in Admin and Teacher and the axe license metadata", () => {
    const admin = JSON.parse(readFileSync(resolve(root, "apps/admin/package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    const teacher = JSON.parse(
      readFileSync(resolve(root, "apps/teacher/package.json"), "utf8")
    ) as {
      dependencies?: Record<string, string>;
    };
    const rootManifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      devDependencies?: Record<string, string>;
    };
    const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8")) as {
      packages?: Record<string, { license?: string; version?: string }>;
    };

    expect(admin.dependencies?.["@simwar/ui"]).toBe("0.1.0");
    expect(teacher.dependencies?.["@simwar/ui"]).toBe("0.1.0");
    expect(rootManifest.devDependencies?.["@axe-core/playwright"]).toBeTruthy();
    expect(lock.packages?.["node_modules/@axe-core/playwright"]?.license).toBe("MPL-2.0");
  });

  it("marks the stable Student hash location as the current navigation page", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('href="#student-role-mission"');
    expect(markup).toContain('href="#student-role-mission" aria-current="page"');
  });

  it("verifies the checked-out head and records branch cleanliness", () => {
    const actualSha = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8"
    }).trim();
    const report = JSON.parse(
      runNode("scripts/check-pr4-exact-head.mjs", [actualSha, "--allow-dirty"])
    ) as {
      expected_sha: string;
      pr_head_sha: string;
      actual_sha: string;
      checkout_sha: string;
      checkout_ref: string;
      branch: string;
      clean: boolean;
    };

    expect(report.expected_sha).toBe(actualSha);
    expect(report.pr_head_sha).toBe(actualSha);
    expect(report.actual_sha).toBe(actualSha);
    expect(report.checkout_sha).toBe(actualSha);
    expect(report.checkout_ref).toBeTruthy();
    expect(report.branch).toBeTruthy();
    expect(typeof report.clean).toBe("boolean");
  });

  it("emits bundle budget JSON with exact baselines from built app directories", () => {
    const fixture = mkdtempSync(join(tmpdir(), "simwar-pr4-budgets-"));
    try {
      for (const app of ["admin", "teacher", "student"]) {
        const assetDir = join(fixture, "apps", app, "dist", "assets");
        mkdirSync(assetDir, { recursive: true });
        writeFileSync(join(assetDir, `${app}.js`), "console.log('pr4');\n");
        writeFileSync(join(assetDir, `${app}.css`), ".app{display:block}\n");
      }

      const actualSha = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8"
      }).trim();
      const report = JSON.parse(
        runNode("scripts/measure-frontend-budgets.mjs", [
          "--dist-root",
          fixture,
          "--base-sha",
          "0000000000000000000000000000000000000000",
          "--head-sha",
          actualSha
        ])
      ) as {
        schema_version: number;
        budgets: Record<
          string,
          { js: { raw_kb: number; gzip_kb: number }; css: { raw_kb: number; gzip_kb: number } }
        >;
      };

      expect(report.schema_version).toBe(1);
      expect(report.budgets.admin.js).toMatchObject({
        baseline_raw_kb: 273.62,
        baseline_gzip_kb: 84.49
      });
      expect(report.budgets.teacher.css).toMatchObject({
        baseline_raw_kb: 34.18,
        baseline_gzip_kb: 6.52
      });
      expect(report.budgets.student.js).toMatchObject({
        baseline_raw_kb: 249.73,
        baseline_gzip_kb: 77.44
      });
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("fails a changed PNG pair above threshold and records separate BASE/HEAD SHA values", () => {
    const fixture = mkdtempSync(join(tmpdir(), "simwar-pr4-visual-"));
    try {
      const baseline = join(fixture, "baseline");
      const candidate = join(fixture, "candidate");
      mkdirSync(baseline);
      mkdirSync(candidate);
      const diff = join(fixture, "diff");
      writePng(join(baseline, "student-ready-390x844.png"), blackPixelPng);
      writePng(join(candidate, "student-ready-390x844.png"), redPixelPng);

      const output = join(fixture, "manifest.json");
      const actualSha = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8"
      }).trim();
      const result = runNodeResult("scripts/assemble-pr4-visual-manifest.mjs", [
        "--baseline",
        baseline,
        "--candidate",
        candidate,
        "--diff-root",
        diff,
        "--output",
        output,
        "--max-diff-pixel-ratio",
        "0.01",
        "--base-sha",
        "base-sha",
        "--head-sha",
        actualSha,
        "--state",
        "ready"
      ]);
      expect(result.status).toBe(1);
      const manifest = JSON.parse(readFileSync(output, "utf8")) as {
        threshold: { max_diff_pixel_ratio: number };
        status: string;
        ready_for_review: boolean;
        pixel_diff: { status: string; compared_pairs: number };
        base_sha: string;
        head_sha: string;
        actual_sha: string;
        surfaces: Array<{
          baseline_sha256: string;
          candidate_sha256: string;
          base_sha: string;
          head_sha: string;
          diff_path: string | null;
          diff_pixel_ratio: number;
          role: string | null;
          viewport: { width: number; height: number } | null;
          state: string;
        }>;
      };

      expect(manifest.threshold.max_diff_pixel_ratio).toBe(0.01);
      expect(manifest.status).toBe("failed");
      expect(manifest.ready_for_review).toBe(false);
      expect(manifest.pixel_diff).toMatchObject({ status: "failed", compared_pairs: 1 });
      expect(manifest.base_sha).toBe("base-sha");
      expect(manifest.head_sha).toBe(actualSha);
      expect(manifest.actual_sha).toBe(actualSha);
      expect(manifest.surfaces).toHaveLength(1);
      expect(manifest.surfaces[0]).toMatchObject({
        base_sha: "base-sha",
        head_sha: actualSha,
        role: "student",
        viewport: { width: 390, height: 844 },
        state: "ready"
      });
      expect(manifest.surfaces[0]?.diff_pixel_ratio).toBeGreaterThan(0);
      expect(manifest.surfaces[0]?.diff_path).toBeTruthy();
      expect(existsSync(resolve(fixture, manifest.surfaces[0]?.diff_path ?? ""))).toBe(true);
      expect(manifest.surfaces[0]?.baseline_sha256).not.toBe(
        manifest.surfaces[0]?.candidate_sha256
      );
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("passes an identical PNG pair only after a real pixel comparison", () => {
    const fixture = mkdtempSync(join(tmpdir(), "simwar-pr4-visual-identical-"));
    try {
      const baseline = join(fixture, "baseline");
      const candidate = join(fixture, "candidate");
      const diff = join(fixture, "diff");
      mkdirSync(baseline);
      mkdirSync(candidate);
      writePng(join(baseline, "student-ready-390x844.png"), blackPixelPng);
      writePng(join(candidate, "student-ready-390x844.png"), blackPixelPng);
      const output = join(fixture, "manifest.json");
      const actualSha = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8"
      }).trim();

      const result = runNodeResult("scripts/assemble-pr4-visual-manifest.mjs", [
        "--baseline",
        baseline,
        "--candidate",
        candidate,
        "--diff-root",
        diff,
        "--output",
        output,
        "--max-diff-pixel-ratio",
        "0.01",
        "--base-sha",
        "base-sha",
        "--head-sha",
        actualSha
      ]);
      expect(result.status).toBe(0);
      const manifest = JSON.parse(readFileSync(output, "utf8")) as {
        status: string;
        ready_for_review: boolean;
        clean: boolean | null;
        automatic_threshold: { enforced: boolean };
        pixel_diff: { status: string; compared_pairs: number; max_diff_pixel_ratio: number };
        surfaces: Array<{ diff_path: string | null; diff_pixel_ratio: number }>;
      };
      expect(manifest.status).toBe("passed");
      expect(manifest.ready_for_review).toBe(manifest.clean === true);
      expect(manifest.automatic_threshold.enforced).toBe(manifest.clean === true);
      expect(manifest.pixel_diff).toMatchObject({
        status: "passed",
        compared_pairs: 1,
        max_diff_pixel_ratio: 0.01
      });
      expect(manifest.surfaces[0]).toMatchObject({
        diff_path: null,
        diff_pixel_ratio: 0
      });
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("retains a diff PNG when a changed pair remains within the threshold", () => {
    const fixture = mkdtempSync(join(tmpdir(), "simwar-pr4-visual-within-threshold-"));
    try {
      const baseline = join(fixture, "baseline");
      const candidate = join(fixture, "candidate");
      const diff = join(fixture, "diff");
      mkdirSync(baseline);
      mkdirSync(candidate);
      const { PNG } = playwrightRequire("playwright-core/lib/utilsBundle") as {
        PNG: { sync: { write: (value: unknown) => Buffer } };
      };
      const baselineData = Buffer.alloc(10 * 10 * 4, 0);
      const candidateData = Buffer.from(baselineData);
      candidateData[0] = 255;
      candidateData[3] = 255;
      writeFileSync(
        join(baseline, "admin-ready-390x844.png"),
        PNG.sync.write({ width: 10, height: 10, data: baselineData })
      );
      writeFileSync(
        join(candidate, "admin-ready-390x844.png"),
        PNG.sync.write({ width: 10, height: 10, data: candidateData })
      );
      const output = join(fixture, "manifest.json");
      const actualSha = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8"
      }).trim();
      const result = runNodeResult("scripts/assemble-pr4-visual-manifest.mjs", [
        "--baseline",
        baseline,
        "--candidate",
        candidate,
        "--diff-root",
        diff,
        "--output",
        output,
        "--max-diff-pixel-ratio",
        "0.01",
        "--base-sha",
        "base-sha",
        "--head-sha",
        actualSha
      ]);
      expect(result.status).toBe(0);
      const manifest = JSON.parse(readFileSync(output, "utf8")) as {
        status: string;
        clean: boolean | null;
        automatic_threshold: { enforced: boolean };
        surfaces: Array<{ diff_path: string | null; diff_pixel_ratio: number; status: string }>;
      };
      expect(manifest.status).toBe("passed");
      expect(manifest.automatic_threshold.enforced).toBe(manifest.clean === true);
      expect(manifest.surfaces[0]).toMatchObject({ status: "passed" });
      expect(manifest.surfaces[0]?.diff_pixel_ratio).toBeGreaterThan(0);
      expect(manifest.surfaces[0]?.diff_path).toBeTruthy();
      expect(existsSync(resolve(fixture, manifest.surfaces[0]?.diff_path ?? ""))).toBe(true);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("marks missing visual pairs as not-ready and retains BASE/HEAD provenance", () => {
    const fixture = mkdtempSync(join(tmpdir(), "simwar-pr4-visual-missing-"));
    try {
      const baseline = join(fixture, "baseline");
      const candidate = join(fixture, "candidate");
      mkdirSync(baseline);
      mkdirSync(candidate);
      writePng(join(baseline, "teacher-ready-390x844.png"), blackPixelPng);
      const output = join(fixture, "manifest.json");
      const result = runNodeResult("scripts/assemble-pr4-visual-manifest.mjs", [
        "--baseline",
        baseline,
        "--candidate",
        candidate,
        "--diff-root",
        join(fixture, "diff"),
        "--output",
        output,
        "--max-diff-pixel-ratio",
        "0.01",
        "--base-sha",
        "base-sha",
        "--head-sha",
        "head-sha"
      ]);
      expect(result.status).toBe(1);
      const manifest = JSON.parse(readFileSync(output, "utf8")) as {
        status: string;
        ready_for_review: boolean;
        base_sha: string;
        head_sha: string;
        actual_sha: string;
        pixel_diff: { status: string; compared_pairs: number };
        surfaces: Array<{ status: string; baseline_present: boolean; candidate_present: boolean }>;
      };
      expect(manifest.status).toBe("not_ready");
      expect(manifest.ready_for_review).toBe(false);
      expect(manifest.base_sha).toBe("base-sha");
      expect(manifest.head_sha).toBe("head-sha");
      expect(manifest.actual_sha).toBeTruthy();
      expect(manifest.pixel_diff).toMatchObject({ status: "not_ready", compared_pairs: 0 });
      expect(manifest.surfaces[0]).toMatchObject({
        status: "not_ready",
        baseline_present: true,
        candidate_present: false
      });
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("requires an external evidence root and wires the real UI Lab server into PR4", () => {
    const configSource = readFileSync(resolve(root, "playwright.pr4.config.ts"), "utf8");
    const e2eSource = readFileSync(resolve(root, "tests/e2e-ui/pr4-integration.spec.ts"), "utf8");
    const labE2eSource = readFileSync(
      resolve(root, "tests/e2e-ui/pr4-design-system-lab.spec.ts"),
      "utf8"
    );

    expect(configSource).toContain("PR4_EVIDENCE_ROOT");
    expect(configSource).toContain("3004");
    expect(configSource).toContain("dev:lab");
    expect(e2eSource).toContain("PR4_EVIDENCE_ROOT");
    expect(labE2eSource).toContain("DesignSystemLab");
    expect(labE2eSource).toContain("PR4_EVIDENCE_ROOT");
    expect(labE2eSource).toContain("data-state");
  });

  it("emits BASE/HEAD provenance and fails a static budget threshold", () => {
    const fixture = mkdtempSync(join(tmpdir(), "simwar-pr4-budgets-provenance-"));
    try {
      for (const app of ["admin", "teacher", "student"]) {
        const assetDir = join(fixture, "apps", app, "dist", "assets");
        mkdirSync(assetDir, { recursive: true });
        writeFileSync(join(assetDir, `${app}.js`), Buffer.alloc(400_000, 7));
        writeFileSync(join(assetDir, `${app}.css`), "body{color:#000}\n");
      }
      const output = join(fixture, "budget.json");
      const result = runNodeResult("scripts/measure-frontend-budgets.mjs", [
        "--dist-root",
        fixture,
        "--output",
        output,
        "--base-sha",
        "base-sha",
        "--head-sha",
        "head-sha"
      ]);
      expect(result.status).toBe(1);
      const report = JSON.parse(readFileSync(output, "utf8")) as {
        base_sha: string;
        head_sha: string;
        actual_sha: string;
        status: string;
        failures: string[];
      };
      expect(report).toMatchObject({
        base_sha: "base-sha",
        head_sha: "head-sha",
        status: "failed"
      });
      expect(report.actual_sha).toBeTruthy();
      expect(report.failures.length).toBeGreaterThan(0);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("rejects invalid visual thresholds and measures dimension mismatches against the threshold", () => {
    const fixture = mkdtempSync(join(tmpdir(), "simwar-pr4-visual-validation-"));
    try {
      const baseline = join(fixture, "baseline");
      const candidate = join(fixture, "candidate");
      const diff = join(fixture, "diff");
      mkdirSync(baseline);
      mkdirSync(candidate);
      writePng(join(baseline, "student-ready-390x844.png"), blackPixelPng);
      writePng(join(candidate, "student-ready-390x844.png"), blackPixelPng);
      const actualSha = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8"
      }).trim();

      for (const invalidThreshold of ["NaN", "0", "1", "1.01"]) {
        const output = join(fixture, `manifest-${invalidThreshold}.json`);
        const result = runNodeResult("scripts/assemble-pr4-visual-manifest.mjs", [
          "--baseline",
          baseline,
          "--candidate",
          candidate,
          "--diff-root",
          diff,
          "--output",
          output,
          "--max-diff-pixel-ratio",
          invalidThreshold,
          "--base-sha",
          "base-sha",
          "--head-sha",
          actualSha
        ]);
        expect(result.status, `invalid threshold ${invalidThreshold}`).toBe(1);
      }

      for (const invalidRoleThreshold of ["admin=1", "student=0.06"]) {
        const output = join(
          fixture,
          `manifest-role-${invalidRoleThreshold.replace("=", "-")}.json`
        );
        const result = runNodeResult("scripts/assemble-pr4-visual-manifest.mjs", [
          "--baseline",
          baseline,
          "--candidate",
          candidate,
          "--diff-root",
          diff,
          "--output",
          output,
          "--max-diff-pixel-ratio",
          "0.01",
          "--role-threshold",
          invalidRoleThreshold,
          "--base-sha",
          "base-sha",
          "--head-sha",
          actualSha
        ]);
        expect(result.status, `invalid role threshold ${invalidRoleThreshold}`).toBe(1);
      }

      const { PNG } = playwrightRequire("playwright-core/lib/utilsBundle") as {
        PNG: {
          sync: {
            read: (value: Buffer) => { data: Buffer };
            write: (value: unknown) => Buffer;
          };
        };
      };
      const mismatchedCandidate = join(candidate, "student-ready-390x844.png");
      const mismatchedData = Buffer.alloc(2 * 1 * 4);
      const baselinePixel = PNG.sync.read(Buffer.from(blackPixelPng, "base64")).data.subarray(0, 4);
      baselinePixel.copy(mismatchedData, 0);
      baselinePixel.copy(mismatchedData, 4);
      writeFileSync(
        mismatchedCandidate,
        PNG.sync.write({ width: 2, height: 1, data: mismatchedData })
      );
      const output = join(fixture, "manifest-dimensions.json");
      const result = runNodeResult("scripts/assemble-pr4-visual-manifest.mjs", [
        "--baseline",
        baseline,
        "--candidate",
        candidate,
        "--diff-root",
        diff,
        "--output",
        output,
        "--max-diff-pixel-ratio",
        "0.01",
        "--base-sha",
        "base-sha",
        "--head-sha",
        actualSha
      ]);
      expect(result.status).toBe(1);
      const manifest = JSON.parse(readFileSync(output, "utf8")) as {
        status: string;
        pixel_diff: { failures: string[] };
        surfaces: Array<{
          status: string;
          dimension_mismatch?: boolean;
          dimensions?: { baseline: { width: number }; candidate: { width: number } };
        }>;
      };
      expect(manifest.status).toBe("failed");
      expect(manifest.surfaces[0]).toMatchObject({
        status: "failed",
        dimension_mismatch: true,
        dimensions: { baseline: { width: 1 }, candidate: { width: 2 } },
        diff_pixel_ratio: 0.5
      });
      expect(manifest.pixel_diff.failures.join(" ")).toContain("diff ratio");

      const baselineData = Buffer.alloc(10 * 10 * 4, 0);
      const candidateData = Buffer.from(baselineData);
      for (let pixel = 0; pixel < 6; pixel += 1) {
        candidateData[pixel * 4] = 255;
        candidateData[pixel * 4 + 3] = 255;
      }
      writeFileSync(
        join(baseline, "student-ready-390x844.png"),
        PNG.sync.write({ width: 10, height: 10, data: baselineData })
      );
      writeFileSync(
        mismatchedCandidate,
        PNG.sync.write({ width: 10, height: 10, data: candidateData })
      );

      const withinThresholdOutput = join(fixture, "manifest-student-within-threshold.json");
      const withinThresholdResult = runNodeResult("scripts/assemble-pr4-visual-manifest.mjs", [
        "--baseline",
        baseline,
        "--candidate",
        candidate,
        "--diff-root",
        diff,
        "--output",
        withinThresholdOutput,
        "--max-diff-pixel-ratio",
        "0.01",
        "--role-threshold",
        "student=0.065",
        "--base-sha",
        "base-sha",
        "--head-sha",
        actualSha
      ]);
      expect(withinThresholdResult.status).toBe(0);
      const withinThresholdManifest = JSON.parse(readFileSync(withinThresholdOutput, "utf8")) as {
        status: string;
        threshold: {
          max_diff_pixel_ratio: number;
          role_overrides: Record<string, number>;
        };
        surfaces: Array<{
          status: string;
          applied_threshold: { max_diff_pixel_ratio: number; source: string };
          dimension_mismatch: boolean;
          diff_pixel_ratio: number;
          diff_path: string | null;
        }>;
      };
      expect(withinThresholdManifest).toMatchObject({
        status: "passed",
        threshold: {
          max_diff_pixel_ratio: 0.01,
          role_overrides: { student: 0.065 }
        }
      });
      expect(withinThresholdManifest.surfaces[0]).toMatchObject({
        status: "passed",
        applied_threshold: {
          max_diff_pixel_ratio: 0.065,
          source: "role:student"
        },
        dimension_mismatch: false,
        diff_pixel_ratio: 0.06
      });
      expect(withinThresholdManifest.surfaces[0]?.diff_path).toBeTruthy();
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }, 20_000);

  it("keeps ordinary UI E2E independent from focused PR4 evidence", () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const configSource = readFileSync(resolve(root, "playwright.config.ts"), "utf8");
    const ciSource = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");

    expect(packageJson.scripts["test:e2e:ui"]).toContain("npm run build:test-prerequisites");
    expect(packageJson.scripts["test:e2e:ui"]).toContain("npm run build -w @simwar/ui");
    expect(packageJson.scripts["test:e2e:ui"]).toContain("playwright test");
    expect(packageJson.scripts["test:e2e:ui:core"]).toContain("playwright test");
    expect(packageJson.scripts["test:e2e:ui:pr4"]).toContain("playwright.pr4.config.ts");
    expect(configSource).toContain("testIgnore: /pr4-.*\\.spec\\.ts/");
    expect(configSource).not.toContain("PR4_CONFIG_LAB");
    expect(configSource).not.toContain("pr4EvidenceRoot");
    expect(ciSource).toContain("npm run test:e2e:ui:core");
    expect(ciSource).toContain("npm run test:e2e:ui:pr4");
    expect(ciSource).not.toContain("continue-on-error: true");
    expect(ciSource).toContain('status === "failed"');
    expect(ciSource).toContain('status === "not_ready"');
    expect(ciSource.match(/--role-threshold student=0\.065/g)).toHaveLength(2);
    expect(ciSource).not.toContain("PR4_EVIDENCE_ROOT: ${{ runner.temp }}");
    expect(ciSource).toContain("PR4_EVIDENCE_ROOT: /tmp/simwar-pr4-quality-${{ github.run_id }}");
    expect(ciSource).toContain("PR4_EVIDENCE_ROOT: /tmp/simwar-pr4-browser-${{ github.run_id }}");
    expect(ciSource.match(/path: \$\{\{ env\.PR4_EVIDENCE_ROOT \}\}/g)).toHaveLength(2);
    expect(ciSource.indexOf('mkdir -p "$PR4_EVIDENCE_ROOT"')).toBeGreaterThan(-1);
    expect(ciSource.indexOf('mkdir -p "$PR4_EVIDENCE_ROOT"')).toBeLessThan(
      ciSource.indexOf("Measure PR4 frontend bundle budgets")
    );
    expect(ciSource.indexOf("npm run test:e2e:ui:core")).toBeLessThan(
      ciSource.indexOf("npm run test:e2e:ui:pr4")
    );
    expect(ciSource.indexOf("npm run test:e2e:ui:pr4")).toBeLessThan(
      ciSource.indexOf("Compare PR4 visual candidate against external baseline")
    );
  });

  it("uses WCAG-tag prefixes and deterministic settle/target checks for every focused capture", () => {
    const mainSource = readFileSync(resolve(root, "tests/e2e-ui/pr4-integration.spec.ts"), "utf8");
    const labSource = readFileSync(
      resolve(root, "tests/e2e-ui/pr4-design-system-lab.spec.ts"),
      "utf8"
    );

    expect(mainSource).toContain('tag.toLowerCase().startsWith("wcag")');
    expect(labSource).toContain('tag.toLowerCase().startsWith("wcag")');
    expect(mainSource).toContain("waitForPr4CaptureStable");
    expect(labSource).toContain("waitForPr4CaptureStable");
    expect(mainSource).toContain('a:visible,[role="button"]:visible');
    expect(mainSource).toContain('page.keyboard.press("Tab")');
    expect(labSource).toContain('page.keyboard.press("Enter")');
    expect(mainSource).toContain("fullPage: false");
    expect(labSource).toContain("fullPage: false");
    expect(mainSource).not.toContain("fullPage: true");
    expect(labSource).not.toContain("fullPage: true");
    expect(mainSource).toContain('window.scrollTo({ left: 0, top: 0, behavior: "auto" })');
    expect(labSource).toContain('window.scrollTo({ left: 0, top: 0, behavior: "auto" })');
    expect(mainSource).toContain(
      'await expect(enterprise).toHaveAttribute("aria-current", "page")'
    );
  });

  it("fails focused runtime evidence when browser performance metrics are unsupported", () => {
    const mainSource = readFileSync(resolve(root, "tests/e2e-ui/pr4-integration.spec.ts"), "utf8");
    const labSource = readFileSync(
      resolve(root, "tests/e2e-ui/pr4-design-system-lab.spec.ts"),
      "utf8"
    );

    expect(mainSource).toContain(').toBe("within_budget")');
    expect(mainSource).not.toContain('.not.toBe("over_budget")');
    expect(labSource).toContain("expect(clsObserverStarted).toBe(true)");
    expect(labSource).toContain("return null");
  });

  it("requires focused evidence roots to be absolute and outside the repository", () => {
    const configSource = readFileSync(resolve(root, "playwright.pr4.config.ts"), "utf8");
    expect(configSource).toContain("isAbsolute");
    expect(configSource).toContain("relative(repoRoot");
    expect(configSource).toContain("resolvedEvidenceRoot === repoRoot");
    expect(configSource).toContain("PR4_ALLOW_DIRTY_EVIDENCE");
    expect(configSource).toContain('["status", "--porcelain"]');
  });

  it("rejects relative/in-repository focused roots and lists exactly four tests externally", () => {
    const actualSha = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8"
    }).trim();
    const playwrightCli = resolve(root, "node_modules/playwright/cli.js");
    const storeFile = resolve(
      tmpdir(),
      "simwar-playwright",
      "pr4-unit-config",
      "playwright-store.json"
    );
    const runList = (evidenceRoot: string) =>
      spawnSync(
        process.execPath,
        [playwrightCli, "test", "--config", "playwright.pr4.config.ts", "--list"],
        {
          cwd: root,
          encoding: "utf8",
          env: {
            ...process.env,
            PR4_BASE_SHA: "0000000000000000000000000000000000000000",
            PR4_HEAD_SHA: actualSha,
            PR4_EVIDENCE_ROOT: evidenceRoot,
            SIMWAR_PLAYWRIGHT_STORE_FILE: storeFile,
            PR4_ALLOW_DIRTY_EVIDENCE: "true"
          }
        }
      );

    expect(runList("tmp/pr4-unit-relative").status).not.toBe(0);
    expect(runList(resolve(root, "tmp", "pr4-unit-inrepo")).status).not.toBe(0);
    const external = runList(resolve(tmpdir(), "simwar-pr4-unit-external"));
    expect(external.status).toBe(0);
    expect(external.stdout).toContain("Total: 4 tests in 2 files");
  }, 20_000);

  it("requires bundle budget BASE/HEAD provenance and a matching checked-out HEAD", () => {
    const fixture = mkdtempSync(join(tmpdir(), "simwar-pr4-budget-provenance-guard-"));
    try {
      for (const app of ["admin", "teacher", "student"]) {
        const assetDir = join(fixture, "apps", app, "dist", "assets");
        mkdirSync(assetDir, { recursive: true });
        writeFileSync(join(assetDir, `${app}.js`), "console.log('pr4');\n");
        writeFileSync(join(assetDir, `${app}.css`), ".app{display:block}\n");
      }
      const missingOutput = join(fixture, "missing.json");
      const missing = runNodeResult("scripts/measure-frontend-budgets.mjs", [
        "--dist-root",
        fixture,
        "--output",
        missingOutput
      ]);
      expect(missing.status).toBe(1);
      expect(JSON.parse(readFileSync(missingOutput, "utf8"))).toMatchObject({ status: "failed" });

      const mismatchOutput = join(fixture, "mismatch.json");
      const mismatch = runNodeResult("scripts/measure-frontend-budgets.mjs", [
        "--dist-root",
        fixture,
        "--output",
        mismatchOutput,
        "--base-sha",
        "0000000000000000000000000000000000000000",
        "--head-sha",
        "1111111111111111111111111111111111111111"
      ]);
      expect(mismatch.status).toBe(1);
      const mismatchReport = JSON.parse(readFileSync(mismatchOutput, "utf8")) as {
        status: string;
        failures: string[];
      };
      expect(mismatchReport.status).toBe("failed");
      expect(mismatchReport.failures.join(" ")).toContain("HEAD provenance");
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("fails malformed PNG comparisons rather than treating decode errors as not-ready", () => {
    const fixture = mkdtempSync(join(tmpdir(), "simwar-pr4-visual-malformed-"));
    try {
      const baseline = join(fixture, "baseline");
      const candidate = join(fixture, "candidate");
      mkdirSync(baseline);
      mkdirSync(candidate);
      writePng(join(baseline, "student-ready-390x844.png"), blackPixelPng);
      writeFileSync(join(candidate, "student-ready-390x844.png"), Buffer.from("not-a-png"));
      const output = join(fixture, "manifest.json");
      const actualSha = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8"
      }).trim();
      const result = runNodeResult("scripts/assemble-pr4-visual-manifest.mjs", [
        "--baseline",
        baseline,
        "--candidate",
        candidate,
        "--diff-root",
        join(fixture, "diff"),
        "--output",
        output,
        "--max-diff-pixel-ratio",
        "0.01",
        "--base-sha",
        "0000000000000000000000000000000000000000",
        "--head-sha",
        actualSha
      ]);
      expect(result.status).toBe(1);
      const manifest = JSON.parse(readFileSync(output, "utf8")) as {
        status: string;
        surfaces: Array<{ status: string; failure_reason?: string }>;
      };
      expect(manifest.status).toBe("failed");
      expect(manifest.surfaces[0]).toMatchObject({
        status: "failed",
        failure_reason: "decode_error"
      });
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("rejects invalid bundle budget increase ratios", () => {
    const fixture = mkdtempSync(join(tmpdir(), "simwar-pr4-budget-ratio-"));
    try {
      for (const app of ["admin", "teacher", "student"]) {
        const assetDir = join(fixture, "apps", app, "dist", "assets");
        mkdirSync(assetDir, { recursive: true });
        writeFileSync(join(assetDir, `${app}.js`), "console.log('pr4');\n");
        writeFileSync(join(assetDir, `${app}.css`), ".app{display:block}\n");
      }
      const actualSha = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8"
      }).trim();
      for (const ratio of ["NaN", "-0.1"]) {
        const result = runNodeResult("scripts/measure-frontend-budgets.mjs", [
          "--dist-root",
          fixture,
          "--output",
          join(fixture, `${ratio}.json`),
          "--max-increase",
          ratio,
          "--base-sha",
          "0000000000000000000000000000000000000000",
          "--head-sha",
          actualSha
        ]);
        expect(result.status, ratio).toBe(1);
      }
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});
