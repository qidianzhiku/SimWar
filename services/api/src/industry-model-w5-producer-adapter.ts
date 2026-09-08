import type {
  ModelArtifactReference,
  ModelVersionReference,
  W5ConvergenceProjection,
  W5ScenarioDraft
} from "@simwar/shared-contracts";

export interface W5IndustryDiagnosticContext {
  readonly tenant_id: string;
  readonly course_id: string;
  readonly run_id: string;
  readonly team_id: string;
  readonly round_id: string;
  readonly round_no: number;
  readonly scenario_package_id: string;
  readonly parameter_set_id: string;
}

export interface W5IndustryDiagnosticProducerEvidence {
  readonly producer_id: string;
  readonly diagnostic_family: string;
  readonly classification: "WANT_EVIDENCE" | "REALIZED_REFERENCE" | "NOT_PROVEN";
  readonly evidence_identity: string;
  readonly authority_owner: string;
  readonly source: { readonly path: string; readonly symbol: string };
  readonly freshness: "FRESH" | "UNKNOWN";
  readonly official_truth_write: false;
  readonly known_limits: readonly string[];
  readonly producer_model_version_reference?: ModelVersionReference;
  readonly producer_model_artifact_reference?: ModelArtifactReference;
}

export interface W5IndustryDiagnosticProducerResult {
  readonly producers: readonly W5IndustryDiagnosticProducerEvidence[];
  readonly known_limits: readonly string[];
  readonly identity_movements: readonly string[];
  readonly rebase_required: boolean;
}

function notProven(producer_id: string, diagnostic_family: string, known_limits: readonly string[]): W5IndustryDiagnosticProducerEvidence {
  return {
    producer_id,
    diagnostic_family,
    classification: "NOT_PROVEN",
    evidence_identity: "NOT_PROVEN",
    authority_owner: "UNPROVEN",
    source: { path: "UNPROVEN", symbol: "UNPROVEN" },
    freshness: "UNKNOWN",
    official_truth_write: false,
    known_limits: [...known_limits]
  };
}

function intrinsicLineage(convergence: W5ConvergenceProjection) {
  return convergence.producer_intrinsic_lineage;
}

function exactBindingMovements(context: W5IndustryDiagnosticContext, draft: W5ScenarioDraft, convergence: W5ConvergenceProjection): string[] {
  const binding = draft.exact_runtime_binding;
  const movements: string[] = [];
  if (!binding || binding.status !== "BOUND") return ["w5_binding"];
  if (binding.tenant_id !== context.tenant_id) movements.push("w5_tenant");
  if (binding.course_id !== context.course_id || draft.course_id !== context.course_id) movements.push("w5_course");
  if (binding.run_id !== context.run_id) movements.push("w5_run");
  if (binding.round_no !== context.round_no) movements.push("w5_round");
  if (binding.scenario_package_reference.scenario_package_id !== context.scenario_package_id) movements.push("w5_scenario_package");
  if (binding.parameter_set_reference.parameter_set_id !== context.parameter_set_id) movements.push("w5_parameter_set");
  if (convergence.security.tenant !== context.tenant_id) movements.push("w5_security_tenant");
  if (convergence.security.course !== context.course_id) movements.push("w5_security_course");
  if (convergence.security.run !== context.run_id) movements.push("w5_security_run");
  if (convergence.security.team !== context.team_id) movements.push("w5_team");
  if (convergence.security.round !== context.round_no) movements.push("w5_security_round");
  return movements;
}

export function adaptW5IndustryDiagnosticProducers(input: { context: W5IndustryDiagnosticContext; draft: W5ScenarioDraft | null; convergence: W5ConvergenceProjection | null }): W5IndustryDiagnosticProducerResult {
  const wantId = "w5-governed-demand-candidate";
  const realizedId = "simulation-core-w5-realization";
  const baseLimits = [
    "WANT_IS_SYNTHETIC_HEURISTIC",
    "WANT_NOT_CALIBRATED",
    "W5_PRODUCER_OFFICIAL_TRUTH_WRITE_FALSE",
    "REALIZED_IS_REFERENCE_ONLY",
    "REALIZED_WRITES_FORMAL_RESULT_FALSE"
  ];
  if (!input.draft || !input.convergence) {
    return {
      producers: [
        notProven(wantId, "W5 governed demand candidate", ["W5_EXACT_BOUND_DRAFT_REQUIRED"]),
        notProven(realizedId, "Simulation Core W5 realized reference", ["W5_EXACT_BOUND_DRAFT_REQUIRED"])
      ],
      known_limits: ["W5_EXACT_BOUND_DRAFT_REQUIRED"],
      identity_movements: [],
      rebase_required: false
    };
  }
  const identityMovements = exactBindingMovements(input.context, input.draft, input.convergence);
  const flags = input.convergence.demand_realization.candidate.authority_flags;
  if (flags.official_truth_write || flags.settlement_write || flags.provider_calls !== 0 || input.convergence.realized.writes_formal_result) {
    const limits = [...baseLimits, "W5_PRODUCER_AUTHORITY_INVALID"];
    return { producers: [notProven(wantId, "W5 governed demand candidate", limits), notProven(realizedId, "Simulation Core W5 realized reference", limits)], known_limits: limits, identity_movements: identityMovements, rebase_required: false };
  }
  if (identityMovements.length > 0) {
    const limits = ["W5_IDENTITY_MOVED_REQUIRES_REBASE"];
    return { producers: [notProven(wantId, "W5 governed demand candidate", limits), notProven(realizedId, "Simulation Core W5 realized reference", limits)], known_limits: limits, identity_movements: identityMovements, rebase_required: true };
  }
  return {
    producers: [
      {
        producer_id: wantId,
        diagnostic_family: "W5 governed demand / preference candidate",
        classification: "WANT_EVIDENCE",
        evidence_identity: input.convergence.demand_realization.candidate.candidate_digest,
        authority_owner: "W5_MODEL_GOVERNANCE_PLANE",
        source: { path: "services/api/src/w5-governed-model-service.ts", symbol: "W5GovernedModelService.evaluate" },
        freshness: "FRESH",
        official_truth_write: false,
        known_limits: baseLimits,
        ...(intrinsicLineage(input.convergence)?.model_version_reference
          ? { producer_model_version_reference: intrinsicLineage(input.convergence)!.model_version_reference }
          : {}),
        ...(intrinsicLineage(input.convergence)?.model_artifact_reference
          ? { producer_model_artifact_reference: intrinsicLineage(input.convergence)!.model_artifact_reference }
          : {})
      },
      {
        producer_id: realizedId,
        diagnostic_family: "Simulation Core realized reference",
        classification: "REALIZED_REFERENCE",
        evidence_identity: input.convergence.realized.replay_relevant_digest,
        authority_owner: "SIMULATION_CORE",
        source: { path: "services/simulation-core/src/w5-governed-convergence.ts", symbol: "evaluateW5CoreRealization" },
        freshness: "FRESH",
        official_truth_write: false,
        // The current Simulation Core realization contract does not expose a
        // typed model/artifact lineage of its own. Do not copy the governed
        // demand producer's identity onto the separate REALIZED reference.
        known_limits: [...baseLimits, "REALIZED_TYPED_LINEAGE_NOT_EXPOSED_BY_CORE"]
      }
    ],
    known_limits: baseLimits,
    identity_movements: [],
    rebase_required: false
  };
}
