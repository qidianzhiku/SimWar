/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  GSICrossRoundPairOptions,
  GSICrossRoundStudentProjection
} from "@simwar/shared-contracts";
import { GovernedStakeholderIntelligenceProjection } from "../../apps/student/src/GovernedStakeholderIntelligenceProjection";

const comparison = {
  surface: "student",
  movements: [
    {
      stakeholder_type: "customer",
      intent: "protect_demand",
      from_value: 0.2,
      to_value: 0.7,
      delta: 0.5,
      direction: "INCREASED"
    }
  ],
  context_status: "AVAILABLE",
  non_causal: true,
  causal_proof: false,
  provider: "OFF",
  official_truth_write: false,
  known_limits: ["descriptive only"],
  recovery: "RELOAD_EXACT_CONTEXT"
} satisfies GSICrossRoundStudentProjection;

const selectionContext = {
  course_id: "course_demo",
  run_id: "run_demo",
  team_id: "team_demo",
  activity_id: "activity_demo",
  role_key: "CEO"
};
const handoffPath =
  "/?gsi_course_id=course_demo&gsi_run_id=run_demo&gsi_team_id=team_demo&gsi_activity_id=activity_demo&gsi_role_key=CEO#gsi-student-reflection";
const pairOptions: GSICrossRoundPairOptions = {
  surface: "student",
  context: { ...selectionContext, tenant_id: "tenant_demo" },
  rounds: [
    { round_id: "round_one", round_no: 1 },
    { round_id: "round_two", round_no: 2 }
  ],
  provider: "OFF",
  official_truth_write: false,
  non_causal: true,
  causal_proof: false,
  known_limits: ["descriptive only"]
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

async function mountReflection(
  path = handoffPath,
  strict = false,
  responseData: unknown = pairOptions
) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.history.replaceState({}, "", path);
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(
      async () => new Response(JSON.stringify({ data: responseData }), { status: 200 })
    );
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const view = (
    <GovernedStakeholderIntelligenceProjection
      apiBase="http://api.test"
      tenantId="tenant_demo"
      token="unit-session"
      selectionContext={selectionContext}
    />
  );
  await act(async () => root.render(strict ? <React.StrictMode>{view}</React.StrictMode> : view));
  return { host, root, fetchSpy, view };
}

async function unmountReflection(mounted: Awaited<ReturnType<typeof mountReflection>>) {
  await act(async () => mounted.root.unmount());
  mounted.host.remove();
}

describe("GSI-XR Student experience", () => {
  it.each([
    ["non-Student surface", { ...pairOptions, surface: "teacher" }],
    [
      "wrong tenant",
      { ...pairOptions, context: { ...pairOptions.context, tenant_id: "other_tenant" } }
    ],
    [
      "wrong course",
      { ...pairOptions, context: { ...pairOptions.context, course_id: "other_course" } }
    ],
    ["wrong run", { ...pairOptions, context: { ...pairOptions.context, run_id: "other_run" } }],
    ["wrong team", { ...pairOptions, context: { ...pairOptions.context, team_id: "other_team" } }],
    [
      "wrong activity",
      { ...pairOptions, context: { ...pairOptions.context, activity_id: "other_activity" } }
    ],
    ["wrong role", { ...pairOptions, context: { ...pairOptions.context, role_key: "CFO" } }],
    ["malformed round", { ...pairOptions, rounds: [{ round_id: "round_one", round_no: "1" }] }],
    ["Provider enabled", { ...pairOptions, provider: "ON" }],
    ["private extra field", { ...pairOptions, candidate_id: "private-candidate-not-for-student" }]
  ])(
    "rejects success pair-options with %s before enabling reflection controls",
    async (_label, data) => {
      const mounted = await mountReflection(handoffPath, false, data);
      try {
        const region = mounted.host.querySelector<HTMLElement>(
          '[aria-label="Student cross-round stakeholder reflection"]'
        )!;
        expect(mounted.host.textContent).toContain("PAIR_SELECTION_UNAVAILABLE");
        expect(
          mounted.host.querySelector<HTMLSelectElement>('[aria-label="Student from round"]')!
            .disabled
        ).toBe(true);
        expect(
          mounted.host.querySelector<HTMLSelectElement>('[aria-label="Student to round"]')!.disabled
        ).toBe(true);
        expect(document.activeElement).not.toBe(region);
        expect(mounted.host.textContent).not.toContain("private-candidate-not-for-student");
        expect(mounted.fetchSpy).toHaveBeenCalledTimes(1);
      } finally {
        await unmountReflection(mounted);
      }
    }
  );

  it("lands a valid handoff on the accessible reflection target without selecting or comparing rounds", async () => {
    const mounted = await mountReflection();
    try {
      const region = mounted.host.querySelector<HTMLElement>(
        '[aria-label="Student cross-round stakeholder reflection"]'
      )!;
      expect(region.id).toBe("gsi-student-reflection");
      expect(region.tabIndex).toBe(-1);
      expect(document.activeElement).toBe(region);
      expect(
        mounted.host.querySelector<HTMLSelectElement>('[aria-label="Student from round"]')!.value
      ).toBe("");
      expect(
        mounted.host.querySelector<HTMLSelectElement>('[aria-label="Student to round"]')!.value
      ).toBe("");
      expect(mounted.fetchSpy).toHaveBeenCalledTimes(1);
      expect(String(mounted.fetchSpy.mock.calls[0]![0])).toContain(
        "/api/v1/bff/student/gsi/candidates/pair-options?course_id=course_demo&run_id=run_demo&team_id=team_demo&activity_id=activity_demo&role_key=CEO"
      );
    } finally {
      await unmountReflection(mounted);
    }
  });

  it("focuses once in StrictMode and preserves keyboard focus across rerenders", async () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, "focus");
    const mounted = await mountReflection(handoffPath, true);
    try {
      const region = mounted.host.querySelector<HTMLElement>(
        '[aria-label="Student cross-round stakeholder reflection"]'
      )!;
      expect(
        mounted.host.querySelector<HTMLSelectElement>('[aria-label="Student from round"]')!.disabled
      ).toBe(false);
      expect(document.activeElement).toBe(region);
      expect(focusSpy.mock.contexts.filter((element) => element === region)).toHaveLength(1);
      const selector = mounted.host.querySelector<HTMLSelectElement>(
        '[aria-label="Student from round"]'
      )!;
      selector.focus();
      await act(async () =>
        mounted.root.render(<React.StrictMode>{mounted.view}</React.StrictMode>)
      );
      expect(document.activeElement).toBe(selector);
      expect(focusSpy.mock.contexts.filter((element) => element === region)).toHaveLength(1);
    } finally {
      await unmountReflection(mounted);
    }
  });

  it.each([
    handoffPath.replace("#gsi-student-reflection", ""),
    handoffPath.replace("gsi_team_id=team_demo", "gsi_team_id=wrong_team"),
    handoffPath.replace("&gsi_activity_id=activity_demo", "")
  ])("does not take focus for a non-target or inconsistent handoff: %s", async (path) => {
    const mounted = await mountReflection(path);
    try {
      const region = mounted.host.querySelector<HTMLElement>(
        '[aria-label="Student cross-round stakeholder reflection"]'
      )!;
      expect(document.activeElement).not.toBe(region);
    } finally {
      await unmountReflection(mounted);
    }
  });

  it("does not take delayed focus after the user moves away, even if focus returns to body", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    window.history.replaceState({}, "", handoffPath);
    let resolveOptions!: (response: Response) => void;
    vi.spyOn(globalThis, "fetch").mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveOptions = resolve;
      })
    );
    const host = document.createElement("div");
    const otherControl = document.createElement("button");
    otherControl.textContent = "Other work";
    document.body.append(host, otherControl);
    const root = createRoot(host);
    try {
      await act(async () =>
        root.render(
          <GovernedStakeholderIntelligenceProjection
            apiBase="http://api.test"
            tenantId="tenant_demo"
            token="unit-session"
            selectionContext={selectionContext}
          />
        )
      );
      otherControl.focus();
      otherControl.blur();
      await act(async () =>
        resolveOptions(new Response(JSON.stringify({ data: pairOptions }), { status: 200 }))
      );
      const region = host.querySelector<HTMLElement>(
        '[aria-label="Student cross-round stakeholder reflection"]'
      )!;
      expect(document.activeElement).not.toBe(region);
    } finally {
      await act(async () => root.unmount());
      host.remove();
      otherControl.remove();
    }
  });

  it("renders an allowlisted decision-learning timeline without private provenance", () => {
    const markup = renderToStaticMarkup(
      <GovernedStakeholderIntelligenceProjection
        apiBase="http://api.test"
        tenantId="tenant_demo"
        token="token"
        initialComparison={comparison}
      />
    );
    expect(markup).toContain("查看本轮变化");
    expect(markup).toContain("INCREASED");
    expect(markup).toContain("哪些压力变了，它会怎样影响你的下一步判断？");
    expect(markup).toContain("NON-CAUSAL");
    expect(markup).not.toContain("candidate_id");
    expect(markup).not.toContain("comparison_digest");
    expect(markup).not.toContain("signal_key");
    expect(markup).not.toContain("producer_id");
  });

  it("truthfully shows pair-selection unavailable instead of an empty or ready state", () => {
    const markup = renderToStaticMarkup(
      <GovernedStakeholderIntelligenceProjection
        apiBase="http://api.test"
        tenantId="tenant_demo"
        token="token"
      />
    );
    expect(markup).toContain("PAIR_SELECTION_UNAVAILABLE");
    expect(markup).toContain("当前还没有可比较的已发布回合");
    expect(markup).not.toContain("候选 ID");
    expect(markup).not.toContain("candidate");
  });
});
