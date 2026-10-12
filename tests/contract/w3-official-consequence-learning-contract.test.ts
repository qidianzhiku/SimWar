import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { isW3OfficialConsequenceRecord } from "@simwar/shared-contracts";

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;

describe("W3 official consequence and decision learning contract", () => {
  it("accepts the safe fixture and rejects private or unsupported causal fields", () => {
    const schema = readJson("contracts/schemas/w3-official-consequence-learning.v1.json");
    const valid = readJson("contracts/fixtures/w3-official-consequence-learning.valid.json");
    const invalid = readJson("contracts/fixtures/w3-official-consequence-learning.invalid.json");
    const validate = new Ajv2020({ strict: true, validateFormats: false }).compile(schema);

    expect(validate(valid)).toBe(true);
    expect(validate(invalid)).toBe(false);
    expect(isW3OfficialConsequenceRecord(valid)).toBe(true);
    expect(JSON.stringify(valid)).not.toContain("raw_private_payload");
    expect(JSON.stringify(valid)).not.toContain("causal_fact");
  });

  it("binds the six real BFF paths to the W3 envelope", () => {
    const openApi = yaml.load(
      readFileSync(resolve("contracts/openapi/p0-api.openapi.yaml"), "utf8")
    ) as { paths?: Record<string, unknown>; components?: { schemas?: Record<string, unknown> } };
    const paths = openApi.paths ?? {};
    for (const path of [
      "/api/v1/bff/student/w3/consequence",
      "/api/v1/bff/teacher/w3/consequence",
      "/api/v1/bff/teacher/w3/counterfactual",
      "/api/v1/bff/student/w3/reflection",
      "/api/v1/bff/teacher/w3/evidence-selection",
      "/api/v1/bff/teacher/w3/next-round-hypothesis"
    ]) {
      expect(paths[path]).toBeDefined();
    }
    expect(openApi.components?.schemas?.W3OfficialConsequenceEnvelope?.properties?.data?.$ref).toBe(
      "#/components/schemas/W3OfficialConsequenceResponse"
    );
    expect(openApi.components?.schemas?.OperatingWorldConsequenceTrace?.$ref).toBe(
      "../schemas/operating-world-consequence-trace.v1.json"
    );
    expect(
      openApi.components?.schemas?.W3OfficialConsequenceResponse?.properties?.record?.$ref
    ).toBe("../schemas/w3-official-consequence-learning.v1.json");
  });

  type ScoreDomainCase =
    | {
        label: string;
        kind: "value";
        score: unknown;
        runtimeExpected: boolean;
        schemaExpected: boolean;
      }
    | {
        label: string;
        kind: "missing";
        runtimeExpected: boolean;
        schemaExpected: boolean;
      };

  type ScoreDomainRecord = {
    context: Record<string, unknown>;
    official_result: Record<string, unknown>;
  };

  const scoreDomainCases: readonly ScoreDomainCase[] = [
    {
      label: "finite fractional score 24.75",
      kind: "value",
      score: 24.75,
      runtimeExpected: true,
      schemaExpected: true
    },
    {
      label: "finite fractional score 37.25",
      kind: "value",
      score: 37.25,
      runtimeExpected: true,
      schemaExpected: true
    },
    {
      label: "original integer score 0",
      kind: "value",
      score: 0,
      runtimeExpected: true,
      schemaExpected: true
    },
    {
      label: "original integer score 80",
      kind: "value",
      score: 80,
      runtimeExpected: true,
      schemaExpected: true
    },
    {
      label: "original integer score 100",
      kind: "value",
      score: 100,
      runtimeExpected: true,
      schemaExpected: true
    },
    {
      label: "NaN",
      kind: "value",
      score: Number.NaN,
      runtimeExpected: false,
      schemaExpected: false
    },
    {
      label: "+Infinity",
      kind: "value",
      score: Number.POSITIVE_INFINITY,
      runtimeExpected: false,
      schemaExpected: false
    },
    {
      label: "-Infinity",
      kind: "value",
      score: Number.NEGATIVE_INFINITY,
      runtimeExpected: false,
      schemaExpected: false
    },
    {
      label: "string score",
      kind: "value",
      score: "80",
      runtimeExpected: false,
      schemaExpected: false
    },
    {
      label: "null score",
      kind: "value",
      score: null,
      runtimeExpected: false,
      schemaExpected: false
    },
    {
      label: "undefined score",
      kind: "value",
      score: undefined,
      runtimeExpected: false,
      schemaExpected: false
    },
    {
      label: "missing score",
      kind: "missing",
      runtimeExpected: false,
      schemaExpected: false
    },
    {
      label: "boxed number object score",
      kind: "value",
      score: Object(80),
      runtimeExpected: false,
      schemaExpected: false
    },
    {
      label: "boolean score",
      kind: "value",
      score: true,
      runtimeExpected: false,
      schemaExpected: false
    }
  ];

  const cloneSafeRecordForScoreCase = (
    valid: unknown,
    scoreCase: ScoreDomainCase
  ): ScoreDomainRecord => {
    const record = JSON.parse(JSON.stringify(valid)) as ScoreDomainRecord;
    if (scoreCase.kind === "missing") {
      delete record.official_result.score;
    } else {
      record.official_result.score = scoreCase.score;
    }
    return record;
  };

  it.each(scoreDomainCases)("runtime validator score domain: $label", (scoreCase) => {
    const valid = readJson("contracts/fixtures/w3-official-consequence-learning.valid.json");
    const record = cloneSafeRecordForScoreCase(valid, scoreCase);

    expect(record.official_result.rank).toBe(1);
    expect(record.context.round_no).toBe(1);
    if (scoreCase.kind === "missing") {
      expect(Object.prototype.hasOwnProperty.call(record.official_result, "score")).toBe(false);
    } else {
      expect(record.official_result.score).toBe(scoreCase.score);
    }
    expect(isW3OfficialConsequenceRecord(record)).toBe(scoreCase.runtimeExpected);
  });

  it.each(scoreDomainCases)("Ajv2020 JSON Schema score domain: $label", (scoreCase) => {
    const schema = readJson("contracts/schemas/w3-official-consequence-learning.v1.json");
    const valid = readJson("contracts/fixtures/w3-official-consequence-learning.valid.json");
    const validate = new Ajv2020({ strict: true, validateFormats: false }).compile(schema);
    const record = cloneSafeRecordForScoreCase(valid, scoreCase);

    expect(record.official_result.rank).toBe(1);
    expect(record.context.round_no).toBe(1);
    if (scoreCase.kind === "missing") {
      expect(Object.prototype.hasOwnProperty.call(record.official_result, "score")).toBe(false);
    } else {
      expect(record.official_result.score).toBe(scoreCase.score);
    }
    expect(validate(record)).toBe(scoreCase.schemaExpected);
  });

  it.each(["rank", "round_no"])(
    "keeps %s integer-only when the public score is fractional",
    (field) => {
      const record = JSON.parse(
        JSON.stringify(readJson("contracts/fixtures/w3-official-consequence-learning.valid.json"))
      ) as ScoreDomainRecord;
      record.official_result.score = 37.25;
      if (field === "rank") record.official_result.rank = 1.5;
      else record.context.round_no = 1.5;
      const validate = new Ajv2020({ strict: true, validateFormats: false }).compile(
        readJson("contracts/schemas/w3-official-consequence-learning.v1.json")
      );
      expect(isW3OfficialConsequenceRecord(record)).toBe(false);
      expect(validate(record)).toBe(false);
    }
  );
});
