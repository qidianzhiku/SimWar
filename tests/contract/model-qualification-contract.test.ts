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

  it("accepts the requalification queue while keeping the student projection role-safe", () => {
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
    let now = "2026-08-30T12:00:00.000Z";
    const governed = new ModelQualificationService({ now: () => now });
    const baseline = governed.registerSourcePackage(actor, scope, {
      content_digest: "a".repeat(64),
      evidence_refs: ["fixture:baseline"],
      expires_at: "2026-12-31T00:00:00.000Z",
      feature_schema_digest: "b".repeat(64),
      freshness_status: "FRESH",
      observed_at: "2026-08-30T00:00:00.000Z",
      quality: { conflict_count: 0, missingness_rate: 0, record_count: 4 },
      rights_status: "VALID",
      source_ref: "fixture://baseline",
      source_version: "1.0.0",
      title: "Baseline"
    }).source_package;
    const candidate = governed.registerSourcePackage(actor, scope, {
      content_digest: "c".repeat(64),
      evidence_refs: ["fixture:candidate"],
      expires_at: "2027-01-31T00:00:00.000Z",
      feature_schema_digest: "b".repeat(64),
      freshness_status: "FRESH",
      observed_at: "2026-09-01T00:00:00.000Z",
      quality: { conflict_count: 0, missingness_rate: 0, record_count: 4 },
      rights_status: "VALID",
      source_ref: "fixture://candidate",
      source_version: "2.0.0",
      title: "Candidate"
    }).source_package;
    const preview = governed.createRequalificationPreview(actor, scope, {
      baseline_source_package_id: baseline.source_package_id,
      candidate_source_package_id: candidate.source_package_id
    }).preview;
    const teacher = governed.getTeacherProjection(actor, scope);
    expect(validate(teacher), JSON.stringify(validate.errors)).toBe(true);
    expect(teacher.requalification_previews).toContainEqual(preview);

    const dataset = governed.createCalibrationDataset(actor, scope, {
      calibration_record_ids: ["candidate-calibration"],
      content_digest: "d".repeat(64),
      holdout_record_ids: ["candidate-holdout"],
      source_package_id: candidate.source_package_id
    }).calibration_dataset;
    const qualification = governed.runQualification(actor, scope, {
      calibration_dataset_id: dataset.calibration_dataset_id,
      deterministic_seed: 7,
      model_version_reference: MODEL_QUALIFICATION_MODEL_VERSION.model_version_reference,
      source_package_id: candidate.source_package_id
    }).qualification;
    governed.reviewQualification(actor, scope, qualification.qualification_id, {
      decision: "APPROVED",
      note: "Candidate qualification reviewed."
    });
    now = "2026-08-30T12:01:00.000Z";
    governed.reviewRequalificationPreview(actor, scope, preview.preview_id, {
      decision: "APPROVED",
      note: "Replacement evidence reviewed."
    });
    const bound = governed.bindQualification(
      actor,
      scope,
      qualification.qualification_id
    ).qualification;
    const student = governed.getStudentProjection(
      { actor_id: "usr_student", role: "student", tenant_id: "tenant_demo" },
      scope,
      bound.qualification_id
    );
    expect(validate(student), JSON.stringify(validate.errors)).toBe(true);
    expect(JSON.stringify(student)).not.toContain("source_package_id");
    expect(JSON.stringify(student)).not.toContain("content_digest");
  });
});
