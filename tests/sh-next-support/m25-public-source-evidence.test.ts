import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import {
  buildM25PublicSourceRealityEvidenceEpochPack,
  validateM25PublicSourceRealityEvidenceEpochPack
} from "@simwar/sh-next-support";

function schemaValidator() {
  const schema = JSON.parse(
    readFileSync(resolve(process.cwd(), "contracts/schemas/sh-public-source-evidence-epoch.v1.json"), "utf8")
  );
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema);
}

describe("Shanghai M25 public-source reality evidence epoch", () => {
  it("compiles one complete Shanghai and second-city public-source lineage", () => {
    const pack = buildM25PublicSourceRealityEvidenceEpochPack();

    expect(pack.state_transition).toEqual({ from: "STATE_A", to: "STATE_B" });
    expect(pack.state_b).toBe("PUBLIC_SOURCE_REALITY_EVIDENCE_EPOCH_BOUND");
    expect(pack.source_epoch.source_receipts.length).toBeGreaterThanOrEqual(2);
    expect(pack.source_assets.some((source) => source.geography === "Shanghai")).toBe(true);
    expect(pack.source_assets.some((source) => source.geography === "Hangzhou")).toBe(true);
    expect(pack.observations.some((observation) => observation.geography === "Shanghai")).toBe(
      true
    );
    expect(pack.observations.some((observation) => observation.geography === "Hangzhou")).toBe(
      true
    );
    expect(pack.regional_transfers).toHaveLength(1);
    expect(pack.scenario_candidates).toHaveLength(2);
    expect(pack.authority.official_truth_write).toBe(false);
    expect(pack.authority.parameter_set_formal_write).toBe(false);
    expect(pack.authority.provider).toBe("OFF");
    expect(pack.features.every((feature) => feature.calibration_evidence === "NOT_PROVEN")).toBe(
      true
    );
    expect(validateM25PublicSourceRealityEvidenceEpochPack(pack)).toEqual([]);
    expect(schemaValidator()(pack)).toBe(true);
  });

  it("fails closed for digest tampering, unsupported reality, or a hidden manual number", () => {
    const pack = buildM25PublicSourceRealityEvidenceEpochPack();
    const tampered = structuredClone(pack);
    tampered.features[0]!.value = 0.91;
    expect(validateM25PublicSourceRealityEvidenceEpochPack(tampered)).toEqual(
      expect.arrayContaining(["pack_digest_mismatch", "feature_digest_mismatch"])
    );

    const unsupported = structuredClone(pack);
    unsupported.observations[0]!.evidence_reality_class = "SYNTHETIC";
    expect(validateM25PublicSourceRealityEvidenceEpochPack(unsupported)).toEqual(
      expect.arrayContaining(["unsupported_observation_reality_class"])
    );

    const schemaBoundary = structuredClone(pack) as unknown as {
      regional_transfers: Array<{ approval_status: string }>;
      scenario_candidates: Array<{ formal_runtime_admitted: boolean }>;
    };
    schemaBoundary.regional_transfers[0].approval_status = "APPROVED";
    expect(schemaValidator()(schemaBoundary)).toBe(false);
    schemaBoundary.regional_transfers[0].approval_status = "CANDIDATE_ONLY";
    schemaBoundary.scenario_candidates[0].formal_runtime_admitted = true;
    expect(schemaValidator()(schemaBoundary)).toBe(false);
  });

  it("keeps source freshness, conflicts, roles, and model handoff explicit", () => {
    const pack = buildM25PublicSourceRealityEvidenceEpochPack();

    expect(pack.source_epoch.revalidation_policy).toContain("exact source");
    expect(pack.conflict_ledger.length).toBeGreaterThan(0);
    expect(pack.conflict_ledger.some((entry) => entry.status === "OPEN")).toBe(true);
    expect(pack.role_visibility.student.forbidden_fields).toContain("raw_source_excerpt");
    expect(pack.model_handoff.every((handoff) => handoff.calibration_evidence === "NOT_PROVEN")).toBe(
      true
    );
    expect(pack.known_limits.join(" ")).toMatch(/ParameterSet|calibration|JavaScript/u);
  });
});
