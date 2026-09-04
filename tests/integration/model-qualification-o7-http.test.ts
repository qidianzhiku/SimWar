import { once } from "node:events";
import { describe, expect, it, vi } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  EvidenceAdoptionRecord,
  EvidenceAdoptionReference,
  GovernedRollbackRequestReceipt
} from "@simwar/shared-contracts";
import { createApiServer } from "../../services/api/src/server";
import {
  digestAdoptionOperationsPolicy,
  digestEvidenceAdoptionState,
  stableSha256
} from "../../services/api/src/model-qualification-adoption-drift-assessment";
import { digestPersistedGovernedRollbackRequest } from "../../services/api/src/model-qualification-governed-rollback-request";
import { ModelQualificationService } from "../../services/api/src/model-qualification-service";
import { createJsonModelQualificationPersistence } from "../../services/api/src/json-repository-adapter";
import { resolveFutureEvidenceAdoption } from "../../services/api/src/model-qualification-evidence-adoption";
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
  expected: EvidenceAdoptionReference | null
): EvidenceAdoptionRecord {
  const proposal = service.requestEvidenceAdoption(
    EVIDENCE_ADOPTION_TEACHER,
    EVIDENCE_ADOPTION_SCOPE,
    {
      command_id: `o7-http-${suffix}-request`,
      qualification_id: qualificationId,
      expected_adoption: expected
    }
  ).proposal;
  service.reviewEvidenceAdoption(EVIDENCE_ADOPTION_ADMIN, EVIDENCE_ADOPTION_SCOPE, {
    command_id: `o7-http-${suffix}-review`,
    proposal_id: proposal.proposal_id,
    proposal_digest: proposal.proposal_digest,
    decision: "APPROVED",
    note: "O7 HTTP fixture review"
  });
  return service.disposeEvidenceAdoption(EVIDENCE_ADOPTION_ADMIN, EVIDENCE_ADOPTION_SCOPE, {
    command_id: `o7-http-${suffix}-dispose`,
    proposal_id: proposal.proposal_id,
    proposal_digest: proposal.proposal_digest,
    disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
    expires_at: null,
    note: "O7 exact future-admission adoption"
  }).adoption;
}

describe("O7 governed rollback request and explicit re-adoption", () => {
  it("links one governed request to one O5 proposal without changing B, then creates C only through review and disposition", async () => {
    // The fixture's exact source epoch is intentionally live at this clock.
    const assessedAt = "2026-09-02T12:00:00.000Z";
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(assessedAt));
    const store = createP1Store();
    await seedO5FormalCourse(store);
    const seedWriter = new ModelQualificationService(
      { now: () => new Date().toISOString() },
      createJsonModelQualificationPersistence(store)
    );
    const chain = seedApprovedBoundChain(
      seedWriter,
      EVIDENCE_ADOPTION_SCOPE,
      EVIDENCE_ADOPTION_TEACHER
    );
    const adoptedA = adopt(seedWriter, chain.qualificationA.qualification_id, "a", null);
    const adoptedB = adopt(
      seedWriter,
      chain.qualificationB.qualification_id,
      "b",
      adoptionReference(adoptedA)
    );
    const stateBefore = seedWriter.getEvidenceAdoptionState(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE
    );
    const dryRun = await seedWriter.dryRunEvidenceAdoptionRollback(
      EVIDENCE_ADOPTION_ADMIN,
      EVIDENCE_ADOPTION_SCOPE,
      {
        course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
        current_adoption: adoptionReference(adoptedB),
        predecessor_adoption: adoptionReference(adoptedA),
        expected_adoption_state_digest: digestEvidenceAdoptionState(stateBefore),
        expected_operations_policy_digest: digestAdoptionOperationsPolicy(),
        assessed_at: assessedAt
      }
    );
    expect(dryRun.status).toBe("READY_WITH_LIMITS");

    const exactRecordBeforeRequest = seedWriter.getRecordForScope(EVIDENCE_ADOPTION_SCOPE)!;
    const failingWriter = new ModelQualificationService(
      { now: () => assessedAt },
      {
        listRecords: () => [structuredClone(exactRecordBeforeRequest)],
        commitRecord: () => {
          throw new Error("SIMULATED_O7_ATOMIC_COMMIT_FAILURE");
        }
      }
    );
    await expect(
      failingWriter.requestGovernedRollback(EVIDENCE_ADOPTION_TEACHER, EVIDENCE_ADOPTION_SCOPE, {
        command_id: "o7-failing-atomic-request",
        dry_run: dryRun,
        reason: "The request and proposal must commit atomically."
      })
    ).rejects.toThrow("SIMULATED_O7_ATOMIC_COMMIT_FAILURE");
    expect(failingWriter.getRecordForScope(EVIDENCE_ADOPTION_SCOPE)).toEqual(
      exactRecordBeforeRequest
    );

    let releaseAdmission!: () => void;
    const admissionBlocker = new Promise<void>((resolve) => {
      releaseAdmission = resolve;
    });
    const heldAdmission = seedWriter.withEvidenceAdmission(
      EVIDENCE_ADOPTION_ADMIN,
      EVIDENCE_ADOPTION_SCOPE,
      async () => admissionBlocker
    );
    await Promise.resolve();
    await expect(
      seedWriter.requestGovernedRollback(EVIDENCE_ADOPTION_TEACHER, EVIDENCE_ADOPTION_SCOPE, {
        command_id: "o7-concurrent-request",
        dry_run: dryRun,
        reason: "A concurrent request must fail closed under the existing guard."
      })
    ).rejects.toThrow("EVIDENCE_ADOPTION_ADMISSION_IN_PROGRESS");
    expect(seedWriter.getRecordForScope(EVIDENCE_ADOPTION_SCOPE)).toEqual(exactRecordBeforeRequest);
    releaseAdmission();
    await heldAdmission;

    let advancingClockTick = 0;
    const advancingClockWriter = new ModelQualificationService(
      {
        now: () => new Date(Date.parse(assessedAt) + advancingClockTick++).toISOString()
      },
      {
        listRecords: () => [structuredClone(exactRecordBeforeRequest)],
        commitRecord: () => undefined
      }
    );
    await expect(
      advancingClockWriter.requestGovernedRollback(
        EVIDENCE_ADOPTION_TEACHER,
        EVIDENCE_ADOPTION_SCOPE,
        {
          command_id: "o7-advancing-clock-request",
          dry_run: dryRun,
          reason: "One authoritative request timestamp must bind the linked proposal."
        }
      )
    ).resolves.toMatchObject({
      reused: false,
      request: { status: "LINKED_PROPOSAL_PENDING_REVIEW" }
    });

    const durableRecords = [structuredClone(exactRecordBeforeRequest)];
    const durableWriter = new ModelQualificationService(
      { now: () => assessedAt },
      {
        listRecords: () => structuredClone(durableRecords),
        commitRecord: (record) => {
          durableRecords[0] = structuredClone(record);
        }
      }
    );
    const durableInput = {
      command_id: "o7-durable-integrity-request",
      dry_run: dryRun,
      reason: "The public immutable receipt must be independently verifiable."
    };
    const durableReceipt = await durableWriter.requestGovernedRollback(
      EVIDENCE_ADOPTION_TEACHER,
      EVIDENCE_ADOPTION_SCOPE,
      durableInput
    );
    const { rollback_request_digest: publicDigest, ...publicRequestBody } = durableReceipt.request;
    expect(stableSha256(publicRequestBody)).toBe(publicDigest);
    await expect(
      durableWriter.requestGovernedRollback(
        { ...EVIDENCE_ADOPTION_TEACHER, role: "tenant_admin" },
        EVIDENCE_ADOPTION_SCOPE,
        durableInput
      )
    ).rejects.toThrow("EVIDENCE_ADOPTION_IDEMPOTENCY_CONFLICT");

    const stored = durableRecords[0]!;
    durableRecords[0] = {
      ...stored,
      governed_rollback_requests: stored.governed_rollback_requests?.map((request, index) =>
        index === 0 ? { ...request, reason: "tampered persisted reason" } : request
      )
    };
    const tamperedReader = new ModelQualificationService(
      { now: () => assessedAt },
      {
        listRecords: () => structuredClone(durableRecords),
        commitRecord: () => undefined
      }
    );
    expect(() =>
      tamperedReader.getTeacherProjection(EVIDENCE_ADOPTION_TEACHER, EVIDENCE_ADOPTION_SCOPE)
    ).toThrow("EVIDENCE_ADOPTION_STATE_INVALID");

    const originalStoredRequest = stored.governed_rollback_requests![0]!;
    const resignedBody = {
      ...originalStoredRequest,
      reason: "tampered and recomputed public digest"
    };
    durableRecords[0] = {
      ...stored,
      governed_rollback_requests: [
        {
          ...resignedBody,
          rollback_request_digest: digestPersistedGovernedRollbackRequest(resignedBody)
        }
      ]
    };
    const resignedReader = new ModelQualificationService(
      { now: () => assessedAt },
      {
        listRecords: () => structuredClone(durableRecords),
        commitRecord: () => undefined
      }
    );
    expect(() =>
      resignedReader.getTeacherProjection(EVIDENCE_ADOPTION_TEACHER, EVIDENCE_ADOPTION_SCOPE)
    ).toThrow("EVIDENCE_ADOPTION_STATE_INVALID");

    durableRecords[0] = {
      ...stored,
      governed_rollback_requests: null as never
    };
    const invalidContainerReader = new ModelQualificationService(
      { now: () => assessedAt },
      {
        listRecords: () => structuredClone(durableRecords),
        commitRecord: () => undefined
      }
    );
    expect(() =>
      invalidContainerReader.getTeacherProjection(
        EVIDENCE_ADOPTION_TEACHER,
        EVIDENCE_ADOPTION_SCOPE
      )
    ).toThrow("EVIDENCE_ADOPTION_STATE_INVALID");

    const multiRoleUser = store.users.find((user) => user.username === "student")!;
    setUserRoles(store, multiRoleUser, ["learner", "teacher", "tenant_admin"]);
    const server = createApiServer(store);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind");
    const base = `http://127.0.0.1:${address.port}`;

    async function request<T>(path: string, token: string, body?: unknown) {
      const response = await fetch(`${base}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-tenant-id": EVIDENCE_ADOPTION_SCOPE.tenant_id
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
      const path = "/api/v1/bff/teacher/model-qualification/evidence-adoptions/rollback-requests";
      const rollbackRequest = await request<GovernedRollbackRequestReceipt>(path, teacherToken, {
        course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
        command_id: "o7-governed-rollback-request",
        dry_run: dryRun,
        reason: "Re-adopt exact historical epoch A for future admission after governed review."
      });
      expect(rollbackRequest.status, JSON.stringify(rollbackRequest.body)).toBe(200);
      expect(rollbackRequest.body.data).toMatchObject({
        reused: false,
        request: {
          current_adoption: adoptionReference(adoptedB),
          predecessor_adoption: adoptionReference(adoptedA),
          dry_run_id: dryRun.dry_run_id,
          dry_run_digest: dryRun.dry_run_digest,
          status: "LINKED_PROPOSAL_PENDING_REVIEW",
          current_selection_changed: false,
          rollback_applied: false,
          official_truth_write: false,
          history_deleted: false,
          historical_receipt_rewritten: false
        },
        proposal: {
          epoch: adoptedA.epoch,
          expected_adoption: adoptionReference(adoptedB)
        }
      });
      const proposal = rollbackRequest.body.data.proposal as {
        proposal_id: string;
        proposal_digest: string;
      };

      const retry = await request<GovernedRollbackRequestReceipt>(path, teacherToken, {
        course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
        command_id: "o7-governed-rollback-request",
        dry_run: dryRun,
        reason: "Re-adopt exact historical epoch A for future admission after governed review."
      });
      expect(retry.status).toBe(200);
      expect(retry.body.data).toMatchObject({ reused: true, proposal });

      const conflict = await request<unknown>(path, teacherToken, {
        course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
        command_id: "o7-governed-rollback-request",
        dry_run: dryRun,
        reason: "Changed payload must conflict."
      });
      expect(conflict.status).toBe(409);
      expect(conflict.body.code).toBe("EVIDENCE_ADOPTION_IDEMPOTENCY_CONFLICT");

      const bypass = await request<unknown>(
        "/api/v1/bff/teacher/model-qualification/evidence-adoptions/request",
        teacherToken,
        {
          course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
          command_id: "o7-historical-bypass",
          qualification_id: chain.qualificationA.qualification_id,
          expected_adoption: adoptionReference(adoptedB)
        }
      );
      expect(bypass.status).toBe(409);
      expect(bypass.body.code).toBe("EVIDENCE_ADOPTION_ROLLBACK_REQUEST_REQUIRED");

      const studentMutation = await request<unknown>(
        "/api/v1/bff/student/model-qualification/evidence-adoptions/rollback-requests",
        studentToken,
        {
          course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
          command_id: "o7-student-denied",
          dry_run: dryRun,
          reason: "must not be accepted"
        }
      );
      expect([403, 404]).toContain(studentMutation.status);

      const statePending = new ModelQualificationService(
        { now: () => new Date().toISOString() },
        createJsonModelQualificationPersistence(store)
      ).getEvidenceAdoptionState(EVIDENCE_ADOPTION_ADMIN, EVIDENCE_ADOPTION_SCOPE);
      expect(
        resolveFutureEvidenceAdoption(statePending, {
          tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id,
          course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
          ...adoptionReference(adoptedB),
          epoch: adoptedB.epoch,
          now: assessedAt
        })
      ).toMatchObject(adoptionReference(adoptedB));

      const reviewed = await request<unknown>(
        "/api/v1/bff/admin/model-qualification/evidence-adoptions/review",
        adminToken,
        {
          course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
          command_id: "o7-readoption-review",
          proposal_id: proposal.proposal_id,
          proposal_digest: proposal.proposal_digest,
          decision: "APPROVED",
          note: "Explicit O7 re-adoption review"
        }
      );
      expect(reviewed.status).toBe(200);
      const disposed = await request<{ adoption: EvidenceAdoptionRecord }>(
        "/api/v1/bff/admin/model-qualification/evidence-adoptions/disposition",
        adminToken,
        {
          course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
          command_id: "o7-readoption-disposition",
          proposal_id: proposal.proposal_id,
          proposal_digest: proposal.proposal_digest,
          disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
          expires_at: null,
          note: "Explicitly adopt historical epoch A as new future admission C"
        }
      );
      expect(disposed.status).toBe(200);
      const adoptedC = disposed.body.data.adoption;
      expect(adoptedC.adoption_id).not.toBe(adoptedA.adoption_id);
      expect(adoptedC.adoption_id).not.toBe(adoptedB.adoption_id);
      expect(adoptedC.predecessor).toEqual(adoptionReference(adoptedB));
      expect(adoptedC.epoch).toEqual(adoptedA.epoch);

      const finalService = new ModelQualificationService(
        { now: () => new Date().toISOString() },
        createJsonModelQualificationPersistence(store)
      );
      const finalState = finalService.getEvidenceAdoptionState(
        EVIDENCE_ADOPTION_ADMIN,
        EVIDENCE_ADOPTION_SCOPE
      );
      expect(
        resolveFutureEvidenceAdoption(finalState, {
          tenant_id: EVIDENCE_ADOPTION_SCOPE.tenant_id,
          course_id: EVIDENCE_ADOPTION_SCOPE.course_id,
          ...adoptionReference(adoptedC),
          epoch: adoptedC.epoch,
          now: assessedAt
        })
      ).toMatchObject(adoptionReference(adoptedC));
      expect(
        finalState.records.find((record) => record.adoption_id === adoptedA.adoption_id)
      ).toEqual(adoptedA);
      expect(
        finalState.records.find((record) => record.adoption_id === adoptedB.adoption_id)
      ).toEqual(adoptedB);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
      vi.useRealTimers();
    }
  }, 30_000);
});
