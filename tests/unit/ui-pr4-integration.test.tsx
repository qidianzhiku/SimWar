/** @vitest-environment jsdom */

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
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
      actual_sha: string;
      branch: string;
      clean: boolean;
    };

    expect(report.expected_sha).toBe(actualSha);
    expect(report.actual_sha).toBe(actualSha);
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

      const report = JSON.parse(
        runNode("scripts/measure-frontend-budgets.mjs", ["--dist-root", fixture])
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

  it("assembles an explicit visual manifest without pretending to run pixel diff", () => {
    const fixture = mkdtempSync(join(tmpdir(), "simwar-pr4-visual-"));
    try {
      const baseline = join(fixture, "baseline");
      const candidate = join(fixture, "candidate");
      mkdirSync(baseline);
      mkdirSync(candidate);
      writeFileSync(join(baseline, "student-role-mission.png"), "baseline");
      writeFileSync(join(candidate, "student-role-mission.png"), "candidate");

      const output = join(fixture, "manifest.json");
      const actualSha = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8"
      }).trim();
      runNode("scripts/assemble-pr4-visual-manifest.mjs", [
        "--baseline",
        baseline,
        "--candidate",
        candidate,
        "--output",
        output,
        "--threshold",
        "0.01",
        "--expected-sha",
        actualSha,
        "--state",
        "ready"
      ]);
      const manifest = JSON.parse(readFileSync(output, "utf8")) as {
        threshold: { max_diff_ratio: number };
        status: string;
        ready_for_review: boolean;
        pixel_diff: { status: string };
        head: { expected_sha: string; actual_sha: string };
        surfaces: Array<{
          baseline_sha256: string;
          candidate_sha256: string;
          base_sha: string;
          role: string | null;
          viewport: number | null;
          state: string;
        }>;
      };

      expect(manifest.threshold.max_diff_ratio).toBe(0.01);
      expect(manifest.status).toBe("not_ready");
      expect(manifest.ready_for_review).toBe(false);
      expect(manifest.pixel_diff.status).toBe("not_run");
      expect(manifest.surfaces).toHaveLength(1);
      expect(manifest.head).toMatchObject({ expected_sha: actualSha, actual_sha: actualSha });
      expect(manifest.surfaces[0]).toMatchObject({
        base_sha: actualSha,
        role: "student",
        viewport: null,
        state: "ready"
      });
      expect(manifest.surfaces[0]?.baseline_sha256).not.toBe(
        manifest.surfaces[0]?.candidate_sha256
      );
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});
