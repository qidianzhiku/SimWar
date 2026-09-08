import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import {
  EVIDENCE_ADOPTION_SCOPE,
  EVIDENCE_ADOPTION_STUDENT,
  EVIDENCE_ADOPTION_TEACHER,
  createEvidenceAdoptionServiceFixture
} from "../helpers/model-qualification-evidence-adoption-fixtures";

const schema = JSON.parse(
  readFileSync(resolve("contracts/schemas/industry-model-diagnostic.v1.json"), "utf8")
);
const openapi = yaml.load(readFileSync("contracts/openapi/p0-api.openapi.yaml", "utf8")) as {
  paths: Record<string, { get?: { operationId?: string; responses?: Record<string, unknown> } }>;
};

const exactContext = {
  run_id: "run-im-o1",
  team_id: "team-im-o1",
  round_id: "round-im-o1",
  scenario_package_id: "scenario-im-o1",
  parameter_set_id: "params-im-o1"
};

describe("IM-O1 Industry Model diagnostic readiness contract", () => {
  it("publishes exact-context role routes and a compilable role-safe schema", () => {
    for (const role of ["teacher", "admin", "student"]) {
      const operation =
        openapi.paths[`/api/v1/bff/${role}/model-qualification/diagnostic-readiness`]?.get;
      expect(operation?.operationId).toBe(`INDUSTRY_MODEL_DIAGNOSTIC_${role.toUpperCase()}_GET_V1`);
      expect(operation?.responses?.["200"]).toBeDefined();
      expect(operation?.responses?.["403"]).toBeDefined();
    }
    expect(schema.$id).toContain("industry-model-diagnostic.v1.json");
    expect(() => new Ajv2020({ allErrors: true, strict: false }).compile(schema)).not.toThrow();
  });

  it("rejects privileged fields from the Student schema", () => {
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
    const fixture = createEvidenceAdoptionServiceFixture();
    const student = fixture.service.getIndustryModelDiagnosticReadiness(
      EVIDENCE_ADOPTION_STUDENT,
      EVIDENCE_ADOPTION_SCOPE,
      { ...exactContext, qualification_id: fixture.primary.qualificationA.qualification_id }
    );
    expect(validate({ ...student, qualification: { qualification_id: "private" } })).toBe(false);
    expect(validate({ ...student, provability: [] })).toBe(false);
  });

  it("publishes diagnostic freshness parameters for all role routes", () => {
    for (const role of ["teacher", "admin", "student"]) {
      const parameters = openapi.paths[
        `/api/v1/bff/${role}/model-qualification/diagnostic-readiness`
      ]?.get?.parameters as Array<{ name?: string; in?: string; required?: boolean }> | undefined;
      expect(parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "expectedDiagnosticEvidenceDigest",
            in: "query",
            required: false
          }),
          expect.objectContaining({
            name: "expectedInterpretationPolicyDigest",
            in: "query",
            required: false
          })
        ])
      );
    }
  });

  it("derives blocked NOT_PROVEN readiness from current producer evidence without inventing WANT/CAN", () => {
    const fixture = createEvidenceAdoptionServiceFixture();
    const input = {
      ...exactContext,
      qualification_id: fixture.primary.qualificationA.qualification_id
    };
    const teacher = fixture.service.getIndustryModelDiagnosticReadiness(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE,
      input
    );
    expect(teacher.readiness_status).toBe("BLOCKED");
    expect(teacher.exact_context).toEqual({
      tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id,
      course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
      ...exactContext
    });
    expect(teacher.provability).toHaveLength(1);
    expect(teacher.provability?.[0]).toMatchObject({
      classification: "NOT_PROVEN",
      authority_owner: "SIMWAR-MODEL-QUALIFICATION-PLANE",
      evidence_identity: teacher.diagnostic_evidence_digest
    });
    expect(teacher.diagnostic_evidence_digest).not.toBe(
      teacher.qualification?.qualification_digest
    );
    expect(teacher.known_limits).toContain("DIAGNOSTIC_PASS_IS_NOT_BUSINESS_TRUTH");
    expect(teacher).not.toHaveProperty("official_realized");
  });

  it("returns REBASE_REQUIRED when the exact diagnostic identity moves", () => {
    const fixture = createEvidenceAdoptionServiceFixture();
    const readiness = fixture.service.getIndustryModelDiagnosticReadiness(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE,
      {
        ...exactContext,
        qualification_id: fixture.primary.qualificationA.qualification_id,
        expected_diagnostic_evidence_digest: "f".repeat(64)
      }
    );
    expect(readiness.readiness_status).toBe("REBASE_REQUIRED");
    expect(readiness.rebase_required).toBe(true);
    expect(readiness.known_limits).toContain("EXACT_IDENTITY_MOVED_REQUIRES_REBASE");
  });

  it("keeps Student projection aggregate-safe while Teacher retains provenance", () => {
    const fixture = createEvidenceAdoptionServiceFixture();
    const input = {
      ...exactContext,
      qualification_id: fixture.primary.qualificationA.qualification_id
    };
    const student = fixture.service.getIndustryModelDiagnosticReadiness(
      EVIDENCE_ADOPTION_STUDENT,
      EVIDENCE_ADOPTION_SCOPE,
      input
    );
    const serialized = JSON.stringify(student);
    expect(student.role).toBe("student");
    expect(student.student_summary).toMatchObject({ visibility: "ROLE_SAFE_STUDENT" });
    expect(student).not.toHaveProperty("model_version_reference");
    expect(student).not.toHaveProperty("model_artifact_reference");
    expect(student).not.toHaveProperty("qualification");
    expect(student).not.toHaveProperty("adoption");
    expect(student).not.toHaveProperty("diagnostic_evidence_digest");
    expect(student).not.toHaveProperty("interpretation_policy_digest");
    expect(student).not.toHaveProperty("provability");
    expect(serialized).not.toContain("model-qualification-diagnostics");
  });

  it("accepts the Student-safe qualified producer admission status array", () => {
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
    const fixture = createEvidenceAdoptionServiceFixture();
    const student = fixture.service.getIndustryModelDiagnosticReadiness(
      EVIDENCE_ADOPTION_STUDENT,
      EVIDENCE_ADOPTION_SCOPE,
      { ...exactContext, qualification_id: fixture.primary.qualificationA.qualification_id }
    );
    expect(student.student_summary?.qualified_producer_admission_statuses).toEqual([
      "QUALIFICATION_NOT_PROVEN"
    ]);
    expect(validate(student), JSON.stringify(validate.errors)).toBe(true);
  });
});
