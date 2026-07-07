import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  approveR7BScenarioDraft,
  bindR7BFrozenScenarioToRun,
  compileR7BScenarioDraft,
  createR7BScenarioDraft,
  freezeR7BApprovedScenario,
  rejectR7BBoundScenarioMutation,
  validateR7BScenarioLifecycleRecord
} from "../../services/simulation-core/src/eldercare-scenario-lifecycle";

const teacherActor = {
  actor_id: "teacher_r7b",
  course_id: "course_r7b_synthetic",
  role: "teacher" as const,
  tenant_id: "tenant_r7b_synthetic"
};
const studentActor = {
  actor_id: "student_r7b",
  course_id: "course_r7b_synthetic",
  role: "student" as const,
  tenant_id: "tenant_r7b_synthetic"
};
const otherTenantTeacher = {
  actor_id: "teacher_other",
  course_id: "course_other",
  role: "teacher" as const,
  tenant_id: "tenant_other"
};

function validatedScenario() {
  const draft = createR7BScenarioDraft({ actor: teacherActor });
  const compiled = compileR7BScenarioDraft(draft);
  const validation = validateR7BScenarioLifecycleRecord(compiled);

  expect(validation.errors).toEqual([]);
  return compiled;
}

describe("R7-B scenario lifecycle", () => {
  it("compiles a deterministic scenario lifecycle fixture without production data", () => {
    const first = compileR7BScenarioDraft(createR7BScenarioDraft({ actor: teacherActor }));
    const second = compileR7BScenarioDraft(createR7BScenarioDraft({ actor: teacherActor }));
    const fixture = JSON.parse(
      readFileSync("contracts/fixtures/r7b-eldercare-scenario-lifecycle.valid.json", "utf8")
    ) as {
      asset_id: string;
      lifecycle: { status_sequence: string[] };
      synthetic_data_classification: string[];
    };

    expect(second.asset).toEqual(first.asset);
    expect(first.status).toBe("COMPILED");
    expect(first.asset.asset_id).toBe("r7b-beijing-yanjiao-eldercare-scenario-lifecycle-v1");
    expect(first.asset.rounds).toHaveLength(6);
    expect(first.asset.policy_rules).toHaveLength(6);
    expect(first.asset.segment_migration_rules).toHaveLength(6);
    expect(first.asset.qualification_rules).toHaveLength(6);
    expect(first.asset.shock_timeline).toHaveLength(6);
    expect(first.asset.compiler_version).toBe("r7b.eldercare.lifecycle-compiler.v1");
    expect(first.asset.synthetic_data_classification).toEqual([
      "SYNTHETIC_TEACHING_SCENARIO",
      "UN_CALIBRATED",
      "NOT_FOR_REAL_OPERATING_DECISION",
      "NOT_FOR_PUBLIC_POLICY_DECISION",
      "NOT_FOR_INVESTMENT_DECISION"
    ]);
    expect(fixture.asset_id).toBe(first.asset.asset_id);
    expect(fixture.lifecycle.status_sequence).toEqual([
      "DRAFT",
      "COMPILED",
      "VALIDATED",
      "APPROVED",
      "FROZEN",
      "BOUND_TO_RUN"
    ]);
    expect(JSON.stringify(first.asset)).not.toContain("real_customer");
    expect(JSON.stringify(first.asset)).not.toContain("state_true");
  });

  it("requires teacher approval, freezes immutable fields, and binds a run auditably", () => {
    const compiled = validatedScenario();

    expect(() => approveR7BScenarioDraft(compiled, { actor: studentActor })).toThrow(
      /R7B_SCENARIO_APPROVAL_DENIED/
    );
    expect(() => approveR7BScenarioDraft(compiled, { actor: otherTenantTeacher })).toThrow(
      /R7B_SCENARIO_TENANT_SCOPE_DENIED/
    );

    const approved = approveR7BScenarioDraft(compiled, { actor: teacherActor });
    const frozen = freezeR7BApprovedScenario(approved, { actor: teacherActor });
    const bound = bindR7BFrozenScenarioToRun(frozen, {
      actor: teacherActor,
      run_id: "run_r7b_synthetic_001"
    });
    const mutationAttempt = rejectR7BBoundScenarioMutation(bound, {
      actor: teacherActor,
      field_path: "asset.parameter_set.seed",
      requested_value: 99999
    });

    expect(approved.status).toBe("APPROVED");
    expect(frozen.status).toBe("FROZEN");
    expect(bound.status).toBe("BOUND_TO_RUN");
    expect(bound.run_binding?.scenario_package_version).toBe(bound.asset.scenario_package.version);
    expect(bound.run_binding?.parameter_set_version).toBe(bound.asset.parameter_set.version);
    expect(bound.run_binding?.input_hash).toBe(bound.input_hash);
    expect(bound.run_binding?.output_hash).toBe(bound.output_hash);
    expect(bound.run_binding?.mutation_allowed).toBe(false);
    expect(mutationAttempt).toMatchObject({
      accepted: false,
      code: "R7B_BOUND_SCENARIO_IMMUTABLE",
      requires_new_scenario_version: true
    });
  });

  it("classifies validation failures without relaxing lifecycle scope", () => {
    const compiled = compileR7BScenarioDraft(createR7BScenarioDraft({ actor: teacherActor }));
    const invalid = {
      ...compiled,
      asset: {
        ...compiled.asset,
        shock_timeline: [],
        synthetic_data_classification: ["SYNTHETIC_TEACHING_SCENARIO"]
      }
    };
    const validation = validateR7BScenarioLifecycleRecord(invalid);

    expect(validation.status).toBe("failed");
    expect(validation.errors).toContain("expected_six_round_shock_timeline");
    expect(validation.errors).toContain("synthetic_classification_incomplete");
    expect(validation.direct_store_delta).toBe("NONE");
  });
});
