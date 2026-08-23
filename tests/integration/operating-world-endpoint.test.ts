import { once } from "node:events";
import { request as nodeRequest } from "node:http";
import { describe, expect, it } from "vitest";
import type { ApiEnvelope, AuthSession, Round, Run } from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { defaultFamilies } from "../../services/api/src/operating-world-service";
import { DEFAULT_TENANT_ID, OTHER_TENANT_ID, createP1Store } from "../../services/api/src/store";

interface JsonOptions {
  body?: unknown;
  headers?: Record<string, string>;
  method?: string;
}

async function requestJson<T>(
  url: string,
  options: JsonOptions = {}
): Promise<{ body: T; status: number }> {
  return new Promise((resolve, reject) => {
    const request = nodeRequest(
      url,
      { headers: options.headers, method: options.method ?? "GET" },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          try {
            resolve({
              body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as T,
              status: response.statusCode ?? 0
            });
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.on("error", reject);
    if (options.body !== undefined) request.write(JSON.stringify(options.body));
    request.end();
  });
}

async function login(
  baseUrl: string,
  username: string,
  password: string,
  tenantId = DEFAULT_TENANT_ID
) {
  const response = await requestJson<ApiEnvelope<AuthSession>>(`${baseUrl}/api/v1/auth/login`, {
    body: { password, username },
    headers: { "content-type": "application/json", "x-tenant-id": tenantId },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return response.body.data;
}

async function startServer() {
  const store = createP1Store();
  const run: Run = {
    course_id: "course_demo",
    parameter_set_id: "param_toy_approved_1",
    run_id: "run_operating_world_demo",
    scenario_package_id: "scenario_eldercare_demo",
    seed: 20260823,
    status: "active",
    tenant_id: DEFAULT_TENANT_ID
  };
  const round: Round = {
    round_id: "round_operating_world_demo_1",
    round_no: 1,
    run_id: run.run_id,
    status: "open",
    tenant_id: DEFAULT_TENANT_ID
  };
  store.runs.push(run);
  store.rounds.push(round);
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function api<T>(
  baseUrl: string,
  path: string,
  token: string,
  method = "GET",
  body?: unknown,
  tenantId = DEFAULT_TENANT_ID
) {
  return requestJson<T>(`${baseUrl}${path}`, {
    body,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-tenant-id": tenantId
    },
    method
  });
}

describe("SH-M3 Operating World real BFF", () => {
  it("runs Teacher validate/preview/freeze/bind, Student brief, Admin audit, W4 consumer projection and recovery guards", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const teacher = await login(baseUrl, "teacher", "teacher");
      const student = await login(baseUrl, "student", "student");
      const admin = await login(baseUrl, "admin", "admin");
      const createdRun = await api<ApiEnvelope<{ run: { run_id: string } }>>(
        baseUrl,
        "/api/v1/courses/course_demo/runs",
        teacher.access_token,
        "POST",
        {}
      );
      expect(createdRun.status).toBe(201);
      const activeRunId = createdRun.body.data.run.run_id;
      const startedRound = await api<ApiEnvelope<{ round_id: string }>>(
        baseUrl,
        `/api/v1/runs/${activeRunId}/rounds/1/start`,
        teacher.access_token,
        "POST",
        {}
      );
      expect(startedRound.status).toBe(200);
      const activeRoundId = startedRound.body.data.round_id;
      const missingFamilies = await api<Record<string, unknown>>(
        baseUrl,
        "/api/v1/bff/teacher/operating-world/drafts",
        teacher.access_token,
        "POST",
        { course_id: "course_demo", title: "invalid" }
      );
      expect(missingFamilies.status).toBe(422);
      const created = await api<ApiEnvelope<{ draft: { draft_id: string; status: string } }>>(
        baseUrl,
        "/api/v1/bff/teacher/operating-world/drafts",
        teacher.access_token,
        "POST",
        {
          course_id: "course_demo",
          families: defaultFamilies(),
          title: "上海 Operating World"
        }
      );
      expect(created.status).toBe(201);
      const draftId = created.body.data.draft.draft_id;
      expect(store.operatingWorldDrafts?.some((draft) => draft.draft_id === draftId)).toBe(true);

      const validated = await api<ApiEnvelope<{ draft: { status: string } }>>(
        baseUrl,
        `/api/v1/bff/teacher/operating-world/drafts/${draftId}/validate?courseId=course_demo`,
        teacher.access_token,
        "POST"
      );
      expect(validated.status).toBe(200);
      expect(validated.body.data.draft.status).toBe("VALIDATED");

      const preview = await api<
        ApiEnvelope<{ receipt: { no_official_write: boolean; effect_class: string } }>
      >(
        baseUrl,
        `/api/v1/bff/teacher/operating-world/drafts/${draftId}/preview?courseId=course_demo`,
        teacher.access_token,
        "POST",
        { variant: "BASE" }
      );
      expect(preview.status).toBe(200);
      expect(preview.body.data.receipt.no_official_write).toBe(true);
      expect(preview.body.data.receipt.effect_class).toBe("OFFICIAL_CONSUMER_ELIGIBLE");

      const frozen = await api<ApiEnvelope<{ draft: { status: string } }>>(
        baseUrl,
        `/api/v1/bff/teacher/operating-world/drafts/${draftId}/freeze?courseId=course_demo`,
        teacher.access_token,
        "POST"
      );
      expect(frozen.status).toBe(200);
      expect(frozen.body.data.draft.status).toBe("FROZEN");

      const bound = await api<
        ApiEnvelope<{ draft: { status: string; binding: { binding_digest: string } } }>
      >(
        baseUrl,
        `/api/v1/bff/teacher/operating-world/drafts/${draftId}/bind?courseId=course_demo`,
        teacher.access_token,
        "POST",
        { run_id: activeRunId, round_no: 1, seed: 20260823 }
      );
      expect(bound.status).toBe(200);
      expect(bound.body.data.draft.status).toBe("BOUND");
      expect(bound.body.data.draft.binding.binding_digest).toMatch(/^[a-f0-9]{64}$/);

      const officialConsumer = await api<
        ApiEnvelope<{ effect_class: string; consumer_ref: string }>
      >(
        baseUrl,
        `/api/v1/bff/teacher/operating-world/drafts/${draftId}/official-consumer?courseId=course_demo&runId=${activeRunId}&roundNo=1`,
        teacher.access_token
      );
      expect(officialConsumer.status).toBe(200);
      expect(officialConsumer.body.data.effect_class).toBe("OFFICIAL_CONSUMER_ELIGIBLE");
      expect(officialConsumer.body.data.consumer_ref).toContain("W4");

      const w4Initial = await api<Record<string, unknown>>(
        baseUrl,
        `/api/v1/w4/runs/${activeRunId}/rounds/1/states`,
        teacher.access_token,
        "POST",
        {
          course_id: "course_demo",
          team_id: "team_alpha",
          round_id: activeRoundId,
          state: { cash: 1000, capacity: 100 }
        }
      );
      expect(w4Initial.status).toBe(201);
      const w4Decision = await api<
        ApiEnvelope<{ capital_action: { rate_or_cost_bps: number; lead_time_rounds: number } }>
      >(
        baseUrl,
        `/api/v1/w4/runs/${activeRunId}/rounds/1/strategic-decisions`,
        student.access_token,
        "POST",
        {
          course_id: "course_demo",
          team_id: "team_alpha",
          round_id: activeRoundId,
          operating_world_draft_id: draftId,
          decision: {
            decision_id: "operating-world-w4-capital-action-1",
            tenant_id: DEFAULT_TENANT_ID,
            course_id: "course_demo",
            run_id: activeRunId,
            round_id: activeRoundId,
            round_no: 1,
            team_id: "team_alpha",
            kind: "capital_action",
            version: 1,
            status: "canonical",
            payload: {
              rationale: "Operating World W4 admission",
              lead_time_rounds: 0,
              reversible: false,
              dependencies: [],
              kpi_hypothesis: "controlled expansion",
              capital_action_kind: "debt",
              principal: 250,
              term_rounds: 2,
              rate_or_cost_bps: 100,
              cost_source: "raw-input-must-be-replaced",
              covenant_min_cash: 500,
              fees: 5,
              obligation: "term_debt"
            }
          }
        }
      );
      expect(w4Decision.status, JSON.stringify(w4Decision.body)).toBe(201);
      expect(w4Decision.body.data.capital_action).toMatchObject({
        rate_or_cost_bps: 550,
        effective_round_no: 4
      });

      const studentBrief = await api<ApiEnvelope<Record<string, unknown>>>(
        baseUrl,
        `/api/v1/bff/student/operating-world/brief?courseId=course_demo&draftId=${draftId}&runId=${activeRunId}&roundNo=1`,
        student.access_token
      );
      expect(studentBrief.status).toBe(200);
      const serialized = JSON.stringify(studentBrief.body.data);
      expect(serialized).toContain("ROLE_SAFE_STUDENT");
      expect(serialized).toContain("wage_pressure");
      expect(serialized).not.toContain("source_ref");
      expect(serialized).not.toContain("parameter_set_reference");

      const adminAudit = await api<ApiEnvelope<{ readiness: string; binding: unknown }>>(
        baseUrl,
        `/api/v1/bff/admin/operating-world/audit?courseId=course_demo&draftId=${draftId}`,
        admin.access_token
      );
      expect(adminAudit.status).toBe(200);
      expect(adminAudit.body.data.readiness).toBe("BOUND");
      expect(adminAudit.body.data.binding).toBeTruthy();

      const previewAfterFreeze = await api<Record<string, unknown>>(
        baseUrl,
        `/api/v1/bff/teacher/operating-world/drafts/${draftId}/preview?courseId=course_demo`,
        teacher.access_token,
        "POST",
        { variant: "HIGH" }
      );
      expect(previewAfterFreeze.status).toBe(409);

      const crossTenant = await api<Record<string, unknown>>(
        baseUrl,
        `/api/v1/bff/teacher/operating-world/drafts/${draftId}/validate?courseId=course_demo`,
        teacher.access_token,
        "POST",
        undefined,
        OTHER_TENANT_ID
      );
      expect(crossTenant.status).toBe(403);
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
