import { once } from "node:events";
import { request as nodeRequest, type Server } from "node:http";
import { describe, expect, it } from "vitest";
import {
  M1_TEACHING_PRODUCT_PACKAGE,
  type ApiEnvelope,
  type AuthSession
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { DEFAULT_TENANT_ID, PLATFORM_TENANT_ID, createP1Store, type SimWarStore } from "../../services/api/src/store";

const BASE_PATH = "/api/v1/formal-authority/course-blueprints";
const BLUEPRINT_ID = "blueprint_api_c1";
const VERSION = "1.0.0";

async function requestJson<T>(url: string, options: { body?: unknown; headers?: Record<string, string>; method?: string } = {}) {
  return new Promise<{ body: T; status: number }>((resolve, reject) => {
    const request = nodeRequest(url, { headers: options.headers, method: options.method ?? "GET" }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => {
        try { resolve({ body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as T, status: response.statusCode ?? 0 }); }
        catch (error) { reject(error); }
      });
    });
    request.on("error", reject);
    if (options.body !== undefined) request.write(JSON.stringify(options.body));
    request.end();
  });
}

async function login(baseUrl: string, username: string, password: string, tenantId: string): Promise<AuthSession> {
  const response = await requestJson<ApiEnvelope<AuthSession>>(`${baseUrl}/api/v1/auth/login`, {
    body: { password, username }, headers: { "content-type": "application/json", "x-tenant-id": tenantId }, method: "POST"
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
  if (!address || typeof address === "string") throw new Error("test server did not bind to a TCP port");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function stopServer(server: Server): Promise<void> { server.close(); await once(server, "close"); }

function body(tenantId = DEFAULT_TENANT_ID) {
  return {
    activity_plan: [{ activity_id: "activity_api" }],
    course_blueprint_id: BLUEPRINT_ID,
    description: "Endpoint lifecycle fixture.",
    duration_minutes: 60,
    instructor_guidance_reference: "guide://api-c1",
    objectives: ["Validate the lifecycle."],
    ordered_phases: [{ activity_type: "briefing", duration_minutes: 60, order: 1, phase_id: "phase_api", student_instruction: "Read", teacher_guidance: "Guide", title: "Briefing" }],
    required_product_capabilities: ["course:create"],
    scenario_compatibility_constraints: { scenario_family: "wellness" },
    schema_version: "course-blueprint.v1",
    tenant_id: tenantId,
    title: "API Blueprint",
    version: VERSION
  };
}

describe("formal CourseBlueprint lifecycle endpoint", () => {
  it("permits only a platform admin to create an append-only exact lifecycle and audit trail", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const platform = await login(baseUrl, "platform", "platform", PLATFORM_TENANT_ID);
      const headers = { authorization: `Bearer ${platform.access_token}`, "content-type": "application/json", "x-tenant-id": DEFAULT_TENANT_ID };
      const draft = await requestJson<ApiEnvelope<{ reference: Record<string, string>; status: string }>>(`${baseUrl}${BASE_PATH}`, { body: body(), headers, method: "POST" });
      expect(draft.status).toBe(201);
      const reference = draft.body.data.reference;
      for (const action of ["validate", "freeze"]) {
        const transition = await requestJson<ApiEnvelope<{ status: string }>>(`${baseUrl}${BASE_PATH}/${BLUEPRINT_ID}/versions/${VERSION}/${action}`, { body: reference, headers, method: "POST" });
        expect(transition.status).toBe(200);
      }
      const approved = await requestJson<ApiEnvelope<{ version: { status: string } }>>(`${baseUrl}${BASE_PATH}/${BLUEPRINT_ID}/versions/${VERSION}/approve`, { body: { ...reference, approval_id: "approval_api_c1" }, headers, method: "POST" });
      expect(approved.body.data.version.status).toBe("APPROVED");
      const teacher = await login(baseUrl, "teacher", "teacher", DEFAULT_TENANT_ID);
      const catalog = await requestJson<ApiEnvelope<{ candidates: unknown[] }>>(`${baseUrl}/api/v1/bff/teacher/course-blueprints`, {
        headers: { authorization: `Bearer ${teacher.access_token}` }
      });
      expect(catalog.status).toBe(200);
      const catalogJson = JSON.stringify(catalog.body);
      expect(catalogJson).not.toContain("approval_api_c1");
      expect(catalogJson).not.toContain("guide://api-c1");
      expect(catalogJson).not.toContain("binding_digest");
      expect(catalogJson).not.toContain("audit");
      const student = await login(baseUrl, "student", "student", DEFAULT_TENANT_ID);
      expect((await requestJson(`${baseUrl}/api/v1/bff/teacher/course-blueprints`, {
        headers: { authorization: `Bearer ${student.access_token}` }
      })).status).toBe(403);
      const retired = await requestJson<ApiEnvelope<{ status: string }>>(`${baseUrl}${BASE_PATH}/${BLUEPRINT_ID}/versions/${VERSION}/retire`, { body: reference, headers, method: "POST" });
      expect(retired.body.data.status).toBe("RETIRED");
      expect(store.formalCourseBlueprintLifecycleSnapshots).toHaveLength(5);
      expect(store.formalCourseBlueprintApprovalRecords).toHaveLength(1);
      expect(store.auditLogs.filter((entry) => entry.action.startsWith("course_blueprint.")).map((entry) => entry.action)).toEqual([
        "course_blueprint.create", "course_blueprint.validate", "course_blueprint.freeze", "course_blueprint.approve", "course_blueprint.retire"
      ]);
    } finally { await stopServer(server); }
  });

  it("rejects a tenant admin, cross-tenant input, and lifecycle jumps with no Blueprint snapshot", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const platform = await login(baseUrl, "platform", "platform", PLATFORM_TENANT_ID);
      const admin = await login(baseUrl, "admin", "admin", DEFAULT_TENANT_ID);
      const platformHeaders = { authorization: `Bearer ${platform.access_token}`, "content-type": "application/json", "x-tenant-id": DEFAULT_TENANT_ID };
      const adminHeaders = { authorization: `Bearer ${admin.access_token}`, "content-type": "application/json", "x-tenant-id": DEFAULT_TENANT_ID };
      expect((await requestJson(`${baseUrl}${BASE_PATH}`, { body: body(), headers: adminHeaders, method: "POST" })).status).toBe(403);
      expect((await requestJson(`${baseUrl}${BASE_PATH}`, { body: body("tenant_other"), headers: platformHeaders, method: "POST" })).status).toBe(422);
      expect((await requestJson(`${baseUrl}${BASE_PATH}/${BLUEPRINT_ID}/versions/${VERSION}/approve`, { body: { content_digest: "a".repeat(64), course_blueprint_id: BLUEPRINT_ID, tenant_id: DEFAULT_TENANT_ID, version: VERSION, approval_id: "nope" }, headers: platformHeaders, method: "POST" })).status).toBe(404);
      expect(store.formalCourseBlueprintLifecycleSnapshots).toEqual([]);
    } finally { await stopServer(server); }
  });

  it("creates independent C1 and B5 bindings only from server-resolved exact references", async () => {
    const store = createP1Store();
    const scenarioReference = { content_digest: "a".repeat(64), scenario_package_id: "scenario_c1", tenant_id: DEFAULT_TENANT_ID, version: "1.0.0" };
    const parameterReference = { content_digest: "b".repeat(64), parameter_set_id: "parameter_c1", version: "1.0.0" };
    const server = createApiServer(store, {
      formalRunBindingAuthorities: {
        parameterSets: { assertBindable: async () => undefined, getByReference: async () => ({ model_version_ref: "toy_logit_wellness_v1@0.1.0", reference: parameterReference, status: "APPROVED", tenant_id: DEFAULT_TENANT_ID }) },
        plugins: { getByReference: async () => null, resolveAvailableForNewBinding: async () => ({ status: "AVAILABLE" }) },
        scenarios: { assertBindable: async () => undefined, getByReference: async () => ({ compatibility_metadata: { scenario_family: "wellness" }, parameter_set_reference: parameterReference, plugin_dependencies: [], reference: scenarioReference, status: "APPROVED", tenant_id: DEFAULT_TENANT_ID }) }
      } as never
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server did not bind to a TCP port");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    try {
      const platform = await login(baseUrl, "platform", "platform", PLATFORM_TENANT_ID);
      const headers = { authorization: `Bearer ${platform.access_token}`, "content-type": "application/json", "x-tenant-id": DEFAULT_TENANT_ID };
      const draft = await requestJson<ApiEnvelope<{ reference: Record<string, string> }>>(`${baseUrl}${BASE_PATH}`, { body: { ...body(), course_blueprint_id: "blueprint_create_c1" }, headers, method: "POST" });
      const reference = draft.body.data.reference;
      for (const action of ["validate", "freeze", "approve"] as const) {
        await requestJson(`${baseUrl}${BASE_PATH}/blueprint_create_c1/versions/${VERSION}/${action}`, {
          body: action === "approve" ? { ...reference, approval_id: "approval_create_c1" } : reference,
          headers,
          method: "POST"
        });
      }
      const teacher = await login(baseUrl, "teacher", "teacher", DEFAULT_TENANT_ID);
      const teacherHeaders = { authorization: `Bearer ${teacher.access_token}`, "content-type": "application/json", "x-tenant-id": DEFAULT_TENANT_ID };
      const created = await requestJson<ApiEnvelope<{ course: { course_id: string }; binding_summary: { course_blueprint_reference: Record<string, string> } }>>(
        `${baseUrl}/api/v1/bff/teacher/course-blueprint-courses`,
        {
          body: {
            binding_digest: "forged-binding-digest",
            course_blueprint_reference: reference,
            engine_reference: { engine_id: "forged", version: "latest" },
            parameter_set_reference: {
              content_digest: "f".repeat(64),
              parameter_set_id: "forged_parameter",
              version: "latest"
            },
            plugin_dependencies: [{ plugin_package_id: "forged_plugin", version: "latest" }],
            scenario_package_reference: scenarioReference,
            title: "C1 exact Course"
          },
          headers: teacherHeaders,
          method: "POST"
        }
      );
      expect(created.status).toBe(201);
      expect(created.body.data.binding_summary.course_blueprint_reference).toEqual(reference);
      expect(store.courseBlueprintBindings).toHaveLength(1);
      expect(store.courseBlueprintBindings[0]?.binding_digest).not.toBe("forged-binding-digest");
      expect(store.formalCourseAuthorityBindings).toHaveLength(1);
      expect(store.formalCourseAuthorityBindings[0]?.scenario_package_reference).toEqual(scenarioReference);
      expect(store.formalCourseAuthorityBindings[0]?.parameter_set_reference).toEqual(parameterReference);
      expect(store.formalCourseAuthorityBindings[0]?.engine_reference).toEqual({
        engine_id: "toy_logit_wellness_v1",
        version: "0.1.0"
      });
      expect(JSON.stringify(store.formalCourseAuthorityBindings[0])).not.toContain("forged");
      expect(store.courses).toContainEqual(expect.objectContaining({ course_id: created.body.data.course.course_id }));

      const countsBeforeLegacyAttempt = {
        blueprints: store.courseBlueprintBindings.length,
        courses: store.courses.length,
        formal: store.formalCourseAuthorityBindings.length
      };
      const legacyAttempt = await requestJson(
        `${baseUrl}/api/v1/bff/teacher/course-blueprint-courses`,
        {
          body: {
            course_blueprint_reference: M1_TEACHING_PRODUCT_PACKAGE.courseBlueprint,
            scenario_package_reference: scenarioReference,
            title: "Static v0 must not bind"
          },
          headers: teacherHeaders,
          method: "POST"
        }
      );
      expect(legacyAttempt.status).toBe(422);
      expect({
        blueprints: store.courseBlueprintBindings.length,
        courses: store.courses.length,
        formal: store.formalCourseAuthorityBindings.length
      }).toEqual(countsBeforeLegacyAttempt);
    } finally { await stopServer(server); }
  });
});
