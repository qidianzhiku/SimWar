import { describe, expect, it } from "vitest";
import {
  approveR7BScenarioDraft,
  bindR7BFrozenScenarioToRun,
  compileR7BScenarioDraft,
  createR7BScenarioDiff,
  createR7BScenarioDraft,
  evaluateR7BPolicyAndQualification,
  freezeR7BApprovedScenario,
  projectR7BScenarioForActor,
  validateR7BScenarioLifecycleRecord
} from "../../services/simulation-core/src/eldercare-scenario-lifecycle";

const teacherActor = {
  actor_id: "teacher_r7b",
  course_id: "course_r7b_synthetic",
  role: "teacher" as const,
  tenant_id: "tenant_r7b_synthetic"
};
const tenantAdminActor = {
  actor_id: "tenant_admin_r7b",
  role: "tenant_admin" as const,
  tenant_id: "tenant_r7b_synthetic"
};
const studentActor = {
  actor_id: "student_r7b",
  course_id: "course_r7b_synthetic",
  role: "student" as const,
  team_id: "team_alpha_r7b",
  tenant_id: "tenant_r7b_synthetic"
};
const platformAdminWithoutAuthority = {
  actor_id: "platform_r7b",
  role: "platform_admin" as const,
  tenant_id: "tenant_r7b_synthetic"
};

function boundScenario() {
  const compiled = compileR7BScenarioDraft(createR7BScenarioDraft({ actor: teacherActor }));
  expect(validateR7BScenarioLifecycleRecord(compiled).errors).toEqual([]);
  const approved = approveR7BScenarioDraft(compiled, { actor: teacherActor });
  return bindR7BFrozenScenarioToRun(freezeR7BApprovedScenario(approved, { actor: teacherActor }), {
    actor: teacherActor,
    run_id: "run_r7b_synthetic_001"
  });
}

const privateMarkers = [
  "private_assumption",
  "private_parameter",
  "private_plugin_trace",
  "private_replay",
  "state_true",
  "canonical_evidence_digest",
  "manifest_hash",
  "tenant_other",
  "team_beta_private"
];

describe("R7-B scenario diff, trace, and visibility", () => {
  it("produces scenario, parameter, plugin, and shock diffs with actor visibility metadata", () => {
    const compiled = compileR7BScenarioDraft(createR7BScenarioDraft({ actor: teacherActor }));
    const after = {
      ...compiled.asset,
      parameter_set: {
        ...compiled.asset.parameter_set,
        base_capacity: compiled.asset.parameter_set.base_capacity + 8,
        version: "r7b.eldercare.parameters.v2"
      },
      scenario_package: {
        ...compiled.asset.scenario_package,
        plugin_package_ids: [
          ...compiled.asset.scenario_package.plugin_package_ids,
          "plugin_wellness_eldercare_v1_observer"
        ],
        version: "2.0.0"
      },
      shock_timeline: compiled.asset.shock_timeline.map((shock, index) =>
        index === 5
          ? {
              ...shock,
              severity: "low" as const
            }
          : shock
      )
    };
    const diff = createR7BScenarioDiff(compiled.asset, after);

    expect(diff.entries.map((entry) => entry.category)).toEqual(
      expect.arrayContaining(["scenario", "parameter", "plugin", "shock"])
    );
    expect(diff.entries.every((entry) => entry.tenant_id === "tenant_r7b_synthetic")).toBe(true);
    expect(diff.entries.every((entry) => entry.actor_visibility.includes("teacher"))).toBe(true);
    expect(diff.entries.every((entry) => entry.sensitive_field_redaction === true)).toBe(true);
    expect(diff.entries.some((entry) => entry.requires_new_scenario_version)).toBe(true);
  });

  it("projects teacher, student, tenant admin, and platform admin boundaries explicitly", () => {
    const bound = boundScenario();
    const teacherView = projectR7BScenarioForActor(bound, { actor: teacherActor });
    const studentView = projectR7BScenarioForActor(bound, { actor: studentActor });
    const tenantAdminView = projectR7BScenarioForActor(bound, { actor: tenantAdminActor });

    expect(teacherView.visibility).toBe("teacher_authorized_evidence");
    expect(teacherView.scenario_diff?.entries.length).toBeGreaterThan(0);
    expect(studentView.visibility).toBe("student_redacted_state_obs");
    expect(studentView.rounds).toHaveLength(6);
    expect(tenantAdminView.visibility).toBe("tenant_admin_status_summary");
    expect(tenantAdminView.run_binding_status).toBe("BOUND_TO_RUN");
    expect(() =>
      projectR7BScenarioForActor(bound, { actor: platformAdminWithoutAuthority })
    ).toThrow(/R7B_PLATFORM_ADMIN_AUTHORITY_REQUIRED/);

    const studentSerialized = JSON.stringify(studentView);
    for (const marker of privateMarkers) {
      expect(studentSerialized).not.toContain(marker);
    }
  });

  it("keeps policy, migration, qualification, and shock checks deterministic", () => {
    const compiled = compileR7BScenarioDraft(createR7BScenarioDraft({ actor: teacherActor }));
    const evaluation = evaluateR7BPolicyAndQualification(compiled.asset, {
      license_scope: "community_daycare_only",
      offer_id: "medical_rehab",
      round_no: 6,
      staff_count: 18
    });

    expect(evaluation.policy_result).toBe("denied");
    expect(evaluation.controlled_failures).toEqual(
      expect.arrayContaining([
        "R7B_MEDICAL_REHAB_LICENSE_SCOPE_DENIED",
        "R7B_STAFFING_CAPACITY_GUARDRAIL_TRIGGERED"
      ])
    );
    expect(evaluation.segment_migration_rule.rule_id).toBe("migration_round_6_public_health_risk");
    expect(evaluation.shock.shock_id).toBe("shock_round_6_public_health_quality_event");
    expect(JSON.stringify(evaluation)).not.toContain("state_true");
  });
});
