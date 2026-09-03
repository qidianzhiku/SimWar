import type {
  AdoptedQualifiedRunAdmissionReceipt,
  EvidenceAdoptionEpoch,
  EvidenceAdoptionReference,
  ModelQualificationModelCatalogEntry,
  ModelQualificationRecord
} from "@simwar/shared-contracts";
import {
  createEvidenceEpoch,
  emptyEvidenceAdoptionState,
  resolveFutureEvidenceAdoption
} from "./model-qualification-evidence-adoption.js";
import {
  resolveQualifiedRunAdmission,
  type QualifiedRunAdmissionInput
} from "./model-qualification-run-admission.js";

function same(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const a = left as Record<string, unknown>,
    b = right as Record<string, unknown>;
  return (
    Object.keys(a).length === Object.keys(b).length &&
    Object.keys(a).every((key) => Object.hasOwn(b, key) && same(a[key], b[key]))
  );
}

/** R1 source binding: the client cannot supply a self-certified epoch. */
export function deriveEvidenceAdoptionEpoch(
  record: ModelQualificationRecord,
  qualificationId: string,
  catalog: readonly ModelQualificationModelCatalogEntry[],
  now: string,
  historical = false
): EvidenceAdoptionEpoch {
  const fail = (code: string): never => {
    throw new Error(code);
  };
  const exact = <T>(items: readonly T[], matches: (item: T) => boolean): T => {
    const found = items.filter(matches);
    if (found.length !== 1) return fail("EVIDENCE_ADOPTION_EXACT_SOURCE_REQUIRED");
    return found[0]!;
  };
  const q = exact(record.qualifications, (item) => item.qualification_id === qualificationId);
  const source = exact(
    record.source_packages,
    (item) => item.source_package_id === q.source_package_id
  );
  const dataset = exact(
    record.calibration_datasets,
    (item) => item.calibration_dataset_id === q.calibration_dataset_id
  );
  if (
    [q, source, dataset].some(
      (item) => item.tenant_id !== record.tenant_id || item.course_id !== record.course_id
    ) ||
    dataset.source_package_id !== source.source_package_id
  )
    fail("EVIDENCE_ADOPTION_SCOPE_OR_TUPLE_MISMATCH");
  if (!historical) {
    // Retained qualification/epoch identities are the historical authority.
    // Current catalog eligibility is exclusively a future-admission predicate.
    const model = exact(
      catalog,
      (item) =>
        same(item.model_version_reference, q.model_version_reference) &&
        same(item.artifact, q.artifact)
    );
    const clock = Date.parse(now),
      expiry = source.expires_at === null ? Infinity : Date.parse(source.expires_at);
    if (
      !Number.isFinite(clock) ||
      !Number.isFinite(Date.parse(source.observed_at)) ||
      Date.parse(source.observed_at) > clock ||
      Number.isNaN(expiry) ||
      expiry <= clock ||
      source.freshness_status !== "FRESH" ||
      source.rights_status !== "VALID" ||
      source.quality.conflict_count !== 0 ||
      !Number.isFinite(source.quality.missingness_rate) ||
      source.quality.missingness_rate < 0 ||
      source.quality.missingness_rate > 0.1
    )
      fail("EVIDENCE_ADOPTION_SOURCE_NOT_ELIGIBLE");
    if (
      model.status !== "APPROVED" ||
      q.decision !== "APPROVED" ||
      q.review.status !== "APPROVED" ||
      q.binding.status !== "BOUND" ||
      q.binding.course_id !== record.course_id ||
      dataset.status !== "READY" ||
      !dataset.zero_holdout_leakage ||
      dataset.holdout_leakage_count !== 0 ||
      dataset.calibration_record_ids.some((id) => dataset.holdout_record_ids.includes(id)) ||
      q.authority_flags.official_truth_write !== false ||
      q.authority_flags.provider_calls !== 0
    )
      fail("EVIDENCE_ADOPTION_QUALIFICATION_NOT_ELIGIBLE");
    const blocking = (record.requalification_previews ?? []).some(
      (preview) =>
        (preview.change_set.affected_qualification_ids.includes(q.qualification_id) ||
          preview.change_set.candidate.source_package_id === source.source_package_id) &&
        preview.status !== "NO_CHANGE" &&
        preview.resolution !== "ACCEPTED" &&
        preview.resolution !== "REJECTED"
    );
    if (blocking) fail("EVIDENCE_ADOPTION_REQUALIFICATION_UNRESOLVED");
  }
  return createEvidenceEpoch({
    tenant_id: record.tenant_id,
    course_id: record.course_id,
    source_package_id: source.source_package_id,
    source_content_digest: source.content_digest,
    calibration_dataset_id: dataset.calibration_dataset_id,
    calibration_dataset_content_digest: dataset.content_digest,
    qualification_id: q.qualification_id,
    qualification_content_digest: q.content_digest,
    model_version_reference: q.model_version_reference,
    model_artifact_reference: q.artifact,
    source_expires_at: source.expires_at
  });
}

export function resolveAdoptedRunAdmission(
  input: QualifiedRunAdmissionInput,
  adoption: EvidenceAdoptionReference | undefined
): AdoptedQualifiedRunAdmissionReceipt {
  if (!adoption?.adoption_id || !adoption.adoption_digest)
    throw new Error("QUALIFIED_RUN_ADMISSION_ADOPTION_REQUIRED");
  const receipt = resolveQualifiedRunAdmission(input);
  const record = input.qualification_record!;
  const epoch = deriveEvidenceAdoptionEpoch(
    record,
    receipt.qualification_id,
    [input.model!],
    input.now
  );
  resolveFutureEvidenceAdoption(
    record.evidence_adoption ?? emptyEvidenceAdoptionState(record.tenant_id, record.course_id),
    {
      tenant_id: record.tenant_id,
      course_id: record.course_id,
      ...adoption,
      epoch,
      now: input.now
    }
  );
  return {
    ...receipt,
    schema_version: "qualified-run-admission.v2",
    adoption: { ...adoption },
    evidence_epoch: epoch,
    admitted_at: input.now
  };
}
