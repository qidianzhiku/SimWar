import { describe, expect, it } from "vitest";
import {
  buildM27SecondCityTransferRequalificationPack,
  validateM27SecondCityTransferRequalificationPack
} from "@simwar/sh-next-support";

describe("Shanghai M27 second-city public-source transfer requalification", () => {
  it("compiles a Hangzhou public-source transfer with the shared regional schema", () => {
    const pack = buildM27SecondCityTransferRequalificationPack();
    expect(pack.state_transition).toEqual({ from: "STATE_A", to: "STATE_B" });
    expect(pack.state_b).toBe("SECOND_CITY_PUBLIC_SOURCE_TRANSFER_REQUALIFICATION_READY");
    expect(pack.second_city.public_source_coverage).toBe(true);
    expect(pack.second_city.synthetic_only).toBe(false);
    expect(pack.transfer.schema_version).toBe("regional-transfer.v1");
    expect(pack.transfer.candidate_ref.candidate_id).toMatch(/^rt_candidate_/u);
    expect(pack.transfer_summary.schema_version).toBe("regional-transfer.v1");
    expect(pack.qualification.status).toBe("LIMITED");
    expect(pack.qualification.calibration_evidence).toBe("NOT_PROVEN");
    expect(pack.pr475_absorption.integration_stage).toBe("LOOKAHEAD_READY");
    expect(validateM27SecondCityTransferRequalificationPack(pack)).toEqual([]);
  });

  it("fails closed for schema, source, rights, expiry, and qualification drift", () => {
    const pack = buildM27SecondCityTransferRequalificationPack();

    const schemaDrift = structuredClone(pack);
    schemaDrift.transfer.schema_version = "regional-transfer.v2";
    expect(validateM27SecondCityTransferRequalificationPack(schemaDrift)).toEqual(
      expect.arrayContaining(["shared_schema_mismatch"])
    );

    const sourceDrift = structuredClone(pack);
    sourceDrift.second_city.synthetic_only = true;
    expect(validateM27SecondCityTransferRequalificationPack(sourceDrift)).toEqual(
      expect.arrayContaining(["synthetic_only_second_city_forbidden"])
    );

    const lineageDrift = structuredClone(pack);
    lineageDrift.second_city.source_asset_ids = ["unrelated-public-source"];
    expect(validateM27SecondCityTransferRequalificationPack(lineageDrift)).toEqual(
      expect.arrayContaining(["second_city_lineage_mismatch"])
    );

    const rightsDrift = structuredClone(pack);
    rightsDrift.transfer_summary.rights_status = "NOT_PROVEN";
    expect(validateM27SecondCityTransferRequalificationPack(rightsDrift)).toEqual(
      expect.arrayContaining(["rights_status_invalid"])
    );

    const expiryDrift = structuredClone(pack);
    expiryDrift.transfer_summary.valid_to = "2025-01-01";
    expect(validateM27SecondCityTransferRequalificationPack(expiryDrift)).toEqual(
      expect.arrayContaining(["expiry_before_epoch_invalid"])
    );

    const qualificationDrift = structuredClone(pack) as Omit<typeof pack, "qualification"> & {
      qualification: { calibration_evidence: string };
    };
    qualificationDrift.qualification.calibration_evidence = "MODEL_CALIBRATED";
    expect(validateM27SecondCityTransferRequalificationPack(qualificationDrift)).toEqual(
      expect.arrayContaining(["calibration_claim_forbidden"])
    );

    const readyDrift = structuredClone(pack);
    readyDrift.qualification.status = "READY";
    expect(validateM27SecondCityTransferRequalificationPack(readyDrift)).toEqual(
      expect.arrayContaining(["qualification_status_invalid"])
    );
  });

  it("keeps PR #475 reuse lookahead-only and all formal writers closed", () => {
    const pack = buildM27SecondCityTransferRequalificationPack();
    expect(pack.pr475_absorption.pr_number).toBe(475);
    expect(pack.pr475_absorption.no_auto_cherry_pick).toBe(true);
    expect(pack.authority.official_truth_write).toBe(false);
    expect(pack.authority.settlement_write).toBe(false);
    expect(pack.authority.parameter_set_formal_write).toBe(false);
    expect(pack.authority.provider).toBe("OFF");
    expect(pack.authority.second_truth_writer).toBe(false);
  });
});
