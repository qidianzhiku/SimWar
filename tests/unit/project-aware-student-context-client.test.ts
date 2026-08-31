import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchProjectAwareStudentContext } from "../../apps/student/src/project-aware-student-context-client";

afterEach(() => vi.restoreAllMocks());

describe("project-aware student context client", () => {
  it("carries the selected exact round into the BFF request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: {} })
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchProjectAwareStudentContext({
      baseUrl: "http://localhost:3000",
      courseId: "course_demo",
      roundId: "round_2",
      runId: "run_demo",
      teamId: "team_alpha",
      tenantId: "tenant_demo",
      token: "token"
    });

    const requestUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(new URL(requestUrl).searchParams.get("round_id")).toBe("round_2");
  });

  it("does not invent a round when the caller has not selected one", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: {} })
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchProjectAwareStudentContext({
      baseUrl: "http://localhost:3000",
      courseId: "course_demo",
      runId: "run_demo",
      teamId: "team_alpha",
      tenantId: "tenant_demo",
      token: "token"
    });

    const requestUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(new URL(requestUrl).searchParams.has("round_id")).toBe(false);
  });
});
