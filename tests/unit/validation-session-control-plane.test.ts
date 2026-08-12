import { describe, expect, it } from "vitest";
import { createJsonRepositoryProvider } from "../../services/api/src/repository-provider";
import { createP1Store } from "../../services/api/src/store";
import {
  ValidationSessionControlPlane,
  ValidationSessionControlPlaneError
} from "../../services/api/src/validation-session-control-plane";
import type { CurrentUser } from "@simwar/shared-contracts";

const actor: CurrentUser = {
  user_id: "usr_teacher",
  tenant_id: "tenant_demo",
  display_name: "Teacher",
  roles: ["teacher"],
  permissions: ["course:read"]
};
const input = {
  source_product_merge_sha: "31b8c5f5cd3ab0426bb02bc75495b8552e497c48",
  course_id: "course_demo",
  run_id: "run_demo",
  machine_admission_reference: "w022-admission",
  machine_admission_digest: "a".repeat(64),
  idempotency_key: "create-one"
};

function plane() {
  const store = createP1Store();
  store.runs.push({
    run_id: "run_demo",
    tenant_id: "tenant_demo",
    course_id: "course_demo",
    scenario_package_id: "scenario_eldercare_demo",
    parameter_set_id: "param_toy_approved_1",
    seed: 1,
    status: "active"
  });
  const roles = ["CEO", "CFO", "CMO", "COO"] as const;
  const members = roles.map((role, index) => ({
    user_id: ["usr_student", "usr_default_cfo", "usr_default_cmo", "usr_default_coo"][index]!,
    display_name: `P0 ${role}`,
    role_slot: role
  }));
  store.teams[0]!.members = members;
  store.teams.push({
    team_id: "team_beta",
    tenant_id: "tenant_demo",
    course_id: "course_demo",
    name: "Beta synthetic team",
    captain_user_id: "usr_student",
    members
  });
  for (const team of store.teams) {
    for (const member of team.members) {
      store.studentRoleAssignments.push({
        assignment_id: `assignment_${team.team_id}_${member.role_slot}`,
        tenant_id: team.tenant_id,
        course_id: team.course_id,
        run_id: "run_demo",
        team_id: team.team_id,
        user_id: member.user_id,
        role_key: member.role_slot,
        role_template_id: `template_${member.role_slot}`,
        status: "active",
        source: "seeded_default",
        assigned_by: "usr_teacher",
        assigned_at: "2026-08-12T00:00:00.000Z"
      });
    }
  }
  return new ValidationSessionControlPlane(createJsonRepositoryProvider({ store }));
}

describe("W023 ValidationSession control plane", () => {
  it("creates idempotently, rejects conflicting retries, and keeps synthetic mode", async () => {
    const control = plane();
    const first = await control.create(actor, actor.tenant_id, input, "req-1");
    const second = await control.create(actor, actor.tenant_id, input, "req-2");
    expect(second.session_id).toBe(first.session_id);
    await expect(
      control.create(actor, actor.tenant_id, { ...input, run_id: "other-run" }, "req-3")
    ).rejects.toMatchObject({ code: "W023_SESSION-409-001" });
    await expect(
      control.create(
        actor,
        actor.tenant_id,
        { ...input, machine_admission_reference: "different-admission" },
        "req-4"
      )
    ).rejects.toMatchObject({ code: "W023_SESSION-409-001" });
    expect(first.execution_mode).toBe("SYNTHETIC_REHEARSAL");
  });

  it("rechecks authoritative W022 admission readiness before PREFLIGHT_READY", async () => {
    const store = createP1Store();
    store.runs.push({
      run_id: "run_incomplete",
      tenant_id: "tenant_demo",
      course_id: "course_demo",
      scenario_package_id: "scenario_eldercare_demo",
      parameter_set_id: "param_toy_approved_1",
      seed: 1,
      status: "active"
    });
    store.teams.push({
      team_id: "team_incomplete",
      tenant_id: "tenant_demo",
      course_id: "course_demo",
      name: "Incomplete synthetic team",
      captain_user_id: "usr_student",
      members: [{ user_id: "usr_student", display_name: "P0 Student", role_slot: "CEO" }]
    });
    const control = new ValidationSessionControlPlane(createJsonRepositoryProvider({ store }));
    const session = await control.create(
      actor,
      actor.tenant_id,
      { ...input, run_id: "run_incomplete" },
      "req-incomplete-1"
    );
    await control.setRoster(
      actor,
      actor.tenant_id,
      session.session_id,
      [
        {
          participant_id: "teacher",
          session_duty: "TEACHER",
          participant_kind: "SYNTHETIC",
          product_user_id: "usr_teacher"
        },
        {
          participant_id: "learner",
          session_duty: "LEARNER",
          participant_kind: "SYNTHETIC",
          product_user_id: "usr_student",
          team_id: "team_incomplete",
          role_key: "CEO"
        },
        { participant_id: "moderator", session_duty: "MODERATOR", participant_kind: "SYNTHETIC" },
        { participant_id: "observer", session_duty: "OBSERVER", participant_kind: "SYNTHETIC" },
        { participant_id: "recorder", session_duty: "RECORDER", participant_kind: "SYNTHETIC" }
      ],
      "req-incomplete-2"
    );
    const preflight = await control.preflight(
      actor,
      actor.tenant_id,
      session.session_id,
      "req-incomplete-3"
    );
    expect(preflight.preflight?.status).toBe("BLOCKED");
    expect(preflight.preflight?.reasons).toContain("W022_ADMISSION_NOT_READY");
  });

  it("requires all duties, preflight, and freezes roster at LIVE", async () => {
    const control = plane();
    const session = await control.create(actor, actor.tenant_id, input, "req-1");
    const participants = [
      {
        participant_id: "teacher",
        session_duty: "TEACHER",
        participant_kind: "SYNTHETIC",
        product_user_id: "usr_teacher"
      },
      {
        participant_id: "learner",
        session_duty: "LEARNER",
        participant_kind: "SYNTHETIC",
        product_user_id: "usr_student",
        team_id: "team_alpha",
        role_key: "CEO"
      },
      { participant_id: "moderator", session_duty: "MODERATOR", participant_kind: "SYNTHETIC" },
      { participant_id: "observer", session_duty: "OBSERVER", participant_kind: "SYNTHETIC" },
      { participant_id: "recorder", session_duty: "RECORDER", participant_kind: "SYNTHETIC" }
    ] as const;
    await expect(
      control.setRoster(actor, actor.tenant_id, session.session_id, participants as never, "req-2")
    ).resolves.toMatchObject({ status: "DRAFT" });
    const preflight = await control.preflight(actor, actor.tenant_id, session.session_id, "req-3");
    expect(preflight.preflight?.status).toBe("PREFLIGHT_READY");
    const live = await control.start(actor, actor.tenant_id, session.session_id, "req-4");
    expect(live.status).toBe("LIVE");
    await expect(
      control.setRoster(actor, actor.tenant_id, session.session_id, participants as never, "req-5")
    ).rejects.toMatchObject({ code: "W023_SESSION-409-002" });
  });

  it("captures bounded evidence and emits deterministic non-human claims on close", async () => {
    const control = plane();
    const session = await control.create(actor, actor.tenant_id, input, "req-1");
    const participants = [
      {
        participant_id: "teacher",
        session_duty: "TEACHER",
        participant_kind: "SYNTHETIC",
        product_user_id: "usr_teacher"
      },
      {
        participant_id: "learner",
        session_duty: "LEARNER",
        participant_kind: "SYNTHETIC",
        product_user_id: "usr_student",
        team_id: "team_alpha",
        role_key: "CEO"
      },
      { participant_id: "moderator", session_duty: "MODERATOR", participant_kind: "SYNTHETIC" },
      { participant_id: "observer", session_duty: "OBSERVER", participant_kind: "SYNTHETIC" },
      { participant_id: "recorder", session_duty: "RECORDER", participant_kind: "SYNTHETIC" }
    ] as const;
    await control.setRoster(
      actor,
      actor.tenant_id,
      session.session_id,
      participants as never,
      "req-2"
    );
    await control.preflight(actor, actor.tenant_id, session.session_id, "req-3");
    await control.start(actor, actor.tenant_id, session.session_id, "req-4");
    await expect(
      control.appendObservation(
        actor,
        actor.tenant_id,
        session.session_id,
        {
          participant_id: "observer",
          session_duty: "OBSERVER",
          phase: "LIVE",
          category: "flow",
          narrative: "bounded synthetic observation",
          evidence_refs: [],
          unexpected: true
        } as never,
        "req-4b"
      )
    ).rejects.toMatchObject({ code: "W023_OBSERVATION-422-001" });
    await control.appendObservation(
      actor,
      actor.tenant_id,
      session.session_id,
      {
        participant_id: "observer",
        session_duty: "OBSERVER",
        phase: "LIVE",
        category: "flow",
        narrative: "bounded synthetic observation",
        evidence_refs: []
      },
      "req-5"
    );
    await control.appendIncident(
      actor,
      actor.tenant_id,
      session.session_id,
      {
        severity: "LOW",
        phase: "LIVE",
        description: "bounded synthetic incident",
        evidence_refs: [],
        resolution_state: "RESOLVED"
      },
      "req-5b"
    );
    await expect(
      control.appendIncident(
        actor,
        actor.tenant_id,
        session.session_id,
        {
          severity: "LOW",
          phase: "LIVE",
          description: "bounded synthetic incident",
          evidence_refs: [],
          resolution_state: "RESOLVED",
          unexpected: true
        } as never,
        "req-5c"
      )
    ).rejects.toMatchObject({ code: "W023_INCIDENT-422-001" });
    await expect(
      control.appendObservation(
        actor,
        actor.tenant_id,
        session.session_id,
        {
          participant_id: "observer",
          session_duty: "OBSERVER",
          phase: "LIVE",
          category: "forbidden",
          narrative: "state_true must not be captured",
          evidence_refs: []
        },
        "req-5c"
      )
    ).rejects.toMatchObject({ code: "W023_PRIVACY-422-001" });
    const closed = await control.close(actor, actor.tenant_id, session.session_id, "req-6");
    expect(closed.status).toBe("CLOSED");
    expect(closed.incidents).toHaveLength(1);
    expect(closed.evidence_bundle?.evidence_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(closed.evidence_bundle?.human_validation).toBe("NOT_PERFORMED");
    await expect(
      control.appendObservation(
        actor,
        actor.tenant_id,
        session.session_id,
        {
          participant_id: "observer",
          session_duty: "OBSERVER",
          phase: "LIVE",
          category: "flow",
          narrative: "late",
          evidence_refs: []
        },
        "req-7"
      )
    ).rejects.toMatchObject({ code: "W023_OBSERVATION-409-001" });
  });

  it("rejects forbidden private payloads and preserves cross-tenant authority", async () => {
    const control = plane();
    await expect(
      control.create({ ...actor, tenant_id: "tenant_other" }, "tenant_demo", input, "req-1")
    ).rejects.toBeInstanceOf(ValidationSessionControlPlaneError);
  });

  it("seals an abort receipt and completes cleanup explicitly", async () => {
    const control = plane();
    const session = await control.create(actor, actor.tenant_id, input, "req-abort-1");
    const participants = [
      {
        participant_id: "teacher",
        session_duty: "TEACHER",
        participant_kind: "SYNTHETIC",
        product_user_id: "usr_teacher"
      },
      {
        participant_id: "learner",
        session_duty: "LEARNER",
        participant_kind: "SYNTHETIC",
        product_user_id: "usr_student",
        team_id: "team_alpha",
        role_key: "CEO"
      },
      { participant_id: "moderator", session_duty: "MODERATOR", participant_kind: "SYNTHETIC" },
      { participant_id: "observer", session_duty: "OBSERVER", participant_kind: "SYNTHETIC" },
      { participant_id: "recorder", session_duty: "RECORDER", participant_kind: "SYNTHETIC" }
    ] as const;
    await control.setRoster(
      actor,
      actor.tenant_id,
      session.session_id,
      participants as never,
      "req-abort-2"
    );
    await control.preflight(actor, actor.tenant_id, session.session_id, "req-abort-3");
    await control.start(actor, actor.tenant_id, session.session_id, "req-abort-4");
    const aborted = await control.abort(actor, actor.tenant_id, session.session_id, "req-abort-5");
    expect(aborted.status).toBe("ABORTED");
    expect(aborted.cleanup_receipt?.status).toBe("READY");
    expect(aborted.evidence_bundle?.human_validation).toBe("NOT_PERFORMED");
    const cleaned = await control.cleanup(
      actor,
      actor.tenant_id,
      session.session_id,
      "req-abort-6"
    );
    expect(cleaned.cleanup_receipt?.status).toBe("COMPLETED");
    expect(cleaned.evidence_bundle?.evidence_digest).toMatch(/^[a-f0-9]{64}$/);
  });
});
