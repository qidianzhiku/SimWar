/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DecisionThreadEvidenceSpine } from "../../packages/ui/src/components/DecisionThreadEvidenceSpine";

beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const context = {
  activity_id: "activity-ddt",
  course_id: "course-ddt",
  role_key: "CEO",
  round_id: "round-current",
  round_no: 2,
  run_id: "run-ddt",
  team_id: "team-ddt",
  tenant_id: "tenant-private"
} as const;

function responseFor(surface: "student" | "teacher" | "admin") {
  return {
    schema_version: "decision-thread-evidence-spine.v1",
    surface,
    provider: "OFF",
    non_causal: true,
    causal_proof: false,
    official_truth_write: false,
    formal_write_count: 0,
    known_limits: ["evidence is read-only"],
    exact_context:
      surface === "student"
        ? {
            course_id: context.course_id,
            run_id: context.run_id,
            team_id: context.team_id,
            round_id: context.round_id,
            round_no: context.round_no,
            role_key: context.role_key
          }
        : { ...context },
    sources: [
      {
        source: "M2P6",
        ledger: "OFFICIAL",
        status: "AVAILABLE",
        summary: "published learning evidence",
        known_limits: []
      },
      {
        source: "MODEL_QUALIFICATION",
        ledger: "DIAGNOSTIC",
        status: "AVAILABLE",
        summary: "qualification evidence",
        known_limits: []
      },
      {
        source: "STRATEGIC_PORTFOLIO",
        ledger: "DIAGNOSTIC",
        status: "LIMITED",
        summary: "bounded portfolio evidence",
        known_limits: ["counterfactual is not official"]
      },
      {
        source: "INDUSTRY_MODEL",
        ledger: "DIAGNOSTIC",
        status: "AVAILABLE",
        summary: "industry diagnostic evidence",
        known_limits: []
      },
      {
        source: "GSI",
        ledger: "ADVISORY",
        status: "CONTEXT_UNAVAILABLE",
        summary: "select two rounds to compare",
        known_limits: ["movement is descriptive"]
      }
    ]
  };
}

describe("Decision Thread Evidence Spine UI", () => {
  it("does not request or display privileged data without an exact context", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <DecisionThreadEvidenceSpine
          apiBase="http://fixture"
          surface="student"
          tenantId="tenant-private"
          token="token"
        />
      );
    });
    expect(host.textContent).toContain("尚未选择精确上下文");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain("tenant-private");
    await act(async () => root.unmount());
  });

  it("uses server round options and keeps Student output allowlisted", async () => {
    const pairOptions = {
      surface: "student",
      context: { ...context },
      rounds: [
        { round_id: "round-1", round_no: 1 },
        { round_id: "round-2", round_no: 2 }
      ],
      provider: "OFF",
      official_truth_write: false,
      non_causal: true,
      causal_proof: false,
      known_limits: []
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return {
        ok: true,
        json: async () => ({
          code: "OK",
          message: "success",
          data: url.includes("pair-options") ? pairOptions : responseFor("student")
        })
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <DecisionThreadEvidenceSpine
          apiBase="http://fixture"
          context={context}
          surface="student"
          tenantId="tenant-private"
          token="token"
        />
      );
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(host.querySelectorAll("select")).toHaveLength(2);
    expect(host.textContent).toContain("当前课程、运行、队伍、回合和角色已受控绑定");
    expect(host.textContent).not.toContain("tenant-private");
    expect(host.textContent).not.toContain("source_ref");
    expect(host.textContent).not.toContain("candidate_id");

    const selects = [...host.querySelectorAll("select")] as HTMLSelectElement[];
    await act(async () => {
      selects[0]!.value = "round-1";
      selects[0]!.dispatchEvent(new Event("change", { bubbles: true }));
      selects[1]!.value = "round-2";
      selects[1]!.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes("gsi_from_round_id=round-1"))
    ).toBe(true);
    await act(async () => root.unmount());
  });

  it("surfaces a stale source as a stale thread state", async () => {
    const pairOptions = {
      surface: "teacher",
      context: { ...context },
      rounds: [],
      provider: "OFF",
      official_truth_write: false,
      non_causal: true,
      causal_proof: false,
      known_limits: []
    };
    const stale = responseFor("teacher");
    stale.sources[0]!.status = "STALE";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => ({
      ok: true,
      json: async () => ({ data: String(input).includes("pair-options") ? pairOptions : stale })
    }));
    vi.stubGlobal("fetch", fetchMock);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <DecisionThreadEvidenceSpine
          apiBase="http://fixture"
          context={context}
          surface="teacher"
          tenantId="tenant-private"
          token="token"
        />
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await vi.waitFor(() => expect(host.textContent).toContain("证据已过期"));
    await act(async () => root.unmount());
  });

  it("preserves HTTP rebase errors and rejects a response bound to another context", async () => {
    const pairOptions = {
      surface: "teacher",
      context: { ...context },
      rounds: [],
      provider: "OFF",
      official_truth_write: false,
      non_causal: true,
      causal_proof: false,
      known_limits: []
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("pair-options")) {
        return { ok: true, json: async () => ({ data: pairOptions }) };
      }
      return {
        ok: false,
        json: async () => ({ code: "DDT_REBASE_REQUIRED", message: "binding moved" })
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <DecisionThreadEvidenceSpine
          apiBase="http://fixture"
          context={context}
          surface="teacher"
          tenantId="tenant-private"
          token="token"
        />
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await vi.waitFor(() => expect(host.textContent).toContain("需要重新绑定"));
    await act(async () => root.unmount());

    const mismatched = responseFor("teacher");
    mismatched.exact_context.round_id = "round-other";
    const mismatchFetch = vi.fn(async (input: RequestInfo | URL) => ({
      ok: true,
      json: async () => ({
        data: String(input).includes("pair-options") ? pairOptions : mismatched
      })
    }));
    vi.stubGlobal("fetch", mismatchFetch);
    const mismatchHost = document.createElement("div");
    document.body.append(mismatchHost);
    const mismatchRoot = createRoot(mismatchHost);
    await act(async () => {
      mismatchRoot.render(
        <DecisionThreadEvidenceSpine
          apiBase="http://fixture"
          context={context}
          surface="teacher"
          tenantId="tenant-private"
          token="token"
        />
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await vi.waitFor(() => expect(mismatchHost.textContent).toContain("上下文与当前选择不一致"));
    await act(async () => mismatchRoot.unmount());
  });

  it("offers an executable reload action for a rebase failure and announces recovery", async () => {
    let evidenceAttempts = 0;
    const pairOptions = {
      surface: "teacher",
      context: { ...context },
      rounds: [],
      provider: "OFF",
      official_truth_write: false,
      non_causal: true,
      causal_proof: false,
      known_limits: []
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("pair-options")) {
        return { ok: true, json: async () => ({ data: pairOptions }) };
      }
      evidenceAttempts += 1;
      if (evidenceAttempts === 1) {
        return {
          ok: false,
          json: async () => ({ code: "DDT_REBASE_REQUIRED", message: "binding moved" })
        };
      }
      return { ok: true, json: async () => ({ data: responseFor("teacher") }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <DecisionThreadEvidenceSpine
          apiBase="http://fixture"
          context={context}
          surface="teacher"
          tenantId="tenant-private"
          token="token"
        />
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await vi.waitFor(() => expect(host.textContent).toContain("需要重新绑定"));
    const recoveryButton = host.querySelector("button[data-action='ddt:rebind']");
    expect(recoveryButton).not.toBeNull();
    await act(async () => {
      (recoveryButton as HTMLButtonElement).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await vi.waitFor(() => expect(host.textContent).toContain("证据线程已恢复"));
    expect(evidenceAttempts).toBe(2);
    await act(async () => root.unmount());
  });
});
