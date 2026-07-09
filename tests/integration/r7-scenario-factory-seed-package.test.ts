import { existsSync, readFileSync } from "node:fs";
import {
  createR7ScenarioFactorySeedPackage,
  R7_SCENARIO_FACTORY_EXPLICIT_NON_PROOFS,
  R7_SCENARIO_FACTORY_FORBIDDEN_WRITES,
  validateR7ScenarioFactorySeedPackage
} from "@simwar/shared-contracts";
import { describe, expect, it } from "vitest";

const EXPECTED_MASTER = "33b0983859d4f01a48d298ee2f23253ffb8455fc";
const RELATION_ONLY_ISSUES = ["Relates to #111", "Relates to #114", "Relates to #115"] as const;

const docs = [
  "docs/architecture/r7-scenario-factory-mvp.md",
  "docs/quality/r7-scenario-evidence-ledger.md",
  "docs/quality/r7-scenario-license-provenance-register.md",
  "docs/quality/r7-scenario-qa-register.md",
  "docs/operations/r7-teacher-scenario-selection-boundary.md"
] as const;

const forbiddenWrites = [
  "state_true",
  "SettlementResult",
  "score",
  "rank",
  "truth_hash",
  "replay_hash",
  "manifest_hash",
  "canonical_evidence_digest"
] as const;

function readRequired(path: string): string {
  expect(existsSync(path), `${path} must exist`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("R7 scenario factory seed package", () => {
  it("defines a complete internal-only seed package without runtime activation", () => {
    const seedPackage = createR7ScenarioFactorySeedPackage();

    expect(seedPackage.evidence_kind).toBe("r7_scenario_factory_seed_package");
    expect(seedPackage.evidence_version).toBe("r7-scenario-factory-seed-package.v1");
    expect(seedPackage.source_master_sha).toBe(EXPECTED_MASTER);
    expect(seedPackage.status).toBe("SEED_PACKAGE_ONLY");
    expect(seedPackage.g0_status).toBe("EXCEPTION");
    expect(seedPackage.g0_pass).toBe("NOT_GRANTED");
    expect(seedPackage.l1_status).toBe("NOT_READY");
    expect(seedPackage.r8_g1_status).toBe("INTERNAL_ONLY_DRAFT_NOT_RELEASED");

    expect(seedPackage.source_registry.source_kinds).toEqual([
      "synthetic_internal_seed",
      "teacher_authored_draft"
    ]);
    expect(seedPackage.template_manifest.template_id).toBe("r7-scenario-factory-mvp-template-v1");
    expect(seedPackage.template_manifest.required_fields).toEqual([
      "scenario_package_id",
      "scenario_version",
      "parameter_set_id",
      "parameter_set_version",
      "plugin_package_id",
      "plugin_package_version",
      "seed",
      "teaching_objectives",
      "privacy_classification",
      "license_provenance_id",
      "qa_record_id"
    ]);
    expect(seedPackage.calibration_batch.status).toBe("DRAFT_ONLY");
    expect(seedPackage.parameter_shadow_replay_boundary.official_parameter_set_write).toBe(false);
    expect(seedPackage.parameter_shadow_replay_boundary.shadow_replay_writes_formal_results).toBe(
      false
    );
    expect(seedPackage.teacher_selection_boundary.allowed_actions).toEqual([
      "preview_seed_package",
      "select_internal_draft_for_rehearsal",
      "request_owner_review"
    ]);

    expect(validateR7ScenarioFactorySeedPackage(seedPackage)).toEqual({
      issues: [],
      ok: true
    });
  });

  it("preserves truth, Replay, AI, Plugin, Postgres, Pilot and Production boundaries", () => {
    const seedPackage = createR7ScenarioFactorySeedPackage();

    expect(seedPackage.runtime_authorization).toEqual({
      ai_runtime: "NOT_AUTHORIZED",
      durable_settlement: "NOT_PROVEN",
      pilot: "NOT_AUTHORIZED",
      plugin_runtime: "NOT_AUTHORIZED",
      postgresql_runtime: "NOT_AUTHORIZED",
      production: "NOT_AUTHORIZED",
      scenario_factory_runtime_route: "NOT_AUTHORIZED"
    });

    for (const write of forbiddenWrites) {
      expect(R7_SCENARIO_FACTORY_FORBIDDEN_WRITES).toContain(write);
      expect(seedPackage.forbidden_writes).toContain(write);
    }

    expect(R7_SCENARIO_FACTORY_EXPLICIT_NON_PROOFS).toEqual([
      "Seed package != Scenario Factory runtime",
      "Seed package != R8-G1 release",
      "Seed package != Teacher rehearsal",
      "Seed package != Pilot readiness",
      "Seed package != Production readiness",
      "Seed package != PostgreSQL runtime readiness",
      "Seed package != durable settlement proof"
    ]);
    expect(seedPackage.explicit_non_proofs).toBe(R7_SCENARIO_FACTORY_EXPLICIT_NON_PROOFS);
  });

  it("ships the architecture, evidence, license, QA and teacher selection documents", () => {
    const combined = docs.map(readRequired).join("\n");

    for (const path of docs) {
      const doc = readRequired(path);

      expect(doc).toContain(EXPECTED_MASTER);
      expect(doc).toContain("G0 Status:");
      expect(doc).toContain("EXCEPTION");
      expect(doc).toContain("G0 PASS:");
      expect(doc).toContain("NOT_GRANTED");
      expect(doc).toContain("L1 Status:");
      expect(doc).toContain("NOT_READY");
      expect(doc).toContain("R8-G1 Status:");
      expect(doc).toContain("INTERNAL_ONLY_DRAFT_NOT_RELEASED");

      for (const issue of RELATION_ONLY_ISSUES) {
        expect(doc).toContain(issue);
      }
    }

    expect(combined).toContain("Scenario source metadata");
    expect(combined).toContain("Template field dictionary");
    expect(combined).toContain("License / provenance register");
    expect(combined).toContain("QA register");
    expect(combined).toContain("ParameterSet and Shadow Replay boundary");
    expect(combined).toContain("Teacher scenario selection boundary");
    expect(combined).toContain("AI Advisory: NOT_AUTHORIZED_TO_WRITE_TRUTH");
    expect(combined).toContain("Plugin Runtime: NOT_AUTHORIZED");
    expect(combined).not.toMatch(/\b(Fixes|Closes|Resolves)\s+#(111|114|115)\b/i);
  });
});
