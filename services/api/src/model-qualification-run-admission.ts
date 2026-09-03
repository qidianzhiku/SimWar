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
} from "./formal-run-runtime-binding.js";

export const QUALIFIED_RUN_ADMISSION_SCHEMA_VERSION = "qualified-run-admission.v1" as const;

export interface QualifiedRunAdmissionIdentity {
  calibration_dataset_id: string;
  course_id: string;
  course_package_reference: {
    content_digest: string;
    course_package_id: string;
    tenant_id: string;
    version: string;
  };
  model_artifact_reference: ModelArtifactReference;
  model_version_reference: ModelVersionReference;
  parameter_set_reference: ParameterSetReference;
  qualification_id: string;
  scenario_package_reference: ScenarioPackageReference;
  source_package_id: string;
  tenant_id: string;
}

export interface QualifiedRunAdmissionInput {
  admission: QualifiedRunAdmissionIdentity;
  calibration_dataset: ModelQualificationCalibrationDataset | null;
  course_package: CoursePackageVersion | null;
  model: ModelQualificationModelCatalogEntry | null;
  now: string;
  parameter_set: FormalRunParameterSetAuthorityBindingRecord | null;
  qualification_record: ModelQualificationRecord | null;
  scenario_package: FormalRunScenarioPackageAuthorityBindingRecord | null;
}

export type QualifiedRunAdmissionFailureCode =
  | "QUALIFIED_RUN_ADMISSION_BINDING_REQUIRED"
  | "QUALIFIED_RUN_ADMISSION_CALIBRATION_DATASET_REQUIRED"
  | "QUALIFIED_RUN_ADMISSION_COURSE_PACKAGE_REQUIRED"
  | "QUALIFIED_RUN_ADMISSION_COURSE_PACKAGE_MISMATCH"
  | "QUALIFIED_RUN_ADMISSION_DATASET_REQUIRED"
  | "QUALIFIED_RUN_ADMISSION_DATASET_MISMATCH"
  | "QUALIFIED_RUN_ADMISSION_EXACT_ID_REQUIRED"
  | "QUALIFIED_RUN_ADMISSION_HOLDOUT_LEAKAGE"
  | "QUALIFIED_RUN_ADMISSION_MODEL_MISMATCH"
  | "QUALIFIED_RUN_ADMISSION_MODEL_REQUIRED"
  | "QUALIFIED_RUN_ADMISSION_PARAMETER_MISMATCH"
  | "QUALIFIED_RUN_ADMISSION_PARAMETER_REQUIRED"
  | "QUALIFIED_RUN_ADMISSION_QUALIFICATION_NOT_APPROVED"
  | "QUALIFIED_RUN_ADMISSION_QUALIFICATION_NOT_FOUND"
  | "QUALIFIED_RUN_ADMISSION_QUALIFICATION_REQUIRED"
  | "QUALIFIED_RUN_ADMISSION_REQUALIFICATION_BLOCKED"
  | "QUALIFIED_RUN_ADMISSION_REVIEW_REQUIRED"
  | "QUALIFIED_RUN_ADMISSION_SCENARIO_MISMATCH"
  | "QUALIFIED_RUN_ADMISSION_SCENARIO_REQUIRED"
  | "QUALIFIED_RUN_ADMISSION_SCOPE_MISMATCH"
  | "QUALIFIED_RUN_ADMISSION_SOURCE_EXPIRED"
  | "QUALIFIED_RUN_ADMISSION_SOURCE_MISMATCH"
  | "QUALIFIED_RUN_ADMISSION_SOURCE_NOT_FRESH"
  | "QUALIFIED_RUN_ADMISSION_SOURCE_REQUIRED"
  | "QUALIFIED_RUN_ADMISSION_SOURCE_RIGHTS_INVALID";

export class QualifiedRunAdmissionError extends Error {
  readonly code: QualifiedRunAdmissionFailureCode;

  constructor(code: QualifiedRunAdmissionFailureCode) {
    super(code);
    this.code = code;
    this.name = "QualifiedRunAdmissionError";
  }
}

export interface QualifiedRunAdmissionReceipt {
  calibration_dataset_id: string;
  course_id: string;
  course_package_reference: QualifiedRunAdmissionIdentity["course_package_reference"];
  model_artifact_reference: ModelArtifactReference;
  model_version_reference: ModelVersionReference;
  official_truth_write: false;
  parameter_set_reference: ParameterSetReference;
  provider: "OFF";
  qualification_content_digest: string;
  qualification_id: string;
  scenario_package_reference: ScenarioPackageReference;
  source_package_id: string;
  status: "ADMITTED";
  tenant_id: string;
  writer_effect: "NONE";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isExactIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.trim() &&
    /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(value) &&
    !/(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i.test(value)
  );
}

function isExactVersion(value: unknown): value is string {
  return isExactIdentity(value) && !/(?:^|[._:-])[xX*](?:$|[._:-])/.test(value);
}

function isIsoTimestamp(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
  ) {
    return false;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime());
}

function sameParameterReference(left: ParameterSetReference, right: ParameterSetReference): boolean {
  return (
    left.parameter_set_id === right.parameter_set_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function sameScenarioReference(
  left: ScenarioPackageReference,
  right: ScenarioPackageReference
): boolean {
  return (
    left.tenant_id === right.tenant_id &&
    left.scenario_package_id === right.scenario_package_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function sameCoursePackageReference(
  left: CoursePackageVersion,
  right: QualifiedRunAdmissionIdentity["course_package_reference"]
): boolean {
  return (
    left.tenant_id === right.tenant_id &&
    left.course_package_id === right.course_package_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function sameModelVersionReference(left: ModelVersionReference, right: ModelVersionReference): boolean {
  return (
    left.model_version_id === right.model_version_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function sameArtifactReference(left: ModelArtifactReference, right: ModelArtifactReference): boolean {
  return (
    left.artifact_id === right.artifact_id &&
    left.content_digest === right.content_digest &&
    left.format === right.format &&
    left.source_ref === right.source_ref
  );
}

function fail(code: QualifiedRunAdmissionFailureCode): never {
  throw new QualifiedRunAdmissionError(code);
}

function assertExactIdentityFields(input: QualifiedRunAdmissionIdentity): void {
  if (
    !isExactIdentity(input.tenant_id) ||
    !isExactIdentity(input.course_id) ||
    !isExactIdentity(input.course_package_reference.course_package_id) ||
    !isExactVersion(input.course_package_reference.version) ||
    !isDigest(input.course_package_reference.content_digest) ||
    input.course_package_reference.tenant_id !== input.tenant_id ||
    !isExactIdentity(input.scenario_package_reference.scenario_package_id) ||
    !isExactVersion(input.scenario_package_reference.version) ||
    !isDigest(input.scenario_package_reference.content_digest) ||
    input.scenario_package_reference.tenant_id !== input.tenant_id ||
    !isExactIdentity(input.parameter_set_reference.parameter_set_id) ||
    !isExactVersion(input.parameter_set_reference.version) ||
    !isDigest(input.parameter_set_reference.content_digest) ||
    !isExactIdentity(input.model_version_reference.model_version_id) ||
    !isExactVersion(input.model_version_reference.version) ||
    !isDigest(input.model_version_reference.content_digest) ||
    !isExactIdentity(input.model_artifact_reference.artifact_id) ||
    !isDigest(input.model_artifact_reference.content_digest) ||
    input.model_artifact_reference.format.trim().length === 0 ||
    input.model_artifact_reference.source_ref.trim().length === 0 ||
    !isExactIdentity(input.source_package_id) ||
    !isExactIdentity(input.calibration_dataset_id) ||
    !isExactIdentity(input.qualification_id)
  ) {
    fail("QUALIFIED_RUN_ADMISSION_EXACT_ID_REQUIRED");
  }
}

function isBlockingPreview(
  preview: NonNullable<ModelQualificationRecord["requalification_previews"]>[number],
  qualification: ModelQualification,
  source: ModelQualificationSourcePackage
): boolean {
  const applies =
    preview.change_set.affected_qualification_ids.includes(qualification.qualification_id) ||
    preview.change_set.candidate.source_package_id === source.source_package_id;
  if (!applies || preview.resolution === "ACCEPTED" || preview.status === "NO_CHANGE") {
    return false;
  }
  return (
    preview.status === "NOT_ELIGIBLE" ||
    preview.status === "REBASE_REQUIRED" ||
    preview.review.status !== "APPROVED"
  );
}

function assertCoursePackage(input: QualifiedRunAdmissionInput): void {
  const coursePackage = input.course_package ?? fail("QUALIFIED_RUN_ADMISSION_COURSE_PACKAGE_REQUIRED");
  if (
    !sameCoursePackageReference(coursePackage, input.admission.course_package_reference) ||
    (coursePackage.status !== "AVAILABLE" && coursePackage.status !== "PUBLISHED")
  ) {
    fail("QUALIFIED_RUN_ADMISSION_COURSE_PACKAGE_MISMATCH");
  }
  if (!sameParameterReference(coursePackage.parameter_set_reference, input.admission.parameter_set_reference)) {
    fail("QUALIFIED_RUN_ADMISSION_PARAMETER_MISMATCH");
  }
  if (!sameScenarioReference(coursePackage.scenario_package_reference, input.admission.scenario_package_reference)) {
    fail("QUALIFIED_RUN_ADMISSION_SCENARIO_MISMATCH");
  }

  const factoryMetadata = coursePackage.factory_metadata;
  const sourceManifest = isRecord(factoryMetadata) ? factoryMetadata.source_manifest : undefined;
  if (isRecord(sourceManifest)) {
    if (
      sourceManifest.model_version_reference !== undefined &&
      (!isRecord(sourceManifest.model_version_reference) ||
        !sameModelVersionReference(
          sourceManifest.model_version_reference as ModelVersionReference,
          input.admission.model_version_reference
        ))
    ) {
      fail("QUALIFIED_RUN_ADMISSION_MODEL_MISMATCH");
    }
    if (
      sourceManifest.model_artifact_reference !== undefined &&
      (!isRecord(sourceManifest.model_artifact_reference) ||
        !sameArtifactReference(
          sourceManifest.model_artifact_reference as ModelArtifactReference,
          input.admission.model_artifact_reference
        ))
    ) {
      fail("QUALIFIED_RUN_ADMISSION_MODEL_MISMATCH");
    }
  }
}

function assertAuthorityReferences(input: QualifiedRunAdmissionInput): void {
  const scenario = input.scenario_package ?? fail("QUALIFIED_RUN_ADMISSION_SCENARIO_REQUIRED");
  const parameter = input.parameter_set ?? fail("QUALIFIED_RUN_ADMISSION_PARAMETER_REQUIRED");
  if (
    scenario.status !== "APPROVED" ||
    scenario.tenant_id !== input.admission.tenant_id ||
    !sameScenarioReference(scenario.reference, input.admission.scenario_package_reference) ||
    !sameParameterReference(scenario.parameter_set_reference, input.admission.parameter_set_reference)
  ) {
    fail("QUALIFIED_RUN_ADMISSION_SCENARIO_MISMATCH");
  }
  if (
    parameter.status !== "APPROVED" ||
    parameter.tenant_id !== input.admission.tenant_id ||
    !sameParameterReference(parameter.reference, input.admission.parameter_set_reference) ||
    parameter.model_version_ref !==
      `${input.admission.model_version_reference.model_version_id}@${input.admission.model_version_reference.version}`
  ) {
    fail("QUALIFIED_RUN_ADMISSION_PARAMETER_MISMATCH");
  }
}

function assertModel(input: QualifiedRunAdmissionInput): void {
  const model = input.model ?? fail("QUALIFIED_RUN_ADMISSION_MODEL_REQUIRED");
  if (
    model.status !== "APPROVED" ||
    !sameModelVersionReference(model.model_version_reference, input.admission.model_version_reference) ||
    !sameArtifactReference(model.artifact, input.admission.model_artifact_reference)
  ) {
    fail("QUALIFIED_RUN_ADMISSION_MODEL_MISMATCH");
  }
}

function assertQualificationEvidence(input: QualifiedRunAdmissionInput): {
  dataset: ModelQualificationCalibrationDataset;
  qualification: ModelQualification;
  source: ModelQualificationSourcePackage;
} {
  const record = input.qualification_record ?? fail("QUALIFIED_RUN_ADMISSION_QUALIFICATION_REQUIRED");
  if (record.tenant_id !== input.admission.tenant_id || record.course_id !== input.admission.course_id) {
    fail("QUALIFIED_RUN_ADMISSION_SCOPE_MISMATCH");
  }
  const source = record.source_packages.find(
    (candidate) => candidate.source_package_id === input.admission.source_package_id
  );
  if (!source) fail("QUALIFIED_RUN_ADMISSION_SOURCE_REQUIRED");
  if (
    source.tenant_id !== input.admission.tenant_id ||
    source.course_id !== input.admission.course_id ||
    !isDigest(source.content_digest) ||
    !isExactVersion(source.source_version)
  ) {
    fail("QUALIFIED_RUN_ADMISSION_SOURCE_MISMATCH");
  }
  if (source.rights_status !== "VALID") fail("QUALIFIED_RUN_ADMISSION_SOURCE_RIGHTS_INVALID");
  if (source.freshness_status !== "FRESH") fail("QUALIFIED_RUN_ADMISSION_SOURCE_NOT_FRESH");
  if (source.quality.missingness_rate > 0.1 || source.quality.conflict_count > 0) {
    fail("QUALIFIED_RUN_ADMISSION_SOURCE_MISMATCH");
  }
  const nowMs = Date.parse(input.now);
  const expiresMs = source.expires_at === null ? Number.POSITIVE_INFINITY : Date.parse(source.expires_at);
  if (!Number.isFinite(nowMs) || !isIsoTimestamp(source.observed_at) || Date.parse(source.observed_at) > nowMs) {
    fail("QUALIFIED_RUN_ADMISSION_SOURCE_MISMATCH");
  }
  if (!Number.isFinite(expiresMs) || expiresMs <= nowMs) {
    fail("QUALIFIED_RUN_ADMISSION_SOURCE_EXPIRED");
  }

  const dataset = record.calibration_datasets.find(
    (candidate) => candidate.calibration_dataset_id === input.admission.calibration_dataset_id
  );
  if (!dataset || !input.calibration_dataset) fail("QUALIFIED_RUN_ADMISSION_DATASET_REQUIRED");
  if (
    dataset.tenant_id !== input.admission.tenant_id ||
    dataset.course_id !== input.admission.course_id ||
    dataset.source_package_id !== source.source_package_id ||
    dataset.status !== "READY" ||
    dataset.content_digest !== input.calibration_dataset.content_digest ||
    dataset.calibration_dataset_id !== input.calibration_dataset.calibration_dataset_id
  ) {
    fail("QUALIFIED_RUN_ADMISSION_DATASET_MISMATCH");
  }
  if (!dataset.zero_holdout_leakage || dataset.holdout_leakage_count !== 0) {
    fail("QUALIFIED_RUN_ADMISSION_HOLDOUT_LEAKAGE");
  }

  const qualification = record.qualifications.find(
    (candidate) => candidate.qualification_id === input.admission.qualification_id
  );
  if (!qualification) fail("QUALIFIED_RUN_ADMISSION_QUALIFICATION_NOT_FOUND");
  if (
    qualification.tenant_id !== input.admission.tenant_id ||
    qualification.course_id !== input.admission.course_id ||
    qualification.source_package_id !== source.source_package_id ||
    qualification.calibration_dataset_id !== dataset.calibration_dataset_id ||
    !sameModelVersionReference(qualification.model_version_reference, input.admission.model_version_reference) ||
    !sameArtifactReference(qualification.artifact, input.admission.model_artifact_reference) ||
    qualification.no_implicit_latest !== true
  ) {
    fail("QUALIFIED_RUN_ADMISSION_QUALIFICATION_NOT_FOUND");
  }
  if (qualification.decision !== "APPROVED") {
    fail("QUALIFIED_RUN_ADMISSION_QUALIFICATION_NOT_APPROVED");
  }
  if (qualification.review.status !== "APPROVED") fail("QUALIFIED_RUN_ADMISSION_REVIEW_REQUIRED");
  if (qualification.binding.status !== "BOUND" || qualification.binding.course_id !== input.admission.course_id) {
    fail("QUALIFIED_RUN_ADMISSION_BINDING_REQUIRED");
  }
  if (
    record.requalification_previews?.some((preview) => isBlockingPreview(preview, qualification, source))
  ) {
    fail("QUALIFIED_RUN_ADMISSION_REQUALIFICATION_BLOCKED");
  }
  return { dataset, qualification, source };
}

/**
 * Resolve the exact evidence chain before any Run/Round/runtime-binding write.
 * This function is intentionally pure: it reads authority records and emits a
 * deterministic receipt; it never persists a receipt, Run, Round, or truth value.
 */
export function resolveQualifiedRunAdmission(
  input: QualifiedRunAdmissionInput
): QualifiedRunAdmissionReceipt {
  if (!isIsoTimestamp(input.now)) fail("QUALIFIED_RUN_ADMISSION_SCOPE_MISMATCH");
  if (
    input.admission.course_package_reference.tenant_id !== input.admission.tenant_id ||
    input.admission.scenario_package_reference.tenant_id !== input.admission.tenant_id
  ) {
    fail("QUALIFIED_RUN_ADMISSION_SCOPE_MISMATCH");
  }
  assertExactIdentityFields(input.admission);
  assertCoursePackage(input);
  assertAuthorityReferences(input);
  assertModel(input);
  const { dataset, qualification, source } = assertQualificationEvidence(input);
  if (dataset.calibration_dataset_id !== input.admission.calibration_dataset_id) {
    fail("QUALIFIED_RUN_ADMISSION_DATASET_MISMATCH");
  }

  return {
    calibration_dataset_id: dataset.calibration_dataset_id,
    course_id: input.admission.course_id,
    course_package_reference: { ...input.admission.course_package_reference },
    model_artifact_reference: { ...input.admission.model_artifact_reference },
    model_version_reference: { ...input.admission.model_version_reference },
    official_truth_write: false,
    parameter_set_reference: { ...input.admission.parameter_set_reference },
    provider: "OFF",
    qualification_content_digest: qualification.content_digest,
    qualification_id: qualification.qualification_id,
    scenario_package_reference: { ...input.admission.scenario_package_reference },
    source_package_id: source.source_package_id,
    status: "ADMITTED",
    tenant_id: input.admission.tenant_id,
    writer_effect: "NONE"
  };
}
