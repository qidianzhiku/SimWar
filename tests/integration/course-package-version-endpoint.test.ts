import { once } from "node:events";
import { request as nodeRequest, type Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  CoursePackageVersion,
  CoursePackageVersionDraftInput
} from "../../packages/shared-contracts/src";
import { CourseBlueprintCommandService } from "../../services/api/src/course-blueprint-authority";
import { calculateCoursePackageContentDigest } from "../../services/api/src/course-package-json-registry";
import { createJsonFormalScenarioAuthorityRuntime } from "../../services/api/src/formal-scenario-authority-runtime";
import { createJsonFormalScenarioAuthorityPersistence } from "../../services/api/src/json-repository-adapter";
import { createApiServer } from "../../services/api/src/server";
import { DEFAULT_TENANT_ID, createP1Store, type SimWarStore } from "../../services/api/src/store";

const VERSION = "1.0.0";
const COURSE_PACKAGE_BASE = "/api/v1/admin/course-package-versions";

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

async function login(baseUrl: string, username: string, password: string): Promise<AuthSession> {
  const response = await requestJson<ApiEnvelope<AuthSession>>(`${baseUrl}/api/v1/auth/login`, {
    body: { password, username },
    headers: { "content-type": "application/json", "x-tenant-id": DEFAULT_TENANT_ID },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return response.body.data;
}

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

async function seedApprovedSources(store: SimWarStore) {
  const persistence = createJsonFormalScenarioAuthorityPersistence(store);
  const formal = createJsonFormalScenarioAuthorityRuntime(persistence);
  const actor = {
    actor_id: "usr_platform",
    capabilities: ["course_blueprint:manage", "parameter_set:manage", "scenario_package:manage"],
    correlation_id: "course_package_endpoint_seed",
    tenant_id: DEFAULT_TENANT_ID
  };
  const parameterDraft = await formal.parameterSets.createDraft(actor, {
    compatibility_metadata: { engine_family: "toy_logit" },
    model_version_ref: "toy_logit_wellness_v1@0.1.0",
    parameter_set_id: "parameter_course_package_api",
    parameter_values: { base_capacity: 120 },
    schema_version: "parameter-set.v1",
    tenant_id: DEFAULT_TENANT_ID,
    version: VERSION
  });
  const parameterValidated = await formal.parameterSets.validate(actor, parameterDraft.reference);
  const parameterFrozen = await formal.parameterSets.freeze(actor, parameterValidated.reference);
  const parameterApproved = await formal.parameterSets.approve(
    actor,
    parameterFrozen.reference,
    "course_package_parameter_approval"
  );
  const scenarioDraft = await formal.scenarioPackages.createDraft(actor, {
    artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" },
    compatibility_metadata: { scenario_family: "wellness" },
    content: { rounds: 1 },
    metadata: { title: "Course package endpoint scenario" },
    parameter_set_reference: parameterApproved.version.reference,
    plugin_dependencies: [],
    scenario_package_id: "scenario_course_package_api",
    schema_version: "scenario-package.v1",
    tenant_id: DEFAULT_TENANT_ID,
    version: VERSION
  });
  const scenarioValidated = await formal.scenarioPackages.validate(actor, scenarioDraft.reference);
  const scenarioFrozen = await formal.scenarioPackages.freeze(actor, scenarioValidated.reference);
  const scenarioApproved = await formal.scenarioPackages.approve(
    actor,
    scenarioFrozen.reference,
    "course_package_scenario_approval"
  );
  const blueprints = new CourseBlueprintCommandService(persistence.createCourseBlueprintRegistry());
  const blueprintDraft = await blueprints.createDraft(actor, {
    activity_plan: [{ activity_id: "course_package_activity" }],
    course_blueprint_id: "blueprint_course_package_api",
    description: "Course package endpoint blueprint.",
    duration_minutes: 60,
    instructor_guidance_reference: "guide://course-package",
    objectives: ["Validate CoursePackageVersion endpoint behavior."],
    ordered_phases: [
      {
        activity_type: "briefing",
        duration_minutes: 60,
        order: 1,
        phase_id: "course_package_phase",
        student_instruction: "Read the brief.",
        teacher_guidance: "Keep it bounded.",
        title: "Briefing"
      }
    ],
    required_product_capabilities: ["course:create"],
    scenario_compatibility_constraints: { scenario_family: "wellness" },
    schema_version: "course-blueprint.v1",
    tenant_id: DEFAULT_TENANT_ID,
    title: "Course package endpoint blueprint",
    version: VERSION
  });
  const blueprintValidated = await blueprints.validate(actor, blueprintDraft.reference);
  const blueprintFrozen = await blueprints.freeze(actor, blueprintValidated.reference);
  const blueprintApproved = await blueprints.approve(
    actor,
    blueprintFrozen.reference,
    "course_package_blueprint_approval"
  );

  return {
    course_blueprint_reference: blueprintApproved.version.reference,
    parameter_set_reference: parameterApproved.version.reference,
    scenario_package_reference: scenarioApproved.version.reference
  };
}

describe("CoursePackageVersion endpoints", () => {
  it("creates, validates, exposes, exports, and clones only a JSON-internal teaching package", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const references = await seedApprovedSources(store);
      const admin = await login(baseUrl, "admin", "admin");
      const teacher = await login(baseUrl, "teacher", "teacher");
      const student = await login(baseUrl, "student", "student");
      const adminHeaders = {
        authorization: `Bearer ${admin.access_token}`,
        "content-type": "application/json",
        "x-tenant-id": DEFAULT_TENANT_ID
      };
      const beforeProtectedRecords = structuredClone({
        courses: store.courses,
        decisions: store.decisions,
        formalCourseAuthorityBindings: store.formalCourseAuthorityBindings,
        formalCourseBlueprintLifecycleSnapshots: store.formalCourseBlueprintLifecycleSnapshots,
        formalParameterSetLifecycleSnapshots: store.formalParameterSetLifecycleSnapshots,
        formalScenarioPackageLifecycleSnapshots: store.formalScenarioPackageLifecycleSnapshots,
        runs: store.runs,
        settlementResults: store.settlementResults
      });
      const body = {
        ...references,
        course_package_id: "course_package_endpoint_api",
        description: "Endpoint-only teaching package.",
        title: "Endpoint package",
        version: VERSION
      };
      const created = await requestJson<ApiEnvelope<CoursePackageVersion>>(
        `${baseUrl}${COURSE_PACKAGE_BASE}/drafts`,
        { body, headers: adminHeaders, method: "POST" }
      );

      expect(created.status).toBe(201);
      expect(created.body.data).toMatchObject({
        created_by: "usr_admin",
        status: "DRAFT",
        tenant_id: DEFAULT_TENANT_ID
      });
      const exactReference = {
        content_digest: created.body.data.content_digest,
        course_package_id: body.course_package_id,
        version: VERSION
      };
      const transition = (action: string) =>
        `${baseUrl}${COURSE_PACKAGE_BASE}/${body.course_package_id}/versions/${VERSION}/${action}`;
      expect(
        (
          await requestJson(transition("make-available"), {
            body: exactReference,
            headers: adminHeaders,
            method: "POST"
          })
        ).status
      ).toBe(409);
      expect(
        (
          await requestJson(transition("validate"), {
            body: exactReference,
            headers: adminHeaders,
            method: "POST"
          })
        ).status
      ).toBe(200);
      expect(
        (
          await requestJson(transition("make-available"), {
            body: exactReference,
            headers: adminHeaders,
            method: "POST"
          })
        ).status
      ).toBe(200);
      const exported = await requestJson<
        ApiEnvelope<{ course_package_version: CoursePackageVersion }>
      >(
        `${baseUrl}${COURSE_PACKAGE_BASE}/${body.course_package_id}/versions/${VERSION}/export?content_digest=${exactReference.content_digest}`,
        { headers: adminHeaders }
      );
      expect(exported.status).toBe(200);
      expect(exported.body.data.course_package_version.status).toBe("AVAILABLE");
      const importedDraft: CoursePackageVersionDraftInput = {
        ...exported.body.data.course_package_version,
        course_package_id: "course_package_endpoint_import",
        description: "Imported teaching-only package.",
        title: "Endpoint import"
      };
      const imported = await requestJson<ApiEnvelope<{ status: string }>>(
        `${baseUrl}${COURSE_PACKAGE_BASE}/import`,
        {
          body: {
            source_course_package_version: {
              ...exported.body.data.course_package_version,
              ...importedDraft,
              content_digest: calculateCoursePackageContentDigest(importedDraft)
            }
          },
          headers: adminHeaders,
          method: "POST"
        }
      );
      expect(imported.status).toBe(201);
      expect(imported.body.data.status).toBe("DRAFT");
      const cloned = await requestJson<ApiEnvelope<{ status: string }>>(
        `${baseUrl}${COURSE_PACKAGE_BASE}/clone`,
        {
          body: {
            course_package_id: "course_package_endpoint_clone",
            description: "Independent endpoint clone.",
            source_course_package_reference: exactReference,
            title: "Endpoint clone",
            version: VERSION
          },
          headers: adminHeaders,
          method: "POST"
        }
      );
      expect(cloned.status).toBe(201);
      expect(cloned.body.data.status).toBe("DRAFT");
      const teacherClone = await requestJson<
        ApiEnvelope<{ course_package_reference: { course_package_id: string } }>
      >(`${baseUrl}/api/v1/bff/teacher/course-package-versions/clone`, {
        body: {
          course_package_id: "course_package_teacher_clone",
          description: "Teacher-owned package clone.",
          source_course_package_reference: exactReference,
          title: "Teacher package clone",
          version: VERSION
        },
        headers: {
          authorization: `Bearer ${teacher.access_token}`,
          "content-type": "application/json",
          "x-tenant-id": DEFAULT_TENANT_ID
        },
        method: "POST"
      });
      expect(teacherClone.status).toBe(201);
      expect(teacherClone.body.data.course_package_reference.course_package_id).toBe(
        "course_package_teacher_clone"
      );
      expect(JSON.stringify(teacherClone.body.data)).not.toContain("created_by");
      expect(
        (
          await requestJson(`${baseUrl}/api/v1/bff/teacher/course-package-versions/clone`, {
            body: {
              course_package_id: "course_package_student_clone",
              description: "Student clone must be denied.",
              source_course_package_reference: exactReference,
              title: "Denied student clone",
              version: VERSION
            },
            headers: {
              authorization: `Bearer ${student.access_token}`,
              "content-type": "application/json",
              "x-tenant-id": DEFAULT_TENANT_ID
            },
            method: "POST"
          })
        ).status
      ).toBe(403);
      const teacherCatalog = await requestJson<
        ApiEnvelope<{ course_package_versions: Array<Record<string, unknown>> }>
      >(`${baseUrl}/api/v1/bff/teacher/course-package-versions`, {
        headers: {
          authorization: `Bearer ${teacher.access_token}`,
          "x-tenant-id": DEFAULT_TENANT_ID
        }
      });
      expect(teacherCatalog.status).toBe(200);
      expect(teacherCatalog.body.data.course_package_versions).toEqual([
        expect.objectContaining({ title: body.title })
      ]);
      expect(JSON.stringify(teacherCatalog.body.data)).not.toContain("created_by");
      expect(
        (
          await requestJson(`${baseUrl}/api/v1/bff/teacher/course-package-versions`, {
            headers: {
              authorization: `Bearer ${student.access_token}`,
              "x-tenant-id": DEFAULT_TENANT_ID
            }
          })
        ).status
      ).toBe(403);
      expect(
        (
          await requestJson(`${baseUrl}${COURSE_PACKAGE_BASE}/drafts`, {
            body: { ...body, tenant_id: "tenant_other" },
            headers: adminHeaders,
            method: "POST"
          })
        ).status
      ).toBe(422);
      expect({
        courses: store.courses,
        decisions: store.decisions,
        formalCourseAuthorityBindings: store.formalCourseAuthorityBindings,
        formalCourseBlueprintLifecycleSnapshots: store.formalCourseBlueprintLifecycleSnapshots,
        formalParameterSetLifecycleSnapshots: store.formalParameterSetLifecycleSnapshots,
        formalScenarioPackageLifecycleSnapshots: store.formalScenarioPackageLifecycleSnapshots,
        runs: store.runs,
        settlementResults: store.settlementResults
      }).toEqual(beforeProtectedRecords);
    } finally {
      await stopServer(server);
    }
  });
});
