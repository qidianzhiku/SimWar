import type {
  ResolutionAcknowledgement,
  RoleDecisionSection,
  RoleWorkflowEvent,
  TeamResolution,
  W4CanonicalStrategicDecision,
  W4EnterpriseState,
  W4ReplayInputManifest,
  W4ScopeContext
} from "../../packages/shared-contracts/src";
import { createP1Store } from "../../services/api/src/store";
import {
  createEnterpriseStateStrategicEvolutionService,
  createJsonW4Repository,
  createW4DecisionPayloadDigest
} from "../../services/api/src/w4-enterprise-state";

export const M4_BROWSER_RUN_ID = "m4-browser-run";
export const M4_BROWSER_ROUND_1_ID = "m4-browser-round-1";
export const M4_BROWSER_ROUND_2_ID = "m4-browser-round-2";
export const M4_BROWSER_TEAM_ID = "team_alpha";

function scope(roundNo: number, roundId: string): W4ScopeContext {
  return {
    actor_id: "usr_teacher",
    activity_id: "w4-enterprise-state-strategic-evolution",
    course_id: "course_demo",
    role_key: "CEO",
    round_id: roundId,
    round_no: roundNo,
    run_id: M4_BROWSER_RUN_ID,
    team_id: M4_BROWSER_TEAM_ID,
    tenant_id: "tenant_demo"
  };
}

function initialState(): W4EnterpriseState {
  return {
    enterprise_state_id: "m4-browser-state-initial",
    tenant_id: "tenant_demo",
    course_id: "course_demo",
    run_id: M4_BROWSER_RUN_ID,
    team_id: M4_BROWSER_TEAM_ID,
    round_id: M4_BROWSER_ROUND_1_ID,
    round_no: 1,
    version: 1,
    parent_state_ref: null,
    state_digest: "",
    state: {
      cash: 1_000,
      capacity: 100,
      product_lines: ["core-care"],
      positioning: "trusted-care",
      organization: { team_size: 4 },
      operating_units: [],
      portfolio: { projects: [], facilities: [] }
    }
  };
}

function decision(id: string, roundNo: number, cost: number): W4CanonicalStrategicDecision {
  const payload = {
    project_name: `${id} project`,
    cost,
    cycle_rounds: 2,
    area: 1_000,
    beds: 10,
    bed_mix: { standard: 10 },
    ramp: 0.5,
    lead_time_rounds: 0
  };
  return {
    decision_id: id,
    tenant_id: "tenant_demo",
    course_id: "course_demo",
    run_id: M4_BROWSER_RUN_ID,
    round_id: roundNo === 1 ? M4_BROWSER_ROUND_1_ID : M4_BROWSER_ROUND_2_ID,
    round_no: roundNo,
    team_id: M4_BROWSER_TEAM_ID,
    kind: "new_project",
    version: 1,
    status: "canonical",
    payload,
    admission: {
      policy: "LEGACY_DIRECT_EXPLICIT",
      authority: "synthetic_run_creation_marker",
      canonical_decision_id: null,
      merge_commit_id: null,
      team_confirmation_id: null,
      decision_payload_digest: createW4DecisionPayloadDigest("new_project", payload)
    }
  };
}

function manifest(
  openingStateRef: Parameters<
    ReturnType<typeof createEnterpriseStateStrategicEvolutionService>["settleRound"]
  >[1]["opening_state_ref"],
  officialDecision: W4CanonicalStrategicDecision
): W4ReplayInputManifest {
  return {
    manifest_id: "m4-browser-manifest-1",
    tenant_id: "tenant_demo",
    course_id: "course_demo",
    run_id: M4_BROWSER_RUN_ID,
    team_id: M4_BROWSER_TEAM_ID,
    round_id: M4_BROWSER_ROUND_1_ID,
    opening_state_ref: structuredClone(openingStateRef),
    decision_ids: [officialDecision.decision_id],
    decision_payload_bindings: [
      {
        decision_id: officialDecision.decision_id,
        decision_payload_digest: officialDecision.admission.decision_payload_digest
      }
    ],
    scenario_package_id: "scenario_m4_browser",
    parameter_set_id: "parameters_m4_browser",
    engine_id: "toy_logit_wellness_v1",
    plugin_ids: ["plugin_wellness_stub"],
    seed: 79
  };
}

export async function seedM4MultipathCounterfactualTransferFixture(
  storeFile: string
): Promise<void> {
  const store = createP1Store({ persistenceFile: storeFile });
  const repository = createJsonW4Repository(store);
  const w4 = createEnterpriseStateStrategicEvolutionService(repository);
  store.runs.push({
    run_id: M4_BROWSER_RUN_ID,
    tenant_id: "tenant_demo",
    course_id: "course_demo",
    scenario_package_id: "scenario_m4_browser",
    parameter_set_id: "parameters_m4_browser",
    seed: 79,
    status: "active"
  });
  store.rounds.push(
    {
      round_id: M4_BROWSER_ROUND_1_ID,
      round_no: 1,
      run_id: M4_BROWSER_RUN_ID,
      status: "published",
      tenant_id: "tenant_demo"
    },
    {
      round_id: M4_BROWSER_ROUND_2_ID,
      round_no: 2,
      run_id: M4_BROWSER_RUN_ID,
      status: "open",
      tenant_id: "tenant_demo"
    }
  );

  const firstScope = scope(1, M4_BROWSER_ROUND_1_ID);
  const initial = await w4.createInitialState(firstScope, initialState());
  const officialDecision = decision("m4-browser-official", 1, 100);
  await w4.commitStrategicDecision(firstScope, officialDecision);
  const official = await w4.settleRound(firstScope, {
    opening_state_ref: initial.state_ref,
    decision_id: officialDecision.decision_id,
    replay_input_manifest: manifest(initial.state_ref, officialDecision)
  });
  const secondScope = scope(2, M4_BROWSER_ROUND_2_ID);
  await w4.commitStrategicDecision(secondScope, decision("m4-browser-path-a", 2, 125));
  await w4.commitStrategicDecision(secondScope, decision("m4-browser-path-b", 2, 275));

  store.roleDecisionSections.push({
    section_id: "m4-browser-section-ceo",
    assignment_id: "m4-browser-assignment-ceo",
    tenant_id: "tenant_demo",
    course_id: "course_demo",
    run_id: M4_BROWSER_RUN_ID,
    round_id: official.closing_state_ref.round_id,
    team_id: M4_BROWSER_TEAM_ID,
    role_key: "CEO",
    version: 1,
    status: "ready",
    payload: { private_note: "do not send" },
    submitted_by: "usr_student",
    updated_at: "2026-08-28T00:01:00.000Z"
  } as unknown as RoleDecisionSection);
  store.roleWorkflowEvents.push({
    event_id: "m4-browser-event",
    tenant_id: "tenant_demo",
    run_id: M4_BROWSER_RUN_ID,
    round_id: official.closing_state_ref.round_id,
    team_id: M4_BROWSER_TEAM_ID,
    actor_id: "usr_teacher",
    event_type: "resolution_proposed",
    resource_id: "m4-browser-resolution",
    created_at: "2026-08-28T00:02:00.000Z"
  } as unknown as RoleWorkflowEvent);
  store.teamResolutions.push({
    resolution_id: "m4-browser-resolution",
    tenant_id: "tenant_demo",
    run_id: M4_BROWSER_RUN_ID,
    round_id: official.closing_state_ref.round_id,
    team_id: M4_BROWSER_TEAM_ID,
    status: "PROPOSED",
    source_section_ids: ["m4-browser-section-ceo"],
    source_digest: "d".repeat(64),
    selected_values: {},
    proposed_by: "usr_teacher",
    proposed_at: "2026-08-28T00:02:00.000Z"
  } as unknown as TeamResolution);
  store.resolutionAcknowledgements.push({
    acknowledgement_id: "m4-browser-ack",
    resolution_id: "m4-browser-resolution",
    tenant_id: "tenant_demo",
    run_id: M4_BROWSER_RUN_ID,
    round_id: official.closing_state_ref.round_id,
    team_id: M4_BROWSER_TEAM_ID,
    role_key: "CFO",
    status: "DISSENT_PRESERVED",
    dissent_note: "do not send",
    acknowledged_by: "usr_student",
    acknowledged_at: "2026-08-28T00:03:00.000Z"
  } as unknown as ResolutionAcknowledgement);
  store.persist();
}
