import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const openapi = yaml.load(readFileSync("contracts/openapi/p0-api.openapi.yaml", "utf8")) as {
  paths: Record<string, Record<string, unknown>>;
};

describe("O9 model qualification course portfolio contract", () => {
  it("publishes only the tenant-admin portfolio and explicit supersession preview routes", () => {
    expect(
      openapi.paths["/api/v1/bff/admin/model-qualification/course-portfolio"]?.get
    ).toBeDefined();
    expect(
      openapi.paths["/api/v1/bff/admin/model-qualification/course-portfolio/supersession-preview"]
        ?.post
    ).toBeDefined();
    expect(
      openapi.paths["/api/v1/bff/student/model-qualification/course-portfolio"]
    ).toBeUndefined();
  });

  it("compiles the versioned derived/query-only schema", () => {
    const schema = JSON.parse(
      readFileSync("contracts/schemas/model-qualification-course-portfolio.v1.json", "utf8")
    );
    expect(() => new Ajv2020({ allErrors: true, strict: false }).compile(schema)).not.toThrow();
    expect(schema.$defs.portfolio.properties.derived.const).toBe(true);
    expect(schema.$defs.portfolio.properties.query_only.const).toBe(true);
    expect(schema.$defs.portfolio.properties.provider.const).toBe("OFF");
    expect(schema.$defs.supersessionPreview.properties.preview_applied.const).toBe(false);
  });

  it("documents Course Authority membership and stale-digest rebase semantics", () => {
    const document = readFileSync("docs/contracts/model-qualification-course-portfolio.md", "utf8");
    expect(document).toContain("Course Authority");
    expect(document).toContain("REBASE_REQUIRED");
    expect(document).toContain("query-only");
    expect(document).toContain("Student has no tenant portfolio");
  });
});
