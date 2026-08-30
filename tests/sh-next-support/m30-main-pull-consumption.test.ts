import { describe, expect, it } from "vitest";
import {
  buildM30CourseFactorySourceEvidence,
  projectM30SourceEvidenceForRole,
  validateM30CourseFactorySourceEvidence
} from "@simwar/sh-next-support";

describe("Shanghai M30 source-backed CourseFactory evidence", () => {
  it("binds the exact M29 request and upstream pack identities", () => {
    const evidence = buildM30CourseFactorySourceEvidence();

    expect(evidence.binding_request_id).toBe("SH-M29-MAIN-PULL-BINDING-REQUEST");
    expect(evidence.source_epoch.epoch_id).toBe("SH-PUBLIC-SOURCE-EPOCH-2026-08-30");
    expect(evidence.regional_transfer.transfer_id).toBe("SH-M25-TRANSFER-SHANGHAI-HANGZHOU");
    expect(evidence.living_operations.epoch_version).toBe("epoch-b.2026-08-30");
    expect(evidence).toMatchObject({
      baseline_region: "Shanghai",
      target_region: "Hangzhou",
      source_reality_class: "PUBLIC_SOURCE_BOUND",
      rights_status: "PUBLIC_REFERENCE_ONLY",
      qualification_status: "LIMITED",
      calibration_evidence: "NOT_PROVEN",
      formal_binding_eligible: false,
      exact_binding_required: true
    });
    expect(validateM30CourseFactorySourceEvidence(evidence)).toEqual([]);
  });

  it("fails closed for digest, expiry, formal-binding, and floating-selector drift", () => {
    const source = buildM30CourseFactorySourceEvidence();

    const digestDrift = structuredClone(source);
    digestDrift.m29_pack_digest = "f".repeat(64);
    expect(validateM30CourseFactorySourceEvidence(digestDrift)).toContain("m29_pack_digest");

    const expiryDrift = structuredClone(source);
    expiryDrift.living_operations.expires_at = "2026-13-40T00:00:00.000Z";
    expect(validateM30CourseFactorySourceEvidence(expiryDrift)).toContain(
      "living_operations_expiry"
    );

    const formalDrift = structuredClone(source);
    formalDrift.formal_binding_eligible = true;
    expect(validateM30CourseFactorySourceEvidence(formalDrift)).toContain(
      "formal_binding_eligible"
    );

    const selectorDrift = structuredClone(source);
    selectorDrift.living_operations.epoch_version = "latest";
    expect(validateM30CourseFactorySourceEvidence(selectorDrift)).toContain(
      "floating_selector_present"
    );
  });

  it("projects only allowlisted student-safe fields", () => {
    const evidence = buildM30CourseFactorySourceEvidence();
    const student = projectM30SourceEvidenceForRole(evidence, "student");
    const admin = projectM30SourceEvidenceForRole(evidence, "admin");
    const enterprise = projectM30SourceEvidenceForRole(evidence, "enterprise");

    expect(student).toEqual({
      role: "student",
      target_region: "Hangzhou",
      epoch_version: "epoch-b.2026-08-30",
      qualification_status: "LIMITED",
      consumption_status: "LOOKAHEAD_READY",
      exact_binding_required: true
    });
    expect(JSON.stringify(student)).not.toContain("source_digests");
    expect(JSON.stringify(student)).not.toContain("private");
    expect(JSON.stringify(student)).not.toContain("settlement");
    expect(admin).toMatchObject({ role: "admin", m29_pack_digest: expect.any(String) });
    expect(enterprise).toEqual({
      role: "enterprise",
      target_region: "Hangzhou",
      qualification_status: "LIMITED",
      consumption_status: "LOOKAHEAD_READY",
      exact_binding_required: true
    });
  });
});
