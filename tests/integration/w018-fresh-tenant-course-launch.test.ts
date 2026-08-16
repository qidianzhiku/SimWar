import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  CoursePackageVersion,
  Tenant,
  User
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";
import { createFormalCanonicalDecision } from "./formal-canonical-admission-helper";

type Ref = {
  content_digest: string;
  parameter_set_id?: string;
  scenario_package_id?: string;
  course_blueprint_id?: string;
  tenant_id?: string;
  version: string;
};
type ErrorBody = { code: string; message: string };

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function request<T>(
  baseUrl: string,
  path: string,
  options: { body?: unknown; method?: string; tenantId?: string; token?: string } = {}
): Promise<{ body: T; status: number; headers: Headers }> {
  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers: {
      authorization: options.token ? `Bearer ${options.token}` : "",
      "content-type": "application/json",
      "x-tenant-id": options.tenantId ?? "tenant_platform"
    },
    method: options.method ?? (options.body === undefined ? "GET" : "POST")
  });
  return { body: (await response.json()) as T, headers: response.headers, status: response.status };
}

async function login(
  baseUrl: string,
  username: string,
  password: string,
  tenantId: string
): Promise<string> {
  const result = await request<ApiEnvelope<AuthSession>>(baseUrl, "/api/v1/auth/login", {
    body: { password, username },
    tenantId
  });
  expect(result.status).toBe(200);
  return result.body.data.access_token;
}

async function createTenant(baseUrl: string, token: string, name: string): Promise<Tenant> {
  const result = await request<ApiEnvelope<Tenant>>(baseUrl, "/api/v1/admin/tenants", {
    body: { domain: `${name}.w018.test`, name },
    token,
    tenantId: "tenant_platform"
  });
  expect(result.status).toBe(201);
  return result.body.data;
}

async function createUser(
  baseUrl: string,
  token: string,
  tenantId: string,
  username: string,
  password: string,
  roles: string[]
): Promise<User> {
  const result = await request<ApiEnvelope<User>>(baseUrl, "/api/v1/admin/users", {
    body: {
      display_name: username,
      email: `${username}@w018.test`,
      password,
      roles,
      tenant_id: tenantId,
      username
    },
    token,
    tenantId: "tenant_platform"
  });
  expect(result.status).toBe(201);
  return result.body.data;
}

async function approveParameter(
  baseUrl: string,
  token: string,
  tenantId: string,
  id: string
): Promise<Ref> {
  const draft = await request<ApiEnvelope<{ reference: Ref }>>(
    baseUrl,
    "/api/v1/formal-authority/parameter-sets",
    {
      body: {
        compatibility_metadata: { engine_family: "toy_logit" },
        model_version_ref: "toy_logit_wellness_v1@0.1.0",
        parameter_set_id: id,
        parameter_values: {
          runtime_parameter_set: {
            base_capacity: 80,
            base_market_size: 100,
            fixed_cost: 10,
            model_family: "toy_logit",
            unit_cost: 2
          }
        },
        schema_version: "parameter-set.v1",
        tenant_id: tenantId,
        version: "1.0.0"
      },
      token,
      tenantId
    }
  );
  expect(draft.status).toBe(201);
  for (const action of ["validate", "freeze", "approve"]) {
    const step = await request<ApiEnvelope<unknown>>(
      baseUrl,
      `/api/v1/formal-authority/parameter-sets/${id}/versions/1.0.0/${action}`,
      {
        body: {
          ...draft.body.data.reference,
          tenant_id: tenantId,
          ...(action === "approve" ? { approval_id: `${id}-approval` } : {})
        },
        token,
        tenantId
      }
    );
    expect(step.status, JSON.stringify(step.body)).toBe(200);
  }
  return draft.body.data.reference;
}

async function approveScenario(
  baseUrl: string,
  token: string,
  tenantId: string,
  id: string,
  parameter: Ref
): Promise<Ref> {
  const draft = await request<ApiEnvelope<{ reference: Ref }>>(
    baseUrl,
    "/api/v1/formal-authority/scenario-packages",
    {
      body: {
        artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" },
        compatibility_metadata: { scenario_family: "wellness" },
        content: {
          runtime_scenario_package: { name: "W018 tenant baseline", plugin_package_ids: [] },
          rounds: [{ index: 1, label: "W018 baseline" }]
        },
        metadata: { title: `W018 ${tenantId} scenario` },
        parameter_set_reference: parameter,
        plugin_dependencies: [],
        scenario_package_id: id,
        schema_version: "scenario-package.v1",
        tenant_id: tenantId,
        version: "1.0.0"
      },
      token,
      tenantId
    }
  );
  expect(draft.status).toBe(201);
  for (const action of ["validate", "freeze", "approve"]) {
    const step = await request<ApiEnvelope<unknown>>(
      baseUrl,
      `/api/v1/formal-authority/scenario-packages/${id}/versions/1.0.0/${action}`,
      {
        body: {
          ...draft.body.data.reference,
          tenant_id: tenantId,
          ...(action === "approve" ? { approval_id: `${id}-approval` } : {})
        },
        token,
        tenantId
      }
    );
    expect(step.status, JSON.stringify(step.body)).toBe(200);
  }
  return draft.body.data.reference;
}

async function approveBlueprint(
  baseUrl: string,
  token: string,
  tenantId: string,
  id: string
): Promise<Ref> {
  const draft = await request<ApiEnvelope<{ reference: Ref }>>(
    baseUrl,
    "/api/v1/formal-authority/course-blueprints",
    {
      body: {
        activity_plan: [{ activity_id: "w018_activity" }],
        course_blueprint_id: id,
        description: "W018 fresh tenant launch blueprint.",
        duration_minutes: 60,
        instructor_guidance_reference: "guide://w018",
        objectives: ["Complete the bounded Golden M1 journey."],
        ordered_phases: [
          {
            activity_type: "briefing",
            duration_minutes: 60,
            order: 1,
            phase_id: "w018_phase",
            student_instruction: "Submit the canonical decision.",
            teacher_guidance: "Review the published result.",
            title: "W018 Golden M1"
          }
        ],
        required_product_capabilities: ["course:create"],
        scenario_compatibility_constraints: { scenario_family: "wellness" },
        schema_version: "course-blueprint.v1",
        tenant_id: tenantId,
        title: "W018 Golden M1",
        version: "1.0.0"
      },
      token,
      tenantId
    }
  );
  expect(draft.status).toBe(201);
  for (const action of ["validate", "freeze", "approve"]) {
    const step = await request<ApiEnvelope<unknown>>(
      baseUrl,
      `/api/v1/formal-authority/course-blueprints/${id}/versions/1.0.0/${action}`,
      {
        body: {
          ...draft.body.data.reference,
          tenant_id: tenantId,
          ...(action === "approve" ? { approval_id: `${id}-approval` } : {})
        },
        token,
        tenantId
      }
    );
    expect(step.status, JSON.stringify(step.body)).toBe(200);
  }
  return { ...draft.body.data.reference, tenant_id: tenantId };
}

async function availableCoursePackage(
  baseUrl: string,
  token: string,
  tenantId: string,
  suffix: string,
  blueprint: Ref,
  scenario: Ref,
  parameter: Ref
): Promise<CoursePackageVersion> {
  const draft = await request<ApiEnvelope<CoursePackageVersion>>(
    baseUrl,
    "/api/v1/admin/course-package-versions/drafts",
    {
      body: {
        course_blueprint_reference: blueprint,
        course_package_id: `w018-package-${suffix}`,
        description: "W018 exact tenant-local CoursePackage.",
        parameter_set_reference: parameter,
        scenario_package_reference: scenario,
        title: `W018 CoursePackage ${suffix}`,
        version: "1.0.0"
      },
      token,
      tenantId
    }
  );
  expect(draft.status).toBe(201);
  const reference = {
    content_digest: draft.body.data.content_digest,
    course_package_id: draft.body.data.course_package_id,
    version: draft.body.data.version
  };
  for (const action of ["validate", "make-available"]) {
    const step = await request<ApiEnvelope<CoursePackageVersion>>(
      baseUrl,
      `/api/v1/admin/course-package-versions/${reference.course_package_id}/versions/1.0.0/${action}`,
      { body: reference, token, tenantId }
    );
    expect(step.status).toBe(200);
    if (action === "make-available") return step.body.data;
  }
  throw new Error("W018 CoursePackage did not become available");
}

async function completeTenantJourney(
  baseUrl: string,
  store: SimWarStore,
  tenant: Tenant,
  teacherToken: string,
  studentToken: string,
  studentUserId: string,
  scenario: Ref,
  blueprint: Ref
): Promise<{
  courseId: string;
  runId: string;
  artifact: Record<string, unknown>;
  result: Record<string, unknown>;
}> {
  const created = await request<ApiEnvelope<{ course: { course_id: string } }>>(
    baseUrl,
    "/api/v1/bff/teacher/course-blueprint-courses",
    {
      body: {
        course_blueprint_reference: blueprint,
        scenario_package_reference: scenario,
        title: `W018 ${tenant.tenant_id} course`
      },
      tenantId: tenant.tenant_id,
      token: teacherToken
    }
  );
  expect(created.status).toBe(201);
  const courseId = created.body.data.course.course_id;
  const publishedCourse = await request<ApiEnvelope<unknown> | ErrorBody>(
    baseUrl,
    `/api/v1/courses/${courseId}/publish`,
    { method: "POST", tenantId: tenant.tenant_id, token: teacherToken }
  );
  expect(publishedCourse.status, JSON.stringify(publishedCourse.body)).toBe(200);
  const team = await request<ApiEnvelope<{ team_id: string }>>(
    baseUrl,
    `/api/v1/courses/${courseId}/teams`,
    {
      body: { captain_user_id: studentUserId, name: "W018 team" },
      tenantId: tenant.tenant_id,
      token: teacherToken
    }
  );
  expect(team.status).toBe(201);
  const runResponse = await request<ApiEnvelope<{ run: { run_id: string } }>>(
    baseUrl,
    `/api/v1/courses/${courseId}/runs`,
    { body: { formal_runtime_seed: 18 }, tenantId: tenant.tenant_id, token: teacherToken }
  );
  expect(runResponse.status, JSON.stringify(runResponse.body)).toBe(201);
  const runId = runResponse.body.data.run.run_id;
  expect(
    (
      await request(baseUrl, `/api/v1/runs/${runId}/rounds/1/start`, {
        method: "POST",
        tenantId: tenant.tenant_id,
        token: teacherToken
      })
    ).status
  ).toBe(200);
  await createFormalCanonicalDecision(store, runId, team.body.data.team_id, studentUserId);
  expect(
    (
      await request(baseUrl, `/api/v1/runs/${runId}/rounds/1/lock`, {
        method: "POST",
        tenantId: tenant.tenant_id,
        token: teacherToken
      })
    ).status
  ).toBe(200);
  const settlement = await request(baseUrl, `/api/v1/runs/${runId}/rounds/1/settle`, {
    method: "POST",
    tenantId: tenant.tenant_id,
    token: teacherToken
  });
  expect(settlement.status).toBe(200);
  expect(
    (
      await request(baseUrl, `/api/v1/runs/${runId}/rounds/1/publish`, {
        method: "POST",
        tenantId: tenant.tenant_id,
        token: teacherToken
      })
    ).status
  ).toBe(200);
  const studentResult = await request<ApiEnvelope<Record<string, unknown>>>(
    baseUrl,
    `/api/v1/runs/${runId}/rounds/1/results`,
    { tenantId: tenant.tenant_id, token: studentToken }
  );
  expect(studentResult.status).toBe(200);
  expect(JSON.stringify(studentResult.body.data)).not.toContain("state_true");
  expect(JSON.stringify(studentResult.body.data)).not.toContain("replay_hash");
  const asset = await request<ApiEnvelope<{ asset_id: string }>>(
    baseUrl,
    "/api/v1/bff/teacher/instructor-assets/drafts",
    {
      body: { course_id: courseId, title: "W018 Debrief" },
      tenantId: tenant.tenant_id,
      token: teacherToken
    }
  );
  expect(asset.status).toBe(201);
  expect(
    (
      await request(
        baseUrl,
        `/api/v1/bff/teacher/instructor-assets/${asset.body.data.asset_id}/publish`,
        { body: {}, method: "POST", tenantId: tenant.tenant_id, token: teacherToken }
      )
    ).status
  ).toBe(200);
  const artifact = await request<ApiEnvelope<Record<string, unknown>>>(
    baseUrl,
    `/api/v1/bff/teacher/instructor-debrief-artifact?asset_id=${asset.body.data.asset_id}&run_id=${runId}&round_no=1`,
    { tenantId: tenant.tenant_id, token: teacherToken }
  );
  expect(artifact.status).toBe(200);
  const exportResponse = await fetch(
    `${baseUrl}/api/v1/bff/teacher/instructor-debrief-artifact/export?asset_id=${asset.body.data.asset_id}&run_id=${runId}&round_no=1&format=markdown`,
    { headers: { authorization: `Bearer ${teacherToken}`, "x-tenant-id": tenant.tenant_id } }
  );
  expect(exportResponse.status).toBe(200);
  expect(await exportResponse.text()).toContain(String(artifact.body.data.artifact_digest));
  return { artifact: artifact.body.data, courseId, result: studentResult.body.data, runId };
}

describe("W018 fresh tenant CoursePackage to Debrief journey", () => {
  it("keeps two tenant launches exact, isolated, settled, published, and exportable", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const platformToken = await login(baseUrl, "platform", "platform", "tenant_platform");
      const sourceTenant = await createTenant(baseUrl, platformToken, "w018-source");
      const tenantA = await createTenant(baseUrl, platformToken, "w018-a");
      const tenantB = await createTenant(baseUrl, platformToken, "w018-b");
      const sourceParameter = await approveParameter(
        baseUrl,
        platformToken,
        sourceTenant.tenant_id,
        "w018-source-parameter"
      );
      const sourceScenario = await approveScenario(
        baseUrl,
        platformToken,
        sourceTenant.tenant_id,
        "w018-source-scenario",
        sourceParameter
      );
      const users = await Promise.all(
        ["a", "b"].map(async (suffix) => {
          const tenant = suffix === "a" ? tenantA : tenantB;
          await createUser(
            baseUrl,
            platformToken,
            tenant.tenant_id,
            `w018-admin-${suffix}`,
            "admin-password",
            ["tenant_admin"]
          );
          await createUser(
            baseUrl,
            platformToken,
            tenant.tenant_id,
            `w018-teacher-${suffix}`,
            "teacher-password",
            ["teacher"]
          );
          const student = await createUser(
            baseUrl,
            platformToken,
            tenant.tenant_id,
            `w018-student-${suffix}`,
            "student-password",
            ["learner", "team_captain"]
          );
          return {
            studentUserId: student.user_id,
            adminToken: await login(
              baseUrl,
              `w018-admin-${suffix}`,
              "admin-password",
              tenant.tenant_id
            ),
            tenant,
            studentToken: await login(
              baseUrl,
              `w018-student-${suffix}`,
              "student-password",
              tenant.tenant_id
            ),
            teacherToken: await login(
              baseUrl,
              `w018-teacher-${suffix}`,
              "teacher-password",
              tenant.tenant_id
            )
          };
        })
      );
      const baselines = await Promise.all(
        users.map(async ({ tenant }) => {
          const response = await request<
            ApiEnvelope<{ parameter_set: { reference: Ref }; scenario_package: { reference: Ref } }>
          >(baseUrl, "/api/v1/admin/tenant-baselines/provision", {
            body: {
              idempotency_key: `w018-${tenant.tenant_id}`,
              source_parameter_set: {
                ...sourceParameter,
                source_tenant_id: sourceTenant.tenant_id
              },
              source_scenario_package: {
                ...sourceScenario,
                source_tenant_id: sourceTenant.tenant_id
              },
              target_tenant_id: tenant.tenant_id
            },
            tenantId: "tenant_platform",
            token: platformToken
          });
          expect(response.status).toBe(201);
          return response.body.data;
        })
      );
      const journeys = [] as Array<{
        courseId: string;
        runId: string;
        artifact: Record<string, unknown>;
        result: Record<string, unknown>;
      }>;
      for (const [
        index,
        { adminToken, tenant, teacherToken, studentToken, studentUserId }
      ] of users.entries()) {
        const localParameter = baselines[index]!.parameter_set.reference;
        const localScenario = baselines[index]!.scenario_package.reference;
        const blueprint = await approveBlueprint(
          baseUrl,
          platformToken,
          tenant.tenant_id,
          `w018-blueprint-${index === 0 ? "a" : "b"}`
        );
        const coursePackage = await availableCoursePackage(
          baseUrl,
          adminToken,
          tenant.tenant_id,
          index === 0 ? "a" : "b",
          blueprint,
          localScenario,
          localParameter
        );
        expect(coursePackage.status).toBe("AVAILABLE");
        expect(coursePackage.tenant_id).toBe(tenant.tenant_id);
        journeys.push(
          await completeTenantJourney(
            baseUrl,
            store,
            tenant,
            teacherToken,
            studentToken,
            studentUserId,
            localScenario,
            blueprint
          )
        );
      }
      expect(journeys[0]!.courseId).not.toBe(journeys[1]!.courseId);
      expect(journeys[0]!.runId).not.toBe(journeys[1]!.runId);
      expect(journeys[0]!.artifact).toHaveProperty("artifact_digest");
      expect(journeys[1]!.artifact).toHaveProperty("artifact_digest");
      const crossTenant = await request<ErrorBody>(
        baseUrl,
        `/api/v1/bff/teacher/instructor-debrief-artifact?asset_id=${String(journeys[1]!.artifact.instructor_asset_id)}&run_id=${journeys[1]!.runId}&round_no=1`,
        { tenantId: tenantA.tenant_id, token: users[0]!.teacherToken }
      );
      expect([403, 404]).toContain(crossTenant.status);
    } finally {
      server.close();
      await once(server, "close");
    }
  }, 30_000);
});
