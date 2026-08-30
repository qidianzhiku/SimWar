/** @vitest-environment jsdom */

import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { ShanghaiFullVerticalTeacherPanel } from "../../apps/teacher/src/ShanghaiFullVerticalPanel";
import { W5GovernedModelStudio } from "../../apps/teacher/src/W5GovernedModelStudio";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const missionId = "MAIN-SH-FV-O1-GOVERNED-SHANGHAI-FULL-VERTICAL";
const schemaVersion = "simwar.shanghai.full-vertical.v1";
const draft = {
  draft_id: "draft-created-in-studio",
  status: "DRAFT",
  title: "Shanghai O1 browser journey"
};

function teacherProjection(exact: boolean) {
  return {
    binding: null,
    exact_context: {
      course_id: "course_demo",
      draft_id: exact ? draft.draft_id : null,
      round_no: exact ? 1 : null,
      run_id: exact ? "run_demo" : null
    },
    journey: {
      admin_audit: exact ? "READY" : "BLOCKED",
      exact_binding: exact,
      student_projection: exact ? "READY" : "BLOCKED",
      teacher_preview: exact ? "READY" : "BLOCKED"
    },
    known_limits: [],
    mission_id: missionId,
    preview: null,
    schema_version: schemaVersion,
    status: exact ? "READY_WITH_LIMITS" : "NOT_READY",
    surface: "TEACHER",
    teacher_projection: {
      drafts: [draft],
      known_limits: [],
      model_version: { model_family_readiness: [], model_version_ref: "model@1.0.0" },
      operation_id: "W5_TEACHER_GOVERNED_MODEL_STUDIO_GET_V1",
      parameter_descriptors: [],
      security: {}
    }
  };
}

function LifecycleHarness() {
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  return (
    <>
      <W5GovernedModelStudio
        apiBase="http://localhost:3000"
        courseId="course_demo"
        onDraftChange={setSelectedDraftId}
        roundNo={1}
        runId="run_demo"
        tenantId="tenant_demo"
        token="teacher-token"
      />
      <ShanghaiFullVerticalTeacherPanel
        apiBase="http://localhost:3000"
        courseId="course_demo"
        draftId={selectedDraftId}
        roundNo={1}
        runId="run_demo"
        tenantId="tenant_demo"
        token="teacher-token"
      />
    </>
  );
}

function UnstableDraftCallbackHarness() {
  const [renderCount, setRenderCount] = useState(0);
  return (
    <>
      <button onClick={() => setRenderCount((current) => current + 1)}>rerender parent</button>
      <span>{renderCount}</span>
      <W5GovernedModelStudio
        apiBase="http://localhost:3000"
        courseId="course_demo"
        onDraftChange={() => undefined}
        roundNo={1}
        runId="run_demo"
        tenantId="tenant_demo"
        token="teacher-token"
      />
    </>
  );
}

describe("Shanghai full vertical lifecycle wiring", () => {
  it("does not request a stale draft when the current Run lacks an exact binding", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () => {
        root.render(
          <ShanghaiFullVerticalTeacherPanel
            apiBase="http://localhost:3000"
            courseId="course_demo"
            draftId="w5_draft_1"
            enabled={false}
            roundNo={1}
            runId="run_011"
            tenantId="tenant_demo"
            token="teacher-token"
          />
        );
        await Promise.resolve();
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(host.textContent).toContain("等待当前 Run 的 W5 exact binding");
    } finally {
      await act(async () => root.unmount());
      host.remove();
      vi.unstubAllGlobals();
    }
  });

  it("pushes the W5 Studio draft lifecycle into the O1 preview without a reload", async () => {
    const requests: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        requests.push(`${method} ${url}`);
        if (method === "POST") {
          return new Response(JSON.stringify({ code: "OK", data: { draft }, message: "ok" }), {
            headers: { "content-type": "application/json" },
            status: 201
          });
        }
        const exact = url.includes("/api/v1/bff/teacher/shanghai/full-vertical?")
          ? url.includes("draftId=draft-created-in-studio")
          : false;
        const data = url.includes("/api/v1/bff/teacher/shanghai/full-vertical?")
          ? teacherProjection(exact)
          : {
              drafts: [draft],
              model_family_readiness: [],
              model_version: { model_family_readiness: [], model_version_ref: "model@1.0.0" },
              operation_id: "W5_TEACHER_GOVERNED_MODEL_STUDIO_GET_V1",
              parameter_descriptors: [],
              security: {}
            };
        return new Response(JSON.stringify({ code: "OK", data, message: "ok" }), {
          headers: { "content-type": "application/json" },
          status: 200
        });
      })
    );
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () => {
        root.render(<LifecycleHarness />);
      });
      const createButton = Array.from(host.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === "创建草稿"
      );
      expect(createButton).toBeTruthy();
      await act(async () => {
        createButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(host.textContent).toContain("Teacher preview");
      expect(host.textContent).toContain("READY");
      expect(
        requests.some(
          (request) =>
            request.includes("/api/v1/bff/teacher/shanghai/full-vertical?") &&
            request.includes("draftId=draft-created-in-studio")
        )
      ).toBe(true);
    } finally {
      await act(async () => root.unmount());
      host.remove();
      vi.unstubAllGlobals();
    }
  });

  it("does not reload the W5 Studio when its draft callback identity changes", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            code: "OK",
            data: {
              drafts: [draft],
              model_family_readiness: [],
              model_version: { model_family_readiness: [], model_version_ref: "model@1.0.0" },
              operation_id: "W5_TEACHER_GOVERNED_MODEL_STUDIO_GET_V1",
              parameter_descriptors: [],
              security: {}
            },
            message: "ok"
          }),
          { headers: { "content-type": "application/json" }, status: 200 }
        )
    );
    vi.stubGlobal("fetch", fetchMock);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () => {
        root.render(<UnstableDraftCallbackHarness />);
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await act(async () => {
        host.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => root.unmount());
      host.remove();
      vi.unstubAllGlobals();
    }
  });
});
