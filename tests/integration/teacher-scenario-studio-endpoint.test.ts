import { once } from "node:events";
import { request as nodeRequest, type Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  CoursePackageVersion,
  TeacherScenarioStudioActivationDto,
  TeacherScenarioStudioCatalogDto,
  TeacherScenarioStudioDraftDto,
  TeacherScenarioStudioValidationDto
} from "@simwar/shared-contracts";
import { CourseBlueprintCommandService } from "../../services/api/src/course-blueprint-authority";
import { createJsonFormalScenarioAuthorityPersistence } from "../../services/api/src/json-repository-adapter";
import { createJsonFormalScenarioAuthorityRuntime } from "../../services/api/src/formal-scenario-authority-runtime";
import { createApiServer } from "../../services/api/src/server";
import { DEFAULT_TENANT_ID, createP1Store, type SimWarStore } from "../../services/api/src/store";

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

async function login(baseUrl: string, username: string): Promise<AuthSession> {
  const response = await requestJson<ApiEnvelope<AuthSession>>(`${baseUrl}/api/v1/auth/login`, {
    body: { password: username, username },
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

async function seedApprovedSources(store: SimWarStore) {
  const persistence = createJsonFormalScenarioAuthorityPersistence(store);
  const formal = createJsonFormalScenarioAuthorityRuntime(persistence);
  const actor = {
    actor_id: "usr_platform",
    capabilities: ["course_blueprint:manage", "parameter_set:manage", "scenario_package:manage"],
    correlation_id: "tss_endpoint_seed",
    tenant_id: DEFAULT_TENANT_ID
  };
  const parameterDraft = await formal.parameterSets.createDraft(actor, {
    compatibility_metadata: { engine_family: "toy_logit" },
    model_version_ref: "toy_logit_wellness_v1@0.1.0",
    parameter_set_id: "parameter_tss_endpoint",
    parameter_values: { base_capacity: 120 },
    schema_version: "parameter-set.v1",
    tenant_id: DEFAULT_TENANT_ID,
    version: "1.0.0"
  });
  const parameterValidated = await formal.parameterSets.validate(actor, parameterDraft.reference);
  const parameterFrozen = await formal.parameterSets.freeze(actor, parameterValidated.reference);
  const parameterApproved = await formal.parameterSets.approve(
    actor,
    parameterFrozen.reference,
    "tss_parameter_approval"
  );
  const scenarioDraft = await formal.scenarioPackages.createDraft(actor, {
    artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" },
    compatibility_metadata: { scenario_family: "wellness" },
    content: { rounds: 1 },
    metadata: { title: "TSS endpoint scenario" },
    parameter_set_reference: parameterApproved.version.reference,
    plugin_dependencies: [],
    scenario_package_id: "scenario_tss_endpoint",
    schema_version: "scenario-package.v1",
    tenant_id: DEFAULT_TENANT_ID,
    version: "1.0.0"
  });
  const scenarioValidated = await formal.scenarioPackages.validate(actor, scenarioDraft.reference);
  const scenarioFrozen = await formal.scenarioPackages.freeze(actor, scenarioValidated.reference);
  const scenarioApproved = await formal.scenarioPackages.approve(
    actor,
    scenarioFrozen.reference,
    "tss_scenario_approval"
  );
  const blueprints = new CourseBlueprintCommandService(persistence.createCourseBlueprintRegistry());
  const blueprintDraft = await blueprints.createDraft(actor, {
    activity_plan: [{ activity_id: "tss_activity" }],
    course_blueprint_id: "blueprint_tss_endpoint",
    description: "TSS endpoint blueprint.",
    duration_minutes: 60,
    instructor_guidance_reference: "guide://tss-endpoint",
    objectives: ["Create one governed exact scenario candidate."],
    ordered_phases: [
      {
        activity_type: "briefing",
        duration_minutes: 60,
        order: 1,
        phase_id: "tss_phase",
        student_instruction: "Observe the published result.",
        teacher_guidance: "Keep the candidate bounded.",
        title: "Briefing"
      }
    ],
    required_product_capabilities: ["course:create"],
    scenario_compatibility_constraints: { scenario_family: "wellness" },
    schema_version: "course-blueprint.v1",
    tenant_id: DEFAULT_TENANT_ID,
    title: "TSS endpoint blueprint",
    version: "1.0.0"
  });
  const blueprintValidated = await blueprints.validate(actor, blueprintDraft.reference);
  const blueprintFrozen = await blueprints.freeze(actor, blueprintValidated.reference);
  const blueprintApproved = await blueprints.approve(
    actor,
    blueprintFrozen.reference,
    "tss_blueprint_approval"
  );
  return {
    course_blueprint_reference: blueprintApproved.version.reference,
    parameter_set_reference: parameterApproved.version.reference,
    scenario_package_reference: scenarioApproved.version.reference
  };
}

describe("Teacher Scenario Studio real BFF", () => {
  it("completes catalog -> draft -> validate -> freeze -> preview -> Course activation with exact refs", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const references = await seedApprovedSources(store);
      const teacher = await login(baseUrl, "teacher");
      const headers = {
        authorization: `Bearer ${teacher.access_token}`,
        "content-type": "application/json",
        "x-tenant-id": DEFAULT_TENANT_ID
      };

      const catalog = await requestJson<ApiEnvelope<TeacherScenarioStudioCatalogDto>>(
        `${baseUrl}/api/v1/bff/teacher/scenario-studio`,
        { headers }
      );
      expect(catalog.status).toBe(200);
      expect(catalog.body.data.model_versions[0]).toMatchObject({
        model_version_ref: "toy_logit_wellness_v1@0.1.0",
        provider: "OFF",
        status: "APPROVED"
      });

      const created = await requestJson<ApiEnvelope<TeacherScenarioStudioDraftDto>>(
        `${baseUrl}/api/v1/bff/teacher/scenario-studio/drafts`,
        {
          body: {
            ...references,
            course_package_id: "course_package_tss_endpoint",
            description: "TSS endpoint candidate.",
            studio_configuration: {
              custom_parameters: { mode: "DRAFT_ONLY", values: { custom_rate: 1.2 } },
              experience_profile: "STANDARD",
              model_version_ref: "toy_logit_wellness_v1@0.1.0",
              module_configuration: {
                capital: { enabled: true },
                environment: { region: "generic" },
                funding: { enabled: true },
                policy_shocks: { enabled: false },
                project_template: { template_id: "generic" },
                workforce: { enabled: true }
              },
              schema_version: "teacher-scenario-studio.v1"
            },
            title: "TSS endpoint candidate",
            version: "1.0.0"
          },
          headers,
          method: "POST"
        }
      );
      expect(created.status).toBe(201);
      const reference = created.body.data.course_package_reference;

      const transition = (action: string) =>
        `${baseUrl}/api/v1/bff/teacher/scenario-studio/drafts/${reference.course_package_id}/versions/${reference.version}/${action}`;
      const validated = await requestJson<ApiEnvelope<TeacherScenarioStudioValidationDto>>(
        transition("validate"),
        { body: { course_package_reference: reference }, headers, method: "POST" }
      );
      expect(validated.status).toBe(200);
      expect(validated.body.data.checks).toEqual({
        compatibility: "PASS",
        custom_parameters: "PASS_WITH_LIMITS",
        exact_source_references: "PASS",
        model_version: "PASS"
      });

      const frozen = await requestJson<ApiEnvelope<TeacherScenarioStudioDraftDto>>(
        transition("freeze"),
        { body: { course_package_reference: reference }, headers, method: "POST" }
      );
      expect(frozen.status).toBe(200);
      expect(frozen.body.data.status).toBe("FROZEN");

      const preview = await requestJson<ApiEnvelope<Record<string, unknown>>>(
        `${baseUrl}/api/v1/bff/teacher/scenario-studio/drafts/preview`,
        { body: { course_package_reference: reference }, headers, method: "POST" }
      );
      expect(preview.status).toBe(200);
      expect(preview.body.data.role_safe_preview).toMatchObject({ student_visible: false });

      const activated = await requestJson<ApiEnvelope<TeacherScenarioStudioActivationDto>>(
        transition("activate"),
        { body: { course_package_reference: reference }, headers, method: "POST" }
      );
      expect(activated.status).toBe(201);
      expect(activated.body.data.activation.run_activation).toBe("DEFERRED_TO_EXISTING_RUN_WRITER");
      expect(store.courses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            course_id: activated.body.data.course.course_id,
            parameter_set_id: references.parameter_set_reference.parameter_set_id,
            scenario_package_id: references.scenario_package_reference.scenario_package_id,
            tenant_id: DEFAULT_TENANT_ID
          })
        ])
      );
      const packageSnapshot = store.coursePackageLifecycleSnapshots.find(
        (candidate: CoursePackageVersion) =>
          candidate.course_package_id === reference.course_package_id &&
          candidate.status === "AVAILABLE"
      );
      expect(packageSnapshot?.studio_configuration?.custom_parameters.mode).toBe("DRAFT_ONLY");
      expect(store.runs).toHaveLength(0);
    } finally {
      server.close();
      await once(server, "close");
    }
  });

  it("does not expose the Teacher Studio to a student", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const student = await login(baseUrl, "student");
      const result = await requestJson(`${baseUrl}/api/v1/bff/teacher/scenario-studio`, {
        headers: {
          authorization: `Bearer ${student.access_token}`,
          "x-tenant-id": DEFAULT_TENANT_ID
        }
      });
      expect(result.status).toBe(403);
    } finally {
      server.close();
      await once(server, "close");
    }
  });

  it("rejects tenant-confused and implicit-latest draft requests at the real BFF", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const references = await seedApprovedSources(store);
      const teacher = await login(baseUrl, "teacher");
      const headers = {
        authorization: `Bearer ${teacher.access_token}`,
        "content-type": "application/json",
        "x-tenant-id": DEFAULT_TENANT_ID
      };
      const common = {
        course_package_id: "course_package_tss_negative",
        description: "Negative TSS candidate.",
        studio_configuration: {
          custom_parameters: { mode: "DRAFT_ONLY", values: {} },
          experience_profile: "STANDARD",
          model_version_ref: "toy_logit_wellness_v1@0.1.0",
          module_configuration: {
            capital: {},
            environment: {},
            funding: {},
            policy_shocks: {},
            project_template: {},
            workforce: {}
          },
          schema_version: "teacher-scenario-studio.v1"
        },
        title: "Negative TSS candidate",
        version: "1.0.0"
      };

      const tenantConfused = await requestJson(
        `${baseUrl}/api/v1/bff/teacher/scenario-studio/drafts`,
        {
          body: {
            ...common,
            ...references,
            course_blueprint_reference: {
              ...references.course_blueprint_reference,
              tenant_id: "tenant-confused"
            }
          },
          headers,
          method: "POST"
        }
      );
      expect(tenantConfused.status).toBe(422);

      const implicitLatest = await requestJson(
        `${baseUrl}/api/v1/bff/teacher/scenario-studio/drafts`,
        {
          body: {
            ...common,
            ...references,
            course_blueprint_reference: {
              ...references.course_blueprint_reference,
              version: "latest"
            }
          },
          headers,
          method: "POST"
        }
      );
      expect(implicitLatest.status).toBe(422);
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
