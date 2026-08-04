import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import {
  isTransferEvidenceRecordCandidate,
  isTransferStudyDefinitionVersion
} from "@simwar/shared-contracts";

const root = resolve(process.cwd());
const valid = JSON.parse(
  readFileSync(resolve(root, "contracts/fixtures/d6-transfer-evidence.valid.json"), "utf8")
);
const invalid = JSON.parse(
  readFileSync(resolve(root, "contracts/fixtures/d6-transfer-evidence.invalid.json"), "utf8")
);
const privacyInvalid = JSON.parse(
  readFileSync(
    resolve(root, "contracts/fixtures/d6-transfer-evidence.privacy.invalid.json"),
    "utf8"
  )
);

function ajv() {
  const instance = new Ajv2020({ allErrors: true, strict: true });
  instance.addFormat("date-time", {
    type: "string",
    validate: (value) => !Number.isNaN(Date.parse(value))
  });
  return instance;
}

describe("D6 transfer evidence contract", () => {
  it("accepts the synthetic-only frozen design", () => {
    const validate = ajv().compile(
      JSON.parse(
        readFileSync(resolve(root, "contracts/schemas/d6-transfer-evidence.v1.json"), "utf8")
      )
    );
    expect(validate(valid)).toBe(true);
    expect(isTransferStudyDefinitionVersion(valid.study)).toBe(true);
    expect(isTransferEvidenceRecordCandidate(valid.synthetic_preview)).toBe(true);
  });

  it("rejects causal claims and inexact references", () => {
    const validate = ajv().compile(
      JSON.parse(
        readFileSync(resolve(root, "contracts/schemas/d6-transfer-evidence.v1.json"), "utf8")
      )
    );
    expect(validate(invalid)).toBe(false);
    expect(
      isTransferStudyDefinitionVersion({ ...valid.study, formal_transfer_claim_write: true })
    ).toBe(false);
    expect(
      isTransferStudyDefinitionVersion({
        ...valid.study,
        study_ref: { ...valid.study.study_ref, resource_id: "latest" }
      })
    ).toBe(false);
    expect(validate(privacyInvalid)).toBe(false);
    expect(isTransferEvidenceRecordCandidate(privacyInvalid.synthetic_preview)).toBe(false);
  });
});
