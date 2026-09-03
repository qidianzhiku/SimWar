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
  FormalRunBindingAuthorityPorts,
  FormalRunParameterSetAuthorityBindingRecord,
  FormalRunScenarioPackageAuthorityBindingRecord
} from "../../../services/api/src/formal-run-runtime-binding";
import type { QualifiedRunAdmissionInput } from "../../../services/api/src/model-qualification-run-admission";

export const ADMISSION_FIXTURE_SCOPE = {
  tenant_id: "tenant_demo",
  course_id: "course_demo"
} as const;

const digest = (seed: string): string => `${seed}${"0".repeat(64)}`.slice(0, 64);

export const ADMISSION_FIXTURE_REFERENCES = {
  course_package: {
    content_digest: digest("course-package"),
    course_package_id: "course_package_demo",
    tenant_id: ADMISSION_FIXTURE_SCOPE.tenant_id,
    version: "1.0.0"
  },
  scenario: {
    content_digest: digest("scenario"),
    scenario_package_id: "scenario_demo",
    tenant_id: ADMISSION_FIXTURE_SCOPE.tenant_id,
    version: "1.0.0"
  } satisfies ScenarioPackageReference,
  parameter: {
    content_digest: digest("parameter"),
    parameter_set_id: "parameter_demo",
    version: "1.0.0"
  } satisfies ParameterSetReference,
  model_version: {
    content_digest: digest("model-version"),
    model_version_id: "model_demo",
    version: "2.0.0"
  } satisfies ModelVersionReference,
  model_artifact: {
    artifact_id: "artifact_demo",
    content_digest: digest("model-artifact"),
    format: "typescript-boundary",
    source_ref: "services/simulation-core/src/toy-logit-engine.ts"
  } satisfies ModelArtifactReference
} as const;

export function createQualifiedRunAdmissionFixture(): QualifiedRunAdmissionInput {
  const refs = ADMISSION_FIXTURE_REFERENCES;
  const source: ModelQualificationSourcePackage = {
    content_digest: digest("source"),
    course_id: ADMISSION_FIXTURE_SCOPE.course_id,
    evidence_refs: ["fixture:source"],
    expires_at: "2026-12-31T00:00:00.000Z",
    feature_schema_digest: digest("feature-schema"),
    freshness_status: "FRESH",
    observed_at: "2026-09-01T00:00:00.000Z",
    quality: { conflict_count: 0, missingness_rate: 0, record_count: 4 },
    rights_status: "VALID",
    source_package_id: "source_demo",
    source_ref: "fixture://source-demo",
    source_version: "1.0.0",
    tenant_id: ADMISSION_FIXTURE_SCOPE.tenant_id,
    title: "Exact source"
  };
  const dataset: ModelQualificationCalibrationDataset = {
    calibration_dataset_id: "dataset_demo",
    calibration_record_ids: ["calibration-1"],
    content_digest: digest("dataset"),
    course_id: ADMISSION_FIXTURE_SCOPE.course_id,
    created_at: "2026-09-01T00:00:00.000Z",
    holdout_leakage_count: 0,
    holdout_record_ids: ["holdout-1"],
    record_count: 1,
    source_package_id: source.source_package_id,
    status: "READY",
    tenant_id: ADMISSION_FIXTURE_SCOPE.tenant_id,
    zero_holdout_leakage: true
  };
  const model: ModelQualificationModelCatalogEntry = {
    artifact: refs.model_artifact,
    model_family: "toy_logit",
    model_version_reference: refs.model_version,
    status: "APPROVED"
  };
  const qualification: ModelQualification = {
    artifact: model.artifact,
    authority_flags: { official_truth_write: false, provider_calls: 0 },
    binding: {
      bound_at: "2026-09-02T00:00:00.000Z",
      bound_by: "teacher_demo",
      course_id: ADMISSION_FIXTURE_SCOPE.course_id,
      status: "BOUND"
    },
    calibration_dataset_id: dataset.calibration_dataset_id,
    content_digest: digest("qualification"),
    course_id: ADMISSION_FIXTURE_SCOPE.course_id,
    created_at: "2026-09-02T00:00:00.000Z",
    decision: "APPROVED",
    deterministic_seed: 42,
    diagnostics: {
      baseline_error: 0.05,
      convergence_status: "CONVERGED",
      differential_error: 0.02,
      drift_score: 0.05,
      ood_rate: 0.02,
      sensitivity_max_delta: 0.05
    },
    known_limits: ["Candidate governance evidence only."],
    model_version_reference: model.model_version_reference,
    no_implicit_latest: true,
    qualification_id: "qualification_demo",
    reasons: ["Exact fixture."],
    review: {
      decision_note: "Reviewed exact fixture.",
      reviewed_at: "2026-09-02T00:00:00.000Z",
      reviewed_by: "teacher_demo",
      status: "APPROVED"
    },
    source_package_id: source.source_package_id,
    tenant_id: ADMISSION_FIXTURE_SCOPE.tenant_id,
    updated_at: "2026-09-02T00:00:00.000Z"
  };
  const scenarioPackage = {
    artifact_policy: { retention: "IMMUTABLE" as const },
    compatibility_metadata: {},
    content: { runtime_scenario_package: { name: "Demo", plugin_package_ids: [] } },
    content_digest: refs.scenario.content_digest,
    metadata: {},
    parameter_set_reference: refs.parameter,
    plugin_dependencies: [],
    reference: refs.scenario,
    scenario_package_id: refs.scenario.scenario_package_id,
    schema_version: "scenario-package.v1",
    status: "APPROVED" as const,
    tenant_id: ADMISSION_FIXTURE_SCOPE.tenant_id,
    version: refs.scenario.version
  } as FormalRunScenarioPackageAuthorityBindingRecord;
  const parameterSet = {
    compatibility_metadata: {},
    content_digest: refs.parameter.content_digest,
    model_version_ref: `${refs.model_version.model_version_id}@${refs.model_version.version}`,
    parameter_values: {
      runtime_parameter_set: {
        base_capacity: 100,
        base_market_size: 200,
        fixed_cost: 10,
        model_family: "toy_logit",
        unit_cost: 2
      }
    },
    parameter_set_id: refs.parameter.parameter_set_id,
    reference: refs.parameter,
    schema_version: "parameter-set.v1",
    status: "APPROVED" as const,
    tenant_id: ADMISSION_FIXTURE_SCOPE.tenant_id,
    version: refs.parameter.version
  } as FormalRunParameterSetAuthorityBindingRecord;
  const coursePackage = {
    ...refs.course_package,
    course_blueprint_reference: {
      content_digest: digest("blueprint"),
      course_blueprint_id: "blueprint_demo",
      tenant_id: ADMISSION_FIXTURE_SCOPE.tenant_id,
      version: "1.0.0"
    },
    description: "Exact package",
    parameter_set_reference: refs.parameter,
    scenario_package_reference: refs.scenario,
    schema_version: "course-package-version.v1",
    status: "PUBLISHED" as const,
    title: "Demo package",
    created_at: "2026-09-01T00:00:00.000Z",
    created_by: "teacher_demo"
  } as unknown as CoursePackageVersion;
  const qualificationRecord: ModelQualificationRecord = {
    calibration_datasets: [dataset],
    course_id: ADMISSION_FIXTURE_SCOPE.course_id,
    qualifications: [qualification],
    requalification_previews: [],
    source_packages: [source],
    tenant_id: ADMISSION_FIXTURE_SCOPE.tenant_id
  };

  return {
    admission: {
      calibration_dataset_id: dataset.calibration_dataset_id,
      course_id: ADMISSION_FIXTURE_SCOPE.course_id,
      course_package_reference: refs.course_package,
      model_artifact_reference: refs.model_artifact,
      model_version_reference: refs.model_version,
      parameter_set_reference: refs.parameter,
      qualification_id: qualification.qualification_id,
      scenario_package_reference: refs.scenario,
      source_package_id: source.source_package_id,
      tenant_id: ADMISSION_FIXTURE_SCOPE.tenant_id
    },
    calibration_dataset: dataset,
    course_package: coursePackage,
    model,
    now: "2026-09-03T12:00:00.000Z",
    parameter_set: parameterSet,
    qualification_record: qualificationRecord,
    scenario_package: scenarioPackage
  };
}

export function createFormalRunAuthorityFixture(): FormalRunBindingAuthorityPorts {
  const fixture = createQualifiedRunAdmissionFixture();
  return {
    parameterSets: {
      assertBindable: async () => undefined,
      getByReference: async () => fixture.parameter_set
    },
    plugins: {
      getByReference: async () => null,
      resolveAvailableForNewBinding: async () => null
    },
    scenarios: {
      assertBindable: async () => undefined,
      getByReference: async () => fixture.scenario_package
    }
  };
}
