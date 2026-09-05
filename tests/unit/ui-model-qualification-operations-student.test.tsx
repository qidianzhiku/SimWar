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
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await act(async () => root.unmount());
  });

  it("keeps the governed O5 explanation visible when the optional O6 projection is unavailable", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("adoption-operations")
        ? {
            ok: false,
            status: 503,
            json: async () => ({ code: "O6_UNAVAILABLE", message: "operations unavailable" })
          }
        : {
            ok: true,
            status: 200,
            json: async () => ({
              code: "OK",
              message: "ok",
              request_id: "request-o5-student",
              data: {
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
          }
    );
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
    expect(host.textContent).toContain("Published role-safe explanation");
    expect(host.textContent).toContain("O6 operations unavailable");
    expect(host.querySelector('[data-testid="student-requalification-status"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="student-adoption-operations-status"]')).toBeNull();
    expect(host.textContent).not.toContain("adoption_digest");
    await act(async () => root.unmount());
  });
});
