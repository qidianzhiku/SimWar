import {
  createR7BffEndpointImplementationGate,
  createR7RuntimeAdapterPreparationPackage,
  createR7ScenarioFactorySeedPackage,
  createR7ScenarioParameterShadowReplayAlignmentPackage,
  R7_TEACHER_SCENARIO_SELECTION_READINESS_EXPLICIT_NON_PROOFS as SHARED_R7_READINESS_NON_PROOFS,
  R7_TEACHER_SCENARIO_SELECTION_READINESS_OPERATION_ID as SHARED_R7_READINESS_OPERATION_ID,
  validateR7BffEndpointImplementationGate,
  type ParameterSet,
  type R7TeacherScenarioPackageCandidatesDto,
  type R7TeacherScenarioSelectionReadinessDto,
  type Run,
  type ScenarioPackage
} from "@simwar/shared-contracts";

export const R7_TEACHER_SCENARIO_SELECTION_READINESS_OPERATION_ID =
  SHARED_R7_READINESS_OPERATION_ID;

export const R7_TEACHER_SCENARIO_SELECTION_READINESS_EXPLICIT_NON_PROOFS =
  SHARED_R7_READINESS_NON_PROOFS;

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

export type R7TeacherScenarioSelectionReadinessProjection = R7TeacherScenarioSelectionReadinessDto;

export interface R7TeacherScenarioSelectionReadinessInput {
  implementationGate?: unknown;
  parameterSet: ParameterSet;
  run: Run;
  scenarioPackage: ScenarioPackage;
  tenantId: string;
}

export function createR7TeacherScenarioPackageCandidatesProjection(input: {
  candidates: ScenarioPackage[];
  run: Run;
}): R7TeacherScenarioPackageCandidatesDto {
  const currentScenarioPackageId = input.run.scenario_package_id ?? null;

  return {
    run_id: input.run.run_id,
    current_scenario_package_id: currentScenarioPackageId,
    candidates: [...input.candidates]
      .sort((left, right) => left.scenario_package_id.localeCompare(right.scenario_package_id))
      .map((candidate) => ({
        scenario_package_id: candidate.scenario_package_id,
        display_name: candidate.name,
        version_label: candidate.version,
        is_current: candidate.scenario_package_id === currentScenarioPackageId
      }))
  };
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
