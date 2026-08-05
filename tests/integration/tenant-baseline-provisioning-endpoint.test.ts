import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  CoursePackageVersion,
  Tenant,
  TenantBaselineProvisioningResult,
  User
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

interface ErrorPayload {
  code: string;
  message: string;
  request_id: string;
}

async function startServer(): Promise<{ baseUrl: string; server: Server }> {
  return startServerWithStore(createP1Store());
}

async function startServerWithStore(
  store: SimWarStore
): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

async function request<T>(
  baseUrl: string,
  path: string,
  options: { body?: unknown; method?: string; tenantId?: string; token?: string } = {}
): Promise<{ body: T; status: number }> {
  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers: {
      authorization: options.token ? `Bearer ${options.token}` : "",
      "content-type": "application/json",
      "x-tenant-id": options.tenantId ?? "tenant_platform"
    },
    method: options.method ?? "POST"
  });
  return { body: (await response.json()) as T, status: response.status };
}

async function login(
  baseUrl: string,
  username = "platform",
  password = "platform",
  tenantId = "tenant_platform"
): Promise<string> {
  const response = await request<ApiEnvelope<AuthSession>>(baseUrl, "/api/v1/auth/login", {
    body: { password, username },
    tenantId
  });
  expect(response.status).toBe(200);
  return response.body.data.access_token;
}

async function createTenant(baseUrl: string, token: string, name: string): Promise<Tenant> {
  const response = await request<ApiEnvelope<Tenant>>(baseUrl, "/api/v1/admin/tenants", {
    body: { domain: `${name}.tenant.test`, name },
    tenantId: "tenant_platform",
    token
  });
  expect(response.status).toBe(201);
  return response.body.data;
}

async function createUser(
  baseUrl: string,
  token: string,
  input: { password: string; roles: string[]; tenant_id: string; username: string }
): Promise<User> {
  const response = await request<ApiEnvelope<User>>(baseUrl, "/api/v1/admin/users", {
    body: {
      display_name: input.username,
      email: `${input.username}@tenant.test`,
      password: input.password,
      roles: input.roles,
      tenant_id: input.tenant_id,
      username: input.username
    },
    tenantId: "tenant_platform",
    token
  });
  expect(response.status).toBe(201);
  return response.body.data;
}

interface ParameterReference {
  content_digest: string;
  parameter_set_id: string;
  version: string;
}

interface ScenarioReference {
  content_digest: string;
  scenario_package_id: string;
  tenant_id: string;
  version: string;
}

interface CourseBlueprintReference {
  content_digest: string;
  course_blueprint_id: string;
  tenant_id: string;
  version: string;
}

async function createApprovedParameterSet(
  baseUrl: string,
  token: string,
  tenantId: string,
  parameterSetId: string
): Promise<ParameterReference> {
  const draft = await request<ApiEnvelope<{ reference: ParameterReference }>>(
    baseUrl,
    "/api/v1/formal-authority/parameter-sets",
    {
      body: {
        compatibility_metadata: { engine_family: "toy_logit" },
        model_version_ref: "toy_logit_wellness_v1@0.1.0",
        parameter_set_id: parameterSetId,
        parameter_values: { base_capacity: 80, base_market_size: 100 },
        schema_version: "parameter-set.v1",
        tenant_id: tenantId,
        version: "1.0.0"
      },
      tenantId,
      token
    }
  );
  expect(draft.status).toBe(201);
  const reference = draft.body.data.reference;
  for (const action of ["validate", "freeze", "approve"]) {
    const response = await request<ApiEnvelope<unknown>>(
      baseUrl,
      `/api/v1/formal-authority/parameter-sets/${parameterSetId}/versions/1.0.0/${action}`,
      {
        body: {
          ...reference,
          ...(action === "approve" ? { approval_id: `${parameterSetId}_approval` } : {}),
          tenant_id: tenantId
        },
        tenantId,
        token
      }
    );
    expect(response.status).toBe(200);
  }
  return reference;
}

async function createScenarioDraft(
  baseUrl: string,
  token: string,
  tenantId: string,
  scenarioPackageId: string,
  parameterSetReference: ParameterReference
): Promise<ScenarioReference> {
  const draft = await request<ApiEnvelope<{ reference: ScenarioReference }>>(
    baseUrl,
    "/api/v1/formal-authority/scenario-packages",
    {
      body: {
        artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" },
        compatibility_metadata: { scenario_family: "wellness" },
        content: { rounds: 1 },
        metadata: { title: "Tenant baseline source scenario" },
        parameter_set_reference: parameterSetReference,
        plugin_dependencies: [],
        scenario_package_id: scenarioPackageId,
        schema_version: "scenario-package.v1",
        tenant_id: tenantId,
        version: "1.0.0"
      },
      tenantId,
      token
    }
  );
  expect(draft.status).toBe(201);
  return draft.body.data.reference;
}

async function approveScenario(
  baseUrl: string,
  token: string,
  tenantId: string,
  scenarioPackageId: string,
  reference: ScenarioReference
): Promise<ScenarioReference> {
  for (const action of ["validate", "freeze", "approve"]) {
    const response = await request<ApiEnvelope<unknown>>(
      baseUrl,
      `/api/v1/formal-authority/scenario-packages/${scenarioPackageId}/versions/1.0.0/${action}`,
      {
        body: {
          ...reference,
          ...(action === "approve" ? { approval_id: `${scenarioPackageId}_approval` } : {})
        },
        tenantId,
        token
      }
    );
    expect(response.status).toBe(200);
  }
  return reference;
}

async function createApprovedCourseBlueprint(
  baseUrl: string,
  token: string,
  tenantId: string,
  courseBlueprintId: string
): Promise<CourseBlueprintReference> {
  const draft = await request<ApiEnvelope<{ reference: CourseBlueprintReference }>>(
    baseUrl,
    "/api/v1/formal-authority/course-blueprints",
    {
      body: {
        activity_plan: [{ activity_id: "baseline_activity" }],
        course_blueprint_id: courseBlueprintId,
        description: "Tenant-local bootstrap blueprint.",
        duration_minutes: 60,
        instructor_guidance_reference: "guide://tenant-baseline",
        objectives: ["Bootstrap a tenant-local CoursePackage."],
        ordered_phases: [
          {
            activity_type: "briefing",
            duration_minutes: 60,
            order: 1,
            phase_id: "baseline_phase",
            student_instruction: "Read the scenario.",
            teacher_guidance: "Keep the session bounded.",
            title: "Briefing"
          }
        ],
        required_product_capabilities: ["course:create"],
        scenario_compatibility_constraints: { scenario_family: "wellness" },
        schema_version: "course-blueprint.v1",
        tenant_id: tenantId,
        title: "Tenant baseline blueprint",
        version: "1.0.0"
      },
      tenantId,
      token
    }
  );
  expect(draft.status).toBe(201);
  const reference = draft.body.data.reference;
  for (const action of ["validate", "freeze", "approve"]) {
    const response = await request<ApiEnvelope<unknown>>(
      baseUrl,
      `/api/v1/formal-authority/course-blueprints/${courseBlueprintId}/versions/1.0.0/${action}`,
      {
        body: {
          ...reference,
          ...(action === "approve" ? { approval_id: `${courseBlueprintId}_approval` } : {})
        },
        tenantId,
        token
      }
    );
    expect(response.status).toBe(200);
  }
  return reference;
}

async function bootstrapCoursePackage(
  baseUrl: string,
  coursePackageToken: string,
  platformToken: string,
  tenantId: string,
  suffix: string,
  scenarioPackageReference: ScenarioReference,
  parameterSetReference: ParameterReference
): Promise<CoursePackageVersion> {
  const courseBlueprintReference = await createApprovedCourseBlueprint(
    baseUrl,
    platformToken,
    tenantId,
    `baseline_blueprint_${suffix}`
  );
  const draft = await request<ApiEnvelope<CoursePackageVersion>>(
    baseUrl,
    "/api/v1/admin/course-package-versions/drafts",
    {
      body: {
        course_blueprint_reference: courseBlueprintReference,
        course_package_id: `baseline_course_package_${suffix}`,
        description: "Tenant-local baseline CoursePackage.",
        parameter_set_reference: parameterSetReference,
        scenario_package_reference: scenarioPackageReference,
        title: "Tenant baseline CoursePackage",
        version: "1.0.0"
      },
      tenantId,
      token: coursePackageToken
    }
  );
  expect(draft.status).toBe(201);
  const reference = {
    content_digest: draft.body.data.content_digest,
    course_package_id: draft.body.data.course_package_id,
    version: draft.body.data.version
  };
  for (const action of ["validate", "make-available"]) {
    const response = await request<ApiEnvelope<CoursePackageVersion>>(
      baseUrl,
      `/api/v1/admin/course-package-versions/${reference.course_package_id}/versions/1.0.0/${action}`,
      { body: reference, tenantId, token: coursePackageToken }
    );
    expect(response.status).toBe(200);
    if (action === "make-available") return response.body.data;
  }
  throw new Error("CoursePackage did not become available");
}

describe("tenant baseline provisioning endpoint", () => {
  it("is an explicit platform operation rather than a tenant_demo fallback", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const token = await login(baseUrl);
      const response = await request<ErrorPayload>(
        baseUrl,
        "/api/v1/admin/tenant-baselines/provision",
        {
          body: {
            idempotency_key: "baseline-red-001",
            source_parameter_set: {
              content_digest: "a".repeat(64),
              parameter_set_id: "source_parameter",
              source_tenant_id: "tenant_source",
              version: "1.0.0"
            },
            source_scenario_package: {
              content_digest: "b".repeat(64),
              scenario_package_id: "source_scenario",
              source_tenant_id: "tenant_source",
              version: "1.0.0"
            },
            target_tenant_id: "tenant_new"
          },
          token
        }
      );

      expect(response.status).toBe(404);
      expect(response.body.code).toBe("TENANT_BASELINE-404-001");
    } finally {
      await stopServer(server);
    }
  });

  it("materializes two isolated approved baselines through HTTP and reaches CoursePackage AVAILABLE", async () => {
    const store = createP1Store();
    const { baseUrl, server } = await startServerWithStore(store);
    try {
      const platformToken = await login(baseUrl);
      const sourceTenant = await createTenant(baseUrl, platformToken, "baseline-source");
      const tenantA = await createTenant(baseUrl, platformToken, "baseline-a");
      const tenantB = await createTenant(baseUrl, platformToken, "baseline-b");
      expect(
        store.formalParameterSetLifecycleSnapshots.filter(
          (version) =>
            version.tenant_id === tenantA.tenant_id || version.tenant_id === tenantB.tenant_id
        )
      ).toHaveLength(0);
      expect(
        store.formalScenarioPackageLifecycleSnapshots.filter(
          (version) =>
            version.tenant_id === tenantA.tenant_id || version.tenant_id === tenantB.tenant_id
        )
      ).toHaveLength(0);

      await createUser(baseUrl, platformToken, {
        password: "admin-a-password",
        roles: ["tenant_admin"],
        tenant_id: tenantA.tenant_id,
        username: "baseline_admin_a"
      });
      await createUser(baseUrl, platformToken, {
        password: "admin-b-password",
        roles: ["tenant_admin"],
        tenant_id: tenantB.tenant_id,
        username: "baseline_admin_b"
      });
      await createUser(baseUrl, platformToken, {
        password: "teacher-a-password",
        roles: ["teacher"],
        tenant_id: tenantA.tenant_id,
        username: "baseline_teacher_a"
      });

      const sourceParameter = await createApprovedParameterSet(
        baseUrl,
        platformToken,
        sourceTenant.tenant_id,
        "source_parameter"
      );
      const sourceScenarioDraft = await createScenarioDraft(
        baseUrl,
        platformToken,
        sourceTenant.tenant_id,
        "source_scenario",
        sourceParameter
      );
      const sourceScenario = await approveScenario(
        baseUrl,
        platformToken,
        sourceTenant.tenant_id,
        "source_scenario",
        sourceScenarioDraft
      );
      const unapprovedScenario = await createScenarioDraft(
        baseUrl,
        platformToken,
        sourceTenant.tenant_id,
        "source_scenario_unapproved",
        sourceParameter
      );
      const sourceSnapshotsBefore = structuredClone({
        parameter: store.formalParameterSetLifecycleSnapshots.filter(
          (version) => version.tenant_id === sourceTenant.tenant_id
        ),
        scenario: store.formalScenarioPackageLifecycleSnapshots.filter(
          (version) => version.tenant_id === sourceTenant.tenant_id
        )
      });
      const truthBefore = structuredClone({
        decisions: store.decisions,
        formalRunRuntimeBindings: store.formalRunRuntimeBindings,
        rounds: store.rounds,
        runs: store.runs,
        settlementResults: store.settlementResults
      });
      const baseRequest = {
        local_display_metadata: { label: "Course bootstrap baseline" },
        source_parameter_set: { ...sourceParameter, source_tenant_id: sourceTenant.tenant_id },
        source_scenario_package: { ...sourceScenario, source_tenant_id: sourceTenant.tenant_id }
      };
      expect(
        store.formalParameterSetLifecycleSnapshots
          .filter((version) => version.parameter_set_id === "source_parameter")
          .at(-1)?.status
      ).toBe("APPROVED");
      expect(
        store.formalScenarioPackageLifecycleSnapshots
          .filter((version) => version.scenario_package_id === "source_scenario")
          .at(-1)?.status
      ).toBe("APPROVED");

      const unapproved = await request<ErrorPayload>(
        baseUrl,
        "/api/v1/admin/tenant-baselines/provision",
        {
          body: {
            ...baseRequest,
            idempotency_key: "unapproved-source",
            source_scenario_package: {
              ...unapprovedScenario,
              source_tenant_id: sourceTenant.tenant_id
            },
            target_tenant_id: tenantA.tenant_id
          },
          tenantId: "tenant_platform",
          token: platformToken
        }
      );
      expect(unapproved.status).toBe(422);
      expect(unapproved.body.code).toBe("TENANT_BASELINE-422-001");
      const missingSource = await request<ErrorPayload>(
        baseUrl,
        "/api/v1/admin/tenant-baselines/provision",
        {
          body: {
            ...baseRequest,
            idempotency_key: "missing-source",
            source_parameter_set: {
              ...sourceParameter,
              content_digest: "f".repeat(64),
              source_tenant_id: sourceTenant.tenant_id
            },
            target_tenant_id: tenantA.tenant_id
          },
          tenantId: "tenant_platform",
          token: platformToken
        }
      );
      expect(missingSource.status).toBe(404);
      expect(missingSource.body.code).toBe("TENANT_BASELINE-404-001");
      const mixedSourceTenants = await request<ErrorPayload>(
        baseUrl,
        "/api/v1/admin/tenant-baselines/provision",
        {
          body: {
            ...baseRequest,
            idempotency_key: "mixed-source-tenants",
            source_parameter_set: {
              ...sourceParameter,
              source_tenant_id: tenantA.tenant_id
            },
            target_tenant_id: tenantA.tenant_id
          },
          tenantId: "tenant_platform",
          token: platformToken
        }
      );
      expect(mixedSourceTenants.status).toBe(403);
      expect(mixedSourceTenants.body.code).toBe("TENANT_BASELINE-403-001");
      const nonCanonicalTarget = await request<ErrorPayload>(
        baseUrl,
        "/api/v1/admin/tenant-baselines/provision",
        {
          body: {
            ...baseRequest,
            idempotency_key: "noncanonical-target",
            target_tenant_id: ` ${tenantA.tenant_id} `
          },
          tenantId: "tenant_platform",
          token: platformToken
        }
      );
      expect(nonCanonicalTarget.status).toBe(422);
      expect(nonCanonicalTarget.body.code).toBe("TENANT_BASELINE-422-001");
      expect(
        store.formalParameterSetLifecycleSnapshots.some(
          (version) => version.tenant_id === ` ${tenantA.tenant_id} `
        )
      ).toBe(false);

      const tenantAdminToken = await login(
        baseUrl,
        "baseline_admin_a",
        "admin-a-password",
        tenantA.tenant_id
      );
      const teacherToken = await login(
        baseUrl,
        "baseline_teacher_a",
        "teacher-a-password",
        tenantA.tenant_id
      );
      for (const token of [tenantAdminToken, teacherToken]) {
        const denied = await request<ErrorPayload>(
          baseUrl,
          "/api/v1/admin/tenant-baselines/provision",
          {
            body: {
              ...baseRequest,
              idempotency_key: `denied-${token.slice(-8)}`,
              target_tenant_id: tenantA.tenant_id
            },
            tenantId: tenantA.tenant_id,
            token
          }
        );
        expect(denied.status).toBe(403);
        expect(denied.body.code).toBe("TENANT_BASELINE-403-001");
      }
      const studentToken = await login(baseUrl, "student", "student", "tenant_demo");
      const studentDenied = await request<ErrorPayload>(
        baseUrl,
        "/api/v1/admin/tenant-baselines/provision",
        {
          body: {
            ...baseRequest,
            idempotency_key: "denied-student",
            target_tenant_id: tenantA.tenant_id
          },
          tenantId: "tenant_demo",
          token: studentToken
        }
      );
      expect(studentDenied.status).toBe(403);
      expect(studentDenied.body.code).toBe("TENANT_BASELINE-403-001");

      const provision = async (targetTenantId: string, key: string) =>
        request<ApiEnvelope<TenantBaselineProvisioningResult>>(
          baseUrl,
          "/api/v1/admin/tenant-baselines/provision",
          {
            body: { ...baseRequest, idempotency_key: key, target_tenant_id: targetTenantId },
            tenantId: "tenant_platform",
            token: platformToken
          }
        );
      const provisionA = await provision(tenantA.tenant_id, "baseline-tenant-a-v1");
      const provisionB = await provision(tenantB.tenant_id, "baseline-tenant-b-v1");
      expect(
        provisionA.status,
        JSON.stringify({
          body: provisionA.body,
          request: { ...baseRequest, target: tenantA.tenant_id }
        })
      ).toBe(201);
      expect(provisionB.status).toBe(201);
      expect(provisionA.body.data.outcome).toBe("CREATED");
      expect(provisionB.body.data.outcome).toBe("CREATED");
      expect(provisionA.body.data.parameter_set.reference.parameter_set_id).not.toBe(
        provisionB.body.data.parameter_set.reference.parameter_set_id
      );
      expect(provisionA.body.data.scenario_package.reference.scenario_package_id).not.toBe(
        provisionB.body.data.scenario_package.reference.scenario_package_id
      );
      expect(provisionA.body.data.scenario_package.reference.tenant_id).toBe(tenantA.tenant_id);
      expect(provisionB.body.data.scenario_package.reference.tenant_id).toBe(tenantB.tenant_id);
      expect(provisionA.body.data.provenance.source_scenario_package.tenant_id).toBe(
        sourceTenant.tenant_id
      );
      expect(provisionA.body.data.provenance.source_parameter_set.reference).toEqual(
        sourceParameter
      );

      const snapshotCountAfterFirstProvision = {
        parameter: store.formalParameterSetLifecycleSnapshots.length,
        scenario: store.formalScenarioPackageLifecycleSnapshots.length
      };
      const reused = await provision(tenantA.tenant_id, "baseline-tenant-a-v1");
      expect(reused.status).toBe(200);
      expect(reused.body.data.outcome).toBe("REUSED");
      expect(reused.body.data.parameter_set.reference).toEqual(
        provisionA.body.data.parameter_set.reference
      );
      expect(store.formalParameterSetLifecycleSnapshots).toHaveLength(
        snapshotCountAfterFirstProvision.parameter
      );
      expect(store.formalScenarioPackageLifecycleSnapshots).toHaveLength(
        snapshotCountAfterFirstProvision.scenario
      );
      const conflict = await request<ErrorPayload>(
        baseUrl,
        "/api/v1/admin/tenant-baselines/provision",
        {
          body: {
            ...baseRequest,
            idempotency_key: "baseline-tenant-a-v1",
            local_display_metadata: { label: "Conflicting metadata" },
            target_tenant_id: tenantA.tenant_id
          },
          tenantId: "tenant_platform",
          token: platformToken
        }
      );
      expect(conflict.status).toBe(409);
      expect(conflict.body.code).toBe("TENANT_BASELINE-409-001");

      const coursePackageA = await bootstrapCoursePackage(
        baseUrl,
        tenantAdminToken,
        platformToken,
        tenantA.tenant_id,
        "a",
        provisionA.body.data.scenario_package.reference,
        provisionA.body.data.parameter_set.reference
      );
      const tenantBAdminToken = await login(
        baseUrl,
        "baseline_admin_b",
        "admin-b-password",
        tenantB.tenant_id
      );
      const coursePackageB = await bootstrapCoursePackage(
        baseUrl,
        tenantBAdminToken,
        platformToken,
        tenantB.tenant_id,
        "b",
        provisionB.body.data.scenario_package.reference,
        provisionB.body.data.parameter_set.reference
      );
      expect(coursePackageA.status).toBe("AVAILABLE");
      expect(coursePackageB.status).toBe("AVAILABLE");

      const adminReadbackA = await request<
        ApiEnvelope<{ course_package_versions: Array<{ course_package_id: string }> }>
      >(baseUrl, "/api/v1/admin/course-package-versions", {
        method: "GET",
        tenantId: tenantA.tenant_id,
        token: tenantAdminToken
      });
      expect(adminReadbackA.status).toBe(200);
      expect(adminReadbackA.body.data.course_package_versions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ course_package_id: coursePackageA.course_package_id })
        ])
      );
      expect(adminReadbackA.body.data.course_package_versions).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ course_package_id: coursePackageB.course_package_id })
        ])
      );
      const teacherReadbackA = await request<
        ApiEnvelope<{ course_package_versions: Array<{ course_package_id: string }> }>
      >(baseUrl, "/api/v1/bff/teacher/course-package-versions", {
        method: "GET",
        tenantId: tenantA.tenant_id,
        token: teacherToken
      });
      expect(teacherReadbackA.status).toBe(200);
      expect(teacherReadbackA.body.data.course_package_versions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            course_package_reference: expect.objectContaining({
              course_package_id: coursePackageA.course_package_id
            })
          })
        ])
      );
      const crossTenantAdminRead = await request<ErrorPayload>(
        baseUrl,
        "/api/v1/admin/course-package-versions",
        {
          method: "GET",
          tenantId: tenantA.tenant_id,
          token: tenantBAdminToken
        }
      );
      expect(crossTenantAdminRead.status).toBe(403);

      const foreignBinding = await request<ErrorPayload>(
        baseUrl,
        "/api/v1/admin/course-package-versions/drafts",
        {
          body: {
            course_blueprint_reference: coursePackageB.course_blueprint_reference,
            course_package_id: "rejected_foreign_package",
            description: "Cross-tenant source must never bind.",
            parameter_set_reference: provisionA.body.data.parameter_set.reference,
            scenario_package_reference: provisionA.body.data.scenario_package.reference,
            title: "Rejected foreign package",
            version: "1.0.0"
          },
          tenantId: tenantB.tenant_id,
          token: tenantBAdminToken
        }
      );
      expect(foreignBinding.status).toBe(422);
      expect(foreignBinding.body.code).toBe("COURSE_PACKAGE_INPUT_INVALID");
      expect(
        store.auditLogs.some(
          (log) =>
            log.action === "tenant_baseline.provision" &&
            (log.tenant_id === tenantA.tenant_id || log.tenant_id === tenantB.tenant_id)
        )
      ).toBe(true);
      expect(
        store.formalParameterSetLifecycleSnapshots.filter(
          (version) => version.tenant_id === sourceTenant.tenant_id
        )
      ).toEqual(sourceSnapshotsBefore.parameter);
      expect(
        store.formalScenarioPackageLifecycleSnapshots.filter(
          (version) => version.tenant_id === sourceTenant.tenant_id
        )
      ).toEqual(sourceSnapshotsBefore.scenario);
      expect({
        decisions: store.decisions,
        formalRunRuntimeBindings: store.formalRunRuntimeBindings,
        rounds: store.rounds,
        runs: store.runs,
        settlementResults: store.settlementResults
      }).toEqual(truthBefore);
    } finally {
      await stopServer(server);
    }
  });
});
