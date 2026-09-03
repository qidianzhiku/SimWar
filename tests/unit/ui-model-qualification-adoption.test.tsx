/** @vitest-environment jsdom */
import React, { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModelQualificationAdoptionPanel } from "../../packages/ui/src/components/ModelQualificationAdoptionPanel";

const props = {
  apiBase: "http://fixture",
  courseId: "course_a",
  tenantId: "tenant_a",
  token: "fixture-only",
  role: "teacher" as const
};
const empty = {
  qualifications: [],
  source_packages: [],
  calibration_datasets: [],
  model_catalog: [],
  known_limits: []
};
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("exact evidence adoption UI", () => {
  it("invalidates a loaded historical receipt when its exact locator changes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () => ({
          data: url.includes("run-admissions") ? { adoption_id: "private-receipt-run-a" } : empty
        })
      }))
    );
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<ModelQualificationAdoptionPanel {...props} />));
    const input = host.querySelector('[aria-label="历史 Run ID"]') as HTMLInputElement;
    const setValue = (value: string) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    await act(async () => setValue("run-a"));
    await act(async () => {
      (
        Array.from(host.querySelectorAll("button")).find(
          (button) => button.textContent === "读取该 Run 原始证据"
        ) as HTMLButtonElement
      ).click();
    });
    expect(host.textContent).toContain("private-receipt-run-a");
    await act(async () => setValue("run-b"));
    expect(host.querySelector('[data-testid="historical-admission-receipt"]')).toBeNull();
    await act(async () => root.unmount());
  });

  it("does not paint the prior context historical receipt before passive reset", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () => ({
          data: url.includes("run-admissions") ? { adoption_id: "private-context-a" } : empty
        })
      }))
    );
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const painted: string[] = [];
    function Harness({ courseId }: { courseId: string }) {
      useLayoutEffect(() => {
        if (courseId === "course_b") painted.push(host.textContent ?? "");
      }, [courseId]);
      return <ModelQualificationAdoptionPanel {...props} courseId={courseId} />;
    }
    await act(async () => root.render(<Harness courseId="course_a" />));
    const input = host.querySelector('[aria-label="历史 Run ID"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        input,
        "run-a"
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      (
        Array.from(host.querySelectorAll("button")).find(
          (button) => button.textContent === "读取该 Run 原始证据"
        ) as HTMLButtonElement
      ).click();
    });
    expect(host.textContent).toContain("private-context-a");
    await act(async () => root.render(<Harness courseId="course_b" />));
    expect(painted).toHaveLength(1);
    expect(painted[0]).not.toContain("private-context-a");
    await act(async () => root.unmount());
  });

  it("serializes same-tick submit events into one governed command", async () => {
    const fixture = {
      ...empty,
      qualifications: [
        {
          qualification_id: "q1",
          source_package_id: "s1",
          review: { status: "APPROVED" },
          binding: { status: "BOUND" }
        }
      ]
    };
    const fetchMock = vi.fn((url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? new Promise(() => {})
        : Promise.resolve({ ok: true, json: async () => ({ data: fixture }) })
    );
    vi.stubGlobal("fetch", fetchMock);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<ModelQualificationAdoptionPanel {...props} />));
    const select = host.querySelector(
      '[aria-label="待采用的 exact Qualification"]'
    ) as HTMLSelectElement;
    await act(async () => {
      select.value = "q1";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const button = host.querySelector(
      '[data-testid="request-evidence-adoption"]'
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    await act(async () => {
      button.click();
      button.click();
    });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    await act(async () => root.unmount());
  });
  it("does not select latest or automatically mutate after loading", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ data: empty }) }));
    vi.stubGlobal("fetch", fetchMock);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<ModelQualificationAdoptionPanel {...props} />);
    });
    expect(host.textContent).toContain("尚无明确采用记录");
    expect(host.textContent).toContain("Provider OFF");
    expect(
      (host.querySelector('[data-testid="request-evidence-adoption"]') as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(
      fetchMock.mock.calls.every(
        (call) =>
          !((call as unknown[])[1] as RequestInit | undefined)?.method ||
          ((call as unknown[])[1] as RequestInit).method === "GET"
      )
    ).toBe(true);
    await act(async () => root.unmount());
  });

  it("does not display a late response from another Course context", async () => {
    let resolveOld!: (value: unknown) => void;
    const oldResponse = new Promise((resolve) => {
      resolveOld = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url.includes("course_a")
          ? oldResponse
          : Promise.resolve({ ok: true, json: async () => ({ data: empty }) })
      )
    );
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<ModelQualificationAdoptionPanel {...props} />);
    });
    await act(async () => {
      root.render(<ModelQualificationAdoptionPanel {...props} courseId="course_b" />);
    });
    await act(async () => {
      resolveOld({
        ok: true,
        json: async () => ({
          data: { ...empty, qualifications: [{ qualification_id: "private-old-course" }] }
        })
      });
    });
    expect(host.textContent).not.toContain("private-old-course");
    expect(host.textContent).toContain("course_b");
    await act(async () => root.unmount());
  });
});
