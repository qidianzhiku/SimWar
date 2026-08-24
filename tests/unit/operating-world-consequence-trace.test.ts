import { describe, expect, it } from "vitest";
import { isOperatingWorldConsequenceTrace } from "@simwar/shared-contracts";
import {
  createOperatingWorldConsequenceTrace,
  projectOperatingWorldConsequenceTrace,
  resolveOperatingWorldBindingDigest
} from "../../services/api/src/operating-world-consequence-trace.js";

const bindingDigest = "a".repeat(64);
const replayDigest = "b".repeat(64);

function exactSettlementRef() {
  return {
    content_digest: replayDigest,
    discriminator: "exact_ref" as const,
    resource_id: "settlement_r3",
    resource_type: "settlement_result" as const,
    tenant_id: "tenant_r3",
    version: "1.0.0"
  };
}

function officialInput() {
  return {
    scope: {
      course_id: "course_r3",
      round_no: 1,
      run_id: "run_r3",
      team_id: "team_r3",
      tenant_id: "tenant_r3"
    },
    operating_world_binding_digest: bindingDigest,
    canonical_decision_ref: "decision_r3",
    settlement_result_ref: exactSettlementRef(),
    replay_relevant_digest: replayDigest,
    publication: {
      published_at: "2026-08-23T00:00:00.000Z",
      status: "PUBLISHED" as const
    },
    source_classification: "OFFICIAL_CONSUMER_ELIGIBLE" as const,
    w4_action: {
      capital_action_id: "capital_action_r3",
      cost_source: `operating-world:${bindingDigest}`,
      rate_or_cost_bps: 1800
    },
    w4_replay_manifest: {
      manifest_id: "manifest_r3",
      operating_world_binding_digest: bindingDigest
    }
  };
}

describe("Operating World consequence trace", () => {
  it("projects the current SH-17 capital input as one bounded official effect", () => {
    const trace = createOperatingWorldConsequenceTrace(officialInput());

    expect(trace).toMatchObject({
      operating_world_binding_digest: bindingDigest,
      replay_relevant_digest: replayDigest,
      source_classification: "OFFICIAL_CONSUMER_ELIGIBLE",
      official_delta: "WHITELISTED_ONLY",
      writes_official_state: false,
      causal_authority: "DETERMINISTIC_SYSTEM_FACTS",
      ai_generated: false,
      allowed_effects: [
        {
          family: "SH-17",
          key: "capital_cost",
          classification: "OFFICIAL_CONSUMER_ELIGIBLE",
          consumer: "W4_CAPITAL_ACTION_OR_NEW_PROJECT_ADMISSION",
          outcome_field: "rate_or_cost_bps",
          input_bucket: "0.00-0.25",
          effect_direction: "constrains"
        }
      ]
    });
    expect(trace?.w4_action_ref).toBe("capital_action_r3");
    expect(trace?.w4_replay_manifest_ref).toBe("manifest_r3");
  });

  it("returns a zero-official-delta trace for non-official classifications", () => {
    const trace = createOperatingWorldConsequenceTrace({
      ...officialInput(),
      source_classification: "SHADOW_ONLY",
      w4_action: undefined,
      w4_replay_manifest: undefined
    });

    expect(trace).toMatchObject({
      source_classification: "SHADOW_ONLY",
      official_delta: "NONE",
      allowed_effects: [],
      writes_official_state: false
    });
  });

  it("fails closed when the W4 manifest and action do not carry the same exact digest", () => {
    expect(() =>
      createOperatingWorldConsequenceTrace({
        ...officialInput(),
        w4_replay_manifest: {
          manifest_id: "manifest_r3",
          operating_world_binding_digest: "c".repeat(64)
        }
      })
    ).toThrow("operating_world_binding_digest_mismatch");
  });

  it("keeps student projection free of W4 private identifiers", () => {
    const trace = createOperatingWorldConsequenceTrace(officialInput());
    const student = projectOperatingWorldConsequenceTrace(trace!, "student");

    expect(student).not.toHaveProperty("w4_action_ref");
    expect(student).not.toHaveProperty("w4_replay_manifest_ref");
    expect(student).toMatchObject({
      operating_world_binding_digest: bindingDigest,
      official_delta: "WHITELISTED_ONLY",
      writes_official_state: false
    });
  });

  it("is deterministic for the same exact input and rejects malformed binding sources", () => {
    const first = createOperatingWorldConsequenceTrace(officialInput());
    const second = createOperatingWorldConsequenceTrace(officialInput());
    expect(second).toEqual(first);
    expect(resolveOperatingWorldBindingDigest(`operating-world:${bindingDigest}`)).toBe(
      bindingDigest
    );
    expect(resolveOperatingWorldBindingDigest("operating-world:private-source")).toBeUndefined();
    expect(resolveOperatingWorldBindingDigest("teacher-input:0.2")).toBeUndefined();
  });

  it("validates the role-safe trace shape and rejects forbidden fields", () => {
    const trace = createOperatingWorldConsequenceTrace(officialInput());
    expect(isOperatingWorldConsequenceTrace(trace)).toBe(true);
    expect(isOperatingWorldConsequenceTrace({ ...trace, raw_private_payload: "forbidden" })).toBe(
      false
    );
  });
});
