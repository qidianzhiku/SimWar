import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packagePath = resolve("packages/ui/package.json");
const labIndexPath = resolve("packages/ui/lab/index.html");
const labMainPath = resolve("packages/ui/lab/main.tsx");
const verifierPath = resolve("scripts/verify-ui-lab-build.mjs");

const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as {
  scripts?: Record<string, string>;
};
const labIndexSource = existsSync(labIndexPath) ? readFileSync(labIndexPath, "utf8") : "";
const labMainSource = existsSync(labMainPath) ? readFileSync(labMainPath, "utf8") : "";

describe("tracked development design-system lab entry", () => {
  it("exposes Vite scripts for a package-local lab on port 3004", () => {
    const devScript = packageJson.scripts?.["dev:lab"] ?? "";
    const buildScript = packageJson.scripts?.["build:lab"] ?? "";

    expect(devScript).toMatch(/\bvite\b/);
    expect(devScript).toMatch(/--port\s+3004/);
    expect(devScript).toMatch(/\blab\b/);
    expect(buildScript).toMatch(/\bvite\b/);
    expect(buildScript).toMatch(/\bbuild\b/);
    expect(buildScript).toMatch(/\.\.\/dist[\\/]lab/);
    expect(buildScript).toMatch(/dist[\\/]lab/);
    expect(buildScript).not.toMatch(/dist-lab/);
    expect(buildScript).toMatch(/--base\s+\.\//);
    expect(buildScript).toMatch(/\blab\b/);
  });

  it("registers a post-build verifier for the local lab artifact", () => {
    const verifyScript = packageJson.scripts?.["verify:lab"] ?? "";
    const buildScript = packageJson.scripts?.["build:lab"] ?? "";

    expect(existsSync(verifierPath)).toBe(true);
    expect(verifyScript).toMatch(/node .*scripts[\\/]verify-ui-lab-build\.mjs/);
    expect(buildScript).toContain("npm run verify:lab");
  });

  it("provides a Chinese local HTML shell and a real StrictMode React entry", () => {
    expect(existsSync(labIndexPath)).toBe(true);
    expect(existsSync(labMainPath)).toBe(true);
    expect(labIndexSource).toContain('<html lang="zh-CN">');
    expect(labIndexSource).toMatch(/<title>[^<]*设计系统实验室[^<]*<\/title>/);
    expect(labIndexSource).toContain('<script type="module" src="./main.tsx"></script>');
    expect(labMainSource).toContain('from "../src/index"');
    expect(labMainSource).toContain('import "../src/styles.css"');
    expect(labMainSource).toContain("DesignSystemLab");
    expect(labMainSource).toContain("<StrictMode>");
    expect(labMainSource).toContain("createRoot");
    expect(labMainSource).toContain('getElementById("root")');
    expect(labMainSource).toContain("<DesignSystemLab />");
  });

  it("keeps the development entry presentation-only without network, store, or environment behavior", () => {
    expect(labMainSource).not.toMatch(
      /fetch\s*\(|axios|XMLHttpRequest|localStorage|sessionStorage|indexedDB|\/api\/|https?:\/\//i
    );
    expect(labMainSource).not.toMatch(
      /process\.env|import\.meta\.env|setTimeout|setInterval|Math\.random|persist/i
    );
  });
});
