import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ScenarioReadinessRequestError,
  getScenarioReadinessErrorMessage,
  requestScenarioReadiness,
  validateScenarioReadinessInput
} from "../../apps/teacher/src/scenario-readiness";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Teacher scenario readiness client", () => {
  it("validates required identifiers before the readiness request", () => {
    expect(
      validateScenarioReadinessInput({ parameterSetId: "param-1", scenarioPackageId: "" })
    ).toBe("Scenario Package ID is required.");
    expect(
      validateScenarioReadinessInput({ parameterSetId: "", scenarioPackageId: "scenario-1" })
    ).toBe("ParameterSet ID is required.");
  });

  it("uses only an authenticated GET request without a tenant header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          operation_id: "R7_TEACHER_SCENARIO_SELECTION_READINESS_GET_V1",
          tenant_id: "tenant_demo",
          course_id: "course_demo",
          run_id: "run_demo",
          scenario_package_id: "scenario-1",
          parameter_set_id: "param-1",
          eligible: true,
          readiness_status: "READY",
          compatibility_status: "COMPATIBLE_BY_REFERENCE_ONLY",
          provenance_status: "INTERNAL_SYNTHETIC_ONLY",
          qa_status: "DRAFT_REVIEW_REQUIRED",
          license_status: "EXTERNAL_LICENSE_REVIEW_REQUIRED_BEFORE_RELEASE",
          calibration_status: "DRAFT_REGISTER_ONLY",
          runtime_adapter_status: "PREPARATION_PACKAGE_ONLY",
          no_go_reasons: [],
          evidence_freshness: { collected_at: null, expires_at: null, is_expired: false },
          explicit_non_proofs: ["SCENARIO_RUNTIME_NOT_ACTIVATED"]
        }),
        { headers: { "content-type": "application/json" }, status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await requestScenarioReadiness({
      apiBaseUrl: "http://api.example.test",
      parameterSetId: "param-1",
      runId: "run_demo",
      scenarioPackageId: "scenario-1",
      token: "teacher-token"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.example.test/api/v1/bff/teacher/runs/run_demo/scenario-selection-readiness?parameterSetId=param-1&scenarioPackageId=scenario-1",
      {
        headers: { authorization: "Bearer teacher-token" },
        method: "GET"
      }
    );
  });

  it("maps endpoint failures to role-safe messages", () => {
    expect(
      getScenarioReadinessErrorMessage(new ScenarioReadinessRequestError(401, "private"))
    ).toBe("Authentication is required to check readiness.");
    expect(
      getScenarioReadinessErrorMessage(new ScenarioReadinessRequestError(403, "private"))
    ).toBe("You are not authorized to check readiness.");
    expect(
      getScenarioReadinessErrorMessage(new ScenarioReadinessRequestError(404, "private"))
    ).toBe("Readiness is unavailable or out of scope.");
    expect(
      getScenarioReadinessErrorMessage(new ScenarioReadinessRequestError(500, "private"))
    ).toBe("Readiness could not be loaded.");
  });
});
