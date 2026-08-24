/** @vitest-environment jsdom */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { W3OfficialConsequenceResponse } from "@simwar/shared-contracts";
import {
  P2B_TEACHER_STAGES,
  TeacherDebriefWorkspace
} from "../../apps/teacher/src/P2BTeacherDebriefWorkspace";

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
      scope: { tenant_id: "tenant-001", course_id: "course-001", run_id: "run-001", round_no: 3, team_id: "team-001" },
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
    context: {} as never,
    record_id: "w3-record-001",
    runtime_authority: "JSON_INTERNAL_ONLY",
    schema_version: "w3-official-consequence-learning.v1"
  },
  known_limits: ["机制解释不是因果证明"],
  runtime_authority: "JSON_INTERNAL_ONLY",
  visibility: "teacher_safe"
} as unknown as W3OfficialConsequenceResponse;

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
});
