import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ApiEnvelope } from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { getShanghaiMarketWorldReference } from "../../services/api/src/market-world-product";
import {
  createCoursePackageDraftVersion,
  createCoursePackageLifecycleSnapshot
} from "../../services/api/src/course-package-json-registry";
import { createP1Store } from "../../services/api/src/store";
import { buildM30CourseFactorySourceEvidence } from "@simwar/sh-next-support";
import {
  M2P3_RUN_ID,
  M2P3_ROUND_ID,
  M2P3_PROFILE_ID,
  seedM2P3ProjectAwareLaunchFixture
} from "../e2e-ui/m2-p3-project-aware-launch-fixture";

async function request<T>(
  baseUrl: string,
  path: string,
  options: { body?: unknown; method?: string; token?: string } = {}
): Promise<{ body: ApiEnvelope<T>; status: number }> {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": "tenant_demo"
  });
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    method: options.method ?? (options.body === undefined ? "GET" : "POST")
  });
  return { body: (await response.json()) as ApiEnvelope<T>, status: response.status };
}

async function login(baseUrl: string, username: string): Promise<string> {
  const result = await request<{ access_token: string }>(baseUrl, "/api/v1/auth/login", {
    body: { password: username, username }
  });
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  return result.body.data.access_token;
}

async function startServer(): Promise<{ baseUrl: string; server: Server }> {
  const store = createP1Store();
  store.courses[0]!.market_world_reference = getShanghaiMarketWorldReference();
  store.runs.push({
    course_id: "course_demo",
    parameter_set_id: "param_toy_approved_1",
    run_id: "run_project_aware",
    scenario_package_id: "scenario_eldercare_demo",
    seed: 17,
    status: "active",
    tenant_id: "tenant_demo"
  });
  store.rounds.push({
    round_id: "round_project_aware",
    round_no: 1,
    run_id: "run_project_aware",
    status: "open",
    tenant_id: "tenant_demo"
  });
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

describe("Project-aware launch BFF", () => {
  it("returns an exact readiness projection and rejects an alias launch key", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const readiness = await request(
        baseUrl,
        "/api/v1/bff/teacher/courses/course_demo/project-aware-readiness?run_id=run_project_aware",
        { token: teacherToken }
      );
      expect(readiness.status).toBe(200);
      expect(readiness.body.data.state).toBe("BLOCKED");
      expect(JSON.stringify(readiness.body.data)).not.toMatch(/latest|current|default/i);

      const launch = await request(
        baseUrl,
        "/api/v1/bff/teacher/courses/course_demo/project-aware-launch",
        {
          body: {
            idempotency_key: "default",
            run_id: "run_project_aware",
            seed: 17
          },
          token: teacherToken
        }
      );
      expect(launch.status).toBe(422);
      expect(launch.body.code).toMatch(/ALIAS|IDENTITY|IDEMPOTENCY/i);
    } finally {
      server.close();
    }
  });

  it("runs the matched-arena launch, safe Student entry, idempotent retry and Admin audit", async () => {
    const directory = mkdtempSync(join(tmpdir(), "simwar-m2-p3-integration-"));
    const storeFile = join(directory, "store.json");
    seedM2P3ProjectAwareLaunchFixture(storeFile);
    const store = createP1Store({ persistenceFile: storeFile });
    const course = store.courses.find((candidate) => candidate.course_id === "course_demo");
    if (!course) throw new Error("M30 test fixture course_demo missing");
    const blueprintReference = {
      content_digest: "a".repeat(64),
      course_blueprint_id: "blueprint_m30_student",
      tenant_id: "tenant_demo",
      version: "1.0.0"
    };
    const scenarioReference = {
      content_digest: "c".repeat(64),
      scenario_package_id: course.scenario_package_id,
      tenant_id: "tenant_demo",
      version: "1.0.0"
    };
    const parameterReference = {
      content_digest: "b".repeat(64),
      parameter_set_id: course.parameter_set_id,
      version: "1.0.0"
    };
    const factoryMetadata = {
      known_limits: ["PUBLIC_SOURCE_BOUND; calibration NOT_PROVEN"],
      provenance: { kind: "ORIGINAL" as const },
      rights: {
        allowed_tenant_ids: ["tenant_demo"],
        copy_allowed: false,
        export_allowed: false,
        expires_at: "2026-11-30T00:00:00.000Z",
        owner_tenant_id: "tenant_demo"
      },
      schema_version: "course-factory.v1" as const,
      source_evidence_reference: buildM30CourseFactorySourceEvidence(),
      source_manifest: {
        course_blueprint_reference: blueprintReference,
        parameter_set_reference: parameterReference,
        scenario_package_reference: scenarioReference
      },
      user_data_policy: {
        copied_private_data: false as const,
        copied_user_decisions: false as const,
        copied_user_results: false as const
      }
    };
    const draft = createCoursePackageDraftVersion({
      actor_id: "usr_admin",
      draft: {
        course_blueprint_reference: blueprintReference,
        course_package_id: "course_factory_m30_student",
        description: "M30 source-backed student-safe context.",
        factory_metadata: factoryMetadata,
        parameter_set_reference: parameterReference,
        scenario_package_reference: scenarioReference,
        title: "M30 source-backed student context",
        version: "1.0.0"
      },
      now: "2026-08-30T08:00:00.000Z",
      tenant_id: "tenant_demo"
    });
    store.coursePackageLifecycleSnapshots.push(
      draft,
      createCoursePackageLifecycleSnapshot(draft, "VALIDATED"),
      createCoursePackageLifecycleSnapshot(draft, "APPROVED"),
      createCoursePackageLifecycleSnapshot(draft, "PUBLISHED")
    );
    store.persist();
    const server = createApiServer(store);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server address unavailable");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    try {
      const teacherToken = await login(baseUrl, "teacher");
      const readiness = await request<{
        state: string;
        teams: Array<{ team_id: string; project_profile_reference?: unknown }>;
      }>(
        baseUrl,
        `/api/v1/bff/teacher/courses/course_demo/project-aware-readiness?run_id=${M2P3_RUN_ID}`,
        { token: teacherToken }
      );
      expect(readiness.status, JSON.stringify(readiness.body)).toBe(200);
      expect(readiness.body.data.state, JSON.stringify(readiness.body)).toBe("READY");
      expect(readiness.body.data.teams).toHaveLength(2);
      expect(readiness.body.data.teams[0]?.project_profile_reference).toEqual(
        readiness.body.data.teams[1]?.project_profile_reference
      );

      const launch = await request<{ status: string; team_ids: string[] }>(
        baseUrl,
        "/api/v1/bff/teacher/courses/course_demo/project-aware-launch",
        {
          body: { idempotency_key: "m2p3-launch-course-demo", run_id: M2P3_RUN_ID },
          token: teacherToken
        }
      );
      expect(launch.status, JSON.stringify(launch.body)).toBe(200);
      expect(launch.body.data.status).toBe("ACCEPTED");
      expect(launch.body.data.team_ids).toEqual(["team_alpha", "team_beta"]);
      expect(store.formalRunRuntimeBindings).toHaveLength(1);
      const openingStates = store.w4.states.filter(
        (state) => state.run_id === M2P3_RUN_ID && state.round_no === 1
      );
      expect(openingStates).toHaveLength(2);
      expect(openingStates.map((state) => state.team_id).sort()).toEqual([
        "team_alpha",
        "team_beta"
      ]);
      expect(new Set(openingStates.map((state) => state.enterprise_state_id)).size).toBe(2);
      expect(new Set(openingStates.map((state) => state.state_digest)).size).toBe(2);
      expect(
        openingStates.every(
          (state) =>
            state.state.organization.project_profile_id === "shanghai-project-m2-p3-browser" &&
            !JSON.stringify(state.state).includes(
              state.team_id === "team_alpha" ? "team_beta" : "team_alpha"
            )
        )
      ).toBe(true);
      expect(store.w4.decisions).toHaveLength(0);
      expect(store.w4.outcomes).toHaveLength(0);

      const studentBriefToken = await login(baseUrl, "student");
      const studentBrief = await request<{
        decision_context_evidence_required: boolean;
        project_profile_reference: { project_profile_id: string };
      }>(
        baseUrl,
        `/api/v1/bff/student/project-brief?course_id=course_demo&run_id=${M2P3_RUN_ID}&round_id=${M2P3_ROUND_ID}&team_id=team_alpha`,
        { token: studentBriefToken }
      );
      expect(studentBrief.status, JSON.stringify(studentBrief.body)).toBe(200);
      expect(studentBrief.body.data.decision_context_evidence_required).toBe(true);
      expect(studentBrief.body.data.project_profile_reference.project_profile_id).toBe(
        M2P3_PROFILE_ID
      );

      const teacherWorkspace = await request<{
        live_round_ops: {
          exact_scope: { run_id: string; round_id: string };
          round: { lock_ready: boolean };
          teams: Array<{
            project: { state: string };
            role: { state: string };
            decision: { state: string };
          }>;
        };
      }>(baseUrl, `/api/v1/bff/teacher/runs/${M2P3_RUN_ID}/rounds/1/workspace`, {
        token: teacherToken
      });
      expect(teacherWorkspace.status, JSON.stringify(teacherWorkspace.body)).toBe(200);
      expect(teacherWorkspace.body.data.live_round_ops.exact_scope).toMatchObject({
        run_id: M2P3_RUN_ID,
        round_id: M2P3_ROUND_ID
      });
      expect(teacherWorkspace.body.data.live_round_ops.round.lock_ready).toBe(false);
      expect(
        teacherWorkspace.body.data.live_round_ops.teams.every(
          (team) => team.project.state === "READY" && team.role.state === "BLOCKED"
        )
      ).toBe(true);
      expect(
        teacherWorkspace.body.data.live_round_ops.teams.every(
          (team) => team.decision.state === "BLOCKED"
        )
      ).toBe(true);

      const concurrent = await Promise.all([
        request<{ status: string }>(
          baseUrl,
          "/api/v1/bff/teacher/courses/course_demo/project-aware-launch",
          {
            body: { idempotency_key: "m2p3-concurrent-launch", run_id: M2P3_RUN_ID },
            token: teacherToken
          }
        ),
        request<{ status: string }>(
          baseUrl,
          "/api/v1/bff/teacher/courses/course_demo/project-aware-launch",
          {
            body: { idempotency_key: "m2p3-concurrent-launch", run_id: M2P3_RUN_ID },
            token: teacherToken
          }
        )
      ]);
      expect(concurrent.map((result) => result.body.data.status).sort()).toEqual([
        "ACCEPTED",
        "REUSED"
      ]);
      expect(store.w4.states).toHaveLength(2);

      const retry = await request<{ status: string }>(
        baseUrl,
        "/api/v1/bff/teacher/courses/course_demo/project-aware-launch",
        {
          body: { idempotency_key: "m2p3-launch-course-demo", run_id: M2P3_RUN_ID },
          token: teacherToken
        }
      );
      expect(retry.status).toBe(200);
      expect(retry.body.data.status).toBe("REUSED");
      expect(store.w4.states).toHaveLength(2);

      const receiptReadback = await request<{ status: string; audit_id: string }>(
        baseUrl,
        "/api/v1/bff/teacher/courses/course_demo/project-aware-launch-receipt?idempotency_key=m2p3-launch-course-demo",
        { token: teacherToken }
      );
      expect(receiptReadback.status).toBe(200);
      expect(receiptReadback.body.data.status).toBe("ACCEPTED");
      expect(receiptReadback.body.data.audit_id).toBe(launch.body.data.audit_id);

      const betaTeam = store.teams.find((team) => team.team_id === "team_beta");
      if (!betaTeam) throw new Error("fixture team_beta missing");
      store.teams = store.teams.filter((team) => team.team_id !== "team_beta");
      const changedTeamRetry = await request(
        baseUrl,
        "/api/v1/bff/teacher/courses/course_demo/project-aware-launch",
        {
          body: { idempotency_key: "m2p3-launch-course-demo", run_id: M2P3_RUN_ID },
          token: teacherToken
        }
      );
      expect(changedTeamRetry.status).toBe(422);
      expect(changedTeamRetry.body.code).toBe("PROJECT_AWARE_IDEMPOTENCY_CONFLICT");
      store.teams.push(betaTeam);

      const studentToken = await login(baseUrl, "student");
      const studentContext = await request<{
        scope: { team_id: string };
        role_context: unknown;
        decision_context_evidence: {
          status: string;
          evidence_version: string;
          scope: { course_id: string; run_id: string; round_no: number; team_id: string };
          source_context?: {
            target_region: string;
            epoch_version: string;
            qualification_status: string;
          };
          continuity: Record<string, string>;
        };
      }>(
        baseUrl,
        `/api/v1/bff/student/project-aware-context?course_id=course_demo&run_id=${M2P3_RUN_ID}&team_id=team_alpha`,
        { token: studentToken }
      );
      expect(studentContext.status, JSON.stringify(studentContext.body)).toBe(200);
      expect(studentContext.body.data.scope.team_id).toBe("team_alpha");
      expect(JSON.stringify(studentContext.body.data)).not.toMatch(
        /state_true|score|rank|settlement_result|other_team_data/i
      );
      expect(studentContext.body.data.course_factory_source_evidence).toEqual({
        target_region: "Hangzhou",
        epoch_version: "epoch-b.2026-08-30",
        qualification_status: "LIMITED",
        consumption_status: "LOOKAHEAD_READY",
        exact_binding_required: true
      });
      expect(JSON.stringify(studentContext.body.data.course_factory_source_evidence)).not.toMatch(
        /digest|private|settlement|score|rank|raw_source/i
      );
      expect(studentContext.body.data.decision_context_evidence).toMatchObject({
        status: "READY",
        evidence_version: "student-decision-context.v1",
        scope: {
          course_id: "course_demo",
          run_id: M2P3_RUN_ID,
          round_no: 1,
          team_id: "team_alpha"
        },
        source_context: {
          target_region: "Hangzhou",
          epoch_version: "epoch-b.2026-08-30",
          qualification_status: "LIMITED"
        },
        continuity: {
          context: "PROVEN",
          decision: "PROVEN",
          consequence: "PENDING_PUBLISH",
          debrief: "PENDING_PUBLISH",
          regional_transfer: "PENDING_PUBLISH"
        }
      });
      expect(JSON.stringify(studentContext.body.data.decision_context_evidence)).not.toMatch(
        /raw_source|locator|digest|private|hidden_calibration|model_truth|state_true|score|rank|settlement/i
      );

      const decisionContextEvidenceId =
        studentContext.body.data.decision_context_evidence.evidence_id;
      const missingEvidenceSave = await request(
        baseUrl,
        "/api/v1/bff/student/role-workspace/section",
        {
          body: {
            round_id: M2P3_ROUND_ID,
            run_id: M2P3_RUN_ID,
            team_id: "team_alpha",
            expected_version: 0,
            payload: { strategy_statement: "must remain blocked without exact evidence" }
          },
          method: "PUT",
          token: studentToken
        }
      );
      expect(missingEvidenceSave.status).toBe(409);
      expect(missingEvidenceSave.body.code).toBe("STUDENT_DECISION_CONTEXT_EVIDENCE_REQUIRED");

      const mismatchedEvidenceSave = await request(
        baseUrl,
        "/api/v1/bff/student/role-workspace/section",
        {
          body: {
            decision_context_evidence_id: `${decisionContextEvidenceId}-mismatch`,
            round_id: M2P3_ROUND_ID,
            run_id: M2P3_RUN_ID,
            team_id: "team_alpha",
            expected_version: 0,
            payload: { strategy_statement: "must remain blocked for mismatched evidence" }
          },
          method: "PUT",
          token: studentToken
        }
      );
      expect(mismatchedEvidenceSave.status).toBe(409);
      expect(mismatchedEvidenceSave.body.code).toBe("STUDENT_DECISION_CONTEXT_EVIDENCE_REQUIRED");

      const admittedEvidenceSave = await request(
        baseUrl,
        "/api/v1/bff/student/role-workspace/section",
        {
          body: {
            decision_context_evidence_id: decisionContextEvidenceId,
            round_id: M2P3_ROUND_ID,
            run_id: M2P3_RUN_ID,
            team_id: "team_alpha",
            expected_version: 0,
            payload: { strategy_statement: "exact source-backed context admitted" }
          },
          method: "PUT",
          token: studentToken
        }
      );
      expect(admittedEvidenceSave.status).toBe(200);

      const studentCockpit = await request<{
        project_context: {
          exact_scope: { team_id: string; run_id: string };
          project_profile_reference: { project_profile_id: string };
        };
      }>(baseUrl, `/api/v1/bff/student/runs/${M2P3_RUN_ID}/rounds/1/cockpit`, {
        token: studentToken
      });
      expect(studentCockpit.status, JSON.stringify(studentCockpit.body)).toBe(200);
      expect(studentCockpit.body.data.project_context).toMatchObject({
        exact_scope: { team_id: "team_alpha", run_id: M2P3_RUN_ID },
        project_profile_reference: { project_profile_id: M2P3_PROFILE_ID }
      });
      expect(JSON.stringify(studentCockpit.body.data.project_context)).not.toMatch(
        /state_true|score|rank|settlement_result/i
      );

      const studentBetaToken = await login(baseUrl, "student_beta");
      const studentBetaContext = await request<{ scope: { team_id: string } }>(
        baseUrl,
        `/api/v1/bff/student/project-aware-context?course_id=course_demo&run_id=${M2P3_RUN_ID}&team_id=team_beta`,
        { token: studentBetaToken }
      );
      expect(studentBetaContext.status).toBe(200);
      expect(studentBetaContext.body.data.scope.team_id).toBe("team_beta");

      const crossTeam = await request(
        baseUrl,
        `/api/v1/bff/student/project-aware-context?course_id=course_demo&run_id=${M2P3_RUN_ID}&team_id=team_beta`,
        { token: studentToken }
      );
      expect(crossTeam.status).toBe(403);

      const adminToken = await login(baseUrl, "admin");
      const audit = await request<{ readiness: { state: string }; lineage: unknown[] }>(
        baseUrl,
        `/api/v1/bff/admin/project-aware-audit?course_id=course_demo&run_id=${M2P3_RUN_ID}`,
        { token: adminToken }
      );
      expect(audit.status, JSON.stringify(audit.body)).toBe(200);
      expect(audit.body.data.readiness.state).toBe("READY");
      expect(audit.body.data.lineage).toHaveLength(2);
    } finally {
      server.close();
      rmSync(directory, { recursive: true, force: true });
    }
  }, 15_000);
});
