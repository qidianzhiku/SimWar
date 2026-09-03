import { once } from "node:events";
import { request as nodeRequest, type Server } from "node:http";
import { describe, expect, it } from "vitest";
import type { ApiEnvelope, AuthSession } from "../../packages/shared-contracts/src";
import type {
  ModelQualificationAdminProjection,
  ModelQualificationStudentProjection,
  ModelQualificationTeacherProjection
} from "../../packages/shared-contracts/src";
import { MODEL_QUALIFICATION_MODEL_VERSION } from "../../services/api/src/model-qualification-service";
import { createApiServer } from "../../services/api/src/server";
import { DEFAULT_TENANT_ID, OTHER_TENANT_ID, createP1Store } from "../../services/api/src/store";

interface JsonOptions {
  body?: unknown;
  headers?: Record<string, string>;
  method?: string;
}

async function requestJson<T>(
  url: string,
  options: JsonOptions = {}
): Promise<{ body: T; status: number }> {
  return new Promise((resolve, reject) => {
    const request = nodeRequest(
      url,
      { headers: options.headers, method: options.method ?? "GET" },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          try {
            resolve({
              body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as T,
              status: response.statusCode ?? 0
            });
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.on("error", reject);
    if (options.body !== undefined) request.write(JSON.stringify(options.body));
    request.end();
  });
}

async function login(baseUrl: string, username: string, tenantId = DEFAULT_TENANT_ID) {
  const response = await requestJson<ApiEnvelope<AuthSession>>(`${baseUrl}/api/v1/auth/login`, {
    body: { password: username, username },
    headers: { "content-type": "application/json", "x-tenant-id": tenantId },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return response.body.data;
}

async function startServer(): Promise<{
  baseUrl: string;
  server: Server;
  store: ReturnType<typeof createP1Store>;
}> {
  const store = createP1Store();
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function api<T>(
  baseUrl: string,
  path: string,
  token: string,
  method = "GET",
  body?: unknown,
  tenantId = DEFAULT_TENANT_ID
) {
  return requestJson<T>(`${baseUrl}${path}`, {
    body,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-tenant-id": tenantId
    },
    method
  });
}

const sourceBody = {
  content_digest: "a".repeat(64),
  course_id: "course_demo",
  evidence_refs: ["fixture:generic-source:1"],
  feature_schema_digest: "b".repeat(64),
  freshness_status: "FRESH",
  observed_at: "2026-08-30T12:00:00.000Z",
  quality: { conflict_count: 0, missingness_rate: 0.02, record_count: 4 },
  rights_status: "VALID",
  source_ref: "fixture://generic-source",
  source_version: "1.0.0",
  title: "Generic source-backed demand fixture"
};

describe("source-backed model qualification BFF", () => {
  it("executes teacher register → qualify → review → bind and role-safe projections", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const teacher = await login(baseUrl, "teacher");
      const student = await login(baseUrl, "student");
      const admin = await login(baseUrl, "admin");

      const source = await api<ApiEnvelope<{ source_package: { source_package_id: string } }>>(
        baseUrl,
        "/api/v1/bff/teacher/model-qualification/source-packages",
        teacher.access_token,
        "POST",
        sourceBody
      );
      expect(source.status).toBe(201);
      const sourceId = source.body.data.source_package.source_package_id;

      const dataset = await api<
        ApiEnvelope<{ calibration_dataset: { calibration_dataset_id: string } }>
      >(baseUrl, "/api/v1/bff/teacher/model-qualification/datasets", teacher.access_token, "POST", {
        calibration_record_ids: ["cal-1", "cal-2"],
        content_digest: "c".repeat(64),
        course_id: "course_demo",
        holdout_record_ids: ["holdout-1", "holdout-2"],
        source_package_id: sourceId
      });
      expect(dataset.status).toBe(201);
      const datasetId = dataset.body.data.calibration_dataset.calibration_dataset_id;

      const clientDiagnostics = await api(
        baseUrl,
        "/api/v1/bff/teacher/model-qualification/qualifications",
        teacher.access_token,
        "POST",
        {
          calibration_dataset_id: datasetId,
          course_id: "course_demo",
          deterministic_seed: 42,
          diagnostics: {
            baseline_error: 0,
            convergence_status: "CONVERGED",
            differential_error: 0,
            drift_score: 0,
            ood_rate: 0,
            sensitivity_max_delta: 0
          },
          model_version_reference: MODEL_QUALIFICATION_MODEL_VERSION.model_version_reference,
          source_package_id: sourceId
        }
      );
      expect(clientDiagnostics.status).toBe(422);

      const qualification = await api<
        ApiEnvelope<{ qualification: { qualification_id: string; decision: string } }>
      >(
        baseUrl,
        "/api/v1/bff/teacher/model-qualification/qualifications",
        teacher.access_token,
        "POST",
        {
          calibration_dataset_id: datasetId,
          course_id: "course_demo",
          deterministic_seed: 42,
          model_version_reference: MODEL_QUALIFICATION_MODEL_VERSION.model_version_reference,
          source_package_id: sourceId
        }
      );
      expect(qualification.status).toBe(201);
      expect(qualification.body.data.qualification.decision).toBe("APPROVED");
      const qualificationId = qualification.body.data.qualification.qualification_id;

      const bindBeforeReview = await api(
        baseUrl,
        `/api/v1/bff/teacher/model-qualification/qualifications/${qualificationId}/bind?courseId=course_demo`,
        teacher.access_token,
        "POST"
      );
      expect(bindBeforeReview.status).toBe(409);

      const reviewed = await api<ApiEnvelope<{ qualification: { review: { status: string } } }>>(
        baseUrl,
        `/api/v1/bff/teacher/model-qualification/qualifications/${qualificationId}/review?courseId=course_demo`,
        teacher.access_token,
        "POST",
        { decision: "APPROVED", note: "Reviewed against the exact offline fixture." }
      );
      expect(reviewed.status).toBe(200);
      expect(reviewed.body.data.qualification.review.status).toBe("APPROVED");

      const bound = await api<ApiEnvelope<{ qualification: { binding: { status: string } } }>>(
        baseUrl,
        `/api/v1/bff/teacher/model-qualification/qualifications/${qualificationId}/bind?courseId=course_demo`,
        teacher.access_token,
        "POST"
      );
      expect(bound.status).toBe(200);
      expect(bound.body.data.qualification.binding.status).toBe("BOUND");

      const teacherProjection = await api<ApiEnvelope<ModelQualificationTeacherProjection>>(
        baseUrl,
        "/api/v1/bff/teacher/model-qualification?courseId=course_demo",
        teacher.access_token
      );
      const adminProjection = await api<ApiEnvelope<ModelQualificationAdminProjection>>(
        baseUrl,
        "/api/v1/bff/admin/model-qualification?courseId=course_demo",
        admin.access_token
      );
      const studentProjection = await api<ApiEnvelope<ModelQualificationStudentProjection>>(
        baseUrl,
        `/api/v1/bff/student/model-qualification?courseId=course_demo&qualificationId=${qualificationId}`,
        student.access_token
      );

      expect(teacherProjection.status).toBe(200);
      expect(adminProjection.status).toBe(200);
      expect(studentProjection.status).toBe(200);
      expect(adminProjection.body.data.authority.writes_formal_truth).toBe(false);
      expect(studentProjection.body.data.visibility).toBe("ROLE_SAFE_STUDENT");
      expect(studentProjection.body.data.qualification.review_status).toBe("APPROVED");
      expect(studentProjection.body.data.qualification.binding_status).toBe("BOUND");
      const studentJson = JSON.stringify(studentProjection.body.data);
      expect(studentJson).not.toContain("source_ref");
      expect(studentJson).not.toContain("content_digest");
      expect(studentJson).not.toContain("artifact_id");
      expect(store.modelQualificationRecords?.[0]?.qualifications).toHaveLength(1);
      expect(
        store.auditLogs
          .filter((audit) => audit.resource_type === "model_qualification")
          .map((audit) => audit.action)
      ).toEqual([
        "model_qualification.source_register",
        "model_qualification.dataset_register",
        "model_qualification.run",
        "model_qualification.review",
        "model_qualification.bind"
      ]);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });

  it("keeps requalification preview review and student exposure bounded to one exact course", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const teacher = await login(baseUrl, "teacher");
      const student = await login(baseUrl, "student");
      const baseline = await api<ApiEnvelope<{ source_package: { source_package_id: string } }>>(
        baseUrl,
        "/api/v1/bff/teacher/model-qualification/source-packages",
        teacher.access_token,
        "POST",
        sourceBody
      );
      const baselineSourceId = baseline.body.data.source_package.source_package_id;
      const baselineDataset = await api<
        ApiEnvelope<{ calibration_dataset: { calibration_dataset_id: string } }>
      >(baseUrl, "/api/v1/bff/teacher/model-qualification/datasets", teacher.access_token, "POST", {
        calibration_record_ids: ["baseline-calibration"],
        content_digest: "c".repeat(64),
        course_id: "course_demo",
        holdout_record_ids: ["baseline-holdout"],
        source_package_id: baselineSourceId
      });
      const baselineQualification = await api<
        ApiEnvelope<{ qualification: { qualification_id: string } }>
      >(
        baseUrl,
        "/api/v1/bff/teacher/model-qualification/qualifications",
        teacher.access_token,
        "POST",
        {
          calibration_dataset_id:
            baselineDataset.body.data.calibration_dataset.calibration_dataset_id,
          course_id: "course_demo",
          deterministic_seed: 42,
          model_version_reference: MODEL_QUALIFICATION_MODEL_VERSION.model_version_reference,
          source_package_id: baselineSourceId
        }
      );

      const candidate = await api<ApiEnvelope<{ source_package: { source_package_id: string } }>>(
        baseUrl,
        "/api/v1/bff/teacher/model-qualification/source-packages",
        teacher.access_token,
        "POST",
        {
          ...sourceBody,
          content_digest: "d".repeat(64),
          evidence_refs: ["fixture:generic-source:1", "fixture:replacement:1"],
          source_ref: "fixture://generic-source-replacement",
          source_version: "2.0.0",
          title: "Generic source-backed replacement fixture"
        }
      );
      expect(candidate.status).toBe(201);
      const candidateSourceId = candidate.body.data.source_package.source_package_id;
      const preview = await api<
        ApiEnvelope<{
          preview: {
            preview_id: string;
            status: string;
            change_set: { affected_qualification_ids: string[] };
          };
        }>
      >(
        baseUrl,
        "/api/v1/bff/teacher/model-qualification/requalification-previews",
        teacher.access_token,
        "POST",
        {
          baseline_source_package_id: baselineSourceId,
          candidate_source_package_id: candidateSourceId,
          course_id: "course_demo"
        }
      );
      expect(preview.status).toBe(201);
      expect(preview.body.data.preview).toMatchObject({
        status: "REQUALIFICATION_REQUIRED",
        change_set: {
          affected_qualification_ids: [
            baselineQualification.body.data.qualification.qualification_id
          ]
        }
      });

      const candidateDataset = await api<
        ApiEnvelope<{ calibration_dataset: { calibration_dataset_id: string } }>
      >(baseUrl, "/api/v1/bff/teacher/model-qualification/datasets", teacher.access_token, "POST", {
        calibration_record_ids: ["candidate-calibration"],
        content_digest: "e".repeat(64),
        course_id: "course_demo",
        holdout_record_ids: ["candidate-holdout"],
        source_package_id: candidateSourceId
      });
      const candidateQualification = await api<
        ApiEnvelope<{ qualification: { qualification_id: string } }>
      >(
        baseUrl,
        "/api/v1/bff/teacher/model-qualification/qualifications",
        teacher.access_token,
        "POST",
        {
          calibration_dataset_id:
            candidateDataset.body.data.calibration_dataset.calibration_dataset_id,
          course_id: "course_demo",
          deterministic_seed: 42,
          model_version_reference: MODEL_QUALIFICATION_MODEL_VERSION.model_version_reference,
          source_package_id: candidateSourceId
        }
      );
      const candidateQualificationId =
        candidateQualification.body.data.qualification.qualification_id;
      const reviewedCandidate = await api(
        baseUrl,
        `/api/v1/bff/teacher/model-qualification/qualifications/${candidateQualificationId}/review?courseId=course_demo`,
        teacher.access_token,
        "POST",
        { decision: "APPROVED", note: "Candidate qualification reviewed." }
      );
      expect(reviewedCandidate.status).toBe(200);

      const bindBeforePreviewReview = await api(
        baseUrl,
        `/api/v1/bff/teacher/model-qualification/qualifications/${candidateQualificationId}/bind?courseId=course_demo`,
        teacher.access_token,
        "POST"
      );
      expect(bindBeforePreviewReview.status).toBe(409);

      const foreignPreview = await api(
        baseUrl,
        "/api/v1/bff/teacher/model-qualification/requalification-previews",
        teacher.access_token,
        "POST",
        {
          baseline_source_package_id: baselineSourceId,
          candidate_source_package_id: candidateSourceId,
          course_id: "course_demo"
        },
        OTHER_TENANT_ID
      );
      expect([401, 403]).toContain(foreignPreview.status);

      const review = await api(
        baseUrl,
        `/api/v1/bff/teacher/model-qualification/requalification-previews/${preview.body.data.preview.preview_id}/review?courseId=course_demo`,
        teacher.access_token,
        "POST",
        { decision: "APPROVED", note: "Exact baseline and replacement evidence reviewed." }
      );
      expect(review.status).toBe(200);
      const bound = await api(
        baseUrl,
        `/api/v1/bff/teacher/model-qualification/qualifications/${candidateQualificationId}/bind?courseId=course_demo`,
        teacher.access_token,
        "POST"
      );
      expect(bound.status).toBe(200);

      const studentProjection = await api<ApiEnvelope<ModelQualificationStudentProjection>>(
        baseUrl,
        `/api/v1/bff/student/model-qualification?courseId=course_demo&qualificationId=${candidateQualificationId}`,
        student.access_token
      );
      expect(studentProjection.status).toBe(200);
      expect(studentProjection.body.data.requalification).toMatchObject({
        historical_non_overwrite: true,
        resolution: "ACCEPTED",
        review_status: "APPROVED",
        status: "REQUALIFICATION_REQUIRED"
      });
      const studentJson = JSON.stringify(studentProjection.body.data);
      expect(studentJson).not.toContain("source_package_id");
      expect(studentJson).not.toContain("content_digest");
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });

  it("fails closed for tenant scope and holdout leakage", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const teacher = await login(baseUrl, "teacher");
      const student = await login(baseUrl, "student");
      const foreignRead = await api(
        baseUrl,
        "/api/v1/bff/teacher/model-qualification?courseId=course_demo",
        teacher.access_token,
        "GET",
        undefined,
        OTHER_TENANT_ID
      );
      expect([401, 403]).toContain(foreignRead.status);

      const source = await api<ApiEnvelope<{ source_package: { source_package_id: string } }>>(
        baseUrl,
        "/api/v1/bff/teacher/model-qualification/source-packages",
        teacher.access_token,
        "POST",
        sourceBody
      );
      const leakage = await api<
        ApiEnvelope<{
          calibration_dataset: {
            status: string;
            holdout_leakage_count: number;
            zero_holdout_leakage: boolean;
          };
        }>
      >(baseUrl, "/api/v1/bff/teacher/model-qualification/datasets", teacher.access_token, "POST", {
        calibration_record_ids: ["same-record"],
        content_digest: "d".repeat(64),
        course_id: "course_demo",
        holdout_record_ids: ["same-record"],
        source_package_id: source.body.data.source_package.source_package_id
      });
      expect(leakage.status).toBe(201);
      expect(leakage.body.data.calibration_dataset).toMatchObject({
        holdout_leakage_count: 1,
        status: "NOT_ELIGIBLE",
        zero_holdout_leakage: false
      });

      const team = store.teams.find((candidate) => candidate.team_id === "team_alpha");
      if (!team) throw new Error("seed team missing");
      team.captain_user_id = "usr_default_cfo";
      team.members = team.members.filter((member) => member.user_id !== "usr_student");
      const nonMemberRead = await api(
        baseUrl,
        "/api/v1/bff/student/model-qualification?courseId=course_demo&qualificationId=missing",
        student.access_token
      );
      expect([401, 403]).toContain(nonMemberRead.status);

      const mismatchedCourseScope = await api(
        baseUrl,
        "/api/v1/bff/teacher/model-qualification/source-packages?courseId=course_other",
        teacher.access_token,
        "POST",
        sourceBody
      );
      expect([401, 403, 422]).toContain(mismatchedCourseScope.status);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
});
