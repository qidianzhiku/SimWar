import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import {
  INDUSTRY_MODEL_REALITY_JOIN_SCHEMA_VERSION,
  type IndustryModelRealityJoinDto
} from "../../packages/shared-contracts/src/industry-model-reality-join";

const schema = JSON.parse(
  readFileSync(resolve("contracts/schemas/industry-model-reality-join.v1.json"), "utf8")
);
const teacherFixture: IndustryModelRealityJoinDto = {
  schema_version: INDUSTRY_MODEL_REALITY_JOIN_SCHEMA_VERSION,
  operation_id: "INDUSTRY_MODEL_REALITY_JOIN_TEACHER_GET_V1",
  role: "teacher",
  readiness_status: "READY_WITH_LIMITS",
  rebase_required: false,
  exact_context: {
    tenant_id: "tenant-1",
    course_id: "course-1",
    run_id: "run-1",
    team_id: "team-1",
    round_id: "round-1",
    scenario_package_id: "scenario-1",
    parameter_set_id: "params-1"
  },
  model_version_reference: {
    model_version_id: "model-1",
    version: "1.0.0",
    content_digest: "a".repeat(64)
  },
  model_artifact_reference: {
    artifact_id: "artifact-1",
    content_digest: "b".repeat(64),
    format: "json",
    source_ref: "fixture"
  },
  qualification: {
    qualification_id: "qualification-1",
    qualification_digest: "c".repeat(64),
    decision: "APPROVED",
    review_status: "APPROVED",
    binding_status: "BOUND"
  },
  adoption: { adoption_id: "adoption-1", adoption_digest: "d".repeat(64) },
  diagnostic_evidence_digest: "e".repeat(64),
  interpretation_policy_digest: "f".repeat(64),
  provability: [
    {
      producer_id: "industry-model-diagnostics",
      diagnostic_family: "diagnostics",
      classification: "NOT_PROVEN",
      evidence_identity: "e".repeat(64),
      authority_owner: "SIMWAR-MODEL-QUALIFICATION-PLANE",
      source: { path: "source.ts", symbol: "producer" },
      freshness: "FRESH"
    }
  ],
  support_evidence: {
    availability: "BOUND",
    applicability_digest: "a".repeat(64),
    upstream_pack_digests: {
      m4: "b".repeat(64),
      m5: "c".repeat(64),
      m29: "d".repeat(64)
    },
    portability: {
      status: "PORTABILITY_EVIDENCE_WITH_LIMITS",
      compatibility_status: "NON_BREAKING",
      external_validity: "NOT_PROVEN",
      package_identity: "m4-package"
    },
    holdout: { status: "NOT_ELIGIBLE", leakage_count: 0, eligibility: "NOT_ELIGIBLE" },
    shanghai: {
      consumption_status: "LOOKAHEAD_READY",
      qualification_status: "LIMITED",
      calibration_evidence: "NOT_PROVEN",
      formal_binding_eligible: false
    }
  },
  known_limits: ["PORTABILITY_IS_NOT_EXTERNAL_VALIDITY"],
  provider: "OFF",
  official_truth_write: false,
  readiness_digest: "1".repeat(64)
};

describe("IM-O2 Industry Model Reality Join contract", () => {
  it("publishes exact role routes and a compilable schema", () => {
    expect(schema.$id).toContain("industry-model-reality-join.v1.json");
    expect(schema.title).toContain("Reality Join");
    expect(() => new Ajv2020({ allErrors: true, strict: false }).compile(schema)).not.toThrow();
  });

  it("preserves support evidence limits and accepts the teacher projection", () => {
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
    expect(validate(teacherFixture)).toBe(true);
    expect(teacherFixture.support_evidence.portability.external_validity).toBe("NOT_PROVEN");
    expect(teacherFixture.support_evidence.holdout.status).toBe("NOT_ELIGIBLE");
    expect(teacherFixture.support_evidence.shanghai.formal_binding_eligible).toBe(false);
  });

  it("rejects privileged O2 fields from the student projection", () => {
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
    const student = {
      schema_version: INDUSTRY_MODEL_REALITY_JOIN_SCHEMA_VERSION,
      operation_id: "INDUSTRY_MODEL_REALITY_JOIN_STUDENT_GET_V1",
      role: "student",
      readiness_status: "READY_WITH_LIMITS",
      rebase_required: false,
      exact_context: {
        course_id: "course-1",
        run_id: "run-1",
        team_id: "team-1",
        round_id: "round-1"
      },
      readiness_class: "READY_WITH_LIMITS",
      evidence_classes: ["NOT_PROVEN"],
      portability_status: "UNAVAILABLE",
      holdout_status: "UNAVAILABLE",
      shanghai_status: "UNAVAILABLE",
      known_limits: ["BOUNDED"],
      recovery: "RELOAD_EXACT_CONTEXT",
      provider: "OFF",
      official_truth_write: false,
      readiness_digest: "1".repeat(64)
    } as Record<string, unknown>;
    expect(validate(student)).toBe(true);
    expect(validate({ ...student, adoption_id: "private" })).toBe(false);
    expect(validate({ ...student, diagnostic_evidence_digest: "private" })).toBe(false);
  });
});
