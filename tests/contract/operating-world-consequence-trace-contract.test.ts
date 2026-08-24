import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { isOperatingWorldConsequenceTrace } from "@simwar/shared-contracts";

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;

describe("Operating World consequence trace contract", () => {
  it("accepts the bounded official trace and rejects private or causal authority fields", () => {
    const schema = readJson("contracts/schemas/operating-world-consequence-trace.v1.json");
    const validate = new Ajv2020({ strict: true, validateFormats: false }).compile(schema);
    const valid = {
      schema_version: "operating-world-consequence-trace.v1",
      trace_id: "operating_world_trace_run_r3_1_team_r3",
      scope: {
        tenant_id: "tenant_r3",
        course_id: "course_r3",
        run_id: "run_r3",
        round_no: 1,
        team_id: "team_r3"
      },
      operating_world_binding_digest: "a".repeat(64),
      canonical_decision_ref: "decision_r3",
      w4_action_ref: "capital_action_r3",
      w4_replay_manifest_ref: "manifest_r3",
      settlement_result_ref: "settlement_r3",
      replay_relevant_digest: "b".repeat(64),
      publication: { status: "PUBLISHED", published_at: "2026-08-23T00:00:00.000Z" },
      allowed_effects: [
        {
          family: "SH-17",
          key: "capital_cost",
          classification: "OFFICIAL_CONSUMER_ELIGIBLE",
          input_bucket: "0.00-0.25",
          consumer: "W4_CAPITAL_ACTION_OR_NEW_PROJECT_ADMISSION",
          outcome_field: "rate_or_cost_bps",
          effect_direction: "constrains"
        }
      ],
      constraints: ["Only the existing W4 capital-action consumer may apply this effect."],
      known_limits: ["AI is not used as causal authority."],
      source_classification: "OFFICIAL_CONSUMER_ELIGIBLE",
      official_delta: "WHITELISTED_ONLY",
      writes_official_state: false,
      causal_authority: "DETERMINISTIC_SYSTEM_FACTS",
      ai_generated: false
    };

    expect(validate(valid)).toBe(true);
    expect(isOperatingWorldConsequenceTrace(valid)).toBe(true);
    expect(validate({ ...valid, causal_authority: "causal_fact" })).toBe(false);
    expect(validate({ ...valid, raw_private_payload: "forbidden" })).toBe(false);
  });
});
