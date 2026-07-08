import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ActorRole,
  ApiEnvelope,
  ApiErrorEnvelope,
  AuditLog,
  AuthSession,
  Course,
  Decision,
  DecisionPayload,
  P0DemoState,
  PublicResultView,
  Round,
  Run,
  SettlementResult,
  Team,
  User
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store } from "../../services/api/src/store";

const DEMO_TENANT_ID = "tenant_demo";
const OTHER_TENANT_ID = "tenant_other";
const PLATFORM_TENANT_ID = "tenant_platform";
const SERVICE_KERNEL_TOKEN = "test-internal-service-token";

type EvidenceType =
  | "BROWSER_SMOKE"
  | "CODEGRAPH"
  | "CONTRACT"
  | "DOC"
  | "GRAPHIFY"
  | "LOCAL_TEST"
  | "REMOTE_CHECK"
  | "RUNTIME_ENTRYPOINT"
  | "SECURITY_SCAN"
  | "SOURCE_READ";

type GateStatus = "PASS" | "PASS_WITH_LIMITATION";

interface RehearsalGateRow {
  capability: string;
  currentEvidence: string;
  evidenceType: EvidenceType;
  expiry: string;
  freshness: string;
  gate: string;
  noGoCondition: string;
  nonProof: string;
  owner: string;
  requiredFollowUp: string;
  severity: "P0" | "P1" | "P2";
  status: GateStatus;
}

function createDecisionPayload(label: string, price: number): DecisionPayload {
  return {
    pricing: { base_price: price },
    marketing_budget: 180000,
    service_quality_budget: 160000,
    capacity_plan: "expand",
    cash_buffer_target: 0.16,
    strategy_statement: label
  };
}

async function startServer(): Promise<{ baseUrl: string; server: Server }> {
  const server = createApiServer(createP1Store());
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("test server did not bind to a TCP port");
  }

  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

async function request<TBody>(
  baseUrl: string,
  path: string,
  options: {
    body?: unknown;
    method?: string;
    requestId?: string;
    servicePrincipal?: string;
    tenantId?: string;
    token?: string;
  } = {}
): Promise<{ body: TBody; headers: Headers; status: number }> {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": options.tenantId ?? DEMO_TENANT_ID
  });

  if (options.requestId) {
    headers.set("x-request-id", options.requestId);
  }

  if (options.token) {
    headers.set("authorization", `Bearer ${options.token}`);
  }

  if (options.servicePrincipal) {
    headers.set("x-service-principal", options.servicePrincipal);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers,
    method: options.method ?? "GET"
  });

  return {
    body: (await response.json()) as TBody,
    headers: response.headers,
    status: response.status
  };
}

async function login(
  baseUrl: string,
  username: string,
  password: string,
  tenantId = DEMO_TENANT_ID
): Promise<AuthSession> {
  const response = await request<ApiEnvelope<AuthSession>>(baseUrl, "/api/v1/auth/login", {
    body: { password, username },
    method: "POST",
    tenantId
  });

  expect(response.status).toBe(200);
  return response.body.data;
}

function assertError(
  response: { body: ApiErrorEnvelope; status: number },
  status: number,
  code: string
): void {
  expect(response.status).toBe(status);
  expect(response.body.code).toBe(code);
}

function assertSerializedDoesNotContain(value: unknown, forbiddenMarkers: string[]): void {
  const serialized = JSON.stringify(value);

  for (const marker of forbiddenMarkers) {
    expect(serialized).not.toContain(marker);
  }
}

function countAuditAction(logs: AuditLog[], action: string): number {
  return logs.filter((log) => log.action === action).length;
}

function assertNoUnknownPass(rows: RehearsalGateRow[]): void {
  for (const row of rows) {
    expect(row.status).not.toBe("UNKNOWN");
    expect(row.currentEvidence).not.toBe("UNKNOWN");
  }
}

function createGateMatrix(input: {
  auditActions: string[];
  remoteChecksCommit: string;
  studentResult: PublicResultView;
  teacherResult: PublicResultView;
}): RehearsalGateRow[] {
  const common = {
    expiry: "NEXT_MASTER_CHANGE_OR_2026-07-15",
    freshness: "CURRENT_POSTMERGE_LOCAL_RUN",
    owner: "Marshall",
    requiredFollowUp: "independent evidence review before any release decision"
  } as const;

  return [
    {
      ...common,
      capability: "repository governance and current checks",
      currentEvidence: `PR213 merged to master; required checks were pass on ${input.remoteChecksCommit}`,
      evidenceType: "REMOTE_CHECK",
      gate: "G0 repository governance",
      noGoCondition:
        "required checks fail, source integrity drift, closeout keyword, or protected main workspace use",
      nonProof: "remote checks and ordinary merge do not grant G0 PASS",
      severity: "P0",
      status: "PASS_WITH_LIMITATION"
    },
    {
      ...common,
      capability: "quality baseline",
      currentEvidence: "post-merge baseline and Program 030 local validation commands",
      evidenceType: "LOCAL_TEST",
      gate: "G1 quality baseline",
      noGoCondition: "format, lint, typecheck, full test, e2e or build failure",
      nonProof: "local validation is not remote CI proof",
      severity: "P0",
      status: "PASS"
    },
    {
      ...common,
      capability: "source integrity",
      currentEvidence: "hidden Unicode scan and changed-file byte scan",
      evidenceType: "SOURCE_READ",
      gate: "G2 source integrity",
      noGoCondition: "hidden control character, Bidi marker or diff allowlist drift",
      nonProof: "source scan is not runtime proof",
      severity: "P0",
      status: "PASS"
    },
    {
      ...common,
      capability: "security, tenant and projection boundary",
      currentEvidence:
        "truth-payload denial, cross-team denial, cross-tenant denial and student redaction",
      evidenceType: "RUNTIME_ENTRYPOINT",
      gate: "G3 security / tenant / projection",
      noGoCondition:
        "student sees protected truth, private replay evidence, other team or other tenant data",
      nonProof: "runtime guard is not complete security proof",
      severity: "P0",
      status: "PASS"
    },
    {
      ...common,
      capability: "controlled runtime entrypoint",
      currentEvidence: input.auditActions.join(","),
      evidenceType: "RUNTIME_ENTRYPOINT",
      gate: "G4 runtime entrypoint",
      noGoCondition: "primary path requires helper-only mutation or direct store write",
      nonProof: "controlled HTTP guard is not L1 READY",
      severity: "P0",
      status: "PASS"
    },
    {
      ...common,
      capability: "teaching flow",
      currentEvidence: `${input.studentResult.classroom_debrief_prompts.length} debrief prompts and redacted student result`,
      evidenceType: "RUNTIME_ENTRYPOINT",
      gate: "G5 teaching flow",
      noGoCondition: "student feedback includes protected truth or formal grade claim",
      nonProof: "synthetic feedback is not real teacher rehearsal",
      severity: "P1",
      status: "PASS_WITH_LIMITATION"
    },
    {
      ...common,
      capability: "replay and shadow replay non-overwrite",
      currentEvidence: `teacher replay evidence status=${input.teacherResult.replay_evidence?.replay_status}; no shadow replay HTTP route present`,
      evidenceType: "RUNTIME_ENTRYPOINT",
      gate: "G6 replay / shadow replay",
      noGoCondition: "replay or shadow replay overwrites the official result",
      nonProof: "matched replay evidence is not durable recovery or shadow replay route proof",
      severity: "P1",
      status: "PASS_WITH_LIMITATION"
    },
    {
      ...common,
      capability: "operator readiness",
      currentEvidence: "internal validation rehearsal gate draft only",
      evidenceType: "DOC",
      gate: "G7 operational readiness",
      noGoCondition: "operator document claims release, Pilot, Production or PostgreSQL readiness",
      nonProof: "internal draft is not released operator kit",
      severity: "P1",
      status: "PASS_WITH_LIMITATION"
    },
    {
      ...common,
      capability: "R8-G1 internal-only rehearsal kit",
      currentEvidence: "Go / No-Go package remains INTERNAL_ONLY_DRAFT",
      evidenceType: "DOC",
      gate: "R8-G1 internal-only rehearsal kit",
      noGoCondition: "draft is used as real teacher rehearsal or customer trial",
      nonProof: "R8-G1 draft is not released",
      severity: "P1",
      status: "PASS_WITH_LIMITATION"
    }
  ];
}

describe("L1 internal validation rehearsal gate", () => {
  it("builds a Go / No-Go gate from real controlled API entrypoints without release claims", async () => {
    const protectedSentinel = "l1-rehearsal-protected-truth-sentinel";
    const { baseUrl, server } = await startServer();

    try {
      const teacher = await login(baseUrl, "teacher", "teacher");
      const tenantAdmin = await login(baseUrl, "admin", "admin");
      const studentAlpha = await login(baseUrl, "student", "student");
      const otherTeacher = await login(baseUrl, "other_teacher", "teacher", OTHER_TENANT_ID);
      const platformAdmin = await login(baseUrl, "platform", "platform", PLATFORM_TENANT_ID);

      const betaUser = await request<ApiEnvelope<User>>(baseUrl, "/api/v1/admin/users", {
        body: {
          display_name: "Rehearsal Beta Student",
          email: "rehearsal-beta-student@example.test",
          password: "student_beta_rehearsal",
          roles: ["learner", "team_captain"] satisfies ActorRole[],
          tenant_id: DEMO_TENANT_ID,
          username: "rehearsal_beta_student"
        },
        method: "POST",
        requestId: "req_l1_rehearsal_user_beta",
        token: tenantAdmin.access_token
      });
      expect(betaUser.status).toBe(201);
      const studentBeta = await login(baseUrl, "rehearsal_beta_student", "student_beta_rehearsal");

      const courseResponse = await request<ApiEnvelope<Course>>(baseUrl, "/api/v1/courses", {
        body: { title: "L1 Internal Validation Rehearsal Gate Course" },
        method: "POST",
        requestId: "req_l1_rehearsal_course_create",
        token: teacher.access_token
      });
      expect(courseResponse.status).toBe(201);
      expect(courseResponse.body.data.status).toBe("draft");
      expect(courseResponse.body.data.scenario_package_id).toBe("scenario_eldercare_demo");
      expect(courseResponse.body.data.parameter_set_id).toBe("param_toy_approved_1");
      const course = courseResponse.body.data;

      const alphaTeam = await request<ApiEnvelope<Team>>(
        baseUrl,
        `/api/v1/courses/${course.course_id}/teams`,
        {
          body: {
            captain_user_id: studentAlpha.user.user_id,
            name: "Alpha Rehearsal Team"
          },
          method: "POST",
          requestId: "req_l1_rehearsal_team_alpha",
          token: teacher.access_token
        }
      );
      expect(alphaTeam.status).toBe(201);

      const betaTeam = await request<ApiEnvelope<Team>>(
        baseUrl,
        `/api/v1/courses/${course.course_id}/teams`,
        {
          body: {
            captain_user_id: betaUser.body.data.user_id,
            name: "Beta Rehearsal Team"
          },
          method: "POST",
          requestId: "req_l1_rehearsal_team_beta",
          token: teacher.access_token
        }
      );
      expect(betaTeam.status).toBe(201);

      const deniedBind = await request<ApiErrorEnvelope>(
        baseUrl,
        `/api/v1/courses/${course.course_id}/teams`,
        {
          body: {
            captain_user_id: betaUser.body.data.user_id,
            name: "Unauthorized Rehearsal Team"
          },
          method: "POST",
          requestId: "req_l1_rehearsal_team_bind_denied",
          token: studentAlpha.access_token
        }
      );
      assertError(deniedBind, 403, "AUTHZ-403-001");

      const publishedCourse = await request<ApiEnvelope<Course>>(
        baseUrl,
        `/api/v1/courses/${course.course_id}/publish`,
        {
          method: "POST",
          requestId: "req_l1_rehearsal_course_publish",
          token: teacher.access_token
        }
      );
      expect(publishedCourse.status).toBe(200);
      expect(publishedCourse.body.data.status).toBe("published");

      const duplicateCoursePublish = await request<ApiEnvelope<Course>>(
        baseUrl,
        `/api/v1/courses/${course.course_id}/publish`,
        {
          method: "POST",
          requestId: "req_l1_rehearsal_course_publish_duplicate",
          token: teacher.access_token
        }
      );
      expect(duplicateCoursePublish.status).toBe(200);

      const runResponse = await request<ApiEnvelope<{ round: Round; run: Run }>>(
        baseUrl,
        `/api/v1/courses/${course.course_id}/runs`,
        {
          method: "POST",
          requestId: "req_l1_rehearsal_run_create",
          token: teacher.access_token
        }
      );
      expect(runResponse.status).toBe(201);
      expect(runResponse.body.data.run.course_id).toBe(course.course_id);
      expect(runResponse.body.data.run.scenario_package_id).toBe(course.scenario_package_id);
      expect(runResponse.body.data.run.parameter_set_id).toBe(course.parameter_set_id);
      const run = runResponse.body.data.run;

      const openedRound = await request<ApiEnvelope<Round>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/start`,
        {
          method: "POST",
          requestId: "req_l1_rehearsal_round_start",
          token: teacher.access_token
        }
      );
      expect(openedRound.status).toBe(200);
      expect(openedRound.body.data.status).toBe("open");

      const deniedLock = await request<ApiErrorEnvelope>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/lock`,
        {
          method: "POST",
          requestId: "req_l1_rehearsal_lock_denied",
          token: studentAlpha.access_token
        }
      );
      assertError(deniedLock, 403, "AUTHZ-403-001");

      const deniedTruthPayload = await request<ApiErrorEnvelope>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: {
              ...createDecisionPayload("Denied truth payload.", 12800),
              state_true: { protected_marker: protectedSentinel }
            },
            team_id: alphaTeam.body.data.team_id
          },
          method: "POST",
          requestId: "req_l1_rehearsal_truth_denied",
          token: studentAlpha.access_token
        }
      );
      assertError(deniedTruthPayload, 403, "TRUTH-403-001");
      assertSerializedDoesNotContain(deniedTruthPayload.body, [protectedSentinel]);

      const deniedCrossTeam = await request<ApiErrorEnvelope>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: createDecisionPayload("Cross team should fail.", 13100),
            team_id: betaTeam.body.data.team_id
          },
          method: "POST",
          requestId: "req_l1_rehearsal_cross_team_denied",
          token: studentAlpha.access_token
        }
      );
      assertError(deniedCrossTeam, 403, "TEAM-403-001");

      const alphaPayload = createDecisionPayload("Alpha rehearsal decision.", 12600);
      const alphaDecision = await request<ApiEnvelope<Decision>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: alphaPayload,
            team_id: alphaTeam.body.data.team_id
          },
          method: "POST",
          requestId: "req_l1_rehearsal_alpha_decision",
          token: studentAlpha.access_token
        }
      );
      expect(alphaDecision.status).toBe(201);

      const duplicateDecision = await request<ApiEnvelope<Decision>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: alphaPayload,
            team_id: alphaTeam.body.data.team_id
          },
          method: "POST",
          requestId: "req_l1_rehearsal_alpha_decision",
          token: studentAlpha.access_token
        }
      );
      expect(duplicateDecision.status).toBe(201);
      expect(duplicateDecision.body.data.decision_id).toBe(alphaDecision.body.data.decision_id);

      const betaDecision = await request<ApiEnvelope<Decision>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/decisions`,
        {
          body: {
            decision_payload: createDecisionPayload("Beta rehearsal decision.", 12400),
            team_id: betaTeam.body.data.team_id
          },
          method: "POST",
          requestId: "req_l1_rehearsal_beta_decision",
          token: studentBeta.access_token
        }
      );
      expect(betaDecision.status).toBe(201);

      const lockedRound = await request<ApiEnvelope<Round>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/lock`,
        {
          method: "POST",
          requestId: "req_l1_rehearsal_round_lock",
          token: teacher.access_token
        }
      );
      expect(lockedRound.status).toBe(200);
      expect(lockedRound.body.data.status).toBe("locked");

      const duplicateLock = await request<ApiEnvelope<Round>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/lock`,
        {
          method: "POST",
          requestId: "req_l1_rehearsal_round_lock_duplicate",
          token: teacher.access_token
        }
      );
      expect(duplicateLock.status).toBe(200);
      expect(duplicateLock.body.data.status).toBe("locked");

      const settlement = await request<ApiEnvelope<SettlementResult>>(
        baseUrl,
        `/internal/v1/runs/${run.run_id}/rounds/1/settle`,
        {
          method: "POST",
          requestId: "req_l1_rehearsal_internal_settle",
          servicePrincipal: "service_kernel",
          token: SERVICE_KERNEL_TOKEN
        }
      );
      expect(settlement.status).toBe(200);
      expect(settlement.headers.get("x-simwar-settlement-outcome")).toBe("committed");
      expect(settlement.body.data.team_results).toHaveLength(2);
      const replayHash = settlement.body.data.replay_hash;
      const officialResultId = settlement.body.data.settlement_result_id;

      const duplicateSettlement = await request<ApiEnvelope<SettlementResult>>(
        baseUrl,
        `/internal/v1/runs/${run.run_id}/rounds/1/settle`,
        {
          method: "POST",
          requestId: "req_l1_rehearsal_internal_settle_duplicate",
          servicePrincipal: "service_kernel",
          token: SERVICE_KERNEL_TOKEN
        }
      );
      expect(duplicateSettlement.status).toBe(200);
      expect(duplicateSettlement.headers.get("x-simwar-settlement-outcome")).toBe("reused");
      expect(duplicateSettlement.body.data.replay_hash).toBe(replayHash);
      expect(duplicateSettlement.body.data.settlement_result_id).toBe(officialResultId);

      const publishedRound = await request<ApiEnvelope<Round>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/publish`,
        {
          method: "POST",
          requestId: "req_l1_rehearsal_round_publish",
          token: teacher.access_token
        }
      );
      expect(publishedRound.status).toBe(200);
      expect(publishedRound.body.data.status).toBe("published");

      const duplicatePublish = await request<ApiEnvelope<Round>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/publish`,
        {
          method: "POST",
          requestId: "req_l1_rehearsal_round_publish_duplicate",
          token: teacher.access_token
        }
      );
      expect(duplicatePublish.status).toBe(200);
      expect(duplicatePublish.body.data.status).toBe("published");

      const studentResult = await request<ApiEnvelope<PublicResultView>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/results`,
        {
          token: studentAlpha.access_token
        }
      );
      expect(studentResult.status).toBe(200);
      expect(studentResult.body.data.results).toHaveLength(1);
      expect(studentResult.body.data.results[0]?.team_id).toBe(alphaTeam.body.data.team_id);
      expect(studentResult.body.data.classroom_debrief_prompts.length).toBeGreaterThan(0);
      expect(studentResult.body.data.result_label).toContain("Official");
      expect(studentResult.body.data.replay_hash).toBe(replayHash);
      expect(studentResult.body.data.replay_evidence).toBeUndefined();
      assertSerializedDoesNotContain(studentResult.body.data, [
        "state_true",
        betaTeam.body.data.team_id,
        "canonical_evidence_digest",
        "private_replay"
      ]);

      const teacherResult = await request<ApiEnvelope<PublicResultView>>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/results`,
        {
          token: teacher.access_token
        }
      );
      expect(teacherResult.status).toBe(200);
      expect(teacherResult.body.data.results.map((result) => result.team_id).sort()).toEqual(
        [alphaTeam.body.data.team_id, betaTeam.body.data.team_id].sort()
      );
      expect(teacherResult.body.data.replay_evidence?.replay_status).toBe("matched");
      expect(teacherResult.body.data.replay_evidence?.replay_writes_formal_results).toBe(false);
      expect(JSON.stringify(teacherResult.body.data)).toContain("state_true");

      const demoState = await request<ApiEnvelope<P0DemoState>>(baseUrl, "/api/v1/demo-state", {
        token: tenantAdmin.access_token
      });
      expect(demoState.status).toBe(200);
      expect(demoState.body.data.current_user.tenant_id).toBe(DEMO_TENANT_ID);
      expect(demoState.body.data.courses.some((item) => item.course_id === course.course_id)).toBe(
        true
      );

      const platformAudit = await request<ApiEnvelope<AuditLog[]>>(
        baseUrl,
        `/api/v1/audit/logs?tenant_id=${DEMO_TENANT_ID}`,
        {
          tenantId: PLATFORM_TENANT_ID,
          token: platformAdmin.access_token
        }
      );
      expect(platformAudit.status).toBe(200);
      expect(platformAudit.body.data.every((log) => log.tenant_id === DEMO_TENANT_ID)).toBe(true);

      const crossTenantResult = await request<ApiErrorEnvelope>(
        baseUrl,
        `/api/v1/runs/${run.run_id}/rounds/1/results`,
        {
          tenantId: DEMO_TENANT_ID,
          token: otherTeacher.access_token
        }
      );
      assertError(crossTenantResult, 403, "TENANT-403-001");

      const audit = await request<ApiEnvelope<AuditLog[]>>(baseUrl, "/api/v1/audit/logs", {
        token: tenantAdmin.access_token
      });
      expect(audit.status).toBe(200);
      expect(countAuditAction(audit.body.data, "course.create")).toBe(1);
      expect(countAuditAction(audit.body.data, "course.publish")).toBe(1);
      expect(countAuditAction(audit.body.data, "team.create")).toBe(2);
      expect(countAuditAction(audit.body.data, "run.create")).toBe(1);
      expect(countAuditAction(audit.body.data, "round.start")).toBe(1);
      expect(countAuditAction(audit.body.data, "decision.submit")).toBe(2);
      expect(countAuditAction(audit.body.data, "round.lock")).toBe(1);
      expect(countAuditAction(audit.body.data, "round.settle")).toBe(1);
      expect(countAuditAction(audit.body.data, "round.publish")).toBe(1);

      const gateMatrix = createGateMatrix({
        auditActions: audit.body.data.map((log) => log.action),
        remoteChecksCommit: "6a540f8cd9fa2a49f3f267c6cfb223342cd4853b",
        studentResult: studentResult.body.data,
        teacherResult: teacherResult.body.data
      });
      assertNoUnknownPass(gateMatrix);
      expect(gateMatrix.map((row) => row.gate)).toEqual([
        "G0 repository governance",
        "G1 quality baseline",
        "G2 source integrity",
        "G3 security / tenant / projection",
        "G4 runtime entrypoint",
        "G5 teaching flow",
        "G6 replay / shadow replay",
        "G7 operational readiness",
        "R8-G1 internal-only rehearsal kit"
      ]);
      expect(gateMatrix.some((row) => row.status === "PASS_WITH_LIMITATION")).toBe(true);
      expect(JSON.stringify(gateMatrix)).not.toContain("NOT_AVAILABLE");
      assertSerializedDoesNotContain(gateMatrix, [
        "G0_PASS",
        "L1_READY",
        "PILOT_READY",
        "PRODUCTION_READY"
      ]);
    } finally {
      await stopServer(server);
    }
  });
});
