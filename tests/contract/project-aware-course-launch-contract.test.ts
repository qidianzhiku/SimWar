import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PROJECT_AWARE_LAUNCH_SCHEMA_VERSION,
  PROJECT_AWARE_READINESS_STATES,
  PROJECT_AWARE_STUDENT_FORBIDDEN_FIELDS,
  isProjectAwareLaunchReceipt
} from "../../packages/shared-contracts/src/project-aware-course-launch";

describe("Project-aware launch contract", () => {
  it("freezes explicit readiness states and schema version", () => {
    expect(PROJECT_AWARE_LAUNCH_SCHEMA_VERSION).toBe("project-aware-launch.v1");
    expect(PROJECT_AWARE_READINESS_STATES).toEqual([
      "BLOCKED",
      "STALE",
      "DEGRADED",
      "READY",
      "UNKNOWN_VERIFYING"
    ]);
  });

  it("publishes a closed Draft 2020-12 receipt schema and fixture", () => {
    const schema = JSON.parse(
      readFileSync("contracts/schemas/project-aware-launch.v1.json", "utf8")
    ) as Record<string, unknown>;
    const fixture = JSON.parse(
      readFileSync("contracts/fixtures/project-aware-launch-receipt.valid.json", "utf8")
    ) as Record<string, unknown>;
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema.additionalProperties).toBe(false);
    expect(fixture.schema_version).toBe("project-aware-launch.v1");
    expect(fixture.readiness_state).toBe("READY");
  });

  it("rejects a receipt that leaks forbidden student or settlement fields", () => {
    expect(PROJECT_AWARE_STUDENT_FORBIDDEN_FIELDS).toEqual(
      expect.arrayContaining(["state_true", "score", "rank", "other_team_data"])
    );
    expect(
      isProjectAwareLaunchReceipt({
        schema_version: "project-aware-launch.v1",
        command_idempotency_key: "launch-1",
        status: "ACCEPTED",
        tenant_id: "tenant_demo",
        course_id: "course_demo",
        run_id: "run_formal",
        team_ids: ["team_alpha"],
        readiness_state: "READY",
        audit_id: "audit-1",
        created_at: "2026-08-21T00:00:00.000Z",
        state_true: { cash: 1 }
      })
    ).toBe(false);
  });

  it("declares every project-aware BFF route in the public OpenAPI contract", () => {
    const openapi = readFileSync("contracts/openapi/p0-api.openapi.yaml", "utf8");
    for (const path of [
      "/api/v1/bff/teacher/courses/{courseId}/project-aware-readiness",
      "/api/v1/bff/teacher/courses/{courseId}/project-aware-launch",
      "/api/v1/bff/teacher/courses/{courseId}/project-aware-launch-receipt",
      "/api/v1/bff/student/project-aware-context",
      "/api/v1/bff/admin/project-aware-audit"
    ]) {
      expect(openapi).toContain(`  ${path}:`);
    }
    expect(openapi).toContain("ROUND_NOT_OPEN");
    expect(openapi).toContain("ProjectAwareLaunchReceiptEnvelope");
    expect(openapi).toContain("StudentDecisionContextEvidence");
    expect(openapi).toContain("decision_context_evidence");
  });

  it("declares the full evidence-bound blocker contract", () => {
    const openapi = readFileSync("contracts/openapi/p0-api.openapi.yaml", "utf8");
    for (const field of [
      "blocker_id",
      "category",
      "reason",
      "impact",
      "source_authority",
      "recovery_action",
      "freshness",
      "evidence_ref",
      "waiver_policy"
    ]) {
      expect(openapi).toContain(`        ${field}:`);
    }
    expect(openapi).toContain("ProjectAssignment");
    expect(openapi).toContain("FRESH_SNAPSHOT");
  });
});
