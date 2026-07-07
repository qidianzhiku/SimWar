import type { Decision, Round, Run, Team } from "@simwar/shared-contracts";
import { describe, expect, it } from "vitest";
import {
  approveR7CCompiledScenario,
  bindR7CReleaseCandidateToRun,
  buildR7CShadowArenaBatch,
  compileR7CScenarioDraft,
  createR7CReleaseCandidate,
  createR7CScenarioAuthoringDraft,
  createR7CScenarioRegistry,
  freezeR7CApprovedScenario,
  projectR7CScenarioForActor
} from "../../services/simulation-core/src/eldercare-scenario-factory";
import { createToyLogitEngine } from "../../services/simulation-core/src/toy-logit-engine";

const teacherActor = {
  actor_id: "teacher_r7c",
  course_id: "course_r7c_synthetic",
  role: "teacher" as const,
  tenant_id: "tenant_r7c_synthetic"
};
const studentActor = {
  actor_id: "student_alpha_r7c",
  course_id: "course_r7c_synthetic",
  role: "student" as const,
  team_id: "team_alpha_r7c",
  tenant_id: "tenant_r7c_synthetic"
};
const tenantAdminActor = {
  actor_id: "tenant_admin_r7c",
  role: "tenant_admin" as const,
  tenant_id: "tenant_r7c_synthetic"
};
const otherTenantStudent = {
  actor_id: "student_other_r7c",
  course_id: "course_other",
  role: "student" as const,
  team_id: "team_other",
  tenant_id: "tenant_other"
};

function team(team_id: string, name: string): Team {
  return {
    captain_user_id: `${team_id}_captain`,
    course_id: "course_r7c_synthetic",
    members: [],
    name,
    team_id,
    tenant_id: "tenant_r7c_synthetic"
  };
}

function decision(team_id: string, price: number, serviceQualityBudget: number): Decision {
  return {
    decision_id: `decision_${team_id}`,
    payload: {
      capacity_plan: "expand",
      cash_buffer_target: 0.2,
      marketing_budget: 168000,
      pricing: { base_price: price },
      service_quality_budget: serviceQualityBudget,
      strategy_statement: `R7-C scenario factory compatibility decision for ${team_id}.`
    },
    round_id: "round_r7c_1",
    round_no: 1,
    run_id: "run_r7c_synthetic_001",
    status: "validated",
    submitted_by: `${team_id}_captain`,
    team_id,
    tenant_id: "tenant_r7c_synthetic",
    validation_report: [],
    version: 1
  };
}

function boundCandidate() {
  const registry = createR7CScenarioRegistry({ actor: teacherActor });
  const draft = createR7CScenarioAuthoringDraft(registry, {
    actor: teacherActor,
    variant_id: "base_operations"
  });
  const approved = approveR7CCompiledScenario(compileR7CScenarioDraft(draft), {
    actor: teacherActor
  });
  const frozen = freezeR7CApprovedScenario(approved, { actor: teacherActor });
  const candidate = createR7CReleaseCandidate(frozen, { actor: teacherActor });

  return {
    candidate: bindR7CReleaseCandidateToRun(candidate, {
      actor: teacherActor,
      run_id: "run_r7c_synthetic_001"
    }),
    family: registry.family
  };
}

function settle(candidate: ReturnType<typeof boundCandidate>["candidate"]) {
  const run: Run = {
    course_id: "course_r7c_synthetic",
    parameter_set_id: candidate.compiled_record.asset.parameter_set.parameter_set_id,
    run_id: candidate.run_binding?.run_id ?? "run_r7c_synthetic_001",
    scenario_package_id: candidate.compiled_record.asset.scenario_package.scenario_package_id,
    seed: candidate.compiled_record.asset.parameter_set.seed,
    status: "active",
    tenant_id: candidate.tenant_id
  };
  const round: Round = {
    round_id: "round_r7c_1",
    round_no: 1,
    run_id: run.run_id,
    status: "locked",
    tenant_id: run.tenant_id
  };

  return createToyLogitEngine().settle({
    decisions: [
      decision("team_alpha_r7c", 13300, 182000),
      decision("team_beta_r7c", 11900, 132000)
    ],
    parameterSet: candidate.compiled_record.asset.parameter_set,
    round,
    run,
    scenario: candidate.compiled_record.asset.scenario_package,
    teams: [
      team("team_alpha_r7c", "Alpha R7-C Eldercare Team"),
      team("team_beta_r7c", "Beta R7-C Eldercare Team")
    ]
  });
}

const privateMarkers = [
  "state_true",
  "private_assumption",
  "private_parameter",
  "private_plugin_trace",
  "private_replay",
  "manifest_hash",
  "canonical_evidence_digest",
  "tenant_other",
  "team_beta_private"
];

describe("R7-C scenario factory compatibility with Golden M1 and R3 boundaries", () => {
  it("settles through the existing engine and keeps shadow arena evidence non-overwriting", () => {
    const { candidate, family } = boundCandidate();
    const first = settle(candidate);
    const second = settle(candidate);
    const officialSnapshot = JSON.stringify(first);
    const shadowArena = buildR7CShadowArenaBatch(family, candidate, first);

    expect(first).toEqual(second);
    expect(JSON.stringify(first)).toBe(officialSnapshot);
    expect(first.team_results).toHaveLength(2);
    expect(candidate.run_binding).toMatchObject({
      mutation_allowed: false,
      scenario_family_version: "r7c.beijing-yanjiao.scenario-family.v1"
    });
    expect(shadowArena.official_result_non_overwrite).toBe(true);
    expect(shadowArena.replay_writes_formal_results).toBe(false);
  });

  it("keeps Student and Tenant Admin projections scoped and redacted", () => {
    const { candidate, family } = boundCandidate();
    const shadowArena = buildR7CShadowArenaBatch(family, candidate, settle(candidate));
    const studentView = projectR7CScenarioForActor(candidate, {
      actor: studentActor,
      shadow_arena: shadowArena
    });
    const teacherView = projectR7CScenarioForActor(candidate, {
      actor: teacherActor,
      shadow_arena: shadowArena
    });
    const tenantAdminView = projectR7CScenarioForActor(candidate, { actor: tenantAdminActor });

    expect(teacherView.visibility).toBe("teacher_authorized_scenario_factory");
    expect(studentView.visibility).toBe("student_redacted_scenario_observation");
    expect(tenantAdminView.visibility).toBe("tenant_admin_scenario_status");
    expect(tenantAdminView.tenant_id).toBe("tenant_r7c_synthetic");
    expect(() => projectR7CScenarioForActor(candidate, { actor: otherTenantStudent })).toThrow(
      /R7C_SCENARIO_FACTORY_TENANT_SCOPE_DENIED/
    );

    const studentSerialized = JSON.stringify(studentView);
    for (const marker of privateMarkers) {
      expect(studentSerialized).not.toContain(marker);
    }
  });
});
