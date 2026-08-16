import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  Round,
  Run,
  TeacherBffWorkspaceDTO
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

const tenantId = "tenant_demo";
const runId = "mw3-round-context-run";

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  const run: Run = {
    course_id: "course_demo",
    parameter_set_id: "param_toy_approved_1",
    run_id: runId,
    scenario_package_id: "scenario_eldercare_demo",
    seed: 23,
    status: "active",
    tenant_id: tenantId
  };
  store.runs.push(run);
  store.rounds.push(
    {
      round_id: "mw3-round-1",
      round_no: 1,
      run_id: runId,
      status: "published",
      tenant_id: tenantId
    },
    {
      round_id: "mw3-round-2",
      round_no: 2,
      run_id: runId,
      status: "draft",
      tenant_id: tenantId
    }
  );
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function login(baseUrl: string): Promise<AuthSession> {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    body: JSON.stringify({ password: "teacher", username: "teacher" }),
    headers: { "content-type": "application/json", "x-tenant-id": tenantId },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as ApiEnvelope<AuthSession>).data;
}

async function getWorkspace(
  baseUrl: string,
  token: string,
  roundNo: number,
  requestTenantId = tenantId
): Promise<{ status: number; envelope: ApiEnvelope<TeacherBffWorkspaceDTO> }> {
  const response = await fetch(
    `${baseUrl}/api/v1/bff/teacher/runs/${runId}/rounds/${roundNo}/workspace`,
    {
      headers: {
        authorization: `Bearer ${token}`,
        "x-tenant-id": requestTenantId
      }
    }
  );
  return {
    status: response.status,
    envelope: (await response.json()) as ApiEnvelope<TeacherBffWorkspaceDTO>
  };
}

describe("MW3 Teacher exact Run/Round BFF and command boundary", () => {
  it("RC01, RC09, and RC10 keep Round 2 projection and command separate from published Round 1", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const teacher = await login(baseUrl);
      const round2 = await getWorkspace(baseUrl, teacher.access_token, 2);
      expect(round2.status).toBe(200);
      expect(round2.envelope.data.round_control).toMatchObject({
        round_id: "mw3-round-2",
        round_no: 2,
        run_id: runId,
        status: "draft",
        tenant_id: tenantId
      });
      expect(round2.envelope.data.round_control.allowed_actions).toContain("round:start");

      const start = await fetch(`${baseUrl}/api/v1/runs/${runId}/rounds/2/start`, {
        headers: {
          authorization: `Bearer ${teacher.access_token}`,
          "x-tenant-id": tenantId
        },
        method: "POST"
      });
      expect(start.status).toBe(200);
      const started = (await start.json()) as ApiEnvelope<Round>;
      expect(started.data).toMatchObject({ round_id: "mw3-round-2", round_no: 2, status: "open" });

      const round1 = await getWorkspace(baseUrl, teacher.access_token, 1);
      expect(round1.status).toBe(200);
      expect(round1.envelope.data.round_control).toMatchObject({
        round_id: "mw3-round-1",
        round_no: 1,
        status: "published"
      });
    } finally {
      server.close();
      await once(server, "close");
    }
  });

  it("RC14 and RC15 fail closed for unknown Run and cross-tenant context", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const teacher = await login(baseUrl);
      const crossTenant = await getWorkspace(baseUrl, teacher.access_token, 2, "tenant_other");
      expect(crossTenant.status).toBeGreaterThanOrEqual(400);

      const missing = await fetch(
        `${baseUrl}/api/v1/bff/teacher/runs/other-run/rounds/2/workspace`,
        {
          headers: {
            authorization: `Bearer ${teacher.access_token}`,
            "x-tenant-id": tenantId
          }
        }
      );
      expect(missing.status).toBeGreaterThanOrEqual(400);
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
