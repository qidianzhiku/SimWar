import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import {
  MODEL_QUALIFICATION_MODEL_VERSION,
  ModelQualificationService
} from "../../services/api/src/model-qualification-service";

const schema = JSON.parse(
  readFileSync(resolve("contracts/schemas/model-qualification.v1.json"), "utf8")
);

const actor = { actor_id: "usr_teacher", role: "teacher" as const, tenant_id: "tenant_demo" };
const scope = {
  activity_id: "model-qualification-studio",
  course_id: "course_demo",
  tenant_id: "tenant_demo"
};

describe("source-backed model qualification contract", () => {
  it("accepts the teacher and admin projections while preserving the sole-writer boundary", () => {
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
    const service = new ModelQualificationService({ now: () => "2026-08-30T12:00:00.000Z" });
    const teacher = service.getTeacherProjection(actor, scope);
    const admin = service.getAdminProjection(
      { actor_id: "usr_admin", role: "tenant_admin", tenant_id: "tenant_demo" },
      scope
    );

    expect(validate(teacher), JSON.stringify(validate.errors)).toBe(true);
    expect(validate(admin), JSON.stringify(validate.errors)).toBe(true);
    expect(admin.authority).toMatchObject({
      ai_provider: "OFF",
      formal_truth_writer: "SIMULATION_CORE",
      model_governance_writer: "MAIN_MODEL_GOVERNANCE",
      writes_formal_truth: false
    });
    expect(MODEL_QUALIFICATION_MODEL_VERSION.model_version_reference.version).toBe("2.0.0");
    expect(JSON.stringify(teacher)).not.toContain("latest");
  });

  it("accepts the checked-in valid fixture and rejects a student private-field fixture", () => {
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
    const valid = JSON.parse(
      readFileSync(resolve("contracts/fixtures/model-qualification.valid.json"), "utf8")
    );
    const invalid = JSON.parse(
      readFileSync(
        resolve("contracts/fixtures/model-qualification.student-private.invalid.json"),
        "utf8"
      )
    );
    expect(validate(valid), JSON.stringify(validate.errors)).toBe(true);
    expect(valid.calibration_datasets[0].zero_holdout_leakage).toBe(false);
    expect(validate(invalid)).toBe(false);
  });
});
