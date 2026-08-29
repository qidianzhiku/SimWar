import { once } from "node:events";
import { request as nodeRequest, type Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  RegionalTransferCandidate,
  RegionalTransferCandidateInput,
  RegionalTransferStudentProjection,
  RegionalTransferAdminProjection,
  RegionalTransferTeacherProjection
} from "@simwar/shared-contracts";
import { CourseBlueprintCommandService } from "../../services/api/src/course-blueprint-authority";
import { createCourseBlueprintBinding } from "../../services/api/src/course-blueprint-binding";
import { CourseBlueprintBindingStore } from "../../services/api/src/course-blueprint-binding-store";
import { createFormalCourseAuthorityBinding } from "../../services/api/src/formal-course-authority-binding";
import { FormalCourseAuthorityBindingStore } from "../../services/api/src/formal-course-authority-binding-store";
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
  const result = await requestJson<ApiEnvelope<AuthSession>>(`${baseUrl}/api/v1/auth/login`, {
    body: { password: username, username },
    headers: { "content-type": "application/json", "x-tenant-id": DEFAULT_TENANT_ID },
    method: "POST"
  });
  expect(result.status).toBe(200);
  return result.body.data;
}

async function seedApprovedSources(store: SimWarStore): Promise<{
  blueprint: ReturnType<typeof createCourseBlueprintBinding>["course_blueprint_reference"];
  parameter: RegionalTransferCandidateInput["parameter_set_reference"];
  scenario: RegionalTransferCandidateInput["scenario_package_reference"];
}> {
  const persistence = createJsonFormalScenarioAuthorityPersistence(store);
  const formal = createJsonFormalScenarioAuthorityRuntime(persistence);
  const actor = {
    actor_id: "usr_platform",
    capabilities: ["course_blueprint:manage", "parameter_set:manage", "scenario_package:manage"],
    correlation_id: "rt_o1_endpoint_seed",
    tenant_id: DEFAULT_TENANT_ID
  };
  const parameterDraft = await formal.parameterSets.createDraft(actor, {
    compatibility_metadata: { engine_family: "toy_logit" },
    model_version_ref: "toy_logit_wellness_v1@0.1.0",
    parameter_set_id: "parameter_rt_o1_endpoint",
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
    "rt_o1_parameter_approval"
  );

  const scenarioDraft = await formal.scenarioPackages.createDraft(actor, {
    artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" },
    compatibility_metadata: { scenario_family: "wellness" },
    content: { rounds: 1 },
    metadata: { title: "RT-O1 endpoint scenario" },
    parameter_set_reference: parameterApproved.version.reference,
    plugin_dependencies: [],
    scenario_package_id: "scenario_rt_o1_endpoint",
    schema_version: "scenario-package.v1",
    tenant_id: DEFAULT_TENANT_ID,
    version: "1.0.0"
  });
  const scenarioValidated = await formal.scenarioPackages.validate(actor, scenarioDraft.reference);
  const scenarioFrozen = await formal.scenarioPackages.freeze(actor, scenarioValidated.reference);
  const scenarioApproved = await formal.scenarioPackages.approve(
    actor,
    scenarioFrozen.reference,
    "rt_o1_scenario_approval"
  );

  const blueprints = new CourseBlueprintCommandService(persistence.createCourseBlueprintRegistry());
  const blueprintDraft = await blueprints.createDraft(actor, {
    activity_plan: [{ activity_id: "rt_o1_activity" }],
    course_blueprint_id: "blueprint_rt_o1_endpoint",
    description: "RT-O1 endpoint blueprint.",
    duration_minutes: 60,
    instructor_guidance_reference: "guide://rt-o1-endpoint",
    objectives: ["Preview and publish a bounded regional-transfer candidate."],
    ordered_phases: [
      {
        activity_type: "briefing",
        duration_minutes: 60,
        order: 1,
        phase_id: "rt_o1_phase",
        student_instruction: "Read the published regional context.",
        teacher_guidance: "Keep the candidate bounded.",
        title: "Regional transfer briefing"
      }
    ],
    required_product_capabilities: ["course:create"],
    scenario_compatibility_constraints: { scenario_family: "wellness" },
    schema_version: "course-blueprint.v1",
    tenant_id: DEFAULT_TENANT_ID,
    title: "RT-O1 endpoint blueprint",
    version: "1.0.0"
  });
  const blueprintValidated = await blueprints.validate(actor, blueprintDraft.reference);
  const blueprintFrozen = await blueprints.freeze(actor, blueprintValidated.reference);
  const blueprintApproved = await blueprints.approve(
    actor,
    blueprintFrozen.reference,
    "rt_o1_blueprint_approval"
  );

  const course = store.courses.find((candidate) => candidate.course_id === "course_demo");
  if (!course) throw new Error("seed_course_missing");
  course.parameter_set_id = parameterApproved.version.reference.parameter_set_id;
  course.scenario_package_id = scenarioApproved.version.reference.scenario_package_id;
  new CourseBlueprintBindingStore(store).append(
    createCourseBlueprintBinding({
      binding_schema_version: "course-blueprint-binding.v1",
      course_blueprint_reference: blueprintApproved.version.reference,
      course_id: course.course_id,
      tenant_id: DEFAULT_TENANT_ID
    })
  );
  const formalCourseBinding = await createFormalCourseAuthorityBinding({
    authorities: {
      parameterSets: formal.parameterSets,
      plugins: formal.pluginReleases,
      scenarios: formal.scenarioPackages
    },
    course_id: course.course_id,
    engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" },
    parameter_set_reference: parameterApproved.version.reference,
    scenario_package_reference: scenarioApproved.version.reference,
    tenant_id: DEFAULT_TENANT_ID
  });
  new FormalCourseAuthorityBindingStore(store).append(formalCourseBinding);
  store.runs.push({
    course_id: course.course_id,
    parameter_set_id: parameterApproved.version.reference.parameter_set_id,
    run_id: "run_rt_o1_endpoint",
    scenario_package_id: scenarioApproved.version.reference.scenario_package_id,
    seed: 20260829,
    status: "active",
    tenant_id: DEFAULT_TENANT_ID
  });
  store.rounds.push({
    round_id: "round_rt_o1_endpoint_001",
    round_no: 1,
    run_id: "run_rt_o1_endpoint",
    status: "open",
    tenant_id: DEFAULT_TENANT_ID
  });
  store.teams.push({
    captain_user_id: "usr_default_cfo",
    course_id: course.course_id,
    members: [
      {
        display_name: "P0 CFO",
        role_slot: "CEO",
        user_id: "usr_default_cfo"
      }
    ],
    name: "Beta 康养队",
    team_id: "team_beta",
    tenant_id: DEFAULT_TENANT_ID
  });
  return {
    blueprint: blueprintApproved.version.reference,
    parameter: parameterApproved.version.reference,
    scenario: scenarioApproved.version.reference
  };
}

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  await seedApprovedSources(store);
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

describe("Regional Transfer O1 real BFF", () => {
  it("completes exact teacher -> student -> admin governed journey", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const teacher = await login(baseUrl, "teacher");
      const student = await login(baseUrl, "student");
      const admin = await login(baseUrl, "admin");
      const headers = (session: AuthSession) => ({
        authorization: `Bearer ${session.access_token}`,
        "content-type": "application/json",
        "x-tenant-id": DEFAULT_TENANT_ID
      });
      const teacherHeaders = headers(teacher);
      const selection = await requestJson<
        ApiEnvelope<{ actor_id: string; input: RegionalTransferCandidateInput }>
      >(
        `${baseUrl}/api/v1/bff/teacher/regional-transfer/selection?courseId=course_demo&runId=run_rt_o1_endpoint&roundNo=1`,
        { headers: teacherHeaders }
      );
      expect(selection.status).toBe(200);
      expect(selection.body.data.input).toMatchObject({
        course_id: "course_demo",
        round_no: 1,
        run_id: "run_rt_o1_endpoint"
      });

      const preview = await requestJson<ApiEnvelope<RegionalTransferTeacherProjection>>(
        `${baseUrl}/api/v1/bff/teacher/regional-transfer/preview`,
        { body: selection.body.data.input, headers: teacherHeaders, method: "POST" }
      );
      expect(preview.status).toBe(200);
      expect(preview.body.data.lifecycle).toBe("PREVIEWED");
      expect(preview.body.data.authority).toMatchObject({
        formal_writer_mutations: 0,
        official_truth_write: false,
        provider: "OFF",
        settlement_write: false
      });

      const validated = await requestJson<ApiEnvelope<RegionalTransferTeacherProjection>>(
        `${baseUrl}/api/v1/bff/teacher/regional-transfer/validate`,
        { body: selection.body.data.input, headers: teacherHeaders, method: "POST" }
      );
      expect(validated.status).toBe(200);
      expect(validated.body.data.lifecycle).toBe("VALIDATED");

      const frozen = await requestJson<ApiEnvelope<RegionalTransferCandidate>>(
        `${baseUrl}/api/v1/bff/teacher/regional-transfer/freeze`,
        { body: selection.body.data.input, headers: teacherHeaders, method: "POST" }
      );
      expect(frozen.status).toBe(201);
      expect(frozen.body.data.lifecycle).toBe("FROZEN");
      expect(frozen.body.data.consumer_scope).toEqual({
        minimum_team_count: 2,
        run_id: "run_rt_o1_endpoint",
        status: "SHARED_GOVERNED_SCENARIO",
        team_ids: ["team_alpha", "team_beta"]
      });
      const candidateId = frozen.body.data.candidate_ref.candidate_id;

      const unpublished = await requestJson(
        `${baseUrl}/api/v1/bff/student/regional-transfer/candidates/${candidateId}`,
        { headers: headers(student) }
      );
      expect(unpublished.status).toBe(403);

      const bound = await requestJson<ApiEnvelope<RegionalTransferCandidate>>(
        `${baseUrl}/api/v1/bff/teacher/regional-transfer/candidates/${candidateId}/bind`,
        { headers: teacherHeaders, method: "POST" }
      );
      expect(bound.status).toBe(200);
      expect(bound.body.data.lifecycle).toBe("ACTIVATED");

      const studentProjection = await requestJson<ApiEnvelope<RegionalTransferStudentProjection>>(
        `${baseUrl}/api/v1/bff/student/regional-transfer/candidates/${candidateId}`,
        { headers: headers(student) }
      );
      expect(studentProjection.status).toBe(200);
      expect(studentProjection.body.data.visibility).toBe("ROLE_SAFE_STUDENT");
      expect(JSON.stringify(studentProjection.body.data)).not.toContain("content_digest");

      const adminProjection = await requestJson<ApiEnvelope<RegionalTransferAdminProjection>>(
        `${baseUrl}/api/v1/bff/admin/regional-transfer/candidates/${candidateId}`,
        { headers: headers(admin) }
      );
      expect(adminProjection.status).toBe(200);
      expect(adminProjection.body.data.audit.lifecycle).toEqual([
        "PREVIEWED",
        "VALIDATED",
        "FROZEN",
        "ACTIVATED"
      ]);
      expect(store.regionalTransferCandidates).toHaveLength(1);
      expect(store.regionalTransferCandidates?.[0]?.authority.formal_writer_mutations).toBe(0);
    } finally {
      server.close();
      await once(server, "close");
    }
  });

  it("fails closed for role and exact-source boundaries", async () => {
    const { baseUrl, server } = await startServer();
    try {
      const student = await login(baseUrl, "student");
      const result = await requestJson(
        `${baseUrl}/api/v1/bff/teacher/regional-transfer/selection?courseId=course_demo&runId=run_rt_o1_endpoint&roundNo=1`,
        {
          headers: {
            authorization: `Bearer ${student.access_token}`,
            "x-tenant-id": DEFAULT_TENANT_ID
          }
        }
      );
      expect(result.status).toBe(403);

      const teacher = await login(baseUrl, "teacher");
      const missingExactSource = await requestJson(
        `${baseUrl}/api/v1/bff/teacher/regional-transfer/selection?courseId=course_demo&runId=missing&roundNo=1`,
        {
          headers: {
            authorization: `Bearer ${teacher.access_token}`,
            "x-tenant-id": DEFAULT_TENANT_ID
          }
        }
      );
      expect(missingExactSource.status).toBe(422);
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
