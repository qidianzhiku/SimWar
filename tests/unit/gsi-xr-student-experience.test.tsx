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
  vi.doUnmock("../../packages/shared-contracts/src/gsi-governed-stakeholder-shadow-plane");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

async function mountReflection(
  path = handoffPath,
  strict = false,
  responseData: unknown = pairOptions,
  bootstrap: unknown = undefined,
  envelope: unknown = undefined,
  wireBody: string | undefined = undefined
) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.history.replaceState({}, "", path);
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(
      async () => new Response(wireBody ?? JSON.stringify(envelope ?? { data: responseData }), { status: 200 })
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
      initialComparison={bootstrap as GSICrossRoundStudentProjection | undefined}
    />
  );
  try {
    await act(async () => root.render(strict ? <React.StrictMode>{view}</React.StrictMode> : view));
    await act(async () => vi.dynamicImportSettled());
  } catch (error) {
    await act(async () => root.unmount());
    host.remove();
    throw error;
  }
  return { host, root, fetchSpy, view };
}

async function unmountReflection(mounted: Awaited<ReturnType<typeof mountReflection>>) {
  await act(async () => mounted.root.unmount());
  mounted.host.remove();
}

async function submitComparison(mounted: Awaited<ReturnType<typeof mountReflection>>) {
  for (const [label, value] of [
    ["Student from round", "round_one"],
    ["Student to round", "round_two"]
  ]) {
    await act(async () => {
      const select = mounted.host.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!;
      select.value = value!;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  await act(async () => {
    mounted.host
      .querySelector('form[aria-label="Student exact cross-round comparison"]')!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

const invalidComparisons: [string, unknown][] = [
  ["missing data", undefined],
  ["null data", null],
  ["string data", "invalid"],
  ["number data", 7],
  ["boolean data", true],
  ["array data", []],
  ["missing movements", { ...comparison, movements: undefined }],
  ["string movements", { ...comparison, movements: "invalid" }],
  ["object movements", { ...comparison, movements: {} }],
  ["null movement", { ...comparison, movements: [null] }],
  ["string movement", { ...comparison, movements: ["invalid"] }],
  [
    "missing intent",
    { ...comparison, movements: [{ ...comparison.movements[0], intent: undefined }] }
  ],
  ["bad intent", { ...comparison, movements: [{ ...comparison.movements[0], intent: "unknown" }] }],
  [
    "bad stakeholder",
    { ...comparison, movements: [{ ...comparison.movements[0], stakeholder_type: "unknown" }] }
  ],
  [
    "bad direction",
    { ...comparison, movements: [{ ...comparison.movements[0], direction: "unknown" }] }
  ],
  ...["from_value", "to_value", "delta"].flatMap((key): [string, unknown][] => [
    [`${key} string`, { ...comparison, movements: [{ ...comparison.movements[0], [key]: "1" }] }],
    [`${key} null`, { ...comparison, movements: [{ ...comparison.movements[0], [key]: null }] }]
  ]),
  ["missing limits", { ...comparison, known_limits: undefined }],
  ["object limits", { ...comparison, known_limits: {} }],
  ["number limits", { ...comparison, known_limits: 7 }],
  ["number limit", { ...comparison, known_limits: [7] }],
  ["null limit", { ...comparison, known_limits: [null] }],
  ["empty limits", { ...comparison, known_limits: [] }],
  ["empty movements and limits", { ...comparison, movements: [], known_limits: [] }],
  ...([
    ["from_value", 1],
    ["to_value", 1],
    ["delta", 2]
  ] as const).flatMap(([key, bound]): [string, unknown][] =>
    [
      ["below minimum", -bound - 0.000001],
      ["above maximum", bound + 0.000001],
      ["NaN encoded as JSON null", Number.NaN],
      ["Infinity encoded as JSON null", Number.POSITIVE_INFINITY],
      ["negative Infinity encoded as JSON null", Number.NEGATIVE_INFINITY]
    ].map(([label, value]): [string, unknown] => [
      `${key} ${label}`,
      { ...comparison, movements: [{ ...comparison.movements[0], [key]: value }] }
    ])
  ),
  ["wrong surface", { ...comparison, surface: "teacher" }],
  ["bad status", { ...comparison, context_status: "unknown" }],
  ["bad recovery", { ...comparison, recovery: "unknown" }],
  ["Provider ON", { ...comparison, provider: "ON" }],
  ["causal flag", { ...comparison, non_causal: false }],
  ["causal proof", { ...comparison, causal_proof: true }],
  ["truth write", { ...comparison, official_truth_write: true }],
  ...["candidate_id", "comparison_digest", "producer_id", "signal_key"].map(
    (key): [string, unknown] => [
      `private ${key}`,
      { ...comparison, [key]: "private-response-value" }
    ]
  ),
  [
    "private movement signal",
    {
      ...comparison,
      movements: [{ ...comparison.movements[0], signal_key: "private-response-value" }]
    }
  ]
];

describe("GSI-XR Student experience", () => {
  it.each([
    ["independent error", { data: pairOptions, error: { code: "FORBIDDEN", message: "private-pair-envelope" } }],
    ["null error", { data: pairOptions, error: null }],
    ["non-success code", { data: pairOptions, code: "FORBIDDEN" }],
    ["error-shaped data", { data: { code: "FORBIDDEN", message: "private-pair-envelope" }, code: "OK" }],
    ["invalid JSON", undefined]
  ])("I-B rejects pair-options %s before readiness/focus without envelope disclosure", async (name, envelope) => {
    const mounted = await mountReflection(handoffPath, false, pairOptions, undefined, envelope,
      name === "invalid JSON" ? "private-pair-envelope" : undefined);
    try {
      expect(mounted.host.textContent).toContain("PAIR_SELECTION_UNAVAILABLE");
      expect(mounted.host.textContent).toContain("服务器回合配对暂不可用");
      expect(mounted.host.querySelector<HTMLSelectElement>('[aria-label="Student from round"]')!.disabled).toBe(true);
      expect(document.activeElement).not.toBe(mounted.host.querySelector('#gsi-student-reflection'));
      expect(mounted.host.textContent).not.toContain("private-pair");
      expect(mounted.host.textContent).not.toContain("Unexpected token");
    } finally {
      await unmountReflection(mounted);
    }
  });

  it.each(invalidComparisons.filter(([, data]) => data !== undefined))(
    "I-A rejects invalid bootstrap %s before ready/render without private values",
    async (_name, data) => {
      const mounted = await mountReflection(handoffPath, false, pairOptions, data);
      try {
        expect(mounted.host.querySelector('[role="alert"]')).not.toBeNull();
        expect(mounted.host.querySelector('[aria-label="Stakeholder pressure movement"]')).toBeNull();
        expect(mounted.host.textContent).not.toContain("private-response-value");
        expect(mounted.fetchSpy).toHaveBeenCalledTimes(1);
      } finally {
        await unmountReflection(mounted);
      }
    }
  );

  it("I-A permits explicit HTTP recovery after invalid bootstrap without automatic compare", async () => {
    const mounted = await mountReflection(handoffPath, false, pairOptions, {
      ...comparison,
      known_limits: []
    });
    try {
      expect(mounted.fetchSpy).toHaveBeenCalledTimes(1);
      const recovery = Array.from(mounted.host.querySelectorAll("button")).find(
        (button) => button.textContent === "安全恢复"
      );
      expect(recovery).toBeDefined();
      await act(async () => recovery!.click());
      mounted.fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: comparison }), { status: 200 })
      );
      await submitComparison(mounted);
      expect(mounted.host.querySelector('[aria-label="Stakeholder pressure movement"]')).not.toBeNull();
      expect(mounted.host.querySelector('[role="alert"]')).toBeNull();
    } finally {
      await unmountReflection(mounted);
    }
  });

  it("I-A never renders a mutated bootstrap that was previously valid", async () => {
    const bootstrap = structuredClone(comparison);
    const mounted = await mountReflection(handoffPath, false, pairOptions, bootstrap);
    try {
      expect(mounted.host.querySelector('[aria-label="Stakeholder pressure movement"]')).not.toBeNull();
      bootstrap.known_limits = [];
      await act(async () => mounted.root.render(React.cloneElement(mounted.view, { apiBase: "http://api-next.test" })));
      await act(async () => vi.dynamicImportSettled());
      expect(mounted.host.querySelector('[role="alert"]')).not.toBeNull();
      expect(mounted.host.querySelector('[aria-label="Stakeholder pressure movement"]')).toBeNull();
    } finally {
      await unmountReflection(mounted);
    }
  });

  it.each([
    ["error object", { error: { code: "GSI_REBASE_REQUIRED", message: "private-envelope-value" } }],
    ["error null", { error: null }],
    ["error false", { error: false }],
    ["error array", { error: [] }],
    ["error empty object", { error: {} }],
    ["error string", { error: "private-envelope-value" }],
    ["wrong success code", { code: "FORBIDDEN", message: "private-envelope-value" }],
    ["empty success code", { code: "" }],
    ["null success code", { code: null }]
  ])("I-B rejects HTTP200 valid data with %s and does not expose envelope details", async (_name, extra) => {
    const mounted = await mountReflection();
    try {
      mounted.fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: comparison, ...extra }), { status: 200 })
      );
      await submitComparison(mounted);
      expect(mounted.host.querySelector('[aria-label="Stakeholder pressure movement"]')).toBeNull();
      expect(mounted.host.textContent).not.toContain("private-envelope-value");
      expect(mounted.host.textContent).toMatch(/REBASE_REQUIRED|暂时无法读取变化/);
    } finally {
      await unmountReflection(mounted);
    }
  });

  it("I-B preserves the actual OK envelope and error-shaped data recovery", async () => {
    const mounted = await mountReflection();
    try {
      mounted.fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
        code: "GSI_REBASE_REQUIRED", data: { code: "GSI_REBASE_REQUIRED", message: "private-envelope-value" }
      }), { status: 409 }));
      await submitComparison(mounted);
      expect(mounted.host.textContent).toContain("REBASE_REQUIRED");
      expect(mounted.host.textContent).not.toContain("private-envelope-value");
      const recovery = Array.from(mounted.host.querySelectorAll("button")).find(
        (button) => button.textContent === "重新选择精确回合"
      );
      await act(async () => recovery!.click());
      mounted.fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
        request_id: "unit-request", code: "OK", message: "success", data: comparison
      }), { status: 200 }));
      await submitComparison(mounted);
      expect(mounted.host.querySelector('[aria-label="Stakeholder pressure movement"]')).not.toBeNull();
    } finally {
      await unmountReflection(mounted);
    }
  });

  it.each(invalidComparisons)(
    "I-1 rejects HTTP200 comparison with %s without rendering an unadmitted projection",
    async (_name, data) => {
      const mounted = await mountReflection();
      try {
        mounted.fetchSpy.mockResolvedValueOnce(
          new Response(JSON.stringify({ data }), { status: 200 })
        );
        await submitComparison(mounted);
        expect(mounted.host.querySelector('[role="alert"]')).not.toBeNull();
        expect(
          mounted.host.querySelector('[aria-label="Stakeholder pressure movement"]')
        ).toBeNull();
        expect(mounted.host.textContent).not.toContain("private-response-value");
        expect(mounted.fetchSpy).toHaveBeenCalledTimes(2);
      } finally {
        await unmountReflection(mounted);
      }
    }
  );

  it.each([
    ["nominal", comparison],
    ["empty movements", { ...comparison, movements: [] }],
    ["one empty-string limit allowed by OpenAPI", { ...comparison, known_limits: [""] }],
    ...([
      [-1, 1, 2, "INCREASED"],
      [1, -1, -2, "DECREASED"],
      [0, 0, 0, "STABLE"]
    ] as const).map(([from_value, to_value, delta, direction]) => [
      `inclusive bounds ${from_value}/${to_value}/${delta}`,
      {
        ...comparison,
        movements: [{ ...comparison.movements[0], from_value, to_value, delta, direction }]
      }
    ]),
    [
      "optional values absent",
      {
        ...comparison,
        movements: [{ stakeholder_type: "bank", intent: "preserve_liquidity", direction: "NEW" }]
      }
    ]
  ])(
    "I-1 preserves valid comparison %s without requiring echoed context fields",
    async (_name, data) => {
      const mounted = await mountReflection();
      try {
        mounted.fetchSpy.mockResolvedValueOnce(
          new Response(JSON.stringify({ data }), { status: 200 })
        );
        await submitComparison(mounted);
        expect(
          mounted.host.querySelector('[aria-label="Stakeholder pressure movement"]')
        ).not.toBeNull();
        expect(mounted.host.querySelector('[role="alert"]')).toBeNull();
        expect(mounted.host.textContent).not.toContain("candidate_id");
      } finally {
        await unmountReflection(mounted);
      }
    }
  );

  it("I-1 recovers from rejected comparison through explicit reselection", async () => {
    const mounted = await mountReflection();
    try {
      mounted.fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { ...comparison, provider: "ON" } }), { status: 200 })
      );
      await submitComparison(mounted);
      const recovery = Array.from(mounted.host.querySelectorAll("button")).find(
        (button) => button.textContent === "安全恢复"
      );
      expect(recovery).toBeDefined();
      await act(async () => recovery!.click());
      mounted.fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: comparison }), { status: 200 })
      );
      await submitComparison(mounted);
      expect(
        mounted.host.querySelector('[aria-label="Stakeholder pressure movement"]')
      ).not.toBeNull();
      expect(mounted.fetchSpy).toHaveBeenCalledTimes(3);
    } finally {
      await unmountReflection(mounted);
    }
  });

  it("I-1 never admits an aborted comparison after the pair selection changes", async () => {
    const mounted = await mountReflection();
    try {
      let release!: (response: Response) => void;
      mounted.fetchSpy.mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          release = resolve;
        })
      );
      await submitComparison(mounted);
      const signal = mounted.fetchSpy.mock.calls[1]![1]!.signal!;
      await act(async () => {
        const select = mounted.host.querySelector<HTMLSelectElement>(
          '[aria-label="Student to round"]'
        )!;
        select.value = "";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(signal.aborted).toBe(true);
      await act(async () =>
        release(new Response(JSON.stringify({ data: comparison }), { status: 200 }))
      );
      expect(mounted.host.querySelector('[aria-label="Stakeholder pressure movement"]')).toBeNull();
      expect(mounted.host.querySelector('[role="alert"]')).toBeNull();
    } finally {
      await unmountReflection(mounted);
    }
  });
  it("fails closed without focus or round readiness when the schema module cannot load", async () => {
    vi.doMock("../../packages/shared-contracts/src/gsi-governed-stakeholder-shadow-plane", () => {
      throw new Error("schema module unavailable");
    });
    const mounted = await mountReflection();
    try {
      // Vitest wraps a module-factory rejection; assert the consumer's closed
      // error state, not the mock loader's framework-specific error wording.
      expect(mounted.host.textContent).toContain("PAIR_SELECTION_UNAVAILABLE");
      expect(mounted.host.textContent).not.toContain("正在读取已发布的可比较回合");
      expect(
        mounted.host.querySelector<HTMLSelectElement>('[aria-label="Student from round"]')!.disabled
      ).toBe(true);
      expect(document.activeElement).not.toBe(
        mounted.host.querySelector("#gsi-student-reflection")
      );
      expect(mounted.fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      await unmountReflection(mounted);
    }
  });

  it("does not admit a response after context is removed while its schema module is loading", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.doMock(
      "../../packages/shared-contracts/src/gsi-governed-stakeholder-shadow-plane",
      async (importOriginal) => {
        const actual = await importOriginal();
        await gate;
        return actual;
      }
    );
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    window.history.replaceState({}, "", handoffPath);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: pairOptions }), { status: 200 })
    );
    const host = document.createElement("div");
    document.body.append(host);
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
      expect(
        host.querySelector<HTMLSelectElement>('[aria-label="Student from round"]')!.disabled
      ).toBe(true);
      await act(async () =>
        root.render(
          <GovernedStakeholderIntelligenceProjection
            apiBase="http://api.test"
            tenantId="tenant_demo"
            token="unit-session"
          />
        )
      );
      await act(async () => {
        release();
        await vi.dynamicImportSettled();
      });
      expect(
        host.querySelector<HTMLSelectElement>('[aria-label="Student from round"]')!.disabled
      ).toBe(true);
      expect(host.textContent).toContain("PAIR_SELECTION_UNAVAILABLE");
      expect(document.activeElement).not.toBe(host.querySelector("#gsi-student-reflection"));
    } finally {
      release();
      await act(async () => root.unmount());
      host.remove();
    }
  });

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
      await act(async () => vi.dynamicImportSettled());
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
