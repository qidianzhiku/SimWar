import { createHash } from "node:crypto";
import { createToyLogitEngine, resolveSettlementPlugins } from "@simwar/simulation-core";
import type {
  Decision,
  ParameterSet,
  Round,
  Run,
  ScenarioPackage,
  SettlementResult,
  Team
} from "@simwar/shared-contracts";

function buildReplayHash(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export type SettlementRoundInput = {
  run: Run;
  round: Round;
  scenario: ScenarioPackage;
  parameterSet: ParameterSet;
  teams: Team[];
  decisions: Decision[];
};

export interface PreparedSettlementOutcome {
  settlement: SettlementResult;
  shouldCommit: boolean;
  replayHashConflict: boolean;
}

export interface SettlementReplayPreview {
  replay_hash: string;
  result_digest: string;
  team_results: SettlementResult["team_results"];
}

export interface PrepareSettlementOutcomeOptions {
  createSettlementResultId: () => string;
  existingSettlement?: SettlementResult | null;
}

function createSettlementResult(
  input: SettlementRoundInput,
  settlementResultId: string,
  replayHash: string,
  teamResults: SettlementResult["team_results"]
): SettlementResult {
  return {
    settlement_result_id: settlementResultId,
    tenant_id: input.run.tenant_id,
    run_id: input.run.run_id,
    round_id: input.round.round_id,
    round_no: input.round.round_no,
    parameter_set_id: input.parameterSet.parameter_set_id,
    scenario_package_id: input.scenario.scenario_package_id,
    replay_hash: replayHash,
    team_results: teamResults
  };
}

function calculateSettlement(input: SettlementRoundInput): {
  replayHash: string;
  teamResults: SettlementResult["team_results"];
} {
  const selectedDecisions = input.teams.map((team) => {
    const decision = input.decisions.find((candidate) => candidate.team_id === team.team_id);

    if (!decision) {
      throw new Error(`missing_decision:${team.team_id}`);
    }

    return decision;
  });

  const engine = createToyLogitEngine(
    resolveSettlementPlugins(input.scenario.plugin_package_ids ?? [])
  );
  const teamResults = engine.settle({
    run: input.run,
    round: input.round,
    scenario: input.scenario,
    parameterSet: input.parameterSet,
    teams: input.teams,
    decisions: selectedDecisions
  }).team_results;

  const replayHash = buildReplayHash({
    parameter_set_id: input.parameterSet.parameter_set_id,
    scenario_package_id: input.scenario.scenario_package_id,
    run_id: input.run.run_id,
    round_no: input.round.round_no,
    seed: input.run.seed,
    decisions: input.decisions.map((decision) => ({
      team_id: decision.team_id,
      version: decision.version,
      payload: decision.payload
    })),
    team_results: teamResults.map((result) => result.state_true)
  });

  return { replayHash, teamResults };
}

export function previewSettlementReplay(input: SettlementRoundInput): SettlementReplayPreview {
  const { replayHash, teamResults } = calculateSettlement(input);

  return {
    replay_hash: replayHash,
    result_digest: buildReplayHash({
      replay_hash: replayHash,
      team_results: teamResults
    }),
    team_results: teamResults
  };
}

export function validateDecisionPayload(
  payload: unknown
): Array<{ field: string; reason: string }> {
  const errors: Array<{ field: string; reason: string }> = [];
  const candidate = payload as Partial<Decision["payload"]> | undefined;

  if (!candidate || typeof candidate !== "object") {
    return [{ field: "decision_payload", reason: "required_object" }];
  }

  const basePrice = candidate.pricing?.base_price;
  if (typeof basePrice !== "number" || basePrice < 6000 || basePrice > 30000) {
    errors.push({ field: "pricing.base_price", reason: "must_be_between_6000_and_30000" });
  }

  if (
    typeof candidate.marketing_budget !== "number" ||
    candidate.marketing_budget < 0 ||
    candidate.marketing_budget > 1000000
  ) {
    errors.push({ field: "marketing_budget", reason: "must_be_between_0_and_1000000" });
  }

  if (
    typeof candidate.service_quality_budget !== "number" ||
    candidate.service_quality_budget < 0 ||
    candidate.service_quality_budget > 1000000
  ) {
    errors.push({ field: "service_quality_budget", reason: "must_be_between_0_and_1000000" });
  }

  if (
    candidate.capacity_plan !== "contract" &&
    candidate.capacity_plan !== "hold" &&
    candidate.capacity_plan !== "expand"
  ) {
    errors.push({ field: "capacity_plan", reason: "must_be_contract_hold_or_expand" });
  }

  if (
    typeof candidate.cash_buffer_target !== "number" ||
    candidate.cash_buffer_target < 0 ||
    candidate.cash_buffer_target > 0.6
  ) {
    errors.push({ field: "cash_buffer_target", reason: "must_be_between_0_and_0_6" });
  }

  if (
    typeof candidate.strategy_statement !== "string" ||
    candidate.strategy_statement.trim().length < 8
  ) {
    errors.push({ field: "strategy_statement", reason: "must_be_at_least_8_chars" });
  }

  return errors;
}

export function prepareSettlementOutcome(
  input: SettlementRoundInput,
  options: PrepareSettlementOutcomeOptions
): PreparedSettlementOutcome {
  const existing = options.existingSettlement ?? null;

  if (existing) {
    const { replayHash } = calculateSettlement(input);

    return {
      settlement: existing,
      shouldCommit: false,
      replayHashConflict: replayHash !== existing.replay_hash
    };
  }

  const { replayHash, teamResults } = calculateSettlement(input);

  return {
    settlement: createSettlementResult(
      input,
      options.createSettlementResultId(),
      replayHash,
      teamResults
    ),
    shouldCommit: true,
    replayHashConflict: false
  };
}
