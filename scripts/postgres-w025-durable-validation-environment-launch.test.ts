import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { Pool } from "pg";
import { CourseBlueprintCommandService } from "../services/api/src/course-blueprint-authority.js";
import { CoursePackageCommandService } from "../services/api/src/course-package-command-service.js";
import { createCoursePackageVersionReference } from "../services/api/src/course-package-json-registry.js";
import { ParameterSetCommandService } from "../services/api/src/parameter-set-authority.js";
import { ScenarioPackageCommandService } from "../services/api/src/scenario-package-authority.js";
import type {
  CourseBlueprintReference,
  CoursePackageVersionReference,
  ParameterSetReference,
  ScenarioPackageReference
} from "@simwar/shared-contracts";
import { createPostgresRuntime } from "../services/api/src/postgres-runtime.js";
import {
  calculateLaunchIdentity,
  digest as calculateDigest
} from "../services/api/src/validation-environment-launch.js";

const databaseUrl = process.env.SIMWAR_TEST_DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error("SIMWAR_TEST_DATABASE_URL is required for W025 durable launch validation");
}

const sourceProductMergeSha = "b".repeat(40);

interface SeededAuthorityBundle {
  tenantId: string;
  parameterReference: ParameterSetReference;
  scenarioReference: ScenarioPackageReference;
  courseBlueprintReference?: CourseBlueprintReference;
  coursePackageReference?: CoursePackageVersionReference;
}

async function seedAuthorityBundle(
  runtime: ReturnType<typeof createPostgresRuntime>,
  tenantId: string,
  suffix: string,
  includeCoursePackage: boolean
): Promise<SeededAuthorityBundle> {
  const parameterSets = new ParameterSetCommandService(
    runtime.formalAuthorityPersistence.createParameterSetRegistry()
  );
  const scenarioPackages = new ScenarioPackageCommandService(
    runtime.formalAuthorityPersistence.createScenarioPackageRegistry(),
    parameterSets
  );
  const courseBlueprints = new CourseBlueprintCommandService(
    runtime.formalAuthorityPersistence.createCourseBlueprintRegistry()
  );
  const actor = {
    actor_id: `w025-seeder-${suffix}`,
    capabilities: ["parameter_set:manage", "scenario_package:manage", "course_blueprint:manage"],
    correlation_id: `w025-seed-${suffix}`,
    tenant_id: tenantId
  };
  const parameterDraft = await parameterSets.createDraft(actor, {
    compatibility_metadata: { scenario_family: "w025" },
    model_version_ref: "toy_logit_wellness_v1@0.1.0",
    parameter_set_id: `w025-parameter-${suffix}`,
    parameter_values: {
      runtime_parameter_set: {
        base_capacity: 100,
        base_market_size: 1000,
        fixed_cost: 10,
        model_family: "toy_logit",
        unit_cost: 2
      }
    },
    schema_version: "parameter-set.v1",
    tenant_id: tenantId,
    version: "1.0.0"
  });
  const parameterValidated = await parameterSets.validate(actor, parameterDraft.reference);
  const parameterFrozen = await parameterSets.freeze(actor, parameterValidated.reference);
  const parameterApproved = await parameterSets.approve(
    actor,
    parameterFrozen.reference,
    `w025-parameter-approval-${suffix}`
  );
  const scenarioDraft = await scenarioPackages.createDraft(actor, {
    artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" },
    compatibility_metadata: { scenario_family: "w025" },
    content: {
      runtime_scenario_package: { name: `W025 scenario ${suffix}`, plugin_package_ids: [] }
    },
    metadata: { title: `W025 scenario ${suffix}` },
    parameter_set_reference: parameterApproved.version.reference,
    plugin_dependencies: [],
    scenario_package_id: `w025-scenario-${suffix}`,
    schema_version: "scenario-package.v1",
    tenant_id: tenantId,
    version: "1.0.0"
  });
  const scenarioValidated = await scenarioPackages.validate(actor, scenarioDraft.reference);
  const scenarioFrozen = await scenarioPackages.freeze(actor, scenarioValidated.reference);
  const scenarioApproved = await scenarioPackages.approve(
    actor,
    scenarioFrozen.reference,
    `w025-scenario-approval-${suffix}`
  );
  if (!includeCoursePackage) {
    return {
      tenantId,
      parameterReference: parameterApproved.version.reference,
      scenarioReference: scenarioApproved.version.reference
    };
  }

  const blueprintDraft = await courseBlueprints.createDraft(actor, {
    activity_plan: [],
    course_blueprint_id: `w025-blueprint-${suffix}`,
    description: "W025 durable validation blueprint",
    duration_minutes: 30,
    instructor_guidance_reference: "w025-guidance",
    objectives: ["validate durable restart"],
    ordered_phases: [
      {
        activity_type: "simulation",
        duration_minutes: 30,
        order: 1,
        phase_id: "phase-1",
        student_instruction: "Run the bounded validation journey",
        teacher_guidance: "Observe the durable lifecycle",
        title: "Durable validation"
      }
    ],
    required_product_capabilities: ["course:create"],
    scenario_compatibility_constraints: { scenario_family: "w025" },
    schema_version: "course-blueprint.v1",
    tenant_id: tenantId,
    title: "W025 durable validation",
    version: "1.0.0"
  });
  const blueprintValidated = await courseBlueprints.validate(actor, blueprintDraft.reference);
  const blueprintFrozen = await courseBlueprints.freeze(actor, blueprintValidated.reference);
  const blueprintApproved = await courseBlueprints.approve(
    actor,
    blueprintFrozen.reference,
    `w025-blueprint-approval-${suffix}`
  );
  const coursePackages = new CoursePackageCommandService(
    runtime.formalAuthorityPersistence.coursePackageRegistry,
    { courseBlueprints, parameterSets, scenarioPackages }
  );
  const packageDraft = await coursePackages.createDraft(
    { actor_id: actor.actor_id, tenant_id: tenantId },
    {
      course_blueprint_reference: blueprintApproved.version.reference,
      course_package_id: `w025-package-${suffix}`,
      description: "W025 durable validation package",
      parameter_set_reference: parameterApproved.version.reference,
      scenario_package_reference: scenarioApproved.version.reference,
      title: "W025 durable validation package",
      version: "1.0.0"
    }
  );
  const packageValidated = await coursePackages.validate(
    { actor_id: actor.actor_id, tenant_id: tenantId },
    createCoursePackageVersionReference(packageDraft)
  );
  const packageAvailable = await coursePackages.makeAvailable(
    { actor_id: actor.actor_id, tenant_id: tenantId },
    createCoursePackageVersionReference(packageValidated)
  );
  return {
    tenantId,
    parameterReference: parameterApproved.version.reference,
    scenarioReference: scenarioApproved.version.reference,
    courseBlueprintReference: blueprintApproved.version.reference,
    coursePackageReference: createCoursePackageVersionReference(packageAvailable)
  };
}

function createInput(
  launchKey: string,
  source: SeededAuthorityBundle,
  target: SeededAuthorityBundle,
  courseTitle = "W025 durable launch",
  targetTenantId = target.tenantId
) {
  const cohortTemplate = {
    teacher_user_id: "w025-teacher",
    teams: [
      {
        team_key: "a",
        name: "W025 Team A",
        members: [
          { user_id: `w025-${launchKey}-a-ceo`, display_name: "A CEO", role_slot: "CEO" },
          { user_id: `w025-${launchKey}-a-cfo`, display_name: "A CFO", role_slot: "CFO" },
          { user_id: `w025-${launchKey}-a-cmo`, display_name: "A CMO", role_slot: "CMO" },
          { user_id: `w025-${launchKey}-a-coo`, display_name: "A COO", role_slot: "COO" }
        ]
      },
      {
        team_key: "b",
        name: "W025 Team B",
        members: [
          { user_id: `w025-${launchKey}-b-ceo`, display_name: "B CEO", role_slot: "CEO" },
          { user_id: `w025-${launchKey}-b-cfo`, display_name: "B CFO", role_slot: "CFO" },
          { user_id: `w025-${launchKey}-b-cmo`, display_name: "B CMO", role_slot: "CMO" },
          { user_id: `w025-${launchKey}-b-coo`, display_name: "B COO", role_slot: "COO" }
        ]
      }
    ]
  };
  return {
    target_tenant_id: targetTenantId,
    launch_key: launchKey,
    created_by: "w025-teacher",
    source_parameter_set: {
      tenant_id: source.tenantId,
      reference: source.parameterReference
    },
    source_scenario_package: {
      tenant_id: source.tenantId,
      reference: source.scenarioReference
    },
    course_blueprint_reference: target.courseBlueprintReference!,
    course_package_reference: target.coursePackageReference!,
    course_title: courseTitle,
    source_product_merge_sha: sourceProductMergeSha,
    cohort_template_digest: calculateDigest(cohortTemplate),
    cohort_template: cohortTemplate,
    seed: 25025
  };
}

interface ApiProcessResult {
  readonly child: ChildProcess;
  readonly port: number;
  readonly stderr: { value: string };
}

function startApiProcess(port: number, crashHook?: string): ApiProcessResult {
  const child = spawn(process.execPath, ["services/api/dist/server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      API_HOST: "127.0.0.1",
      API_PORT: String(port),
      INTERNAL_SERVICE_TOKEN: "w025-test-internal-token",
      JWT_SECRET: "w025-test-jwt-secret",
      SIMWAR_ENV: "test",
      SIMWAR_DATABASE_URL: databaseUrl,
      SIMWAR_REPOSITORY_MODE: "postgres",
      SIMWAR_TEST_DATABASE_URL: databaseUrl,
      ...(crashHook ? { SIMWAR_W025_CRASH_AFTER: crashHook } : {})
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const stderr = { value: "" };
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk: string) => {
    stderr.value += chunk;
  });
  return { child, port, stderr };
}

async function waitForApi(processInfo: ApiProcessResult): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (processInfo.child.exitCode !== null) {
      throw new Error(`api exited before ready: ${processInfo.stderr.value}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${processInfo.port}/healthz`);
      if (response.ok) return;
    } catch {
      // The child is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`api did not become ready: ${processInfo.stderr.value}`);
}

async function waitForExit(child: ChildProcess): Promise<number | null> {
  if (child.exitCode !== null) return child.exitCode;
  const [code] = (await once(child, "exit")) as [number | null, string | null];
  return code;
}

async function stopApiProcess(processInfo: ApiProcessResult): Promise<number | null> {
  if (processInfo.child.exitCode === null) processInfo.child.kill("SIGTERM");
  return waitForExit(processInfo.child);
}

async function requestApiLaunch(
  port: number,
  input: unknown,
  includeCreatedBy = false
): Promise<Response> {
  const login = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-tenant-id": "tenant_demo" },
    body: JSON.stringify({ username: "teacher", password: "teacher" })
  });
  if (!login.ok) throw new Error(`API teacher login failed: ${login.status}`);
  const loginBody = (await login.json()) as { data?: { access_token?: string } };
  const token = loginBody.data?.access_token;
  if (!token) throw new Error("API teacher login did not return a token");
  const requestBody = { ...(input as Record<string, unknown>) };
  delete requestBody.created_by;
  return fetch(`http://127.0.0.1:${port}/api/v1/admin/validation-environment-launches`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-request-id": `w025-api-${Date.now()}`,
      "x-tenant-id": "tenant_demo"
    },
    body: JSON.stringify(includeCreatedBy ? input : requestBody)
  });
}

describe("W025 PostgreSQL durable launch C1-C5 process recovery", () => {
  it("restarts the real API process from every durable boundary and reaches READY exactly once", async () => {
    const runtime = createPostgresRuntime({ databaseUrl });
    await runtime.start();
    const hooks = [
      "DURABLE_ROW",
      "BASELINE_READY",
      "COURSE_RUN_READY",
      "COHORT_READY",
      "SESSION_PREFLIGHT_READY"
    ] as const;
    const runSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const source = await seedAuthorityBundle(
      runtime,
      "w025-source",
      `api-${runSuffix}-source`,
      false
    );
    const target = await seedAuthorityBundle(
      runtime,
      "tenant_demo",
      `api-${runSuffix}-target`,
      true
    );

    try {
      for (const [index, hook] of hooks.entries()) {
        const input = createInput(
          `restart-${runSuffix}-${index}`,
          source,
          target,
          "W025 API durable launch",
          "tenant_demo"
        );
        const interrupted = startApiProcess(31_000 + index, hook);
        try {
          await waitForApi(interrupted);
          await expect(requestApiLaunch(interrupted.port, input)).rejects.toThrow();
        } finally {
          const exitCode = await waitForExit(interrupted.child);
          expect(exitCode, `${hook} stderr: ${interrupted.stderr.value}`).toBe(91);
        }

        const resumed = startApiProcess(31_100 + index);
        let response: Response;
        try {
          await waitForApi(resumed);
          response = await requestApiLaunch(resumed.port, input);
          const responseText = await response.text();
          expect(response.status, responseText).toBe(201);
          const body = JSON.parse(responseText) as {
            data?: { status?: string; version?: number; launch_id?: string; created_by?: string };
          };
          expect(body.data?.status).toBe("READY");
          expect(body.data?.version).toBe(5);
          expect(body.data?.launch_id).toMatch(/^vlaunch_/);
          expect(body.data?.created_by).toBe("usr_teacher");
          if (index === 0) {
            const spoofed = await requestApiLaunch(
              resumed.port,
              { ...input, created_by: "attacker" },
              true
            );
            expect(spoofed.status).toBe(422);
            expect(await spoofed.text()).toContain("W025_INPUT_INVALID");
          }
        } finally {
          await stopApiProcess(resumed);
        }

        const pool = new Pool({ connectionString: databaseUrl });
        try {
          const row = await pool.query(
            "SELECT status, version FROM w025_validation_environment_launches WHERE launch_id = $1",
            [`vlaunch_${calculateLaunchIdentity(input).business_key_digest.slice(0, 24)}`]
          );
          expect(row.rows).toEqual([{ status: "READY", version: "5" }]);
        } finally {
          await pool.end();
        }
        const auditLogs = await runtime.provider.facade.auditLogs.listAuditLogs({
          scope: "tenant",
          tenant_id: "tenant_demo",
          action: "tenant_baseline.provision",
          limit: 100
        });
        expect(
          auditLogs.some(
            (log) =>
              log.actor_id === "usr_teacher" && log.resource_type === "tenant_baseline_provisioning"
          )
        ).toBe(true);
      }
    } finally {
      await runtime.close();
    }
  });

  it("serializes identical requests and rejects a changed fingerprint", async () => {
    const runtime = createPostgresRuntime({ databaseUrl });
    await runtime.start();
    const runSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const source = await seedAuthorityBundle(
      runtime,
      "w025-source",
      `con-${runSuffix}-source`,
      false
    );
    const target = await seedAuthorityBundle(
      runtime,
      "tenant_demo",
      `con-${runSuffix}-target`,
      true
    );
    try {
      const input = createInput(
        `concurrency-${runSuffix}`,
        source,
        target,
        "W025 concurrency",
        "tenant_demo"
      );
      const first = startApiProcess(32_000);
      const second = startApiProcess(32_001);
      try {
        await Promise.all([waitForApi(first), waitForApi(second)]);
        const [firstResponse, secondResponse] = await Promise.all([
          requestApiLaunch(first.port, input),
          requestApiLaunch(second.port, input)
        ]);
        const firstBody = await firstResponse.text();
        const secondBody = await secondResponse.text();
        expect(firstResponse.status, `${firstBody}\nfirst stderr: ${first.stderr.value}`).toBe(201);
        expect(secondResponse.status, `${secondBody}\nsecond stderr: ${second.stderr.value}`).toBe(
          201
        );
        const conflict = createInput(
          `concurrency-${runSuffix}`,
          source,
          target,
          "changed",
          "tenant_demo"
        );
        const conflictResponse = await requestApiLaunch(first.port, conflict);
        const conflictBody = await conflictResponse.text();
        expect(conflictResponse.status, conflictBody).toBe(409);
        expect(conflictBody).toContain("W025_LAUNCH_CONFLICT");
      } finally {
        await Promise.all([stopApiProcess(first), stopApiProcess(second)]);
      }
    } finally {
      await runtime.close();
    }
  });
});
