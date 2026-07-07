import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { validateDecisionPayload } from "../../services/api/src/simulation";

const readJson = <T>(path: string): T => JSON.parse(readFileSync(resolve(path), "utf8")) as T;

type JsonSchemaObject = {
  type?: string;
  additionalProperties?: boolean;
  required?: string[];
  properties?: Record<string, JsonSchemaObject & Record<string, unknown>>;
};

type DecisionFixture = {
  payload: Record<string, unknown>;
};

type ExpectedSchemaError = {
  instancePath?: string;
  keyword: string;
  missingProperty?: string;
};

const schema = (): JsonSchemaObject =>
  readJson<JsonSchemaObject>("contracts/schemas/decision-payload.v1.json");

const validDecisionPayloadFixture = (): Record<string, unknown> =>
  readJson<DecisionFixture>("contracts/fixtures/decision.valid.json").payload;

const clonePayload = (): Record<string, unknown> =>
  JSON.parse(JSON.stringify(validDecisionPayloadFixture())) as Record<string, unknown>;

const ajv = new Ajv2020({ allErrors: true });
const validateWithSchema = ajv.compile(schema());

const schemaErrorsFor = (payload: Record<string, unknown>): ErrorObject[] => {
  const valid = validateWithSchema(payload);
  return valid ? [] : [...(validateWithSchema.errors ?? [])];
};

const expectSchemaValid = (payload: Record<string, unknown>): void => {
  expect(schemaErrorsFor(payload)).toEqual([]);
};

const expectRuntimeValid = (payload: Record<string, unknown>): void => {
  expect(validateDecisionPayload(payload)).toEqual([]);
};

const expectValidBySchemaAndRuntime = (payload: Record<string, unknown>): void => {
  expectSchemaValid(payload);
  expectRuntimeValid(payload);
};

const expectSchemaInvalid = (
  payload: Record<string, unknown>,
  expected: ExpectedSchemaError
): void => {
  const errorShape: Record<string, unknown> = {
    keyword: expected.keyword
  };

  if (expected.instancePath !== undefined) {
    errorShape.instancePath = expected.instancePath;
  }

  if (expected.missingProperty) {
    errorShape.params = expect.objectContaining({
      missingProperty: expected.missingProperty
    });
  }

  expect(schemaErrorsFor(payload)).toEqual(
    expect.arrayContaining([expect.objectContaining(errorShape)])
  );
};

const expectRuntimeInvalid = (
  payload: Record<string, unknown>,
  expected: { field: string; reason: string }
): void => {
  expect(validateDecisionPayload(payload)).toContainEqual(expected);
};

const expectInvalidBySchemaAndRuntime = (
  payload: Record<string, unknown>,
  schemaError: ExpectedSchemaError,
  runtimeError: { field: string; reason: string }
): void => {
  expectSchemaInvalid(payload, schemaError);
  expectRuntimeInvalid(payload, runtimeError);
};

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

  it("accepts the representative decision fixture through Ajv 2020 and the active payload validator", () => {
    expectValidBySchemaAndRuntime(validDecisionPayloadFixture());
  });

  it("treats cash_buffer_target as a ratio in schema and runtime validation", () => {
    const ratioPayload = {
      ...clonePayload(),
      cash_buffer_target: 0.2
    };

    const legacyAmountPayload = {
      ...clonePayload(),
      cash_buffer_target: 120000
    };

    expectValidBySchemaAndRuntime(ratioPayload);
    expectInvalidBySchemaAndRuntime(
      legacyAmountPayload,
      { instancePath: "/cash_buffer_target", keyword: "maximum" },
      { field: "cash_buffer_target", reason: "must_be_between_0_and_0_6" }
    );
  });

  it("rejects representative invalid mutations through Ajv 2020 and runtime diagnostics", () => {
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

    expectInvalidBySchemaAndRuntime(
      missingRequired,
      { keyword: "required", missingProperty: "pricing" },
      { field: "pricing.base_price", reason: "must_be_between_6000_and_30000" }
    );
    expectInvalidBySchemaAndRuntime(
      invalidEnum,
      { instancePath: "/capacity_plan", keyword: "enum" },
      { field: "capacity_plan", reason: "must_be_contract_hold_or_expand" }
    );
    expectInvalidBySchemaAndRuntime(
      invalidNestedType,
      { instancePath: "/pricing/base_price", keyword: "type" },
      { field: "pricing.base_price", reason: "must_be_between_6000_and_30000" }
    );
    expectInvalidBySchemaAndRuntime(
      invalidRange,
      { instancePath: "/cash_buffer_target", keyword: "maximum" },
      { field: "cash_buffer_target", reason: "must_be_between_0_and_0_6" }
    );
    expectInvalidBySchemaAndRuntime(
      invalidMinLength,
      { instancePath: "/strategy_statement", keyword: "minLength" },
      { field: "strategy_statement", reason: "must_be_at_least_8_chars" }
    );
  });

  it("aligns strategy_statement schema checks with runtime trim length behavior", () => {
    const whitespaceOnly = {
      ...clonePayload(),
      strategy_statement: "        "
    };
    const trimTooShort = {
      ...clonePayload(),
      strategy_statement: "  short  "
    };
    const trimValid = {
      ...clonePayload(),
      strategy_statement: "  valid123  "
    };

    expectInvalidBySchemaAndRuntime(
      whitespaceOnly,
      { instancePath: "/strategy_statement", keyword: "pattern" },
      { field: "strategy_statement", reason: "must_be_at_least_8_chars" }
    );
    expectInvalidBySchemaAndRuntime(
      trimTooShort,
      { instancePath: "/strategy_statement", keyword: "pattern" },
      { field: "strategy_statement", reason: "must_be_at_least_8_chars" }
    );
    expectValidBySchemaAndRuntime(trimValid);
  });
});
