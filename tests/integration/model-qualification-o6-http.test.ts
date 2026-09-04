import { once } from "node:events";
import { describe, expect, it, vi } from "vitest";
import type {
  AdoptionDriftAssessment,
  AdoptionRollbackDryRun,
  ApiEnvelope,
  AuthSession,
  EvidenceAdoptionRecord,
  ModelQualificationAdoptionOperationsAdminProjection,
  ModelQualificationAdoptionOperationsStudentProjection,
  ModelQualificationAdoptionOperationsTeacherProjection,
  ModelQualificationAdminProjection,
  ModelQualificationTeacherProjection
} from "@simwar/shared-contracts";
import { createApiServer } from "../../services/api/src/server";
import {
  digestAdoptionOperationsPolicy,
  digestEvidenceAdoptionState
} from "../../services/api/src/model-qualification-adoption-drift-assessment";
import { ModelQualificationService } from "../../services/api/src/model-qualification-service";
import { createJsonModelQualificationPersistence } from "../../services/api/src/json-repository-adapter";
import { createP1Store, setUserRoles } from "../../services/api/src/store";
import {
  EVIDENCE_ADOPTION_ADMIN,
  EVIDENCE_ADOPTION_SCOPE,
  EVIDENCE_ADOPTION_TEACHER,
  adoptionReference,
  seedApprovedBoundChain
} from "../helpers/model-qualification-evidence-adoption-fixtures";
import { seedO5FormalCourse } from "../helpers/model-qualification-o5-product-fixture";

function adopt(
  service: ModelQualificationService,
  qualificationId: string,
  suffix: string,
  expected: ReturnType<typeof adoptionReference> | null
): EvidenceAdoptionRecord {
  const proposal = service.requestEvidenceAdoption(
    EVIDENCE_ADOPTION_TEACHER,
    EVIDENCE_ADOPTION_SCOPE,
    {
      command_id: `o6-http-${suffix}-request`,
      qualification_id: qualificationId,
      expected_adoption: expected
    }
  ).proposal;
  service.reviewEvidenceAdoption(EVIDENCE_ADOPTION_ADMIN, EVIDENCE_ADOPTION_SCOPE, {
    command_id: `o6-http-${suffix}-review`,
    proposal_id: proposal.proposal_id,
    proposal_digest: proposal.proposal_digest,
    decision: "APPROVED",
    note: "O6 HTTP fixture review"
  });
  return service.disposeEvidenceAdoption(EVIDENCE_ADOPTION_ADMIN, EVIDENCE_ADOPTION_SCOPE, {
    command_id: `o6-http-${suffix}-disposition`,
    proposal_id: proposal.proposal_id,
    proposal_digest: proposal.proposal_digest,
    disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
    expires_at: null,
    note: "O6 HTTP exact future-admission adoption"
  }).adoption;
}

describe("O6 real BFF adoption operations", () => {
  it("serves Teacher/Admin dry-run operations and a role-safe Student projection with target mocks=0", async () => {
    const assessedAt = "2026-09-02T12:00:00.000Z";
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(assessedAt));
    const store = createP1Store();
    await seedO5FormalCourse(store);
    const writer = new ModelQualificationService(
      { now: () => new Date().toISOString() },
      createJsonModelQualificationPersistence(store)
    );
    const chain = seedApprovedBoundChain(
      writer,
      EVIDENCE_ADOPTION_SCOPE,
      EVIDENCE_ADOPTION_TEACHER
    );
    const adoptedA = adopt(writer, chain.qualificationA.qualification_id, "a", null);
    const adoptedB = adopt(
      writer,
      chain.qualificationB.qualification_id,
      "b",
      adoptionReference(adoptedA)
    );
    const immutableBefore = JSON.stringify(store.modelQualificationRecords);
    const state = writer.getEvidenceAdoptionState(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE
    );
    const stateDigest = digestEvidenceAdoptionState(state);
    const policyDigest = digestAdoptionOperationsPolicy();
    const multiRoleUser = store.users.find((user) => user.username === "student")!;
    setUserRoles(store, multiRoleUser, ["learner", "teacher", "tenant_admin"]);
    const server = createApiServer(store);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind");
    const base = `http://127.0.0.1:${address.port}`;

    async function request<T>(
      path: string,
      token: string,
      body?: unknown,
      tenantId = EVIDENCE_ADOPTION_SCOPE.tenant_id
    ) {
      const response = await fetch(`${base}${path}`, {
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

    async function login(username: "teacher" | "admin" | "student") {
      const result = await request<AuthSession>("/api/v1/auth/login", "", {
        username,
        password: username
      });
      expect(result.status).toBe(200);
      return result.body.data.access_token;
    }

    try {
      const teacherToken = await login("teacher");
      const adminToken = await login("admin");
      const studentToken = await login("student");
      const query = `courseId=${EVIDENCE_ADOPTION_SCOPE.course_id}`;
      const teacher = await request<ModelQualificationAdoptionOperationsTeacherProjection>(
        `/api/v1/bff/teacher/model-qualification/adoption-operations?${query}`,
        teacherToken
      );
      expect(teacher.status, JSON.stringify(teacher.body)).toBe(200);
      expect(teacher.body.data).toMatchObject({
        current_adoption: adoptionReference(adoptedB),
        current_assessment: { status: "HEALTHY" },
        provider: "OFF",
        advisory_only: true
      });
      const assessment = await request<AdoptionDriftAssessment>(
        "/api/v1/bff/teacher/model-qualification/adoption-operations/drift-assessments",
        teacherToken,
        {
          course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
          expected_adoption: adoptionReference(adoptedB),
          expected_adoption_state_digest: stateDigest,
          expected_operations_policy_digest: policyDigest,
          assessed_at: assessedAt
        }
      );
      expect(assessment.status, JSON.stringify(assessment.body)).toBe(200);
      expect(assessment.body.data).toMatchObject({ status: "HEALTHY", adoption_mutation: false });

      const admin = await request<ModelQualificationAdoptionOperationsAdminProjection>(
        `/api/v1/bff/admin/model-qualification/adoption-operations?${query}`,
        adminToken
      );
      expect(admin.status).toBe(200);
      expect(admin.body.data.authority).toMatchObject({
        model_governance_writer: "MAIN_MODEL_GOVERNANCE",
        formal_truth_writer: "SIMULATION_CORE",
        writes_formal_truth: false
      });
      const rollback = await request<AdoptionRollbackDryRun>(
        "/api/v1/bff/admin/model-qualification/adoption-operations/rollback-dry-runs",
        adminToken,
        {
          course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
          current_adoption: adoptionReference(adoptedB),
          predecessor_adoption: adoptionReference(adoptedA),
          expected_adoption_state_digest: stateDigest,
          expected_operations_policy_digest: policyDigest,
          assessed_at: assessedAt
        }
      );
      expect(rollback.status, JSON.stringify(rollback.body)).toBe(200);
      expect(rollback.body.data).toMatchObject({
        status: "READY_WITH_LIMITS",
        rollback_applied: false,
        adoption_mutation: false,
        official_truth_write: false,
        history_deleted: false,
        historical_receipt_rewritten: false
      });

      const student = await request<ModelQualificationAdoptionOperationsStudentProjection>(
        `/api/v1/bff/student/model-qualification/adoption-operations?${query}&qualificationId=${chain.qualificationB.qualification_id}`,
        studentToken
      );
      expect(student.status, JSON.stringify(student.body)).toBe(200);
      expect(student.body.data).toMatchObject({
        applicability: "HEALTHY",
        freshness: "FRESH",
        provider: "OFF",
        advisory_only: true,
        rollback_applied: false,
        official_truth_write: false,
        visibility: "ROLE_SAFE_STUDENT"
      });
      expect(student.body.data).not.toHaveProperty("adoption_state_digest");
      expect(student.body.data).not.toHaveProperty("predecessor_adoption");
      expect(JSON.stringify(store.modelQualificationRecords)).toBe(immutableBefore);

      const unknownStudentQualification = await request<unknown>(
        `/api/v1/bff/student/model-qualification/adoption-operations?${query}&qualificationId=qualification-missing`,
        studentToken
      );
      expect(unknownStudentQualification.status).toBe(404);
      expect(unknownStudentQualification.body.code).toBe("MODEL_QUALIFICATION_NOT_FOUND");
      expect(JSON.stringify(store.modelQualificationRecords)).toBe(immutableBefore);

      const multiRoleTeacher = await request<ModelQualificationTeacherProjection>(
        `/api/v1/bff/teacher/model-qualification?${query}`,
        studentToken
      );
      const multiRoleAdmin = await request<ModelQualificationAdminProjection>(
        `/api/v1/bff/admin/model-qualification?${query}`,
        studentToken
      );
      expect(multiRoleTeacher.status).toBe(200);
      expect(multiRoleTeacher.body.data.operation_id).toBe(
        "MODEL_QUALIFICATION_TEACHER_STUDIO_GET_V1"
      );
      expect(multiRoleTeacher.body.data.security.role).toBe("teacher");
      expect(multiRoleAdmin.status).toBe(200);
      expect(multiRoleAdmin.body.data.operation_id).toBe("MODEL_QUALIFICATION_ADMIN_AUDIT_GET_V1");
      expect(multiRoleAdmin.body.data.security.role).toBe("tenant_admin");

      const multiRoleTeacherOperations =
        await request<ModelQualificationAdoptionOperationsTeacherProjection>(
          `/api/v1/bff/teacher/model-qualification/adoption-operations?${query}`,
          studentToken
        );
      const multiRoleAdminOperations =
        await request<ModelQualificationAdoptionOperationsAdminProjection>(
          `/api/v1/bff/admin/model-qualification/adoption-operations?${query}`,
          studentToken
        );
      expect(multiRoleTeacherOperations.body.data.operation_id).toBe(
        "MODEL_QUALIFICATION_ADOPTION_OPERATIONS_TEACHER_GET_V1"
      );
      expect(multiRoleAdminOperations.body.data.operation_id).toBe(
        "MODEL_QUALIFICATION_ADOPTION_OPERATIONS_ADMIN_GET_V1"
      );

      const stale = await request<AdoptionDriftAssessment>(
        "/api/v1/bff/teacher/model-qualification/adoption-operations/drift-assessments",
        teacherToken,
        {
          course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
          expected_adoption: adoptionReference(adoptedB),
          expected_adoption_state_digest: "f".repeat(64),
          expected_operations_policy_digest: policyDigest,
          assessed_at: assessedAt
        }
      );
      expect(stale.status).toBe(200);
      expect(stale.body.data.status).toBe("REBASE_REQUIRED");

      const missingExactAdoption = await request<unknown>(
        "/api/v1/bff/teacher/model-qualification/adoption-operations/drift-assessments",
        teacherToken,
        {
          course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
          expected_adoption: {
            adoption_id: "missing-adoption",
            adoption_digest: "0".repeat(64)
          },
          expected_adoption_state_digest: stateDigest,
          expected_operations_policy_digest: policyDigest,
          assessed_at: assessedAt
        }
      );
      expect(missingExactAdoption.status).toBe(422);
      expect(missingExactAdoption.body.code).toBe(
        "MODEL_QUALIFICATION_ADOPTION_OPERATIONS_INVALID"
      );
      expect(JSON.stringify(store.modelQualificationRecords)).toBe(immutableBefore);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
      vi.useRealTimers();
    }
  }, 30_000);
});
