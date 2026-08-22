import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";

const schema = JSON.parse(
  readFileSync(resolve("contracts/schemas/model-governance-plane.v1.json"), "utf8")
);
const validFixture = JSON.parse(
  readFileSync(resolve("contracts/fixtures/model-governance-plane.valid.json"), "utf8")
);
const invalidFixture = JSON.parse(
  readFileSync(resolve("contracts/fixtures/model-governance-plane.invalid.json"), "utf8")
);

function referenceKey(reference: {
  content_digest: string;
  model_version_id: string;
  version: string;
}): string {
  return `${reference.model_version_id}@${reference.version}#${reference.content_digest}`;
}

describe("MOD-06 Model Governance Plane contract", () => {
  it("accepts one provider-off canonical plane and resolves every exact reference", () => {
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    const validate = ajv.compile(schema);

    expect(validate(validFixture), JSON.stringify(validate.errors)).toBe(true);
    expect(validFixture.authority.authority_id).toBe("SIMWAR-MODEL-GOVERNANCE-PLANE");
    expect(validFixture.authority.sole_writer).toBe("MAIN_MODEL_GOVERNANCE");
    expect(validFixture.authority.no_implicit_latest).toBe(true);
    expect(validFixture.authority.activation_policy).toBe("NOT_AUTHORIZED");
    expect(validFixture.authority.provider_calls).toBe(0);
    expect(validFixture.authority.official_truth_writer).toBe(false);
    expect(validFixture.authority.runtime_authority).toBe("JSON_INTERNAL_ONLY");

    const versions = new Map(
      validFixture.model_versions.map(
        (version: { model_version_id: string; version: string; content_digest: string }) => [
          referenceKey(version),
          version
        ]
      )
    );
    expect(versions.size).toBe(validFixture.model_versions.length);

    const versionIdentities = new Set(
      validFixture.model_versions.map(
        (version: { model_version_id: string; version: string }) =>
          `${version.model_version_id}@${version.version}`
      )
    );
    expect(versionIdentities.size).toBe(validFixture.model_versions.length);
    expect(JSON.stringify(validFixture)).not.toMatch(/\b(latest|current|default)\b/);

    const specs = new Set(
      validFixture.model_specs.map(
        (spec: { model_spec_id: string; version: string; content_digest: string }) =>
          `${spec.model_spec_id}@${spec.version}#${spec.content_digest}`
      )
    );
    for (const version of validFixture.model_versions) {
      expect(
        specs.has(
          `${version.model_spec_reference.model_spec_id}@${version.model_spec_reference.version}#${version.model_spec_reference.content_digest}`
        )
      ).toBe(true);

      if (version.supersedes) {
        expect(versions.has(referenceKey(version.supersedes))).toBe(true);
      }
    }

    for (const record of [
      ...validFixture.experiments,
      ...validFixture.calibration_runs,
      ...validFixture.approvals,
      ...validFixture.activations,
      ...validFixture.retirements
    ]) {
      expect(versions.has(referenceKey(record.model_version_reference))).toBe(true);
    }

    for (const rollback of validFixture.rollbacks) {
      expect(rollback.runtime_activation).toBe(false);
      expect(versions.has(referenceKey(rollback.from_model_version_reference))).toBe(true);
      expect(versions.has(referenceKey(rollback.to_model_version_reference))).toBe(true);
    }

    for (const version of validFixture.model_versions) {
      expect(version.no_implicit_latest).toBe(true);
      expect(version.content_digest).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("rejects floating references and truth/provider authority claims", () => {
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    const validate = ajv.compile(schema);

    expect(validate(invalidFixture)).toBe(false);
    expect(JSON.stringify(validate.errors)).toMatch(/latest|provider_calls|official_truth_writer/);
  });
});
