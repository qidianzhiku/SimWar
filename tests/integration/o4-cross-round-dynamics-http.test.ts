import { createHash } from "node:crypto";
import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  O4CrossRoundDynamicsResponse,
  W4CanonicalStrategicDecision,
  W4EnterpriseState
} from "@simwar/shared-contracts";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

const tenantId = "tenant_demo";
const courseId = "course_demo";

async function startServer(): Promise<{
  baseUrl: string;
  server: Server;
  store: SimWarStore;
}> {
  const store = createP1Store();
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function login(baseUrl: string, username: "teacher" | "student" | "admin"): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-tenant-id": tenantId },
    body: JSON.stringify({ username, password: username })
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as ApiEnvelope<AuthSession>).data.access_token;
}

function state(
  teamId: string,
  roundNo: number,
  metrics: { cash: number; capacity: number; projects: string[]; units: number; positioning: string }
): W4EnterpriseState {
  const roundId = `o4-${teamId}-${roundNo}`;
  const stateId = `o4-state-${teamId}-${roundNo}`;
  const stateDigest = createHash("sha256")
    .update(JSON.stringify({ teamId, roundNo, metrics }))
    .digest("hex");
  return {
    enterprise_state_id: stateId,
    tenant_id: tenantId,
    course_id: courseId,
    run_id: "o4-http-run",
    team_id: teamId,
    round_id: roundId,
    round_no: roundNo,
    version: 1,
    parent_state_ref: null,
    state_digest: stateDigest,
    state: {
      cash: metrics.cash,
      capacity: metrics.capacity,
      product_lines: ["core-care"],
      positioning: metrics.positioning,
      organization: { team_size: 4 + metrics.units },
      operating_units: Array.from({ length: metrics.units }, (_, index) => ({
        operating_unit_id: `${teamId}-unit-${index + 1}`,
        name: `${teamId} Operations ${index + 1}`,
        status: "active" as const
      })),
      portfolio: { projects: metrics.projects, facilities: [] }
    }
  };
}

function decision(teamId: string): W4CanonicalStrategicDecision {
  return {
    decision_id: `o4-decision-${teamId}`,
    tenant_id: tenantId,
    course_id: courseId,
    run_id: "o4-http-run",
    round_id: `o4-${teamId}-3`,
    round_no: 3,
    team_id: teamId,
    kind: "positioning_adjustment",
    version: 1,
    status: "canonical",
    payload: { positioning: "focused" },
    admission: {
      policy: "LEGACY_DIRECT_EXPLICIT",
      authority: "synthetic_run_creation_marker",
      canonical_decision_id: `o4-decision-${teamId}`,
      merge_commit_id: null,
      team_confirmation_id: null,
      decision_payload_digest: "f".repeat(64)
    }
  };
}

function seedCandidate(store: SimWarStore): void {
  store.runs.push({
    run_id: "o4-http-run",
    tenant_id: tenantId,
    course_id: courseId,
    scenario_package_id: "scenario_demo",
    parameter_set_id: "params_demo",
    seed: 42,
    status: "active"
  });
  store.w4.states.push(
    state("team_alpha", 1, { cash: 100, capacity: 10, projects: [], units: 1, positioning: "focused" }),
    state("team_alpha", 2, {
      cash: 120,
      capacity: 12,
      projects: ["alpha-project-1"],
      units: 2,
      positioning: "focused"
    }),
    state("team_alpha", 3, {
      cash: 150,
      capacity: 14,
      projects: ["alpha-project-1", "alpha-project-2"],
      units: 2,
      positioning: "focused"
    }),
    state("team_beta", 1, { cash: 100, capacity: 10, projects: [], units: 1, positioning: "focused" }),
    state("team_beta", 2, {
      cash: 80,
      capacity: 11,
      projects: ["beta-project-1"],
      units: 1,
      positioning: "focused"
    }),
    state("team_beta", 3, {
      cash: 140,
      capacity: 13,
      projects: ["beta-project-1"],
      units: 1,
      positioning: "focused"
    })
  );
  store.w4.decisions.push(decision("team_alpha"), decision("team_beta"));
}

async function getCandidate(
  baseUrl: string,
  surface: "teacher" | "student" | "admin",
  token: string,
  course = courseId
): Promise<{ status: number; body: ApiEnvelope<O4CrossRoundDynamicsResponse> }> {
  const response = await fetch(
    `${baseUrl}/api/v1/bff/${surface}/o4/runs/o4-http-run/cross-round-dynamics?course_id=${course}`,
    { headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId } }
  );
  return {
    status: response.status,
    body: (await response.json()) as ApiEnvelope<O4CrossRoundDynamicsResponse>
  };
}

describe("O4 cross-round dynamics real BFF", () => {
  it("serves a deterministic teacher/admin candidate and a team-scoped student projection without writes", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      seedCandidate(store);
      const teacherToken = await login(baseUrl, "teacher");
      const studentToken = await login(baseUrl, "student");
      const adminToken = await login(baseUrl, "admin");
      const before = JSON.stringify(store.w4);

      const teacher = await getCandidate(baseUrl, "teacher", teacherToken);
      expect(teacher.status).toBe(200);
      expect(teacher.body.data.visibility).toBe("teacher_safe");
      expect(teacher.body.data.candidate.status).toBe("PROVEN");
      expect(teacher.body.data.candidate.source_team_count).toBe(2);
      expect(teacher.body.data.candidate.source_state_ref_count).toBe(6);
      expect(teacher.body.data.candidate.pair_differentials).toHaveLength(1);
      expect(teacher.body.data.candidate.pair_differentials[0]).toMatchObject({
        current_decision_match: "MATCHED",
        history_different: true,
        outcome_differential: { cash: 10, capacity: 1, portfolio_count: 1, operating_unit_count: 1 }
      });

      const student = await getCandidate(baseUrl, "student", studentToken);
      expect(student.status).toBe(200);
      expect(student.body.data.visibility).toBe("student_safe");
      expect(student.body.data.candidate.source_team_count).toBe(1);
      expect(student.body.data.candidate.team_paths).toHaveLength(1);
      expect(student.body.data.candidate.team_paths[0]?.team_id).toBe("team_alpha");
      expect(student.body.data.candidate.team_paths[0]?.rounds[0]?.metrics).toBeUndefined();
      expect(student.body.data.candidate.team_paths[0]?.rounds[0]?.closing_state_ref).toBeUndefined();
      expect(student.body.data.candidate.pair_differentials).toHaveLength(0);
      expect(JSON.stringify(student.body.data)).not.toContain("team_beta");
      expect(JSON.stringify(student.body.data)).not.toContain("state_digest");

      const admin = await getCandidate(baseUrl, "admin", adminToken);
      expect(admin.status).toBe(200);
      expect(admin.body.data.visibility).toBe("admin_safe");
      expect(admin.body.data.candidate.team_paths.map((path) => path.team_id)).toEqual([
        "team_alpha",
        "team_beta"
      ]);
      expect(JSON.stringify(store.w4)).toBe(before);
    } finally {
      server.close();
    }
  });

  it("enforces exact run/course scope and bounded-history failure", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      seedCandidate(store);
      const teacherToken = await login(baseUrl, "teacher");
      const wrongCourse = await getCandidate(baseUrl, "teacher", teacherToken, "course_other");
      expect(wrongCourse.status).toBe(403);
      expect((wrongCourse.body as unknown as { code: string }).code).toBe("O4_COURSE_SCOPE_CONFLICT");

      store.w4.states = store.w4.states.filter((item) => item.round_no !== 1);
      const insufficient = await getCandidate(baseUrl, "teacher", teacherToken);
      expect(insufficient.status).toBe(409);
      expect((insufficient.body as unknown as { code: string }).code).toBe("O4_INSUFFICIENT_HISTORY");
    } finally {
      server.close();
    }
  });
});
