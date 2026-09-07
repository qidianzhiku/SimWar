import type { CanServiceFeasibilityCandidate } from "@simwar/shared-contracts";

export interface CanIndustryDiagnosticContext {
  readonly tenant_id: string;
  readonly course_id: string;
  readonly run_id: string;
  readonly team_id: string;
  readonly round_id: string;
  readonly scenario_package_id: string;
  readonly parameter_set_id: string;
  readonly observed_team_id: string;
}

export interface CanIndustryDiagnosticProducerEvidence {
  readonly producer_id: "can-service-feasibility";
  readonly diagnostic_family: "CAN service feasibility";
  readonly classification: "CAN_EVIDENCE" | "NOT_PROVEN";
  readonly evidence_identity: string;
  readonly authority_owner: string;
  readonly source: { readonly path: string; readonly symbol: string };
  readonly freshness: "FRESH" | "UNKNOWN";
  readonly official_truth_write: false;
  readonly known_limits: readonly string[];
  readonly derived_status: "FEASIBLE" | "INFEASIBLE" | "UNKNOWN" | "NOT_PROVEN";
}

export interface CanIndustryDiagnosticProducerResult {
  readonly producer: CanIndustryDiagnosticProducerEvidence;
  readonly known_limits: readonly string[];
  readonly identity_movements: readonly string[];
  readonly rebase_required: boolean;
}

function notProven(limits: readonly string[]): CanIndustryDiagnosticProducerEvidence {
  return { producer_id: "can-service-feasibility", diagnostic_family: "CAN service feasibility", classification: "NOT_PROVEN", evidence_identity: "NOT_PROVEN", authority_owner: "UNPROVEN", source: { path: "UNPROVEN", symbol: "UNPROVEN" }, freshness: "UNKNOWN", official_truth_write: false, known_limits: [...limits], derived_status: "NOT_PROVEN" };
}

function identityMovements(context: CanIndustryDiagnosticContext, candidate: CanServiceFeasibilityCandidate): string[] {
  const binding = candidate.exact_binding;
  const movements: string[] = [];
  if (binding.tenant_id !== context.tenant_id) movements.push("can_tenant");
  if (binding.course_id !== context.course_id) movements.push("can_course");
  if (binding.run_id !== context.run_id) movements.push("can_run");
  if (binding.round_id !== context.round_id || binding.round_no !== Number(context.round_id.replace(/^round[-_:]?/iu, ""))) movements.push("can_round");
  if (binding.scenario_package_reference.scenario_package_id !== context.scenario_package_id) movements.push("can_scenario_package");
  if (binding.parameter_set_reference.parameter_set_id !== context.parameter_set_id) movements.push("can_parameter_set");
  if (context.observed_team_id !== context.team_id) movements.push("can_team");
  return movements;
}

export function adaptCanIndustryDiagnosticProducer(input: { context: CanIndustryDiagnosticContext; candidate: CanServiceFeasibilityCandidate | null }): CanIndustryDiagnosticProducerResult {
  if (!input.candidate) {
    const limits = ["CAN_EXACT_SOURCE_REQUIRED"];
    return { producer: notProven(limits), known_limits: limits, identity_movements: [], rebase_required: false };
  }
  const candidate = input.candidate;
  const invalidAuthority = candidate.authority.official_truth_write || candidate.authority.replay_truth_write || candidate.authority.settlement_write || candidate.authority.provider_calls !== 0 || candidate.authority.candidate_writer !== "SIMULATION_CORE_READ_ONLY";
  const movements = identityMovements(input.context, candidate);
  if (invalidAuthority) {
    const limits = ["CAN_PRODUCER_AUTHORITY_INVALID"];
    return { producer: notProven(limits), known_limits: limits, identity_movements: movements, rebase_required: false };
  }
  if (movements.length > 0) {
    const limits = ["CAN_IDENTITY_MOVED_REQUIRES_REBASE"];
    return { producer: notProven(limits), known_limits: limits, identity_movements: movements, rebase_required: true };
  }
  const limits = ["CAN_IS_CANDIDATE_FEASIBILITY_NOT_OFFICIAL_TRUTH", ...(candidate.status === "UNKNOWN" ? ["CAN_STATUS_UNKNOWN_NOT_FEASIBLE"] : [])];
  const producer: CanIndustryDiagnosticProducerEvidence = {
    producer_id: "can-service-feasibility",
    diagnostic_family: "CAN service feasibility",
    classification: "CAN_EVIDENCE",
    evidence_identity: candidate.candidate_digest,
    authority_owner: "SIMULATION_CORE_READ_ONLY",
    source: { path: "services/api/src/can-service-feasibility-service.ts", symbol: "CanServiceFeasibilityService.get" },
    freshness: "FRESH",
    official_truth_write: false,
    known_limits: limits,
    derived_status: candidate.status
  };
  return { producer, known_limits: limits, identity_movements: [], rebase_required: false };
}
