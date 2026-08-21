import { once } from "node:events";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  Round,
  Run,
  Team,
  W4CanonicalStrategicDecision,
  W4EnterpriseState,
  W4ReplayInputManifest,
  W4ScopeContext,
  W4StateRef
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import {
  createEnterpriseStateStrategicEvolutionService,
  createJsonW4Repository,
  createW4DecisionPayloadDigest
} from "../../services/api/src/w4-enterprise-state";
import { createP1Store } from "../../services/api/src/store";

const tenantId = "tenant_demo";
const runId = "w4-pe-g4-http-run";
const profile = {
  tenant_id: tenantId,
  project_profile_id: "pe-g4-profile",
  version: "1.0.0",
  content_digest: "e".repeat(64)
};

function scope(
  teamId: string,
  roundNo: number,
  roundId = "pe-g4-round-" + runId + "-" + roundNo
): W4ScopeContext {
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

function initialState(teamId: string): W4EnterpriseState {
  const currentScope = scope(teamId, 1);
  return {
    enterprise_state_id: "pe-g4-state-" + teamId + "-1",
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
      positioning: teamId === "team_alpha" ? "trusted-care" : "value-care",
      organization: { team_size: 4 },
      operating_units: [],
      portfolio: { projects: [], facilities: [] }
    }
  };
}

function decision(
  teamId: string,
  decisionId: string,
  roundNo: number
): W4CanonicalStrategicDecision {
  const currentScope = scope(teamId, roundNo);
  const payload = {
    project_name: teamId + " strategic project " + roundNo,
    cost: teamId === "team_alpha" ? 100 : 180,
    cycle_rounds: 3,
    area: 1000,
    beds: 10,
    bed_mix: { standard: 10 },
    ramp: 0.5,
    lead_time_rounds: roundNo === 1 ? 1 : 0
  };
  return {
    decision_id: decisionId,
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

function manifest(
  openingStateRef: W4StateRef,
  currentScope: W4ScopeContext,
  decisionItem: W4CanonicalStrategicDecision
): W4ReplayInputManifest {
  return {
    manifest_id: "pe-g4-manifest-" + currentScope.team_id + "-" + currentScope.round_no,
    tenant_id: tenantId,
    course_id: "course_demo",
    run_id: runId,
    team_id: currentScope.team_id,
    round_id: currentScope.round_id,
    opening_state_ref: structuredClone(openingStateRef),
    decision_ids: [decisionItem.decision_id],
    decision_payload_bindings: [
      {
        decision_id: decisionItem.decision_id,
        decision_payload_digest: decisionItem.admission.decision_payload_digest
      }
    ],
    scenario_package_id: "scenario_pe_g4",
    parameter_set_id: "parameters_pe_g4",
    engine_id: "toy_logit_wellness_v1",
    plugin_ids: ["plugin_wellness_stub"],
    seed: 79
  };
}

async function login(baseUrl: string, username: "student" | "teacher" | "admin") {
  const response = await fetch(baseUrl + "/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-tenant-id": tenantId },
    body: JSON.stringify({ username, password: username })
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as ApiEnvelope<AuthSession>).data.access_token;
}

describe("W4 P-E G4 integrated real BFF journey", () => {
  it("serves Student, Teacher, matched arena, and Admin after a 3-round path", async () => {
    const store = createP1Store();
    const run: Run = {
      run_id: runId,
      tenant_id: tenantId,
      course_id: "course_demo",
      scenario_package_id: "scenario_pe_g4",
      parameter_set_id: "parameters_pe_g4",
      seed: 79,
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
    const rounds: Round[] = [1, 2, 3].map((roundNo) => ({
      round_id: "pe-g4-round-" + runId + "-" + roundNo,
      tenant_id: tenantId,
      run_id: runId,
      round_no: roundNo,
      status: "published"
    }));
    store.runs.push(run);
    store.teams.push(beta);
    store.rounds.push(...rounds);

    const repository = createJsonW4Repository(store);
    const service = createEnterpriseStateStrategicEvolutionService(repository);
    const closingRefs = new Map<string, W4StateRef>();
    for (const teamId of ["team_alpha", "team_beta"]) {
      let opening = (await service.createInitialState(scope(teamId, 1), initialState(teamId)))
        .state_ref;
      const firstDecision = decision(teamId, "pe-g4-" + teamId + "-1", 1);
      const firstCompiled = await service.commitStrategicDecision(scope(teamId, 1), firstDecision);
      await service.addProjectToPortfolio(scope(teamId, 1), {
        project_entry_id: "pe-g4-entry-" + teamId,
        initiative_id: firstCompiled.initiative.initiative_id,
        project_profile_reference: profile,
        source_assignment_id: "pe-g4-assignment-" + teamId,
        project_name: "Matched G4 Project"
      });
      let outcome = await service.settleRound(scope(teamId, 1), {
        opening_state_ref: opening,
        decision_id: firstDecision.decision_id,
        replay_input_manifest: manifest(opening, scope(teamId, 1), firstDecision)
      });
      opening = outcome.closing_state_ref;
      for (const roundNo of [2, 3]) {
        const currentScope = scope(teamId, roundNo);
        const currentDecision = decision(teamId, "pe-g4-" + teamId + "-" + roundNo, roundNo);
        await service.commitStrategicDecision(currentScope, currentDecision);
        outcome = await service.settleRound(currentScope, {
          opening_state_ref: opening,
          decision_id: currentDecision.decision_id,
          replay_input_manifest: manifest(opening, currentScope, currentDecision)
        });
        opening = outcome.closing_state_ref;
      }
      closingRefs.set(teamId, opening);
    }

    const server = createApiServer(store);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server address unavailable");
    const baseUrl = "http://127.0.0.1:" + address.port;
    try {
      const student = await login(baseUrl, "student");
      const teacher = await login(baseUrl, "teacher");
      const admin = await login(baseUrl, "admin");
      const headers = (token: string) => ({
        authorization: "Bearer " + token,
        "x-tenant-id": tenantId
      });
      const studentProjection = await fetch(
        baseUrl +
          "/api/v1/bff/student/w4/runs/" +
          runId +
          "/rounds/3/portfolio?course_id=course_demo&team_id=team_alpha&round_id=pe-g4-round-" +
          runId +
          "-3",
        { headers: headers(student) }
      );
      expect(studentProjection.status).toBe(200);
      const studentBody = (await studentProjection.json()) as ApiEnvelope<{
        state: { cash?: number; capacity: number };
        initiatives: unknown[];
      }>;
      expect(studentBody.data.state.cash).toBeUndefined();
      expect(studentBody.data.state.capacity).toBeTypeOf("number");
      expect(studentBody.data.initiatives.length).toBeGreaterThan(0);

      const teacherProjection = await fetch(
        baseUrl +
          "/api/v1/bff/teacher/w4/runs/" +
          runId +
          "/rounds/3/portfolio?course_id=course_demo&team_id=team_alpha&round_id=pe-g4-round-" +
          runId +
          "-3",
        { headers: headers(teacher) }
      );
      expect(teacherProjection.status).toBe(200);
      const teacherBody = (await teacherProjection.json()) as ApiEnvelope<{
        closing_state_ref: W4StateRef;
        path_evidence: { official_replay_path: { replay_writes_formal_results: false } };
      }>;
      expect(teacherBody.data.closing_state_ref.enterprise_state_id).toContain("3");
      expect(teacherBody.data.path_evidence.official_replay_path.replay_writes_formal_results).toBe(
        false
      );

      const arena = await fetch(
        baseUrl +
          "/api/v1/bff/teacher/w4/runs/" +
          runId +
          "/matched-arena?course_id=course_demo&project_profile_id=" +
          profile.project_profile_id +
          "&version=" +
          profile.version +
          "&content_digest=" +
          profile.content_digest,
        { headers: headers(teacher) }
      );
      expect(arena.status).toBe(200);
      const arenaBody = (await arena.json()) as ApiEnvelope<{
        team_ids: string[];
        teams: Array<{ closing_state_ref: W4StateRef | null; path_evidence: unknown }>;
        different_history_observed: boolean;
        state_isolation_proven: true;
      }>;
      expect(arenaBody.data.team_ids).toEqual(["team_alpha", "team_beta"]);
      expect(arenaBody.data.teams.every((team) => team.closing_state_ref !== null)).toBe(true);
      expect(arenaBody.data.teams.every((team) => team.path_evidence === null)).toBe(true);
      expect(arenaBody.data.different_history_observed).toBe(true);
      expect(arenaBody.data.state_isolation_proven).toBe(true);

      const adminPortfolio = await fetch(baseUrl + "/api/v1/bff/admin/w4/portfolio", {
        headers: headers(admin)
      });
      expect(adminPortfolio.status).toBe(200);
      const adminBody = (await adminPortfolio.json()) as ApiEnvelope<{
        writer_authority: string;
        portfolios: Array<{ enterprise_state_count: number; team_paths: unknown[] }>;
      }>;
      expect(adminBody.data.writer_authority).toBe("SOLE_W4_ENTERPRISE_STATE_SERVICE");
      expect(adminBody.data.portfolios[0]?.enterprise_state_count).toBe(8);
      expect(adminBody.data.portfolios[0]?.team_paths.length).toBe(2);
      expect(closingRefs.size).toBe(2);
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
