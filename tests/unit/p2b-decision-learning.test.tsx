/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { W3OfficialConsequenceResponse } from "@simwar/shared-contracts";
import {
  P2B_STUDENT_STAGES,
  StudentDecisionLearningJourney,
  getStudentLearningGate
} from "../../apps/student/src/P2BDecisionLearningJourney";

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
    causal_debrief: {
      label: "model_conditioned_association",
      statements: ["增长投入提升了触达，机制摘要保持为条件关联。"]
    },
    counterfactual: {
      official: false,
      changed_field: "marketing_budget",
      changed_value_digest: "a".repeat(64),
      original_value_digest: "b".repeat(64),
      counterfactual_id: "counterfactual-001",
      causal_label: "model_conditioned_association",
      exact_context_ref: {} as never,
      comparison: {
        official_score: 84,
        counterfactual_score: 79,
        score_delta: -5,
        official_rank: 2,
        counterfactual_rank: 3,
        rank_delta: 1
      }
    },
    reflection: undefined,
    next_round_hypothesis: {
      status: "READY",
      basis: "本轮机制摘要",
      hypothesis: "下一轮先验证交付节奏，再扩大增长投入。"
    },
    learning: {
      evidence_selection_status: "SELECTED",
      next_round_hypothesis_status: "READY",
      teacher_confirmation_status: "CONFIRMED"
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
  visibility: "student_safe"
} as unknown as W3OfficialConsequenceResponse;

function renderJourney(
  props: Partial<React.ComponentProps<typeof StudentDecisionLearningJourney>>
) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      <StudentDecisionLearningJourney
        apiBase="http://api.test"
        tenantId="tenant-001"
        token="token"
        context={context}
        published
        {...props}
      />
    );
  });
  return { host, root };
}

describe("P2-B FE-19 student decision learning", () => {
  it("freezes the six Figma stages", () => {
    expect(P2B_STUDENT_STAGES).toEqual([
      "result",
      "story",
      "mechanism",
      "what_if",
      "reflection",
      "transfer"
    ]);
  });

  it("blocks before publication and does not prefetch the Student learning projection", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { host, root } = renderJourney({ published: false });
    await act(async () => {
      await Promise.resolve();
    });
    expect(getStudentLearningGate(false)).toBe("blocked");
    expect(host.textContent).toContain("结果发布后，学习旅程才会开放");
    expect(fetchSpy).not.toHaveBeenCalled();
    root.unmount();
    host.remove();
    fetchSpy.mockRestore();
  });

  it("renders the six-stage journey from the real W3 safe response", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ data: response }), { status: 200 }));
    const { host, root } = renderJourney();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    for (const stage of P2B_STUDENT_STAGES) {
      expect(host.querySelector(`[data-testid="student-p2b-${stage}"]`)).not.toBeNull();
    }
    expect(host.textContent).toContain("本轮经营结果");
    expect(host.textContent).toContain("从决策到结果");
    expect(host.textContent).toContain("如果当时只改一项");
    expect(host.textContent).toContain("我的经营复盘");
    expect(host.textContent).toContain("下一轮假设");
    expect(host.textContent).not.toContain("private peer drafts");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    root.unmount();
    host.remove();
    fetchSpy.mockRestore();
  });

  it("clears local reflection fields when the authenticated context changes", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () => new Response(JSON.stringify({ data: response }), { status: 200 })
      );
    const { host, root } = renderJourney();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const judgment = host.querySelector<HTMLTextAreaElement>("#student-p2b-reflection-judgment");
    expect(judgment).not.toBeNull();
    act(() => {
      if (judgment) {
        judgment.value = "私有学习草稿";
        judgment.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    expect(judgment?.value).toBe("私有学习草稿");
    const changedContext = { ...context, tenant_id: "tenant-002" };
    await act(async () => {
      root.render(
        <StudentDecisionLearningJourney
          apiBase="http://api.test"
          tenantId="tenant-002"
          token="token-2"
          context={changedContext}
          published
        />
      );
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(host.querySelector<HTMLTextAreaElement>("#student-p2b-reflection-judgment")?.value).toBe(
      ""
    );
    root.unmount();
    host.remove();
    fetchSpy.mockRestore();
  });

  it("serializes multiple reflection fields without control-character separators", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("/reflection")) {
        return new Response(JSON.stringify({ data: response }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: response }), { status: 200 });
    });
    const { host, root } = renderJourney();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    for (const [id, value] of [
      ["student-p2b-reflection-judgment", "先判断结果"],
      ["student-p2b-reflection-learning", "再学习机制"],
      ["student-p2b-reflection-next", "下一轮验证"]
    ] as const) {
      const field = host.querySelector<HTMLTextAreaElement>(`#${id}`);
      expect(field).not.toBeNull();
      act(() => {
        if (field) {
          const setValue = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            "value"
          )?.set;
          setValue?.call(field, value);
          field.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });
    }
    const submit = host.querySelector<HTMLButtonElement>(
      '[data-testid="student-p2b-reflection"] button[type="submit"]'
    );
    expect(submit?.disabled).toBe(false);
    await act(async () => {
      submit?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    const reflectionCall = fetchSpy.mock.calls.find(([input]) =>
      String(input).includes("/reflection")
    );
    expect(reflectionCall).toBeDefined();
    const body = JSON.parse(String(reflectionCall?.[1]?.body)) as { response: string };
    expect(body.response).toContain("判断：先判断结果；学习：再学习机制；下一轮：下一轮验证");
    expect(
      [...body.response].some((character) => character.charCodeAt(0) < 0x20)
    ).toBe(false);
    root.unmount();
    host.remove();
    fetchSpy.mockRestore();
  });
});
