import type { CourseFactorySourceEvidenceReference } from "@simwar/shared-contracts";
import { stableDigest } from "./index.js";
import {
  buildM29MainPullConsumptionPack,
  validateM29MainPullConsumptionPack
} from "./m29-main-pull-consumption.js";

export type M30SourceEvidenceRole = "admin" | "teacher" | "student" | "enterprise";

const M30_SOURCE_EVIDENCE_SCHEMA_VERSION = "course-factory-source-evidence.v1" as const;

type EvidenceContent = Omit<CourseFactorySourceEvidenceReference, "evidence_digest">;

function isFloatingSelector(value: unknown): boolean {
  if (typeof value === "string") {
    return /(^|[^a-z])(latest|default|current|fallback|unresolved)([^a-z]|$)/iu.test(value.trim());
  }
  if (Array.isArray(value)) return value.some((item) => isFloatingSelector(item));
  if (value !== null && typeof value === "object") {
    return Object.values(value).some((item) => isFloatingSelector(item));
  }
  return false;
}

function isExactDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isValidSourceDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function contentDigest(value: EvidenceContent): string {
  return stableDigest(value);
}

export function buildM30CourseFactorySourceEvidence(): CourseFactorySourceEvidenceReference {
  const m29 = buildM29MainPullConsumptionPack();
  if (validateM29MainPullConsumptionPack(m29).length > 0) {
    throw new Error("M30_M29_BINDING_SOURCE_INVALID");
  }

  const content: EvidenceContent = {
    schema_version: M30_SOURCE_EVIDENCE_SCHEMA_VERSION,
    binding_request_id: m29.main_binding_request.request_id,
    source_epoch: {
      epoch_id: m29.source_pack_refs.m25_epoch.epoch_id,
      epoch_digest: m29.source_pack_refs.m25_epoch.epoch_digest,
      source_epoch_base_sha: m29.source_pack_refs.m25_epoch.source_epoch_base_sha
    },
    regional_transfer: {
      transfer_id: m29.source_pack_refs.m27_transfer.transfer_id,
      pack_digest: m29.source_pack_refs.m27_transfer.pack_digest,
      candidate_version: m29.source_pack_refs.m27_transfer.candidate_version
    },
    living_operations: {
      pack_digest: m29.source_pack_refs.m28_living_operations.pack_digest,
      epoch_id: m29.source_pack_refs.m28_living_operations.epoch_id,
      epoch_version: m29.source_pack_refs.m28_living_operations.epoch_version,
      expires_at: m29.regional_consumption.expires_at
    },
    baseline_region: m29.regional_consumption.baseline_region,
    target_region: m29.regional_consumption.target_region,
    source_reality_class: m29.regional_consumption.source_reality_class,
    rights_status: m29.regional_consumption.rights_status,
    qualification_status: m29.regional_consumption.qualification_status,
    calibration_evidence: m29.regional_consumption.calibration_evidence,
    formal_binding_eligible: m29.regional_consumption.formal_binding_eligible,
    consumption_status: m29.regional_consumption.consumption_status,
    exact_binding_required: m29.regional_consumption.exact_binding_required,
    required_rechecks: [
      ...m29.regional_consumption.required_rechecks,
      ...m29.enterprise_consumption.required_rechecks
    ],
    exact_source_refs: m29.main_binding_request.exact_refs,
    m29_pack_digest: m29.pack_digest
  };
  return { ...content, evidence_digest: contentDigest(content) };
}

export function validateM30CourseFactorySourceEvidence(
  evidence: CourseFactorySourceEvidenceReference
): string[] {
  const issues: string[] = [];
  const { evidence_digest, ...content } = evidence;
  const expected = buildM30CourseFactorySourceEvidence();
  const m29 = buildM29MainPullConsumptionPack();

  if (evidence_digest !== contentDigest(content)) issues.push("evidence_digest");
  if (evidence.schema_version !== M30_SOURCE_EVIDENCE_SCHEMA_VERSION) issues.push("schema_version");
  if (evidence.binding_request_id !== m29.main_binding_request.request_id)
    issues.push("binding_request_id");
  if (
    evidence.source_epoch.epoch_id !== expected.source_epoch.epoch_id ||
    evidence.source_epoch.epoch_digest !== expected.source_epoch.epoch_digest ||
    evidence.source_epoch.source_epoch_base_sha !== expected.source_epoch.source_epoch_base_sha
  ) {
    issues.push("source_epoch");
  }
  if (
    evidence.regional_transfer.transfer_id !== expected.regional_transfer.transfer_id ||
    evidence.regional_transfer.pack_digest !== expected.regional_transfer.pack_digest ||
    evidence.regional_transfer.candidate_version !== expected.regional_transfer.candidate_version
  ) {
    issues.push("regional_transfer");
  }
  if (
    evidence.living_operations.pack_digest !== expected.living_operations.pack_digest ||
    evidence.living_operations.epoch_id !== expected.living_operations.epoch_id ||
    evidence.living_operations.epoch_version !== expected.living_operations.epoch_version
  ) {
    issues.push("living_operations");
  }
  if (!isValidSourceDate(evidence.living_operations.expires_at))
    issues.push("living_operations_expiry");
  if (evidence.living_operations.expires_at !== expected.living_operations.expires_at)
    issues.push("living_operations_expiry_mismatch");
  if (
    evidence.baseline_region !== "Shanghai" ||
    evidence.target_region !== "Hangzhou" ||
    evidence.source_reality_class !== "PUBLIC_SOURCE_BOUND" ||
    evidence.rights_status !== "PUBLIC_REFERENCE_ONLY" ||
    evidence.qualification_status !== "LIMITED" ||
    evidence.calibration_evidence !== "NOT_PROVEN" ||
    evidence.formal_binding_eligible !== false ||
    evidence.consumption_status !== "LOOKAHEAD_READY" ||
    evidence.exact_binding_required !== true
  ) {
    if (evidence.formal_binding_eligible !== false) issues.push("formal_binding_eligible");
    else issues.push("source_evidence_boundary");
  }
  if (!isExactDigest(evidence.m29_pack_digest) || evidence.m29_pack_digest !== m29.pack_digest)
    issues.push("m29_pack_digest");
  if (stableDigest(evidence.exact_source_refs) !== stableDigest(expected.exact_source_refs))
    issues.push("exact_source_refs");
  if (isFloatingSelector(evidence)) issues.push("floating_selector_present");
  if (stableDigest(evidence.required_rechecks) !== stableDigest(expected.required_rechecks))
    issues.push("required_rechecks");
  return [...new Set(issues)];
}

export function projectM30SourceEvidenceForRole(
  evidence: CourseFactorySourceEvidenceReference,
  role: M30SourceEvidenceRole
): Record<string, unknown> {
  if (role === "admin") {
    return {
      role,
      source_epoch: structuredClone(evidence.source_epoch),
      regional_transfer: structuredClone(evidence.regional_transfer),
      living_operations: structuredClone(evidence.living_operations),
      binding_request_id: evidence.binding_request_id,
      m29_pack_digest: evidence.m29_pack_digest,
      qualification_status: evidence.qualification_status,
      rights_status: evidence.rights_status,
      calibration_evidence: evidence.calibration_evidence,
      formal_binding_eligible: evidence.formal_binding_eligible
    };
  }
  if (role === "teacher") {
    return {
      role,
      target_region: evidence.target_region,
      epoch_version: evidence.living_operations.epoch_version,
      qualification_status: evidence.qualification_status,
      consumption_status: evidence.consumption_status,
      exact_binding_required: evidence.exact_binding_required,
      known_limits: ["PUBLIC_SOURCE_BOUND", "calibration NOT_PROVEN", "qualification LIMITED"]
    };
  }
  if (role === "enterprise") {
    return {
      role,
      target_region: evidence.target_region,
      qualification_status: evidence.qualification_status,
      consumption_status: evidence.consumption_status,
      exact_binding_required: evidence.exact_binding_required
    };
  }
  return {
    role,
    target_region: evidence.target_region,
    epoch_version: evidence.living_operations.epoch_version,
    qualification_status: evidence.qualification_status,
    consumption_status: evidence.consumption_status,
    exact_binding_required: evidence.exact_binding_required
  };
}
