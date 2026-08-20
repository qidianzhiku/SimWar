import type {
  W4EnterpriseStateData,
  W4Commitment,
  W4StrategicEffect,
  W4StrategicInitiative
} from "@simwar/shared-contracts";

export interface EnterpriseStateSettlementInput {
  opening: W4EnterpriseStateData;
  roundNo: number;
  commitments: W4Commitment[];
  effects: W4StrategicEffect[];
  initiatives: W4StrategicInitiative[];
}

export interface EnterpriseStateSettlementOutput {
  closing: W4EnterpriseStateData;
  applied_commitment_ids: string[];
  persistent_effect_ids: string[];
}

/**
 * The only authoritative W4 state transition calculation.
 * It consumes the immutable opening state and persistent effects; historical
 * strategic decisions are intentionally absent from this input.
 */
export function settleEnterpriseState(
  input: EnterpriseStateSettlementInput
): EnterpriseStateSettlementOutput {
  const closing = structuredClone(input.opening);
  const applicableCommitments = input.commitments.filter(
    (commitment) => commitment.status === "active"
  );
  const appliedCommitmentIds = applicableCommitments
    .filter((commitment) => commitment.created_round_no === input.roundNo)
    .map((commitment) => commitment.commitment_id);
  closing.cash -= applicableCommitments
    .filter((commitment) => commitment.created_round_no === input.roundNo)
    .reduce((sum, commitment) => sum + commitment.cost, 0);

  const applicableInitiatives = input.initiatives.filter(
    (initiative) => initiative.activation_round_no <= input.roundNo
  );
  for (const initiative of applicableInitiatives) {
    const project = initiative.project;
    if (!project || closing.portfolio.projects.includes(project.project_name)) continue;
    closing.portfolio.projects.push(project.project_name);
    closing.capacity += project.beds;
  }

  return {
    closing,
    applied_commitment_ids: appliedCommitmentIds,
    persistent_effect_ids: input.effects
      .filter((effect) => effect.status !== "expired")
      .map((effect) => effect.effect_id)
  };
}
