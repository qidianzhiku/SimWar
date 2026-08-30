import { describe, expect, it } from "vitest";
import {
  MODEL_QUALIFICATION_MODEL_VERSION,
  ModelQualificationError,
  ModelQualificationService,
  type ModelQualificationActor
} from "../../services/api/src/model-qualification-service";

const teacher: ModelQualificationActor = {
  actor_id: "usr_teacher",
  role: "teacher",
  tenant_id: "tenant_demo"
};

const scope = {
  activity_id: "model-qualification-studio",
  course_id: "course_demo",
  tenant_id: "tenant_demo"
};

const sourceInput = {
  title: "Public demand reference",
  source_ref: "https://example.test/demand.csv",
  source_version: "2026.08",
  content_digest: "a".repeat(64),
  feature_schema_digest: "b".repeat(64),
  rights_status: "VALID" as const,
  freshness_status: "FRESH" as const,
  observed_at: "2026-08-30T00:00:00.000Z",
  expires_at: "2026-12-31T00:00:00.000Z",
  quality: { record_count: 6, missingness_rate: 0, conflict_count: 0 },
  evidence_refs: ["source-license", "source-provenance"]
};

const diagnostics = {
  baseline_error: 0.08,
  differential_error: 0.04,
  drift_score: 0.08,
  ood_rate: 0.02,
  sensitivity_max_delta: 0.1,
  convergence_status: "CONVERGED" as const
};

function service() {
  return new ModelQualificationService({ now: () => "2026-08-30T01:40:00.000Z" });
}

function readyQualification() {
  const governed = service();
  const source = governed.registerSourcePackage(teacher, scope, sourceInput).source_package;
  const dataset = governed.createCalibrationDataset(teacher, scope, {
    source_package_id: source.source_package_id,
    content_digest: "c".repeat(64),
    calibration_record_ids: ["r1", "r2", "r3", "r4"],
    holdout_record_ids: ["r5", "r6"]
  }).calibration_dataset;
  const qualification = governed.runQualification(teacher, scope, {
    source_package_id: source.source_package_id,
    calibration_dataset_id: dataset.calibration_dataset_id,
    model_version_reference: MODEL_QUALIFICATION_MODEL_VERSION.model_version_reference,
    deterministic_seed: 42,
    diagnostics
  }).qualification;
  return { governed, source, dataset, qualification };
}

describe("ModelQualificationService", () => {
  it("runs a deterministic source-backed qualification and requires review before binding", () => {
    const { governed, qualification } = readyQualification();
    expect(qualification.decision).toBe("APPROVED");
    expect(qualification.review.status).toBe("PENDING");
    expect(() =>
      governed.bindQualification(teacher, scope, qualification.qualification_id)
    ).toThrow(new ModelQualificationError("MODEL_QUALIFICATION_REVIEW_REQUIRED"));

    const reviewed = governed.reviewQualification(teacher, scope, qualification.qualification_id, {
      decision: "APPROVED",
      note: "Source rights and diagnostics reviewed"
    }).qualification;
    const bound = governed.bindQualification(
      teacher,
      scope,
      reviewed.qualification_id
    ).qualification;
    expect(bound.review.status).toBe("APPROVED");
    expect(bound.binding.status).toBe("BOUND");
    expect(bound.authority_flags).toEqual({ official_truth_write: false, provider_calls: 0 });
  });

  it("fails closed for rights, expiry, stale source, holdout leakage, drift, OOD, and non-convergence", () => {
    const cases = [
      ["RESTRICTED", { rights_status: "RESTRICTED" as const }, "SOURCE_RIGHTS_NOT_ELIGIBLE"],
      ["expired", { expires_at: "2026-08-29T00:00:00.000Z" }, "SOURCE_EXPIRED"],
      ["stale", { freshness_status: "STALE" as const }, "SOURCE_NOT_FRESH"],
      [
        "holdout leakage",
        { dataset: { calibration_record_ids: ["r1", "r2"], holdout_record_ids: ["r2", "r3"] } },
        "HOLDOUT_LEAKAGE"
      ],
      ["drift", { diagnostics: { ...diagnostics, drift_score: 0.9 } }, "DRIFT_THRESHOLD_EXCEEDED"],
      ["ood", { diagnostics: { ...diagnostics, ood_rate: 0.9 } }, "OOD_THRESHOLD_EXCEEDED"],
      [
        "not converged",
        { diagnostics: { ...diagnostics, convergence_status: "NOT_CONVERGED" as const } },
        "QUALIFICATION_NOT_CONVERGED"
      ]
    ] as const;

    for (const [label, override, reason] of cases) {
      const governed = service();
      const source = governed.registerSourcePackage(teacher, scope, {
        ...sourceInput,
        ...(override && "rights_status" in override
          ? { rights_status: override.rights_status }
          : {}),
        ...(override && "expires_at" in override ? { expires_at: override.expires_at } : {}),
        ...(override && "freshness_status" in override
          ? { freshness_status: override.freshness_status }
          : {})
      }).source_package;
      const datasetOverride =
        override && "dataset" in override
          ? override.dataset
          : {
              calibration_record_ids: ["r1", "r2", "r3", "r4"],
              holdout_record_ids: ["r5", "r6"]
            };
      const dataset = governed.createCalibrationDataset(teacher, scope, {
        source_package_id: source.source_package_id,
        content_digest: "c".repeat(64),
        ...datasetOverride
      }).calibration_dataset;
      const result = governed.runQualification(teacher, scope, {
        source_package_id: source.source_package_id,
        calibration_dataset_id: dataset.calibration_dataset_id,
        model_version_reference: MODEL_QUALIFICATION_MODEL_VERSION.model_version_reference,
        deterministic_seed: 42,
        diagnostics: "diagnostics" in override ? override.diagnostics : diagnostics
      }).qualification;
      expect(result.decision, label).not.toBe("APPROVED");
      expect(result.reasons).toContain(reason);
    }
  });

  it("rejects an unregistered or mismatched exact ModelVersion reference", () => {
    const { governed, source, dataset } = readyQualification();
    expect(() =>
      governed.runQualification(teacher, scope, {
        source_package_id: source.source_package_id,
        calibration_dataset_id: dataset.calibration_dataset_id,
        model_version_reference: {
          ...MODEL_QUALIFICATION_MODEL_VERSION.model_version_reference,
          content_digest: "f".repeat(64)
        },
        deterministic_seed: 42,
        diagnostics
      })
    ).toThrow(new ModelQualificationError("MODEL_VERSION_REFERENCE_NOT_FOUND"));
  });

  it("keeps tenant scope and Student projection role-safe", () => {
    const { governed, qualification } = readyQualification();
    expect(() =>
      governed.getTeacherProjection({ ...teacher, tenant_id: "tenant_other" }, scope)
    ).toThrow(new ModelQualificationError("MODEL_QUALIFICATION_SCOPE_CONFLICT"));
    const reviewed = governed.reviewQualification(teacher, scope, qualification.qualification_id, {
      decision: "APPROVED",
      note: "approved"
    }).qualification;
    governed.bindQualification(teacher, scope, reviewed.qualification_id);
    const student = governed.getStudentProjection(
      { actor_id: "usr_student", role: "student", tenant_id: "tenant_demo" },
      scope,
      reviewed.qualification_id
    );
    const serialized = JSON.stringify(student);
    expect(student.visibility).toBe("ROLE_SAFE_STUDENT");
    expect(serialized).not.toContain("source_ref");
    expect(serialized).not.toContain("content_digest");
    expect(serialized).not.toContain("artifact_id");
    expect(serialized).not.toContain("r1");
    expect(serialized).toContain("approved");
  });
});
