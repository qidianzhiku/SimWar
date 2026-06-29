import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  Decision,
  DecisionPayload,
  PublicResultView,
  Round,
  Run,
  SettlementResult
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import {
  createM1RunReplayEvidence,
  selectM1RunReplayEvidenceGolden
} from "../../services/api/src/run-manifest-replay-evidence";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

const VALID_DECISION_PAYLOAD = {
  pricing: { base_price: 12800 },
  marketing_budget: 180000,
  service_quality_budget: 160000,
  capacity_plan: "expand",
  cash_buffer_target: 0.16,
  strategy_statement: "Hold the premium eldercare segment with reliable delivery."
} as const satisfies DecisionPayload;

type M1ReplayEvidencePublicResult = PublicResultView & {
  replay_evidence?: {
    manifest_id: string;
    manifest_hash: string;
    manifest_version: "run-manifest.v1";
    source_result_id: string;
    replay_status: "matched" | "mismatched";
    replay_result_hash: string;
    replay_writes_formal_results: false;
    frozen_inputs: {
      course_id: string;
      decision_batch_hash: string;
      engine_id: string;
      parameter_set_id: string;
      round_id: string;
      round_no: number;
      run_id: string;
      scenario_package_id: string;
      seed: number;
    };
  };
};

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("test server did not bind to a TCP port");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server,
    store
  };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

async function request<TData>(
  baseUrl: string,
  path: string,
  options: {
    body?: unknown;
    method?: string;
    token?: string;
  } = {}
): Promise<{ body: ApiEnvelope<TData>; status: number }> {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": "tenant_demo"
  });

  if (options.token) {
    headers.set("authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers,
    method: options.method ?? "GET"
  });

  return {
    body: (await response.json()) as ApiEnvelope<TData>,
    status: response.status
  };
}

async function login(baseUrl: string, username: string, password: string): Promise<string> {
  const response = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
    body: { password, username },
    method: "POST"
  });

  expect(response.status).toBe(200);
  return response.body.data.access_token;
}

async function settleAndPublishM1Run(baseUrl: string): Promise<{
  settlement: SettlementResult;
  studentToken: string;
  teacherToken: string;
  run: Run;
}> {
  const teacherToken = await login(baseUrl, "teacher", "teacher");
  const studentToken = await login(baseUrl, "student", "student");

  const runResponse = await request<{ round: Round; run: Run }>(
    baseUrl,
    "/api/v1/courses/course_demo/runs",
    {
      method: "POST",
      token: teacherToken
    }
  );
  expect(runResponse.status).toBe(201);
  const run = runResponse.body.data.run;

  const startResponse = await request<Round>(baseUrl, `/api/v1/runs/${run.run_id}/rounds/1/start`, {
    method: "POST",
    token: teacherToken
  });
  expect(startResponse.status).toBe(200);

  const decisionResponse = await request<Decision>(
    baseUrl,
    `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
    {
      body: {
        decision_payload: VALID_DECISION_PAYLOAD,
        team_id: "team_alpha"
      },
      method: "POST",
      token: studentToken
    }
  );
  expect(decisionResponse.status).toBe(201);

  const lockResponse = await request<Round>(baseUrl, `/api/v1/runs/${run.run_id}/rounds/1/lock`, {
    method: "POST",
    token: teacherToken
  });
  expect(lockResponse.body.data.status).toBe("locked");

  const settlementResponse = await request<SettlementResult>(
    baseUrl,
    `/api/v1/runs/${run.run_id}/rounds/1/settle`,
    {
      method: "POST",
      token: teacherToken
    }
  );
  expect(settlementResponse.status).toBe(200);

  const publishResponse = await request<Round>(
    baseUrl,
    `/api/v1/runs/${run.run_id}/rounds/1/publish`,
    {
      method: "POST",
      token: teacherToken
    }
  );
  expect(publishResponse.body.data.status).toBe("published");

  return {
    settlement: settlementResponse.body.data,
    studentToken,
    teacherToken,
    run
  };
}

function buildReplayEvidenceFromStore(store: SimWarStore, run: Run, settlement: SettlementResult) {
  const round = store.rounds.find(
    (candidate) => candidate.run_id === run.run_id && candidate.round_no === settlement.round_no
  );
  const scenario = store.scenarios.find(
    (candidate) => candidate.scenario_package_id === run.scenario_package_id
  );
  const parameterSet = store.parameterSets.find(
    (candidate) => candidate.parameter_set_id === run.parameter_set_id
  );

  if (!round || !scenario || !parameterSet) {
    throw new Error("missing replay input setup");
  }

  return createM1RunReplayEvidence({
    decisions: store.decisions.filter(
      (decision) => decision.run_id === run.run_id && decision.round_id === round.round_id
    ),
    parameterSet,
    round,
    run,
    scenario,
    settlement,
    teams: store.teams.filter((team) => team.course_id === run.course_id)
  });
}

describe("M1 run manifest and replay evidence", () => {
  it("builds deterministic replay evidence without writing a new formal settlement", async () => {
    const { baseUrl, server, store } = await startServer();

    try {
      const { run, settlement } = await settleAndPublishM1Run(baseUrl);
      const resultSnapshot = structuredClone(store.settlementResults);
      const roundSnapshot = structuredClone(
        store.rounds.find((round) => round.run_id === run.run_id && round.round_no === 1)
      );

      const firstEvidence = buildReplayEvidenceFromStore(store, run, settlement);
      const secondEvidence = buildReplayEvidenceFromStore(store, run, settlement);

      expect(firstEvidence).toEqual(secondEvidence);
      expect(firstEvidence.manifest.schema_version).toBe("run-manifest.v1");
      expect(firstEvidence.manifest.course_id).toBe("course_demo");
      expect(firstEvidence.manifest.run_id).toBe(run.run_id);
      expect(firstEvidence.manifest.round_no).toBe(1);
      expect(firstEvidence.manifest.scenario_package_id).toBe("scenario_eldercare_demo");
      expect(firstEvidence.manifest.parameter_set_id).toBe("param_toy_approved_1");
      expect(firstEvidence.manifest.seed).toBe(20260517);
      expect(firstEvidence.manifest.decision_batch_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(firstEvidence.manifest.json_runtime_source_digest).toMatch(/^[a-f0-9]{64}$/);
      expect(firstEvidence.replay_status).toBe("matched");
      expect(firstEvidence.replay_result_hash).toBe(settlement.replay_hash);
      expect(firstEvidence.replay_writes_formal_results).toBe(false);
      expect(store.settlementResults).toEqual(resultSnapshot);
      expect(
        store.rounds.find((round) => round.run_id === run.run_id && round.round_no === 1)
      ).toEqual(roundSnapshot);
    } finally {
      await stopServer(server);
    }
  });

  it("matches the M1 golden JSON replay evidence fixture", async () => {
    const { baseUrl, server, store } = await startServer();

    try {
      const { run, settlement } = await settleAndPublishM1Run(baseUrl);
      const evidence = buildReplayEvidenceFromStore(store, run, settlement);
      const goldenPath = fileURLToPath(
        new URL(
          "../../contracts/fixtures/m1-run-manifest-replay-evidence.golden.json",
          import.meta.url
        )
      );
      const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as unknown;

      expect(selectM1RunReplayEvidenceGolden(evidence)).toEqual(golden);
    } finally {
      await stopServer(server);
    }
  });

  it("shows replay evidence to teachers while keeping learner results metadata-trimmed", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const { run, studentToken, teacherToken, settlement } = await settleAndPublishM1Run(baseUrl);

      const teacherResult = await request<M1ReplayEvidencePublicResult>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/results`,
        {
          token: teacherToken
        }
      );
      expect(teacherResult.status).toBe(200);
      expect(teacherResult.body.data.replay_evidence).toMatchObject({
        manifest_version: "run-manifest.v1",
        source_result_id: settlement.settlement_result_id,
        replay_result_hash: settlement.replay_hash,
        replay_status: "matched",
        replay_writes_formal_results: false
      });
      expect(teacherResult.body.data.replay_evidence?.frozen_inputs).toMatchObject({
        course_id: "course_demo",
        engine_id: "toy_logit_wellness_v1",
        parameter_set_id: "param_toy_approved_1",
        round_no: 1,
        run_id: run.run_id,
        scenario_package_id: "scenario_eldercare_demo",
        seed: 20260517
      });
      expect(teacherResult.body.data.results[0]?.state_true?.settlement_status).toBe("settled");

      const studentResult = await request<M1ReplayEvidencePublicResult>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/results`,
        {
          token: studentToken
        }
      );
      expect(studentResult.status).toBe(200);
      expect(studentResult.body.data.replay_evidence).toBeUndefined();
      expect(studentResult.body.data.results).toHaveLength(1);
      expect(studentResult.body.data.results[0]?.state_true).toBeUndefined();
      expect(JSON.stringify(studentResult.body.data)).not.toContain("decision_batch_hash");
      expect(JSON.stringify(studentResult.body.data)).not.toContain("json_runtime_source_digest");
      expect(JSON.stringify(studentResult.body.data)).not.toContain("state_true");
    } finally {
      await stopServer(server);
    }
  });
});
