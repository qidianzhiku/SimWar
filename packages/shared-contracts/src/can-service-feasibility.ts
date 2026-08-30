import type { ParameterSetReference } from "./parameter-set-authority.js";
import type { ScenarioPackageReference } from "./scenario-package-authority.js";

export const CAN_SERVICE_FEASIBILITY_SCHEMA_VERSION = "r1-can-service-feasibility.v1" as const;
export const CAN_SERVICE_FEASIBILITY_OPERATION_ID = "R1_CAN_SERVICE_FEASIBILITY_GET_V1" as const;

export type CanServiceFeasibilitySurface = "teacher" | "student" | "admin";
export type CanServiceFeasibilityStatus = "FEASIBLE" | "INFEASIBLE" | "UNKNOWN";
export type CanConstraintKind = "DEMAND" | "CAPACITY" | "WORKFORCE" | "QUALITY" | "ELIGIBILITY";
export type CanConstraintStatus = "PASS" | "FAIL" | "UNKNOWN";

export interface CanServiceFeasibilityExactBinding {
  binding_digest: string;
  course_id: string;
  model_version_ref: string;
  no_implicit_latest: true;
  parameter_set_reference: ParameterSetReference;
  round_id: string;
  round_no: number;
  run_id: string;
  scenario_package_reference: ScenarioPackageReference;
  seed: number;
  tenant_id: string;
}

export interface CanNumericSignal {
  source_ref: string;
  unit: "CNY" | "households" | "people" | "service_units";
  value: number;
}

export interface CanBooleanSignal {
  source_ref: string;
  value: boolean;
}

export interface CanServiceFeasibilityDomainInput {
  available_capacity_units?: CanNumericSignal;
  binding: CanServiceFeasibilityExactBinding;
  demand_units: CanNumericSignal;
  eligibility: {
    licensed: CanBooleanSignal;
    staffing_compliant: CanBooleanSignal;
  };
  minimum_service_quality_budget: CanNumericSignal;
  minimum_workforce_units: CanNumericSignal;
  service_quality_budget: CanNumericSignal;
  workforce_units: CanNumericSignal;
}

export interface CanConstraintEvidence {
  constraint_id: string;
  explanation: string;
  kind: CanConstraintKind;
  observed: { unit: string; value: boolean | number | null };
  source_ref: string;
  status: CanConstraintStatus;
  threshold?: { unit: string; value: boolean | number | null };
}

export interface CanWhyNotReason {
  code:
    | "CAPACITY_INSUFFICIENT"
    | "WORKFORCE_INSUFFICIENT"
    | "QUALITY_BUDGET_INSUFFICIENT"
    | "ELIGIBILITY_FAILED"
    | "INPUT_UNAVAILABLE";
  constraint_kind: CanConstraintKind;
  source_ref?: string;
  summary: string;
}

export interface CanQueueDisclosure {
  claim: "NOT_CLAIMED";
  reason: "EXACT_QUEUE_INPUT_NOT_AVAILABLE";
}

export interface CanServiceFeasibilityCandidate {
  authority: CanServiceFeasibilityAuthority;
  candidate_digest: string;
  candidate_id: string;
  constraints: readonly CanConstraintEvidence[];
  exact_binding: CanServiceFeasibilityExactBinding;
  queue: CanQueueDisclosure;
  status: CanServiceFeasibilityStatus;
  why_not: readonly CanWhyNotReason[];
}

export interface CanServiceFeasibilityAuthority {
  candidate_writer: "SIMULATION_CORE_READ_ONLY";
  official_truth_write: false;
  provider_calls: 0;
  replay_truth_write: false;
  settlement_write: false;
}

export interface CanServiceFeasibilityTeacherProjection {
  candidate_id: string;
  constraints: readonly CanConstraintEvidence[];
  exact_binding: CanServiceFeasibilityExactBinding;
  status: CanServiceFeasibilityStatus;
  surface: "teacher";
  why_not: readonly CanWhyNotReason[];
}

export interface CanServiceFeasibilityStudentProjection {
  candidate_id: string;
  excluded_fields: readonly string[];
  role_safe: true;
  status: CanServiceFeasibilityStatus;
  surface: "student";
  why_not: readonly Pick<CanWhyNotReason, "code" | "constraint_kind" | "summary">[];
}

export interface CanServiceFeasibilityAdminProjection {
  candidate_id: string;
  exact_inputs: CanServiceFeasibilityDomainInput;
  limits: readonly string[];
  no_write: true;
  source_refs: readonly string[];
  status: CanServiceFeasibilityStatus;
  surface: "admin";
}

export interface CanServiceFeasibilityProductReceipt {
  exact_binding_digest: string;
  no_write: true;
  operation_id: typeof CAN_SERVICE_FEASIBILITY_OPERATION_ID;
  state_transition: "STATE_A_TO_STATE_B";
}

export interface CanServiceFeasibilityResponse {
  authority: CanServiceFeasibilityAuthority;
  candidate?: CanServiceFeasibilityCandidate;
  candidate_id: string;
  exact_binding?: CanServiceFeasibilityExactBinding;
  known_limits: readonly string[];
  product_receipt: CanServiceFeasibilityProductReceipt;
  schema_version: typeof CAN_SERVICE_FEASIBILITY_SCHEMA_VERSION;
  source_refs: readonly string[];
  surface: CanServiceFeasibilitySurface;
  admin_projection?: CanServiceFeasibilityAdminProjection;
  student_projection?: CanServiceFeasibilityStudentProjection;
  teacher_projection?: CanServiceFeasibilityTeacherProjection;
}

const EXACT_ID = /^[A-Za-z0-9]+(?:[._:@+-][A-Za-z0-9]+)*$/u;
const BANNED_ID =
  /(?:^|[._:@+-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:@+-])/iu;

function exactId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    EXACT_ID.test(value) &&
    !BANNED_ID.test(value)
  );
}

function digest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function exactReference(value: unknown, withTenant: boolean): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const reference = value as Record<string, unknown>;
  return (
    exactId(reference[withTenant ? "scenario_package_id" : "parameter_set_id"]) &&
    exactId(reference.version) &&
    digest(reference.content_digest) &&
    (!withTenant || exactId(reference.tenant_id))
  );
}

function exactBinding(value: unknown): value is CanServiceFeasibilityExactBinding {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const binding = value as Record<string, unknown>;
  return (
    digest(binding.binding_digest) &&
    exactId(binding.course_id) &&
    exactId(binding.model_version_ref) &&
    binding.no_implicit_latest === true &&
    exactReference(binding.parameter_set_reference, false) &&
    exactId(binding.round_id) &&
    Number.isSafeInteger(binding.round_no) &&
    Number(binding.round_no) > 0 &&
    exactId(binding.run_id) &&
    exactReference(binding.scenario_package_reference, true) &&
    Number.isSafeInteger(binding.seed) &&
    Number(binding.seed) >= 0 &&
    exactId(binding.tenant_id)
  );
}

function candidate(value: unknown): value is CanServiceFeasibilityCandidate {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    (item.authority as Record<string, unknown> | undefined)?.candidate_writer ===
      "SIMULATION_CORE_READ_ONLY" &&
    (item.authority as Record<string, unknown> | undefined)?.official_truth_write === false &&
    (item.authority as Record<string, unknown> | undefined)?.provider_calls === 0 &&
    (item.authority as Record<string, unknown> | undefined)?.replay_truth_write === false &&
    (item.authority as Record<string, unknown> | undefined)?.settlement_write === false &&
    digest(item.candidate_digest) &&
    exactId(item.candidate_id) &&
    Array.isArray(item.constraints) &&
    item.constraints.every((constraint) => constraint && typeof constraint === "object") &&
    exactBinding(item.exact_binding) &&
    (item.queue as Record<string, unknown> | undefined)?.claim === "NOT_CLAIMED" &&
    (item.queue as Record<string, unknown> | undefined)?.reason ===
      "EXACT_QUEUE_INPUT_NOT_AVAILABLE" &&
    ["FEASIBLE", "INFEASIBLE", "UNKNOWN"].includes(String(item.status)) &&
    Array.isArray(item.why_not)
  );
}

export function isCanServiceFeasibilityResponse(
  value: unknown
): value is CanServiceFeasibilityResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const response = value as Record<string, unknown>;
  const authority = response.authority as Record<string, unknown> | undefined;
  const receipt = response.product_receipt as Record<string, unknown> | undefined;
  return (
    response.schema_version === CAN_SERVICE_FEASIBILITY_SCHEMA_VERSION &&
    ["teacher", "student", "admin"].includes(String(response.surface)) &&
    exactId(response.candidate_id) &&
    (response.surface === "student"
      ? response.candidate === undefined &&
        response.exact_binding === undefined &&
        Array.isArray(response.source_refs) &&
        response.source_refs.length === 0 &&
        response.student_projection !== undefined
      : exactBinding(response.exact_binding) &&
        candidate(response.candidate) &&
        response.candidate_id ===
          (response.candidate as CanServiceFeasibilityCandidate).candidate_id) &&
    Array.isArray(response.known_limits) &&
    Array.isArray(response.source_refs) &&
    authority?.candidate_writer === "SIMULATION_CORE_READ_ONLY" &&
    authority.official_truth_write === false &&
    authority.provider_calls === 0 &&
    authority.replay_truth_write === false &&
    authority.settlement_write === false &&
    digest(receipt?.exact_binding_digest) &&
    receipt.no_write === true &&
    receipt.operation_id === CAN_SERVICE_FEASIBILITY_OPERATION_ID &&
    receipt.state_transition === "STATE_A_TO_STATE_B"
  );
}
