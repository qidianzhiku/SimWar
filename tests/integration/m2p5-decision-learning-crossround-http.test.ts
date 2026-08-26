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
  M2P5_CONFIRMATION_ID,
  M2P5_ROUND_1_ID,
  M2P5_ROUND_2_CONFIRMATION_ID,
  M2P5_ROUND_2_ID,
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

function contextQuery(
  overrides: Partial<{
    activity_id: string;
    course_id: string;
    role_key: string;
    round_id: string;
    round_no: string;
    run_id: string;
    team_id: string;
    tenant_id: string;
  }> = {}
): string {
  const query = new URLSearchParams({
    activity_id: "activity_consequence",
    course_id: M2P5_COURSE_ID,
    role_key: "CEO",
    round_id: M2P5_ROUND_1_ID,
    round_no: "1",
    run_id: M2P5_RUN_ID,
    team_id: M2P5_TEAM_ID,
    tenant_id: M2P5_TENANT_ID,
    ...overrides
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
  options: {
    headerTenantId?: string;
    pathRoundNo?: number;
    pathRunId?: string;
    query?: Parameters<typeof contextQuery>[0];
  } = {}
): Promise<{ status: number; body: ApiEnvelope<M2P5DecisionLearningResponse> }> {
  const pathRoundNo = options.pathRoundNo ?? 1;
  const pathRunId = options.pathRunId ?? M2P5_RUN_ID;
  const response = await fetch(
    `${baseUrl}/api/v1/bff/${surface}/m2p5/runs/${pathRunId}/rounds/${pathRoundNo}/decision-learning?${contextQuery(options.query)}`,
    { headers: requestHeaders(token, options.headerTenantId) }
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
      expect(before.body.data.learning_loop.status).toBe("BLOCKED");
      expect(before.body.data.learning_loop.exact_context).toEqual({
        activity_id: "activity_consequence",
        course_id: M2P5_COURSE_ID,
        role_key: "CEO",
        round_id: M2P5_ROUND_1_ID,
        round_no: 1,
        run_id: M2P5_RUN_ID,
        team_id: M2P5_TEAM_ID,
        tenant_id: M2P5_TENANT_ID
      });
      const beforeTeacher = await getJourney(baseUrl, "teacher", teacherToken);
      expect(beforeTeacher.status).toBe(200);
      expect(beforeTeacher.body.data.learning_loop.teacher_confirmation_ref?.resource_id).toBe(
        M2P5_CONFIRMATION_ID
      );
      expect(beforeTeacher.body.data.learning_loop.teacher_confirmation_ref?.resource_id).not.toBe(
        M2P5_ROUND_2_CONFIRMATION_ID
      );
      expect(
        store.teacherConfirmationVersions.some(
          (confirmation) =>
            confirmation.context.round_no === 2 &&
            confirmation.confirmation_ref.resource_id === M2P5_ROUND_2_CONFIRMATION_ID
        )
      ).toBe(true);

      const context = {
        activity_id: "activity_consequence",
        course_id: M2P5_COURSE_ID,
        role_key: "CEO",
        round_id: M2P5_ROUND_1_ID,
        round_no: 1,
        run_id: M2P5_RUN_ID,
        team_id: M2P5_TEAM_ID
      };
      const reflectionInput = {
        context,
        idempotency_key: "m2p5-reflection-idempotency",
        prompt_id: "w3-reflection-off-v1",
        response: "The published outcome is an exact bounded consequence of the admitted decision."
      };
      const reflection = await post(
        baseUrl,
        "/api/v1/bff/student/w3/reflection",
        studentToken,
        reflectionInput
      );
      expect(reflection.status).toBe(201);
      expect(JSON.stringify(reflection.body)).toContain('"ai_used":false');
      const repeatedReflection = await post(
        baseUrl,
        "/api/v1/bff/student/w3/reflection",
        studentToken,
        reflectionInput
      );
      expect(repeatedReflection.status).toBe(201);
      expect(repeatedReflection.body.data).toEqual(reflection.body.data);
      const conflictingReflection = await post(
        baseUrl,
        "/api/v1/bff/student/w3/reflection",
        studentToken,
        { ...reflectionInput, response: "Conflicting reuse of the same idempotency key." }
      );
      expect(conflictingReflection.status).toBe(409);

      const counterfactual = await post(
        baseUrl,
        "/api/v1/bff/teacher/w3/counterfactual",
        teacherToken,
        {
          changed_field: "marketing_budget",
          changed_value: 120000,
          context,
          idempotency_key: "m2p6-counterfactual-idempotency"
        }
      );
      expect(counterfactual.status).toBe(200);

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
      expect(teacherJourney.body.data.learning_loop).toMatchObject({
        next_opening_state_readiness: "ENTRY_READY",
        recovery_state: "EXACT_CONTEXT_RESTORED",
        reflection_status: "SUBMITTED",
        status: "READY",
        student_learning_report_status: "CONFIRMED",
        teacher_debrief_availability: "AVAILABLE",
        teacher_confirmation_status: "CONFIRMED",
        transfer_status: "READY",
        what_if_availability: "AVAILABLE"
      });
      expect(teacherJourney.body.data.learning_loop.teacher_confirmation_ref?.resource_id).toBe(
        M2P5_CONFIRMATION_ID
      );
      expect(JSON.stringify(teacherJourney.body)).not.toContain("state_true");
      expect(JSON.stringify(teacherJourney.body)).not.toContain("replay_hash");

      const studentJourney = await getJourney(baseUrl, "student", studentToken);
      expect(studentJourney.status).toBe(200);
      expect(studentJourney.body.data.cross_round.entry_status).toBe("OPEN");
      expect(studentJourney.body.data.learning_loop).toMatchObject({
        next_opening_state_readiness: "ENTRY_READY",
        recovery_state: "EXACT_CONTEXT_RESTORED",
        reflection_status: "SUBMITTED",
        status: "READY",
        student_learning_report_status: "CONFIRMED",
        transfer_status: "READY",
        what_if_availability: "AVAILABLE"
      });
      expect(
        JSON.stringify({
          learning: studentJourney.body.data.learning,
          learning_loop: studentJourney.body.data.learning_loop
        })
      ).not.toContain('"teacher_confirmation_ref"');
      const studentJson = JSON.stringify(studentJourney.body);
      for (const forbiddenField of [
        "teacher_feedback",
        "claim_owner",
        "teacher_private_evidence",
        "private_evidence_body",
        "decision_batch_hash",
        "json_runtime_source_digest",
        "canonical_evidence_digest",
        "replay_input_manifest",
        "full_manifest",
        "state_true",
        "replay_hash",
        "authority_diagnostics"
      ]) {
        expect(studentJson).not.toContain(`"${forbiddenField}"`);
      }
      expect(studentJson).not.toContain('"model_call_id"');
      expect(studentJourney.body.data.known_limits.join(" ")).toContain(
        "provider/model activation"
      );
      expect(store.decisions.filter((decision) => decision.round_no === 2)).toHaveLength(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("fails closed for a wrong student team or tenant context", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const studentToken = await login(baseUrl, "student");
      const authorized = await getJourney(baseUrl, "student", studentToken);
      expect(authorized.status).toBe(200);
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
      const wrongTenant = await getJourney(baseUrl, "student", studentToken, {
        headerTenantId: "tenant_other"
      });
      expect([401, 403]).toContain(wrongTenant.status);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("denies role confusion and fails closed for mismatched, missing, or unpublished rounds", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const studentToken = await login(baseUrl, "student");
      const learnerOnTeacher = await getJourney(baseUrl, "teacher", studentToken);
      expect(learnerOnTeacher.status).toBe(403);

      const pathQueryMismatch = await getJourney(baseUrl, "student", studentToken, {
        pathRoundNo: 2
      });
      expect(pathQueryMismatch.status).toBe(422);
      expect(pathQueryMismatch.body.code).toBe("M2P5_CONTEXT_INVALID");

      const wrongRoundId = await getJourney(baseUrl, "student", studentToken, {
        query: { round_id: M2P5_ROUND_2_ID }
      });
      expect(wrongRoundId.status).toBe(404);
      expect(wrongRoundId.body.code).toBe("M2P5_ROUND_NOT_FOUND");

      const missingRound = await getJourney(baseUrl, "student", studentToken, {
        pathRoundNo: 99,
        query: { round_id: "round_missing_99", round_no: "99" }
      });
      expect(missingRound.status).toBe(404);
      expect(missingRound.body.code).toBe("M2P5_ROUND_NOT_FOUND");

      const roundTwo = store.rounds.find((round) => round.round_id === M2P5_ROUND_2_ID);
      expect(roundTwo).toBeDefined();
      if (roundTwo) roundTwo.status = "settled";
      const settledUnpublished = await getJourney(baseUrl, "student", studentToken, {
        pathRoundNo: 2,
        query: { round_id: M2P5_ROUND_2_ID, round_no: "2" }
      });
      expect(settledUnpublished.status).toBe(409);
      expect(settledUnpublished.body.code).toBe("M2P5_OFFICIAL_RESULT_NOT_PUBLISHED");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("preserves the normal authentication failure status", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const response = await fetch(
        `${baseUrl}/api/v1/bff/student/m2p5/runs/${M2P5_RUN_ID}/rounds/1/decision-learning?${contextQuery()}`,
        { headers: { "x-tenant-id": M2P5_TENANT_ID } }
      );
      expect(response.status).toBe(401);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
