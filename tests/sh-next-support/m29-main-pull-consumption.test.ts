import { describe, expect, it } from "vitest";
import {
  buildM29MainPullConsumptionPack,
  projectM29ForRole,
  validateM29MainPullConsumptionPack
} from "@simwar/sh-next-support";

describe("Shanghai M29 MAIN-pull source-backed regional and enterprise consumption", () => {
  it("compiles exact M25/M27/M28 references and the bounded State A to State B request", () => {
    const pack = buildM29MainPullConsumptionPack();
    expect(pack.state_transition).toEqual({ from: "STATE_A", to: "STATE_B" });
    expect(pack.state_b).toBe(
      "SOURCE_BACKED_SHANGHAI_REGIONAL_ENTERPRISE_JOURNEY_MAINLINE_BOUND_WITH_LIMITS"
    );
    expect(pack.regional_consumption.consumption_status).toBe("LOOKAHEAD_READY");
    expect(pack.enterprise_consumption.product_consumption_status).toBe("LOOKAHEAD_READY");
    expect(pack.main_binding_request.consumer).toBe("MAIN");
    expect(validateM29MainPullConsumptionPack(pack)).toEqual([]);
  });

  it("fails closed for source, version, digest, and product-proof drift", () => {
    const pack = buildM29MainPullConsumptionPack();

    const transferDrift = structuredClone(pack);
    transferDrift.source_pack_refs.m27_transfer.transfer_id = "SH-MISMATCHED-TRANSFER";
    expect(validateM29MainPullConsumptionPack(transferDrift)).toEqual(
      expect.arrayContaining(["source_pack_binding_invalid"])
    );

    const sourceDrift = structuredClone(pack);
    sourceDrift.source_pack_refs.m27_transfer.candidate_version = "default";
    expect(validateM29MainPullConsumptionPack(sourceDrift)).toEqual(
      expect.arrayContaining(["floating_selector_present", "source_pack_binding_invalid"])
    );

    const requestDrift = structuredClone(pack);
    requestDrift.main_binding_request.consumer = "SH";
    expect(validateM29MainPullConsumptionPack(requestDrift)).toEqual(
      expect.arrayContaining([
        "main_binding_request_binding_invalid",
        "main_ownership_boundary_invalid"
      ])
    );

    const proofDrift = structuredClone(pack);
    proofDrift.product_proof.real_route_proof = "PROVEN";
    expect(validateM29MainPullConsumptionPack(proofDrift)).toEqual(
      expect.arrayContaining(["product_proof_boundary_invalid"])
    );
  });

  it("keeps student and enterprise projections free of private and official truth fields", () => {
    const pack = buildM29MainPullConsumptionPack();
    const student = projectM29ForRole(pack, "student");
    const enterprise = projectM29ForRole(pack, "enterprise");
    expect(student).toEqual({
      role: "student",
      target_region: "Hangzhou",
      epoch_version: pack.regional_consumption.epoch_version,
      qualification_status: "LIMITED",
      consumption_status: "LOOKAHEAD_READY",
      exact_binding_required: true
    });
    expect(JSON.stringify(student)).not.toContain("official_truth");
    expect(JSON.stringify(student)).not.toContain("source_pack_refs");
    expect(JSON.stringify(enterprise)).not.toContain("private_project_data");
    expect(JSON.stringify(enterprise)).not.toContain("official_truth");
  });
});
