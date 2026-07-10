export const SCENARIO_READINESS_OPERATION_ID =
  "R7_TEACHER_SCENARIO_SELECTION_READINESS_GET_V1" as const;

export interface ScenarioReadinessResponse {
  operation_id: typeof SCENARIO_READINESS_OPERATION_ID;
  tenant_id: string;
  course_id: string;
  run_id: string;
  scenario_package_id: string;
  parameter_set_id: string;
  eligible: boolean;
  readiness_status: "BLOCKED" | "READY";
  compatibility_status: string;
  provenance_status: string;
  qa_status: string;
  license_status: string;
  calibration_status: string;
  runtime_adapter_status: string;
  no_go_reasons: string[];
  evidence_freshness: {
    collected_at: string | null;
    expires_at: string | null;
    is_expired: boolean;
  };
  explicit_non_proofs: string[];
}

export class ScenarioReadinessRequestError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ScenarioReadinessRequestError";
  }
}

export function validateScenarioReadinessInput(input: {
  parameterSetId: string;
  scenarioPackageId: string;
}): string | undefined {
  if (!input.scenarioPackageId.trim()) {
    return "Scenario Package ID is required.";
  }
  if (!input.parameterSetId.trim()) {
    return "ParameterSet ID is required.";
  }
  return undefined;
}

export async function requestScenarioReadiness(input: {
  apiBaseUrl: string;
  parameterSetId: string;
  runId: string;
  scenarioPackageId: string;
  token: string;
}): Promise<ScenarioReadinessResponse> {
  const query = new URLSearchParams({
    parameterSetId: input.parameterSetId.trim(),
    scenarioPackageId: input.scenarioPackageId.trim()
  });
  const response = await fetch(
    `${input.apiBaseUrl}/api/v1/bff/teacher/runs/${encodeURIComponent(input.runId)}/scenario-selection-readiness?${query.toString()}`,
    {
      headers: {
        authorization: `Bearer ${input.token}`
      },
      method: "GET"
    }
  );
  const payload = (await response.json()) as
    | ScenarioReadinessResponse
    | { error?: { message?: string } };

  if (!response.ok) {
    throw new ScenarioReadinessRequestError(
      response.status,
      "error" in payload && payload.error?.message
        ? payload.error.message
        : "readiness request failed"
    );
  }

  return payload as ScenarioReadinessResponse;
}

export function getScenarioReadinessErrorMessage(error: unknown): string {
  if (!(error instanceof ScenarioReadinessRequestError)) {
    return "Readiness could not be loaded.";
  }
  if (error.status === 401) {
    return "Authentication is required to check readiness.";
  }
  if (error.status === 403) {
    return "You are not authorized to check readiness.";
  }
  if (error.status === 404) {
    return "Readiness is unavailable or out of scope.";
  }
  if (error.status === 409) {
    return "Readiness is blocked by the current gate.";
  }
  return "Readiness could not be loaded.";
}
