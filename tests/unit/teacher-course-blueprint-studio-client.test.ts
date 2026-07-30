import { afterEach, describe, expect, it, vi } from "vitest";
import {
  requestTeacherCourseBlueprintCatalog,
  requestTeacherCourseBlueprintStudioPreview,
  TeacherFormalCourseBindingRequestError
} from "../../apps/teacher/src/scenario-readiness";

describe("Teacher CourseBlueprint Studio client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fails closed when a successful HTTP response omits the API envelope data field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ code: "OK", message: "success", request_id: "req_missing_data" }),
        ok: true,
        status: 200
      })
    );

    await expect(
      requestTeacherCourseBlueprintStudioPreview({
        apiBaseUrl: "http://127.0.0.1:3100",
        courseBlueprintReference: {
          content_digest: "a".repeat(64),
          course_blueprint_id: "blueprint_client_contract",
          tenant_id: "tenant_demo",
          version: "1.0.0"
        },
        token: "test-token"
      })
    ).rejects.toEqual(
      new TeacherFormalCourseBindingRequestError(
        502,
        "formal Course binding response envelope is invalid"
      )
    );
  });

  it("fails closed when the Blueprint catalog response omits envelope data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          candidates: [],
          operation_id: "TEACHER_COURSE_BLUEPRINT_CATALOG_V1"
        }),
        ok: true,
        status: 200
      })
    );

    await expect(
      requestTeacherCourseBlueprintCatalog({
        apiBaseUrl: "http://127.0.0.1:3100",
        token: "test-token"
      })
    ).rejects.toEqual(
      new TeacherFormalCourseBindingRequestError(
        502,
        "CourseBlueprint catalog response envelope is invalid"
      )
    );
  });
});
