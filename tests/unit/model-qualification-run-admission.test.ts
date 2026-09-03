import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import type {
  CoursePackageVersion,
  ModelArtifactReference,
  ModelQualification,
  ModelQualificationCalibrationDataset,
  ModelQualificationModelCatalogEntry,
  ModelQualificationRecord,
  ModelQualificationSourcePackage,
  ModelVersionReference,
  ParameterSetReference,
  ScenarioPackageReference
} from "@simwar/shared-contracts";
import type {
  FormalRunParameterSetAuthorityBindingRecord,
  FormalRunScenarioPackageAuthorityBindingRecord
} from "../../services/api/src/formal-run-runtime-binding";
import {
  resolveQualifiedRunAdmission,
  type QualifiedRunAdmissionInput
} from "../../services/api/src/model-qualification-run-admission";

const TENANT_ID = "tenant_demo";
const COURSE_ID = "course_demo";
const NOW = "2026-09-03T12:00:00.000Z";
const digest = (seed: string): string => createHash("sha256").update(seed).digest("hex");

const COURSE_PACKAGE_REFERENCE = {
  content_digest: digest("course-package"),
  course_package_id: "course_package_demo",
  tenant_id: TENANT_ID,
  version: "1.0.0"
};
const SCENARIO_REFERENCE: ScenarioPackageReference = {
  content_digest: digest("scenario"),
  scenario_package_id: "scenario_demo",
  tenant_id: TENANT_ID,
  version: "1.0.0"
};
const PARAMETER_REFERENCE: ParameterSetReference = {
  content_digest: digest("parameter"),
  parameter_set_id: "parameter_demo",
  version: "1.0.0"
};
const MODEL_VERSION_REFERENCE: ModelVersionReference = {
  content_digest: digest("model-version"),
  model_version_id: "model_demo",
  version: "2.0.0"
};
const MODEL_ARTIFACT_REFERENCE: ModelArtifactReference = {
  artifact_id: "artifact_demo",
  content_digest: digest("model-artifact"),
  format: "typescript-boundary",
  source_ref: "services/simulation-core/src/toy-logit-engine.ts"
};

function createSource(overrides: Partial<ModelQualificationSourcePackage> = {}) {
  return {
    content_digest: digest("source"),
    course_id: COURSE_ID,
    evidence_refs: ["fixture:source"],
    expires_at: "2026-12-31T00:00:00.000Z",
    feature_schema_digest: digest("feature-schema"),
    freshness_status: "FRESH" as const,
    observed_at: "2026-09-01T00:00:00.000Z",
    quality: { conflict_count: 0, missingness_rate: 0, record_count: 4 },
    rights_status: "VALID" as const,
    source_package_id: "source_demo",
    source_ref: "fixture://source-demo",
    source_version: "1.0.0",
    tenant_id: TENANT_ID,
    title: "Exact source",
    ...overrides
  } satisfies ModelQualificationSourcePackage;
}

function createDataset(overrides: Partial<ModelQualificationCalibrationDataset> = {}) {
  return {
    calibration_dataset_id: "dataset_demo",
    calibration_record_ids: ["calibration-1"],
    content_digest: digest("dataset"),
    course_id: COURSE_ID,
    created_at: "2026-09-01T00:00:00.000Z",
    holdout_leakage_count: 0,
    holdout_record_ids: ["holdout-1"],
    record_count: 1,
    source_package_id: "source_demo",
    status: "READY" as const,
    tenant_id: TENANT_ID,
    zero_holdout_leakage: true,
    ...overrides
  } satisfies ModelQualificationCalibrationDataset;
}

function createQualification(
  source: ModelQualificationSourcePackage,
  dataset: ModelQualificationCalibrationDataset,
  model: ModelQualificationModelCatalogEntry,
  overrides: Partial<ModelQualification> = {}
) {
  return {
    artifact: model.artifact,
    authority_flags: { official_truth_write: false, provider_calls: 0 as const },
    binding: {
      bound_at: "2026-09-02T00:00:00.000Z",
      bound_by: "teacher_demo",
      course_id: COURSE_ID,
      status: "BOUND" as const
    },
    calibration_dataset_id: dataset.calibration_dataset_id,
    content_digest: digest("qualification"),
    course_id: COURSE_ID,
    created_at: "2026-09-02T00:00:00.000Z",
    decision: "APPROVED" as const,
    deterministic_seed: 42,
    diagnostics: {
      baseline_error: 0.05,
      convergence_status: "CONVERGED" as const,
      differential_error: 0.02,
      drift_score: 0.05,
      ood_rate: 0.02,
      sensitivity_max_delta: 0.05
    },
    known_limits: ["Candidate governance evidence only."],
    model_version_reference: model.model_version_reference,
    no_implicit_latest: true as const,
    qualification_id: "qualification_demo",
    reasons: ["Exact fixture."],
    review: {
      decision_note: "Reviewed exact fixture.",
      reviewed_at: "2026-09-02T00:00:00.000Z",
      reviewed_by: "teacher_demo",
      status: "APPROVED" as const
    },
    source_package_id: source.source_package_id,
    tenant_id: TENANT_ID,
    updated_at: "2026-09-02T00:00:00.000Z",
    ...overrides
  } satisfies ModelQualification;
}

function createFixture(
  overrides: Partial<QualifiedRunAdmissionInput> = {}
): QualifiedRunAdmissionInput {
  const source = createSource();
  const dataset = createDataset();
  const model = {
    artifact: MODEL_ARTIFACT_REFERENCE,
    model_family: "toy_logit" as const,
    model_version_reference: MODEL_VERSION_REFERENCE,
    status: "APPROVED" as const
  } satisfies ModelQualificationModelCatalogEntry;
  const qualification = createQualification(source, dataset, model);
  const scenarioPackage = {
    artifact_policy: { retention: "IMMUTABLE" as const },
    compatibility_metadata: {},
    content: { runtime_scenario_package: { name: "Demo", plugin_package_ids: [] } },
    content_digest: SCENARIO_REFERENCE.content_digest,
    metadata: {},
    parameter_set_reference: PARAMETER_REFERENCE,
    plugin_dependencies: [],
    reference: SCENARIO_REFERENCE,
    scenario_package_id: SCENARIO_REFERENCE.scenario_package_id,
    schema_version: "scenario-package.v1",
    status: "APPROVED" as const,
    tenant_id: TENANT_ID,
    version: SCENARIO_REFERENCE.version
  } as FormalRunScenarioPackageAuthorityBindingRecord;
  const parameterSet = {
    compatibility_metadata: {},
    content_digest: PARAMETER_REFERENCE.content_digest,
    model_version_ref: `${MODEL_VERSION_REFERENCE.model_version_id}@${MODEL_VERSION_REFERENCE.version}`,
    parameter_values: { runtime_parameter_set: { model_family: "toy_logit" } },
    parameter_set_id: PARAMETER_REFERENCE.parameter_set_id,
    reference: PARAMETER_REFERENCE,
    schema_version: "parameter-set.v1",
    status: "APPROVED" as const,
    tenant_id: TENANT_ID,
    version: PARAMETER_REFERENCE.version
  } as FormalRunParameterSetAuthorityBindingRecord;
  const coursePackage = {
    ...COURSE_PACKAGE_REFERENCE,
    course_blueprint_reference: {
      content_digest: digest("blueprint"),
      course_blueprint_id: "blueprint_demo",
      tenant_id: TENANT_ID,
      version: "1.0.0"
    },
    description: "Exact package",
    parameter_set_reference: PARAMETER_REFERENCE,
    scenario_package_reference: SCENARIO_REFERENCE,
    schema_version: "course-package-version.v1",
    status: "PUBLISHED" as const,
    title: "Demo package",
    created_at: "2026-09-01T00:00:00.000Z",
    created_by: "teacher_demo",
    tenant_id: TENANT_ID,
    version: COURSE_PACKAGE_REFERENCE.version
  } as unknown as CoursePackageVersion;
  const record = {
    calibration_datasets: [dataset],
    course_id: COURSE_ID,
    qualifications: [qualification],
    requalification_previews: [],
    source_packages: [source],
    tenant_id: TENANT_ID
  } satisfies ModelQualificationRecord;

  return {
    admission: {
      calibration_dataset_id: dataset.calibration_dataset_id,
      course_id: COURSE_ID,
      course_package_reference: COURSE_PACKAGE_REFERENCE,
      model_artifact_reference: MODEL_ARTIFACT_REFERENCE,
      model_version_reference: MODEL_VERSION_REFERENCE,
      parameter_set_reference: PARAMETER_REFERENCE,
      qualification_id: qualification.qualification_id,
      scenario_package_reference: SCENARIO_REFERENCE,
      source_package_id: source.source_package_id,
      tenant_id: TENANT_ID
    },
    calibration_dataset: dataset,
    course_package: coursePackage,
    model: model,
    now: NOW,
    parameter_set: parameterSet,
    qualification_record: record,
    scenario_package: scenarioPackage,
    ...overrides
  };
}

describe("qualified formal Run admission resolver", () => {
  it("admits one exact course/evidence/model chain without a writer effect", () => {
    const result = resolveQualifiedRunAdmission(createFixture());

    expect(result).toMatchObject({
      status: "ADMITTED",
      writer_effect: "NONE",
      official_truth_write: false,
      provider: "OFF",
      qualification_id: "qualification_demo",
      source_package_id: "source_demo",
      calibration_dataset_id: "dataset_demo"
    });
    expect(result.model_version_reference).toEqual(MODEL_VERSION_REFERENCE);
    expect(result.model_artifact_reference).toEqual(MODEL_ARTIFACT_REFERENCE);
  });

  it.each([
    ["missing qualification", { qualification_record: null }, "QUALIFIED_RUN_ADMISSION_QUALIFICATION_REQUIRED"],
    ["missing source", { qualification_record: { ...createFixture().qualification_record, source_packages: [] } }, "QUALIFIED_RUN_ADMISSION_SOURCE_REQUIRED"],
    ["missing dataset", { qualification_record: { ...createFixture().qualification_record, calibration_datasets: [] } }, "QUALIFIED_RUN_ADMISSION_DATASET_REQUIRED"]
  ])("fails closed for %s", (_label, overrides, code) => {
    expect(() => resolveQualifiedRunAdmission(createFixture(overrides))).toThrow(code);
  });

  it.each([
    ["not approved", { qualification: { decision: "NOT_ELIGIBLE" as const } }, "QUALIFIED_RUN_ADMISSION_QUALIFICATION_NOT_APPROVED"],
    ["not reviewed", { qualification: { review: { status: "PENDING" as const } } }, "QUALIFIED_RUN_ADMISSION_REVIEW_REQUIRED"],
    ["not bound", { qualification: { binding: { status: "UNBOUND" as const } } }, "QUALIFIED_RUN_ADMISSION_BINDING_REQUIRED"],
    ["stale source", { source: { freshness_status: "STALE" as const } }, "QUALIFIED_RUN_ADMISSION_SOURCE_NOT_FRESH"],
    ["invalid rights", { source: { rights_status: "RESTRICTED" as const } }, "QUALIFIED_RUN_ADMISSION_SOURCE_RIGHTS_INVALID"],
    ["expired source", { source: { expires_at: "2026-09-03T11:59:59.999Z" } }, "QUALIFIED_RUN_ADMISSION_SOURCE_EXPIRED"],
    ["holdout leakage", { dataset: { holdout_leakage_count: 1, zero_holdout_leakage: false } }, "QUALIFIED_RUN_ADMISSION_HOLDOUT_LEAKAGE"],
    ["model mismatch", { model: { model_version_reference: { ...MODEL_VERSION_REFERENCE, version: "9.0.0" } } }, "QUALIFIED_RUN_ADMISSION_MODEL_MISMATCH"],
    ["parameter mismatch", { admission: { ...createFixture().admission, parameter_set_reference: { ...PARAMETER_REFERENCE, version: "9.0.0" } } }, "QUALIFIED_RUN_ADMISSION_PARAMETER_MISMATCH"],
    ["cross-tenant scope", { admission: { ...createFixture().admission, tenant_id: "tenant_other" } }, "QUALIFIED_RUN_ADMISSION_SCOPE_MISMATCH"]
  ])("fails closed for %s", (_label, change, code) => {
    const fixture = createFixture();
    if ("qualification" in change) {
      fixture.qualification_record = {
        ...fixture.qualification_record!,
        qualifications: [{ ...fixture.qualification_record!.qualifications[0]!, ...change.qualification }]
      };
    }
    if ("source" in change) {
      fixture.qualification_record = {
        ...fixture.qualification_record!,
        source_packages: [{ ...fixture.qualification_record!.source_packages[0]!, ...change.source }]
      };
    }
    if ("dataset" in change) {
      fixture.qualification_record = {
        ...fixture.qualification_record!,
        calibration_datasets: [{ ...fixture.qualification_record!.calibration_datasets[0]!, ...change.dataset }]
      };
    }
    Object.assign(fixture.admission, "admission" in change ? change.admission : {});
    if ("model" in change) fixture.model = { ...fixture.model!, ...change.model };
    expect(() => resolveQualifiedRunAdmission(fixture)).toThrow(code);
  });

  it("blocks a pending or non-eligible requalification preview for the selected source", () => {
    const fixture = createFixture();
    fixture.qualification_record = {
      ...fixture.qualification_record!,
      requalification_previews: [
        {
          change_set: {
            affected_qualification_ids: ["qualification_demo"],
            baseline: {} as never,
            candidate: { source_package_id: "source_demo" } as never,
            change_set_digest: digest("change"),
            changed_dimensions: ["content_digest"],
            course_id: COURSE_ID,
            generated_at: NOW,
            historical_non_overwrite: true,
            tenant_id: TENANT_ID
          },
          course_id: COURSE_ID,
          created_at: NOW,
          historical_non_overwrite: true,
          known_limits: ["Pending"],
          preview_id: "preview_demo",
          reasons: ["SOURCE_CONTENT_DIGEST_CHANGED"],
          resolution: "PENDING",
          review: { status: "PENDING" },
          status: "REQUALIFICATION_REQUIRED",
          tenant_id: TENANT_ID,
          updated_at: NOW
        }
      ]
    };
    expect(() => resolveQualifiedRunAdmission(fixture)).toThrow(
      "QUALIFIED_RUN_ADMISSION_REQUALIFICATION_BLOCKED"
    );
  });

  it("does not select an implicit latest/default model or evidence entry", () => {
    const fixture = createFixture();
    fixture.admission.model_version_reference = {
      ...MODEL_VERSION_REFERENCE,
      model_version_id: "latest"
    };
    expect(() => resolveQualifiedRunAdmission(fixture)).toThrow(
      "QUALIFIED_RUN_ADMISSION_EXACT_ID_REQUIRED"
    );
  });
});
