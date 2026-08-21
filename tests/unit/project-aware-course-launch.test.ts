import { describe, expect, it } from "vitest";
import {
  evaluateProjectAwareReadiness,
  type ProjectAwareReadinessSnapshot
} from "../../services/api/src/project-aware-course-launch-service";
import { getShanghaiMarketWorldReference } from "../../services/api/src/market-world-product";

function snapshot(
  overrides: Partial<ProjectAwareReadinessSnapshot> = {}
): ProjectAwareReadinessSnapshot {
  const profileReference = {
    content_digest: "a".repeat(64),
    project_profile_id: "project-alpha",
    tenant_id: "tenant_demo",
    version: "2026-08-21.1"
  };
  return {
    scope: { course_id: "course_demo", run_id: "run_formal", tenant_id: "tenant_demo" },
    course: {
      course_id: "course_demo",
      created_by: "usr_teacher",
      market_world_reference: getShanghaiMarketWorldReference(),
      parameter_set_id: "param_toy_approved_1",
      scenario_package_id: "scenario_eldercare_demo",
      status: "active",
      tenant_id: "tenant_demo",
      title: "Shanghai Market World"
    },
    run: {
      course_id: "course_demo",
      parameter_set_id: "param_toy_approved_1",
      run_id: "run_formal",
      scenario_package_id: "scenario_eldercare_demo",
      seed: 7,
      status: "active",
      tenant_id: "tenant_demo"
    },
    teams: [
      {
        captain_user_id: "usr_student",
        course_id: "course_demo",
        members: [{ display_name: "Student", role_slot: "CEO", user_id: "usr_student" }],
        name: "Team Alpha",
        team_id: "team_alpha",
        tenant_id: "tenant_demo"
      }
    ],
    assignments: [
      {
        assigned_at: "2026-08-21T00:00:00.000Z",
        assigned_by: "usr_teacher",
        assignment_id: "assignment-alpha",
        course_id: "course_demo",
        project_profile_reference: profileReference,
        run_id: "run_formal",
        schema_version: "project-assignment.v1",
        team_id: "team_alpha",
        tenant_id: "tenant_demo"
      }
    ],
    profiles: [
      {
        content_digest: profileReference.content_digest,
        course_id: "course_demo",
        created_at: "2026-08-21T00:00:00.000Z",
        created_by: "usr_teacher",
        customer_segment: "Shanghai families",
        description: "Safe project",
        geography: "Shanghai",
        industry: "eldercare",
        market_world_reference: getShanghaiMarketWorldReference(),
        positioning: "Trusted care",
        project_profile_id: profileReference.project_profile_id,
        provenance: { kind: "APPROVED_SAFE_TEMPLATE" },
        schema_version: "project-profile.v1",
        service_bundle: "Care",
        starting_capacity: 100,
        starting_cash: 100000,
        status: "VALIDATED",
        tenant_id: "tenant_demo",
        template_id: "template",
        title: "Project Alpha",
        version: profileReference.version
      }
    ],
    role_workflows: {
      team_alpha: {
        round: {
          round_id: "round_formal",
          round_no: 1,
          run_id: "run_formal",
          status: "open",
          tenant_id: "tenant_demo"
        },
        assignments: [
          {
            assigned_at: "2026-08-21T00:00:00.000Z",
            assigned_by: "usr_teacher",
            assignment_id: "role-alpha",
            course_id: "course_demo",
            role_key: "CEO",
            role_template_id: "role_template_ceo_v1",
            run_id: "run_formal",
            source: "teacher_assigned",
            status: "active",
            team_id: "team_alpha",
            tenant_id: "tenant_demo",
            user_id: "usr_student"
          }
        ]
      }
    },
    formal_binding: { status: "BOUND", binding_digest: "b".repeat(64) },
    ...overrides
  };
}

describe("project-aware launch readiness", () => {
  it("blocks a required team with no exact assignment", () => {
    const result = evaluateProjectAwareReadiness(
      snapshot({ assignments: [], role_workflows: { team_alpha: { assignments: [] } } })
    );

    expect(result.state).toBe("BLOCKED");
    expect(result.teams[0]?.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MISSING_ASSIGNMENT", owner: "teacher" })
      ])
    );
  });

  it("does not implicitly replace a retired profile with its successor", () => {
    const current = snapshot();
    const profile = current.profiles[0]!;
    const successor = {
      ...profile,
      content_digest: "c".repeat(64),
      project_profile_id: "project-successor",
      provenance: {
        kind: "SUCCESSOR" as const,
        source_project_profile_reference: current.assignments[0]!.project_profile_reference
      },
      successor_of: current.assignments[0]!.project_profile_reference,
      status: "VALIDATED" as const,
      version: "2026-08-21.2"
    };

    const result = evaluateProjectAwareReadiness({
      ...current,
      profiles: [{ ...profile, status: "RETIRED" }, successor]
    });

    expect(result.state).toBe("STALE");
    expect(result.teams[0]?.project_profile_reference).toEqual(
      current.assignments[0]!.project_profile_reference
    );
    expect(result.teams[0]?.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "RETIRED_PROFILE",
          action: expect.stringContaining("rebind")
        })
      ])
    );
  });

  it("requires authoritative formal status before reporting READY", () => {
    const result = evaluateProjectAwareReadiness(
      snapshot({ formal_binding: { status: "UNKNOWN" } })
    );

    expect(result.state).toBe("UNKNOWN_VERIFYING");
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "UNKNOWN_FORMAL_STATUS", owner: "platform" })
      ])
    );
  });
});
