/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModelQualificationCoursePortfolioPanel } from "../../apps/admin/src/ModelQualificationCoursePortfolioPanel";

function response<T>(data: T) {
  return { ok: true, json: async () => ({ data }) };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

const portfolio = {
  tenant_id: "tenant_demo",
  courses: [
    {
      course: { course_id: "course_demo", tenant_id: "tenant_demo", title: "Demo Course" },
      blockers: [],
      current_adoption: null,
      qualification: null,
      qualification_consistency: "CONSISTENT",
      known_limits: [],
      o8_outcomes: []
    }
  ],
  blockers: [],
  portfolio_state_digest: "a".repeat(64),
  portfolio_status: "READY" as const,
  derived: true as const,
  query_only: true as const,
  provider: "OFF" as const,
  known_limits: []
};

const preview = {
  status: "KEEP_CURRENT",
  blockers: [],
  course_previews: [
    {
      course_id: "course_demo",
      status: "KEEP_CURRENT",
      reasons: [],
      current_adoption: null
    }
  ],
  expected_portfolio_state_digest: "a".repeat(64),
  current_portfolio_state_digest: "a".repeat(64),
  preview_applied: false as const,
  query_only: true as const,
  derived: true as const
};

const changeSet = {
  schema_version: "model-qualification-portfolio-changeset-response.v1",
  request: {
    request_id: "request-1",
    request_digest: "b".repeat(64),
    status: "READY" as const,
    requestable: true,
    portfolio_id: "portfolio-1",
    preview_id: "preview-1",
    preview_digest: "c".repeat(64),
    expected_portfolio_state_digest: "a".repeat(64),
    current_portfolio_state_digest: "a".repeat(64),
    changeset_policy_version: "policy-1",
    changeset_policy_digest: "d".repeat(64),
    selected_course_ids: ["course_demo"],
    selected_courses: [],
    request_persisted: false as const,
    handoff_executed: false as const,
    apply: false as const,
    bulk_apply: false as const,
    cross_course_transaction: false as const,
    writer_effect: "NONE" as const,
    provider: "OFF" as const,
    known_limits: [],
    readback: {
      request_digest: "b".repeat(64),
      request_persisted: false as const,
      handoff_executed: false as const,
      apply: false as const,
      bulk_apply: false as const,
      cross_course_transaction: false as const,
      writer_effect: "NONE" as const,
      formal_truth_write: false as const
    }
  },
  handoffs: []
};

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("O10 Admin portfolio request context", () => {
  it("does not paint a stale changeset response after the selected course changes", async () => {
    const pending = deferred<ReturnType<typeof response<typeof changeSet>>>();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/course-portfolio")) return Promise.resolve(response(portfolio));
        if (url.endsWith("/supersession-preview")) return Promise.resolve(response(preview));
        if (url.endsWith("/changeset-request")) return pending.promise;
        throw new Error(`unexpected url: ${url}`);
      })
    );

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <ModelQualificationCoursePortfolioPanel
          apiBase="http://fixture"
          tenantId="tenant_demo"
          token="token-demo"
        />
      );
    });
    await act(async () => {
      (host.querySelector("button:not([disabled])") as HTMLButtonElement).click();
    });
    const previewButton = Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Supersession Preview")
    ) as HTMLButtonElement;
    await act(async () => previewButton.click());
    const compileButton = Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("编译 O10")
    ) as HTMLButtonElement;
    await act(async () => compileButton.click());

    await act(async () => {
      (host.querySelector('input[type="checkbox"]') as HTMLInputElement).click();
    });
    await act(async () => pending.resolve(response(changeSet)));

    expect(host.textContent).not.toContain("逐课治理 handoff");
    await act(async () => root.unmount());
  });
});
