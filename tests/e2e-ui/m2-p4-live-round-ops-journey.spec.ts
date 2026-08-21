import { expect, test, type APIRequestContext } from "@playwright/test";
import type {
  ApiEnvelope,
  AuthSession,
  M2P4TeacherLiveRoundOps,
  Round,
  StudentBffCockpitDTO
} from "../../packages/shared-contracts/src";
import { M2P4_PROFILE_ID, M2P4_ROUND_ID, M2P4_RUN_ID } from "./m2-p4-live-round-ops-fixture";
import { cleanupPlaywrightStore } from "./store-isolation";

const apiBaseUrl = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;

test.afterAll(() => cleanupPlaywrightStore());

async function apiRequest<TData>(
  request: APIRequestContext,
  method: "GET" | "POST",
  path: string,
  token?: string,
  body?: unknown,
  servicePrincipal?: string
): Promise<{ status: number; data?: TData; errorCode?: string; raw?: unknown }> {
  const response = await request.fetch(`${apiBaseUrl}${path}`, {
    data: body,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": "tenant_demo",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(servicePrincipal ? { "x-service-principal": servicePrincipal } : {})
    },
    method
  });
  const raw = (await response.json()) as ApiEnvelope<TData> & { code?: string };
  return response.ok()
    ? { data: raw.data, raw, status: response.status() }
    : { errorCode: raw.code, raw, status: response.status() };
}

async function login(
  request: APIRequestContext,
  username: "teacher" | "student" | "student_beta"
): Promise<string> {
  const response = await apiRequest<AuthSession>(request, "POST", "/api/v1/auth/login", undefined, {
    password: username,
    username
  });
  expect(response.status, `${username} login`).toBe(200);
  return response.data!.access_token;
}

function assertExactScope(scope: Record<string, unknown>, teamId?: string): void {
  expect(scope).toMatchObject({
    course_id: "course_demo",
    round_id: M2P4_ROUND_ID,
    round_no: 1,
    run_id: M2P4_RUN_ID,
    tenant_id: "tenant_demo"
  });
  if (teamId) expect(scope.team_id).toBe(teamId);
}

function assertNoStudentTruthLeak(payload: unknown): void {
  const forbidden = new Set([
    "state_true",
    "replay_hash",
    "decision_batch_hash",
    "other_team_data"
  ]);
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value)) {
      expect(forbidden.has(key), `student projection contains forbidden key: ${key}`).toBe(false);
      visit(nested);
    }
  };
  visit(payload);
}

test("@m2-p4-real completes teacher lock-settle-publish and student-safe project journey", async ({
  page,
  request
}) => {
  await test.step("R01 dedicated runner has an explicit real-BFF, mocks=0 contract", async () => {
    expect(process.env.SIMWAR_PLAYWRIGHT_M2P4).toBe("true");
    expect(process.env.SIMWAR_PLAYWRIGHT_M2_PROJECT_AWARE).not.toBe("true");
    expect(process.env.SIMWAR_PLAYWRIGHT_W3).toBe("false");
    await page.goto("about:blank");
  });

  const teacherToken = await test.step("R02 authenticate the Teacher Course Director", () =>
    login(request, "teacher"));
  const studentToken = await test.step("R03 authenticate the Alpha Student", () =>
    login(request, "student"));
  const betaStudentToken = await test.step("R04 authenticate the Beta Student", () =>
    login(request, "student_beta"));

  const initialWorkspace =
    await test.step("R05 read the exact teacher workspace and all-team readiness", () =>
      apiRequest<{ live_round_ops: M2P4TeacherLiveRoundOps }>(
        request,
        "GET",
        `/api/v1/bff/teacher/runs/${M2P4_RUN_ID}/rounds/1/workspace`,
        teacherToken
      ));
  expect(initialWorkspace.status).toBe(200);
  const initialOps = initialWorkspace.data!.live_round_ops;
  assertExactScope(initialOps.exact_scope);
  expect(initialOps.round).toMatchObject({ status: "open", lock_ready: true });
  expect(initialOps.session_command).toMatchObject({
    authority: "server",
    enabled: true,
    primary_action: "round:lock"
  });
  expect(initialOps.teams).toHaveLength(2);
  for (const team of initialOps.teams) {
    expect(team.project.state).toBe("READY");
    expect(team.role.state).toBe("READY");
    expect(team.decision.state).toBe("READY");
    assertExactScope(team.exact_scope, team.team_id);
  }

  const locked = await test.step("R06 explicitly lock the exact round", () =>
    apiRequest<Round>(request, "POST", `/api/v1/runs/${M2P4_RUN_ID}/rounds/1/lock`, teacherToken));
  expect(locked.status).toBe(200);
  expect(locked.data).toMatchObject({ round_id: M2P4_ROUND_ID, status: "locked" });

  const lockedWorkspace =
    await test.step("R07 verify the lock receipt and immutable decision batch", () =>
      apiRequest<{ live_round_ops: M2P4TeacherLiveRoundOps }>(
        request,
        "GET",
        `/api/v1/bff/teacher/runs/${M2P4_RUN_ID}/rounds/1/workspace`,
        teacherToken
      ));
  expect(lockedWorkspace.status).toBe(200);
  const lockedOps = lockedWorkspace.data!.live_round_ops;
  expect(lockedOps.round.status).toBe("locked");
  expect(lockedOps.receipts.lock).toMatchObject({ status: "LOCKED", round_id: M2P4_ROUND_ID });
  assertExactScope(lockedOps.receipts.lock!);
  expect(lockedOps.settlement.status).toBe("READY");

  const studentBeforeSettlement =
    await test.step("R08 confirm Student sees project context but no result before settlement", () =>
      apiRequest<StudentBffCockpitDTO>(
        request,
        "GET",
        `/api/v1/bff/student/runs/${M2P4_RUN_ID}/rounds/1/cockpit`,
        studentToken
      ));
  expect(studentBeforeSettlement.status).toBe(200);
  expect(studentBeforeSettlement.data!.project_context).toMatchObject({
    exact_scope: { team_id: "team_alpha" },
    project_profile_reference: { project_profile_id: M2P4_PROFILE_ID }
  });
  expect(studentBeforeSettlement.data!.published_result.redacted_result).toBeUndefined();
  assertNoStudentTruthLeak(studentBeforeSettlement.data);

  const settled = await test.step("R09 settle exactly the locked canonical decision set", () =>
    apiRequest<unknown>(
      request,
      "POST",
      `/internal/v1/runs/${M2P4_RUN_ID}/rounds/1/settle`,
      "playwright-internal-service-token",
      undefined,
      "service_kernel"
    ));
  expect(settled.status).toBe(200);

  const settledWorkspace =
    await test.step("R10 verify SETTLED is available to Teacher as a safe preview", () =>
      apiRequest<{ live_round_ops: M2P4TeacherLiveRoundOps; teacher_replay_summary: unknown }>(
        request,
        "GET",
        `/api/v1/bff/teacher/runs/${M2P4_RUN_ID}/rounds/1/workspace`,
        teacherToken
      ));
  expect(settledWorkspace.status).toBe(200);
  const settledOps = settledWorkspace.data!.live_round_ops;
  expect(settledOps.round.status).toBe("settled");
  expect(settledOps.settlement).toMatchObject({ status: "SETTLED" });
  expect(settledOps.publication).toMatchObject({ status: "READY", visibility_only: true });
  expect(settledWorkspace.data!.teacher_replay_summary).toBeDefined();

  const studentBeforePublish =
    await test.step("R11 confirm SETTLED remains unpublished to Student", () =>
      apiRequest<StudentBffCockpitDTO>(
        request,
        "GET",
        `/api/v1/bff/student/runs/${M2P4_RUN_ID}/rounds/1/cockpit`,
        studentToken
      ));
  expect(studentBeforePublish.status).toBe(200);
  expect(studentBeforePublish.data!.published_result.redacted_result).toBeUndefined();
  assertNoStudentTruthLeak(studentBeforePublish.data);

  const published = await test.step("R12 explicitly publish visibility only", () =>
    apiRequest<Round>(
      request,
      "POST",
      `/api/v1/runs/${M2P4_RUN_ID}/rounds/1/publish`,
      teacherToken
    ));
  expect(published.status).toBe(200);
  expect(published.data).toMatchObject({ round_id: M2P4_ROUND_ID, status: "published" });

  const alphaAfterPublish =
    await test.step("R13 verify Alpha receives only its own published projection", () =>
      apiRequest<StudentBffCockpitDTO>(
        request,
        "GET",
        `/api/v1/bff/student/runs/${M2P4_RUN_ID}/rounds/1/cockpit`,
        studentToken
      ));
  expect(alphaAfterPublish.status).toBe(200);
  expect(alphaAfterPublish.data!.published_result.redacted_result).toBeDefined();
  expect(alphaAfterPublish.data!.project_context?.exact_scope.team_id).toBe("team_alpha");
  expect(JSON.stringify(alphaAfterPublish.data)).not.toContain("team_beta");
  assertNoStudentTruthLeak({ project_context: alphaAfterPublish.data!.project_context });

  await test.step("R14 verify Beta isolation, cross-team denial, and debrief handoff receipt", async () => {
    const betaAfterPublish = await apiRequest<StudentBffCockpitDTO>(
      request,
      "GET",
      `/api/v1/bff/student/runs/${M2P4_RUN_ID}/rounds/1/cockpit`,
      betaStudentToken
    );
    expect(betaAfterPublish.status).toBe(200);
    expect(betaAfterPublish.data!.project_context?.exact_scope.team_id).toBe("team_beta");
    expect(JSON.stringify(betaAfterPublish.data)).not.toContain("team_alpha");
    assertNoStudentTruthLeak(betaAfterPublish.data);

    const crossTeam = await apiRequest<unknown>(
      request,
      "GET",
      `/api/v1/bff/student/project-aware-context?course_id=course_demo&run_id=${M2P4_RUN_ID}&team_id=team_beta`,
      studentToken
    );
    expect(crossTeam.status).toBe(403);

    const finalWorkspace = await apiRequest<{ live_round_ops: M2P4TeacherLiveRoundOps }>(
      request,
      "GET",
      `/api/v1/bff/teacher/runs/${M2P4_RUN_ID}/rounds/1/workspace`,
      teacherToken
    );
    expect(finalWorkspace.status).toBe(200);
    const finalOps = finalWorkspace.data!.live_round_ops;
    expect(finalOps.publication).toMatchObject({ status: "PUBLISHED", visibility_only: true });
    expect(finalOps.receipts.publication).toMatchObject({
      status: "PUBLISHED",
      visibility_only: true,
      round_id: M2P4_ROUND_ID
    });
    expect(finalOps.debrief_handoff).toMatchObject({
      existing_w3_p2b_authority: true,
      status: "READY"
    });
    assertExactScope(finalOps.exact_scope);
  });
});
