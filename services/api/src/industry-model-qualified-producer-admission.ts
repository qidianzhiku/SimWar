import { createHash } from "node:crypto";
import type { ModelArtifactReference, ModelVersionReference } from "@simwar/shared-contracts";

export type QualifiedProducerAdmissionStatus =
  | "QUALIFICATION_COMPATIBLE"
  | "QUALIFICATION_NOT_PROVEN"
  | "REBASE_REQUIRED";

export type QualifiedProducerClassification =
  | "WANT_EVIDENCE"
  | "CAN_EVIDENCE"
  | "REALIZED_REFERENCE"
  | "NOT_PROVEN";

export interface QualifiedProducerEvidenceCandidate {
  readonly producer_id: string;
  readonly diagnostic_family: string;
  readonly candidate_classification: QualifiedProducerClassification;
  readonly evidence_identity: string;
  readonly authority_owner: string;
  readonly source: { readonly path: string; readonly symbol: string };
  readonly freshness: "FRESH" | "STALE" | "UNKNOWN";
  readonly known_limits?: readonly string[];
  readonly official_truth_write: false;
  readonly producer_model_version_reference?: ModelVersionReference;
  readonly producer_model_artifact_reference?: ModelArtifactReference;
  readonly producer_qualification_id?: string;
  readonly producer_qualification_digest?: string;
  readonly identity_movements?: readonly string[];
}

export interface QualifiedProducerAdmissionResult {
  readonly status: QualifiedProducerAdmissionStatus;
  readonly producer: QualifiedProducerEvidenceCandidate;
  readonly admission_digest: string;
  readonly known_limits: readonly string[];
  readonly official_truth_write: false;
  readonly provider_calls: 0;
}

interface QualificationIdentity {
  readonly qualification_id: string;
  readonly qualification_digest: string;
  readonly model_version_reference: ModelVersionReference;
  readonly model_artifact_reference: ModelArtifactReference;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function digest(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function sameIdentity(left: unknown, right: unknown): boolean {
  return stable(left) === stable(right);
}

function withLimits(
  producer: QualifiedProducerEvidenceCandidate,
  status: QualifiedProducerAdmissionStatus,
  limits: readonly string[]
): QualifiedProducerEvidenceCandidate {
  const knownLimits = new Set([...(producer.known_limits ?? []), ...limits]);
  return {
    ...producer,
    candidate_classification:
      status === "QUALIFICATION_COMPATIBLE" ? producer.candidate_classification : "NOT_PROVEN",
    known_limits: [...knownLimits].sort()
  };
}

/**
 * Reconciles an already-produced diagnostic candidate against the exact
 * typed ModelQualification identity. This is a pure admission decision: it
 * never writes qualification, adoption, settlement, or formal truth.
 */
export function reconcileQualifiedProducerEvidence(input: {
  readonly qualification: QualificationIdentity;
  readonly producer: QualifiedProducerEvidenceCandidate;
}): QualifiedProducerAdmissionResult {
  const { producer, qualification } = input;
  const movements = producer.identity_movements ?? [];
  const movementLimits = movements.length > 0
    ? ["EXACT_PRODUCER_IDENTITY_MOVED_REQUIRES_REBASE", ...movements.map((movement) => `IDENTITY_MOVED:${movement}`)]
    : [];

  let status: QualifiedProducerAdmissionStatus;
  let limits: string[] = [];
  if (movements.length > 0) {
    status = "REBASE_REQUIRED";
    limits = movementLimits;
  } else {
    const missing: string[] = [];
    if (!producer.producer_model_version_reference) missing.push("TYPED_PRODUCER_MODEL_VERSION_REFERENCE_REQUIRED");
    if (!producer.producer_model_artifact_reference) missing.push("TYPED_PRODUCER_MODEL_ARTIFACT_REFERENCE_REQUIRED");
    // Qualification identity is consumer-owned. A producer proves its own
    // typed model/artifact lineage; it must not self-assert membership in the
    // selected qualification. Optional producer qualification claims remain
    // checked when present, so a conflicting claim cannot be ignored.
    const qualificationClaimMatches =
      (!producer.producer_qualification_id ||
        producer.producer_qualification_id === qualification.qualification_id) &&
      (!producer.producer_qualification_digest ||
        producer.producer_qualification_digest === qualification.qualification_digest);

    const compatible = missing.length === 0
      && qualificationClaimMatches
      && sameIdentity(producer.producer_model_version_reference, qualification.model_version_reference)
      && sameIdentity(producer.producer_model_artifact_reference, qualification.model_artifact_reference);

    if (compatible) {
      status = "QUALIFICATION_COMPATIBLE";
    } else {
      status = "QUALIFICATION_NOT_PROVEN";
      limits = [
        ...missing,
        ...(producer.producer_qualification_id && producer.producer_qualification_id !== qualification.qualification_id
          ? ["PRODUCER_QUALIFICATION_ID_MISMATCH"]
          : []),
        ...(producer.producer_qualification_digest && producer.producer_qualification_digest !== qualification.qualification_digest
          ? ["PRODUCER_QUALIFICATION_DIGEST_MISMATCH"]
          : []),
        ...(producer.producer_model_version_reference && !sameIdentity(producer.producer_model_version_reference, qualification.model_version_reference)
          ? ["PRODUCER_MODEL_VERSION_REFERENCE_MISMATCH"]
          : []),
        ...(producer.producer_model_artifact_reference && !sameIdentity(producer.producer_model_artifact_reference, qualification.model_artifact_reference)
          ? ["PRODUCER_MODEL_ARTIFACT_REFERENCE_MISMATCH"]
          : []),
        "PRODUCER_MODEL_QUALIFICATION_NOT_PROVEN"
      ];
    }
  }

  const reconciledProducer = withLimits(producer, status, limits);
  const admissionDigest = digest({
    status,
    qualification,
    producer: reconciledProducer,
    official_truth_write: false,
    provider_calls: 0
  });
  return {
    status,
    producer: reconciledProducer,
    admission_digest: admissionDigest,
    known_limits: [...new Set([...(reconciledProducer.known_limits ?? []), ...limits])].sort(),
    official_truth_write: false,
    provider_calls: 0
  };
}
