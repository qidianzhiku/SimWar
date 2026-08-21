import { describe, expect, it } from "vitest";
import type {
  ProjectProfileRef,
  W4CanonicalStrategicDecision,
  W4EnterpriseState,
  W4ScopeContext
} from "@simwar/shared-contracts";
import {
  createEnterpriseStateStrategicEvolutionService,
  createInMemoryW4Repository,
  createW4DecisionPayloadDigest
} from "../../services/api/src/w4-enterprise-state";

const scope: W4ScopeContext = {
  actor_id: "teacher-portfolio",
  tenant_id: "tenant-portfolio",
  course_id: "course-portfolio",
  run_id: "run-portfolio",
  team_id: "team-portfolio",
  round_id: "round-portfolio-1",
  round_no: 1,
  role_key: "teacher",
  activity_id: "w4-enterprise-state-strategic-evolution"
};

const profileRef = (id: string): ProjectProfileRef => ({
  content_digest: `${id
    .replace(/[^a-f0-9]/gi, "a")
    .slice(0, 63)
    .padEnd(63, "a")}1`,
  project_profile_id: id,
  tenant_id: scope.tenant_id,
  version: "1.0.0"
});

const initialState = (): W4EnterpriseState => ({
  enterprise_state_id: "state-portfolio-0",
  tenant_id: scope.tenant_id,
  course_id: scope.course_id,
  run_id: scope.run_id,
  team_id: scope.team_id,
  round_id: scope.round_id,
  round_no: 1,
  version: 1,
  parent_state_ref: null,
  state_digest: "",
  state: {
    cash: 1000,
    capacity: 100,
    product_lines: ["core-care"],
    positioning: "trusted-care",
    organization: { team_size: 4 },
    operating_units: [],
    portfolio: { projects: [], facilities: [] }
  }
});

function decision(id: string, projectName: string): W4CanonicalStrategicDecision {
  const payload = {
    project_name: projectName,
    cost: 100,
    cycle_rounds: 2,
    area: 5000,
    beds: 50,
    bed_mix: { standard: 50 },
    ramp: 0.5,
    lead_time_rounds: 0
  };
  return {
    decision_id: id,
    tenant_id: scope.tenant_id,
    course_id: scope.course_id,
    run_id: scope.run_id,
    round_id: scope.round_id,
    round_no: scope.round_no,
    team_id: scope.team_id,
    kind: "new_project",
    version: 1,
    status: "canonical",
    payload,
    admission: {
      policy: "ROLE_WORKFLOW_REQUIRED",
      authority: "formal_run_runtime_binding",
      canonical_decision_id: id,
      merge_commit_id: `merge-${id}`,
      team_confirmation_id: `confirmation-${id}`,
      decision_payload_digest: createW4DecisionPayloadDigest("new_project", payload)
    }
  };
}

describe("W4 governed project portfolio", () => {
  it("supports multiple exact ProjectProfileRefs and only creates an OperatingUnit at Operating", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    const opening = await service.createInitialState(scope, initialState());

    const first = await service.commitStrategicDecision(
      scope,
      decision("decision-portfolio-1", "Project One")
    );
    const second = await service.commitStrategicDecision(
      scope,
      decision("decision-portfolio-2", "Project Two")
    );

    await service.addProjectToPortfolio(scope, {
      project_entry_id: "portfolio-entry-1",
      initiative_id: first.initiative.initiative_id,
      project_profile_reference: profileRef("profile-1"),
      source_assignment_id: "assignment-baseline",
      project_name: "Project One"
    });
    await service.addProjectToPortfolio(scope, {
      project_entry_id: "portfolio-entry-2",
      initiative_id: second.initiative.initiative_id,
      project_profile_reference: profileRef("profile-2"),
      source_assignment_id: "assignment-baseline",
      project_name: "Project Two"
    });

    expect(repository.snapshot().projectPortfolio).toHaveLength(2);
    expect(
      repository.snapshot().projectPortfolio.every((entry) => entry.operating_unit_id === null)
    ).toBe(true);

    for (const target of [
      "Feasibility",
      "DueDiligence",
      "Negotiation",
      "TermSheet",
      "Operating"
    ] as const) {
      await service.advanceProjectLifecycle(scope, first.initiative.initiative_id, target);
    }
    const firstEntry = repository
      .snapshot()
      .projectPortfolio.find((entry) => entry.project_entry_id === "portfolio-entry-1");
    expect(firstEntry?.lifecycle_status).toBe("Operating");
    expect(firstEntry?.operating_unit_id).toBe("operating-unit-portfolio-entry-1");

    const firstDecision = repository
      .snapshot()
      .decisions.find((item) => item.decision_id === "decision-portfolio-1");
    if (!firstDecision) throw new Error("first decision missing");
    const roundOne = await service.settleRound(scope, {
      opening_state_ref: opening.state_ref,
      decision_id: firstDecision.decision_id,
      replay_input_manifest: {
        manifest_id: "manifest-portfolio-1",
        tenant_id: scope.tenant_id,
        course_id: scope.course_id,
        run_id: scope.run_id,
        team_id: scope.team_id,
        round_id: scope.round_id,
        opening_state_ref: opening.state_ref,
        decision_ids: repository.snapshot().decisions.map((item) => item.decision_id),
        decision_payload_bindings: repository.snapshot().decisions.map((item) => ({
          decision_id: item.decision_id,
          decision_payload_digest: item.admission.decision_payload_digest
        })),
        scenario_package_id: "scenario-portfolio",
        parameter_set_id: "parameters-portfolio",
        engine_id: "engine-portfolio",
        plugin_ids: [],
        seed: 1
      }
    });
    const closing = repository
      .snapshot()
      .states.find(
        (state) => state.enterprise_state_id === roundOne.closing_state_ref.enterprise_state_id
      );
    expect(closing?.state.portfolio.projects).toContain("Project One");
    expect(closing?.state.operating_units.map((unit) => unit.operating_unit_id)).toContain(
      "operating-unit-portfolio-entry-1"
    );

    const nextOpening = await service.createNextRoundOpening({
      ...scope,
      round_id: "round-portfolio-2",
      round_no: 2,
      opening_state_ref: roundOne.closing_state_ref
    });
    const roundTwo = await service.settleRound(
      { ...scope, round_id: "round-portfolio-2", round_no: 2 },
      {
        opening_state_ref: nextOpening.state_ref,
        decision_id: null,
        replay_input_manifest: {
          manifest_id: "manifest-portfolio-2",
          tenant_id: scope.tenant_id,
          course_id: scope.course_id,
          run_id: scope.run_id,
          team_id: scope.team_id,
          round_id: "round-portfolio-2",
          opening_state_ref: nextOpening.state_ref,
          decision_ids: [],
          decision_payload_bindings: [],
          scenario_package_id: "scenario-portfolio",
          parameter_set_id: "parameters-portfolio",
          engine_id: "engine-portfolio",
          plugin_ids: [],
          seed: 1
        }
      }
    );
    const carried = repository
      .snapshot()
      .states.find(
        (state) => state.enterprise_state_id === roundTwo.closing_state_ref.enterprise_state_id
      );
    expect(carried?.parent_state_ref?.enterprise_state_id).toBe(
      roundOne.closing_state_ref.enterprise_state_id
    );
    expect(carried?.state.portfolio.projects).toContain("Project One");
  });

  it("requires the governed M&A phases and dual confirmation before creating an ownership successor", async () => {
    const repository = createInMemoryW4Repository();
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    await service.createInitialState(scope, initialState());
    const compiled = await service.commitStrategicDecision(
      scope,
      decision("decision-mna", "Target Project")
    );
    await service.addProjectToPortfolio(scope, {
      project_entry_id: "portfolio-target",
      initiative_id: compiled.initiative.initiative_id,
      project_profile_reference: profileRef("profile-target"),
      source_assignment_id: "assignment-baseline",
      project_name: "Target Project"
    });

    const transaction = await service.createProjectTransaction(scope, {
      transaction_id: "transaction-mna-1",
      kind: "merger_acquisition",
      initiative_id: compiled.initiative.initiative_id,
      project_entry_id: "portfolio-target",
      target_project_profile_reference: profileRef("profile-successor"),
      target_project_name: "Acquired Project"
    });
    expect(transaction.phase).toBe("Listing");

    for (const target of ["Bid", "DueDiligence", "Negotiation", "TermSheet"] as const) {
      await service.advanceProjectTransaction(scope, transaction.transaction_id, target);
    }
    await expect(
      service.advanceProjectTransaction(scope, transaction.transaction_id, "Closing")
    ).rejects.toMatchObject({ code: "W4_M_AND_A_DUAL_CONFIRMATION_REQUIRED" });
    await service.advanceProjectTransaction(scope, transaction.transaction_id, "Closing", {
      buyer_confirmation_id: "buyer-confirmation-1",
      seller_confirmation_id: "seller-confirmation-1"
    });
    await service.advanceProjectTransaction(scope, transaction.transaction_id, "Closed", {
      buyer_confirmation_id: "buyer-confirmation-1",
      seller_confirmation_id: "seller-confirmation-1"
    });

    const snapshot = repository.snapshot();
    const source = snapshot.projectPortfolio.find(
      (entry) => entry.project_entry_id === "portfolio-target"
    );
    const successor = snapshot.projectPortfolio.find(
      (entry) => entry.successor_of_entry_id === "portfolio-target"
    );
    expect(snapshot.projectTransactions[0]?.phase).toBe("Closed");
    expect(source?.ownership_status).toBe("sold");
    expect(successor?.ownership_status).toBe("owned");
    expect(successor?.project_profile_reference.project_profile_id).toBe("profile-successor");
  });
});
