/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type {
  M2P5DecisionLearningResponse,
  W3OfficialConsequenceResponse
} from "@simwar/shared-contracts";
import {
  P2B_STUDENT_STAGES,
  StudentDecisionLearningJourney,
  getStudentLearningGate
} from "../../apps/student/src/P2BDecisionLearningJourney";
import { isW3ContextAvailable } from "../../apps/student/src/p2b-w3-context";

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
    operating_world_consequence_trace: {
      schema_version: "operating-world-consequence-trace.v1",
      trace_id: "operating_world_trace_run_3_team_1",
      scope: {
        tenant_id: context.tenant_id,
        course_id: context.course_id,
        run_id: context.run_id,
        round_no: context.round_no,
        team_id: context.team_id
      },
      operating_world_binding_digest: "c".repeat(64),
      canonical_decision_ref: "decision-001",
      settlement_result_ref: "settlement-001",
      replay_relevant_digest: "d".repeat(64),
      publication: { status: "PUBLISHED" },
      allowed_effects: [
        {
          family: "SH-17",
          key: "capital_cost",
          classification: "OFFICIAL_CONSUMER_ELIGIBLE",
          input_bucket: "0.25-0.50",
          consumer: "W4_CAPITAL_ACTION_OR_NEW_PROJECT_ADMISSION",
          outcome_field: "rate_or_cost_bps",
          effect_direction: "constrains"
        }
      ],
      constraints: [
        "Only the existing W4 capital-action admission consumer may apply this effect."
      ],
      known_limits: ["Bounded public projection."],
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
  visibility: "student_safe"
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
  visibility: "student_safe",
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
    allowed_actions: ["REVIEW_NON_OFFICIAL_WHAT_IF", "REVIEW_TRANSFER", "ENTER_NEXT_ROUND"],
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
  it("requires an explicit W3 context unless the feature is enabled by environment", () => {
    expect(isW3ContextAvailable(undefined, false)).toBe(false);
    expect(isW3ContextAvailable(context, false)).toBe(true);
    expect(isW3ContextAvailable(undefined, true)).toBe(true);
  });

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
    expect(host.querySelector('[data-testid="student-p2b-operating-world-trace"]')).not.toBeNull();
    expect(host.textContent).toContain("Operating World 后果链：WHITELISTED_ONLY");
    expect(host.querySelector('[data-testid="student-p2b-result-story-cta"]')).not.toBeNull();
    expect(host.textContent).not.toContain("private peer drafts");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    root.unmount();
    host.remove();
    fetchSpy.mockRestore();
  });

  it("renders the governed student M2P6 transfer and recovered opening state", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const data = String(input).includes("/m2p5/") ? crossRoundResponse : response;
      return new Response(JSON.stringify({ data }), { status: 200 });
    });
    const { host, root } = renderJourney({ crossRoundEnabled: true });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const region = host.querySelector('[data-testid="student-m2p6-learning-loop"]');
    expect(region).not.toBeNull();
    expect(region?.textContent).toContain(
      "Published Consequence → D4 → mechanism → Reflection → What-if → Transfer → Next Opening"
    );
    expect(region?.textContent).toContain("ENTRY_READY");
    expect(region?.textContent).toContain("ENTER_NEXT_ROUND");
    expect(host.querySelector('[data-testid="student-m2p6-recovery"]')?.textContent).toContain(
      "EXACT_CONTEXT_RESTORED"
    );
    for (const forbidden of [
      "state_true",
      "decision_batch_hash",
      "json_runtime_source_digest",
      "canonical_evidence_digest",
      "replay_input_manifest",
      "authority_diagnostics",
      "teacher_confirmation_ref"
    ]) {
      expect(region?.textContent).not.toContain(forbidden);
    }
    root.unmount();
    host.remove();
    fetchSpy.mockRestore();
  });

  it.each(["BLOCKED", "CONFLICT", "UNKNOWN"] as const)(
    "maps the server %s learning-loop state literally",
    async (status) => {
      const data = {
        ...crossRoundResponse,
        learning_loop: {
          ...crossRoundResponse.learning_loop,
          status,
          blockers: status === "BLOCKED" ? ["REFLECTION_REQUIRED"] : [`${status}_EVIDENCE`]
        }
      } as M2P5DecisionLearningResponse;
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
        async (input) =>
          new Response(
            JSON.stringify({ data: String(input).includes("/m2p5/") ? data : response }),
            {
              status: 200
            }
          )
      );
      const { host, root } = renderJourney({ crossRoundEnabled: true });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      const region = host.querySelector('[data-testid="student-m2p6-learning-loop"]');
      expect(region?.getAttribute("data-status")).toBe(status);
      expect(region?.textContent).toContain(status);
      expect(region?.textContent).toContain(data.learning_loop.blockers[0]!);
      root.unmount();
      host.remove();
      fetchSpy.mockRestore();
    }
  );

  it("shows explicit M2P6 loading and error network states", async () => {
    let resolveProjection: ((value: Response) => void) | undefined;
    const pendingProjection = new Promise<Response>((resolve) => {
      resolveProjection = resolve;
    });
    const loadingFetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("/m2p5/")) return pendingProjection;
      return new Response(JSON.stringify({ data: response }), { status: 200 });
    });
    const loading = renderJourney({ crossRoundEnabled: true });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      loading.host
        .querySelector('[data-testid="student-m2p6-learning-loop"]')
        ?.getAttribute("data-phase")
    ).toBe("loading");
    await act(async () => {
      resolveProjection?.(
        new Response(JSON.stringify({ data: crossRoundResponse }), { status: 200 })
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    loading.root.unmount();
    loading.host.remove();
    loadingFetch.mockRestore();

    const errorFetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("/m2p5/")) throw new Error("m2p6 network down");
      return new Response(JSON.stringify({ data: response }), { status: 200 });
    });
    const failed = renderJourney({ crossRoundEnabled: true });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const errorRegion = failed.host.querySelector('[data-testid="student-m2p6-learning-loop"]');
    expect(errorRegion?.getAttribute("data-phase")).toBe("error");
    expect(errorRegion?.textContent).toContain("m2p6 network down");
    failed.root.unmount();
    failed.host.remove();
    errorFetch.mockRestore();
  });

  it("retains the previous safe M2P6 response during a same-identity refetch", async () => {
    let resolveRefresh: ((value: Response) => void) | undefined;
    const pendingRefresh = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/m2p5/")) {
        if (url.startsWith("http://api-alt.test")) return pendingRefresh;
        return new Response(JSON.stringify({ data: crossRoundResponse }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: response }), { status: 200 });
    });
    const { host, root } = renderJourney({ crossRoundEnabled: true });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      host.querySelector('[data-testid="student-m2p6-learning-loop"]')?.getAttribute("data-phase")
    ).toBe("ready");

    await act(async () => {
      root.render(
        <StudentDecisionLearningJourney
          apiBase="http://api-alt.test"
          tenantId={context.tenant_id}
          token="token"
          context={{ ...context }}
          published
          crossRoundEnabled
        />
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    const staleRegion = host.querySelector('[data-testid="student-m2p6-learning-loop"]');
    expect(staleRegion?.getAttribute("data-phase")).toBe("stale");
    expect(staleRegion?.textContent).toContain("STALE");
    expect(staleRegion?.textContent).toContain("EXACT_CONTEXT_RESTORED");

    await act(async () => {
      resolveRefresh?.(new Response(JSON.stringify({ data: crossRoundResponse }), { status: 200 }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      host.querySelector('[data-testid="student-m2p6-learning-loop"]')?.getAttribute("data-phase")
    ).toBe("ready");
    root.unmount();
    host.remove();
    fetchSpy.mockRestore();
  });

  it("ignores an old-identity M2P6 response that resolves after the new identity", async () => {
    let resolveOldIdentity: ((value: Response) => void) | undefined;
    const oldIdentityResponse = new Promise<Response>((resolve) => {
      resolveOldIdentity = resolve;
    });
    const nextContext = {
      ...context,
      round_id: "round-004",
      round_no: 4
    } as const;
    const nextData = {
      ...crossRoundResponse,
      exact_scope: nextContext,
      learning_loop: {
        ...crossRoundResponse.learning_loop,
        status: "BLOCKED",
        exact_context: nextContext,
        blockers: ["NEW_IDENTITY_CONTEXT"]
      }
    } as M2P5DecisionLearningResponse;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/m2p5/") && url.includes("/rounds/3/")) return oldIdentityResponse;
      if (url.includes("/m2p5/")) {
        return new Response(JSON.stringify({ data: nextData }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: response }), { status: 200 });
    });
    const { host, root } = renderJourney({ crossRoundEnabled: true });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      root.render(
        <StudentDecisionLearningJourney
          apiBase="http://api.test"
          tenantId={nextContext.tenant_id}
          token="token"
          context={nextContext}
          published
          crossRoundEnabled
        />
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.textContent).toContain("NEW_IDENTITY_CONTEXT");

    await act(async () => {
      resolveOldIdentity?.(
        new Response(JSON.stringify({ data: crossRoundResponse }), { status: 200 })
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.textContent).toContain("NEW_IDENTITY_CONTEXT");
    expect(
      host.querySelector('[data-testid="student-m2p6-learning-loop"]')?.getAttribute("data-status")
    ).toBe("BLOCKED");
    root.unmount();
    host.remove();
    fetchSpy.mockRestore();
  });

  it("offers a recoverable error state without changing the safe projection contract", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const { host, root } = renderJourney();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.querySelector('[data-testid="student-p2b-error"]')).not.toBeNull();
    const retry = host.querySelector<HTMLButtonElement>('[data-testid="student-p2b-retry"]');
    expect(retry).not.toBeNull();
    expect(retry?.textContent).toContain("重试");
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ data: response }), { status: 200 }));
    await act(async () => {
      retry?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.querySelector('[data-testid="student-p2b-result"]')).not.toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
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
    expect([...body.response].some((character) => character.charCodeAt(0) < 0x20)).toBe(false);
    root.unmount();
    host.remove();
    fetchSpy.mockRestore();
  });

  it("keeps the reflection POST record when an older projection GET resolves later", async () => {
    let projectionCalls = 0;
    let resolveOlderProjection: ((value: Response) => void) | undefined;
    const olderProjection = new Promise<Response>((resolve) => {
      resolveOlderProjection = resolve;
    });
    const updatedResponse = {
      ...response,
      record: {
        ...response.record,
        official_result: {
          ...response.record.official_result,
          profit_band: "post_saved"
        },
        reflection: { response: "已保存的新学习草稿" }
      }
    } as W3OfficialConsequenceResponse;
    const jsonResponse = (value: W3OfficialConsequenceResponse) =>
      new Response(JSON.stringify({ data: value }), { status: 200 });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("/reflection")) return jsonResponse(updatedResponse);
      projectionCalls += 1;
      if (projectionCalls === 1) return jsonResponse(response);
      return olderProjection;
    });
    const { host, root } = renderJourney();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(projectionCalls).toBe(1);

    const equivalentContext = { ...context };
    await act(async () => {
      root.render(
        <StudentDecisionLearningJourney
          apiBase="http://api.test"
          tenantId="tenant-001"
          token="token"
          context={equivalentContext}
          published
        />
      );
      await Promise.resolve();
    });
    expect(projectionCalls).toBe(1);

    await act(async () => {
      root.render(
        <StudentDecisionLearningJourney
          apiBase="http://api-alt.test"
          tenantId="tenant-001"
          token="token"
          context={equivalentContext}
          published
        />
      );
      await Promise.resolve();
    });
    expect(projectionCalls).toBe(2);

    const judgment = host.querySelector<HTMLTextAreaElement>("#student-p2b-reflection-judgment");
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    act(() => {
      setValue?.call(judgment, "保留新草稿");
      judgment?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const submit = host.querySelector<HTMLButtonElement>(
      '[data-testid="student-p2b-reflection"] button[type="submit"]'
    );
    await act(async () => {
      submit?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.textContent).toContain("post_saved");

    await act(async () => {
      resolveOlderProjection?.(jsonResponse(response));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.textContent).toContain("post_saved");
    root.unmount();
    host.remove();
    fetchSpy.mockRestore();
  });
});
