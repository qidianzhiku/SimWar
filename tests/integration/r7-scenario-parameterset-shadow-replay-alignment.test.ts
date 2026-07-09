import { existsSync, readFileSync } from "node:fs";
import {
  createR7ScenarioFactorySeedPackage,
  createR7ScenarioParameterShadowReplayAlignmentPackage,
  R7_SCENARIO_ALIGNMENT_EXPLICIT_NON_PROOFS,
  validateR7ScenarioParameterShadowReplayAlignmentPackage
} from "@simwar/shared-contracts";
import { describe, expect, it } from "vitest";

const EXPECTED_MASTER = "2038c8f0ebaa762461cd1140565426e37a268b2c";
const RELATION_ONLY_ISSUES = ["Relates to #111", "Relates to #114", "Relates to #115"] as const;

const docs = [
  "docs/architecture/r7-scenario-parameterset-shadow-replay-alignment.md",
  "docs/quality/r7-scenario-compatibility-matrix.md",
  "docs/quality/r7-scenario-evidence-ledger.md",
  "docs/quality/r7-scenario-calibration-register.md",
  "docs/operations/r7-teacher-scenario-selection-boundary.md"
] as const;

const forbiddenBoundaryTerms = [
  "state_true",
  "SettlementResult",
  "score",
  "rank",
  "replay_hash",
  "manifest_hash",
  "canonical_evidence_digest",
  "official_parameter_set",
  "official_replay_result"
] as const;

function readRequired(path: string): string {
  expect(existsSync(path), `${path} must exist`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("R7 Scenario ParameterSet and Shadow Replay alignment", () => {
  it("creates a non-writing alignment package from the merged seed package", () => {
    const seedPackage = createR7ScenarioFactorySeedPackage();
    const alignmentPackage = createR7ScenarioParameterShadowReplayAlignmentPackage(seedPackage);

    expect(alignmentPackage.evidence_kind).toBe("r7_scenario_parameterset_shadow_replay_alignment");
    expect(alignmentPackage.evidence_version).toBe(
      "r7-scenario-parameterset-shadow-replay-alignment.v1"
    );
    expect(alignmentPackage.source_master_sha).toBe(EXPECTED_MASTER);
    expect(alignmentPackage.seed_package_reference.seed_package_source_master_sha).toBe(
      seedPackage.source_master_sha
    );
    expect(alignmentPackage.seed_package_reference.status).toBe(
      "SEED_PACKAGE_MERGED_AND_POSTMERGE_VALIDATED"
    );
    expect(alignmentPackage.g0_status).toBe("EXCEPTION");
    expect(alignmentPackage.g0_pass).toBe("NOT_GRANTED");
    expect(alignmentPackage.l1_status).toBe("NOT_READY");
    expect(alignmentPackage.r8_g1_status).toBe("INTERNAL_ONLY_DRAFT_NOT_RELEASED");
    expect(alignmentPackage.direct_store_delta).toBe("NONE");

    expect(alignmentPackage.parameter_set_boundary.official_parameter_set_write).toBe(false);
    expect(alignmentPackage.parameter_set_boundary.parameter_set_version_mutation).toBe(false);
    expect(alignmentPackage.shadow_replay_boundary.shadow_replay_executes).toBe(false);
    expect(alignmentPackage.shadow_replay_boundary.shadow_replay_overwrites_official_result).toBe(
      false
    );
    expect(alignmentPackage.shadow_replay_boundary.replay_hash_semantics_changed).toBe(false);
    expect(alignmentPackage.shadow_replay_boundary.manifest_hash_semantics_changed).toBe(false);

    expect(validateR7ScenarioParameterShadowReplayAlignmentPackage(alignmentPackage)).toEqual({
      issues: [],
      ok: true
    });
  });

  it("defines compatibility, calibration and teacher-selection next-slice decisions", () => {
    const alignmentPackage = createR7ScenarioParameterShadowReplayAlignmentPackage();

    expect(alignmentPackage.compatibility_matrix.parameter_set.status).toBe(
      "COMPATIBLE_BY_REFERENCE_ONLY"
    );
    expect(alignmentPackage.compatibility_matrix.parameter_set.required_future_gate).toBe(
      "OWNER_AUTHORIZED_PARAMETERSET_VERSION_REVIEW"
    );
    expect(alignmentPackage.compatibility_matrix.shadow_replay.status).toBe(
      "SHADOW_REPLAY_REFERENCE_ONLY_NON_OVERWRITE"
    );
    expect(alignmentPackage.compatibility_matrix.shadow_replay.required_future_gate).toBe(
      "OWNER_AUTHORIZED_SHADOW_REPLAY_EXECUTION_GUARD"
    );

    expect(alignmentPackage.calibration_register.status).toBe("DRAFT_REGISTER_ONLY");
    expect(alignmentPackage.calibration_register.writes_parameter_set).toBe(false);
    expect(alignmentPackage.calibration_register.writes_official_result).toBe(false);
    expect(alignmentPackage.teacher_selection_next_slice.allowed_actions).toEqual([
      "preview_alignment_matrix",
      "compare_internal_seed_references",
      "request_owner_parameter_review"
    ]);
    expect(alignmentPackage.teacher_selection_next_slice.forbidden_actions).toContain(
      "publish_runtime_scenario"
    );
  });

  it("fails closed when official ParameterSet or Replay overwrite boundaries drift", () => {
    const alignmentPackage = createR7ScenarioParameterShadowReplayAlignmentPackage();

    expect(
      validateR7ScenarioParameterShadowReplayAlignmentPackage({
        ...alignmentPackage,
        parameter_set_boundary: {
          ...alignmentPackage.parameter_set_boundary,
          official_parameter_set_write: true
        }
      })
    ).toEqual({
      issues: ["R7_ALIGNMENT_PARAMETERSET_WRITE_DRIFT"],
      ok: false
    });

    expect(
      validateR7ScenarioParameterShadowReplayAlignmentPackage({
        ...alignmentPackage,
        shadow_replay_boundary: {
          ...alignmentPackage.shadow_replay_boundary,
          shadow_replay_overwrites_official_result: true
        }
      })
    ).toEqual({
      issues: ["R7_ALIGNMENT_REPLAY_OVERWRITE_DRIFT"],
      ok: false
    });
  });

  it("preserves runtime, truth, AI, Plugin, Postgres, Pilot and Production boundaries", () => {
    const alignmentPackage = createR7ScenarioParameterShadowReplayAlignmentPackage();

    expect(alignmentPackage.runtime_authorization).toEqual({
      ai_runtime: "NOT_AUTHORIZED",
      durable_settlement: "NOT_PROVEN",
      pilot: "NOT_AUTHORIZED",
      plugin_runtime: "NOT_AUTHORIZED",
      postgresql_runtime: "NOT_AUTHORIZED",
      production: "NOT_AUTHORIZED",
      scenario_factory_runtime_route: "NOT_AUTHORIZED",
      shadow_replay_runtime: "NOT_AUTHORIZED"
    });

    for (const term of forbiddenBoundaryTerms) {
      expect(alignmentPackage.forbidden_writes).toContain(term);
    }

    expect(R7_SCENARIO_ALIGNMENT_EXPLICIT_NON_PROOFS).toEqual([
      "ParameterSet alignment != official ParameterSet write",
      "Shadow Replay alignment != Shadow Replay execution",
      "Shadow Replay alignment != official result overwrite",
      "Alignment package != Scenario Factory runtime",
      "Alignment package != R8-G1 release",
      "Alignment package != Teacher rehearsal",
      "Alignment package != Pilot readiness",
      "Alignment package != Production readiness"
    ]);
    expect(alignmentPackage.explicit_non_proofs).toBe(R7_SCENARIO_ALIGNMENT_EXPLICIT_NON_PROOFS);
  });

  it("ships source, docs and tests without closeout wording or runtime imports", () => {
    const combinedDocs = docs.map(readRequired).join("\n");
    const source = readRequired("packages/shared-contracts/src/scenario-alignment.ts");

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

    expect(combinedDocs).toContain("ParameterSet compatibility matrix");
    expect(combinedDocs).toContain("Shadow Replay compatibility matrix");
    expect(combinedDocs).toContain("Calibration register");
    expect(combinedDocs).toContain("Teacher scenario selection next-slice package");
    expect(combinedDocs).toContain("official_parameter_set_write = false");
    expect(combinedDocs).toContain("shadow_replay_overwrites_official_result = false");
    expect(combinedDocs).not.toMatch(/\b(Fixes|Closes|Resolves)\s+#(111|114|115)\b/i);

    expect(source).not.toContain("node:fs");
    expect(source).not.toContain("services/api");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("writeFile");
  });
});
