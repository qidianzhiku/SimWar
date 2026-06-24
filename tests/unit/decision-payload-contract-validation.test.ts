import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateDecisionPayload } from "../../services/api/src/simulation";

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(resolve(path), "utf8")) as T;

type JsonSchemaObject = {
  type?: string;
  additionalProperties?: boolean;
  required?: string[];
  properties?: Record<string, JsonSchemaObject & Record<string, unknown>>;
};

type DecisionFixture = {
  payload: Record<string, unknown>;
};

const schema = (): JsonSchemaObject =>
  readJson<JsonSchemaObject>("contracts/schemas/decision-payload.v1.json");

const validDecisionPayloadFixture = (): Record<string, unknown> =>
  readJson<DecisionFixture>("contracts/fixtures/decision.valid.json").payload;

const clonePayload = (): Record<string, unknown> =>
  JSON.parse(JSON.stringify(validDecisionPayloadFixture())) as Record<string, unknown>;

describe("decision payload schema and fixture validation", () => {
  it("loads the selected decision payload schema with executable constraints", () => {
    const document = schema();

    expect(document).toMatchObject({
      type: "object",
      additionalProperties: false
    });
    expect(document.required).toEqual([
      "pricing",
      "marketing_budget",
      "service_quality_budget",
      "capacity_plan",
      "cash_buffer_target",
      "strategy_statement"
    ]);
    expect(document.properties?.cash_buffer_target).toMatchObject({
      type: "number",
      minimum: 0,
      maximum: 0.6
    });
  });

  it("accepts the representative decision fixture through the active payload validator", () => {
    expect(validateDecisionPayload(validDecisionPayloadFixture())).toEqual([]);
  });

  it("rejects representative invalid mutations with field-level diagnostics", () => {
    const missingRequired = clonePayload();
    delete missingRequired.pricing;

    const invalidEnum = {
      ...clonePayload(),
      capacity_plan: "outsource"
    };

    const invalidNestedType = {
      ...clonePayload(),
      pricing: { base_price: "15000" }
    };

    const invalidRange = {
      ...clonePayload(),
      cash_buffer_target: 0.9
    };

    const invalidMinLength = {
      ...clonePayload(),
      strategy_statement: "short"
    };

    expect(validateDecisionPayload(missingRequired)).toContainEqual({
      field: "pricing.base_price",
      reason: "must_be_between_6000_and_30000"
    });
    expect(validateDecisionPayload(invalidEnum)).toContainEqual({
      field: "capacity_plan",
      reason: "must_be_contract_hold_or_expand"
    });
    expect(validateDecisionPayload(invalidNestedType)).toContainEqual({
      field: "pricing.base_price",
      reason: "must_be_between_6000_and_30000"
    });
    expect(validateDecisionPayload(invalidRange)).toContainEqual({
      field: "cash_buffer_target",
      reason: "must_be_between_0_and_0_6"
    });
    expect(validateDecisionPayload(invalidMinLength)).toContainEqual({
      field: "strategy_statement",
      reason: "must_be_at_least_8_chars"
    });
  });
});
