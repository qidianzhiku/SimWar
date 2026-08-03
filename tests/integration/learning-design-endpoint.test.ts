import { once } from "node:events";
import { request as nodeRequest } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  CoursePackageVersionDraftInput,
  LearningGoalVersion
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store, DEFAULT_TENANT_ID, type SimWarStore } from "../../services/api/src/store";
import {
  createCoursePackageDraftVersion,
  createCoursePackageLifecycleSnapshot,
  calculateCoursePackageContentDigest
} from "../../services/api/src/course-package-json-registry";

const digest = "a".repeat(64);

async function requestJson<T>(
  url: string,
  options: { body?: unknown; headers?: Record<string, string>; method?: string } = {}
): Promise<{ body: T; status: number }> {
  return new Promise((resolve, reject) => {
    const request = nodeRequest(
      url,
      { headers: options.headers, method: options.method ?? "GET" },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as T,
            status: response.statusCode ?? 0
          })
        );
      }
    );
    request.on("error", reject);
    if (options.body !== undefined) request.write(JSON.stringify(options.body));
    request.end();
  });
}

async function seedAvailablePackage(store: SimWarStore) {
  const input: CoursePackageVersionDraftInput = {
    course_blueprint_reference: {
      content_digest: digest,
      course_blueprint_id: "blueprint_d1_demo",
      tenant_id: DEFAULT_TENANT_ID,
      version: "1.0.0"
    },
    course_package_id: "course_package_d1_demo",
    description: "D1 endpoint package",
    parameter_set_reference: {
      content_digest: digest,
      parameter_set_id: "parameter_d1_demo",
      version: "1.0.0"
    },
    scenario_package_reference: {
      content_digest: digest,
      scenario_package_id: "scenario_d1_demo",
      tenant_id: DEFAULT_TENANT_ID,
      version: "1.0.0"
    },
    title: "D1 package",
    version: "1.0.0"
  };
  const draft = createCoursePackageDraftVersion({
    actor_id: "usr_teacher",
    draft: input,
    now: "2026-08-03T00:00:00.000Z",
    tenant_id: DEFAULT_TENANT_ID
  });
  const validated = createCoursePackageLifecycleSnapshot(draft, "VALIDATED");
  const available = createCoursePackageLifecycleSnapshot(validated, "AVAILABLE");
  store.coursePackageLifecycleSnapshots.push(draft, validated, available);
  expect(available.content_digest).toBe(calculateCoursePackageContentDigest(input));
  return available;
}

async function start() {
  const store = createP1Store();
  const packageVersion = await seedAvailablePackage(store);
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  return { baseUrl: `http://127.0.0.1:${address.port}`, packageVersion, server, store };
}

async function login(baseUrl: string, username: string, password: string): Promise<AuthSession> {
  const response = await requestJson<ApiEnvelope<AuthSession>>(`${baseUrl}/api/v1/auth/login`, {
    body: { password, username },
    headers: { "content-type": "application/json", "x-tenant-id": DEFAULT_TENANT_ID },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return response.body.data;
}

describe("D1 Teacher learning design endpoints", () => {
  it("keeps the teacher lifecycle tenant-scoped and denies the Student surface", async () => {
    const { baseUrl, packageVersion, server, store } = await start();
    try {
      const teacher = await login(baseUrl, "teacher", "teacher");
      const student = await login(baseUrl, "student", "student");
      const headers = {
        authorization: `Bearer ${teacher.access_token}`,
        "content-type": "application/json",
        "x-tenant-id": DEFAULT_TENANT_ID
      };
      const packageReference = {
        content_digest: packageVersion.content_digest,
        course_package_id: packageVersion.course_package_id,
        tenant_id: DEFAULT_TENANT_ID,
        version: packageVersion.version
      };
      const draft = await requestJson<ApiEnvelope<LearningGoalVersion>>(
        `${baseUrl}/api/v1/bff/teacher/learning-goals/drafts`,
        {
          body: {
            activity_refs: [
              { activity_id: "activity_observe_v1", content_digest: digest, version: "1.0.0" }
            ],
            course_package_reference: packageReference,
            expected_evidence_classes: ["reflection"],
            goal_id: "goal_endpoint_demo",
            observable_behaviors: ["compare evidence"],
            role_scope: ["teacher"],
            statement: "Compare evidence.",
            title: "Endpoint goal",
            version: "1.0.0"
          },
          headers,
          method: "POST"
        }
      );
      expect(draft.status).toBe(201);
      const referencePath = `${baseUrl}/api/v1/bff/teacher/learning-goals/goal_endpoint_demo/versions/1.0.0`;
      for (const action of ["validate", "publish"]) {
        const transition = await requestJson<ApiEnvelope<LearningGoalVersion>>(
          `${referencePath}/${action}`,
          { body: { content_digest: draft.body.data.content_digest }, headers, method: "POST" }
        );
        expect(transition.status).toBe(200);
      }
      const list = await requestJson<ApiEnvelope<{ learning_goals: LearningGoalVersion[] }>>(
        `${baseUrl}/api/v1/bff/teacher/learning-designs`,
        { headers }
      );
      expect(list.status).toBe(200);
      expect(list.body.data.learning_goals[0]?.status).toBe("PUBLISHED");
      expect(JSON.stringify(list.body.data)).not.toContain("business_score_weight");
      expect(store.learningGoalVersions.map((item) => item.status)).toEqual([
        "DRAFT",
        "VALIDATED",
        "PUBLISHED"
      ]);

      const rubricDraft = await requestJson<ApiEnvelope<Record<string, unknown>>>(
        `${baseUrl}/api/v1/bff/teacher/rubrics/drafts`,
        {
          body: {
            course_package_reference: packageReference,
            criteria: [
              {
                criterion_id: "criterion_reasoning",
                levels: [{ description: "evidence", label: "developing", ordinal: 1 }],
                prompt: "How clear?"
              }
            ],
            learning_goal_references: [
              {
                content_digest: draft.body.data.content_digest,
                goal_id: draft.body.data.goal_id,
                tenant_id: DEFAULT_TENANT_ID,
                version: draft.body.data.version
              }
            ],
            rubric_id: "rubric_endpoint_demo",
            title: "Endpoint rubric",
            version: "1.0.0"
          },
          headers,
          method: "POST"
        }
      );
      expect(rubricDraft.status).toBe(201);
      const rubricReferencePath = `${baseUrl}/api/v1/bff/teacher/rubrics/rubric_endpoint_demo/versions/1.0.0`;
      for (const action of ["validate", "publish"]) {
        const transition = await requestJson<ApiEnvelope<Record<string, unknown>>>(
          `${rubricReferencePath}/${action}`,
          {
            body: { content_digest: rubricDraft.body.data.content_digest },
            headers,
            method: "POST"
          }
        );
        expect(transition.status).toBe(200);
      }
      expect(store.rubricVersions.map((item) => item.status)).toEqual([
        "DRAFT",
        "VALIDATED",
        "PUBLISHED"
      ]);

      const studentRead = await requestJson(`${baseUrl}/api/v1/bff/teacher/learning-designs`, {
        headers: {
          authorization: `Bearer ${student.access_token}`,
          "x-tenant-id": DEFAULT_TENANT_ID
        }
      });
      expect(studentRead.status).toBe(403);
      const malformed = await requestJson(`${baseUrl}/api/v1/bff/teacher/learning-goals/drafts`, {
        body: { ...{}, business_score_weight: 1 },
        headers,
        method: "POST"
      });
      expect(malformed.status).toBe(422);
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
