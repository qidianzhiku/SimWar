import { describe, expect, it } from "vitest";
import type { ModelArtifactReference, ModelVersionReference } from "@simwar/shared-contracts";
import {
  reconcileQualifiedProducerEvidence,
  type QualifiedProducerEvidenceCandidate
} from "../../services/api/src/industry-model-qualified-producer-admission";

const modelVersion: ModelVersionReference = {
  model_version_id: "toy_logit_wellness_v2",
  version: "2.0.0",
  content_digest: "c".repeat(64)
};

const artifact: ModelArtifactReference = {
  artifact_id: "artifact_toy_logit_v2",
  content_digest: "e".repeat(64),
  format: "typescript-boundary",
  source_ref: "services/simulation-core/src/toy-logit-engine.ts"
};

const candidate: QualifiedProducerEvidenceCandidate = {
  producer_id: "w5-governed-demand-candidate",
  diagnostic_family: "W5 governed demand / preference candidate",
  candidate_classification: "WANT_EVIDENCE",
  evidence_identity: "w5-evidence-digest",
  authority_owner: "W5_MODEL_GOVERNANCE_PLANE",
  source: { path: "services/api/src/w5-governed-model-service.ts", symbol: "W5GovernedModelService.evaluate" },
  freshness: "FRESH",
  known_limits: ["WANT_IS_SYNTHETIC_HEURISTIC", "WANT_NOT_CALIBRATED"],
  official_truth_write: false
};

describe("reconcileQualifiedProducerEvidence", () => {
  it("admits only an exact typed model, artifact, and qualification lineage", () => {
    const result = reconcileQualifiedProducerEvidence({
      qualification: {
        qualification_id: "qualification-1",
        qualification_digest: "q".repeat(64),
        model_version_reference: modelVersion,
        model_artifact_reference: artifact
      },
      producer: {
        ...candidate,
        producer_model_version_reference: modelVersion,
        producer_model_artifact_reference: artifact,
        producer_qualification_id: "qualification-1",
        producer_qualification_digest: "q".repeat(64)
      }
    });

    expect(result.status).toBe("QUALIFICATION_COMPATIBLE");
    expect(result.producer.candidate_classification).toBe("WANT_EVIDENCE");
    expect(result.official_truth_write).toBe(false);
    expect(result.provider_calls).toBe(0);
    expect(result.admission_digest).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("keeps qualification binding consumer-owned when the producer supplies only intrinsic typed lineage", () => {
    const result = reconcileQualifiedProducerEvidence({
      qualification: {
        qualification_id: "qualification-1",
        qualification_digest: "q".repeat(64),
        model_version_reference: modelVersion,
        model_artifact_reference: artifact
      },
      producer: {
        ...candidate,
        producer_model_version_reference: modelVersion,
        producer_model_artifact_reference: artifact
      }
    });

    expect(result.status).toBe("QUALIFICATION_COMPATIBLE");
    expect(result.producer.candidate_classification).toBe("WANT_EVIDENCE");
    expect(result.official_truth_write).toBe(false);
    expect(result.provider_calls).toBe(0);
  });

  it("fails closed when a producer only carries the W5 runtime string or no typed lineage", () => {
    const result = reconcileQualifiedProducerEvidence({
      qualification: {
        qualification_id: "qualification-1",
        qualification_digest: "q".repeat(64),
        model_version_reference: modelVersion,
        model_artifact_reference: artifact
      },
      producer: candidate
    });

    expect(result.status).toBe("QUALIFICATION_NOT_PROVEN");
    expect(result.producer.candidate_classification).toBe("NOT_PROVEN");
    expect(result.known_limits).toContain("PRODUCER_MODEL_QUALIFICATION_NOT_PROVEN");
  });

  it("does not accept mismatched typed identity", () => {
    const result = reconcileQualifiedProducerEvidence({
      qualification: {
        qualification_id: "qualification-1",
        qualification_digest: "q".repeat(64),
        model_version_reference: modelVersion,
        model_artifact_reference: artifact
      },
      producer: {
        ...candidate,
        producer_model_version_reference: { ...modelVersion, version: "9.9.9" },
        producer_model_artifact_reference: artifact,
        producer_qualification_id: "qualification-1",
        producer_qualification_digest: "q".repeat(64)
      }
    });

    expect(result.status).toBe("QUALIFICATION_NOT_PROVEN");
    expect(result.producer.candidate_classification).toBe("NOT_PROVEN");
  });

  it("requires rebase when an observed producer identity moved", () => {
    const result = reconcileQualifiedProducerEvidence({
      qualification: {
        qualification_id: "qualification-1",
        qualification_digest: "q".repeat(64),
        model_version_reference: modelVersion,
        model_artifact_reference: artifact
      },
      producer: {
        ...candidate,
        producer_model_version_reference: modelVersion,
        producer_model_artifact_reference: artifact,
        producer_qualification_id: "qualification-1",
        producer_qualification_digest: "q".repeat(64),
        identity_movements: ["w5_model_version"]
      }
    });

    expect(result.status).toBe("REBASE_REQUIRED");
    expect(result.producer.candidate_classification).toBe("NOT_PROVEN");
    expect(result.known_limits).toContain("EXACT_PRODUCER_IDENTITY_MOVED_REQUIRES_REBASE");
  });
});
