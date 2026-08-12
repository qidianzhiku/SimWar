import { once } from "node:events";
import { describe, expect, it } from "vitest";
import type { ApiEnvelope, AuthSession, ValidationSessionRecord } from "@simwar/shared-contracts";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store } from "../../services/api/src/store";

async function boot() {
  const store = createP1Store();
  store.runs.push({
    run_id: "run_w023",
    tenant_id: "tenant_demo",
    course_id: "course_demo",
    scenario_package_id: "scenario_eldercare_demo",
    parameter_set_id: "param_toy_approved_1",
    seed: 1,
    status: "active"
  });
  store.teams.push({
    team_id: "team_w023_beta",
    tenant_id: "tenant_demo",
    course_id: "course_demo",
    name: "W023 Beta synthetic team",
    captain_user_id: "usr_default_cfo",
    members: [{ user_id: "usr_default_cfo", display_name: "P0 CFO", role_slot: "CEO" }]
  });
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not listen");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function request<T>(
  baseUrl: string,
  path: string,
  options: { token?: string; body?: unknown; method?: string } = {}
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      authorization: options.token ? `Bearer ${options.token}` : "",
      "content-type": "application/json",
      "x-tenant-id": "tenant_demo"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  return { status: response.status, body: (await response.json()) as T };
}

describe("W023 ValidationSession HTTP product path", () => {
  it("runs create, roster, preflight, LIVE, observation, close and evidence without formal writes", async () => {
    const { server, baseUrl } = await boot();
    try {
      const login = await request<ApiEnvelope<AuthSession>>(baseUrl, "/api/v1/auth/login", {
        method: "POST",
        body: { username: "teacher", password: "teacher" }
      });
      expect(login.status).toBe(200);
      const token = login.body.data.access_token;
      const create = await request<ApiEnvelope<ValidationSessionRecord>>(
        baseUrl,
        "/api/v1/bff/teacher/validation-sessions",
        {
          method: "POST",
          token,
          body: {
            course_id: "course_demo",
            run_id: "run_w023",
            source_product_merge_sha: "31b8c5f5cd3ab0426bb02bc75495b8552e497c48",
            machine_admission_reference: "w022-admission",
            machine_admission_digest: "a".repeat(64),
            idempotency_key: "http-one"
          }
        }
      );
      expect(create.status).toBe(201);
      const id = create.body.data.session_id;
      const roster = await request<ApiEnvelope<ValidationSessionRecord>>(
        baseUrl,
        `/api/v1/bff/teacher/validation-sessions/${id}/roster`,
        {
          method: "POST",
          token,
          body: {
            participants: [
              {
                participant_id: "teacher",
                session_duty: "TEACHER",
                participant_kind: "SYNTHETIC",
                product_user_id: "usr_teacher"
              },
              {
                participant_id: "learner",
                session_duty: "LEARNER",
                participant_kind: "SYNTHETIC",
                product_user_id: "usr_student",
                team_id: "team_alpha",
                role_key: "CEO"
              },
              {
                participant_id: "moderator",
                session_duty: "MODERATOR",
                participant_kind: "SYNTHETIC"
              },
              {
                participant_id: "observer",
                session_duty: "OBSERVER",
                participant_kind: "SYNTHETIC"
              },
              {
                participant_id: "recorder",
                session_duty: "RECORDER",
                participant_kind: "SYNTHETIC"
              }
            ]
          }
        }
      );
      expect(roster.status).toBe(200);
      expect(
        (
          await request<ApiEnvelope<ValidationSessionRecord>>(
            baseUrl,
            `/api/v1/bff/teacher/validation-sessions/${id}/preflight`,
            { method: "POST", token }
          )
        ).body.data.status
      ).toBe("PREFLIGHT_READY");
      expect(
        (
          await request<ApiEnvelope<ValidationSessionRecord>>(
            baseUrl,
            `/api/v1/bff/teacher/validation-sessions/${id}/start`,
            { method: "POST", token }
          )
        ).body.data.status
      ).toBe("LIVE");
      const observation = await request<ApiEnvelope<ValidationSessionRecord>>(
        baseUrl,
        `/api/v1/bff/teacher/validation-sessions/${id}/observations`,
        {
          method: "POST",
          token,
          body: {
            participant_id: "observer",
            session_duty: "OBSERVER",
            phase: "LIVE",
            category: "flow",
            narrative: "bounded synthetic observation",
            evidence_refs: []
          }
        }
      );
      expect(observation.status).toBe(200);
      const closed = await request<ApiEnvelope<ValidationSessionRecord>>(
        baseUrl,
        `/api/v1/bff/teacher/validation-sessions/${id}/close`,
        { method: "POST", token }
      );
      expect(closed.body.data.evidence_bundle?.human_validation).toBe("NOT_PERFORMED");
      expect(JSON.stringify(closed.body.data)).not.toContain("state_true");
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
