import { existsSync, readFileSync } from "node:fs";
import {
  createR7TeacherScenarioSelectionBoundaryPackage,
  R7_TEACHER_SCENARIO_SELECTION_EXPLICIT_NON_PROOFS,
  R7_TEACHER_SCENARIO_SELECTION_SOURCE_MASTER_SHA,
  validateR7TeacherScenarioSelectionBoundaryPackage
} from "@simwar/shared-contracts";
import { describe, expect, it } from "vitest";

const EXPECTED_MASTER = "f51d49cf736bef1e3645b6b56f85c41c12d9872e";
const RELATION_ONLY_ISSUES = ["Relates to #111", "Relates to #114", "Relates to #115"] as const;

const docs = [
  "docs/architecture/r7-teacher-scenario-selection-bff-dto-boundary.md",
  "docs/quality/r7-teacher-scenario-selection-compatibility-matrix.md",
  "docs/quality/r7-scenario-evidence-ledger.md",
  "docs/operations/r7-teacher-scenario-selection-boundary.md"
] as const;

const forbiddenFields = [
  "state_true",
  "SettlementResult",
  "truth_hash",
  "replay_hash",
  "manifest_hash",
  "canonical_evidence_digest",
  "private_parameter_set",
  "private_shadow_replay_trace",
  "official_parameter_set"
] as const;

function readRequired(path: string): string {
  expect(existsSync(path), `${path} must exist`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("R7 Teacher scenario selection BFF/DTO boundary", () => {
  it("creates an internal teacher selection DTO without runtime activation", () => {
    const packageDraft = createR7TeacherScenarioSelectionBoundaryPackage();

    expect(packageDraft.evidence_kind).toBe("r7_teacher_scenario_selection_bff_dto_boundary");
    expect(packageDraft.evidence_version).toBe("r7-teacher-scenario-selection-bff-dto-boundary.v1");
    expect(packageDraft.source_master_sha).toBe(EXPECTED_MASTER);
    expect(R7_TEACHER_SCENARIO_SELECTION_SOURCE_MASTER_SHA).toBe(EXPECTED_MASTER);
    expect(packageDraft.status).toBe("BOUNDARY_PACKAGE_ONLY");
    expect(packageDraft.g0_status).toBe("EXCEPTION");
    expect(packageDraft.g0_pass).toBe("NOT_GRANTED");
    expect(packageDraft.l1_status).toBe("NOT_READY");
    expect(packageDraft.r8_g1_status).toBe("INTERNAL_ONLY_DRAFT_NOT_RELEASED");
    expect(packageDraft.direct_store_delta).toBe("NONE");

    expect(packageDraft.teacher_selection_dto.actor_role).toBe("teacher");
    expect(packageDraft.teacher_selection_dto.tenant_id_required).toBe(true);
    expect(packageDraft.teacher_selection_dto.course_id_required).toBe(true);
    expect(packageDraft.teacher_selection_dto.run_id_required).toBe(true);
    expect(packageDraft.teacher_selection_dto.scenario_package_id_required).toBe(true);
    expect(packageDraft.teacher_selection_dto.parameter_set_id_required).toBe(true);
    expect(packageDraft.teacher_selection_dto.plugin_package_id_required).toBe(true);
    expect(packageDraft.teacher_selection_dto.source_runtime_path).toBe(
      "NOT_BOUND_TO_RUNTIME_ROUTE"
    );
    expect(packageDraft.teacher_selection_dto.visible_state.selection_status).toBe(
      "INTERNAL_BOUNDARY_DRAFT"
    );
    expect(packageDraft.teacher_selection_dto.allowed_actions).toEqual([
      "preview_alignment_matrix",
      "compare_internal_seed_references",
      "request_owner_parameter_review"
    ]);
  });

  it("fails closed for runtime, truth, ParameterSet, Replay and student projection drift", () => {
    const packageDraft = createR7TeacherScenarioSelectionBoundaryPackage();

    expect(validateR7TeacherScenarioSelectionBoundaryPackage(packageDraft)).toEqual({
      issues: [],
      ok: true
    });

    expect(
      validateR7TeacherScenarioSelectionBoundaryPackage({
        ...packageDraft,
        boundary: {
          ...packageDraft.boundary,
          runtime_route_enabled: true
        }
      })
    ).toEqual({
      issues: ["R7_TEACHER_SELECTION_RUNTIME_ROUTE_ENABLED"],
      ok: false
    });

    expect(
      validateR7TeacherScenarioSelectionBoundaryPackage({
        ...packageDraft,
        boundary: {
          ...packageDraft.boundary,
          official_parameter_set_write: true
        }
      })
    ).toEqual({
      issues: ["R7_TEACHER_SELECTION_PARAMETERSET_WRITE_DRIFT"],
      ok: false
    });

    expect(
      validateR7TeacherScenarioSelectionBoundaryPackage({
        ...packageDraft,
        boundary: {
          ...packageDraft.boundary,
          shadow_replay_overwrites_official_result: true
        }
      })
    ).toEqual({
      issues: ["R7_TEACHER_SELECTION_REPLAY_OVERWRITE_DRIFT"],
      ok: false
    });

    expect(
      validateR7TeacherScenarioSelectionBoundaryPackage({
        ...packageDraft,
        boundary: {
          ...packageDraft.boundary,
          student_visibility_expansion: true
        }
      })
    ).toEqual({
      issues: ["R7_TEACHER_SELECTION_STUDENT_VISIBILITY_DRIFT"],
      ok: false
    });
  });

  it("keeps command and query contracts advisory/reference-only", () => {
    const packageDraft = createR7TeacherScenarioSelectionBoundaryPackage();

    expect(packageDraft.query_contract.required_scope).toEqual([
      "tenant_id",
      "course_id",
      "run_id"
    ]);
    expect(packageDraft.query_contract.reads_runtime_store).toBe(false);
    expect(packageDraft.query_contract.direct_store_access).toBe(false);
    expect(packageDraft.command_contract.command_status).toBe("DRAFT_CONTRACT_ONLY");
    expect(packageDraft.command_contract.writes_official_scenario_binding).toBe(false);
    expect(packageDraft.command_contract.writes_official_parameter_set).toBe(false);
    expect(packageDraft.command_contract.executes_shadow_replay).toBe(false);
    expect(packageDraft.command_contract.allowed_future_runtime_gate).toBe(
      "OWNER_AUTHORIZED_TEACHER_SELECTION_RUNTIME_ROUTE"
    );

    expect(packageDraft.advisory_slots.advisory_only).toBe(true);
    expect(packageDraft.advisory_slots.ai_writes_formal_truth).toBe(false);
    expect(packageDraft.advisory_slots.model_call_log_reference).toBe(
      "MODEL_CALL_LOG_REFERENCE_ONLY"
    );
  });

  it("preserves explicit non-proofs and forbidden fields", () => {
    const packageDraft = createR7TeacherScenarioSelectionBoundaryPackage();

    expect(packageDraft.explicit_non_proofs).toBe(
      R7_TEACHER_SCENARIO_SELECTION_EXPLICIT_NON_PROOFS
    );
    expect(R7_TEACHER_SCENARIO_SELECTION_EXPLICIT_NON_PROOFS).toEqual([
      "Teacher selection DTO boundary != runtime BFF route",
      "Teacher selection DTO boundary != Scenario Factory runtime",
      "Teacher selection DTO boundary != official Scenario binding",
      "Teacher selection DTO boundary != official ParameterSet write",
      "Teacher selection DTO boundary != Shadow Replay execution",
      "Teacher selection DTO boundary != R8-G1 release",
      "Teacher selection DTO boundary != Teacher rehearsal",
      "Teacher selection DTO boundary != Pilot readiness",
      "Teacher selection DTO boundary != Production readiness"
    ]);

    for (const field of forbiddenFields) {
      expect(packageDraft.teacher_selection_dto.forbidden_fields).toContain(field);
    }
  });

  it("ships docs and source without closeout wording or runtime imports", () => {
    const combinedDocs = docs.map(readRequired).join("\n");
    const source = readRequired("packages/shared-contracts/src/scenario-selection.ts");

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

    expect(combinedDocs).toContain("Teacher Scenario Selection BFF/DTO Boundary");
    expect(combinedDocs).toContain("runtime_route_enabled = false");
    expect(combinedDocs).toContain("official_parameter_set_write = false");
    expect(combinedDocs).toContain("shadow_replay_overwrites_official_result = false");
    expect(combinedDocs).toContain("student_visibility_expansion = false");
    expect(combinedDocs).not.toMatch(/\b(Fixes|Closes|Resolves)\s+#(111|114|115)\b/i);

    expect(source).not.toContain("node:fs");
    expect(source).not.toContain("services/api");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("writeFile");
  });
});
