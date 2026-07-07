import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  approveR7CCompiledScenario,
  bindR7CReleaseCandidateToRun,
  buildR7CBeijingYanjiaoScenarioFamily,
  compileR7CScenarioDraft,
  createR7CReleaseCandidate,
  createR7CScenarioDraft,
  createR7CScenarioRegistry,
  freezeR7CApprovedScenario,
  rejectR7CScenarioMutation,
  validateR7CScenarioFactory
} from "../../services/simulation-core/src/eldercare-scenario-factory";

const teacherActor = {
  actor_id: "teacher_r7c",
  course_id: "course_r7c_synthetic",
  role: "teacher" as const,
  tenant_id: "tenant_r7c_synthetic"
};
const studentActor = {
  actor_id: "student_r7c",
  course_id: "course_r7c_synthetic",
  role: "student" as const,
  team_id: "team_alpha_r7c",
  tenant_id: "tenant_r7c_synthetic"
};
const otherTenantTeacher = {
  actor_id: "teacher_other",
  course_id: "course_other",
  role: "teacher" as const,
  tenant_id: "tenant_other"
};

function compiledCrisisScenario() {
  const registry = createR7CScenarioRegistry({ actor: teacherActor });
  const draft = createR7CScenarioDraft(registry, {
    actor: teacherActor,
    variant_id: "crisis_shock"
  });

  return compileR7CScenarioDraft(draft);
}

describe("R7-C scenario factory runtime", () => {
  it("builds a deterministic Beijing-Yanjiao scenario family and matches the fixture", () => {
    const first = buildR7CBeijingYanjiaoScenarioFamily();
    const second = buildR7CBeijingYanjiaoScenarioFamily();
    const fixture = JSON.parse(
      readFileSync("contracts/fixtures/r7c-scenario-family.valid.json", "utf8")
    ) as {
      family_id: string;
      template_version: string;
      variants: Array<{ variant_id: string }>;
    };

    expect(second).toEqual(first);
    expect(first.family_id).toBe("r7c-beijing-yanjiao-eldercare-family-v1");
    expect(first.template.template_version).toBe("r7c.beijing-yanjiao.scenario-family.v1");
    expect(first.variants.map((variant) => variant.variant_id)).toEqual([
      "base_operations",
      "payer_policy_shift",
      "regional_migration",
      "competition_entry",
      "crisis_shock"
    ]);
    expect(first.direct_store_delta).toBe("NONE");
    expect(first.formal_truth_write).toBe(false);
    expect(first.postgresql_runtime_required).toBe(false);
    expect(first.replay_writes_formal_results).toBe(false);
    expect(fixture.family_id).toBe(first.family_id);
    expect(fixture.template_version).toBe(first.template.template_version);
    expect(fixture.variants.map((variant) => variant.variant_id)).toEqual(
      first.variants.map((variant) => variant.variant_id)
    );
    expect(JSON.stringify(first)).not.toContain("real_customer");
    expect(JSON.stringify(first)).not.toContain("state_true");
  });

  it("authorizes teacher-controlled draft, compile, approval, freeze, release and binding", () => {
    const compiled = compiledCrisisScenario();

    expect(validateR7CScenarioFactory(buildR7CBeijingYanjiaoScenarioFamily()).errors).toEqual([]);
    expect(compiled.status).toBe("COMPILED");
    expect(compiled.variant.variant_id).toBe("crisis_shock");
    expect(compiled.validation_report).toMatchObject({
      database_delta: "NONE",
      direct_store_delta: "NONE",
      schema_delta: "NONE",
      status: "passed",
      student_visibility_delta: "NONE"
    });
    expect(() => approveR7CCompiledScenario(compiled, { actor: studentActor })).toThrow(
      /R7C_SCENARIO_FACTORY_TEACHER_AUTHORITY_REQUIRED/
    );
    expect(() => approveR7CCompiledScenario(compiled, { actor: otherTenantTeacher })).toThrow(
      /R7C_SCENARIO_FACTORY_TENANT_SCOPE_DENIED/
    );

    const approved = approveR7CCompiledScenario(compiled, { actor: teacherActor });
    const frozen = freezeR7CApprovedScenario(approved, { actor: teacherActor });
    const candidate = createR7CReleaseCandidate(frozen, { actor: teacherActor });
    const bound = bindR7CReleaseCandidateToRun(candidate, {
      actor: teacherActor,
      run_id: "run_r7c_synthetic_001"
    });
    const rejection = rejectR7CScenarioMutation(bound, {
      actor: teacherActor,
      field_path: "compiled_record.asset.parameter_set.seed",
      requested_value: 42
    });

    expect(approved.status).toBe("APPROVED");
    expect(frozen.status).toBe("FROZEN");
    expect(candidate.status).toBe("RELEASE_CANDIDATE");
    expect(bound.status).toBe("BOUND_TO_RUN");
    expect(bound.run_binding).toMatchObject({
      mutation_allowed: false,
      run_id: "run_r7c_synthetic_001",
      scenario_family_version: "r7c.beijing-yanjiao.scenario-family.v1"
    });
    expect(rejection).toMatchObject({
      accepted: false,
      code: "R7B_BOUND_SCENARIO_IMMUTABLE",
      direct_store_delta: "NONE",
      requires_new_scenario_version: true
    });
  });

  it("classifies invalid family contracts without scope expansion", () => {
    const family = buildR7CBeijingYanjiaoScenarioFamily();
    const invalid = {
      ...family,
      variants: family.variants.slice(0, 2)
    };
    const validation = validateR7CScenarioFactory(invalid);

    expect(validation.status).toBe("failed");
    expect(validation.errors).toContain("expected_five_scenario_variants");
    expect(validation.direct_store_delta).toBe("NONE");
    expect(validation.api_delta).toBe("NONE");
    expect(validation.database_delta).toBe("NONE");
  });
});
