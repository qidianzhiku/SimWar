import { describe, expect, it } from "vitest";
import {
  MODEL_GOVERNANCE_FORBIDDEN_WRITERS,
  MODEL_VERSION_STATUSES,
  assertModelGovernanceWriter,
  canTransitionModelVersionStatus,
  createModelVersionReference,
  transitionModelVersionStatus,
  type ModelVersion,
  type ModelVersionStatus
} from "../../packages/shared-contracts/src/model-governance";

const digest = "a".repeat(64);

function createVersion(status: ModelVersionStatus = "APPROVED"): ModelVersion {
  return {
    artifact: {
      artifact_id: "artifact_toy_logit_v1",
      content_digest: digest,
      format: "typescript-boundary",
      source_ref: "services/simulation-core/src/toy-logit-engine.ts"
    },
    compatibility: {
      feature_mapper_version: "feature-mapper@1.0.0",
      parameter_model_families: ["toy_logit"],
      parameter_schema_versions: ["parameter-set.v1"],
      solver_version: "toy-logit-engine@1.0.0"
    },
    content_digest: digest,
    created_at: "2026-08-22T00:00:00Z",
    created_by: "model-governance-test",
    model_family: "toy_logit",
    model_spec_reference: {
      content_digest: digest,
      model_spec_id: "toy_logit_spec",
      version: "1.0.0"
    },
    model_version_id: "toy_logit_wellness_v1",
    no_implicit_latest: true,
    status,
    version: "1.0.0"
  };
}

describe("MOD-06 model governance shared contract", () => {
  it("creates a frozen exact model version reference", () => {
    const reference = createModelVersionReference({
      content_digest: digest,
      model_version_id: "toy_logit_wellness_v1",
      version: "1.0.0"
    });

    expect(reference).toEqual({
      content_digest: digest,
      model_version_id: "toy_logit_wellness_v1",
      version: "1.0.0"
    });
    expect(Object.isFrozen(reference)).toBe(true);
  });

  it("rejects floating or malformed model version references", () => {
    for (const version of ["latest", "*", "^1.0.0", "~1.0.0", "1", ""]) {
      expect(() =>
        createModelVersionReference({
          content_digest: digest,
          model_version_id: "toy_logit_wellness_v1",
          version
        })
      ).toThrow("MODEL_VERSION_REFERENCE_INVALID");
    }

    expect(() =>
      createModelVersionReference({
        content_digest: "not-a-digest",
        model_version_id: "toy_logit_wellness_v1",
        version: "1.0.0"
      })
    ).toThrow("MODEL_VERSION_REFERENCE_INVALID");
  });

  it("allows only the forward ModelVersion lifecycle", () => {
    const allowed: Array<[ModelVersionStatus, ModelVersionStatus]> = [
      ["DRAFT", "VALIDATED"],
      ["VALIDATED", "FROZEN"],
      ["FROZEN", "APPROVED"],
      ["APPROVED", "ACTIVE"],
      ["APPROVED", "RETIRED"],
      ["ACTIVE", "RETIRED"]
    ];

    for (const [current, next] of allowed) {
      expect(canTransitionModelVersionStatus(current, next)).toBe(true);
    }

    for (const current of MODEL_VERSION_STATUSES) {
      for (const next of MODEL_VERSION_STATUSES) {
        if (!allowed.some(([from, to]) => from === current && to === next)) {
          expect(canTransitionModelVersionStatus(current, next)).toBe(false);
        }
      }
    }
  });

  it("preserves approved ModelVersion content when changing lifecycle status", () => {
    const version = createVersion();
    const active = transitionModelVersionStatus(version, "ACTIVE");
    const { status: activeStatus, ...activeContent } = active;
    const { status: originalStatus, ...originalContent } = version;

    expect(activeStatus).toBe("ACTIVE");
    expect(originalStatus).toBe("APPROVED");
    expect(activeContent).toEqual(originalContent);
    expect(Object.isFrozen(active)).toBe(true);
  });

  it("rejects every non-MAIN governance writer", () => {
    for (const writer of MODEL_GOVERNANCE_FORBIDDEN_WRITERS) {
      expect(() => assertModelGovernanceWriter(writer)).toThrow(
        "MODEL_GOVERNANCE_WRITER_FORBIDDEN"
      );
    }

    expect(() => assertModelGovernanceWriter("MAIN_MODEL_GOVERNANCE")).not.toThrow();
  });
});
