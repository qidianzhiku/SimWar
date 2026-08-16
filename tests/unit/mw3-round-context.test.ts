import { describe, expect, it } from "vitest";
import type { Round, TeacherBffWorkspaceDTO } from "../../packages/shared-contracts/src";
import {
  createTeacherRoundContext,
  getTeacherRoundCommandPath,
  getTeacherRoundStatusLabel,
  getTeacherRunRounds,
  isTeacherRoundWorkspaceForContext,
  selectTeacherRound,
  sortTeacherRounds
} from "../../apps/teacher/src/round-context";

function round(input: Partial<Round> & Pick<Round, "round_id" | "round_no" | "status">): Round {
  return {
    round_id: input.round_id,
    round_no: input.round_no,
    run_id: input.run_id ?? "run-1",
    status: input.status,
    tenant_id: input.tenant_id ?? "tenant-1",
    ...(input.decision_batch_id ? { decision_batch_id: input.decision_batch_id } : {}),
    ...(input.replay_hash ? { replay_hash: input.replay_hash } : {})
  };
}

function workspace(roundValue: Round): TeacherBffWorkspaceDTO {
  const common = {
    actor_role: "teacher" as const,
    allowed_actions: ["course:read", "round:start"] as const,
    audit_reference: [],
    course_id: "course-1",
    evidence_label: "RUNTIME_ENTRYPOINT_EVIDENCE" as const,
    explicit_non_proof: [],
    redacted_fields: [],
    source_runtime_path: [],
    tenant_id: roundValue.tenant_id,
    run_id: roundValue.run_id
  };

  return {
    course_workspace: {
      ...common,
      visible_state: { course_title: "课程", run_status: "active" }
    },
    round_control: {
      ...common,
      round_id: roundValue.round_id,
      round_no: roundValue.round_no,
      status: roundValue.status,
      visible_state: { decision_count: 0, settlement_available: false, team_count: 1 }
    },
    teacher_dashboard: {
      ...common,
      visible_state: { course_status: "published", round_status: roundValue.status, team_count: 1 }
    },
    teacher_replay_summary: {
      ...common,
      authorized_result_snapshot: [],
      formal_truth_write_allowed: false,
      visible_state: { result_count: 0, runtime_boundary: "json_default" }
    },
    team_monitor: {
      ...common,
      teams: [],
      visible_state: { decision_count: 0, team_count: 1 }
    }
  };
}

describe("MW3 TeacherRoundContext", () => {
  it("RC01 selects Round 2 when Round 1 is published and Round 2 is actionable", () => {
    const rounds = [
      round({ round_id: "round-2", round_no: 2, status: "draft" }),
      round({ round_id: "round-1", round_no: 1, status: "published" })
    ];

    expect(selectTeacherRound(rounds)?.round_id).toBe("round-2");
  });

  it("RC02 and RC17 use exact selected identity and never silently fall back to Round 1", () => {
    const rounds = [
      round({ round_id: "round-1", round_no: 1, status: "published" }),
      round({ round_id: "round-2", round_no: 2, status: "open" })
    ];

    expect(selectTeacherRound(rounds, "round-2")?.round_no).toBe(2);
    expect(selectTeacherRound(rounds, "missing-round")).toBeUndefined();
  });

  it("sorts by round number and stable id rather than repository array order", () => {
    const rounds = [
      round({ round_id: "round-b", round_no: 2, status: "open" }),
      round({ round_id: "round-1", round_no: 1, status: "published" }),
      round({ round_id: "round-a", round_no: 2, status: "draft" })
    ];

    expect(sortTeacherRounds(rounds).map((item) => item.round_id)).toEqual([
      "round-1",
      "round-a",
      "round-b"
    ]);
  });

  it("scopes the round list to the exact Run", () => {
    const rounds = [
      round({ round_id: "other", round_no: 2, run_id: "run-2", status: "open" }),
      round({ round_id: "same", round_no: 2, run_id: "run-1", status: "draft" })
    ];

    expect(getTeacherRunRounds(rounds, "run-1").map((item) => item.round_id)).toEqual(["same"]);
  });

  it("keeps legacy projections without tenant metadata selectable but rejects known foreign tenants", () => {
    const legacyProjection = {
      round_id: "legacy-round",
      round_no: 1,
      run_id: "run-1",
      status: "draft"
    } as Round;
    const foreign = round({
      round_id: "foreign-round",
      run_id: "run-1",
      status: "draft",
      tenant_id: "tenant-2"
    });

    expect(getTeacherRunRounds([legacyProjection, foreign], "run-1", "tenant-1")).toEqual([
      legacyProjection
    ]);
  });

  it("RC03-RC06 constructs the formal command URL for the selected Round N", () => {
    expect(getTeacherRoundCommandPath("run/2", 2, "round:start")).toBe(
      "/api/v1/runs/run%2F2/rounds/2/start"
    );
    expect(getTeacherRoundCommandPath("run-2", 2, "round:lock")).toBe(
      "/api/v1/runs/run-2/rounds/2/lock"
    );
    expect(getTeacherRoundCommandPath("run-2", 2, "settlement:settle")).toBe(
      "/api/v1/runs/run-2/rounds/2/settle"
    );
    expect(getTeacherRoundCommandPath("run-2", 2, "round:publish")).toBe(
      "/api/v1/runs/run-2/rounds/2/publish"
    );
  });

  it("RC08 and RC09 expose one exact, server-consumable context", () => {
    const selected = round({ round_id: "round-2", round_no: 2, status: "open" });
    expect(
      createTeacherRoundContext({
        tenantId: "tenant-1",
        courseId: "course-1",
        round: selected,
        allowedActions: ["round:lock"]
      })
    ).toEqual({
      tenant_id: "tenant-1",
      course_id: "course-1",
      run_id: "run-1",
      round_id: "round-2",
      round_no: 2,
      round_status: "open",
      is_actionable: true,
      allowed_actions: ["round:lock"]
    });
  });

  it("RC12 marks published history read-only", () => {
    const selected = round({ round_id: "round-1", round_no: 1, status: "published" });
    expect(
      createTeacherRoundContext({
        tenantId: "tenant-1",
        courseId: "course-1",
        round: selected,
        allowedActions: []
      }).is_actionable
    ).toBe(false);
    expect(getTeacherRoundStatusLabel("published")).toBe("已发布");
  });

  it("RC10 and RC16 require the BFF receipt/projection to match the selected identity", () => {
    const selected = round({ round_id: "round-2", round_no: 2, status: "draft" });
    const accepted = workspace(selected);
    expect(
      isTeacherRoundWorkspaceForContext(accepted, {
        tenantId: "tenant-1",
        courseId: "course-1",
        runId: "run-1",
        roundId: "round-2",
        roundNo: 2
      })
    ).toBe(true);
    expect(
      isTeacherRoundWorkspaceForContext(accepted, {
        tenantId: "tenant-1",
        courseId: "course-1",
        runId: "run-1",
        roundId: "round-1",
        roundNo: 1
      })
    ).toBe(false);
  });
});
