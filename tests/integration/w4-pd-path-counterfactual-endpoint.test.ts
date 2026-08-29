import { once } from "node:events";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  Run,
  Team,
  W4CanonicalStrategicDecision,
  W4EnterpriseState,
  W4ReplayInputManifest,
  W4ScopeContext
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import {
  createEnterpriseStateStrategicEvolutionService,
  createJsonW4Repository,
  createW4DecisionPayloadDigest
} from "../../services/api/src/w4-enterprise-state";
import { createP1Store } from "../../services/api/src/store";

const tenantId = "tenant_demo";
const runId = "w4-pd-http-run";
const profile = {
  tenant_id: tenantId,
  project_profile_id: "pd-http-profile",
  version: "1.0.0",
  content_digest: "d".repeat(64)
};

function scope(teamId: string, roundNo = 1, roundId = `pd-round-${teamId}-${roundNo}`): W4ScopeContext {
  return {
    actor_id: "usr_teacher",
    tenant_id: tenantId,
    course_id: "course_demo",
    run_id: runId,
    team_id: teamId,
    round_id: roundId,
    round_no: roundNo,
    role_key: "teacher",
    activity_id: "w4-enterprise-state-strategic-evolution"
  };
}

function state(teamId: string): W4EnterpriseState {
  const currentScope = scope(teamId);
  return {
    enterprise_state_id: `pd-state-${teamId}-1`,
    tenant_id: tenantId,
    course_id: "course_demo",
    run_id: runId,
    team_id: teamId,
    round_id: currentScope.round_id,
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
  };
}

function decision(teamId: string, id: string, roundNo: number): W4CanonicalStrategicDecision {
  const currentScope = scope(teamId, roundNo);
  const payload = {
    project_name: `${teamId} project`,
    cost: 100,
    cycle_rounds: 2,
    area: 1000,
    beds: 10,
    bed_mix: { standard: 10 },
    ramp: 0.5,
    lead_time_rounds: 0
  };
  return {
    decision_id: id,
    tenant_id: tenantId,
    course_id: "course_demo",
    run_id: runId,
    round_id: currentScope.round_id,
    round_no: roundNo,
    team_id: teamId,
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

function capitalDecision(
  teamId: string,
  id: string,
  roundNo: number
): W4CanonicalStrategicDecision {
  const currentScope = scope(teamId, roundNo);
  const payload = {
    capital_action_kind: "debt" as const,
    principal: 200,
    term_rounds: 3,
    rate_or_cost_bps: 100,
    cost_source: "scenario",
    covenant_min_cash: 0,
    fees: 0,
    obligation: "term_debt" as const,
    rationale: "fund a future strategic expansion",
    reversible: false,
    dependencies: [],
    kpi_hypothesis: "preserve runway for the next project cycle",
    lead_time_rounds: 0
  };
  return {
    decision_id: id,
    tenant_id: currentScope.tenant_id,
    course_id: currentScope.course_id,
    run_id: currentScope.run_id,
    round_id: currentScope.round_id,
    round_no: currentScope.round_no,
    team_id: currentScope.team_id,
    kind: "capital_action",
    version: 1,
    status: "canonical",
    payload,
    admission: {
      policy: "LEGACY_DIRECT_EXPLICIT",
      authority: "synthetic_run_creation_marker",
      canonical_decision_id: null,
      merge_commit_id: null,
      team_confirmation_id: null,
      decision_payload_digest: createW4DecisionPayloadDigest("capital_action", payload)
    }
  };
}

function manifest(
  openingStateRef: Parameters<
    ReturnType<typeof createEnterpriseStateStrategicEvolutionService>["settleRound"]
  >[1]["opening_state_ref"],
  currentScope: W4ScopeContext,
  decisionIds: string[],
  digests: string[]
): W4ReplayInputManifest {
  return {
    manifest_id: `pd-manifest-${currentScope.team_id}-${currentScope.round_no}`,
    tenant_id: tenantId,
    course_id: "course_demo",
    run_id: runId,
    team_id: currentScope.team_id,
    round_id: currentScope.round_id,
    opening_state_ref: structuredClone(openingStateRef),
    decision_ids: decisionIds,
    decision_payload_bindings: decisionIds.map((id, index) => ({
      decision_id: id,
      decision_payload_digest: digests[index] ?? "0".repeat(64)
    })),
    scenario_package_id: "scenario_pd_http",
    parameter_set_id: "parameters_pd_http",
    engine_id: "toy_logit_wellness_v1",
    plugin_ids: ["plugin_wellness_stub"],
    seed: 53
  };
}

async function login(baseUrl: string, username: "teacher" | "student"): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-tenant-id": tenantId },
    body: JSON.stringify({ username, password: username })
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as ApiEnvelope<AuthSession>).data.access_token;
}

describe("W4 P-D real BFF boundaries", () => {
  it("serves matched arena and non-writing counterfactual evidence with role-safe redaction", async () => {
    const store = createP1Store();
    const run: Run = {
      run_id: runId,
      tenant_id: tenantId,
      course_id: "course_demo",
      scenario_package_id: "scenario_pd_http",
      parameter_set_id: "parameters_pd_http",
      seed: 53,
      status: "active"
    };
    const beta: Team = {
      team_id: "team_beta",
      tenant_id: tenantId,
      course_id: "course_demo",
      name: "Beta",
      captain_user_id: "usr_student",
      members: []
    };
    store.runs.push(run);
    store.teams.push(beta);
    const repository = createJsonW4Repository(store);
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    const alphaScope = scope("team_alpha");
    const betaScope = scope("team_beta");
    const alphaInitial = await service.createInitialState(alphaScope, state("team_alpha"));
    const betaInitial = await service.createInitialState(betaScope, state("team_beta"));
    const alphaDecision = decision("team_alpha", "pd-http-alpha-1", 1);
    const betaDecision = decision("team_beta", "pd-http-beta-1", 1);
    const alphaCompiled = await service.commitStrategicDecision(alphaScope, alphaDecision);
    const betaCompiled = await service.commitStrategicDecision(betaScope, betaDecision);
    await service.addProjectToPortfolio(alphaScope, {
      project_entry_id: "pd-http-entry-alpha",
      initiative_id: alphaCompiled.initiative.initiative_id,
      project_profile_reference: profile,
      source_assignment_id: "pd-http-assignment-alpha",
      project_name: "Matched HTTP Project"
    });
    await service.addProjectToPortfolio(betaScope, {
      project_entry_id: "pd-http-entry-beta",
      initiative_id: betaCompiled.initiative.initiative_id,
      project_profile_reference: profile,
      source_assignment_id: "pd-http-assignment-beta",
      project_name: "Matched HTTP Project"
    });
    const alphaManifest = manifest(
      alphaInitial.state_ref,
      alphaScope,
      [alphaDecision.decision_id],
      [alphaDecision.admission.decision_payload_digest]
    );
    await service.settleRound(alphaScope, {
      opening_state_ref: alphaInitial.state_ref,
      decision_id: alphaDecision.decision_id,
      replay_input_manifest: alphaManifest
    });
    await service.settleRound(betaScope, {
      opening_state_ref: betaInitial.state_ref,
      decision_id: betaDecision.decision_id,
      replay_input_manifest: manifest(
        betaInitial.state_ref,
        betaScope,
        [betaDecision.decision_id],
        [betaDecision.admission.decision_payload_digest]
      )
    });
    const futureScope = scope("team_alpha", 2, "pd-round-team_alpha-2");
    const futureDecision = capitalDecision("team_alpha", "pd-http-alpha-2", 2);
    await service.commitStrategicDecision(futureScope, futureDecision);
    const settledOutcome = store.w4.outcomes.find(
      (outcome) => outcome.official_outcome_id.endsWith("_1") && outcome.team_id === "team_alpha"
    );
    if (!settledOutcome) throw new Error("settled alpha outcome missing");
    const sourceStateRef = settledOutcome.closing_state_ref;
    const beforeCounts = {
      states: store.w4.states.length,
      outcomes: store.w4.outcomes.length,
      replayEvidence: store.w4.replayEvidence.length
    };

    const server = createApiServer(store);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server address unavailable");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    try {
      const teacher = await login(baseUrl, "teacher");
      const student = await login(baseUrl, "student");
      const arenaResponse = await fetch(
        `${baseUrl}/api/v1/bff/teacher/w4/runs/${runId}/matched-arena?course_id=course_demo&project_profile_id=${profile.project_profile_id}&version=${profile.version}&content_digest=${profile.content_digest}`,
        { headers: { authorization: `Bearer ${teacher}`, "x-tenant-id": tenantId } }
      );
      expect(arenaResponse.status).toBe(200);
      const arena = (await arenaResponse.json()) as ApiEnvelope<{
        team_ids: string[];
        state_isolation_proven: true;
        different_history_observed: boolean;
      }>;
      expect(arena.data.team_ids).toEqual(["team_alpha", "team_beta"]);
      expect(arena.data.state_isolation_proven).toBe(true);
      expect(arena.data.different_history_observed).toBe(true);

      const counterfactualBody = {
        source_state_ref: sourceStateRef,
        source_outcome_id: settledOutcome.official_outcome_id,
        decision_ids: [futureDecision.decision_id],
        horizon_rounds: 2,
        scenario_package_id: alphaManifest.scenario_package_id,
        parameter_set_id: alphaManifest.parameter_set_id,
        engine_id: alphaManifest.engine_id,
        plugin_ids: alphaManifest.plugin_ids,
        seed: alphaManifest.seed
      };
      const teacherCounterfactual = await fetch(
        `${baseUrl}/api/v1/bff/teacher/w4/runs/${runId}/counterfactual`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${teacher}`,
            "content-type": "application/json",
            "x-tenant-id": tenantId
          },
          // lgtm [js/file-access-to-http] - this is synthetic fixture data sent only to the in-process 127.0.0.1 BFF.
          body: JSON.stringify(counterfactualBody)
        }
      );
      expect(teacherCounterfactual.status).toBe(200);
      const teacherEvidence = (await teacherCounterfactual.json()) as ApiEnvelope<{
        rounds: Array<{ closing_state: { cash?: number } }>;
        capital_actions: Array<{ capital_action_id: string }>;
        official_state_writes: false;
      }>;
      expect(teacherEvidence.data.rounds).toHaveLength(2);
      expect(teacherEvidence.data.rounds[0]?.closing_state.cash).toBeTypeOf("number");
      expect(teacherEvidence.data.capital_actions).toHaveLength(1);
      expect(teacherEvidence.data.official_state_writes).toBe(false);

      const studentCounterfactual = await fetch(
        `${baseUrl}/api/v1/bff/student/w4/runs/${runId}/counterfactual`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${student}`,
            "content-type": "application/json",
            "x-tenant-id": tenantId
          },
          // lgtm [js/file-access-to-http] - this is synthetic fixture data sent only to the in-process 127.0.0.1 BFF.
          body: JSON.stringify(counterfactualBody)
        }
      );
      expect(studentCounterfactual.status).toBe(200);
      const studentEvidence = (await studentCounterfactual.json()) as ApiEnvelope<{
        surface: string;
        rounds: Array<{ closing_state: { cash?: number } }>;
        capital_actions?: unknown;
      }>;
      expect(studentEvidence.data.surface).toBe("student");
      expect(studentEvidence.data.rounds[0]?.closing_state.cash).toBeUndefined();
      expect(studentEvidence.data).not.toHaveProperty("capital_actions");
      expect(store.w4.states).toHaveLength(beforeCounts.states);
      expect(store.w4.outcomes).toHaveLength(beforeCounts.outcomes);
      expect(store.w4.replayEvidence).toHaveLength(beforeCounts.replayEvidence);
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
