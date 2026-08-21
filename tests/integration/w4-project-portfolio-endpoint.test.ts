import { once } from "node:events";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  ProjectAssignment,
  ProjectProfile,
  ProjectProfileRef
} from "../../packages/shared-contracts/src";
import { getShanghaiMarketWorldReference } from "../../services/api/src/market-world-product";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

const tenantId = "tenant_demo";

async function request<T>(
  baseUrl: string,
  path: string,
  token: string,
  body?: unknown
): Promise<{ status: number; body: ApiEnvelope<T> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-tenant-id": tenantId
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { status: response.status, body: (await response.json()) as ApiEnvelope<T> };
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

function seedProfile(store: SimWarStore, ref: ProjectProfileRef, title: string): void {
  const now = new Date().toISOString();
  const profile: ProjectProfile = {
    customer_segment: "Shanghai families",
    description: title,
    geography: "Shanghai",
    industry: "eldercare",
    market_world_reference: getShanghaiMarketWorldReference(),
    positioning: "trusted-care",
    project_profile_id: ref.project_profile_id,
    service_bundle: "community care",
    starting_capacity: 100,
    starting_cash: 1000,
    template_id: "w4-profile-template",
    title,
    version: ref.version,
    course_id: "course_demo",
    content_digest: ref.content_digest,
    created_at: now,
    created_by: "teacher",
    schema_version: "project-profile.v1",
    status: "VALIDATED",
    provenance: { kind: "APPROVED_SAFE_TEMPLATE" },
    tenant_id: tenantId
  };
  store.projectProfiles.push(profile);
}

describe("W4 governed project portfolio endpoints", () => {
  it("binds ProjectProfile/Assignment authority, exposes role-safe projection, and gates teacher mutations", async () => {
    const store = createP1Store();
    const firstRef: ProjectProfileRef = {
      content_digest: "1".padStart(64, "a"),
      project_profile_id: "w4-profile-1",
      tenant_id: tenantId,
      version: "2026-08-21.1"
    };
    const successorRef: ProjectProfileRef = {
      content_digest: "2".padStart(64, "a"),
      project_profile_id: "w4-profile-2",
      tenant_id: tenantId,
      version: "2026-08-21.2"
    };
    seedProfile(store, firstRef, "W4 Project One");
    seedProfile(store, successorRef, "W4 Acquired Successor");
    const server = createApiServer(store);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server address unavailable");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    try {
      const teacher = await login(baseUrl, "teacher");
      const student = await login(baseUrl, "student");
      const created = await request<{ run: { run_id: string } }>(
        baseUrl,
        "/api/v1/courses/course_demo/runs",
        teacher,
        {}
      );
      expect(created.status).toBe(201);
      const runId = created.body.data.run.run_id;
      const started = await request<{ round_id: string }>(
        baseUrl,
        `/api/v1/runs/${runId}/rounds/1/start`,
        teacher,
        {}
      );
      expect(started.status).toBe(200);
      const roundId = started.body.data.round_id;
      const assignment: ProjectAssignment = {
        assigned_at: new Date().toISOString(),
        assigned_by: "teacher",
        assignment_id: `assignment-${runId}`,
        course_id: "course_demo",
        project_profile_reference: firstRef,
        run_id: runId,
        schema_version: "project-assignment.v1",
        team_id: "team_alpha",
        tenant_id: tenantId
      };
      store.projectAssignments.push(assignment);

      const initial = await request(baseUrl, `/api/v1/w4/runs/${runId}/rounds/1/states`, teacher, {
        course_id: "course_demo",
        team_id: "team_alpha",
        round_id: roundId,
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
      expect(initial.status).toBe(201);
      const decision = await request<{ initiative: { initiative_id: string } }>(
        baseUrl,
        `/api/v1/w4/runs/${runId}/rounds/1/strategic-decisions`,
        student,
        {
          course_id: "course_demo",
          team_id: "team_alpha",
          round_id: roundId,
          decision: {
            decision_id: `w4-portfolio-decision-${runId}`,
            tenant_id: tenantId,
            course_id: "course_demo",
            run_id: runId,
            round_id: roundId,
            round_no: 1,
            team_id: "team_alpha",
            kind: "new_project",
            version: 1,
            status: "canonical",
            payload: {
              project_name: "W4 Project One",
              cost: 100,
              cycle_rounds: 2,
              area: 5000,
              beds: 50,
              bed_mix: { standard: 50 },
              ramp: 0.5,
              lead_time_rounds: 0
            }
          }
        }
      );
      expect(decision.status).toBe(201);
      const addPath = `/api/v1/w4/runs/${runId}/rounds/1/portfolio/projects`;
      const studentAttempt = await request(baseUrl, addPath, student, {
        course_id: "course_demo",
        team_id: "team_alpha",
        round_id: roundId,
        initiative_id: decision.body.data.initiative.initiative_id,
        project_entry_id: "w4-entry-1",
        project_profile_reference: firstRef
      });
      expect(studentAttempt.status).toBe(403);
      const added = await request<{ project_entry_id: string }>(baseUrl, addPath, teacher, {
        course_id: "course_demo",
        team_id: "team_alpha",
        round_id: roundId,
        initiative_id: decision.body.data.initiative.initiative_id,
        project_entry_id: "w4-entry-1",
        project_profile_reference: firstRef
      });
      expect(added.status, JSON.stringify(added.body)).toBe(201);
      expect(added.body.data.project_entry_id).toBe("w4-entry-1");
      const unassignedProfile = await request(baseUrl, addPath, teacher, {
        course_id: "course_demo",
        team_id: "team_alpha",
        round_id: roundId,
        initiative_id: decision.body.data.initiative.initiative_id,
        project_entry_id: "w4-entry-unassigned-profile",
        project_profile_reference: successorRef
      });
      expect(unassignedProfile.status).toBe(422);
      expect(unassignedProfile.body.message).toBe("W4_PROJECT_ASSIGNMENT_REQUIRED");

      const projection = await request<{ project_portfolio: Array<{ project_entry_id: string }> }>(
        baseUrl,
        `/api/v1/bff/student/w4/runs/${runId}/rounds/1/portfolio?round_id=${roundId}&team_id=team_alpha&course_id=course_demo`,
        student
      );
      expect(projection.status).toBe(200);
      expect(projection.body.data.project_portfolio.map((entry) => entry.project_entry_id)).toEqual(
        ["w4-entry-1"]
      );
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
