import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;

describe("O4 cross-round dynamics contract", () => {
  it("accepts the bounded valid fixture and rejects official writes", () => {
    const schema = readJson("contracts/schemas/o4-cross-round-dynamics.v1.json");
    const valid = readJson("contracts/fixtures/o4-cross-round-dynamics.valid.json");
    const invalid = readJson("contracts/fixtures/o4-cross-round-dynamics.invalid.json");
    const validate = new Ajv2020({ strict: true, validateFormats: false }).compile(schema);

    expect(validate(valid)).toBe(true);
    expect(validate(invalid)).toBe(false);
    expect(valid).toMatchObject({
      schema_version: "o4-cross-round-dynamics.v1",
      candidate: {
        horizon_rounds: 3,
        status: "PROVEN",
        source_team_count: 2
      },
      authority: {
        official_truth_write: false,
        settlement_write: false,
        replay_write: false,
        provider_calls: 0
      }
    });
  });

  it("does not admit private truth fields in the public contract", () => {
    const serialized = readFileSync(
      resolve("contracts/fixtures/o4-cross-round-dynamics.valid.json"),
      "utf8"
    );
    for (const forbidden of [
      "state_true",
      "replay_hash",
      "decision_batch_hash",
      "canonical_decision_payload",
      "official_settlement_write"
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
