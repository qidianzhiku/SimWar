import { createHash } from "node:crypto";

export type StrategicPortfolioTransferStatus = "REFLECTION_ONLY" | "REBASE_REQUIRED" | "BLOCKED";

export interface StrategicPortfolioTransferPath {
  path_id: string;
  path_digest: string;
  officiality: "NON_OFFICIAL";
}

export interface StrategicPortfolioTransferPolicyInput {
  portfolio_state_digest: string;
  expected_portfolio_state_digest: string;
  divergence_policy_digest: string;
  paths: StrategicPortfolioTransferPath[];
  source_epoch_changed?: boolean;
}

export interface StrategicPortfolioTransferPolicyDecision {
  status: StrategicPortfolioTransferStatus;
  transfer_digest: string;
  applies_to_next_round: false;
  official_write: false;
  settlement_write: false;
  score_or_rank_write: false;
  selected_path_id: null;
  known_limits: string[];
}

export class StrategicPortfolioDivergenceTransferPolicyError extends Error {
  constructor(
    readonly code: string,
    message = code
  ) {
    super(message);
    this.name = "StrategicPortfolioDivergenceTransferPolicyError";
  }
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function exact(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    throw new StrategicPortfolioDivergenceTransferPolicyError(
      "SP_O3_TRANSFER_EXACT_ID_REQUIRED",
      field
    );
  }
  return value;
}

export function evaluateStrategicPortfolioDivergenceTransferPolicy(
  input: StrategicPortfolioTransferPolicyInput
): StrategicPortfolioTransferPolicyDecision {
  const portfolioStateDigest = exact(input.portfolio_state_digest, "portfolio_state_digest");
  const expectedDigest = exact(
    input.expected_portfolio_state_digest,
    "expected_portfolio_state_digest"
  );
  const policyDigest = exact(input.divergence_policy_digest, "divergence_policy_digest");
  if (input.source_epoch_changed || portfolioStateDigest !== expectedDigest) {
    return {
      status: "REBASE_REQUIRED",
      transfer_digest: digest({ portfolioStateDigest, expectedDigest, policyDigest }),
      applies_to_next_round: false,
      official_write: false,
      settlement_write: false,
      score_or_rank_write: false,
      selected_path_id: null,
      known_limits: ["The source epoch changed; the comparison must be recomputed before use."]
    };
  }
  if (!Array.isArray(input.paths) || input.paths.length < 2 || input.paths.length > 3) {
    throw new StrategicPortfolioDivergenceTransferPolicyError("SP_O3_TRANSFER_PATH_COUNT_INVALID");
  }
  const ids = new Set<string>();
  for (const path of input.paths) {
    exact(path.path_id, "path_id");
    exact(path.path_digest, "path_digest");
    if (ids.has(path.path_id)) {
      throw new StrategicPortfolioDivergenceTransferPolicyError("SP_O3_TRANSFER_DUPLICATE_PATH");
    }
    if (path.officiality !== "NON_OFFICIAL") {
      throw new StrategicPortfolioDivergenceTransferPolicyError("SP_O3_TRANSFER_OFFICIAL_PATH");
    }
    ids.add(path.path_id);
  }
  const transferDigest = digest({
    portfolio_state_digest: portfolioStateDigest,
    divergence_policy_digest: policyDigest,
    paths: input.paths
  });
  return {
    status: "REFLECTION_ONLY",
    transfer_digest: transferDigest,
    applies_to_next_round: false,
    official_write: false,
    settlement_write: false,
    score_or_rank_write: false,
    selected_path_id: null,
    known_limits: [
      "Transfer is bounded reflection evidence only.",
      "No path is selected as best, winner, score, rank, or official truth.",
      "The comparison cannot update the official baseline or settlement."
    ]
  };
}
