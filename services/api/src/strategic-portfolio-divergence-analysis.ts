import { createHash } from "node:crypto";
import type {
  M4TeacherPathProjection,
  W4StrategicPortfolioProjection
} from "@simwar/shared-contracts";

export type StrategicPortfolioDivergenceDimension =
  | "cash"
  | "capacity"
  | "project_count"
  | "changed_paths"
  | "path_members"
  | "path_allocations"
  | "dependency_impact"
  | "path_model_readiness";

export type StrategicPortfolioDivergenceProvability = "PROVEN" | "NOT_PROVEN";

export interface StrategicPortfolioDivergenceAnalysisInput {
  baseline: W4StrategicPortfolioProjection;
  paths: M4TeacherPathProjection[];
  divergence_policy_digest: string;
  expected_portfolio_state_digest?: string;
}

export interface StrategicPortfolioDivergenceDimensionEvidence {
  dimension: StrategicPortfolioDivergenceDimension;
  status: StrategicPortfolioDivergenceProvability;
  evidence_path_ids: string[];
  reason: string;
}

export interface StrategicPortfolioDivergenceEnvelope {
  envelope_id: string;
  envelope_digest: string;
  exact_portfolio: {
    portfolio_id: string;
    portfolio_digest: string;
    tenant_id: string;
    course_id: string;
    run_id: string;
    team_id: string;
    round_no: number;
  };
  official_baseline: {
    officiality: "OFFICIAL";
    portfolio_digest: string;
    member_count: number;
    allocated_capital_principal: number;
    total_project_cost: number;
    known_limits: string[];
  };
  non_official_paths: Array<{
    path_id: string;
    label: string;
    officiality: "NON_OFFICIAL";
    path_digest: string;
    changed_paths: string[];
    outcome_differential: Pick<
      M4TeacherPathProjection["outcome_differential"],
      "cash_delta" | "capacity_delta" | "project_count_delta"
    >;
  }>;
  dimension_evidence: StrategicPortfolioDivergenceDimensionEvidence[];
  policy: {
    divergence_policy_digest: string;
    no_winner_selection: true;
    no_score_or_rank: true;
    no_official_write: true;
    no_apply_to_baseline: true;
  };
  known_limits: string[];
}

export class StrategicPortfolioDivergenceAnalysisError extends Error {
  constructor(readonly code: string, message = code) {
    super(message);
    this.name = "StrategicPortfolioDivergenceAnalysisError";
  }
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function requiredId(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    throw new StrategicPortfolioDivergenceAnalysisError("SP_O3_EXACT_ID_REQUIRED", field);
  }
  return value;
}

function assertExactBaseline(baseline: W4StrategicPortfolioProjection): void {
  if (baseline.candidate_status !== "DERIVED") {
    throw new StrategicPortfolioDivergenceAnalysisError("SP_O3_BASELINE_NOT_DERIVED");
  }
  if (baseline.persistence.historical_decision_reentry !== false) {
    throw new StrategicPortfolioDivergenceAnalysisError("SP_O3_HISTORY_REENTRY_FORBIDDEN");
  }
  if (baseline.writer_authority !== "SOLE_W4_ENTERPRISE_STATE_SERVICE") {
    throw new StrategicPortfolioDivergenceAnalysisError("SP_O3_BASELINE_AUTHORITY_CONFLICT");
  }
  requiredId(baseline.portfolio_id, "portfolio_id");
  requiredId(baseline.portfolio_ref.portfolio_digest, "portfolio_digest");
  requiredId(baseline.exact_scope.tenant_id, "tenant_id");
  requiredId(baseline.exact_scope.course_id, "course_id");
  requiredId(baseline.exact_scope.run_id, "run_id");
  requiredId(baseline.exact_scope.team_id, "team_id");
  if (!Number.isSafeInteger(baseline.exact_scope.round_no) || baseline.exact_scope.round_no < 1) {
    throw new StrategicPortfolioDivergenceAnalysisError("SP_O3_ROUND_REQUIRED");
  }
}

function assertPaths(
  baseline: W4StrategicPortfolioProjection,
  paths: M4TeacherPathProjection[]
): void {
  if (!Array.isArray(paths) || paths.length < 2 || paths.length > 3) {
    throw new StrategicPortfolioDivergenceAnalysisError("SP_O3_PATH_COUNT_INVALID");
  }
  const ids = new Set<string>();
  for (const path of paths) {
    requiredId(path.path_id, "path_id");
    requiredId(path.path_digest, "path_digest");
    if (ids.has(path.path_id)) {
      throw new StrategicPortfolioDivergenceAnalysisError("SP_O3_DUPLICATE_PATH");
    }
    ids.add(path.path_id);
    if (path.officiality !== "NON_OFFICIAL") {
      throw new StrategicPortfolioDivergenceAnalysisError("SP_O3_OFFICIAL_PATH_REENTRY");
    }
    if (path.outcome_differential.baseline !== "OFFICIAL_SOURCE_CLOSING_STATE") {
      throw new StrategicPortfolioDivergenceAnalysisError("SP_O3_PATH_BASELINE_CONFLICT");
    }
    if (path.outcome_differential.terminal_state_ref.course_id !== baseline.exact_scope.course_id) {
      throw new StrategicPortfolioDivergenceAnalysisError("SP_O3_PATH_SCOPE_CONFLICT");
    }
  }
}

function dimensions(paths: M4TeacherPathProjection[]): StrategicPortfolioDivergenceDimensionEvidence[] {
  const pathIds = paths.map((path) => path.path_id);
  return [
    ["cash", "PROVEN", "M4 exposes deterministic cash delta from the official closing state."],
    ["capacity", "PROVEN", "M4 exposes deterministic capacity delta from the official closing state."],
    ["project_count", "PROVEN", "M4 exposes deterministic project-count delta from the official closing state."],
    ["changed_paths", "PROVEN", "M4 exposes the changed-path mechanism identifiers."],
    ["path_members", "NOT_PROVEN", "No path-specific member set is authoritative in the M4 projection."],
    ["path_allocations", "NOT_PROVEN", "No path-specific allocation or unfunded proof is authoritative in the M4 projection."],
    ["dependency_impact", "NOT_PROVEN", "Dependency impact is not a proved causal or portfolio-level fact."],
    ["path_model_readiness", "NOT_PROVEN", "Path-specific model readiness is outside the existing M4 evidence."],
  ].map(([dimension, status, reason]) => ({
    dimension: dimension as StrategicPortfolioDivergenceDimension,
    status: status as StrategicPortfolioDivergenceProvability,
    evidence_path_ids: pathIds,
    reason
  }));
}

export function createStrategicPortfolioDivergenceAnalysis(
  input: StrategicPortfolioDivergenceAnalysisInput
): StrategicPortfolioDivergenceEnvelope {
  assertExactBaseline(input.baseline);
  requiredId(input.divergence_policy_digest, "divergence_policy_digest");
  if (
    input.expected_portfolio_state_digest &&
    input.expected_portfolio_state_digest !== input.baseline.portfolio_ref.portfolio_digest
  ) {
    throw new StrategicPortfolioDivergenceAnalysisError("SP_O3_REBASE_REQUIRED");
  }
  assertPaths(input.baseline, input.paths);
  const exactPortfolio = {
    portfolio_id: input.baseline.portfolio_id,
    portfolio_digest: input.baseline.portfolio_ref.portfolio_digest,
    tenant_id: input.baseline.exact_scope.tenant_id,
    course_id: input.baseline.exact_scope.course_id,
    run_id: input.baseline.exact_scope.run_id,
    team_id: input.baseline.exact_scope.team_id,
    round_no: input.baseline.exact_scope.round_no
  };
  const officialBaseline = {
    officiality: "OFFICIAL" as const,
    portfolio_digest: exactPortfolio.portfolio_digest,
    member_count: input.baseline.members.length,
    allocated_capital_principal: input.baseline.constraints.allocated_capital_principal,
    total_project_cost: input.baseline.constraints.total_project_cost,
    known_limits: [...input.baseline.known_limits]
  };
  const nonOfficialPaths = input.paths.map((path) => ({
    path_id: path.path_id,
    label: path.label,
    officiality: "NON_OFFICIAL" as const,
    path_digest: path.path_digest,
    changed_paths: [...path.mechanism_differential.changed_paths],
    outcome_differential: {
      cash_delta: path.outcome_differential.cash_delta,
      capacity_delta: path.outcome_differential.capacity_delta,
      project_count_delta: path.outcome_differential.project_count_delta
    }
  }));
  const envelopeCore = {
    exactPortfolio,
    officialBaseline,
    nonOfficialPaths,
    policyDigest: input.divergence_policy_digest
  };
  const envelopeDigest = digest(envelopeCore);
  return {
    envelope_id: `sp_o3_divergence_${envelopeDigest.slice(0, 16)}`,
    envelope_digest: envelopeDigest,
    exact_portfolio: exactPortfolio,
    official_baseline: officialBaseline,
    non_official_paths: nonOfficialPaths,
    dimension_evidence: dimensions(input.paths),
    policy: {
      divergence_policy_digest: input.divergence_policy_digest,
      no_winner_selection: true,
      no_score_or_rank: true,
      no_official_write: true,
      no_apply_to_baseline: true
    },
    known_limits: [
      "All alternative paths are NON_OFFICIAL observed differentials.",
      "No baseline-to-path outcome causality or winner selection is inferred.",
      "Only cash, capacity, project_count and changed_paths are proven by the current seam."
    ]
  };
}
