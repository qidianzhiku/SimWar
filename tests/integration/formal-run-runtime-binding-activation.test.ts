import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  Course,
  FormalRunRuntimeBinding,
  PluginManifest,
  RoleId,
  Round,
  Run,
  SettlementResult
} from "../../packages/shared-contracts/src";
import type {
  FormalRunBindingAuthorityPorts,
  FormalRunParameterSetAuthorityBindingRecord,
  FormalRunPluginReleaseAuthorityBindingRecord,
  FormalRunScenarioPackageAuthorityBindingRecord
} from "../../services/api/src/formal-run-runtime-binding";
import type { ParameterSetVersion } from "../../services/api/src/parameter-set-authority";
import type { PluginReleaseVersion } from "../../services/api/src/plugin-release-authority";
import type { ScenarioPackageVersion } from "../../services/api/src/scenario-package-authority";
import { resolveFormalRuntimeInputsForActiveRun } from "../../services/api/src/formal-runtime-input-resolver";
import { createM1RunReplayEvidence } from "../../services/api/src/run-manifest-replay-evidence";
import { createJsonRepositoryPorts } from "../../services/api/src/json-repository-adapter";
import { RoleWorkflowCommandService } from "../../services/api/src/role-workflow";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

const TENANT_ID = "tenant_demo";
const digest = (character: string) => character.repeat(64);

function seedPersistedFormalAuthorities(store: SimWarStore): void {
  const parameterReference = {
    content_digest: digest("a"),
    parameter_set_id: "param_toy_approved_1",
    version: "1.0.0"
  };
  const scenarioReference = {
    content_digest: digest("b"),
    scenario_package_id: "scenario_eldercare_demo",
    tenant_id: TENANT_ID,
    version: "1.0.0"
  };
  const pluginReference = {
    content_digest: digest("c"),
    plugin_package_id: "plugin_wellness_v1",
    version: "1.0.0"
  };
  const parameterSet: ParameterSetVersion = {
    compatibility_metadata: { engine_family: "toy_logit" },
    content_digest: parameterReference.content_digest,
    model_version_ref: "toy_logit_wellness_v1@0.1.0",
    parameter_set_id: parameterReference.parameter_set_id,
    parameter_values: {
      runtime_parameter_set: {
        base_capacity: 120,
        base_market_size: 240,
        fixed_cost: 120000,
        model_family: "toy_logit",
        unit_cost: 4200
      }
    },
    reference: parameterReference,
    schema_version: "parameter-set.v1",
    status: "APPROVED",
    tenant_id: TENANT_ID,
    version: parameterReference.version
  };
  const scenario: ScenarioPackageVersion = {
    artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" },
    compatibility_metadata: { engine_family: "toy_logit" },
    content: {
      runtime_scenario_package: {
        name: "Persisted formal M1 eldercare scenario",
        plugin_package_ids: [pluginReference.plugin_package_id]
      }
    },
    content_digest: scenarioReference.content_digest,
    metadata: { title: "Persisted formal M1 eldercare scenario" },
    parameter_set_reference: parameterReference,
    plugin_dependencies: [
      {
        plugin_package_id: pluginReference.plugin_package_id,
        version: pluginReference.version
      }
    ],
    reference: scenarioReference,
    scenario_package_id: scenarioReference.scenario_package_id,
    schema_version: "scenario-package.v1",
    status: "APPROVED",
    tenant_id: TENANT_ID,
    version: scenarioReference.version
  };
  const plugin: PluginReleaseVersion = {
    compatibility_metadata: { engine_family: "toy_logit" },
    content_digest: pluginReference.content_digest,
    official_commit_permissions: [],
    plugin_manifest: {
      adapter_ref: "@simwar/simulation-core/wellnessPluginV1",
      industry: "wellness",
      manifest_version: "1.0.0",
      name: "Persisted wellness runtime plugin",
      parameter_schema_ref: "contracts/schemas/wellness-parameters.v1.json",
      parameter_schema_version: "wellness.parameters.v1",
      plugin_id: pluginReference.plugin_package_id,
      settlement_hook_refs: ["adjustDemand:wellness.v1"],
      status: "approved",
      supported_hooks: ["adjustDemand"],
      version: pluginReference.version
    },
    plugin_package_id: pluginReference.plugin_package_id,
    reference: pluginReference,
    schema_version: "plugin-release.v1",
    status: "AVAILABLE",
    version: pluginReference.version
  };

  store.formalParameterSetLifecycleSnapshots.push(parameterSet);
  store.formalScenarioPackageLifecycleSnapshots.push(scenario);
  store.formalPluginReleaseLifecycleSnapshots.push(plugin);
}

function createFormalAuthorities(): FormalRunBindingAuthorityPorts {
  const parameterReference = {
    content_digest: digest("a"),
    parameter_set_id: "param_toy_approved_1",
    version: "1.0.0"
  };
  const scenarioReference = {
    content_digest: digest("b"),
    scenario_package_id: "scenario_eldercare_demo",
    tenant_id: TENANT_ID,
    version: "1.0.0"
  };
  const pluginReference = {
    content_digest: digest("c"),
    plugin_package_id: "plugin_wellness_v1",
    version: "1.0.0"
  };
  const parameterSet: FormalRunParameterSetAuthorityBindingRecord = {
    compatibility_metadata: { engine_family: "toy_logit" },
    content_digest: parameterReference.content_digest,
    model_version_ref: "toy_logit_wellness_v1@0.1.0",
    parameter_set_id: parameterReference.parameter_set_id,
    parameter_values: {
      runtime_parameter_set: {
        base_capacity: 120,
        base_market_size: 240,
        fixed_cost: 120000,
        model_family: "toy_logit",
        unit_cost: 4200
      }
    },
    reference: parameterReference,
    schema_version: "parameter-set.v1",
    status: "APPROVED",
    tenant_id: TENANT_ID,
    version: parameterReference.version
  };
  const scenario: FormalRunScenarioPackageAuthorityBindingRecord = {
    artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" },
    compatibility_metadata: { engine_family: "toy_logit" },
    content: {
      runtime_scenario_package: {
        name: "Formal M1 eldercare scenario",
        plugin_package_ids: [pluginReference.plugin_package_id]
      }
    },
    content_digest: scenarioReference.content_digest,
    metadata: { title: "Formal M1 eldercare scenario" },
    parameter_set_reference: parameterReference,
    plugin_dependencies: [
      {
        plugin_package_id: pluginReference.plugin_package_id,
        version: pluginReference.version
      }
    ],
    reference: scenarioReference,
    scenario_package_id: scenarioReference.scenario_package_id,
    schema_version: "scenario-package.v1",
    status: "APPROVED",
    tenant_id: TENANT_ID,
    version: scenarioReference.version
  };
  const pluginManifest: PluginManifest = {
    adapter_ref: "@simwar/simulation-core/wellnessPluginV1",
    industry: "wellness",
    manifest_version: "1.0.0",
    name: "Wellness runtime plugin",
    parameter_schema_ref: "contracts/schemas/wellness-parameters.v1.json",
    parameter_schema_version: "wellness.parameters.v1",
    plugin_id: pluginReference.plugin_package_id,
    settlement_hook_refs: ["adjustDemand:wellness.v1"],
    status: "approved",
    supported_hooks: ["adjustDemand"],
    version: pluginReference.version
  };
  const plugin: FormalRunPluginReleaseAuthorityBindingRecord = {
    compatibility_metadata: { engine_family: "toy_logit" },
    content_digest: pluginReference.content_digest,
    plugin_manifest: pluginManifest,
    plugin_package_id: pluginReference.plugin_package_id,
    reference: pluginReference,
    schema_version: "plugin-release.v1",
    status: "AVAILABLE",
    version: pluginReference.version
  };

  return {
    parameterSets: {
      assertBindable: async (tenantId, reference) => {
        if (
          tenantId !== TENANT_ID ||
          JSON.stringify(reference) !== JSON.stringify(parameterReference)
        ) {
          throw new Error("parameter not bindable");
        }
      },
      getByReference: async (tenantId, reference) =>
        tenantId === TENANT_ID && JSON.stringify(reference) === JSON.stringify(parameterReference)
          ? parameterSet
          : null
    },
    plugins: {
      getByReference: async (reference) =>
        JSON.stringify(reference) === JSON.stringify(pluginReference) ? plugin : null,
      resolveAvailableForNewBinding: async (pluginPackageId, version) =>
        pluginPackageId === pluginReference.plugin_package_id && version === pluginReference.version
          ? plugin
          : null
    },
    scenarios: {
      assertBindable: async (tenantId, reference) => {
        if (
          tenantId !== TENANT_ID ||
          JSON.stringify(reference) !== JSON.stringify(scenarioReference)
        ) {
          throw new Error("scenario not bindable");
        }
      },
      getByReference: async (tenantId, reference) =>
        tenantId === TENANT_ID && JSON.stringify(reference) === JSON.stringify(scenarioReference)
          ? scenario
          : null
    }
  };
}

async function startServer(): Promise<{
  authorities: FormalRunBindingAuthorityPorts;
  baseUrl: string;
  server: Server;
  store: SimWarStore;
}> {
  const store = createP1Store();
  const authorities = createFormalAuthorities();
  const server = createApiServer(store, {
    formalRunBindingAuthorities: authorities
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("test server did not bind to a TCP port");
  }

  return { authorities, baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

async function request<TData>(
  baseUrl: string,
  path: string,
  options: { body?: unknown; method?: string; token?: string } = {}
): Promise<{ body: ApiEnvelope<TData>; status: number }> {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": TENANT_ID
  });
  if (options.token) {
    headers.set("authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers,
    method: options.method ?? "GET"
  });

  return {
    body: (await response.json()) as ApiEnvelope<TData>,
    status: response.status
  };
}

async function login(baseUrl: string, username: string, password: string): Promise<string> {
  const response = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
    body: { password, username },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return response.body.data.access_token;
}

async function createFormalCanonicalDecision(
  store: SimWarStore,
  runId: string,
  teamId = "team_alpha"
): Promise<void> {
  const run = store.runs.find((candidate) => candidate.run_id === runId);
  const round = store.rounds.find(
    (candidate) => candidate.run_id === runId && candidate.round_no === 1
  );
  const team = store.teams.find((candidate) => candidate.team_id === teamId);
  if (!run || !round || !team) throw new Error("formal workflow fixture missing");

  const roleMembers = [
    ["usr_student", "CEO"],
    [`${runId}_cfo`, "CFO"],
    [`${runId}_cmo`, "CMO"],
    [`${runId}_coo`, "COO"]
  ] as const;
  team.members = [
    ...team.members.filter((member) => member.role_slot === "CEO"),
    ...roleMembers.slice(1).map(([user_id, role_slot]) => ({
      display_name: role_slot,
      role_slot,
      user_id
    }))
  ];
  team.captain_user_id = "usr_student";

  let id = 0;
  const workflow = new RoleWorkflowCommandService(createJsonRepositoryPorts(store).roleWorkflow, {
    createId: (kind) => `${kind}_${runId}_${++id}`,
    now: () => "2026-08-16T05:00:00.000Z"
  });
  const teacher = {
    actor_id: "usr_teacher",
    actor_role: "teacher" as const,
    tenant_id: run.tenant_id
  };
  const actors = new Map<string, { actor_id: string; actor_role: "student"; tenant_id: string }>([
    ["CEO", { actor_id: "usr_student", actor_role: "student", tenant_id: run.tenant_id }],
    ["CFO", { actor_id: `${runId}_cfo`, actor_role: "student", tenant_id: run.tenant_id }],
    ["CMO", { actor_id: `${runId}_cmo`, actor_role: "student", tenant_id: run.tenant_id }],
    ["COO", { actor_id: `${runId}_coo`, actor_role: "student", tenant_id: run.tenant_id }]
  ]);
  const payloads: Record<RoleId, Record<string, unknown>> = {
    CEO: { strategy_statement: "Formal role workflow canonical plan." },
    CFO: { cash_buffer_target: 0.16, service_quality_budget: 160000 },
    CMO: { marketing_budget: 180000, pricing: { base_price: 12800 } },
    COO: { capacity_plan: "expand" }
  };
  for (const [user_id, role_key] of roleMembers) {
    await workflow.assignRole(teacher, {
      course_id: run.course_id,
      role_key: role_key as RoleId,
      run_id: run.run_id,
      team_id: team.team_id,
      user_id
    });
    const actor = actors.get(role_key)!;
    const section = await workflow.saveSection(actor, {
      expected_version: 0,
      payload: payloads[role_key as RoleId],
      round_id: round.round_id,
      run_id: run.run_id,
      team_id: team.team_id
    });
    await workflow.markSectionReady(actor, {
      expected_version: section.version,
      round_id: round.round_id,
      run_id: run.run_id,
      team_id: team.team_id
    });
  }
  const ceo = actors.get("CEO")!;
  const merge = await workflow.createMergeCommit(ceo, {
    round_id: round.round_id,
    run_id: run.run_id,
    team_id: team.team_id
  });
  await workflow.confirmTeamDecision(ceo, {
    merge_commit_id: merge.merge_commit_id,
    round_id: round.round_id,
    run_id: run.run_id,
    team_id: team.team_id
  });
}

describe("formal Run RuntimeBinding activation", () => {
  it("creates a Teacher-selected formal Course with a server-derived Engine and an inherited explicit-seed Run", async () => {
    const { baseUrl, server, store } = await startServer();
    const scenarioReference = {
      content_digest: digest("b"),
      scenario_package_id: "scenario_eldercare_demo",
      tenant_id: TENANT_ID,
      version: "1.0.0"
    };

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const preview = await request<{
        engine_profile: { engine_id: string; runtime_authority: string; version: string };
      }>(baseUrl, "/api/v1/bff/teacher/formal-course-bindings/preview", {
        body: { scenario_package_reference: scenarioReference },
        method: "POST",
        token: teacherToken
      });
      expect(preview.status).toBe(200);
      expect(preview.body.data.engine_profile).toEqual({
        engine_id: "toy_logit_wellness_v1",
        model_version_ref: "toy_logit_wellness_v1@0.1.0",
        runtime_authority: "JSON_INTERNAL_ONLY",
        version: "0.1.0"
      });

      const created = await request<{ course: Course }>(
        baseUrl,
        "/api/v1/bff/teacher/formal-courses",
        {
          body: {
            scenario_package_reference: scenarioReference,
            title: "Teacher selected B5 Course"
          },
          method: "POST",
          token: teacherToken
        }
      );
      expect(created.status).toBe(201);
      const courseId = created.body.data.course.course_id;
      expect(store.formalCourseAuthorityBindings).toHaveLength(1);
      expect(store.formalCourseAuthorityBindings[0]).toMatchObject({
        course_id: courseId,
        engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" },
        scenario_package_reference: scenarioReference
      });

      expect(
        (
          await request(baseUrl, `/api/v1/courses/${courseId}/publish`, {
            method: "POST",
            token: teacherToken
          })
        ).status
      ).toBe(200);
      const createdRun = await request<{ run: Run }>(baseUrl, `/api/v1/courses/${courseId}/runs`, {
        body: { formal_runtime_seed: 20260729 },
        method: "POST",
        token: teacherToken
      });
      expect(createdRun.status).toBe(201);
      expect(store.formalRunRuntimeBindings).toHaveLength(1);
      expect(store.formalRunRuntimeBindings[0]).toMatchObject({
        engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" },
        parameter_set_reference: store.formalCourseAuthorityBindings[0]?.parameter_set_reference,
        scenario_package_reference: scenarioReference,
        seed: 20260729
      });

      const override = await request(baseUrl, `/api/v1/courses/${courseId}/runs`, {
        body: { formal_runtime_binding: { seed: 1 } },
        method: "POST",
        token: teacherToken
      });
      expect(override.status).toBe(422);
      expect(store.runs).toHaveLength(1);
      expect(store.formalRunRuntimeBindings).toHaveLength(1);
    } finally {
      await stopServer(server);
    }
  });

  it("persists exact formal Course inputs and derives its Run binding without legacy Store fallback", async () => {
    const { baseUrl, server, store } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const created = await request<{ course_id: string }>(baseUrl, "/api/v1/courses", {
        body: {
          formal_authority_binding: {
            engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" },
            parameter_set_reference: {
              content_digest: digest("a"),
              parameter_set_id: "param_toy_approved_1",
              version: "1.0.0"
            },
            scenario_package_reference: {
              content_digest: digest("b"),
              scenario_package_id: "scenario_eldercare_demo",
              tenant_id: TENANT_ID,
              version: "1.0.0"
            }
          },
          title: "Formal authority Course"
        },
        method: "POST",
        token: teacherToken
      });

      expect(created.status).toBe(201);
      const courseId = created.body.data.course_id;
      expect(store.formalCourseAuthorityBindings).toHaveLength(1);
      expect(store.formalCourseAuthorityBindings[0]).toMatchObject({
        course_id: courseId,
        parameter_set_reference: { content_digest: digest("a") },
        scenario_package_reference: { content_digest: digest("b"), tenant_id: TENANT_ID }
      });
      expect(
        (
          await request(baseUrl, `/api/v1/courses/${courseId}/publish`, {
            method: "POST",
            token: teacherToken
          })
        ).status
      ).toBe(200);

      store.parameterSets.splice(0);
      store.scenarios.splice(0);

      const overrideAttempt = await request(baseUrl, `/api/v1/courses/${courseId}/runs`, {
        body: {
          formal_runtime_binding: {
            engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" },
            parameter_set_reference: {
              content_digest: digest("a"),
              parameter_set_id: "param_toy_approved_1",
              version: "1.0.0"
            },
            scenario_package_reference: {
              content_digest: digest("b"),
              scenario_package_id: "scenario_eldercare_demo",
              tenant_id: TENANT_ID,
              version: "1.0.0"
            },
            seed: 20260728
          }
        },
        method: "POST",
        token: teacherToken
      });

      expect(overrideAttempt.status).toBe(422);
      expect(store.runs).toHaveLength(0);

      const run = await request<{ round: Round; run: Run }>(
        baseUrl,
        `/api/v1/courses/${courseId}/runs`,
        {
          body: { formal_runtime_seed: 20260728 },
          method: "POST",
          token: teacherToken
        }
      );

      expect(run.status).toBe(201);
      expect(store.formalRunRuntimeBindings).toHaveLength(1);
      expect(store.formalRunRuntimeBindings[0]).toMatchObject({
        run_id: run.body.data.run.run_id,
        parameter_set_reference: { content_digest: digest("a") },
        scenario_package_reference: { content_digest: digest("b"), tenant_id: TENANT_ID }
      });
    } finally {
      await stopServer(server);
    }
  });

  it("uses persisted formal Authorities by default without injected test ports", async () => {
    const store = createP1Store();
    seedPersistedFormalAuthorities(store);
    const server = createApiServer(store);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("test server did not bind to a TCP port");
    }

    try {
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const response = await request<{ round: Round; run: Run }>(
        baseUrl,
        "/api/v1/courses/course_demo/runs",
        {
          body: {
            formal_runtime_binding: {
              engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" },
              parameter_set_reference: {
                content_digest: digest("a"),
                parameter_set_id: "param_toy_approved_1",
                version: "1.0.0"
              },
              scenario_package_reference: {
                content_digest: digest("b"),
                scenario_package_id: "scenario_eldercare_demo",
                tenant_id: TENANT_ID,
                version: "1.0.0"
              },
              seed: 20260728
            }
          },
          method: "POST",
          token: teacherToken
        }
      );

      expect(response.status).toBe(201);
      expect(store.formalRunRuntimeBindings).toHaveLength(1);
      expect(store.formalRunRuntimeBindings[0]).toMatchObject({
        parameter_set_reference: {
          content_digest: digest("a"),
          parameter_set_id: "param_toy_approved_1",
          version: "1.0.0"
        },
        scenario_package_reference: {
          content_digest: digest("b"),
          scenario_package_id: "scenario_eldercare_demo",
          tenant_id: TENANT_ID,
          version: "1.0.0"
        }
      });
    } finally {
      await stopServer(server);
    }
  });

  it("fails closed rather than creating a legacy Run when the formal identity is unavailable", async () => {
    const store = createP1Store();
    const server = createApiServer(store);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("test server did not bind to a TCP port");
    }

    try {
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const response = await request<{ round: Round; run: Run }>(
        baseUrl,
        "/api/v1/courses/course_demo/runs",
        {
          body: {
            formal_runtime_binding: {
              engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" },
              parameter_set_reference: {
                content_digest: digest("a"),
                parameter_set_id: "param_toy_approved_1",
                version: "1.0.0"
              },
              scenario_package_reference: {
                content_digest: digest("b"),
                scenario_package_id: "scenario_eldercare_demo",
                tenant_id: TENANT_ID,
                version: "1.0.0"
              },
              seed: 20260728
            }
          },
          method: "POST",
          token: teacherToken
        }
      );

      expect(response.status).toBe(422);
      expect(response.body.code).toBe("RUN-422-002");
      expect(store.runs).toHaveLength(0);
      expect(store.formalRunRuntimeBindings).toHaveLength(0);
    } finally {
      await stopServer(server);
    }
  });

  it("settles and creates private Replay inputs from the exact formal binding without legacy Store fallback", async () => {
    const { authorities, baseUrl, server, store } = await startServer();

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const studentToken = await login(baseUrl, "student", "student");
      const runResponse = await request<{ round: Round; run: Run }>(
        baseUrl,
        "/api/v1/courses/course_demo/runs",
        {
          body: {
            formal_runtime_binding: {
              engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" },
              parameter_set_reference: {
                content_digest: digest("a"),
                parameter_set_id: "param_toy_approved_1",
                version: "1.0.0"
              },
              scenario_package_reference: {
                content_digest: digest("b"),
                scenario_package_id: "scenario_eldercare_demo",
                tenant_id: TENANT_ID,
                version: "1.0.0"
              },
              seed: 20260728
            }
          },
          method: "POST",
          token: teacherToken
        }
      );

      expect(runResponse.status).toBe(201);
      expect(store.formalRunRuntimeBindings).toHaveLength(1);
      const binding = store.formalRunRuntimeBindings[0] as FormalRunRuntimeBinding;
      expect(binding.run_id).toBe(runResponse.body.data.run.run_id);

      store.parameterSets.splice(0);
      store.scenarios.splice(0);

      const runId = runResponse.body.data.run.run_id;
      expect(
        (
          await request<Round>(baseUrl, `/api/v1/runs/${runId}/rounds/1/start`, {
            method: "POST",
            token: teacherToken
          })
        ).status
      ).toBe(200);
      await createFormalCanonicalDecision(store, runId);
      expect(
        (
          await request<Round>(baseUrl, `/api/v1/runs/${runId}/rounds/1/lock`, {
            method: "POST",
            token: teacherToken
          })
        ).status
      ).toBe(200);
      const settlementResponse = await request<SettlementResult>(
        baseUrl,
        `/api/v1/runs/${runId}/rounds/1/settle`,
        { method: "POST", token: teacherToken }
      );
      expect(settlementResponse.status).toBe(200);
      expect(
        (
          await request<Round>(baseUrl, `/api/v1/runs/${runId}/rounds/1/publish`, {
            method: "POST",
            token: teacherToken
          })
        ).status
      ).toBe(200);

      const teacherResult = await request<{
        replay_evidence?: { canonical_evidence_digest: string };
      }>(baseUrl, `/api/v1/runs/${runId}/rounds/1/results`, { token: teacherToken });
      expect(teacherResult.status).toBe(200);
      expect(teacherResult.body.data.replay_evidence).toBeDefined();
      expect(JSON.stringify(teacherResult.body.data)).not.toContain("binding_digest");
      expect(JSON.stringify(teacherResult.body.data)).not.toContain("formal_resolution_digest");

      const studentResult = await request<{ replay_evidence?: unknown }>(
        baseUrl,
        `/api/v1/runs/${runId}/rounds/1/results`,
        { token: studentToken }
      );
      expect(studentResult.status).toBe(200);
      expect(studentResult.body.data.replay_evidence).toBeUndefined();
      expect(JSON.stringify(studentResult.body.data)).not.toContain("binding_digest");
      expect(JSON.stringify(studentResult.body.data)).not.toContain("formal_resolution_digest");

      const round = store.rounds.find(
        (candidate) => candidate.run_id === runId && candidate.round_no === 1
      );
      if (!round) {
        throw new Error("missing formal Run round");
      }
      const formalInputs = await resolveFormalRuntimeInputsForActiveRun({
        authorities,
        binding,
        run: runResponse.body.data.run
      });
      const privateEvidence = createM1RunReplayEvidence({
        decisions: store.decisions.filter((candidate) => candidate.run_id === runId),
        formal_runtime_binding: {
          binding,
          formal_resolution_digest: formalInputs.formal_resolution_digest
        },
        parameterSet: formalInputs.parameterSet,
        round,
        run: runResponse.body.data.run,
        scenario: formalInputs.scenario,
        settlement: settlementResponse.body.data,
        teams: store.teams.filter((candidate) => candidate.course_id === "course_demo")
      });
      expect(privateEvidence.manifest.formal_runtime_binding).toMatchObject({
        binding_digest: binding.binding_digest,
        formal_resolution_digest: formalInputs.formal_resolution_digest
      });
      expect(privateEvidence.public_view).not.toHaveProperty("formal_runtime_binding");
      expect(teacherResult.body.data.replay_evidence?.canonical_evidence_digest).toBe(
        privateEvidence.public_view.canonical_evidence_digest
      );
    } finally {
      await stopServer(server);
    }
  });

  it("keeps the Teacher BFF Course-to-Run path in Golden parity with the existing direct formal path", async () => {
    const { baseUrl, server, store } = await startServer();
    const scenarioReference = {
      content_digest: digest("b"),
      scenario_package_id: "scenario_eldercare_demo",
      tenant_id: TENANT_ID,
      version: "1.0.0"
    };
    const parameterReference = {
      content_digest: digest("a"),
      parameter_set_id: "param_toy_approved_1",
      version: "1.0.0"
    };

    async function completeGoldenRun(courseId: string, teamId: string, teacherToken: string) {
      const teamCreation = await request<{ team_id: string }>(
        baseUrl,
        `/api/v1/courses/${courseId}/teams`,
        {
          body: { captain_user_id: "usr_student", name: teamId },
          method: "POST",
          token: teacherToken
        }
      );
      expect(teamCreation.status).toBe(201);
      const createdTeamId = teamCreation.body.data.team_id;
      const student = store.users.find((candidate) => candidate.user_id === "usr_student");
      if (!student) {
        throw new Error("missing parity student");
      }
      student.team_id = createdTeamId;
      const createdRun = await request<{ run: Run }>(baseUrl, `/api/v1/courses/${courseId}/runs`, {
        body: { formal_runtime_seed: 20260729 },
        method: "POST",
        token: teacherToken
      });
      expect(createdRun.status).toBe(201);
      const runId = createdRun.body.data.run.run_id;
      expect(
        (
          await request(baseUrl, `/api/v1/runs/${runId}/rounds/1/start`, {
            method: "POST",
            token: teacherToken
          })
        ).status
      ).toBe(200);
      await createFormalCanonicalDecision(store, runId, createdTeamId);
      expect(
        (
          await request(baseUrl, `/api/v1/runs/${runId}/rounds/1/lock`, {
            method: "POST",
            token: teacherToken
          })
        ).status
      ).toBe(200);
      const settlement = await request<SettlementResult>(
        baseUrl,
        `/api/v1/runs/${runId}/rounds/1/settle`,
        { method: "POST", token: teacherToken }
      );
      expect(settlement.status).toBe(200);
      expect(
        (
          await request(baseUrl, `/api/v1/runs/${runId}/rounds/1/publish`, {
            method: "POST",
            token: teacherToken
          })
        ).status
      ).toBe(200);
      return { runId, settlement: settlement.body.data };
    }

    try {
      const teacherToken = await login(baseUrl, "teacher", "teacher");
      const directCourse = await request<{ course_id: string }>(baseUrl, "/api/v1/courses", {
        body: {
          formal_authority_binding: {
            engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" },
            parameter_set_reference: parameterReference,
            scenario_package_reference: scenarioReference
          },
          title: "Direct formal Golden parity Course"
        },
        method: "POST",
        token: teacherToken
      });
      expect(directCourse.status).toBe(201);
      expect(
        (
          await request(baseUrl, `/api/v1/courses/${directCourse.body.data.course_id}/publish`, {
            method: "POST",
            token: teacherToken
          })
        ).status
      ).toBe(200);

      const bffCourse = await request<{ course: Course }>(
        baseUrl,
        "/api/v1/bff/teacher/formal-courses",
        {
          body: {
            scenario_package_reference: scenarioReference,
            title: "Teacher BFF Golden parity Course"
          },
          method: "POST",
          token: teacherToken
        }
      );
      expect(bffCourse.status).toBe(201);
      expect(
        (
          await request(
            baseUrl,
            `/api/v1/courses/${bffCourse.body.data.course.course_id}/publish`,
            { method: "POST", token: teacherToken }
          )
        ).status
      ).toBe(200);

      const direct = await completeGoldenRun(
        directCourse.body.data.course_id,
        "team_direct_parity",
        teacherToken
      );
      const bff = await completeGoldenRun(
        bffCourse.body.data.course.course_id,
        "team_bff_parity",
        teacherToken
      );

      const businessResults = (result: SettlementResult) =>
        result.team_results.map(
          ({ team_id: _teamId, team_name: _teamName, ...teamResult }) => teamResult
        );
      expect(businessResults(bff.settlement)).toEqual(businessResults(direct.settlement));
      expect(
        store.settlementResults.filter((result) => result.run_id === direct.runId)
      ).toHaveLength(1);
      expect(store.settlementResults.filter((result) => result.run_id === bff.runId)).toHaveLength(
        1
      );
      expect(direct.runId).not.toBe(bff.runId);
    } finally {
      await stopServer(server);
    }
  });
});
