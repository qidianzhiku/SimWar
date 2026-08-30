import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import {
  buildM19M24DomainDepthPack,
  projectM19M24ForRole,
  validateM19M24DomainDepthPack
} from "@simwar/sh-next-support";

function loadSchema(): object {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), "contracts/schemas/sh-domain-depth.v1.json"), "utf8")
  ) as object;
}

describe("Shanghai M19-M24 domain-depth State B contract", () => {
  it("validates six distinct State B outcomes and the full evidence chain", () => {
    const pack = buildM19M24DomainDepthPack();
    const validate = new Ajv2020({ strict: false }).compile(loadSchema());

    expect(validate(pack)).toBe(true);
    expect(validate.errors).toBeNull();
    expect(validateM19M24DomainDepthPack(pack)).toEqual([]);
    expect(pack.state_b_register.map((item) => item.macro_key)).toEqual([
      "M19",
      "M20",
      "M21",
      "M22",
      "M23",
      "M24"
    ]);
    expect(new Set(pack.state_b_register.map((item) => item.domain_state_b)).size).toBe(6);
    expect(pack.current_reality.c0_tombstone.reuse).toBe("REUSED_EXACTLY_ONCE");
    expect(pack.m19.c0_consumption.source_kind).toBe("DOMAIN_EVIDENCE");
    expect(pack.m19.domain_assets.map((item) => item.asset_type)).toEqual(
      expect.arrayContaining([
        "WORKFORCE",
        "QUALITY",
        "FINANCE",
        "POLICY",
        "PROJECT",
        "PORTFOLIO",
        "SHOCK"
      ])
    );
    expect(pack.m20.qualification.decision).toBe("NOT_ELIGIBLE");
    expect(pack.m20.calibration_evidence).toBe("NOT_PROVEN");
    expect(pack.m21.episodes).toHaveLength(5);
    expect(
      pack.m21.episodes.every(
        (item) =>
          item.situation &&
          item.tension &&
          item.decision &&
          item.consequence &&
          item.debrief.length > 0 &&
          item.what_if &&
          item.transfer
      )
    ).toBe(true);
    expect(pack.m22.target_city).toBe("Hangzhou");
    expect(pack.m22.package.activation).toBe("NOT_ACTIVATED");
    expect(pack.m23.events.map((item) => item.event_type)).toEqual([
      "REFRESH",
      "DIFF",
      "IMPACT",
      "REQUALIFICATION",
      "ROLLBACK_CANDIDATE",
      "HISTORICAL_RESOLUTION",
      "WITHDRAW"
    ]);
    expect(pack.m23.withdrawal.deleted).toBe(false);
    expect(pack.m24.operability_stage).toBe("S8_OPERABLE");
    expect(pack.m24.no_pilot_or_production).toBe(true);
  });

  it("projects role-safe views and removes sensitive numeric details from the student view", () => {
    const pack = buildM19M24DomainDepthPack();
    const student = projectM19M24ForRole(pack, "student");
    const teacher = projectM19M24ForRole(pack, "teacher");
    const sponsor = projectM19M24ForRole(pack, "enterprise_sponsor");

    expect(student.visibility).toBe("STUDENT_SAFE");
    expect(
      student.evidence.every(
        (item) =>
          item.evidence_id.startsWith("SH-M19-E-") ||
          item.evidence_id === "SH-M22-E-HANGZHOU-TRANSFER"
      )
    ).toBe(true);
    expect(student.evidence).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ evidence_id: "SH-M20-E-QUALIFICATION-DECISION" }),
        expect.objectContaining({ evidence_id: "SH-M24-E-DELIVERY-READINESS" })
      ])
    );
    expect(student.excluded_fields).toEqual(
      expect.arrayContaining(["official_truth", "settlement", "score", "rank", "raw_model_payload"])
    );
    expect(student.evidence.some((item) => item.unit === "months")).toBe(false);
    expect(teacher.capabilities).toEqual(
      expect.arrayContaining(["configure/compare candidate domains"])
    );
    expect(teacher.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ evidence_id: "SH-M19-E-CASH-RUNWAY" }),
        expect.objectContaining({ evidence_id: "SH-M22-E-HANGZHOU-TRANSFER" })
      ])
    );
    expect(teacher.evidence).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ evidence_id: "SH-M20-E-QUALIFICATION-DECISION" })
      ])
    );
    const admin = projectM19M24ForRole(pack, "admin");
    expect(admin.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ evidence_id: "SH-M20-E-QUALIFICATION-DECISION" }),
        expect.objectContaining({ evidence_id: "SH-M24-E-DELIVERY-READINESS" })
      ])
    );
    expect(sponsor.capabilities).toEqual(
      expect.arrayContaining(["select/copy public-safe package"])
    );
    expect(sponsor.excluded_fields).toEqual(
      expect.arrayContaining(["private_source_rows", "official_truth"])
    );
  });

  it("fails closed when State B, authority, digest, or activation is tampered", () => {
    const schemaValidate = new Ajv2020({ strict: false }).compile(loadSchema());

    const duplicate = buildM19M24DomainDepthPack();
    duplicate.state_b_register[1]!.domain_state_b = duplicate.state_b_register[0]!.domain_state_b;
    expect(validateM19M24DomainDepthPack(duplicate)).toContain("distinct_state_b_invalid");

    const authority = buildM19M24DomainDepthPack();
    authority.m19.domain_assets[0]!.official_truth_write = true;
    expect(validateM19M24DomainDepthPack(authority)).toContain(
      "SH-M19-ASSET-WORKFORCE:asset_authority_invalid"
    );
    expect(schemaValidate(authority)).toBe(false);

    const digest = buildM19M24DomainDepthPack();
    digest.m23.events[0]!.output_version = "tampered-version";
    expect(validateM19M24DomainDepthPack(digest)).toContain("SH-M23-EVENT-01:event_digest_invalid");

    const activation = buildM19M24DomainDepthPack();
    activation.m22.package.activation = "ACTIVATED";
    expect(schemaValidate(activation)).toBe(false);
  });
});
