/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  M2P5DecisionLearningResponse,
  W3OfficialConsequenceResponse
} from "@simwar/shared-contracts";
import {
  P2B_TEACHER_STAGES,
  TeacherDebriefWorkspace
} from "../../apps/teacher/src/P2BTeacherDebriefWorkspace";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const context = {
  activity_id: "activity-consequence",
  course_id: "course-001",
  role_key: "CEO",
  round_id: "round-003",
  round_no: 3,
  run_id: "run-001",
  team_id: "team-001",
  tenant_id: "tenant-001"
} as const;

const response = {
  record: {
    publication: { status: "PUBLISHED" },
    official_result: {
      outcome_label: "official_published",
      profit_band: "healthy",
      rank: 2,
      score: 84,
      team_id: "team-001"
    },
    decision_story: {
      decision_summary: "团队先提高增长投入，再调整渠道节奏。",
      consequence_summary: "触达提升，同时带来履约压力。"
    },
    causal_debrief: { label: "model_conditioned_association", statements: ["保持为条件关联。"] },
    learning: {
      evidence_selection_status: "SELECTED",
      next_round_hypothesis_status: "READY",
      teacher_confirmation_status: "CONFIRMED"
    },
    operating_world_consequence_trace: {
      schema_version: "operating-world-consequence-trace.v1",
      trace_id: "operating_world_trace_teacher_1",
      scope: {
        tenant_id: "tenant-001",
        course_id: "course-001",
        run_id: "run-001",
        round_no: 3,
        team_id: "team-001"
      },
      operating_world_binding_digest: "c".repeat(64),
      canonical_decision_ref: "decision-001",
      w4_action_ref: "capital-action-001",
      w4_replay_manifest_ref: "manifest-001",
      settlement_result_ref: "settlement-001",
      replay_relevant_digest: "d".repeat(64),
      publication: { status: "PUBLISHED" },
      allowed_effects: [],
      constraints: ["Teacher-safe"],
      known_limits: ["Bounded"],
      source_classification: "OFFICIAL_CONSUMER_ELIGIBLE",
      official_delta: "WHITELISTED_ONLY",
      writes_official_state: false,
      causal_authority: "DETERMINISTIC_SYSTEM_FACTS",
      ai_generated: false
    },
    known_limits: ["机制解释不是因果证明"],
    source: {} as never,
    context,
    record_id: "w3-record-001",
    runtime_authority: "JSON_INTERNAL_ONLY",
    schema_version: "w3-official-consequence-learning.v1"
  },
  known_limits: ["机制解释不是因果证明"],
  runtime_authority: "JSON_INTERNAL_ONLY",
  visibility: "teacher_safe"
} as unknown as W3OfficialConsequenceResponse;

const exactRef = (
  resourceType: "canonical_decision" | "round" | "settlement_result",
  resourceId: string,
  digest: string
) => ({
  content_digest: digest.repeat(64),
  discriminator: "exact_ref" as const,
  resource_id: resourceId,
  resource_type: resourceType,
  tenant_id: context.tenant_id,
  version: "1.0.0"
});

const crossRoundResponse = {
  schema_version: "m2p5-decision-learning-crossround.v1",
  runtime_authority: "JSON_INTERNAL_ONLY",
  visibility: "teacher_safe",
  exact_scope: context,
  official_consequence: response,
  learning: { gate: "READY" },
  project_context: { status: "RESOLVED", title: "Shanghai care project" },
  cross_round: {
    status: "ENTRY_READY",
    entry_status: "OPEN",
    blocker_codes: []
  },
  learning_loop: {
    schema_version: "m2p6-teacher-debrief-learning-transfer.v1",
    status: "READY",
    exact_context: context,
    canonical_decision_ref: exactRef("canonical_decision", "decision-001", "a"),
    published_consequence_ref: {
      record_id: "w3-record-001",
      round_ref: exactRef("round", context.round_id, "b"),
      settlement_ref: exactRef("settlement_result", "settlement-001", "c")
    },
    teacher_confirmation_status: "CONFIRMED",
    teacher_debrief_availability: "AVAILABLE",
    student_learning_report_status: "CONFIRMED",
    reflection_status: "SUBMITTED",
    what_if_availability: "AVAILABLE",
    transfer_status: "READY",
    next_opening_state_readiness: "ENTRY_READY",
    blockers: [],
    allowed_actions: ["PREPARE_DEBRIEF", "REVIEW_TRANSFER"],
    recovery_state: "EXACT_CONTEXT_RESTORED",
    source_receipts: [
      exactRef("canonical_decision", "decision-001", "a"),
      exactRef("round", context.round_id, "b"),
      exactRef("settlement_result", "settlement-001", "c")
    ],
    provenance_refs: [
      exactRef("canonical_decision", "decision-001", "a"),
      exactRef("round", context.round_id, "b"),
      exactRef("settlement_result", "settlement-001", "c")
    ]
  },
  known_limits: ["Human Validation is not performed."]
} as unknown as M2P5DecisionLearningResponse;

describe("P2-B FE-20 teacher debrief", () => {
  it("freezes the five Figma stages", () => {
    expect(P2B_TEACHER_STAGES).toEqual([
      "today",
      "highest_blocker",
      "cohort_progress",
      "teachable_moment",
      "debrief_prep"
    ]);
  });

  it("renders teacher-safe stages without raw JSON or private judgment text", () => {
    const markup = renderToStaticMarkup(
      <TeacherDebriefWorkspace
        apiBase="http://api.test"
        tenantId="tenant-001"
        token="token"
        context={undefined}
        response={response}
        blockerSummary="等待团队提交并完成正式结果复盘"
        teamCount={6}
      />
    );
    for (const stage of P2B_TEACHER_STAGES) {
      expect(markup).toContain(`data-testid="teacher-p2b-${stage}"`);
    }
    expect(markup).toContain("今日课堂");
    expect(markup).toContain("最高阻断");
    expect(markup).toContain("团队学习进度");
    expect(markup).toContain("可教学时刻");
    expect(markup).toContain("复盘准备");
    expect(markup).toContain("teacher-safe projection");
    expect(markup).toContain("课堂笔记草稿（本地）");
    expect(markup).toContain("不会写入正式结果");
    expect(markup).toContain("暂无 teacher-safe 团队学习进度投影");
    expect(markup).toContain('data-testid="teacher-p2b-today-blocker-cta"');
    expect(markup).toContain('data-testid="teacher-p2b-blocker-prep-cta"');
    expect(markup).toContain('data-testid="teacher-p2b-teachable-ask"');
    expect(markup).toContain('data-testid="teacher-p2b-teachable-show"');
    expect(markup).toContain('data-testid="teacher-p2b-teachable-listen"');
    expect(markup).toContain('data-testid="teacher-p2b-prep-blocker"');
    expect(markup).toContain('data-testid="teacher-p2b-operating-world-trace"');
    expect(markup).toContain("capital-action-001");
    expect(markup).toContain("manifest-001");
    expect(markup).not.toContain(">A<");
    expect(markup).not.toContain(">B<");
    expect(markup).not.toContain("private peer drafts");
    expect(markup).not.toContain("Exact Ref JSON 数组");
  });

  it("consumes governed teacher advisory inside the exact debrief journey", () => {
    const markup = renderToStaticMarkup(
      <TeacherDebriefWorkspace
        apiBase="http://api.test"
        tenantId={context.tenant_id}
        token="token"
        context={context}
        response={response}
        advisoryContext={{
          course_id: context.course_id,
          run_id: context.run_id,
          round_id: context.round_id,
          team_id: context.team_id
        }}
        governedAdvisory={
          <section data-testid="teacher-debrief-advisor-composed">
            Evidence Citation · Evaluation · Fallback · Known Limits · Provider OFF · advisory-only
          </section>
        }
        intelligenceWorkspace={
          <section data-testid="teacher-intelligence-workspace-composed">
            exact decision/debrief workspace
          </section>
        }
      />
    );

    expect(markup).toContain('data-testid="teacher-debrief-advisor-composed"');
    expect(markup).toContain('data-testid="teacher-intelligence-workspace-composed"');
    expect(markup).toContain("course-001");
    expect(markup).toContain("run-001");
    expect(markup).toContain("round-003");
    expect(markup).toContain("team-001");
    expect(markup).toContain("Provider OFF");
  });

  it("does not expose composed advisory surfaces without exact teacher context", () => {
    const markup = renderToStaticMarkup(
      <TeacherDebriefWorkspace
        apiBase="http://api.test"
        tenantId={context.tenant_id}
        token="token"
        response={response}
        governedAdvisory={
          <section data-testid="teacher-debrief-advisor-composed">advisory</section>
        }
        intelligenceWorkspace={
          <section data-testid="teacher-intelligence-workspace-composed">workspace</section>
        }
      />
    );

    expect(markup).not.toContain('data-testid="teacher-debrief-advisor-composed"');
    expect(markup).not.toContain('data-testid="teacher-intelligence-workspace-composed"');
  });

  it("renders the governed teacher M2P6 chain as read-only server state", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const data = String(input).includes("/m2p5/") ? crossRoundResponse : response;
      return new Response(JSON.stringify({ data }), { status: 200 });
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <TeacherDebriefWorkspace
          apiBase="http://api.test"
          tenantId={context.tenant_id}
          token="token"
          context={context}
          crossRoundEnabled
        />
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const region = host.querySelector('[data-testid="teacher-m2p6-learning-loop"]');
    expect(region).not.toBeNull();
    expect(region?.textContent).toContain(
      "Published Consequence → Evidence → D3 → Debrief → Transfer"
    );
    expect(region?.textContent).toContain("READY");
    expect(region?.textContent).toContain("PREPARE_DEBRIEF");
    expect(region?.textContent).toContain("decision-001");
    expect(region?.querySelectorAll("button")).toHaveLength(0);
    expect(host.querySelector('[data-testid="teacher-m2p6-recovery"]')?.textContent).toContain(
      "EXACT_CONTEXT_RESTORED"
    );
    root.unmount();
    host.remove();
    fetchSpy.mockRestore();
  });
});
