import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  D2EvidenceArtifactVersion,
  D2ProvenanceEdge,
  TeacherConfirmationVersion
} from "@simwar/shared-contracts";
import { createApiServer } from "../../services/api/src/server.js";
import { createP1Store, type SimWarStore } from "../../services/api/src/store.js";

const tenant = "tenant_demo";
const digest = "a".repeat(64);

function refs() {
  return {
    course: {
      content_digest: digest,
      discriminator: "exact_ref" as const,
      resource_id: "package_d4",
      resource_type: "course_package_version" as const,
      tenant_id: tenant,
      version: "1.0.0"
    },
    goal: {
      content_digest: digest,
      discriminator: "exact_ref" as const,
      resource_id: "goal_d4",
      resource_type: "learning_goal_version" as const,
      tenant_id: tenant,
      version: "1.0.0"
    },
    rubric: {
      content_digest: digest,
      discriminator: "exact_ref" as const,
      resource_id: "rubric_d4",
      resource_type: "rubric_version" as const,
      tenant_id: tenant,
      version: "1.0.0"
    },
    evidence: {
      content_digest: digest,
      discriminator: "exact_ref" as const,
      resource_id: "artifact_d4",
      resource_type: "evidence_artifact" as const,
      tenant_id: tenant,
      version: "1.0.0"
    },
    confirmation: {
      content_digest: digest,
      discriminator: "exact_ref" as const,
      resource_id: "confirmation_d4",
      resource_type: "teacher_confirmation_version" as const,
      tenant_id: tenant,
      version: "2.0.0"
    },
    event: {
      content_digest: digest,
      discriminator: "exact_ref" as const,
      resource_id: "event_d4",
      resource_type: "role_workflow_event" as const,
      tenant_id: tenant,
      version: "1.0.0"
    },
    rule: {
      content_digest: digest,
      discriminator: "exact_ref" as const,
      resource_id: "rule_d4",
      resource_type: "transformation_rule" as const,
      tenant_id: tenant,
      version: "1.0.0"
    }
  };
}

function seedD4(): SimWarStore {
  const store = createP1Store();
  const value = refs();
  const confirmation: TeacherConfirmationVersion = {
    audit_receipt: {
      action: "teacher_confirmation.confirm",
      actor_id: "usr_teacher",
      audit_id: "audit_d4",
      recorded_at: "2026-08-03T00:00:00.000Z",
      request_id: "request_d4"
    },
    confirmation_ref: value.confirmation,
    content_digest: digest,
    context: {
      course_id: "course_demo",
      run_id: "run_d4",
      team_id: "team_alpha",
      role_key: "CEO",
      round_id: "round_d4",
      round_no: 1
    },
    course_package_ref: value.course,
    created_at: "2026-08-03T00:00:00.000Z",
    created_by: "usr_teacher",
    criterion_decisions: [{ criterion_id: "criterion_d4", level_ordinal: 2 }],
    discriminator: "teacher_confirmation_version",
    evidence_refs: [value.evidence],
    idempotency_key: "idem_d4",
    known_limits: ["D3 teacher-only"],
    learning_goal_ref: value.goal,
    rubric_ref: value.rubric,
    schema_version: "teacher-confirmation.v1",
    status: "CONFIRMED",
    teacher_feedback: "Private teacher note must not be exposed."
  };
  const artifact: D2EvidenceArtifactVersion = {
    artifact_digest: digest,
    artifact_kind: "observation",
    artifact_ref: value.evidence,
    captured_at: "2026-08-03T00:00:00.000Z",
    captured_by: "usr_teacher",
    context: {
      activity_id: "activity_d4",
      course_id: "course_demo",
      role_key: "CEO",
      run_id: "run_d4",
      team_id: "team_alpha"
    },
    course_package_ref: value.course,
    discriminator: "d2_evidence_artifact_version",
    idempotency_key: "artifact_idem_d4",
    known_limits: ["teacher_only"],
    learning_goal_ref: value.goal,
    rubric_ref: value.rubric,
    schema_version: "evidence-provenance.v1",
    source_event_ref: value.event,
    transformation_rule_ref: value.rule,
    visibility: "teacher_only"
  };
  const edge: D2ProvenanceEdge = {
    discriminator: "d2_provenance_edge",
    relation: "derived_from",
    source_ref: value.event,
    target_ref: value.evidence
  };
  store.teacherConfirmationVersions.push(confirmation);
  store.evidenceArtifacts.push(artifact);
  store.evidenceProvenanceEdges.push(edge);
  store.runs.push({
    run_id: "run_d4",
    course_id: "course_demo",
    tenant_id: tenant,
    scenario_package_id: "scenario_eldercare_demo",
    parameter_set_id: "param_toy_approved_1",
    status: "running",
    current_round_no: 1
  } as never);
  store.rounds.push({
    round_id: "round_d4",
    round_no: 1,
    run_id: "run_d4",
    tenant_id: tenant,
    status: "published"
  });
  store.studentRoleAssignments.push({
    assignment_id: "assignment_d4",
    tenant_id: tenant,
    course_id: "course_demo",
    run_id: "run_d4",
    team_id: "team_alpha",
    user_id: "usr_student",
    role_key: "CEO",
    role_template_id: "role_ceo",
    status: "active",
    source: "teacher",
    assigned_by: "usr_teacher",
    assigned_at: "2026-08-03T00:00:00.000Z"
  } as never);
  return store;
}

async function start(store: SimWarStore): Promise<{ baseUrl: string; server: Server }> {
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("address unavailable");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

async function login(baseUrl: string, username: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    body: JSON.stringify({ password: username, username }),
    headers: { "content-type": "application/json", "x-tenant-id": tenant },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as ApiEnvelope<AuthSession>).data.access_token;
}

describe("D4 Student Learning Report endpoint", () => {
  it("serves student-safe reports and separate teacher preview without a write route", async () => {
    const { baseUrl, server } = await start(seedD4());
    try {
      const studentToken = await login(baseUrl, "student");
      const studentResponse = await fetch(`${baseUrl}/api/v1/bff/student/learning-reports`, {
        headers: { authorization: `Bearer ${studentToken}`, "x-tenant-id": tenant }
      });
      expect(studentResponse.status).toBe(200);
      const studentPayload = (await studentResponse.json()) as ApiEnvelope<{
        reports: Array<Record<string, unknown>>;
        scope: string;
      }>;
      expect(studentPayload.data.scope).toBe("student_team");
      expect(studentPayload.data.reports).toHaveLength(1);
      expect(studentPayload.data.reports[0]).not.toHaveProperty("teacher_feedback");
      expect(studentPayload.data.reports[0]).not.toHaveProperty("raw_evidence_payload");
      expect(studentPayload.data.reports[0]).toHaveProperty("learning_evidence");
      expect(JSON.stringify(studentPayload.data)).not.toMatch(
        /content_digest|report_digest|source_confirmation_digest|provenance|teacher_confirmation_ref|course_package_ref|rubric_ref|evidence_refs/
      );
      const detail = await fetch(
        `${baseUrl}/api/v1/bff/student/learning-reports/student_report_confirmation_d4`,
        {
          headers: { authorization: `Bearer ${studentToken}`, "x-tenant-id": tenant }
        }
      );
      expect(detail.status).toBe(200);
      expect((await detail.json()).data).toEqual(studentPayload.data);

      const teacherToken = await login(baseUrl, "teacher");
      const teacherResponse = await fetch(`${baseUrl}/api/v1/bff/teacher/learning-reports`, {
        headers: { authorization: `Bearer ${teacherToken}`, "x-tenant-id": tenant }
      });
      expect(teacherResponse.status).toBe(200);
      expect(((await teacherResponse.json()) as ApiEnvelope<{ scope: string }>).data.scope).toBe(
        "tenant_preview"
      );

      const writeResponse = await fetch(`${baseUrl}/api/v1/bff/student/learning-reports`, {
        body: JSON.stringify({}),
        headers: {
          authorization: `Bearer ${studentToken}`,
          "content-type": "application/json",
          "x-tenant-id": tenant
        },
        method: "POST"
      });
      expect(writeResponse.status).toBe(404);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
  it.each([
    "unpublished",
    "wrong_role",
    "wrong_run",
    "wrong_round",
    "wrong_course",
    "inactive",
    "missing_round"
  ])("denies public list and detail for %s", async (failure) => {
    const store = seedD4();
    if (failure === "unpublished")
      store.rounds.find((round) => round.round_id === "round_d4")!.status = "open";
    if (failure === "wrong_role") store.studentRoleAssignments[0]!.role_key = "CFO";
    if (failure === "inactive") store.studentRoleAssignments[0]!.status = "inactive";
    const original = store.teacherConfirmationVersions[0]!;
    if (
      failure === "wrong_run" ||
      failure === "wrong_course" ||
      failure === "wrong_round" ||
      failure === "missing_round"
    ) {
      const context = {
        ...original.context,
        ...(failure === "wrong_run"
          ? { run_id: "run_other" }
          : failure === "wrong_course"
            ? { course_id: "course_other" }
            : failure === "wrong_round"
              ? { round_no: 2 }
              : {})
      };
      if (failure === "missing_round") {
        delete context.round_id;
        delete context.round_no;
      }
      store.teacherConfirmationVersions[0] = { ...original, context };
    }
    const { baseUrl, server } = await start(store);
    try {
      const token = await login(baseUrl, "student");
      const headers = { authorization: `Bearer ${token}`, "x-tenant-id": tenant };
      const list = await fetch(`${baseUrl}/api/v1/bff/student/learning-reports`, { headers });
      expect(list.status).toBe(200);
      expect((await list.json()).data.reports).toEqual([]);
      const detail = await fetch(
        `${baseUrl}/api/v1/bff/student/learning-reports/student_report_confirmation_d4`,
        { headers }
      );
      expect(detail.status).toBe(404);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
