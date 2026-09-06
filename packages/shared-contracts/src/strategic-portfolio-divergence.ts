import type { M4MultipathCounterfactualInput } from "./m4-multipath-counterfactual-transfer.js";

export const STRATEGIC_PORTFOLIO_DIVERGENCE_SCHEMA_VERSION =
  "main-sp-o3-strategic-portfolio-divergence.v1" as const;

export interface StrategicPortfolioDivergenceExactBinding {
  tenant_id: string;
  course_id: string;
  run_id: string;
  team_id: string;
  round_id: string;
  round_no: number;
}

export interface StrategicPortfolioDivergenceRequest {
  discriminator: "strategic_portfolio_divergence_request";
  exact_binding: StrategicPortfolioDivergenceExactBinding;
  counterfactual: M4MultipathCounterfactualInput;
  expected_portfolio_state_digest: string;
  divergence_policy_digest: string;
  idempotency_key: string;
}

const ID = /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/u;
const BANNED = /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/iu;

function exactId(value: unknown): value is string {
  return (
    typeof value === "string" && value.trim() === value && ID.test(value) && !BANNED.test(value)
  );
}

function isCounterfactualPath(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const path = value as Record<string, unknown>;
  return (
    exactId(path.path_id) &&
    typeof path.label === "string" &&
    path.label.trim() === path.label &&
    path.label.length > 0 &&
    Array.isArray(path.decision_ids) &&
    path.decision_ids.length > 0 &&
    path.decision_ids.every(exactId)
  );
}

export function isStrategicPortfolioDivergenceRequest(
  value: unknown
): value is StrategicPortfolioDivergenceRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const request = value as Record<string, unknown>;
  const binding = request.exact_binding;
  if (!binding || typeof binding !== "object" || Array.isArray(binding)) return false;
  const exact = binding as Record<string, unknown>;
  const counterfactual = request.counterfactual;
  if (!counterfactual || typeof counterfactual !== "object" || Array.isArray(counterfactual))
    return false;
  const input = counterfactual as Record<string, unknown>;
  return (
    request.discriminator === "strategic_portfolio_divergence_request" &&
    ["tenant_id", "course_id", "run_id", "team_id", "round_id"].every((field) =>
      exactId(exact[field])
    ) &&
    Number.isSafeInteger(exact.round_no) &&
    Number(exact.round_no) >= 1 &&
    exactId(request.expected_portfolio_state_digest) &&
    exactId(request.divergence_policy_digest) &&
    exactId(request.idempotency_key) &&
    ["source_outcome_id", "scenario_package_id", "parameter_set_id", "engine_id"].every((field) =>
      exactId(input[field])
    ) &&
    input.source_state_ref !== null &&
    typeof input.source_state_ref === "object" &&
    Array.isArray(input.paths) &&
    input.paths.length >= 2 &&
    input.paths.length <= 3 &&
    input.paths.every(isCounterfactualPath) &&
    Number.isSafeInteger(input.horizon_rounds) &&
    Number(input.horizon_rounds) >= 1 &&
    Number(input.horizon_rounds) <= 8 &&
    Array.isArray(input.plugin_ids) &&
    input.plugin_ids.every(exactId) &&
    Number.isSafeInteger(input.seed) &&
    Number(input.seed) >= 0
  );
}
