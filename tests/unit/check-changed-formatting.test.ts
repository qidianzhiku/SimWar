import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isPrettierCandidate, parseArgs } from "../../scripts/check-changed-formatting.mjs";

const root = resolve(".");

describe("A3 CI quality gates and changed-file formatting guard", () => {
  it("filters Prettier candidates accurately and excludes lockfiles/build outputs", () => {
    expect(isPrettierCandidate("apps/student/src/App.tsx")).toBe(true);
    expect(isPrettierCandidate(".github/workflows/ci.yml")).toBe(true);
    expect(isPrettierCandidate("scripts/check-changed-formatting.mjs")).toBe(true);
    expect(isPrettierCandidate("package-lock.json")).toBe(false);
    expect(isPrettierCandidate("apps/student/dist/index.js")).toBe(false);
    expect(isPrettierCandidate("node_modules/pkg/index.js")).toBe(false);
    expect(isPrettierCandidate("docs/image.png")).toBe(false);
  });

  it("parses explicit --base-sha and --head-sha CLI arguments", () => {
    expect(parseArgs(["--base-sha", "abc123", "--head-sha", "def456"])).toEqual({
      baseSha: "abc123",
      headSha: "def456"
    });
  });

  it("wires format:check:changed, security:audit, and UI lab build into CI quality job", () => {
    const ciYaml = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts["format:check:changed"]).toBe("node scripts/check-changed-formatting.mjs");
    expect(ciYaml).toContain("npm run format:check:changed");
    expect(ciYaml).toContain("npm run security:audit");
    expect(ciYaml).toContain("npm run build:lab -w @simwar/ui");
  });

  it("declares complete TypeScript project references for UI and sh-next-support consumers", () => {
    const readRefs = (relPath: string) => {
      const cfg = JSON.parse(readFileSync(resolve(root, relPath), "utf8")) as {
        references?: Array<{ path: string }>;
      };
      return (cfg.references ?? []).map((ref) => ref.path);
    };

    expect(readRefs("apps/admin/tsconfig.json")).toContain("../../packages/shared-contracts");
    expect(readRefs("apps/admin/tsconfig.json")).toContain("../../packages/ui");
    expect(readRefs("apps/teacher/tsconfig.json")).toContain("../../packages/ui");
    expect(readRefs("apps/student/tsconfig.json")).toContain("../../packages/ui");
    expect(readRefs("services/api/tsconfig.json")).toContain("../../packages/sh-next-support");
  });
});
