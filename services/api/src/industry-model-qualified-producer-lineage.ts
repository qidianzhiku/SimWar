import type { ModelArtifactReference, ModelVersionReference } from "@simwar/shared-contracts";

export interface QualifiedProducerLineageSource {
  readonly producer_model_version_reference?: ModelVersionReference;
  readonly producer_model_artifact_reference?: ModelArtifactReference;
  readonly producer_qualification_id?: string;
  readonly producer_qualification_digest?: string;
  readonly identity_movements?: readonly string[];
  /** Legacy W5 identity is observed for diagnostics only; never parsed into typed identity. */
  readonly legacy_model_version_ref?: string;
}

export type QualifiedProducerLineageProofStatus =
  | "COMPLETE"
  | "MISSING_TYPED_IDENTITY"
  | "REBASE_REQUIRED";

export interface QualifiedProducerLineageRead {
  readonly proof_status: QualifiedProducerLineageProofStatus;
  readonly model_version_reference: ModelVersionReference | null;
  readonly model_artifact_reference: ModelArtifactReference | null;
  readonly qualification_id: string | null;
  readonly qualification_digest: string | null;
  readonly identity_movements: readonly string[];
  readonly known_limits: readonly string[];
}

/**
 * Reads explicit typed lineage from a producer boundary. In particular, the
 * legacy W5 runtime string is intentionally not interpreted or mapped here.
 */
export function readQualifiedProducerLineage(source: QualifiedProducerLineageSource): QualifiedProducerLineageRead {
  const identityMovements = [...(source.identity_movements ?? [])];
  if (identityMovements.length > 0) {
    return {
      proof_status: "REBASE_REQUIRED",
      model_version_reference: source.producer_model_version_reference ?? null,
      model_artifact_reference: source.producer_model_artifact_reference ?? null,
      qualification_id: source.producer_qualification_id ?? null,
      qualification_digest: source.producer_qualification_digest ?? null,
      identity_movements: identityMovements,
      known_limits: ["EXACT_PRODUCER_LINEAGE_MOVED_REQUIRES_REBASE"]
    };
  }

  // Qualification is consumer-owned. A producer proves only its own typed
  // model/artifact lineage; the admission service compares that lineage with
  // the selected qualification and may optionally validate legacy claims.
  const missingLimits: string[] = [];
  if (!source.producer_model_version_reference) missingLimits.push("TYPED_MODEL_VERSION_REFERENCE_REQUIRED");
  if (!source.producer_model_artifact_reference) missingLimits.push("TYPED_MODEL_ARTIFACT_REFERENCE_REQUIRED");

  return {
    proof_status: missingLimits.length === 0 ? "COMPLETE" : "MISSING_TYPED_IDENTITY",
    model_version_reference: source.producer_model_version_reference ?? null,
    model_artifact_reference: source.producer_model_artifact_reference ?? null,
    qualification_id: source.producer_qualification_id ?? null,
    qualification_digest: source.producer_qualification_digest ?? null,
    identity_movements: [],
    known_limits: missingLimits
  };
}
