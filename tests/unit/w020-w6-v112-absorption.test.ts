import { describe, expect, it } from "vitest";
import type { CurrentUser, W020AdvisoryRecord } from "@simwar/shared-contracts";
import { GovernedAdvisoryService } from "../../services/api/src/w020-advisory-service.js";

const student: CurrentUser = {
  display_name: "Student",
  permissions: ["course:read"],
  roles: ["student"],
  team_id: "team_001",
  tenant_id: "tenant_demo",
  user_id: "usr_student"
};

const teacher: CurrentUser = {
  display_name: "Teacher",
  permissions: ["course:read"],
  roles: ["teacher"],
  tenant_id: "tenant_demo",
  user_id: "usr_teacher"
};

function snapshotWithEvents(eventRows: Array<{ event_id: string; event_type: string }>) {
  return {
    course: { course_id: "course_001", tenant_id: "tenant_demo" },
    run: { run_id: "run_001", course_id: "course_001", tenant_id: "tenant_demo" },
    round: { round_id: "round_001", run_id: "run_001", tenant_id: "tenant_demo" },
    team: { team_id: "team_001", course_id: "course_001", tenant_id: "tenant_demo" },
    assignments: [
      { assignment_id: "assignment_001", status: "active", role_key: "CEO", user_id: "usr_student" }
    ],
    sections: [],
    merge_commits: [],
    confirmations: [],
    decisions: [],
    events: eventRows.map((event, index) => ({
      ...event,
      created_at: `2026-08-30T00:0${index}:00.000Z`,
      round_id: "round_001"
    }))
  } as never;
}

function createService(currentSnapshot: { value: unknown }, records: W020AdvisoryRecord[]) {
  return new GovernedAdvisoryService({
    repository: {
      list: async () => structuredClone(records),
      append: async (record) => records.push(structuredClone(record))
    },
    roleWorkflow: {
      readRoleWorkflow: async () => currentSnapshot.value,
      commitRoleWorkflow: async () => undefined
    }
  });
}

describe("W020 MAIN-W6 absorptive integration P2 contract", () => {
  it("generates a refreshed advisory when the same client identity sees new server workflow context", async () => {
    const records: W020AdvisoryRecord[] = [];
    const currentSnapshot = {
      value: snapshotWithEvents([{ event_id: "event_001", event_type: "section_saved" }])
    };
    const service = createService(currentSnapshot, records);
    const request = {
      discriminator: "w020_advisory_request" as const,
      idempotency_key: "student-refresh-001",
      round_id: "round_001",
      run_id: "run_001",
      role_key: "CEO" as const,
      surface: "student_role" as const,
      team_id: "team_001"
    };

    const first = await service.createStudentRoleAdvisory(student, request, "req-1");
    currentSnapshot.value = snapshotWithEvents([
      { event_id: "event_001", event_type: "section_saved" },
      { event_id: "event_002", event_type: "section_ready" }
    ]);
    const refreshed = await service.createStudentRoleAdvisory(student, request, "req-2");
    const reused = await service.createStudentRoleAdvisory(student, request, "req-3");

    expect(first.status).toBe("generated");
    expect(refreshed.status).toBe("generated");
    expect(refreshed.context.source_event_ids).toEqual(["event_001", "event_002"]);
    expect(reused.status).toBe("reused");
    expect(records).toHaveLength(2);
  });

  it("keeps coach output, projection refs, and citations on the post-reset evidence set", async () => {
    const records: W020AdvisoryRecord[] = [];
    const currentSnapshot = {
      value: snapshotWithEvents([
        { event_id: "pre_reset", event_type: "section_saved" },
        { event_id: "reset_001", event_type: "workflow_reset" },
        { event_id: "post_reset", event_type: "section_ready" }
      ])
    };
    const service = createService(currentSnapshot, records);
    const receipt = await service.createAdvisory(
      student,
      {
        discriminator: "w020_advisory_request",
        idempotency_key: "reset-consistency-001",
        role_key: "CEO",
        round_id: "round_001",
        run_id: "run_001",
        surface: "student_coach",
        team_id: "team_001"
      },
      "req-reset"
    );

    expect(receipt.coach_output.evidence_refs).toEqual(["event:post_reset"]);
    expect(receipt.projection.evidence_refs).toEqual(["event:post_reset"]);
    expect(receipt.projection.evidence_citations).toEqual([
      {
        citation_id: "event:post_reset",
        label: "section_ready",
        source_id: "post_reset",
        source_type: "workflow_event"
      }
    ]);
    expect(JSON.stringify(receipt.projection)).not.toContain("pre_reset");
  });

  it("derives stage-aware student coaching from an interleaved selected-team multi-role stream", async () => {
    const service = createService(
      {
        value: snapshotWithEvents([
          { event_id: "ready", event_type: "section_ready" },
          { event_id: "saved", event_type: "section_saved" }
        ])
      },
      []
    );
    const receipt = await service.createStudentRoleAdvisory(
      student,
      {
        discriminator: "w020_advisory_request",
        idempotency_key: "interleaved-001",
        role_key: "CEO",
        round_id: "round_001",
        run_id: "run_001",
        surface: "student_role",
        team_id: "team_001"
      },
      "req-interleaved"
    );

    expect(receipt.coach_output.advisory_text).toContain("ROLE_CONTRIBUTION_DRAFTED");
    expect(receipt.coach_output.advisory_text).toContain("Role lens [CEO]");
  });

  it("explains that a team-confirmed canonical decision is no longer editable", async () => {
    const service = createService(
      { value: snapshotWithEvents([{ event_id: "confirmed", event_type: "team_confirmed" }]) },
      []
    );
    const receipt = await service.createStudentRoleAdvisory(
      student,
      {
        discriminator: "w020_advisory_request",
        idempotency_key: "confirmed-001",
        role_key: "CEO",
        round_id: "round_001",
        run_id: "run_001",
        surface: "student_role",
        team_id: "team_001"
      },
      "req-confirmed"
    );

    expect(receipt.coach_output.output_type).toBe("explanation");
    expect(receipt.coach_output.advisory_text).toContain("no longer editable");
  });

  it("keeps a changed client surface on the duplicate-conflict path", async () => {
    const records: W020AdvisoryRecord[] = [];
    const service = createService(
      { value: snapshotWithEvents([{ event_id: "event_001", event_type: "section_saved" }]) },
      records
    );
    await service.createAdvisory(
      teacher,
      {
        discriminator: "w020_advisory_request",
        idempotency_key: "client-scope-001",
        round_id: "round_001",
        run_id: "run_001",
        surface: "teacher_copilot",
        team_id: "team_001"
      },
      "req-surface-1"
    );

    await expect(
      service.createAdvisory(
        teacher,
        {
          discriminator: "w020_advisory_request",
          idempotency_key: "client-scope-001",
          round_id: "round_001",
          run_id: "run_001",
          surface: "rubric_assistant",
          team_id: "team_001"
        },
        "req-surface-2"
      )
    ).rejects.toMatchObject({ code: "W020_DUPLICATE_CONFLICT" });
  });

  it("keeps a changed client team binding on the duplicate-conflict path", async () => {
    const records: W020AdvisoryRecord[] = [];
    const service = createService(
      { value: snapshotWithEvents([{ event_id: "event_001", event_type: "section_saved" }]) },
      records
    );
    await service.createAdvisory(
      teacher,
      {
        discriminator: "w020_advisory_request",
        idempotency_key: "client-scope-team-001",
        round_id: "round_001",
        run_id: "run_001",
        surface: "teacher_copilot",
        team_id: "team_001"
      },
      "req-team-1"
    );

    await expect(
      service.createAdvisory(
        teacher,
        {
          discriminator: "w020_advisory_request",
          idempotency_key: "client-scope-team-001",
          round_id: "round_001",
          run_id: "run_001",
          surface: "teacher_copilot",
          team_id: "team_002"
        },
        "req-team-2"
      )
    ).rejects.toMatchObject({ code: "W020_DUPLICATE_CONFLICT" });
  });
});
