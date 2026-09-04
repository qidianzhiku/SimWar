/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModelQualificationProjection } from "../../apps/student/src/ModelQualificationProjection";

beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("O6 Student-safe adoption operations UI", () => {
  it("shows only applicability, freshness and limits and never exposes exact rollback identity", async () => {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => ({
        code: "OK",
        message: "ok",
        request_id: "request-o6-student",
        data: url.includes("adoption-operations")
          ? {
              operation_id: "MODEL_QUALIFICATION_ADOPTION_OPERATIONS_STUDENT_GET_V1",
              applicability: "LIMITED",
              freshness: "FRESH",
              requalification_impact: "REVIEW_REQUIRED",
              known_limits: ["Role-safe status only"],
              provider: "OFF",
              advisory_only: true,
              rollback_applied: false,
              official_truth_write: false,
              visibility: "ROLE_SAFE_STUDENT"
            }
          : {
              operation_id: "MODEL_QUALIFICATION_STUDENT_PROJECTION_GET_V1",
              known_limits: [],
              qualification: {
                model_version: "1.0.0",
                decision: "APPROVED",
                binding_status: "BOUND",
                explanation: ["Published role-safe explanation"]
              }
            }
      })
    }));
    vi.stubGlobal("fetch", fetchMock);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <ModelQualificationProjection
          apiBase="http://fixture"
          courseId="course-a"
          qualificationId="qualification-a"
          tenantId="tenant-a"
          token="student-token"
        />
      )
    );
    expect(host.textContent).toContain("applicability=LIMITED");
    expect(host.textContent).toContain("freshness=FRESH");
    expect(host.textContent).toContain("rollback_applied=false");
    expect(host.textContent).not.toContain("adoption_digest");
    expect(host.textContent).not.toContain("predecessor_adoption");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => root.unmount());
  });
});
