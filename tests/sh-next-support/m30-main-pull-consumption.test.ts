import { describe, expect, it } from "vitest";
import {
  buildM30CourseFactorySourceEvidence,
  stableDigest,
  projectM30SourceEvidenceForRole,
  validateM30CourseFactorySourceEvidence
} from "@simwar/sh-next-support";

describe("Shanghai M30 source-backed CourseFactory evidence", () => {
  it("keeps fresh evidence graphs independent across caller mutation", () => {
    const first = buildM30CourseFactorySourceEvidence();
    const original = structuredClone(first);
    const second = buildM30CourseFactorySourceEvidence();
    expect(second).toEqual(original);
    expect(second).not.toBe(first);
    expect(second.source_epoch).not.toBe(first.source_epoch);
    expect(second.exact_source_refs).not.toBe(first.exact_source_refs);
    first.source_epoch.epoch_id = "caller-mutated-epoch";
    (first.exact_source_refs as string[]).length = 0;
    expect(buildM30CourseFactorySourceEvidence()).toEqual(original);
    expect(validateM30CourseFactorySourceEvidence(first)).toContain("source_epoch");
  });

  it.each([
    ["source epoch", "source_epoch"],
    ["request binding", "binding_request_id"],
    ["pack digest", "m29_pack_digest"],
    ["exact references", "exact_source_refs"],
    ["canonical but wrong expiry", "living_operations_expiry_mismatch"]
  ])("rejects freshly rehashed %s drift rather than relying only on a digest mismatch", (_name, issue) => {
    const evidence = buildM30CourseFactorySourceEvidence();
    if (issue === "source_epoch") evidence.source_epoch.epoch_id = "different-source-epoch";
    if (issue === "binding_request_id") Object.assign(evidence, { binding_request_id: "different-request" });
    if (issue === "m29_pack_digest") evidence.m29_pack_digest = "f".repeat(64);
    if (issue === "exact_source_refs") evidence.exact_source_refs = [];
    if (issue === "living_operations_expiry_mismatch") evidence.living_operations.expires_at = "2027-01-01";
    const { evidence_digest, ...content } = evidence;
    expect(evidence_digest).toMatch(/^[a-f0-9]{64}$/);
    evidence.evidence_digest = stableDigest(content);
    const frozen = structuredClone(evidence);
    expect(validateM30CourseFactorySourceEvidence(evidence)).toContain(issue);
    expect(evidence).toEqual(frozen);
  });

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
