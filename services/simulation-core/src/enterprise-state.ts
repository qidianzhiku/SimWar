import type {
  W4CapitalAction,
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
  capital_actions?: W4CapitalAction[];
}

export interface EnterpriseStateSettlementOutput {
  closing: W4EnterpriseStateData;
  applied_commitment_ids: string[];
  persistent_effect_ids: string[];
  applied_capital_action_ids: string[];
  blocked_capital_action_ids: string[];
  covenant_breach_action_ids: string[];
}

function emptyCapitalPosition(): NonNullable<W4EnterpriseStateData["capital"]> {
  return {
    debt_principal: 0,
    equity_proceeds: 0,
    working_capital_available: 0,
    interest_paid: 0,
    fees_paid: 0,
    covenant_min_cash: 0,
    covenant_breach_action_ids: [],
    active_capital_action_ids: []
  };
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
  closing.capital = {
    ...emptyCapitalPosition(),
    ...(input.opening.capital ? structuredClone(input.opening.capital) : {})
  };
  const applicableCommitments = input.commitments.filter(
    (commitment) => commitment.status === "active"
  );
  const appliedCommitmentIds = applicableCommitments
    .filter((commitment) => commitment.created_round_no === input.roundNo)
    .map((commitment) => commitment.commitment_id);
  closing.cash -= applicableCommitments
    .filter((commitment) => commitment.created_round_no === input.roundNo)
    .reduce((sum, commitment) => sum + commitment.cost, 0);
  closing.capital.fees_paid += applicableCommitments
    .filter((commitment) => commitment.created_round_no === input.roundNo)
    .filter((commitment) => commitment.kind === "capital_action")
    .reduce((sum, commitment) => {
      const action = (input.capital_actions ?? []).find(
        (item) => item.decision_id === commitment.decision_id
      );
      return sum + (action && action.status !== "blocked" ? action.fees : 0);
    }, 0);

  const appliedCapitalActionIds: string[] = [];
  const blockedCapitalActionIds: string[] = [];
  const covenantBreachActionIds: string[] = [];
  for (const action of (input.capital_actions ?? [])
    .slice()
    .sort((left, right) => left.capital_action_id.localeCompare(right.capital_action_id))) {
    if (action.status === "blocked" || action.status === "completed") continue;
    if (action.effective_round_no > input.roundNo) continue;
    const isActivationRound = action.effective_round_no === input.roundNo;
    if (isActivationRound && closing.cash < action.covenant_min_cash) {
      blockedCapitalActionIds.push(action.capital_action_id);
      continue;
    }
    if (isActivationRound) {
      closing.cash += action.principal;
      if (action.kind === "initial_public_offering") {
        closing.capital.equity_proceeds += action.principal;
      } else {
        closing.capital.debt_principal += action.principal;
        if (action.kind === "working_capital") {
          closing.capital.working_capital_available += action.principal;
        }
      }
      appliedCapitalActionIds.push(action.capital_action_id);
    }
    if (input.roundNo > action.effective_round_no) {
      const interest = roundMoney((action.principal * action.rate_or_cost_bps) / 10000);
      closing.cash = roundMoney(closing.cash - interest);
      closing.capital.interest_paid = roundMoney(closing.capital.interest_paid + interest);
    }
    closing.capital.covenant_min_cash = Math.max(
      closing.capital.covenant_min_cash,
      action.covenant_min_cash
    );
    if (closing.cash < action.covenant_min_cash) {
      covenantBreachActionIds.push(action.capital_action_id);
    }
    if (input.roundNo >= action.maturity_round_no) {
      if (action.kind !== "initial_public_offering") {
        closing.cash = roundMoney(closing.cash - action.principal);
        closing.capital.debt_principal = Math.max(
          0,
          roundMoney(closing.capital.debt_principal - action.principal)
        );
        if (action.kind === "working_capital") {
          closing.capital.working_capital_available = Math.max(
            0,
            roundMoney(closing.capital.working_capital_available - action.principal)
          );
        }
      }
    } else {
      closing.capital.active_capital_action_ids.push(action.capital_action_id);
    }
  }
  closing.capital.covenant_breach_action_ids = [
    ...new Set([...closing.capital.covenant_breach_action_ids, ...covenantBreachActionIds])
  ];
  closing.capital.active_capital_action_ids = [
    ...new Set(
      (input.capital_actions ?? [])
        .filter(
          (action) =>
            action.status !== "blocked" &&
            action.status !== "completed" &&
            action.effective_round_no <= input.roundNo &&
            action.maturity_round_no > input.roundNo &&
            !blockedCapitalActionIds.includes(action.capital_action_id)
        )
        .map((action) => action.capital_action_id)
    )
  ];

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
      .map((effect) => effect.effect_id),
    applied_capital_action_ids: appliedCapitalActionIds,
    blocked_capital_action_ids: blockedCapitalActionIds,
    covenant_breach_action_ids: covenantBreachActionIds
  };
}
