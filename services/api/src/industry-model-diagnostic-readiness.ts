import { createHash } from "node:crypto";
import type {
  IndustryQualifiedProducerAdmissionDto,
  ModelArtifactReference,
  ModelVersionReference
} from "@simwar/shared-contracts";

export type IndustryDiagnosticClassification =
  | "WANT_EVIDENCE"
  | "CAN_EVIDENCE"
  | "REALIZED_REFERENCE"
  | "NOT_PROVEN";

export type IndustryDiagnosticReadinessStatus =
  | "READY"
  | "READY_WITH_LIMITS"
  | "BLOCKED"
  | "REBASE_REQUIRED";

export interface IndustryDiagnosticContext {
  readonly tenant_id: string;
  readonly course_id: string;
  readonly run_id: string;
  readonly team_id: string;
  readonly round_id: string;
  readonly scenario_package_id: string;
  readonly parameter_set_id: string;
}

export interface IndustryDiagnosticProducerEvidence {
  readonly producer_id: string;
  readonly current_source_path: string;
  readonly exact_symbol: string;
  readonly contract: string;
  readonly diagnostic_family: string;
  readonly evidence_identity: string;
  readonly tests: readonly string[];
  readonly freshness: "FRESH" | "STALE" | "UNKNOWN";
  readonly authority_owner: string;
  readonly candidate_classification: IndustryDiagnosticClassification;
  readonly known_limits?: readonly string[];
}

export interface IndustryModelDiagnosticReadinessInput {
  readonly context: IndustryDiagnosticContext;
  readonly model_version_reference: ModelVersionReference;
  readonly model_artifact_reference: ModelArtifactReference;
  readonly qualification: {
    readonly qualification_id: string;
    readonly qualification_digest: string;
    readonly decision: "APPROVED" | "REJECTED" | "NOT_ELIGIBLE";
    readonly review_status: "APPROVED" | "PENDING" | "REJECTED";
    readonly binding_status: "BOUND" | "UNBOUND";
  };
  readonly adoption: {
    readonly adoption_id: string;
    readonly adoption_digest: string;
  } | null;
  readonly diagnostic_evidence_digest: string;
  readonly interpretation_policy_digest: string;
  readonly producers: readonly IndustryDiagnosticProducerEvidence[];
  readonly identity_movements: readonly string[];
  readonly official_truth_write: false;
  readonly provider_calls: 0;
  readonly qualified_producer_admission?: readonly IndustryQualifiedProducerAdmissionDto[];
}

export interface IndustryDiagnosticProvabilityEntry {
  readonly producer_id: string;
  readonly diagnostic_family: string;
  readonly classification: IndustryDiagnosticClassification;
  readonly evidence_identity: string;
  readonly authority_owner: string;
  readonly source: { readonly path: string; readonly symbol: string };
  readonly freshness: IndustryDiagnosticProducerEvidence["freshness"];
  readonly known_limits?: readonly string[];
}

export interface IndustryModelDiagnosticReadiness {
  readonly readiness_status: IndustryDiagnosticReadinessStatus;
  readonly rebase_required: boolean;
  readonly bound_context: IndustryDiagnosticContext;
  readonly model_version_reference: ModelVersionReference;
  readonly model_artifact_reference: ModelArtifactReference;
  readonly qualification_id: string;
  readonly qualification_digest: string;
  readonly adoption: IndustryModelDiagnosticReadinessInput["adoption"];
  readonly diagnostic_evidence_digest: string;
  readonly interpretation_policy_digest: string;
  readonly provability: readonly IndustryDiagnosticProvabilityEntry[];
  readonly qualified_producer_admission?: readonly IndustryQualifiedProducerAdmissionDto[];
  readonly known_limits: readonly string[];
  readonly provider: "OFF";
  readonly official_truth_write: false;
  readonly readiness_digest: string;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function requireDigest(value: string, field: string): void {
  if (!/^[a-f0-9]{64}$/u.test(value)) throw new Error(`${field}_DIGEST_INVALID`);
}

function buildEntry(
  producer: IndustryDiagnosticProducerEvidence
): IndustryDiagnosticProvabilityEntry {
  if (
    producer.candidate_classification === "REALIZED_REFERENCE" &&
    producer.authority_owner !== "SIMULATION_CORE" &&
    producer.authority_owner !== "W4"
  ) {
    throw new Error("REALIZED_REFERENCE_AUTHORITY_REQUIRED");
  }
  return {
    producer_id: producer.producer_id,
    diagnostic_family: producer.diagnostic_family,
    classification: producer.candidate_classification,
    evidence_identity: producer.evidence_identity,
    authority_owner: producer.authority_owner,
    source: { path: producer.current_source_path, symbol: producer.exact_symbol },
    freshness: producer.freshness,
    ...(producer.known_limits ? { known_limits: [...producer.known_limits] } : {})
  };
}

export function buildIndustryModelDiagnosticReadiness(
  input: IndustryModelDiagnosticReadinessInput
): IndustryModelDiagnosticReadiness {
  const provability = input.producers.map(buildEntry);
  const knownLimits = new Set<string>();

  if (input.identity_movements.length > 0) {
    knownLimits.add("EXACT_IDENTITY_MOVED_REQUIRES_REBASE");
  }
  if (!input.adoption) knownLimits.add("EXACT_ADOPTION_REQUIRED");
  if (input.qualification.decision !== "APPROVED") knownLimits.add("QUALIFICATION_NOT_APPROVED");
  if (input.qualification.review_status !== "APPROVED")
    knownLimits.add("QUALIFICATION_REVIEW_NOT_APPROVED");
  if (input.qualification.binding_status !== "BOUND") knownLimits.add("QUALIFICATION_NOT_BOUND");
  if (
    input.producers.length === 0 ||
    provability.every((item) => item.classification === "NOT_PROVEN")
  ) {
    knownLimits.add("DIAGNOSTIC_PROVABILITY_NOT_ESTABLISHED");
    knownLimits.add("DIAGNOSTIC_PASS_IS_NOT_BUSINESS_TRUTH");
  }
  knownLimits.add("DIAGNOSTIC_PASS_IS_NOT_CAUSAL_PROOF");

  let readinessStatus: IndustryDiagnosticReadinessStatus = "READY";
  if (input.identity_movements.length > 0) readinessStatus = "REBASE_REQUIRED";
  else if (
    !input.adoption ||
    input.qualification.decision !== "APPROVED" ||
    input.qualification.review_status !== "APPROVED" ||
    input.qualification.binding_status !== "BOUND"
  ) {
    readinessStatus = "BLOCKED";
  } else if (knownLimits.has("DIAGNOSTIC_PROVABILITY_NOT_ESTABLISHED")) {
    readinessStatus = "READY_WITH_LIMITS";
  }

  requireDigest(input.diagnostic_evidence_digest, "DIAGNOSTIC_EVIDENCE");
  requireDigest(input.interpretation_policy_digest, "INTERPRETATION_POLICY");
  requireDigest(input.qualification.qualification_digest, "QUALIFICATION");
  if (input.adoption) requireDigest(input.adoption.adoption_digest, "ADOPTION");

  const resultWithoutDigest = {
    readiness_status: readinessStatus,
    rebase_required: readinessStatus === "REBASE_REQUIRED",
    bound_context: input.context,
    model_version_reference: input.model_version_reference,
    model_artifact_reference: input.model_artifact_reference,
    qualification_id: input.qualification.qualification_id,
    qualification_digest: input.qualification.qualification_digest,
    adoption: input.adoption,
    diagnostic_evidence_digest: input.diagnostic_evidence_digest,
    interpretation_policy_digest: input.interpretation_policy_digest,
    provability,
    ...(input.qualified_producer_admission
      ? { qualified_producer_admission: input.qualified_producer_admission }
      : {}),
    known_limits: [...knownLimits].sort(),
    provider: "OFF" as const,
    official_truth_write: false as const
  };
  return { ...resultWithoutDigest, readiness_digest: digest(resultWithoutDigest) };
}
