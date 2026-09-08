import { describe, expect, it } from "vitest";
import {
  createDefaultEldercareModelInput,
  evaluateW5CoreRealization
} from "../../services/simulation-core/src";

describe("O7 Simulation Core realized intrinsic lineage", () => {
  it("emits deterministic Core-owned typed model and artifact identity", () => {
    const first = evaluateW5CoreRealization(createDefaultEldercareModelInput());
    const second = evaluateW5CoreRealization(createDefaultEldercareModelInput());

    expect(first.producer_intrinsic_lineage).toEqual(second.producer_intrinsic_lineage);
    expect(first.producer_intrinsic_lineage.model_version_reference).toEqual({
      model_version_id: "eldercare_core_model_v1",
      version: "1.0.0",
      content_digest: expect.stringMatching(/^[a-f0-9]{64}$/u)
    });
    expect(first.producer_intrinsic_lineage.model_artifact_reference).toEqual({
      artifact_id: "eldercare_core_model_v1_artifact",
      content_digest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      format: "typescript-simulation-core",
      source_ref: "services/simulation-core/src/eldercare-core-model.ts"
    });
    expect(first.producer_intrinsic_lineage.model_version_reference.model_version_id).not.toContain("w5");
    expect(first.producer_intrinsic_lineage.intrinsic_lineage_digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.producer_intrinsic_lineage.runtime_binding_digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.authority).toBe("SIMULATION_CORE");
    expect(first.writes_formal_result).toBe(false);
  });

  it("does not copy the governed-demand umbrella identity into Core lineage", () => {
    const result = evaluateW5CoreRealization();

    expect(result.producer_intrinsic_lineage.model_version_reference.model_version_id).not.toBe(
      "eldercare_w5_governed_v1@1.1.0"
    );
    expect(result.producer_intrinsic_lineage.model_artifact_reference.source_ref).toContain(
      "eldercare-core-model.ts"
    );
  });

  it("binds runtime lineage to the exact Core invocation while retaining stable intrinsic identity", () => {
    const firstInput = createDefaultEldercareModelInput();
    const secondInput = { ...firstInput, seed: firstInput.seed + 1 };
    const first = evaluateW5CoreRealization(firstInput);
    const second = evaluateW5CoreRealization(secondInput);

    expect(first.producer_intrinsic_lineage.intrinsic_lineage_digest).toBe(
      second.producer_intrinsic_lineage.intrinsic_lineage_digest
    );
    expect(first.producer_intrinsic_lineage.runtime_binding_digest).not.toBe(
      second.producer_intrinsic_lineage.runtime_binding_digest
    );
  });
});
