import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  M2P5DecisionLearningResponse
} from "@simwar/shared-contracts";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store } from "../../services/api/src/store";
import {
  M2P5_COURSE_ID,
  M2P5_ROUND_1_ID,
  M2P5_RUN_ID,
  M2P5_TEAM_ID,
  M2P5_TENANT_ID,
  seedM2P5DecisionLearningStore
} from "../e2e-ui/m2-p5-decision-learning-crossround-fixture";

async function startServer(): Promise<{
  baseUrl: string;
  server: Server;
  store: ReturnType<typeof createP1Store>;
}> {
  const store = createP1Store();
  await seedM2P5DecisionLearningStore(store);
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function login(baseUrl: string, username: "teacher" | "student"): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    body: JSON.stringify({ password: username, username }),
    headers: { "content-type": "application/json", "x-tenant-id": M2P5_TENANT_ID },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as ApiEnvelope<AuthSession>).data.access_token;
}

function contextQuery(): string {
  const query = new URLSearchParams({
    activity_id: "activity_consequence",
    course_id: M2P5_COURSE_ID,
    role_key: "CEO",
    round_id: M2P5_ROUND_1_ID,
    round_no: "1",
    run_id: M2P5_RUN_ID,
    team_id: M2P5_TEAM_ID,
    tenant_id: M2P5_TENANT_ID
  });
  return query.toString();
}

function requestHeaders(token: string, tenantId = M2P5_TENANT_ID): HeadersInit {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-tenant-id": tenantId
  };
}

async function getJourney(
  baseUrl: string,
  surface: "student" | "teacher",
  token: string,
  tenantId = M2P5_TENANT_ID
): Promise<{ status: number; body: ApiEnvelope<M2P5DecisionLearningResponse> }> {
  const response = await fetch(
    `${baseUrl}/api/v1/bff/${surface}/m2p5/runs/${M2P5_RUN_ID}/rounds/1/decision-learning?${contextQuery()}`,
    { headers: requestHeaders(token, tenantId) }
  );
  return {
    status: response.status,
    body: (await response.json()) as ApiEnvelope<M2P5DecisionLearningResponse>
  };
}

async function post(baseUrl: string, path: string, token: string, body: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    body: JSON.stringify(body),
    headers: requestHeaders(token),
    method: "POST"
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describe("M2-P5 decision-learning cross-round real BFF", () => {
  it("composes published consequence, AI-off reflection, D2/D3/D4, project and W4 into exact next-round entry", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const studentToken = await login(baseUrl, "student");
      const before = await getJourney(baseUrl, "student", studentToken);
      expect(before.status).toBe(200);
      expect(before.body.data.project_context.status).toBe("RESOLVED");
      expect(before.body.data.learning.gate).toBe("BLOCKED");
      expect(before.body.data.cross_round.status).toBe("BLOCKED");

      const context = {
        activity_id: "activity_consequence",
        course_id: M2P5_COURSE_ID,
        role_key: "CEO",
        round_id: M2P5_ROUND_1_ID,
        round_no: 1,
        run_id: M2P5_RUN_ID,
        team_id: M2P5_TEAM_ID
      };
      const reflection = await post(baseUrl, "/api/v1/bff/student/w3/reflection", studentToken, {
        context,
        idempotency_key: "m2p5-reflection-idempotency",
        prompt_id: "w3-reflection-off-v1",
        response: "The published outcome is an exact bounded consequence of the admitted decision."
      });
      expect(reflection.status).toBe(201);
      expect(JSON.stringify(reflection.body)).toContain('"ai_used":false');

      const selection = await post(
        baseUrl,
        "/api/v1/bff/teacher/w3/evidence-selection",
        teacherToken,
        {
          context,
          evidence_refs: [
            {
              content_digest: "d".repeat(64),
              discriminator: "exact_ref",
              resource_id: "m2p5-evidence-consequence",
              resource_type: "evidence_artifact",
              tenant_id: M2P5_TENANT_ID,
              version: "1.0.0"
            }
          ],
          idempotency_key: "m2p5-selection-idempotency"
        }
      );
      expect(selection.status).toBe(201);

      const hypothesis = await post(
        baseUrl,
        "/api/v1/bff/teacher/w3/next-round-hypothesis",
        teacherToken,
        { context }
      );
      expect(hypothesis.status).toBe(200);

      const teacherJourney = await getJourney(baseUrl, "teacher", teacherToken);
      expect(teacherJourney.status).toBe(200);
      expect(teacherJourney.body.data.learning.gate).toBe("READY");
      expect(teacherJourney.body.data.learning.student_learning_report_status).toBe("CONFIRMED");
      expect(teacherJourney.body.data.project_context.status).toBe("RESOLVED");
      expect(teacherJourney.body.data.cross_round.status).toBe("ENTRY_READY");
      expect(teacherJourney.body.data.cross_round.entry_status).toBe("OPEN");
      expect(teacherJourney.body.data.cross_round.next_round?.source_closing_state_ref).toEqual(
        teacherJourney.body.data.cross_round.predecessor_closing_state_ref
      );
      expect(JSON.stringify(teacherJourney.body)).not.toContain("state_true");
      expect(JSON.stringify(teacherJourney.body)).not.toContain("replay_hash");

      const studentJourney = await getJourney(baseUrl, "student", studentToken);
      expect(studentJourney.status).toBe(200);
      expect(studentJourney.body.data.cross_round.entry_status).toBe("OPEN");
      expect(store.decisions.filter((decision) => decision.round_no === 2)).toHaveLength(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("fails closed for a wrong student team or tenant context", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const studentToken = await login(baseUrl, "student");
      const wrongTeam = await getJourney(baseUrl, "student", studentToken);
      expect(wrongTeam.status).toBe(200);
      const tamperedPath = await fetch(
        `${baseUrl}/api/v1/bff/student/m2p5/runs/${M2P5_RUN_ID}/rounds/1/decision-learning?${new URLSearchParams(
          {
            activity_id: "activity_consequence",
            course_id: M2P5_COURSE_ID,
            role_key: "CEO",
            round_id: M2P5_ROUND_1_ID,
            round_no: "1",
            run_id: M2P5_RUN_ID,
            team_id: "team_beta",
            tenant_id: M2P5_TENANT_ID
          }
        )}`,
        { headers: requestHeaders(studentToken) }
      );
      expect(tamperedPath.status).toBe(403);
      const wrongTenant = await getJourney(baseUrl, "student", studentToken, "tenant_other");
      expect([401, 403]).toContain(wrongTenant.status);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
