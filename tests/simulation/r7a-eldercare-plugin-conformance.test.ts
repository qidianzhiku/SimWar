import { describe, expect, it } from "vitest";
import { eldercareWellnessPluginV1 } from "../../plugins/wellness/eldercare-plugin-v1";
import {
  createDefaultEldercareModelInput,
  evaluateEldercareCoreRound
} from "../../services/simulation-core/src/eldercare-core-model";

describe("R7-A eldercare wellness plugin asset", () => {
  it("exposes an approved plugin manifest without changing SettlementResult or shared schemas", () => {
    expect(eldercareWellnessPluginV1.manifest).toMatchObject({
      adapter_ref: "@simwar/simulation-core/eldercareWellnessPluginV1",
      industry: "wellness",
      manifest_version: "1.0.0",
      parameter_schema_ref: "contracts/fixtures/r7a-eldercare-core-scenario.valid.json",
      parameter_schema_version: "eldercare.parameters.v1",
      plugin_id: "plugin_wellness_eldercare_v1",
      status: "candidate"
    });
    expect(eldercareWellnessPluginV1.runtime_authority).toBe("scenario_asset_only");
    expect(eldercareWellnessPluginV1.formal_truth_write).toBe(false);
  });

  it("produces auditable traces while preserving official-result non-overwrite", () => {
    const officialResult = Object.freeze({
      replay_hash: "official-r7a-replay-hash",
      settlement_result_id: "official-result-r7a"
    });
    const input = createDefaultEldercareModelInput();
    const result = eldercareWellnessPluginV1.evaluate(input);

    expect(result).toEqual(evaluateEldercareCoreRound(input));
    expect(result.replay_writes_formal_results).toBe(false);
    expect(officialResult).toEqual({
      replay_hash: "official-r7a-replay-hash",
      settlement_result_id: "official-result-r7a"
    });
    expect(result.plugin_trace.every((trace) => trace.formula_ref.startsWith("eldercare."))).toBe(
      true
    );
    expect(JSON.stringify(result.plugin_trace)).not.toContain("state_true");
  });
});
