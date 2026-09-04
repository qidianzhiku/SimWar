import type {
  EvidenceAdoptionEpoch,
  EvidenceAdoptionReference
} from "./model-qualification-evidence-adoption.js";
import type { ValidationEnvironmentLaunchAdmissionReceipt } from "./validation-environment-launch.js";

/** Versioned governance receipt; excluded from the formal runtime binding. */
export interface AdoptedQualifiedRunAdmissionReceipt extends ValidationEnvironmentLaunchAdmissionReceipt {
  readonly schema_version: "qualified-run-admission.v2";
  readonly adoption: EvidenceAdoptionReference;
  readonly evidence_epoch: EvidenceAdoptionEpoch;
  readonly admitted_at: string;
}

export interface QualifiedRunAdmissionSnapshot {
  readonly snapshot_schema_version: "qualified-run-admission-snapshot.v1";
  readonly tenant_id: string;
  readonly course_id: string;
  readonly run_id: string;
  readonly admission: AdoptedQualifiedRunAdmissionReceipt;
  readonly snapshot_digest: string;
}
