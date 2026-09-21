/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { GovernedStakeholderIntelligenceAuditPanel } from "../../apps/admin/src/GovernedStakeholderIntelligenceAuditPanel";
import { TeacherDebriefWorkspace } from "../../apps/teacher/src/P2BTeacherDebriefWorkspace";

async function enter(host: HTMLElement, label: string, value: string) {
  await act(async () => {
    const input = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("R5 Admin request identity", () => {
  it.each([
    {},
    { role_key: "" },
    { activity_id: "" },
    { round_no: 0 },
    { run_id: "latest" },
    { tenant_id: "tenant_other" }
  ])("bounds invalid explicit Teacher DDT context %j", async (override) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 404 }));
    const root = createRoot(document.createElement("div"));
    try {
      const context = {
        tenant_id: "tenant_one",
        course_id: "course_one",
        run_id: "run_one",
        round_id: "round_one",
        round_no: 1,
        team_id: "team_one",
        role_key: "CFO",
        activity_id: "activity_explicit",
        ...override
      };
      await act(async () =>
        root.render(
          <TeacherDebriefWorkspace
            apiBase="http://api.test"
            token="token"
            tenantId="tenant_one"
            evidenceSpineEnabled
            ddtContext={context}
          />
        )
      );
      const requests = fetchSpy.mock.calls.filter(([url]) =>
        String(url).includes("decision-thread")
      );
      expect(requests).toHaveLength(Object.keys(override).length === 0 ? 1 : 0);
      if (requests.length) expect(String(requests[0]![0])).toContain("role_key=CFO");
    } finally {
      await act(async () => root.unmount());
      fetchSpy.mockRestore();
      vi.unstubAllGlobals();
    }
  });
  it.each(
    ["pair", "compare"].flatMap((request) =>
      ["apiBase", "token", "tenantId", "context", "unmount"].flatMap((change) =>
        ["success", "error"].map((outcome) => ({ request, change, outcome }))
      )
    )
  )("invalidates $request $outcome on $change", async ({ request, change, outcome }) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    let resolve!: (value: Response) => void;
    let reject!: (error: Error) => void;
    const pending = new Promise<Response>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    let signal: AbortSignal | undefined;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((_url, options) => {
      signal = options?.signal as AbortSignal;
      return pending;
    });
    const host = document.createElement("div");
    const root = createRoot(host);
    let mounted = true;
    const props = { apiBase: "http://api.test", token: "old", tenantId: "tenant_one" };
    try {
      await act(async () => root.render(<GovernedStakeholderIntelligenceAuditPanel {...props} />));
      for (const field of ["course", "run", "team"])
        await enter(host, `GSI admin ${field} context`, `${field}_one`);
      if (request === "compare") {
        await enter(host, "GSI admin from candidate ID", "candidate_one");
        await enter(host, "GSI admin to candidate ID", "candidate_two");
      }
      await act(async () => {
        if (request === "pair")
          Array.from(host.querySelectorAll("button"))
            .find((button) => button.textContent === "加载可比较回合")!
            .click();
        else
          host
            .querySelector("form")!
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
      expect(signal).toBeDefined();
      if (change === "context") await enter(host, "GSI admin role key", "CFO");
      else
        await act(async () => {
          if (change === "unmount") {
            root.unmount();
            mounted = false;
          } else
            root.render(
              <GovernedStakeholderIntelligenceAuditPanel {...props} {...{ [change]: "changed" }} />
            );
        });
      const aborted = signal!.aborted;
      await act(async () => {
        if (outcome === "error") reject(new Error("late private response"));
        else
          resolve(
            new Response(
              JSON.stringify({
                data:
                  request === "pair"
                    ? { rounds: [{ round_id: "late_private_round", round_no: 99 }] }
                    : {
                        tenant_id: "late private response",
                        comparison: {
                          pair: {
                            from: { round_no: 1, candidate_id: "late private response" },
                            to: { round_no: 2 }
                          },
                          movements: []
                        },
                        context: { status: "AVAILABLE" },
                        known_limits: []
                      }
              }),
              { status: 200 }
            )
          );
      });
      expect(host.textContent).not.toContain("late private response");
      expect(host.querySelector('option[value="late_private_round"]')).toBeNull();
      expect(aborted).toBe(true);
    } finally {
      if (mounted) await act(async () => root.unmount());
      fetchSpy.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("binds DDT to the authorized activity", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 404 }));
    const host = document.createElement("div");
    const root = createRoot(host);
    try {
      await act(async () =>
        root.render(
          <GovernedStakeholderIntelligenceAuditPanel
            apiBase="http://api.test"
            token="token"
            tenantId="tenant_one"
          />
        )
      );
      for (const field of ["course", "run", "team"])
        await enter(host, `GSI admin ${field} context`, `${field}_one`);
      await enter(host, "GSI admin activity ID", "activity_explicit");
      await enter(host, "DDT admin exact round ID", "round_one");
      await enter(host, "DDT admin exact round number", "1");
      expect(
        fetchSpy.mock.calls.some(([url]) =>
          String(url).includes("activity_id=activity_consequence")
        )
      ).toBe(true);
      expect(
        fetchSpy.mock.calls.some(([url]) => String(url).includes("activity_id=activity_explicit"))
      ).toBe(false);
    } finally {
      await act(async () => root.unmount());
      fetchSpy.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("does not use legacy W3 selection as Teacher DDT authority", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 404 }));
    const host = document.createElement("div");
    const root = createRoot(host);
    try {
      await act(async () =>
        root.render(
          <TeacherDebriefWorkspace
            apiBase="http://api.test"
            token="token"
            tenantId="tenant_one"
            evidenceSpineEnabled
            context={{
              tenant_id: "tenant_one",
              course_id: "course_one",
              run_id: "run_one",
              round_id: "round_one",
              round_no: 1,
              team_id: "team_first",
              role_key: "CEO",
              activity_id: "activity_consequence"
            }}
          />
        )
      );
      expect(
        fetchSpy.mock.calls.filter(([url]) => String(url).includes("decision-thread"))
      ).toHaveLength(0);
    } finally {
      await act(async () => root.unmount());
      fetchSpy.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
