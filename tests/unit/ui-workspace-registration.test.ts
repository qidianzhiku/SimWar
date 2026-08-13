import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packagePath = resolve("package.json");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as {
  workspaces?: string[];
  scripts?: Record<string, string>;
};

describe("root UI workspace registration", () => {
  it("delegates to the tracked UI lab development command", () => {
    const devUiLab = packageJson.scripts?.["dev:ui-lab"] ?? "";

    expect(devUiLab).toMatch(/npm run dev:lab -w @simwar\/ui/);
  });

  it("builds the UI package before the frontend applications", () => {
    const build = packageJson.scripts?.build ?? "";
    const uiBuild = "npm run build -w @simwar/ui";
    const frontendBuilds = [
      "npm run build -w @simwar/admin",
      "npm run build -w @simwar/teacher",
      "npm run build -w @simwar/student"
    ];

    expect(build).toContain(uiBuild);
    const uiIndex = build.indexOf(uiBuild);
    for (const frontendBuild of frontendBuilds) {
      expect(uiIndex).toBeGreaterThanOrEqual(0);
      expect(build.indexOf(frontendBuild)).toBeGreaterThan(uiIndex);
    }
  });

  it("keeps UI out of API-only build prerequisites and preserves workspace globs", () => {
    const prerequisites = packageJson.scripts?.["build:test-prerequisites"] ?? "";

    expect(prerequisites).not.toContain("@simwar/ui");
    expect(packageJson.workspaces).toEqual(["apps/*", "services/*", "packages/*"]);
  });

  it("builds the UI package before collecting the root test suite", () => {
    const test = packageJson.scripts?.test ?? "";
    const uiBuild = "npm run build -w @simwar/ui";

    expect(test).toContain("npm run build:test-prerequisites");
    expect(test).toContain(uiBuild);
    expect(test.indexOf(uiBuild)).toBeGreaterThan(test.indexOf("build:test-prerequisites"));
    expect(test).toContain("vitest run");
  });
});
