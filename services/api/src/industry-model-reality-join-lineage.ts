import { validateM30CourseFactorySourceEvidence } from "@simwar/sh-next-support";
import type {
  CourseFactorySourceEvidenceReference,
  CourseFactorySourceManifest,
  CoursePackageVersion,
  CoursePackageVersionReference,
  QualifiedRunAdmissionSnapshot
} from "@simwar/shared-contracts";

export interface IndustryModelRealityJoinLineageAdapterInput {
  readonly as_of: string;
  readonly course_package_version: CoursePackageVersion;
  readonly qualified_run_admission_snapshot: QualifiedRunAdmissionSnapshot | null | undefined;
  readonly expected_context?: {
    readonly course_id: string;
    readonly run_id: string;
    readonly tenant_id: string;
  };
}

export interface IndustryModelRealityJoinLineage {
  readonly admission_receipt: QualifiedRunAdmissionSnapshot["admission"];
  readonly course_package_reference: CoursePackageVersionReference;
  readonly evidence_epoch: QualifiedRunAdmissionSnapshot["admission"]["evidence_epoch"];
  readonly run_identity: {
    readonly course_id: string;
    readonly run_id: string;
    readonly tenant_id: string;
  };
  readonly source_evidence_reference: CourseFactorySourceEvidenceReference;
  readonly source_manifest: CourseFactorySourceManifest;
}

function fail(code: string): never {
  throw new Error(`IM_O3_LINEAGE_${code}`);
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
    .join(",")}}`;
}

function same(left: unknown, right: unknown): boolean {
  return canonical(left) === canonical(right);
}

const floatingSelectorFields = new Set([
  "tenant_id",
  "course_id",
  "run_id",
  "team_id",
  "round_id",
  "course_package_id",
  "course_blueprint_id",
  "scenario_package_id",
  "parameter_set_id",
  "model_version_id",
  "artifact_id",
  "source_package_id",
  "calibration_dataset_id",
  "qualification_id",
  "epoch_id",
  "version",
  "epoch_version",
  "content_digest",
  "source_content_digest",
  "qualification_content_digest",
  "calibration_dataset_content_digest",
  "epoch_digest",
  "source_epoch_base_sha",
  "model_version_reference",
  "model_artifact_reference",
  "course_package_reference",
  "scenario_package_reference",
  "parameter_set_reference",
  "source_evidence_reference"
]);

function hasFloatingSelector(value: unknown, fieldName?: string): boolean {
  if (typeof value === "string") {
    if (!fieldName || !floatingSelectorFields.has(fieldName)) return false;
    return /(^|[^a-z])(latest|default|current|fallback|newest|first|last|unresolved)([^a-z]|$)/iu.test(
      value
    );
  }
  if (Array.isArray(value)) return false;
  if (value !== null && typeof value === "object") {
    return Object.entries(value).some(([key, child]) => hasFloatingSelector(child, key));
  }
  return false;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function adaptIndustryModelRealityJoinLineage(
  input: IndustryModelRealityJoinLineageAdapterInput
): IndustryModelRealityJoinLineage {
  const snapshot = input.qualified_run_admission_snapshot;
  const packageVersion = input.course_package_version;
  if (!snapshot) fail("SNAPSHOT_REQUIRED");
  if (!packageVersion) fail("COURSE_PACKAGE_REQUIRED");
  if (!Number.isFinite(Date.parse(input.as_of))) fail("AS_OF_INVALID");
  if (hasFloatingSelector({ packageVersion, snapshot })) fail("FLOATING_SELECTOR");

  const admission = snapshot.admission;
  const sourceManifest = packageVersion.factory_metadata?.source_manifest;
  const sourceEvidence = packageVersion.factory_metadata?.source_evidence_reference;
  if (!sourceManifest) fail("SOURCE_MANIFEST_REQUIRED");
  if (!sourceEvidence) fail("M30_EVIDENCE_REQUIRED");
  const m30Issues = validateM30CourseFactorySourceEvidence(sourceEvidence);
  if (m30Issues.length > 0) fail("M30_EVIDENCE_INVALID");
  const asOfTime = Date.parse(input.as_of);
  const factoryRightsExpiry = Date.parse(packageVersion.factory_metadata?.rights.expires_at ?? "");
  const admissionSourceExpiry = Date.parse(admission.evidence_epoch.source_expires_at ?? "");
  if (
    !Number.isFinite(factoryRightsExpiry) ||
    !Number.isFinite(admissionSourceExpiry) ||
    factoryRightsExpiry <= asOfTime ||
    admissionSourceExpiry <= asOfTime
  ) {
    fail("GOVERNING_EXPIRY_STALE");
  }
  if (Date.parse(sourceEvidence.living_operations.expires_at) <= asOfTime) {
    fail("M30_EVIDENCE_STALE");
  }

  if (
    snapshot.tenant_id !== admission.tenant_id ||
    snapshot.course_id !== admission.course_id ||
    !snapshot.run_id.trim() ||
    admission.evidence_epoch.tenant_id !== admission.tenant_id ||
    admission.evidence_epoch.course_id !== admission.course_id
  ) {
    fail("SCOPE");
  }
  if (
    input.expected_context &&
    (input.expected_context.tenant_id !== snapshot.tenant_id ||
      input.expected_context.course_id !== snapshot.course_id ||
      input.expected_context.run_id !== snapshot.run_id)
  ) {
    fail("RUN_IDENTITY");
  }
  if (
    packageVersion.tenant_id !== admission.tenant_id ||
    (packageVersion.status !== "AVAILABLE" && packageVersion.status !== "PUBLISHED")
  ) {
    fail("PACKAGE_SCOPE");
  }
  const packageReference: CoursePackageVersionReference = {
    content_digest: packageVersion.content_digest,
    course_package_id: packageVersion.course_package_id,
    tenant_id: packageVersion.tenant_id,
    version: packageVersion.version
  };
  if (!same(packageReference, admission.course_package_reference)) fail("PACKAGE_REFERENCE");
  if (!same(packageVersion.parameter_set_reference, admission.parameter_set_reference)) {
    fail("PARAMETER_REFERENCE");
  }
  if (!same(packageVersion.scenario_package_reference, admission.scenario_package_reference)) {
    fail("SCENARIO_REFERENCE");
  }
  if (
    sourceManifest.parameter_set_reference.content_digest !==
      admission.parameter_set_reference.content_digest ||
    sourceManifest.parameter_set_reference.parameter_set_id !==
      admission.parameter_set_reference.parameter_set_id ||
    sourceManifest.parameter_set_reference.version !== admission.parameter_set_reference.version ||
    sourceManifest.scenario_package_reference.content_digest !==
      admission.scenario_package_reference.content_digest ||
    sourceManifest.scenario_package_reference.scenario_package_id !==
      admission.scenario_package_reference.scenario_package_id ||
    sourceManifest.scenario_package_reference.version !==
      admission.scenario_package_reference.version
  ) {
    fail("MANIFEST_REFERENCE");
  }
  if (sourceManifest.scenario_package_reference.tenant_id !== admission.tenant_id) {
    fail("CROSS_SCOPE");
  }
  if (!sourceManifest.model_version_reference || !sourceManifest.model_artifact_reference) {
    fail("MODEL_REFERENCE_REQUIRED");
  }
  if (
    sourceManifest.model_version_reference &&
    !same(sourceManifest.model_version_reference, admission.model_version_reference)
  ) {
    fail("MODEL_REFERENCE");
  }
  if (
    sourceManifest.model_artifact_reference &&
    !same(sourceManifest.model_artifact_reference, admission.model_artifact_reference)
  ) {
    fail("ARTIFACT_REFERENCE");
  }
  const epoch = admission.evidence_epoch;
  if (
    epoch.source_package_id !== admission.source_package_id ||
    epoch.calibration_dataset_id !== admission.calibration_dataset_id ||
    epoch.qualification_id !== admission.qualification_id ||
    epoch.qualification_content_digest !== admission.qualification_content_digest ||
    !same(epoch.model_version_reference, admission.model_version_reference) ||
    !same(epoch.model_artifact_reference, admission.model_artifact_reference)
  ) {
    fail("EVIDENCE_IDENTITY");
  }

  return deepFreeze({
    admission_receipt: structuredClone(admission),
    course_package_reference: structuredClone(packageReference),
    evidence_epoch: structuredClone(epoch),
    run_identity: {
      course_id: snapshot.course_id,
      run_id: snapshot.run_id,
      tenant_id: snapshot.tenant_id
    },
    source_evidence_reference: structuredClone(sourceEvidence),
    source_manifest: structuredClone(sourceManifest)
  });
}
