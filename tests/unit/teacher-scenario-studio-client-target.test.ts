import { afterEach, describe, expect, it, vi } from "vitest";
import { loadTeacherScenarioStudioCatalog } from "../../apps/teacher/src/teacher-scenario-studio-client";

afterEach(() => vi.unstubAllGlobals());

describe("Teacher Scenario Studio client request safety", () => {
  it("forwards the caller AbortSignal to the real fetch request", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      return {
        ok: true,
        json: async () => ({
          data: {
            course_blueprints: [],
            model_versions: [],
            operation_id: "TEACHER_SCENARIO_STUDIO_CATALOG_V1",
            scenario_packages: []
          }
        })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    await loadTeacherScenarioStudioCatalog({
      apiBase: "http://fixture",
      signal: controller.signal,
      token: "token"
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("omits an undefined AbortSignal from RequestInit", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init).not.toHaveProperty("signal");
      return {
        ok: true,
        json: async () => ({
          data: {
            course_blueprints: [],
            model_versions: [],
            operation_id: "TEACHER_SCENARIO_STUDIO_CATALOG_V1",
            scenario_packages: []
          }
        })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    await loadTeacherScenarioStudioCatalog({ apiBase: "http://fixture", token: "token" });
  });

  it("fails closed on a malformed catalog response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: { model_versions: "not-an-array" } })
      }))
    );

    await expect(
      loadTeacherScenarioStudioCatalog({ apiBase: "http://fixture", token: "token" })
    ).rejects.toMatchObject({
      code: "TEACHER_SCENARIO_STUDIO_INVALID_RESPONSE"
    });
  });
  it("allows an aborted request to reject without converting it into a product error", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("aborted", "AbortError");
      })
    );

    await expect(
      loadTeacherScenarioStudioCatalog({
        apiBase: "http://fixture",
        signal: controller.signal,
        token: "token"
      })
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
