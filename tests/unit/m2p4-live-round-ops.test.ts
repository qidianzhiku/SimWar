import { describe, expect, it } from "vitest";
import type {
  Course,
  ProjectProfileStudentBrief,
  ProjectAwareCourseReadiness,
  RoleDecisionSection,
  Team,
  TeamConfirmation,
  Decision,
  DecisionMergeCommit,
  Round,
  Run
} from "@simwar/shared-contracts";
import type { RoleWorkflowRepositorySnapshot } from "../../services/api/src/repository-ports";
import {
  buildM2P4StudentProjectContext,
  buildM2P4TeacherLiveRoundOps
} from "../../services/api/src/m2p4-live-round-ops";

const ref = {
  tenant_id: "tenant-1",
  project_profile_id: "profile-1",
  version: "2026-08-21.v1",
  content_digest: "a".repeat(64)
};

const course = {
  course_id: "course-1",
  tenant_id: "tenant-1",
  title: "Shanghai course",
  status: "active"
} as Course;

const run = {
  run_id: "run-1",
  tenant_id: "tenant-1",
  course_id: "course-1",
  status: "active"
} as Run;

const round = {
  round_id: "round-1",
  tenant_id: "tenant-1",
  run_id: "run-1",
  round_no: 1,
  status: "open"
} as Round;

const team = {
  team_id: "team-1",
  tenant_id: "tenant-1",
  course_id: "course-1",
  name: "Team One",
  captain_user_id: "user-1",
  members: [
    { user_id: "user-1", display_name: "CEO", role_slot: "CEO" },
    { user_id: "user-2", display_name: "CFO", role_slot: "CFO" },
    { user_id: "user-3", display_name: "CMO", role_slot: "CMO" },
    { user_id: "user-4", display_name: "COO", role_slot: "COO" }
  ]
} as Team;

const decision = {
  decision_id: "decision-1",
  tenant_id: "tenant-1",
  run_id: "run-1",
  round_id: "round-1",
  round_no: 1,
  team_id: "team-1",
  status: "submitted",
  version: 1,
  payload: {} as Decision["payload"],
  validation_report: [],
  submitted_by: "user-1",
  canonical_source: "role_merge_commit",
  merge_commit_id: "merge-1",
  team_confirmation_id: "confirmation-1"
} as Decision;

function roleSnapshot(overrides: Partial<RoleWorkflowRepositorySnapshot> = {}) {
  const sections: RoleDecisionSection[] = team.members.map((member, index) => ({
    section_id: `section-${index}`,
    assignment_id: `assignment-${index}`,
    tenant_id: "tenant-1",
    run_id: "run-1",
    round_id: "round-1",
    team_id: "team-1",
    role_key: member.role_slot,
    status: "ready",
    payload: {},
    version: 1,
    submitted_by: member.user_id,
    submitted_at: "2026-08-21T00:00:00.000Z",
    updated_at: "2026-08-21T00:00:00.000Z"
  }));
  const merge: DecisionMergeCommit = {
    merge_commit_id: "merge-1",
    tenant_id: "tenant-1",
    run_id: "run-1",
    round_id: "round-1",
    team_id: "team-1",
    status: "validated",
    source_section_ids: sections.map((section) => section.section_id),
    merged_payload: {} as DecisionMergeCommit["merged_payload"],
    created_by: "user-1",
    created_at: "2026-08-21T00:00:00.000Z"
  };
  const confirmation: TeamConfirmation = {
    team_confirmation_id: "confirmation-1",
    tenant_id: "tenant-1",
    run_id: "run-1",
    round_id: "round-1",
    team_id: "team-1",
    merge_commit_id: "merge-1",
    status: "confirmed",
    confirmed_by: "user-1",
    confirmed_at: "2026-08-21T00:00:00.000Z"
  };
  return {
    course,
    run,
    round,
    team,
    assignments: team.members.map((member, index) => ({
      assignment_id: `assignment-${index}`,
      tenant_id: "tenant-1",
      course_id: "course-1",
      run_id: "run-1",
      round_id: "round-1",
      team_id: "team-1",
      user_id: member.user_id,
      role_key: member.role_slot,
      status: "active",
      source: "seeded_default"
    })),
    sections,
    merge_commits: [merge],
    confirmations: [confirmation],
    decisions: [decision],
    events: [],
    resolutions: [],
    acknowledgements: [],
    ...overrides
  } as RoleWorkflowRepositorySnapshot;
}

const readiness = {
  schema_version: "project-aware-launch.v1",
  generated_at: "2026-08-21T00:00:00.000Z",
  scope: { tenant_id: "tenant-1", course_id: "course-1", run_id: "run-1" },
  state: "READY",
  blockers: [],
  teams: [
    {
      team_id: "team-1",
      team_name: "Team One",
      state: "READY",
      blockers: [],
      project_profile_reference: ref
    }
  ],
  formal_binding: { status: "BOUND", binding_digest: "b".repeat(64) }
} as ProjectAwareCourseReadiness;

function input(overrides: Partial<Parameters<typeof buildM2P4TeacherLiveRoundOps>[0]> = {}) {
  return {
    actorAllowedActions: ["round:lock", "settlement:settle", "round:publish", "result:read"],
    auditLogs: [],
    course,
    decisions: [decision],
    projectReadiness: readiness,
    roleSnapshots: new Map([[team.team_id, roleSnapshot()]]),
    round,
    run,
    settlement: null,
    teams: [team],
    ...overrides
  };
}

describe("M2-P4 live round operations projection", () => {
  it("reports exact Project/Role/Decision readiness and a server-owned lock command", () => {
    const projection = buildM2P4TeacherLiveRoundOps(input());

    expect(projection.session_command).toMatchObject({
      primary_action: "round:lock",
      authority: "server"
    });
    expect(projection.round.lock_ready).toBe(true);
    expect(projection.teams[0]).toMatchObject({
      team_id: "team-1",
      project: { state: "READY", project_profile_reference: ref },
      role: { state: "READY", missing_role_keys: [] },
      decision: {
        state: "READY",
        canonical_decision_id: "decision-1",
        team_confirmation_id: "confirmation-1",
        merge_commit_id: "merge-1"
      }
    });
  });

  it("does not treat Team Confirmation as a canonical Decision or lock readiness", () => {
    const snapshot = roleSnapshot({ decisions: [] });
    const projection = buildM2P4TeacherLiveRoundOps(
      input({ decisions: [], roleSnapshots: new Map([[team.team_id, snapshot]]) })
    );

    expect(projection.teams[0]?.decision.state).toBe("BLOCKED");
    expect(projection.teams[0]?.decision.team_confirmation_id).toBe("confirmation-1");
    expect(projection.round.lock_ready).toBe(false);
    expect(projection.round.blockers).toContain("team-1:canonical_decision_missing");
  });

  it("marks stale role sections and conflicting canonical candidates as blocked", () => {
    const stale = roleSnapshot({
      sections: roleSnapshot().sections.map((section) => ({ ...section, status: "draft" }))
    });
    const conflicting = { ...decision, decision_id: "decision-2" } as Decision;
    const projection = buildM2P4TeacherLiveRoundOps(
      input({
        decisions: [decision, conflicting],
        roleSnapshots: new Map([[team.team_id, stale]])
      })
    );

    expect(projection.teams[0]?.role.state).toBe("BLOCKED");
    expect(projection.teams[0]?.decision.state).toBe("CONFLICTING");
    expect(projection.round.lock_ready).toBe(false);
  });

  it("keeps settlement and publication task states distinct and exposes exact receipts", () => {
    const locked = {
      ...round,
      status: "locked",
      decision_batch_id: "batch_run-1_1_digest"
    } as Round;
    const projection = buildM2P4TeacherLiveRoundOps(input({ round: locked }));

    expect(projection.round.status).toBe("locked");
    expect(projection.settlement.status).toBe("READY");
    expect(projection.publication.status).toBe("NOT_READY");
    expect(projection.receipts.lock?.decision_batch_id).toBe("batch_run-1_1_digest");
  });
});

describe("M2-P4 student project context", () => {
  it("returns only exact role-safe Project context and never result truth fields", () => {
    const brief: ProjectProfileStudentBrief = {
      brief_kind: "PROJECT_BRIEF",
      customer_segment: "families",
      description: "Safe brief",
      geography: "Shanghai",
      industry: "eldercare",
      known_limits: ["Project context is not settlement truth."],
      market_world_reference: {} as ProjectProfileStudentBrief["market_world_reference"],
      positioning: "trusted care",
      project_profile_reference: ref,
      service_bundle: "care",
      title: "Team One project"
    };
    const context = buildM2P4StudentProjectContext({
      brief,
      course_id: "course-1",
      round_id: "round-1",
      round_no: 1,
      run_id: "run-1",
      team_id: "team-1",
      tenant_id: "tenant-1"
    });

    expect(context).toMatchObject({
      exact_scope: {
        tenant_id: "tenant-1",
        course_id: "course-1",
        run_id: "run-1",
        round_id: "round-1",
        round_no: 1,
        team_id: "team-1"
      },
      project_profile_reference: ref,
      title: "Team One project"
    });
    expect(context).not.toHaveProperty("state_true");
    expect(context).not.toHaveProperty("score");
    expect(context).not.toHaveProperty("rank");
  });
});
