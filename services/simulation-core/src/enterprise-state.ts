import type {
  W4EnterpriseStateData,
  W4Commitment,
  W4ProjectPortfolioEntry,
  W4StrategicEffect,
  W4StrategicInitiative
} from "@simwar/shared-contracts";

export interface EnterpriseStateSettlementInput {
  opening: W4EnterpriseStateData;
  roundNo: number;
  commitments: W4Commitment[];
  effects: W4StrategicEffect[];
  initiatives: W4StrategicInitiative[];
  project_portfolio?: W4ProjectPortfolioEntry[];
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
  const governedEntries = input.project_portfolio ?? [];
  const governedInitiativeIds = new Set(governedEntries.map((entry) => entry.initiative_id));
  const governedActiveNames = new Set(
    governedEntries
      .filter(
        (entry) => entry.ownership_status === "owned" && entry.lifecycle_status === "Operating"
      )
      .map((entry) => entry.project_name)
  );
  const governedClosedNames = new Set(
    governedEntries
      .filter(
        (entry) => entry.ownership_status !== "owned" || entry.lifecycle_status !== "Operating"
      )
      .map((entry) => entry.project_name)
  );
  for (const entry of governedEntries) {
    if (
      (entry.ownership_status === "owned" && entry.lifecycle_status === "Operating") ||
      !closing.portfolio.projects.includes(entry.project_name)
    ) {
      continue;
    }
    const initiative = input.initiatives.find((item) => item.initiative_id === entry.initiative_id);
    if (initiative?.project?.project_name === entry.project_name) {
      closing.capacity = Math.max(0, closing.capacity - initiative.project.beds);
    }
  }
  const retainedProjects = closing.portfolio.projects.filter(
    (projectName) => !governedClosedNames.has(projectName) || governedActiveNames.has(projectName)
  );
  closing.portfolio.projects = retainedProjects;

  closing.operating_units = closing.operating_units.filter(
    (unit) => !governedEntries.some((entry) => entry.operating_unit_id === unit.operating_unit_id)
  );
  for (const entry of governedEntries) {
    if (entry.ownership_status !== "owned" || entry.lifecycle_status !== "Operating") continue;
    if (!closing.portfolio.projects.includes(entry.project_name)) {
      closing.portfolio.projects.push(entry.project_name);
      const initiative = input.initiatives.find(
        (item) => item.initiative_id === entry.initiative_id
      );
      if (initiative?.project) closing.capacity += initiative.project.beds;
    }
    if (
      entry.operating_unit_id &&
      !closing.operating_units.some((unit) => unit.operating_unit_id === entry.operating_unit_id)
    ) {
      closing.operating_units.push({
        operating_unit_id: entry.operating_unit_id,
        name: entry.project_name,
        status: "active"
      });
    }
  }

  for (const initiative of applicableInitiatives) {
    const project = initiative.project;
    if (governedInitiativeIds.has(initiative.initiative_id)) continue;
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
