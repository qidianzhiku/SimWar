/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  GSICrossRoundAdminProjection,
  GSICrossRoundTeacherProjection
} from "@simwar/shared-contracts";
import { GovernedStakeholderIntelligenceAuditPanel } from "../../apps/admin/src/GovernedStakeholderIntelligenceAuditPanel";
import { GovernedStakeholderIntelligenceWorkspace } from "../../apps/teacher/src/GovernedStakeholderIntelligenceWorkspace";

const teacherComparison = {
  surface: "teacher",
  comparison: {
    discriminator: "gsi_cross_round_comparison",
    pair: {
      tenant_id: "tenant_demo",
      course_id: "course_demo",
      run_id: "run_demo",
      team_id: "team_demo",
      from: {
        candidate_id: "candidate_from",
        candidate_digest: "a".repeat(64),
        round_id: "round_1",
        round_no: 1
      },
      to: {
        candidate_id: "candidate_to",
        candidate_digest: "b".repeat(64),
        round_id: "round_2",
        round_no: 2
      }
    },
    movements: [
      {
        signal_key: "customer:protect_demand",
        stakeholder_type: "customer",
        intent: "protect_demand",
        from_value: 0.2,
        to_value: 0.7,
        delta: 0.5,
        direction: "INCREASED"
      }
    ],
    comparison_digest: "c".repeat(64),
    non_causal: true,
    causal_proof: false,
    known_limits: ["descriptive only"]
  },
  context: {
    status: "CONTEXT_UNAVAILABLE",
    context: {
      activity_id: "activity_demo",
      course_id: "course_demo",
      role_key: "CEO",
      round_id: "round_2",
      round_no: 2,
      run_id: "run_demo",
      team_id: "team_demo",
      tenant_id: "tenant_demo"
    },
    anchors: [],
    context_digest: "d".repeat(64),
    non_causal: true,
    causal_proof: false,
    official_outcome_recomputed: false,
    official_truth_write: false,
    recovery: "WAIT_FOR_PUBLICATION",
    known_limits: ["context unavailable"]
  },
  provider: "OFF",
  official_truth_write: false,
  known_limits: ["descriptive only"],
  recovery: "WAIT_FOR_PUBLICATION"
} satisfies GSICrossRoundTeacherProjection;

const adminComparison = {
  surface: "admin",
  tenant_id: "tenant_demo",
  comparison: teacherComparison.comparison,
  context: { ...teacherComparison.context, context_binding: teacherComparison.context.context },
  provider: "OFF",
  official_truth_write: false,
  known_limits: ["read-only"],
  recovery: "WAIT_FOR_PUBLICATION"
} satisfies GSICrossRoundAdminProjection;

describe("GSI-XR Teacher/Admin experience", () => {
  it.each(["success", "error"])(
    "ignores late Admin audit %s across identity changes",
    async (outcome) => {
      vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
      let finish!: (value: Response) => void;
      let fail!: (error: Error) => void;
      let signal: AbortSignal | undefined;
      const pending = new Promise<Response>((resolve, reject) => {
        finish = resolve;
        fail = reject;
      });
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((_input, options) => {
        signal = options?.signal as AbortSignal;
        return pending;
      });
      const host = document.createElement("div");
      const root = createRoot(host);
      try {
        await act(async () => {
          root.render(
            <GovernedStakeholderIntelligenceAuditPanel
              apiBase="http://api.test"
              tenantId="tenant_one"
              token="old"
              initialCandidateId="candidate_one"
            />
          );
        });
        await act(async () => {
          host
            .querySelectorAll("form")[1]!
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        });
        await act(async () => {
          root.render(
            <GovernedStakeholderIntelligenceAuditPanel
              apiBase="http://api.test"
              tenantId="tenant_two"
              token="new"
              initialCandidateId="candidate_one"
            />
          );
        });
        expect(signal?.aborted).toBe(true);
        await act(async () => {
          if (outcome === "error") fail(new Error("late private audit"));
          else
            finish(
              new Response(
                JSON.stringify({
                  data: {
                    provider: "OFF",
                    candidate_digest: "late_private_audit",
                    writes_official_truth: false
                  }
                }),
                { status: 200 }
              )
            );
        });
        expect(host.textContent).not.toContain("late_private_audit");
        expect(host.textContent).not.toContain("late private audit");
      } finally {
        await act(async () => root.unmount());
        fetchSpy.mockRestore();
        vi.unstubAllGlobals();
      }
    }
  );

  it("makes exact pair selection primary and keeps candidate provenance advanced-only", () => {
    const markup = renderToStaticMarkup(
      <GovernedStakeholderIntelligenceWorkspace
        apiBase="http://api.test"
        binding={{
          tenant_id: "tenant_demo",
          course_id: "course_demo",
          run_id: "run_demo",
          round_id: "round_1",
          round_no: 1,
          activity_id: "activity_gsi_xr",
          role_key: "CEO",
          team_id: "team_demo",
          scenario_package_id: "scenario_demo",
          scenario_version: "1.0.0",
          parameter_set_id: "parameter_demo",
          parameter_set_version: "1.0.0",
          model_version_id: "model_demo",
          model_version: "1.0.0",
          model_artifact_id: "artifact_demo",
          model_artifact_version: "1.0.0"
        }}
        tenantId="tenant_demo"
        token="token"
        initialComparison={teacherComparison}
      />
    );
    expect(markup).toContain("对比两个回合");
    expect(markup).toContain("Round 1");
    expect(markup).toContain("Round 2");
    expect(markup).toContain("INCREASED");
    expect(markup).toContain("CONTEXT_UNAVAILABLE");
    expect(markup).toContain("NON-CAUSAL");
    expect(markup).toContain("candidate_from");
    expect(markup).toContain("高级");
  });

  it("does not disguise a missing server pair selector as an empty ready state", () => {
    const markup = renderToStaticMarkup(
      <GovernedStakeholderIntelligenceWorkspace
        apiBase="http://api.test"
        binding={{
          tenant_id: "tenant_demo",
          course_id: "course_demo",
          run_id: "run_demo",
          round_id: "round_1",
          team_id: "team_demo",
          scenario_package_id: "scenario_demo",
          scenario_version: "1.0.0",
          parameter_set_id: "parameter_demo",
          parameter_set_version: "1.0.0",
          model_version_id: "model_demo",
          model_version: "1.0.0",
          model_artifact_id: "artifact_demo",
          model_artifact_version: "1.0.0"
        }}
        tenantId="tenant_demo"
        token="token"
      />
    );
    expect(markup).toContain("PAIR_SELECTION_UNAVAILABLE");
    expect(markup).toContain("服务器尚未提供可用的回合配对列表");
  });

  it("keeps Admin provenance secondary and collapsed with no-write/non-causal markers", () => {
    const markup = renderToStaticMarkup(
      <GovernedStakeholderIntelligenceAuditPanel
        apiBase="http://api.test"
        tenantId="tenant_demo"
        token="token"
        initialComparison={adminComparison}
      />
    );
    expect(markup).toContain("审计两个回合");
    expect(markup).toContain("tenant_demo");
    expect(markup).toContain("gsi-xr-admin-provenance-details");
    expect(markup).toContain("Technical provenance (secondary)");
    expect(markup).not.toContain("gsi-xr-admin-provenance-details open");
    expect(markup).toContain("context_binding");
    expect(markup).toContain("NON-CAUSAL");
    expect(markup).toContain("不写入正式 Decision / Settlement / Outcome");
    expect(markup).toContain("DDT admin exact round ID");
    expect(markup).toContain("不依赖 GSI 比较配对");
  });
});
it("generates a Student handoff from ready exact context without candidate identifiers", () => {
  const markup = renderToStaticMarkup(
    <GovernedStakeholderIntelligenceWorkspace
      apiBase="http://api.test"
      studentAppBaseUrl="http://student.test/"
      binding={{
        tenant_id: "tenant_demo",
        course_id: "course_demo",
        run_id: "run_demo",
        round_id: "round_1",
        round_no: 1,
        activity_id: "activity_gsi_xr",
        role_key: "CEO",
        team_id: "team_demo",
        scenario_package_id: "scenario_demo",
        scenario_version: "1.0.0",
        parameter_set_id: "parameter_demo",
        parameter_set_version: "1.0.0",
        model_version_id: "model_demo",
        model_version: "1.0.0",
        model_artifact_id: "artifact_demo",
        model_artifact_version: "1.0.0"
      }}
      tenantId="tenant_demo"
      token="token"
      initialComparison={teacherComparison}
    />
  );
  const handoff = markup
    .match(/href="([^"]+)"[^>]*>生成 Student 学习查看链接/)?.[1]
    ?.replaceAll("&amp;", "&");
  expect(handoff).toBe(
    "http://student.test/?gsi_course_id=course_demo&gsi_run_id=run_demo&gsi_team_id=team_demo&gsi_activity_id=activity_gsi_xr&gsi_role_key=CEO"
  );
  expect(handoff).not.toContain("candidate_");
  expect(handoff).not.toContain("comparison_digest");
});

it("does not expose a Student handoff before an exact comparison is ready", () => {
  const markup = renderToStaticMarkup(
    <GovernedStakeholderIntelligenceWorkspace
      apiBase="http://api.test"
      studentAppBaseUrl="http://student.test/"
      binding={{
        tenant_id: "tenant_demo",
        course_id: "course_demo",
        run_id: "run_demo",
        round_id: "round_1",
        team_id: "team_demo",
        scenario_package_id: "scenario_demo",
        scenario_version: "1.0.0",
        parameter_set_id: "parameter_demo",
        parameter_set_version: "1.0.0",
        model_version_id: "model_demo",
        model_version: "1.0.0",
        model_artifact_id: "artifact_demo",
        model_artifact_version: "1.0.0"
      }}
      tenantId="tenant_demo"
      token="token"
    />
  );
  expect(markup).not.toContain("生成 Student 学习查看链接");
  expect(markup).not.toContain("gsi_course_id=course_demo");
});
