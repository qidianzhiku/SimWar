import { once } from "node:events";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  EvidenceAdoptionProposal,
  EvidenceAdoptionRecord,
  Run
} from "@simwar/shared-contracts";
import { createP1Store } from "../../services/api/src/store";
import { createApiServer } from "../../services/api/src/server";
import { ModelQualificationService } from "../../services/api/src/model-qualification-service";
import {
  createJsonModelQualificationPersistence,
  createJsonRepositoryPorts
} from "../../services/api/src/json-repository-adapter";
import { resolveQualifiedRunAdmission } from "../../services/api/src/model-qualification-run-admission";
import { createQualifiedRunAdmissionFixture } from "../helpers/model-qualification-run-admission-fixtures";
import { seedO5FormalCourse } from "../helpers/model-qualification-o5-product-fixture";
import {
  EVIDENCE_ADOPTION_SCOPE as scope,
  EVIDENCE_ADOPTION_TEACHER as actor,
  seedApprovedBoundChain
} from "../helpers/model-qualification-evidence-adoption-fixtures";

describe("O5 actual HTTP authority and non-write admission", () => {
  it("fails closed tuple/scope/selector tampering before any Run, Round or formal binding write", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-03T12:00:00.000Z"));
    const store = createP1Store();
    const formal = await seedO5FormalCourse(store);
    const source = new ModelQualificationService(
      { now: () => new Date().toISOString() },
      createJsonModelQualificationPersistence(store)
    );
    const { qualificationA: q } = seedApprovedBoundChain(source, scope, actor);
    const v1 = resolveQualifiedRunAdmission(createQualifiedRunAdmissionFixture());
    const legacyRun = {
      tenant_id: scope.tenant_id,
      course_id: scope.course_id,
      run_id: "run_legacy_v1",
      parameter_set_id: v1.parameter_set_reference.parameter_set_id,
      scenario_package_id: v1.scenario_package_reference.scenario_package_id,
      seed: 42,
      status: "completed" as const
    };
    await createJsonRepositoryPorts(store).runs.saveRun(legacyRun);
    const legacy = {
      ...JSON.parse(
        readFileSync("contracts/fixtures/validation-environment-launch.valid.json", "utf8")
      ),
      tenant_id: scope.tenant_id,
      course_id: scope.course_id,
      run_id: legacyRun.run_id,
      launch_id: "launch_legacy_v1",
      qualified_run_admission_receipt: v1
    };
    const originalLegacy = JSON.stringify(legacy);
    const legacyWrites = vi.fn(async () => {
      throw new Error("O5 must not rewrite the historical W025 ledger");
    });
    // Existing ledger port with immutable synthetic v1 history; no database/runtime activation.
    const server = createApiServer(store, {
      validationEnvironmentLaunchLedger: {
        acquire: legacyWrites,
        save: legacyWrites,
        get: async (tenant, launch) =>
          tenant === scope.tenant_id && launch === legacy.launch_id
            ? JSON.parse(JSON.stringify(legacy))
            : null
      }
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind");
    const base = `http://127.0.0.1:${address.port}`;
    async function api<T>(path: string, token: string, body?: unknown, tenantId = scope.tenant_id) {
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
    try {
      const login = await api<AuthSession>("/api/v1/auth/login", "", {
        username: "teacher",
        password: "teacher"
      });
      expect(login.status).toBe(200);
      const token = login.body.data.access_token;
      const legacyPath = `/api/v1/bff/teacher/model-qualification/run-admissions/${legacyRun.run_id}?courseId=${scope.course_id}&launchId=${legacy.launch_id}`;
      const legacyBefore = await api(legacyPath, token);
      expect(legacyBefore.status).toBe(200);
      expect(legacyBefore.body.data).toEqual({
        historical_schema: "qualified-run-admission.v1",
        run_id: legacyRun.run_id,
        admission: v1
      });
      expect((await api(`/api/v1/courses/${scope.course_id}/publish`, token, {})).status).toBe(200);
      const root = "/api/v1/bff/teacher/model-qualification/evidence-adoptions";
      const requestBody = {
        course_id: scope.course_id,
        qualification_id: q.qualification_id,
        command_id: "http-adopt-request",
        expected_adoption: null
      };
      const proposed = await api<{ proposal: EvidenceAdoptionProposal }>(
        `${root}/request`,
        token,
        requestBody
      );
      expect(proposed.status, JSON.stringify(proposed.body)).toBe(200);
      const proposal = proposed.body.data.proposal;
      expect(
        (
          await api(`${root}/review`, token, {
            course_id: scope.course_id,
            command_id: "http-adopt-review",
            proposal_id: proposal.proposal_id,
            proposal_digest: proposal.proposal_digest,
            decision: "APPROVED",
            note: "Immutable exact evidence reviewed"
          })
        ).status
      ).toBe(200);
      const adopted = await api<{ adoption: EvidenceAdoptionRecord }>(
        `${root}/disposition`,
        token,
        {
          course_id: scope.course_id,
          command_id: "http-adopt-dispose",
          proposal_id: proposal.proposal_id,
          proposal_digest: proposal.proposal_digest,
          disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
          expires_at: null,
          note: "Explicitly adopt for future admission"
        }
      );
      expect(adopted.status, JSON.stringify(adopted.body)).toBe(200);
      const admission = {
        course_id: scope.course_id,
        course_package_reference: formal.course_package_reference,
        source_package_id: q.source_package_id,
        calibration_dataset_id: q.calibration_dataset_id,
        qualification_id: q.qualification_id,
        model_version_reference: q.model_version_reference,
        model_artifact_reference: q.artifact,
        adoption: {
          adoption_id: adopted.body.data.adoption.adoption_id,
          adoption_digest: adopted.body.data.adoption.adoption_digest
        }
      };
      const runtimeBinding = {
        engine_reference: formal.engine_reference,
        parameter_set_reference: formal.parameter_set_reference,
        scenario_package_reference: formal.scenario_package_reference,
        seed: 42
      };
      const runBody = {
        formal_runtime_binding: runtimeBinding,
        qualified_run_admission: admission
      };
      const exactWrites = () =>
        JSON.stringify({
          runs: store.runs,
          rounds: store.rounds,
          bindings: store.formalRunRuntimeBindings
        });
      const prior = exactWrites();
      const invalidBodies = [
        { formal_runtime_binding: runtimeBinding },
        { ...runBody, qualified_run_admission: { ...admission, adoption: undefined } },
        {
          ...runBody,
          qualified_run_admission: {
            ...admission,
            adoption: { ...admission.adoption, adoption_digest: "f".repeat(64) }
          }
        },
        { ...runBody, qualified_run_admission: { ...admission, course_id: "course_other" } },
        { ...runBody, qualified_run_admission: { ...admission, qualification_id: "missing-q" } },
        {
          ...runBody,
          qualified_run_admission: { ...admission, source_package_id: "missing-source" }
        },
        {
          ...runBody,
          qualified_run_admission: { ...admission, calibration_dataset_id: "missing-dataset" }
        },
        {
          ...runBody,
          qualified_run_admission: {
            ...admission,
            model_version_reference: { ...admission.model_version_reference, version: "99.0.0" }
          }
        },
        {
          ...runBody,
          qualified_run_admission: {
            ...admission,
            model_artifact_reference: {
              ...admission.model_artifact_reference,
              content_digest: "f".repeat(64)
            }
          }
        },
        { ...runBody, qualified_run_admission: { ...admission, fallback: "latest" } }
      ];
      for (const body of invalidBodies) {
        const result = await api(`/api/v1/courses/${scope.course_id}/runs`, token, body);
        expect(result.status, JSON.stringify(result.body)).toBe(
          body.qualified_run_admission?.course_id === "course_other" ? 403 : 422
        );
        expect(exactWrites()).toBe(prior);
      }
      const wrongTenant = await api(
        `/api/v1/courses/${scope.course_id}/runs`,
        token,
        runBody,
        "tenant_wrong" as typeof scope.tenant_id
      );
      expect(wrongTenant.status).toBe(403);
      expect(exactWrites()).toBe(prior);
      const run = await api<{ run: Run }>(
        `/api/v1/courses/${scope.course_id}/runs`,
        token,
        runBody
      );
      expect(run.status, JSON.stringify(run.body)).toBe(201);
      expect(run.body.data.run).not.toHaveProperty("qualified_admission_snapshot");
      const afterRun = exactWrites();
      const state = source.getRecordForScope(scope);
      expect(state).toBeDefined();
      // vNext request and public contract forbid silently ignored selector fields.
      const unknown = await api(`${root}/request`, token, {
        ...requestBody,
        command_id: "unknown-selector",
        expected_adoption: admission.adoption,
        fallback: "latest"
      });
      expect(unknown.status, JSON.stringify(unknown.body)).toBe(422);
      expect(exactWrites()).toBe(afterRun);
      const legacyAfter = await api(legacyPath, token);
      expect(legacyAfter.body.data).toEqual(legacyBefore.body.data);
      expect(JSON.stringify(legacy)).toBe(originalLegacy);
      expect(legacyWrites).not.toHaveBeenCalled();
      expect(store.runs.find((item) => item.run_id === legacyRun.run_id)).not.toHaveProperty(
        "qualified_admission_snapshot"
      );
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
      vi.useRealTimers();
    }
  }, 30_000);
});
