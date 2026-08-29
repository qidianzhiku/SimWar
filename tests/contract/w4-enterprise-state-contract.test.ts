import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;

describe("W4 Enterprise State contract", () => {
  it("accepts official outcome lineage and rejects historical re-entry/private truth", () => {
    const validate = new Ajv2020({ strict: true, validateFormats: false }).compile(
      readJson("contracts/schemas/w4-enterprise-state.v1.json")
    );
    const valid = readJson("contracts/fixtures/w4-enterprise-state.valid.json");
    const invalid = readJson("contracts/fixtures/w4-enterprise-state.invalid.json");
    expect(validate(valid)).toBe(true);
    expect(validate(invalid)).toBe(false);
    expect(JSON.stringify(valid)).not.toContain("state_true");
    expect(JSON.stringify(valid)).toContain("parent_state_ref");

    const policySeams = (
      valid as {
        policy_seams: Array<{
          kind: string;
          may_write_enterprise_state: boolean;
          may_write_official_outcome: boolean;
        }>;
      }
    ).policy_seams;
    expect(policySeams.map((seam) => seam.kind)).toEqual([
      "merger_acquisition",
      "asset_backed_securitization",
      "initial_public_offering",
      "project_sale",
      "project_closure"
    ]);
    expect(policySeams.every((seam) => !seam.may_write_enterprise_state)).toBe(true);
    expect(policySeams.every((seam) => !seam.may_write_official_outcome)).toBe(true);
  });

  it("freezes matched-arena and non-writing counterfactual contract boundaries", () => {
    const validate = new Ajv2020({ strict: true, validateFormats: false }).compile(
      readJson("contracts/schemas/w4-counterfactual.v1.json")
    );
    const stateRef = {
      tenant_id: "tenant_demo",
      course_id: "course_demo",
      run_id: "run_w4",
      team_id: "team_alpha",
      round_id: "round_1",
      enterprise_state_id: "state_1",
      version: 1,
      state_digest: "a".repeat(64)
    };
    const valid = {
      counterfactual_id: "counterfactual_1",
      source_outcome_id: "outcome_1",
      source_state_ref: stateRef,
      decision_ids: ["decision_2"],
      decision_payload_bindings: [
        { decision_id: "decision_2", decision_payload_digest: "b".repeat(64) }
      ],
      scenario_package_id: "scenario_1",
      parameter_set_id: "parameter_1",
      engine_id: "engine_1",
      plugin_ids: ["plugin_1"],
      seed: 7,
      horizon_rounds: 1,
      capital_actions: [],
      rounds: [
        {
          round_no: 2,
          opening_state_ref: stateRef,
          closing_state_ref: { ...stateRef, round_id: "counterfactual_round_2" },
          opening_state: {},
          closing_state: {},
          opening_digest: "a".repeat(64),
          closing_digest: "c".repeat(64),
          changed_paths: ["cash"]
        }
      ],
      official_decision_writes: false,
      official_settlement_writes: false,
      official_state_writes: false,
      apply_to_next_round: false,
      replay_writes_formal_results: false,
      known_limits: ["non-official"]
    };
    expect(validate(valid)).toBe(true);
    expect(validate({ ...valid, official_state_writes: true })).toBe(false);

    const openapi = readFileSync(resolve("contracts/openapi/p0-api.openapi.yaml"), "utf8");
    expect(openapi).toContain("/api/v1/bff/teacher/w4/runs/{runId}/matched-arena:");
    expect(openapi).toContain("/api/v1/bff/{surface}/w4/runs/{runId}/counterfactual:");
    expect(openapi).toContain("#/components/schemas/W4CounterfactualEnvelope");
    expect(openapi).toContain("#/components/schemas/W4SettlementEnvelope");
    expect(openapi).toContain("W4ReplayInputManifest:");
    expect(openapi).toContain(
      'operating_world_binding_digest: { type: string, pattern: "^[a-f0-9]{64}$" }'
    );
  });
});
