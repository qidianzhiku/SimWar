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
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
    expect(schema.$defs.portfolio.properties.derived.const).toBe(true);
    expect(schema.$defs.portfolio.properties.query_only.const).toBe(true);
    expect(schema.$defs.portfolio.properties.provider.const).toBe("OFF");
    expect(schema.$defs.supersessionPreview.properties.preview_applied.const).toBe(false);

    expect(
      validate({
        adoption_mutation: false,
        blockers: [],
        courses: [
          {
            adoption_state_digest: null,
            blockers: [],
            course: { course_id: "course-1", tenant_id: "tenant-1", title: "Course" },
            current_adoption: null,
            current_adoption_candidates: [],
            current_adoption_epoch: null,
            known_limits: ["bounded"],
            o8_outcomes: [],
            qualification: null,
            qualification_candidates: [
              { content_digest: "a".repeat(64), qualification_id: "qualification-1" }
            ],
            qualification_consistency: "BLOCKED",
            writer_effect: "NONE"
          }
        ],
        derived: true,
        formal_truth_write: false,
        history_deleted: false,
        known_limits: ["bounded"],
        no_new_registry: true,
        no_new_store: true,
        no_new_writer: true,
        official_truth_write: false,
        portfolio_state_digest: "b".repeat(64),
        portfolio_status: "BLOCKED",
        provider: "OFF",
        query_only: true,
        rank_write: false,
        rollback_applied: false,
        schema_version: "model-qualification-course-portfolio.v1",
        score_write: false,
        settlement_write: false,
        tenant_id: "tenant-1",
        writes_formal_truth: false,
        writer_effect: "NONE"
      })
    ).toBe(true);
  });

  it("documents Course Authority membership and stale-digest rebase semantics", () => {
    const document = readFileSync("docs/contracts/model-qualification-course-portfolio.md", "utf8");
    expect(document).toContain("Course Authority");
    expect(document).toContain("REBASE_REQUIRED");
    expect(document).toContain("query-only");
    expect(document).toContain("Student has no tenant portfolio");
  });
});

describe("SP-O2 strategic portfolio model governance readiness contract", () => {
  it("publishes one tenant-admin derived readiness join route", () => {
    expect(
      openapi.paths["/api/v1/bff/admin/model-qualification/strategic-portfolio-readiness"]?.get
    ).toBeDefined();
    expect(
      openapi.paths["/api/v1/bff/student/model-qualification/strategic-portfolio-readiness"]
    ).toBeUndefined();
  });

  it("validates exact scope, digest, and no-mutation projection flags", () => {
    const schema = JSON.parse(
      readFileSync(
        "contracts/schemas/strategic-portfolio-model-governance-readiness.v1.json",
        "utf8"
      )
    );
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    ajv.addSchema(schema);
    const validate = ajv.getSchema(`${schema.$id}#/$defs/adminProjection`);
    expect(validate).toBeDefined();
    expect(
      validate!({
        role: "admin",
        visibility: "TENANT_GOVERNANCE_DETAIL",
        tenant_id: "tenant-1",
        readiness_policy_digest: "a".repeat(64),
        portfolio_state_digest: "b".repeat(64),
        readiness_digest: "c".repeat(64),
        readiness_status: "READY",
        entries: [
          {
            course: { course_id: "course-1", tenant_id: "tenant-1", title: "Course" },
            exact_scope: {
              tenant_id: "tenant-1",
              course_id: "course-1",
              run_id: "run-1",
              team_id: "team-1",
              round_no: 1
            },
            portfolio_id: "w4-portfolio-1",
            portfolio_digest: "d".repeat(64),
            model_qualification_portfolio_state_digest: "b".repeat(64),
            adoption_state_digest: null,
            current_adoption: null,
            qualification: null,
            blockers: [],
            known_limits: ["derived"],
            readiness: "NO_QUALIFIED_MODEL",
            readiness_digest: "e".repeat(64)
          }
        ],
        known_limits: ["query-only"],
        derived: true,
        query_only: true,
        no_new_writer: true,
        no_new_store: true,
        no_new_registry: true,
        provider: "OFF",
        writer_effect: "NONE"
      })
    ).toBe(true);
  });
});
