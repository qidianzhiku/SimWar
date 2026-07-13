import { describe, expect, it } from "vitest";
import {
  KNOWN_LIMITS_CATALOG,
  KNOWN_LIMITS_POLICY_VERSION,
  getKnownLimitsProjection
} from "@simwar/shared-contracts";

const commonSemanticIds = ["KL-01", "KL-02", "KL-03", "KL-04", "KL-05", "KL-06", "KL-07"];

describe("role-safe Known Limits product disclosure", () => {
  it("keeps one versioned canonical catalog with all Phase 4 semantics", () => {
    expect(KNOWN_LIMITS_POLICY_VERSION).toBe("phase4-known-limits.v1");
    expect(KNOWN_LIMITS_CATALOG.map((item) => item.semantic_id)).toEqual([
      ...commonSemanticIds,
      "KL-08"
    ]);
    expect(new Set(KNOWN_LIMITS_CATALOG.map((item) => item.semantic_id)).size).toBe(8);
  });

  it.each(["teacher", "student", "tenant_admin", "platform_admin"] as const)(
    "projects the common limits and a role-specific boundary for %s",
    (role) => {
      const projection = getKnownLimitsProjection(role);

      expect(projection.policy_version).toBe(KNOWN_LIMITS_POLICY_VERSION);
      expect(projection.actor_role).toBe(role);
      expect(projection.items.map((item) => item.semantic_id)).toEqual([
        ...commonSemanticIds,
        "KL-08"
      ]);
      expect(projection.allowed_actions).toEqual([]);
      expect(projection.mutation_capability).toBe("NONE");
      expect(projection.explicit_non_proofs).toContain(
        "This disclosure does not grant L1 readiness."
      );
    }
  );

  it("keeps protected implementation and cross-scope markers out of the Student projection", () => {
    const studentProjection = JSON.stringify(getKnownLimitsProjection("student"));

    for (const marker of [
      "state_true",
      "SettlementResult",
      "canonical_evidence_digest",
      "decision_batch_hash",
      "json_runtime_source_digest",
      "private replay",
      "other team",
      "other tenant",
      "ParameterSet"
    ]) {
      expect(studentProjection).not.toContain(marker);
    }
  });

  it("does not expose commands, endpoints, or mutable callbacks in any projection", () => {
    for (const role of ["teacher", "student", "tenant_admin", "platform_admin"] as const) {
      const projection = getKnownLimitsProjection(role);
      const serialized = JSON.stringify(projection);

      expect(serialized).not.toMatch(/POST |PUT |PATCH |DELETE /);
      expect(serialized).not.toContain("/api/");
      expect(Object.values(projection).some((value) => typeof value === "function")).toBe(false);
    }
  });
});
