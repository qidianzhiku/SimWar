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

const student: ModelQualificationActor = {
  actor_id: "usr_student",
  role: "student",
  tenant_id: "tenant_demo"
};

const scope = {
  activity_id: "model-qualification-studio",
  course_id: "course_demo",
  tenant_id: "tenant_demo"
};

const digest = (value: string) => value.repeat(64).slice(0, 64);

const sourceInput = {
  title: "Exact demand baseline",
  source_ref: "https://example.test/demand.csv",
  source_version: "2026.08",
  content_digest: digest("a"),
  feature_schema_digest: digest("b"),
  rights_status: "VALID" as const,
  freshness_status: "FRESH" as const,
  observed_at: "2026-08-30T00:00:00.000Z",
  expires_at: "2026-12-31T00:00:00.000Z",
  quality: { record_count: 6, missingness_rate: 0, conflict_count: 0 },
  evidence_refs: ["source-license", "source-provenance"]
};

function service(now: string | (() => string) = "2026-09-02T01:40:00.000Z") {
  return new ModelQualificationService({ now: typeof now === "function" ? now : () => now });
}

function baselineQualification(now?: string | (() => string)) {
  const governed = service(now);
  const baseline = governed.registerSourcePackage(teacher, scope, sourceInput).source_package;
  const dataset = governed.createCalibrationDataset(teacher, scope, {
    source_package_id: baseline.source_package_id,
    content_digest: digest("c"),
    calibration_record_ids: ["r1", "r2", "r3", "r4"],
    holdout_record_ids: ["r5", "r6"]
  }).calibration_dataset;
  const qualification = governed.runQualification(teacher, scope, {
    source_package_id: baseline.source_package_id,
    calibration_dataset_id: dataset.calibration_dataset_id,
    model_version_reference: MODEL_QUALIFICATION_MODEL_VERSION.model_version_reference,
    deterministic_seed: 42
  }).qualification;
  return { governed, baseline, dataset, qualification };
}

describe("ModelQualification evidence requalification lifecycle", () => {
  it("builds a deterministic change set and keeps the historical qualification immutable", () => {
    const { governed, baseline, qualification } = baselineQualification();
    const candidate = governed.registerSourcePackage(teacher, scope, {
      ...sourceInput,
      title: "Exact demand replacement",
      source_version: "2026.09",
      content_digest: digest("d"),
      observed_at: "2026-09-01T00:00:00.000Z",
      evidence_refs: ["source-license", "replacement-provenance"]
    }).source_package;

    const first = governed.createRequalificationPreview(teacher, scope, {
      baseline_source_package_id: baseline.source_package_id,
      candidate_source_package_id: candidate.source_package_id
    }).preview;
    const second = governed.createRequalificationPreview(teacher, scope, {
      baseline_source_package_id: baseline.source_package_id,
      candidate_source_package_id: candidate.source_package_id
    }).preview;

    expect(first.status).toBe("REQUALIFICATION_REQUIRED");
    expect(first.review.status).toBe("PENDING");
    expect(first.resolution).toBe("PENDING");
    expect(first.change_set.baseline.source_package_id).toBe(baseline.source_package_id);
    expect(first.change_set.candidate.source_package_id).toBe(candidate.source_package_id);
    expect(first.change_set.changed_dimensions).toEqual(
      expect.arrayContaining(["content_digest", "source_version", "observed_at", "evidence_refs"])
    );
    expect(first.change_set.affected_qualification_ids).toEqual([qualification.qualification_id]);
    expect(first.change_set.change_set_digest).toBe(second.change_set.change_set_digest);

    const projection = governed.getTeacherProjection(teacher, scope);
    expect(projection.requalification_previews).toHaveLength(2);
    expect(projection.qualifications[0]).toEqual(qualification);
    expect(projection.requalification_previews?.[0]?.historical_non_overwrite).toBe(true);
  });

  it("requires governed preview review before a replacement qualification can bind", () => {
    const { governed, baseline } = baselineQualification();
    const candidate = governed.registerSourcePackage(teacher, scope, {
      ...sourceInput,
      source_version: "2026.09",
      content_digest: digest("e"),
      observed_at: "2026-09-01T00:00:00.000Z"
    }).source_package;
    const preview = governed.createRequalificationPreview(teacher, scope, {
      baseline_source_package_id: baseline.source_package_id,
      candidate_source_package_id: candidate.source_package_id
    }).preview;
    const candidateDataset = governed.createCalibrationDataset(teacher, scope, {
      source_package_id: candidate.source_package_id,
      content_digest: digest("1"),
      calibration_record_ids: ["candidate-r1", "candidate-r2", "candidate-r3", "candidate-r4"],
      holdout_record_ids: ["candidate-r5", "candidate-r6"]
    }).calibration_dataset;
    const candidateQualification = governed.runQualification(teacher, scope, {
      source_package_id: candidate.source_package_id,
      calibration_dataset_id: candidateDataset.calibration_dataset_id,
      model_version_reference: MODEL_QUALIFICATION_MODEL_VERSION.model_version_reference,
      deterministic_seed: 42
    }).qualification;

    const reviewedQualification = governed.reviewQualification(
      teacher,
      scope,
      candidateQualification.qualification_id,
      { decision: "APPROVED", note: "Candidate qualification reviewed." }
    ).qualification;
    expect(() =>
      governed.bindQualification(teacher, scope, reviewedQualification.qualification_id)
    ).toThrow(new ModelQualificationError("MODEL_QUALIFICATION_REVIEW_REQUIRED"));

    const reviewedPreview = governed.reviewRequalificationPreview(
      teacher,
      scope,
      preview.preview_id,
      {
        decision: "APPROVED",
        note: "Replacement evidence reviewed against exact baseline and impact."
      }
    ).preview;
    const bound = governed.bindQualification(
      teacher,
      scope,
      reviewedQualification.qualification_id
    ).qualification;

    expect(reviewedPreview.review.status).toBe("APPROVED");
    expect(bound.binding.status).toBe("BOUND");
    expect(bound.source_package_id).toBe(candidate.source_package_id);
    expect(governed.getTeacherProjection(teacher, scope).qualifications).toHaveLength(2);
    expect(
      governed.getStudentProjection(student, scope, bound.qualification_id).requalification
    ).toMatchObject({
      resolution: "ACCEPTED",
      historical_non_overwrite: true
    });
  });

  it("classifies unusable replacement evidence without activating or overwriting truth", () => {
    const { governed, baseline } = baselineQualification();
    const candidate = governed.registerSourcePackage(teacher, scope, {
      ...sourceInput,
      content_digest: digest("f"),
      rights_status: "RESTRICTED",
      freshness_status: "STALE",
      source_version: "2026.09"
    }).source_package;
    const preview = governed.createRequalificationPreview(teacher, scope, {
      baseline_source_package_id: baseline.source_package_id,
      candidate_source_package_id: candidate.source_package_id
    }).preview;

    expect(preview.status).toBe("NOT_ELIGIBLE");
    expect(preview.reasons).toEqual(
      expect.arrayContaining(["CANDIDATE_RIGHTS_NOT_ELIGIBLE", "CANDIDATE_NOT_FRESH"])
    );
    expect(preview.historical_non_overwrite).toBe(true);
  });

  it("blocks binding when the replacement requires a feature-schema rebase", () => {
    const { governed, baseline } = baselineQualification();
    const candidate = governed.registerSourcePackage(teacher, scope, {
      ...sourceInput,
      content_digest: digest("1"),
      feature_schema_digest: digest("f"),
      source_version: "2.0.0"
    }).source_package;
    const preview = governed.createRequalificationPreview(teacher, scope, {
      baseline_source_package_id: baseline.source_package_id,
      candidate_source_package_id: candidate.source_package_id
    }).preview;
    expect(preview.status).toBe("REBASE_REQUIRED");
    const dataset = governed.createCalibrationDataset(teacher, scope, {
      source_package_id: candidate.source_package_id,
      content_digest: digest("1"),
      calibration_record_ids: ["rebase-calibration"],
      holdout_record_ids: ["rebase-holdout"]
    }).calibration_dataset;
    const qualification = governed.runQualification(teacher, scope, {
      source_package_id: candidate.source_package_id,
      calibration_dataset_id: dataset.calibration_dataset_id,
      model_version_reference: MODEL_QUALIFICATION_MODEL_VERSION.model_version_reference,
      deterministic_seed: 42
    }).qualification;
    governed.reviewQualification(teacher, scope, qualification.qualification_id, {
      decision: "APPROVED",
      note: "Candidate qualification reviewed."
    });
    governed.reviewRequalificationPreview(teacher, scope, preview.preview_id, {
      decision: "APPROVED",
      note: "Schema change requires a governed rebase."
    });
    expect(() =>
      governed.bindQualification(teacher, scope, qualification.qualification_id)
    ).toThrow(new ModelQualificationError("MODEL_QUALIFICATION_REVIEW_REQUIRED"));
  });

  it("fails closed when an older preview for the same candidate remains unresolved", () => {
    let now = "2026-09-02T01:40:00.000Z";
    const { governed, baseline, qualification } = baselineQualification(() => now);
    const secondBaseline = governed.registerSourcePackage(teacher, scope, {
      ...sourceInput,
      content_digest: digest("2"),
      feature_schema_digest: digest("f"),
      source_version: "2026.08-second-baseline"
    }).source_package;
    const secondDataset = governed.createCalibrationDataset(teacher, scope, {
      source_package_id: secondBaseline.source_package_id,
      content_digest: digest("3"),
      calibration_record_ids: ["second-r1"],
      holdout_record_ids: ["second-h1"]
    }).calibration_dataset;
    governed.runQualification(teacher, scope, {
      source_package_id: secondBaseline.source_package_id,
      calibration_dataset_id: secondDataset.calibration_dataset_id,
      model_version_reference: MODEL_QUALIFICATION_MODEL_VERSION.model_version_reference,
      deterministic_seed: 42
    });
    const candidate = governed.registerSourcePackage(teacher, scope, {
      ...sourceInput,
      content_digest: digest("4"),
      source_version: "2026.09-candidate"
    }).source_package;

    const rebasePreview = governed.createRequalificationPreview(teacher, scope, {
      baseline_source_package_id: secondBaseline.source_package_id,
      candidate_source_package_id: candidate.source_package_id
    }).preview;
    expect(rebasePreview.status).toBe("REBASE_REQUIRED");
    now = "2026-09-02T01:41:00.000Z";
    const approvedPreview = governed.createRequalificationPreview(teacher, scope, {
      baseline_source_package_id: baseline.source_package_id,
      candidate_source_package_id: candidate.source_package_id
    }).preview;
    expect(approvedPreview.status).toBe("REQUALIFICATION_REQUIRED");
    governed.reviewRequalificationPreview(teacher, scope, approvedPreview.preview_id, {
      decision: "APPROVED",
      note: "Only the compatible baseline was reviewed."
    });

    const candidateDataset = governed.createCalibrationDataset(teacher, scope, {
      source_package_id: candidate.source_package_id,
      content_digest: digest("5"),
      calibration_record_ids: ["candidate-r1"],
      holdout_record_ids: ["candidate-h1"]
    }).calibration_dataset;
    const candidateQualification = governed.runQualification(teacher, scope, {
      source_package_id: candidate.source_package_id,
      calibration_dataset_id: candidateDataset.calibration_dataset_id,
      model_version_reference: MODEL_QUALIFICATION_MODEL_VERSION.model_version_reference,
      deterministic_seed: 42
    }).qualification;
    governed.reviewQualification(teacher, scope, candidateQualification.qualification_id, {
      decision: "APPROVED",
      note: "Candidate qualification reviewed."
    });

    expect(() =>
      governed.bindQualification(teacher, scope, candidateQualification.qualification_id)
    ).toThrow(new ModelQualificationError("MODEL_QUALIFICATION_REVIEW_REQUIRED"));
    expect(qualification.binding.status).toBe("UNBOUND");
  });

  it("rechecks candidate expiry at bind time instead of trusting an approved preview", () => {
    let now = "2026-09-02T01:40:00.000Z";
    const governed = new ModelQualificationService({ now: () => now });
    const baseline = governed.registerSourcePackage(teacher, scope, sourceInput).source_package;
    const candidate = governed.registerSourcePackage(teacher, scope, {
      ...sourceInput,
      content_digest: digest("6"),
      source_version: "2026.09-expiring-candidate",
      expires_at: "2026-09-02T02:00:00.000Z"
    }).source_package;
    const preview = governed.createRequalificationPreview(teacher, scope, {
      baseline_source_package_id: baseline.source_package_id,
      candidate_source_package_id: candidate.source_package_id
    }).preview;
    const dataset = governed.createCalibrationDataset(teacher, scope, {
      source_package_id: candidate.source_package_id,
      content_digest: digest("7"),
      calibration_record_ids: ["expiring-r1"],
      holdout_record_ids: ["expiring-h1"]
    }).calibration_dataset;
    const qualification = governed.runQualification(teacher, scope, {
      source_package_id: candidate.source_package_id,
      calibration_dataset_id: dataset.calibration_dataset_id,
      model_version_reference: MODEL_QUALIFICATION_MODEL_VERSION.model_version_reference,
      deterministic_seed: 42
    }).qualification;
    governed.reviewQualification(teacher, scope, qualification.qualification_id, {
      decision: "APPROVED",
      note: "Candidate qualification reviewed before expiry."
    });
    governed.reviewRequalificationPreview(teacher, scope, preview.preview_id, {
      decision: "APPROVED",
      note: "Candidate evidence reviewed before expiry."
    });

    now = "2026-09-02T02:01:00.000Z";
    expect(() => governed.bindQualification(teacher, scope, qualification.qualification_id)).toThrow(
      new ModelQualificationError("MODEL_QUALIFICATION_REVIEW_REQUIRED")
    );
  });
});
