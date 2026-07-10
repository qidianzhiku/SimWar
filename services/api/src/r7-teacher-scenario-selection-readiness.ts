import {
  createR7BffEndpointImplementationGate,
  createR7RuntimeAdapterPreparationPackage,
  createR7ScenarioFactorySeedPackage,
  createR7ScenarioParameterShadowReplayAlignmentPackage,
  validateR7BffEndpointImplementationGate,
  type ParameterSet,
  type Run,
  type ScenarioPackage
} from "@simwar/shared-contracts";

export const R7_TEACHER_SCENARIO_SELECTION_READINESS_OPERATION_ID =
  "R7_TEACHER_SCENARIO_SELECTION_READINESS_GET_V1" as const;

export const R7_TEACHER_SCENARIO_SELECTION_READINESS_EXPLICIT_NON_PROOFS = [
  "SCENARIO_RUNTIME_NOT_ACTIVATED",
  "PARAMETERSET_NOT_MUTATED",
  "REPLAY_NOT_EXECUTED",
  "SETTLEMENT_NOT_EXECUTED",
  "ENDPOINT_RESPONSE_NOT_FORMAL_TRUTH"
] as const;

export type R7TeacherScenarioSelectionGateStatus = "FAIL" | "UNKNOWN";

export class R7TeacherScenarioSelectionGateBlockedError extends Error {
  constructor(
    readonly status: R7TeacherScenarioSelectionGateStatus,
    readonly noGoReasons: string[]
  ) {
    super("R7 Teacher scenario selection implementation gate blocked");
    this.name = "R7TeacherScenarioSelectionGateBlockedError";
  }
}

export interface R7TeacherScenarioSelectionReadinessProjection {
  operation_id: typeof R7_TEACHER_SCENARIO_SELECTION_READINESS_OPERATION_ID;
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
  explicit_non_proofs: typeof R7_TEACHER_SCENARIO_SELECTION_READINESS_EXPLICIT_NON_PROOFS;
}

export interface R7TeacherScenarioSelectionReadinessInput {
  implementationGate?: unknown;
  parameterSet: ParameterSet;
  run: Run;
  scenarioPackage: ScenarioPackage;
  tenantId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function createR7TeacherScenarioSelectionReadinessProjection(
  input: R7TeacherScenarioSelectionReadinessInput
): R7TeacherScenarioSelectionReadinessProjection {
  const implementationGate =
    input.implementationGate === undefined
      ? createR7BffEndpointImplementationGate()
      : input.implementationGate;
  const gateValidation = validateR7BffEndpointImplementationGate(implementationGate);

  if (!gateValidation.ok) {
    throw new R7TeacherScenarioSelectionGateBlockedError(
      isRecord(implementationGate) ? "FAIL" : "UNKNOWN",
      gateValidation.issues
    );
  }

  const seedPackage = createR7ScenarioFactorySeedPackage();
  const alignmentPackage = createR7ScenarioParameterShadowReplayAlignmentPackage(seedPackage);
  const runtimeAdapterPackage = createR7RuntimeAdapterPreparationPackage();
  const noGoReasons: string[] = [];

  if (input.scenarioPackage.status !== "approved") {
    noGoReasons.push("R7_BFF_SCENARIO_PACKAGE_NOT_APPROVED");
  }
  if (input.parameterSet.status !== "approved") {
    noGoReasons.push("R7_BFF_PARAMETER_SET_NOT_APPROVED");
  }

  return {
    operation_id: R7_TEACHER_SCENARIO_SELECTION_READINESS_OPERATION_ID,
    tenant_id: input.tenantId,
    course_id: input.run.course_id,
    run_id: input.run.run_id,
    scenario_package_id: input.scenarioPackage.scenario_package_id,
    parameter_set_id: input.parameterSet.parameter_set_id,
    eligible: noGoReasons.length === 0,
    readiness_status: noGoReasons.length === 0 ? "READY" : "BLOCKED",
    compatibility_status: alignmentPackage.compatibility_matrix.parameter_set.status,
    provenance_status: seedPackage.license_provenance_register[0]?.provenance_status ?? "UNKNOWN",
    qa_status: seedPackage.qa_register[0]?.qa_status ?? "UNKNOWN",
    license_status:
      seedPackage.license_provenance_register[0]
        ?.external_license_review_required_before_release === true
        ? "EXTERNAL_LICENSE_REVIEW_REQUIRED_BEFORE_RELEASE"
        : "NO_EXTERNAL_LICENSE_REVIEW_REQUIRED",
    calibration_status: alignmentPackage.calibration_register.status,
    runtime_adapter_status: runtimeAdapterPackage.status,
    no_go_reasons: noGoReasons,
    evidence_freshness: {
      collected_at: null,
      expires_at: null,
      is_expired: false
    },
    explicit_non_proofs: R7_TEACHER_SCENARIO_SELECTION_READINESS_EXPLICIT_NON_PROOFS
  };
}
