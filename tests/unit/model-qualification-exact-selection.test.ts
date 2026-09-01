import { describe, expect, it } from "vitest";
import type {
  ModelQualification,
  ModelQualificationCalibrationDataset,
  ModelQualificationModelCatalogEntry,
  ModelQualificationSourcePackage,
  ModelQualificationTeacherProjection
} from "@simwar/shared-contracts";
import {
  buildExactModelQualificationSelection,
  createEmptyModelQualificationSelection,
  hasExactModelQualificationEvidence,
  resolveModelQualificationEvidenceSelection,
  type ModelQualificationEvidenceSelection,
  type ModelQualificationEvidenceSelectionContext
} from "../../apps/teacher/src/model-qualification-evidence-selection";

const CONTEXT: ModelQualificationEvidenceSelectionContext = {
  activityId: "model-qualification-studio",
  courseId: "course_demo",
  tenantId: "tenant_demo"
};

function digest(seed: string): string {
  return `${seed.replace(/[^a-z0-9]/giu, "").toLowerCase()}${"0".repeat(64)}`.slice(0, 64);
}

function model(
  modelVersionId: string,
  version: string,
  digestSeed: string
): ModelQualificationModelCatalogEntry {
  const referenceDigest = digest(`${digestSeed}-reference`);
  return {
    artifact: {
      artifact_id: `artifact-${modelVersionId}`,
      content_digest: digest(`${digestSeed}-artifact`),
      format: "application/json",
      source_ref: `model-registry://${modelVersionId}`
    },
    model_family: "toy_logit",
    model_version_reference: {
      content_digest: referenceDigest,
      model_version_id: modelVersionId,
      version
    },
    status: "APPROVED"
  };
}

function source(
  sourcePackageId: string,
  digestSeed: string,
  tenantId = CONTEXT.tenantId,
  courseId = CONTEXT.courseId
): ModelQualificationSourcePackage {
  return {
    content_digest: digest(digestSeed),
    course_id: courseId,
    evidence_refs: [`evidence-${sourcePackageId}`],
    expires_at: null,
    feature_schema_digest: digest(`${digestSeed}-schema`),
    freshness_status: "FRESH",
    observed_at: "2026-08-30T12:00:00.000Z",
    quality: { conflict_count: 0, missingness_rate: 0.01, record_count: 4 },
    rights_status: "VALID",
    source_package_id: sourcePackageId,
    source_ref: `source-registry://${sourcePackageId}`,
    source_version: "1.0.0",
    tenant_id: tenantId,
    title: `Source ${sourcePackageId}`
  };
}

function dataset(
  calibrationDatasetId: string,
  sourcePackageId: string,
  digestSeed: string,
  tenantId = CONTEXT.tenantId,
  courseId = CONTEXT.courseId
): ModelQualificationCalibrationDataset {
  return {
    calibration_dataset_id: calibrationDatasetId,
    calibration_record_ids: [`${calibrationDatasetId}-calibration`],
    content_digest: digest(digestSeed),
    course_id: courseId,
    created_at: "2026-08-30T12:00:00.000Z",
    holdout_leakage_count: 0,
    holdout_record_ids: [`${calibrationDatasetId}-holdout`],
    record_count: 2,
    source_package_id: sourcePackageId,
    status: "READY",
    tenant_id: tenantId,
    zero_holdout_leakage: true
  };
}

function qualification(
  qualificationId: string,
  modelVersion: ModelQualificationModelCatalogEntry,
  sourcePackage: ModelQualificationSourcePackage,
  calibrationDataset: ModelQualificationCalibrationDataset,
  digestSeed: string
): ModelQualification {
  const contentDigest = digest(digestSeed);
  return {
    artifact: {
      artifact_id: `qualification-artifact-${qualificationId}`,
      content_digest: contentDigest,
      format: "application/json",
      source_ref: `qualification-registry://${qualificationId}`
    },
    authority_flags: { official_truth_write: false, provider_calls: 0 },
    binding: {
      bound_at: "2026-08-30T12:00:00.000Z",
      bound_by: "teacher-reviewer",
      course_id: sourcePackage.course_id,
      status: "BOUND"
    },
    calibration_dataset_id: calibrationDataset.calibration_dataset_id,
    content_digest: contentDigest,
    course_id: sourcePackage.course_id,
    created_at: "2026-08-30T12:00:00.000Z",
    decision: "APPROVED",
    deterministic_seed: 42,
    diagnostics: {
      baseline_error: 0.08,
      convergence_status: "CONVERGED",
      differential_error: 0.04,
      drift_score: 0.08,
      ood_rate: 0.02,
      sensitivity_max_delta: 0.06
    },
    known_limits: ["Candidate governance evidence only."],
    model_version_reference: modelVersion.model_version_reference,
    no_implicit_latest: true,
    qualification_id: qualificationId,
    reasons: ["Exact offline fixture."],
    review: {
      decision_note: "Reviewed offline fixture.",
      reviewed_at: "2026-08-30T12:00:00.000Z",
      reviewed_by: "teacher-reviewer",
      status: "APPROVED"
    },
    source_package_id: sourcePackage.source_package_id,
    tenant_id: sourcePackage.tenant_id,
    updated_at: "2026-08-30T12:00:00.000Z"
  };
}

const MODEL_OLD = model("model-old", "1.0.0", "model-old");
const MODEL_TARGET = model("model-target", "2.0.0", "model-target");
const MODEL_NEWEST = model("model-newest", "3.0.0", "model-newest");

const SOURCE_OLD = source("source-old", "source-old");
const SOURCE_TARGET = source("source-target", "source-target");
const SOURCE_NEWEST = source("source-newest", "source-newest");

const DATASET_OLD = dataset("dataset-old", SOURCE_OLD.source_package_id, "dataset-old");
const DATASET_TARGET = dataset("dataset-target", SOURCE_TARGET.source_package_id, "dataset-target");
const DATASET_NEWEST = dataset("dataset-newest", SOURCE_NEWEST.source_package_id, "dataset-newest");

const QUALIFICATION_OLD = qualification(
  "qualification-old",
  MODEL_OLD,
  SOURCE_OLD,
  DATASET_OLD,
  "qualification-old"
);
const QUALIFICATION_TARGET = qualification(
  "qualification-target",
  MODEL_TARGET,
  SOURCE_TARGET,
  DATASET_TARGET,
  "qualification-target"
);
const QUALIFICATION_NEWEST = qualification(
  "qualification-newest",
  MODEL_NEWEST,
  SOURCE_NEWEST,
  DATASET_NEWEST,
  "qualification-newest"
);

function projection(
  overrides: Partial<ModelQualificationTeacherProjection> = {}
): ModelQualificationTeacherProjection {
  return {
    calibration_datasets: [DATASET_OLD, DATASET_TARGET, DATASET_NEWEST],
    known_limits: ["Read-only candidate evidence."],
    model_catalog: [MODEL_OLD, MODEL_TARGET, MODEL_NEWEST],
    operation_id: "MODEL_QUALIFICATION_TEACHER_STUDIO_GET_V1",
    qualifications: [QUALIFICATION_OLD, QUALIFICATION_TARGET, QUALIFICATION_NEWEST],
    security: {
      activity: CONTEXT.activityId,
      course: CONTEXT.courseId,
      role: "teacher",
      tenant: CONTEXT.tenantId
    },
    source_packages: [SOURCE_OLD, SOURCE_TARGET, SOURCE_NEWEST],
    ...overrides
  };
}

const PROJECTION = projection();
const TARGET_SELECTION = buildExactModelQualificationSelection(
  MODEL_TARGET,
  SOURCE_TARGET,
  DATASET_TARGET,
  QUALIFICATION_TARGET
);

describe("model qualification exact evidence selection", () => {
  it("selects the requested four-part exact chain instead of first/latest/array-end entries", () => {
    const result = resolveModelQualificationEvidenceSelection({
      context: CONTEXT,
      projection: PROJECTION,
      selection: TARGET_SELECTION
    });

    expect(result.state).toBe("selected");
    expect(result.status).toBe("SELECTED");
    expect(result.selected).toMatchObject({
      model: { model_version_reference: { model_version_id: "model-target" } },
      source: { source_package_id: "source-target" },
      dataset: { calibration_dataset_id: "dataset-target" },
      qualification: { qualification_id: "qualification-target" }
    });
    expect(TARGET_SELECTION).toEqual({
      model_version_key: `${MODEL_TARGET.model_version_reference.model_version_id}@${MODEL_TARGET.model_version_reference.version}#${MODEL_TARGET.model_version_reference.content_digest}`,
      source_package_key: `${SOURCE_TARGET.source_package_id}#${SOURCE_TARGET.content_digest}`,
      calibration_dataset_key: `${DATASET_TARGET.calibration_dataset_id}#${DATASET_TARGET.content_digest}`,
      qualification_key: `${QUALIFICATION_TARGET.qualification_id}#${QUALIFICATION_TARGET.content_digest}`
    });
    expect(hasExactModelQualificationEvidence(result)).toBe(true);
  });

  it("exposes empty and no-selection as distinct fail-closed states", () => {
    expect(createEmptyModelQualificationSelection()).toEqual({
      model_version_key: null,
      source_package_key: null,
      calibration_dataset_key: null,
      qualification_key: null
    });

    const empty = resolveModelQualificationEvidenceSelection({
      context: CONTEXT,
      projection: projection({
        calibration_datasets: [],
        model_catalog: [],
        qualifications: [],
        source_packages: []
      }),
      selection: null
    });
    expect(empty.state).toBe("empty");
    expect(empty.selected).toBeNull();

    const noSelection = resolveModelQualificationEvidenceSelection({
      context: CONTEXT,
      projection: PROJECTION,
      selection: null
    });
    expect(noSelection.state).toBe("no-selection");
    expect(noSelection.selected).toBeNull();
  });

  it("rejects a stale same-ID selection when the current digest changes", () => {
    const staleProjection = projection({
      source_packages: [
        SOURCE_OLD,
        { ...SOURCE_TARGET, content_digest: digest("source-target-replaced") },
        SOURCE_NEWEST
      ]
    });

    const result = resolveModelQualificationEvidenceSelection({
      context: CONTEXT,
      projection: staleProjection,
      selection: TARGET_SELECTION
    });

    expect(result.state).toBe("stale");
    expect(result.status).toBe("STALE");
    expect(result.selected).toBeNull();
  });

  it("distinguishes a missing linked item from an existing cross-chain mismatch", () => {
    const missingLinkedQualification = {
      ...QUALIFICATION_TARGET,
      source_package_id: "source-not-in-projection"
    } as ModelQualification;
    const missingLinked = resolveModelQualificationEvidenceSelection({
      context: CONTEXT,
      projection: projection({
        qualifications: [QUALIFICATION_OLD, missingLinkedQualification, QUALIFICATION_NEWEST]
      }),
      selection: TARGET_SELECTION
    });
    expect(missingLinked.state).toBe("missing-linked-item");
    expect(missingLinked.status).toBe("MISSING_LINKED_ITEM");
    expect(missingLinked.selected).toBeNull();

    const mismatchedQualification = {
      ...QUALIFICATION_TARGET,
      source_package_id: SOURCE_OLD.source_package_id
    } as ModelQualification;
    const mismatch = resolveModelQualificationEvidenceSelection({
      context: CONTEXT,
      projection: projection({
        qualifications: [QUALIFICATION_OLD, mismatchedQualification, QUALIFICATION_NEWEST]
      }),
      selection: TARGET_SELECTION
    });
    expect(mismatch.state).toBe("mismatch");
    expect(mismatch.status).toBe("MISMATCH");
    expect(mismatch.selected).toBeNull();
  });

  it("fails closed for invalid context and unconfirmed exactness", () => {
    const contextMismatch = resolveModelQualificationEvidenceSelection({
      context: { ...CONTEXT, courseId: "course-other" },
      projection: PROJECTION,
      selection: TARGET_SELECTION
    });
    expect(contextMismatch.state).toBe("invalid-context");
    expect(contextMismatch.selected).toBeNull();

    const roleMismatch = resolveModelQualificationEvidenceSelection({
      context: CONTEXT,
      projection: projection({
        security: { ...PROJECTION.security, role: "student" }
      }),
      selection: TARGET_SELECTION
    });
    expect(roleMismatch.state).toBe("invalid-context");
    expect(roleMismatch.selected).toBeNull();

    const unconfirmed = {
      ...QUALIFICATION_TARGET,
      no_implicit_latest: false
    } as unknown as ModelQualification;
    const unknown = resolveModelQualificationEvidenceSelection({
      context: CONTEXT,
      projection: projection({
        qualifications: [QUALIFICATION_OLD, unconfirmed, QUALIFICATION_NEWEST]
      }),
      selection: TARGET_SELECTION
    });
    expect(unknown.state).toBe("unknown");
    expect(unknown.selected).toBeNull();
  });

  it("rejects implicit sentinel selectors instead of resolving an array entry", () => {
    const result = resolveModelQualificationEvidenceSelection({
      context: CONTEXT,
      projection: PROJECTION,
      selection: {
        calibration_dataset_key: "default",
        model_version_key: "latest",
        qualification_key: "current",
        source_package_key: "*"
      } as ModelQualificationEvidenceSelection
    });

    expect(result.state).toBe("unknown");
    expect(result.status).toBe("UNKNOWN");
    expect(result.selected).toBeNull();
  });

  it("rejects duplicate exact entries before selecting the requested chain", () => {
    const result = resolveModelQualificationEvidenceSelection({
      context: CONTEXT,
      projection: projection({
        source_packages: [SOURCE_OLD, SOURCE_TARGET, SOURCE_TARGET, SOURCE_NEWEST]
      }),
      selection: TARGET_SELECTION
    });

    expect(result.state).toBe("duplicate");
    expect(result.status).toBe("DUPLICATE");
    expect(result.selected).toBeNull();
  });

  it("rejects same-ID entries with different content digests as a conflict", () => {
    const conflictingSource = {
      ...SOURCE_TARGET,
      content_digest: digest("source-target-conflict")
    };
    const result = resolveModelQualificationEvidenceSelection({
      context: CONTEXT,
      projection: projection({
        source_packages: [SOURCE_OLD, SOURCE_TARGET, conflictingSource, SOURCE_NEWEST]
      }),
      selection: TARGET_SELECTION
    });

    expect(result.state).toBe("conflict");
    expect(result.status).toBe("CONFLICT");
    expect(result.selected).toBeNull();
  });

  it("surfaces collection conflicts before allowing a partial action selection", () => {
    const conflictingSource = {
      ...SOURCE_TARGET,
      content_digest: digest("source-target-conflict")
    };
    const result = resolveModelQualificationEvidenceSelection({
      context: CONTEXT,
      projection: projection({
        source_packages: [SOURCE_OLD, SOURCE_TARGET, conflictingSource, SOURCE_NEWEST]
      }),
      selection: {
        calibration_dataset_key: null,
        model_version_key: TARGET_SELECTION.model_version_key,
        qualification_key: null,
        source_package_key: TARGET_SELECTION.source_package_key
      }
    });

    expect(result.state).toBe("conflict");
    expect(hasExactModelQualificationEvidence(result)).toBe(false);
  });

  it("returns existing candidate status without promoting or mutating qualification truth", () => {
    const candidate = {
      ...QUALIFICATION_TARGET,
      binding: { status: "UNBOUND" as const },
      decision: "NOT_ELIGIBLE" as const,
      review: { status: "PENDING" as const }
    };
    const candidateProjection = projection({
      qualifications: [QUALIFICATION_OLD, candidate, QUALIFICATION_NEWEST]
    });
    const before = JSON.stringify(candidateProjection);

    const result = resolveModelQualificationEvidenceSelection({
      context: CONTEXT,
      projection: candidateProjection,
      selection: TARGET_SELECTION
    });

    expect(result.state).toBe("selected");
    expect(result.selected?.qualification).toBe(candidate);
    expect(result.selected?.qualification.decision).toBe("NOT_ELIGIBLE");
    expect(result.selected?.qualification.binding.status).toBe("UNBOUND");
    expect(JSON.stringify(candidateProjection)).toBe(before);
  });
});
