import { describe, expect, it } from "vitest";
import {
  KNOWN_LIMITS_CATALOG,
  KNOWN_LIMITS_POLICY_VERSION,
  getKnownLimitsProjection
} from "@simwar/shared-contracts";

const commonSemanticIds = [
  "JSON_INTERNAL_ONLY",
  "SYNTHETIC_ONLY",
  "LOOPBACK_ONLY",
  "POSTGRESQL_NOT_ACTIVE",
  "DURABLE_SETTLEMENT_NOT_PROVEN",
  "DURABLE_RECOVERY_NOT_PROVEN",
  "ABORT_IS_NOT_ROLLBACK",
  "RESET_IS_NOT_RECOVERY",
  "CLEANUP_IS_NOT_PURGE",
  "REPLAY_MATCHED_IS_NOT_BACKUP_OR_RESTORE",
  "AUTOMATED_VALIDATION_IS_NOT_HUMAN_VALIDATION",
  "NO_PILOT_OR_PRODUCTION_AUTHORIZATION"
] as const;

const teacherAdminSemanticIds = [
  "ISSUE_111_OPEN",
  "ISSUE_114_OPEN",
  "ISSUE_115_OPEN",
  "HUMAN_VALIDATION_WAIVED_BY_OWNER",
  "AI_ADVISORY_ONLY",
  "SIMULATION_CORE_IS_FORMAL_TRUTH_AUTHORITY"
] as const;

describe("role-safe Known Limits product disclosure", () => {
  it("keeps one role-scoped runtime catalog with every current internal-only disclosure", () => {
    expect(KNOWN_LIMITS_POLICY_VERSION).toBe("phase7-known-limits-runtime.v1");
    expect(KNOWN_LIMITS_CATALOG.map((item) => item.semantic_id)).toEqual([
      ...commonSemanticIds,
      ...teacherAdminSemanticIds
    ]);
    expect(new Set(KNOWN_LIMITS_CATALOG.map((item) => item.semantic_id)).size).toBe(18);
  });

  it.each(["teacher", "student", "tenant_admin", "platform_admin"] as const)(
    "projects only the role-safe runtime disclosures for %s",
    (role) => {
      const projection = getKnownLimitsProjection(role);

      expect(projection.policy_version).toBe(KNOWN_LIMITS_POLICY_VERSION);
      expect(projection.actor_role).toBe(role);
      expect(projection.items.map((item) => item.semantic_id)).toEqual(
        role === "student" ? commonSemanticIds : [...commonSemanticIds, ...teacherAdminSemanticIds]
      );
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
