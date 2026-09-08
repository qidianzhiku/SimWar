import { describe, expect, it } from "vitest";
import type { ModelArtifactReference, ModelVersionReference } from "@simwar/shared-contracts";
import { readQualifiedProducerLineage } from "../../services/api/src/industry-model-qualified-producer-lineage";

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

describe("readQualifiedProducerLineage", () => {
  it("proves typed producer lineage without requiring a producer-owned qualification claim", () => {
    const result = readQualifiedProducerLineage({
      producer_model_version_reference: modelVersion,
      producer_model_artifact_reference: artifact
    });

    expect(result.proof_status).toBe("COMPLETE");
    expect(result.model_version_reference).toEqual(modelVersion);
    expect(result.model_artifact_reference).toEqual(artifact);
    expect(result.qualification_id).toBeNull();
    expect(result.qualification_digest).toBeNull();
  });

  it("does not infer typed identity from a legacy runtime model-version string", () => {
    const result = readQualifiedProducerLineage({
      legacy_model_version_ref: "eldercare_w5_governed_v1@1.1.0"
    });

    expect(result.proof_status).toBe("MISSING_TYPED_IDENTITY");
    expect(result.model_version_reference).toBeNull();
    expect(result.model_artifact_reference).toBeNull();
    expect(result.known_limits).toContain("TYPED_MODEL_VERSION_REFERENCE_REQUIRED");
  });

  it("requires every typed identity and reports observed movement separately", () => {
    const result = readQualifiedProducerLineage({
      producer_model_version_reference: modelVersion,
      producer_model_artifact_reference: artifact,
      producer_qualification_id: "qualification-1",
      producer_qualification_digest: "q".repeat(64),
      identity_movements: ["producer_artifact"]
    });

    expect(result.proof_status).toBe("REBASE_REQUIRED");
    expect(result.identity_movements).toEqual(["producer_artifact"]);
  });

  it("does not treat a partial typed mapping as compatible", () => {
    const result = readQualifiedProducerLineage({
      producer_model_version_reference: modelVersion,
      producer_qualification_id: "qualification-1",
      producer_qualification_digest: "q".repeat(64)
    });

    expect(result.proof_status).toBe("MISSING_TYPED_IDENTITY");
    expect(result.known_limits).toContain("TYPED_MODEL_ARTIFACT_REFERENCE_REQUIRED");
  });
});
