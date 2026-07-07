import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  compileBeijingYanjiaoEldercareScenarioAsset,
  validateEldercareScenarioAsset
} from "../../services/simulation-core/src/eldercare-scenario-compiler";

type EldercareFixture = {
  asset_id: string;
  asset_hash: string;
  scenario_package: {
    scenario_package_id: string;
    plugin_package_ids: string[];
  };
  rounds: Array<{ round_no: number; title: string }>;
};

function loadFixture(): EldercareFixture {
  return JSON.parse(
    readFileSync("contracts/fixtures/r7a-eldercare-core-scenario.valid.json", "utf8")
  ) as EldercareFixture;
}

describe("R7-A eldercare scenario compiler", () => {
  it("compiles a deterministic six-round Beijing-Yanjiao scenario asset", () => {
    const first = compileBeijingYanjiaoEldercareScenarioAsset();
    const second = compileBeijingYanjiaoEldercareScenarioAsset();

    expect(second).toEqual(first);
    expect(first.status_boundary).toEqual({
      g0_status: "EXCEPTION",
      g0_pass: "NOT_GRANTED",
      l1_status: "NOT_READY"
    });
    expect(first.asset_id).toBe("r7a-beijing-yanjiao-eldercare-core-scenario-v1");
    expect(first.scenario_package.status).toBe("approved");
    expect(first.scenario_package.plugin_package_ids).toEqual(["plugin_wellness_eldercare_v1"]);
    expect(first.parameter_set.status).toBe("candidate");
    expect(first.rounds).toHaveLength(6);
    expect(first.regions.map((region) => region.region_id)).toEqual(["beijing", "yanjiao"]);
    expect(first.synthetic_data_policy.real_user_data).toBe(false);
    expect(first.synthetic_data_policy.real_payment_data).toBe(false);
    expect(validateEldercareScenarioAsset(first)).toEqual([]);
  });

  it("matches the committed synthetic fixture without requiring schema or OpenAPI changes", () => {
    const asset = compileBeijingYanjiaoEldercareScenarioAsset();
    const fixture = loadFixture();

    expect(fixture.asset_id).toBe(asset.asset_id);
    expect(fixture.asset_hash).toBe(asset.asset_hash);
    expect(fixture.scenario_package).toEqual(asset.scenario_package);
    expect(fixture.rounds.map((round) => round.round_no)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(JSON.stringify(fixture)).not.toContain("state_true");
    expect(JSON.stringify(fixture)).not.toContain("SettlementResult");
  });
});
