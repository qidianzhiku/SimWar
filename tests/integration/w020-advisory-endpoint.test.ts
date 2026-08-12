import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import {
  isW020AdvisoryReceipt,
  type ApiEnvelope,
  type AuthSession,
  type CurrentUser,
  type D2EvidenceArtifactVersion,
  type D2ProvenanceEdge,
  type TeachingClosureDto,
  type TeacherConfirmationVersion,
  type W020AdvisoryAuditDto,
  type W020AdvisoryReceipt
} from "@simwar/shared-contracts";
import { createGovernedAgentGateway } from "../../services/agent-gateway/src/index.js";
import { handleW020AdvisoryRoute } from "../../services/api/src/routes/w020-advisory-routes.js";
import { createApiServer } from "../../services/api/src/server.js";
import { createP1Store, type SimWarStore } from "../../services/api/src/store.js";
import { GovernedAdvisoryService } from "../../services/api/src/w020-advisory-service.js";

const actor: CurrentUser = {
  display_name: "Teacher",
  permissions: ["course:read"],
  roles: ["teacher"],
  tenant_id: "tenant_demo",
  user_id: "usr_teacher"
};

const student: CurrentUser = {
  display_name: "Student",
  permissions: ["course:read"],
  roles: ["student"],
  team_id: "team_001",
  tenant_id: "tenant_demo",
  user_id: "usr_student"
};

const sourceDigest = "a".repeat(64);

function w019Refs() {
  return {
    course: {
      content_digest: sourceDigest,
      discriminator: "exact_ref" as const,
      resource_id: "package_w020",
      resource_type: "course_package_version" as const,
      tenant_id: "tenant_demo",
      version: "1.0.0"
    },
    goal: {
      content_digest: sourceDigest,
      discriminator: "exact_ref" as const,
      resource_id: "goal_w020",
      resource_type: "learning_goal_version" as const,
      tenant_id: "tenant_demo",
      version: "1.0.0"
    },
    rubric: {
      content_digest: sourceDigest,
      discriminator: "exact_ref" as const,
      resource_id: "rubric_w020",
      resource_type: "rubric_version" as const,
      tenant_id: "tenant_demo",
      version: "1.0.0"
    },
    evidence: {
      content_digest: sourceDigest,
      discriminator: "exact_ref" as const,
      resource_id: "artifact_w020",
      resource_type: "evidence_artifact" as const,
      tenant_id: "tenant_demo",
      version: "1.0.0"
    },
    confirmation: {
      content_digest: sourceDigest,
      discriminator: "exact_ref" as const,
      resource_id: "confirmation_w020",
      resource_type: "teacher_confirmation_version" as const,
      tenant_id: "tenant_demo",
      version: "1.0.0"
    },
    event: {
      content_digest: sourceDigest,
      discriminator: "exact_ref" as const,
      resource_id: "event_w020_ready",
      resource_type: "role_workflow_event" as const,
      tenant_id: "tenant_demo",
      version: "1.0.0"
    },
    rule: {
      content_digest: sourceDigest,
      discriminator: "exact_ref" as const,
      resource_id: "rule_w020",
      resource_type: "transformation_rule" as const,
      tenant_id: "tenant_demo",
      version: "1.0.0"
    }
  };
}

function eligibleTeachingClosure(
  context: TeachingClosureDto["context"] = {
    activity_id: "activity_001",
    course_id: "course_001",
    role_key: "CEO",
    run_id: "run_001",
    team_id: "team_001"
  }
): TeachingClosureDto {
  return {
    context,
    course_report_available: true,
    export_formats: ["json", "markdown"],
    known_limits: ["Human Validation is not performed."],
    queue_item: {
      claim_status: "AVAILABLE",
      confirmation_status: "CONFIRMED",
      context,
      eligible_event_count: 1,
      evidence_count: 1,
      known_limits: ["Human Validation is not performed."],
      missing: [],
      outcome_status: "CONFIRMED"
    },
    runtime_authority: "JSON_INTERNAL_ONLY",
    schema_version: "teaching-closure.v1",
    student_safe_preview: {
      criterion_count: 1,
      evidence_count: 1,
      next_focus: "Review the confirmed criterion outcome with the student.",
      status: "CONFIRMED",
      visibility: "student_safe"
    }
  };
}

function workflowSnapshot() {
  return {
    course: {
      course_id: "course_001",
      tenant_id: "tenant_demo",
      title: "Course",
      status: "active",
      scenario_package_id: "scenario_001",
      parameter_set_id: "parameter_001",
      created_by: "usr_teacher"
    },
    run: {
      run_id: "run_001",
      course_id: "course_001",
      tenant_id: "tenant_demo",
      scenario_package_id: "scenario_001",
      parameter_set_id: "parameter_001",
      seed: 1,
      status: "completed"
    },
    round: {
      round_id: "round_001",
      run_id: "run_001",
      tenant_id: "tenant_demo",
      round_no: 1,
      status: "published"
    },
    team: {
      team_id: "team_001",
      course_id: "course_001",
      tenant_id: "tenant_demo",
      name: "Team",
      captain_user_id: "usr_student",
      members: []
    },
    assignments: [
      {
        assignment_id: "assignment_001",
        role_key: "CEO",
        status: "active",
        user_id: "usr_student"
      }
    ],
    sections: [],
    merge_commits: [],
    confirmations: [],
    decisions: [],
    events: [
      {
        created_at: "2026-08-09T00:00:00.000Z",
        event_id: "event_001",
        event_type: "section_saved",
        round_id: "round_001"
      }
    ]
  };
}

function response() {
  return {
    statusCode: 0,
    body: "",
    writeHead(status: number) {
      this.statusCode = status;
    },
    end(body: string) {
      this.body = body;
    }
  };
}

function seedHttpJourney(store: SimWarStore): void {
  const refs = w019Refs();
  store.runs.push({
    course_id: "course_demo",
    parameter_set_id: "param_toy_approved_1",
    run_id: "run_w020",
    scenario_package_id: "scenario_eldercare_demo",
    seed: 20,
    status: "completed",
    tenant_id: "tenant_demo"
  });
  store.rounds.push({
    round_id: "round_w020",
    round_no: 1,
    run_id: "run_w020",
    status: "published",
    tenant_id: "tenant_demo"
  });
  store.studentRoleAssignments.push({
    assigned_at: "2026-08-09T00:00:00.000Z",
    assigned_by: "usr_teacher",
    assignment_id: "assignment_w020",
    course_id: "course_demo",
    role_key: "CEO",
    role_template_id: "role_template_ceo_v1",
    run_id: "run_w020",
    source: "teacher_assigned",
    status: "active",
    team_id: "team_alpha",
    tenant_id: "tenant_demo",
    user_id: "usr_student"
  });
  store.roleWorkflowEvents.push({
    actor_id: "usr_student",
    created_at: "2026-08-09T00:00:00.000Z",
    event_id: "event_w020_ready",
    event_type: "section_ready",
    resource_id: "section_w020",
    round_id: "round_w020",
    run_id: "run_w020",
    team_id: "team_alpha",
    tenant_id: "tenant_demo"
  });
  store.settlementResults.push({
    parameter_set_id: "param_toy_approved_1",
    replay_hash: "b".repeat(64),
    round_id: "round_w020",
    round_no: 1,
    run_id: "run_w020",
    scenario_package_id: "scenario_eldercare_demo",
    settlement_result_id: "result_w020",
    team_results: [
      {
        state_est: {
          explanation: "internal only",
          next_round_risk: "balanced",
          recommended_focus: "observe"
        },
        state_obs: {
          demand_band: "medium",
          profit_band: "healthy",
          rank: 1,
          revenue: 1200,
          score: 88,
          served_demand: 40
        },
        state_true: {
          cash_flow: 300,
          cost: 800,
          demand: 43,
          market_share: 0.6,
          profit: 400,
          rank: 1,
          revenue: 1200,
          score: 88,
          served_demand: 40,
          settlement_status: "settled"
        },
        team_id: "team_alpha",
        team_name: "Alpha 康养队"
      }
    ],
    tenant_id: "tenant_demo"
  });
  const artifact: D2EvidenceArtifactVersion = {
    artifact_digest: sourceDigest,
    artifact_kind: "observation",
    artifact_ref: refs.evidence,
    captured_at: "2026-08-09T00:00:00.000Z",
    captured_by: "usr_teacher",
    context: {
      activity_id: "activity_w020",
      course_id: "course_demo",
      role_key: "CEO",
      run_id: "run_w020",
      team_id: "team_alpha"
    },
    course_package_ref: refs.course,
    discriminator: "d2_evidence_artifact_version",
    idempotency_key: "artifact_idem_w020",
    known_limits: ["teacher_only"],
    learning_goal_ref: refs.goal,
    rubric_ref: refs.rubric,
    schema_version: "evidence-provenance.v1",
    source_event_ref: refs.event,
    transformation_rule_ref: refs.rule,
    visibility: "teacher_only"
  };
  const edge: D2ProvenanceEdge = {
    discriminator: "d2_provenance_edge",
    relation: "derived_from",
    source_ref: refs.event,
    target_ref: refs.evidence
  };
  const confirmation: TeacherConfirmationVersion = {
    audit_receipt: {
      action: "teacher_confirmation.confirm",
      actor_id: "usr_teacher",
      audit_id: "audit_w020_confirmation",
      recorded_at: "2026-08-09T00:00:00.000Z",
      request_id: "request_w020_confirmation"
    },
    confirmation_ref: refs.confirmation,
    content_digest: sourceDigest,
    context: {
      course_id: "course_demo",
      role_key: "CEO",
      run_id: "run_w020",
      team_id: "team_alpha"
    },
    course_package_ref: refs.course,
    created_at: "2026-08-09T00:00:00.000Z",
    created_by: "usr_teacher",
    criterion_decisions: [{ criterion_id: "criterion_w020", level_ordinal: 2 }],
    discriminator: "teacher_confirmation_version",
    evidence_refs: [refs.evidence],
    idempotency_key: "idem_confirmation_w020",
    known_limits: ["D3 teacher-only"],
    learning_goal_ref: refs.goal,
    rubric_ref: refs.rubric,
    schema_version: "teacher-confirmation.v1",
    status: "CONFIRMED",
    teacher_feedback: "Private teacher note must not be exposed."
  };
  store.evidenceArtifacts.push(artifact);
  store.evidenceProvenanceEdges.push(edge);
  store.teacherConfirmationVersions.push(confirmation);
}

async function startHttpJourney(): Promise<{
  baseUrl: string;
  server: Server;
  store: SimWarStore;
}> {
  const store = createP1Store();
  seedHttpJourney(store);
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("W020 test server did not bind");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

async function requestJson<T>(
  baseUrl: string,
  path: string,
  options: { body?: unknown; method?: string; tenantId?: string; token?: string } = {}
): Promise<{ body: ApiEnvelope<T>; status: number }> {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": options.tenantId ?? "tenant_demo"
  });
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    method: options.method ?? "GET"
  });
  return {
    body: (await response.json()) as ApiEnvelope<T>,
    status: response.status
  };
}

async function login(baseUrl: string, username: string, tenantId = "tenant_demo"): Promise<string> {
  const result = await requestJson<AuthSession>(baseUrl, "/api/v1/auth/login", {
    body: { password: username === "other_teacher" ? "teacher" : username, username },
    method: "POST",
    tenantId
  });
  expect(result.status).toBe(200);
  return result.body.data.access_token;
}

describe("W020 advisory BFF routes", () => {
  it("runs real authenticated Student and Teacher journeys with tenant and RBAC fail-closed gates", async () => {
    const { baseUrl, server, store } = await startHttpJourney();
    const settlementBefore = structuredClone(store.settlementResults);
    try {
      const studentToken = await login(baseUrl, "student");
      const teacherToken = await login(baseUrl, "teacher");
      const studentRequest = {
        discriminator: "w020_advisory_request",
        idempotency_key: "idem_http_student",
        role_key: "CEO",
        round_id: "round_w020",
        run_id: "run_w020",
        surface: "student_role",
        team_id: "team_alpha"
      };
      const studentResult = await requestJson<W020AdvisoryReceipt>(
        baseUrl,
        "/api/v1/bff/student/advisors/role",
        { body: studentRequest, method: "POST", token: studentToken }
      );
      expect(studentResult.status).toBe(201);
      expect(isW020AdvisoryReceipt(studentResult.body.data)).toBe(true);
      expect(studentResult.body.data.projection.surface).toBe("student_role");
      expect(studentResult.body.data.formal_truth_write).toBe(false);
      expect(studentResult.body.data.context.activity_id).toBeUndefined();
      expect(studentResult.body.data.context.teacher_safe_source).toBeUndefined();
      expect(studentResult.body.data.projection.teacher_debrief).toBeUndefined();
      expect(studentResult.body.data.context).toMatchObject({
        course_id: "course_demo",
        role_key: "CEO",
        round_id: "round_w020",
        run_id: "run_w020",
        team_id: "team_alpha",
        tenant_id: "tenant_demo"
      });
      expect(JSON.stringify(studentResult.body)).not.toMatch(
        /"model_call_log"\s*:|"coach_output"\s*:|"provider"\s*:|"model"\s*:|raw_prompt|raw_payload|SettlementResult|replay_hash/i
      );

      const teacherResult = await requestJson<W020AdvisoryReceipt>(
        baseUrl,
        "/api/v1/bff/teacher/advisors/debrief",
        {
          body: {
            discriminator: "w020_advisory_request",
            activity_id: "activity_w020",
            idempotency_key: "idem_http_teacher",
            role_key: "CEO",
            round_id: "round_w020",
            run_id: "run_w020",
            surface: "teacher_debrief",
            team_id: "team_alpha"
          },
          method: "POST",
          token: teacherToken
        }
      );
      expect(teacherResult.status).toBe(201);
      expect(isW020AdvisoryReceipt(teacherResult.body.data)).toBe(true);
      expect(teacherResult.body.data.projection.teacher_debrief).toMatchObject({
        activity_id: "activity_w020",
        role_key: "CEO"
      });
      expect(teacherResult.body.data.context.teacher_safe_source).toMatchObject({
        activity_id: "activity_w020",
        confirmation_status: "CONFIRMED",
        course_report_available: true,
        eligible_event_count: 1,
        evidence_count: 1,
        missing: [],
        outcome_status: "CONFIRMED",
        role_key: "CEO",
        runtime_authority: "JSON_INTERNAL_ONLY",
        source_schema_version: "teaching-closure.v1",
        student_safe_preview: {
          criterion_count: 1,
          evidence_count: 1,
          next_focus: "Review the confirmed criterion outcome with the student.",
          status: "CONFIRMED",
          visibility: "student_safe"
        }
      });
      expect(JSON.stringify(teacherResult.body)).not.toMatch(
        /raw_prompt|raw_payload|model_call_log/i
      );

      const audit = await requestJson<{
        entries: W020AdvisoryAuditDto[];
        known_limits: string[];
      }>(baseUrl, "/api/v1/bff/teacher/advisors/audit", { token: teacherToken });
      expect(audit.status).toBe(200);
      expect(audit.body.data.entries).toHaveLength(2);
      expect(audit.body.data.entries[0]).toMatchObject({ provider: "deterministic-mock" });
      expect(JSON.stringify(audit.body)).not.toMatch(/raw_prompt|raw_payload|advisory_text/i);

      const studentOnTeacherRoute = await requestJson<{ code: string }>(
        baseUrl,
        "/api/v1/bff/teacher/advisors/debrief",
        {
          body: {
            ...studentRequest,
            activity_id: "activity_w020",
            idempotency_key: "idem_http_forbidden",
            surface: "teacher_debrief"
          },
          method: "POST",
          token: studentToken
        }
      );
      expect(studentOnTeacherRoute.status).toBe(403);
      expect(studentOnTeacherRoute.body.data.code).toBe("W020_FORBIDDEN");

      const teacherOnStudentRoute = await requestJson<{ code: string }>(
        baseUrl,
        "/api/v1/bff/student/advisors/role",
        {
          body: { ...studentRequest, idempotency_key: "idem_http_teacher_forbidden" },
          method: "POST",
          token: teacherToken
        }
      );
      expect(teacherOnStudentRoute.status).toBe(403);
      expect(teacherOnStudentRoute.body.data.code).toBe("W020_FORBIDDEN");

      const crossTenant = await requestJson<unknown>(baseUrl, "/api/v1/bff/student/advisors/role", {
        body: { ...studentRequest, idempotency_key: "idem_http_cross_tenant" },
        method: "POST",
        tenantId: "tenant_other",
        token: studentToken
      });
      expect(crossTenant.status).toBe(403);
      expect(crossTenant.body.code).toBe("TENANT-403-001");
      expect(store.governedAdvisoryRecords).toHaveLength(2);
      expect(store.settlementResults).toEqual(settlementBefore);
      expect(store.decisions).toHaveLength(0);
    } finally {
      await stopServer(server);
    }
  });

  it("keeps student surface separate from teacher audit and returns safe projection", async () => {
    const records: never[] = [];
    const audits: never[] = [];
    const service = new GovernedAdvisoryService({
      repository: {
        list: async () => records,
        listAudit: async () => audits,
        appendAudit: async (audit) => {
          audits.push(audit as never);
        },
        appendSuccess: async (command) => {
          records.push(command.record as never);
          audits.push(command.audit as never);
        }
      },
      roleWorkflow: {
        readRoleWorkflow: () => ({
          course: { course_id: "course_001" },
          run: { tenant_id: "tenant_demo" },
          round: { round_id: "round_001" },
          team: { tenant_id: "tenant_demo" },
          assignments: [],
          sections: [],
          merge_commits: [],
          confirmations: [],
          decisions: [],
          events: []
        }),
        commitRoleWorkflow: () => undefined
      } as never,
      teachingClosure: { get: async () => eligibleTeachingClosure() }
    });
    const res = response();
    const helpers = {
      readJson: async () => ({
        discriminator: "w020_advisory_request",
        surface: "teacher_debrief",
        run_id: "run_001",
        round_id: "round_001",
        team_id: "team_001",
        idempotency_key: "idem_001"
      }),
      sendJson: (_target: unknown, status: number, payload: unknown) => {
        res.writeHead(status);
        res.end(JSON.stringify(payload));
      },
      createEnvelope: (_context: unknown, payload: unknown) => ({ code: "OK", data: payload }),
      requireStudent: () => undefined,
      requireTeacher: () => undefined
    };
    const handled = await handleW020AdvisoryRoute(
      service,
      { method: "GET" } as never,
      res as never,
      new URL("http://localhost/api/v1/bff/teacher/advisors/audit"),
      { requestId: "req_1", tenantId: "tenant_demo", actor },
      helpers
    );
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain("raw_prompt");
  });

  it("returns a stable provider failure while retaining only bounded teacher audit", async () => {
    const records: never[] = [];
    const audits: never[] = [];
    const service = new GovernedAdvisoryService({
      gateway: createGovernedAgentGateway({
        model: "throwing-model",
        provider: "throwing-provider",
        generate: () => {
          throw new Error("private provider failure");
        }
      }),
      repository: {
        list: async () => records,
        listAudit: async () => audits,
        appendAudit: async (audit) => {
          audits.push(audit as never);
        },
        appendSuccess: async (command) => {
          records.push(command.record as never);
          audits.push(command.audit as never);
        }
      },
      roleWorkflow: {
        readRoleWorkflow: () => workflowSnapshot(),
        commitRoleWorkflow: () => undefined
      },
      teachingClosure: { get: async () => eligibleTeachingClosure() }
    });
    const res = response();
    const helpers = {
      readJson: async () => ({
        discriminator: "w020_advisory_request",
        surface: "teacher_debrief",
        run_id: "run_001",
        round_id: "round_001",
        team_id: "team_001",
        role_key: "CEO",
        activity_id: "activity_001",
        idempotency_key: "idem_provider_failed"
      }),
      sendJson: (_target: unknown, status: number, payload: unknown) => {
        res.writeHead(status);
        res.end(JSON.stringify(payload));
      },
      createEnvelope: (_context: unknown, payload: unknown) => ({ code: "ERROR", data: payload }),
      requireStudent: () => undefined,
      requireTeacher: () => undefined
    };

    await handleW020AdvisoryRoute(
      service,
      { method: "POST" } as never,
      res as never,
      new URL("http://localhost/api/v1/bff/teacher/advisors/debrief"),
      { requestId: "req_failed", tenantId: "tenant_demo", actor },
      helpers
    );

    expect(res.statusCode).toBe(502);
    expect(res.body).toContain("W020_PROVIDER_FAILED");
    expect(res.body).not.toContain("private provider failure");
    expect(records).toHaveLength(0);
    expect(audits).toHaveLength(1);
    const audit = await service.listTeacherAudit(actor);
    expect(audit).toHaveLength(1);
    expect(audit[0]?.status).toBe("failed");
    expect(JSON.stringify(audit)).not.toContain("advisory_text");
  });

  it("returns only the bounded student receipt and keeps ModelCallLog on the teacher audit route", async () => {
    const records: never[] = [];
    const audits: never[] = [];
    const service = new GovernedAdvisoryService({
      repository: {
        list: async () => records,
        listAudit: async () => audits,
        appendAudit: async (audit) => {
          audits.push(audit as never);
        },
        appendSuccess: async (command) => {
          records.push(command.record as never);
          audits.push(command.audit as never);
        }
      },
      roleWorkflow: {
        readRoleWorkflow: () => workflowSnapshot(),
        commitRoleWorkflow: () => undefined
      },
      teachingClosure: { get: async () => eligibleTeachingClosure() }
    });
    const res = response();
    const helpers = {
      readJson: async () => ({
        discriminator: "w020_advisory_request",
        surface: "student_role",
        run_id: "run_001",
        round_id: "round_001",
        team_id: "team_001",
        role_key: "CEO",
        idempotency_key: "idem_student_public"
      }),
      sendJson: (_target: unknown, status: number, payload: unknown) => {
        res.writeHead(status);
        res.end(JSON.stringify(payload));
      },
      createEnvelope: (_context: unknown, payload: unknown) => ({ code: "OK", data: payload }),
      requireStudent: () => undefined,
      requireTeacher: () => undefined
    };

    await handleW020AdvisoryRoute(
      service,
      { method: "POST" } as never,
      res as never,
      new URL("http://localhost/api/v1/bff/student/advisors/role"),
      { requestId: "req_student", tenantId: "tenant_demo", actor: student },
      helpers
    );

    expect(res.statusCode).toBe(201);
    expect(res.body).not.toContain("model_call_log");
    expect(res.body).not.toContain("deterministic-mock");
    expect(records).toHaveLength(1);
    expect(audits).toHaveLength(1);
  });
});
