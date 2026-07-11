import { once } from "node:events";
import { request as nodeRequest, type Server } from "node:http";
import { describe, expect, it } from "vitest";
import type { ApiEnvelope, AuthSession, Run } from "../../packages/shared-contracts/src";
import {
  R7_TEACHER_SCENARIO_PACKAGE_CANDIDATES_OPERATION_ID,
  createR7BffEndpointImplementationGate
} from "../../packages/shared-contracts/src";
import {
  R7TeacherScenarioSelectionGateBlockedError,
  createR7TeacherScenarioSelectionReadinessProjection
} from "../../services/api/src/r7-teacher-scenario-selection-readiness";
import { createJsonRepositoryProvider } from "../../services/api/src/repository-provider";
import { createApiServer } from "../../services/api/src/server";
import {
  DEFAULT_TENANT_ID,
  OTHER_TENANT_ID,
  PLATFORM_TENANT_ID,
  createP1Store,
  type SimWarStore
} from "../../services/api/src/store";

const OPERATION_ID = "R7_TEACHER_SCENARIO_SELECTION_READINESS_GET_V1";
const RUN_ID = "run_r7_selection_readiness";
const SCENARIO_PACKAGE_ID = "scenario_eldercare_demo";
const ALTERNATE_SCENARIO_PACKAGE_ID = "scenario_r7_candidate_alternate";
const PARAMETER_SET_ID = "param_toy_approved_1";

interface R7ErrorBody {
  error: {
    code: string;
    correlation_id: string | null;
    message: string;
  };
}

interface R7ReadinessBody {
  calibration_status: string;
  compatibility_status: string;
  course_id: string;
  eligible: boolean;
  evidence_freshness: {
    collected_at: string | null;
    expires_at: string | null;
    is_expired: boolean;
  };
  explicit_non_proofs: string[];
  license_status: string;
  no_go_reasons: string[];
  operation_id: string;
  parameter_set_id: string;
  provenance_status: string;
  qa_status: string;
  readiness_status: "BLOCKED" | "READY";
  run_id: string;
  runtime_adapter_status: string;
  scenario_package_id: string;
  tenant_id: string;
}

interface R7CandidateBody {
  run_id: string;
  current_scenario_package_id: string | null;
  candidates: Array<{
    scenario_package_id: string;
    display_name: string;
    version_label: string;
    is_current: boolean;
  }>;
}

function seedRun(store: SimWarStore): Run {
  const run: Run = {
    course_id: "course_demo",
    parameter_set_id: PARAMETER_SET_ID,
    run_id: RUN_ID,
    scenario_package_id: SCENARIO_PACKAGE_ID,
    seed: 20260517,
    status: "draft",
    tenant_id: DEFAULT_TENANT_ID
  };
  store.runs.push(run);
  return run;
}

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  seedRun(store);
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("test server did not bind to a TCP port");
  }

  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

async function requestJson<TBody>(
  url: string,
  options: { body?: string; headers?: Record<string, string>; method?: string } = {}
): Promise<{ body: TBody; status: number }> {
  return new Promise((resolve, reject) => {
    const request = nodeRequest(
      url,
      {
        headers: options.headers,
        method: options.method ?? "GET"
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          try {
            resolve({
              body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as TBody,
              status: response.statusCode ?? 0
            });
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.on("error", reject);
    if (options.body) {
      request.write(options.body);
    }
    request.end();
  });
}

async function request<TBody>(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    omitTenantHeader?: boolean;
    requestId?: string;
    tenantId?: string;
    token?: string;
  } = {}
): Promise<{ body: TBody; status: number }> {
  const headers = new Headers({
    "x-request-id": options.requestId ?? "req_r7_selection_readiness"
  });
  if (!options.omitTenantHeader) {
    headers.set("x-tenant-id", options.tenantId ?? DEFAULT_TENANT_ID);
  }
  if (options.token) {
    headers.set("authorization", `Bearer ${options.token}`);
  }

  return requestJson<TBody>(`${baseUrl}${path}`, {
    headers: Object.fromEntries(headers.entries()),
    method: options.method ?? "GET"
  });
}

async function login(
  baseUrl: string,
  username: string,
  password: string,
  tenantId = DEFAULT_TENANT_ID
): Promise<AuthSession> {
  const response = await requestJson<ApiEnvelope<AuthSession>>(`${baseUrl}/api/v1/auth/login`, {
    body: JSON.stringify({ password, username }),
    headers: { "content-type": "application/json", "x-tenant-id": tenantId },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return response.body.data;
}

function endpointPath(
  runId = RUN_ID,
  scenarioPackageId = SCENARIO_PACKAGE_ID,
  parameterSetId = PARAMETER_SET_ID
): string {
  return `/api/v1/bff/teacher/runs/${runId}/scenario-selection-readiness?scenarioPackageId=${scenarioPackageId}&parameterSetId=${parameterSetId}`;
}

function candidateEndpointPath(runId = RUN_ID): string {
  return `/api/v1/bff/teacher/runs/${runId}/scenario-package-candidates`;
}

function expectSafeError(body: R7ErrorBody, code: string): void {
  expect(body).toEqual({
    error: {
      code,
      correlation_id: expect.any(String),
      message: expect.any(String)
    }
  });
  expect(JSON.stringify(body)).not.toMatch(
    /state_true|SettlementResult|ReplayManifest|canonical_evidence_digest|parameter_set.*base_market_size/i
  );
}

describe("R7 Teacher scenario selection readiness endpoint", () => {
  it("returns the exact Teacher-safe projection and performs no write", async () => {
    const { baseUrl, server, store } = await startServer();

    try {
      const teacher = await login(baseUrl, "teacher", "teacher");
      const stateBefore = JSON.stringify(store);
      const response = await request<R7ReadinessBody>(baseUrl, endpointPath(), {
        omitTenantHeader: true,
        requestId: "req_r7_ready",
        token: teacher.access_token
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        calibration_status: "DRAFT_REGISTER_ONLY",
        compatibility_status: "COMPATIBLE_BY_REFERENCE_ONLY",
        course_id: "course_demo",
        eligible: true,
        evidence_freshness: { collected_at: null, expires_at: null, is_expired: false },
        explicit_non_proofs: [
          "SCENARIO_RUNTIME_NOT_ACTIVATED",
          "PARAMETERSET_NOT_MUTATED",
          "REPLAY_NOT_EXECUTED",
          "SETTLEMENT_NOT_EXECUTED",
          "ENDPOINT_RESPONSE_NOT_FORMAL_TRUTH"
        ],
        license_status: "EXTERNAL_LICENSE_REVIEW_REQUIRED_BEFORE_RELEASE",
        no_go_reasons: [],
        operation_id: OPERATION_ID,
        parameter_set_id: PARAMETER_SET_ID,
        provenance_status: "INTERNAL_SYNTHETIC_ONLY",
        qa_status: "DRAFT_REVIEW_REQUIRED",
        readiness_status: "READY",
        run_id: RUN_ID,
        runtime_adapter_status: "PREPARATION_PACKAGE_ONLY",
        scenario_package_id: SCENARIO_PACKAGE_ID,
        tenant_id: DEFAULT_TENANT_ID
      });
      expect(JSON.stringify(response.body)).not.toMatch(
        /state_true|SettlementResult|ReplayManifest|canonical_evidence_digest|base_market_size|unit_cost/
      );
      expect(JSON.stringify(store)).toBe(stateBefore);
    } finally {
      await stopServer(server);
    }
  });

  it("returns endpoint-specific 400, 401 and 403 envelopes", async () => {
    const { baseUrl, server, store } = await startServer();

    try {
      const teacher = await login(baseUrl, "teacher", "teacher");
      const student = await login(baseUrl, "student", "student");
      const tenantAdmin = await login(baseUrl, "admin", "admin");
      const platformUser = store.users.find((user) => user.username === "platform");
      expect(platformUser).toBeDefined();
      store.userRoles.push({
        role_id: "role_teacher",
        tenant_id: PLATFORM_TENANT_ID,
        user_id: platformUser!.user_id
      });
      const dualRolePlatformAdmin = await login(
        baseUrl,
        "platform",
        "platform",
        PLATFORM_TENANT_ID
      );

      const missingQuery = await request<R7ErrorBody>(
        baseUrl,
        `/api/v1/bff/teacher/runs/${RUN_ID}/scenario-selection-readiness`,
        { token: teacher.access_token }
      );
      expect(missingQuery.status).toBe(400);
      expectSafeError(missingQuery.body, "R7_BFF_INVALID_REQUEST");

      const malformedRunId = await request<R7ErrorBody>(
        baseUrl,
        `/api/v1/bff/teacher/runs/%20/scenario-selection-readiness?scenarioPackageId=${SCENARIO_PACKAGE_ID}&parameterSetId=${PARAMETER_SET_ID}`,
        { token: teacher.access_token }
      );
      expect(malformedRunId.status).toBe(400);
      expectSafeError(malformedRunId.body, "R7_BFF_INVALID_REQUEST");

      const duplicateQuery = await request<R7ErrorBody>(
        baseUrl,
        `${endpointPath()}&parameterSetId=${PARAMETER_SET_ID}`,
        { token: teacher.access_token }
      );
      expect(duplicateQuery.status).toBe(400);
      expectSafeError(duplicateQuery.body, "R7_BFF_INVALID_REQUEST");

      const unauthenticated = await request<R7ErrorBody>(baseUrl, endpointPath());
      expect(unauthenticated.status).toBe(401);
      expectSafeError(unauthenticated.body, "R7_BFF_AUTHENTICATION_REQUIRED");

      for (const session of [student, tenantAdmin]) {
        const denied = await request<R7ErrorBody>(baseUrl, endpointPath(), {
          token: session.access_token
        });
        expect(denied.status).toBe(403);
        expectSafeError(denied.body, "R7_BFF_TEACHER_AUTHORITY_REQUIRED");
      }

      const platformTenantSwitchDenied = await request<R7ErrorBody>(baseUrl, endpointPath(), {
        tenantId: DEFAULT_TENANT_ID,
        token: dualRolePlatformAdmin.access_token
      });
      expect(platformTenantSwitchDenied.status).toBe(403);
      expectSafeError(platformTenantSwitchDenied.body, "R7_BFF_TEACHER_AUTHORITY_REQUIRED");
    } finally {
      await stopServer(server);
    }
  });

  it("uses one non-oracle 404 for cross-tenant and mismatched context", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const teacher = await login(baseUrl, "teacher", "teacher");
      const otherTeacher = await login(baseUrl, "other_teacher", "teacher", OTHER_TENANT_ID);

      const cases = [
        request<R7ErrorBody>(baseUrl, endpointPath(), {
          tenantId: OTHER_TENANT_ID,
          token: otherTeacher.access_token
        }),
        request<R7ErrorBody>(baseUrl, endpointPath(RUN_ID, "scenario_unknown"), {
          token: teacher.access_token
        }),
        request<R7ErrorBody>(baseUrl, endpointPath(RUN_ID, SCENARIO_PACKAGE_ID, "param_unknown"), {
          token: teacher.access_token
        }),
        request<R7ErrorBody>(baseUrl, endpointPath("run_unknown"), {
          token: teacher.access_token
        })
      ];

      for (const response of await Promise.all(cases)) {
        expect(response.status).toBe(404);
        expectSafeError(response.body, "R7_BFF_SCENARIO_SELECTION_CONTEXT_NOT_FOUND");
      }
    } finally {
      await stopServer(server);
    }
  });

  it("fails closed with stable reasons when the merged gate fails or is unknown", () => {
    const store = createP1Store();
    const run = seedRun(store);
    const scenarioPackage = store.scenarios[0];
    const parameterSet = store.parameterSets[0];
    expect(scenarioPackage).toBeDefined();
    expect(parameterSet).toBeDefined();

    const gate = createR7BffEndpointImplementationGate();
    const driftedGate = {
      ...gate,
      boundary: { ...gate.boundary, official_parameter_set_write: true }
    };

    expect(() =>
      createR7TeacherScenarioSelectionReadinessProjection({
        implementationGate: driftedGate,
        parameterSet: parameterSet!,
        run,
        scenarioPackage: scenarioPackage!,
        tenantId: DEFAULT_TENANT_ID
      })
    ).toThrowError(
      expect.objectContaining<R7TeacherScenarioSelectionGateBlockedError>({
        noGoReasons: ["R7_BFF_GATE_PARAMETERSET_WRITE_DRIFT"],
        status: "FAIL"
      })
    );

    expect(() =>
      createR7TeacherScenarioSelectionReadinessProjection({
        implementationGate: null,
        parameterSet: parameterSet!,
        run,
        scenarioPackage: scenarioPackage!,
        tenantId: DEFAULT_TENANT_ID
      })
    ).toThrowError(
      expect.objectContaining<R7TeacherScenarioSelectionGateBlockedError>({
        noGoReasons: ["R7_BFF_GATE_NOT_OBJECT"],
        status: "UNKNOWN"
      })
    );
  });

  it("returns a blocked success projection for an authorized but unapproved ParameterSet", () => {
    const store = createP1Store();
    const run = seedRun(store);
    const scenarioPackage = store.scenarios[0];
    const parameterSet = store.parameterSets[0];
    expect(scenarioPackage).toBeDefined();
    expect(parameterSet).toBeDefined();

    const projection = createR7TeacherScenarioSelectionReadinessProjection({
      parameterSet: { ...parameterSet!, status: "candidate" },
      run,
      scenarioPackage: scenarioPackage!,
      tenantId: DEFAULT_TENANT_ID
    });

    expect(projection).toMatchObject({
      eligible: false,
      no_go_reasons: ["R7_BFF_PARAMETER_SET_NOT_APPROVED"],
      readiness_status: "BLOCKED"
    });
  });

  it("redacts unexpected repository failures behind the endpoint-specific 500 envelope", async () => {
    const store = createP1Store();
    seedRun(store);
    const repositoryProvider = createJsonRepositoryProvider({ store });
    repositoryProvider.facade.runs.getRun = async () => {
      throw new Error("private storage path C:/secret/snapshot.json state_true");
    };
    const server = createApiServer(store, { repositoryProvider });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("test server did not bind to a TCP port");
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const teacher = await login(baseUrl, "teacher", "teacher");
      const response = await request<R7ErrorBody>(baseUrl, endpointPath(), {
        requestId: "req_r7_internal_error",
        token: teacher.access_token
      });

      expect(response.status).toBe(500);
      expectSafeError(response.body, "R7_BFF_INTERNAL_ERROR");
      expect(JSON.stringify(response.body)).not.toContain("C:/secret/snapshot.json");
    } finally {
      await stopServer(server);
    }
  });
});

describe("R7 Teacher scenario package candidates endpoint", () => {
  it("returns a deterministic Teacher-safe same-tenant projection without writes", async () => {
    const { baseUrl, server, store } = await startServer();
    const sourceScenario = store.scenarios.find(
      (scenario) => scenario.scenario_package_id === SCENARIO_PACKAGE_ID
    );
    expect(sourceScenario).toBeDefined();
    store.scenarios.push(
      {
        ...sourceScenario!,
        scenario_package_id: ALTERNATE_SCENARIO_PACKAGE_ID,
        name: "Alternate R7 Candidate",
        version: "2.0.0"
      },
      {
        ...sourceScenario!,
        scenario_package_id: "scenario_other_tenant_private",
        tenant_id: OTHER_TENANT_ID,
        name: "Other Tenant Private Candidate",
        version: "9.9.9"
      }
    );

    try {
      const teacher = await login(baseUrl, "teacher", "teacher");
      const stateBefore = JSON.stringify(store);
      const response = await request<R7CandidateBody>(baseUrl, candidateEndpointPath(), {
        omitTenantHeader: true,
        requestId: "req_r7_candidates",
        token: teacher.access_token
      });

      expect(response.status).toBe(200);
      expect(R7_TEACHER_SCENARIO_PACKAGE_CANDIDATES_OPERATION_ID).toBe(
        "R7_TEACHER_SCENARIO_PACKAGE_CANDIDATES_GET_V1"
      );
      expect(response.body).toEqual({
        run_id: RUN_ID,
        current_scenario_package_id: SCENARIO_PACKAGE_ID,
        candidates: [
          {
            scenario_package_id: SCENARIO_PACKAGE_ID,
            display_name: "康养商战 M1 教学场景",
            version_label: "1.0.0",
            is_current: true
          },
          {
            scenario_package_id: ALTERNATE_SCENARIO_PACKAGE_ID,
            display_name: "Alternate R7 Candidate",
            version_label: "2.0.0",
            is_current: false
          }
        ]
      });
      expect(Object.keys(response.body).sort()).toEqual([
        "candidates",
        "current_scenario_package_id",
        "run_id"
      ]);
      expect(JSON.stringify(response.body)).not.toMatch(
        /tenant_id|plugin_package_ids|state_true|SettlementResult|ReplayManifest|canonical_evidence_digest|parameter_set/i
      );
      expect(JSON.stringify(response.body)).not.toContain("scenario_other_tenant_private");
      expect(JSON.stringify(store)).toBe(stateBefore);
    } finally {
      await stopServer(server);
    }
  });

  it("supports an empty provider result without inventing compatibility", async () => {
    const store = createP1Store();
    seedRun(store);
    const repositoryProvider = createJsonRepositoryProvider({ store });
    repositoryProvider.facade.scenarios.listScenarioPackagesForTenant = async () => [];
    const server = createApiServer(store, { repositoryProvider });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("test server did not bind to a TCP port");
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const teacher = await login(baseUrl, "teacher", "teacher");
      const response = await request<R7CandidateBody>(baseUrl, candidateEndpointPath(), {
        token: teacher.access_token
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        current_scenario_package_id: SCENARIO_PACKAGE_ID,
        candidates: []
      });
      expect(JSON.stringify(response.body)).not.toMatch(/READY|BLOCKED|compatible/i);
    } finally {
      await stopServer(server);
    }
  });

  it("fails closed for missing auth, non-Teacher actors and unknown or cross-tenant runs", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const teacher = await login(baseUrl, "teacher", "teacher");
      const student = await login(baseUrl, "student", "student");
      const otherTeacher = await login(baseUrl, "other_teacher", "teacher", OTHER_TENANT_ID);

      const unauthenticated = await request<R7ErrorBody>(baseUrl, candidateEndpointPath());
      expect(unauthenticated.status).toBe(401);
      expectSafeError(unauthenticated.body, "R7_BFF_AUTHENTICATION_REQUIRED");

      const denied = await request<R7ErrorBody>(baseUrl, candidateEndpointPath(), {
        token: student.access_token
      });
      expect(denied.status).toBe(403);
      expectSafeError(denied.body, "R7_BFF_TEACHER_AUTHORITY_REQUIRED");

      for (const response of await Promise.all([
        request<R7ErrorBody>(baseUrl, candidateEndpointPath("run_unknown"), {
          token: teacher.access_token
        }),
        request<R7ErrorBody>(baseUrl, candidateEndpointPath(), {
          tenantId: OTHER_TENANT_ID,
          token: otherTeacher.access_token
        })
      ])) {
        expect(response.status).toBe(404);
        expectSafeError(response.body, "R7_BFF_SCENARIO_SELECTION_CONTEXT_NOT_FOUND");
      }
    } finally {
      await stopServer(server);
    }
  });

  it("fails safely when the provider capability is unavailable and exposes no write method", async () => {
    const store = createP1Store();
    seedRun(store);
    const repositoryProvider = createJsonRepositoryProvider({ store });
    Object.assign(repositoryProvider.facade.scenarios, {
      listScenarioPackagesForTenant: undefined
    });
    const server = createApiServer(store, { repositoryProvider });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("test server did not bind to a TCP port");
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const teacher = await login(baseUrl, "teacher", "teacher");
      const unavailable = await request<R7ErrorBody>(baseUrl, candidateEndpointPath(), {
        token: teacher.access_token
      });
      expect(unavailable.status).toBe(503);
      expectSafeError(unavailable.body, "R7_BFF_SCENARIO_CANDIDATE_PROVIDER_UNAVAILABLE");

      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        const response = await request<R7ErrorBody>(baseUrl, candidateEndpointPath(), {
          method,
          token: teacher.access_token
        });
        expect(response.status).not.toBe(200);
      }
    } finally {
      await stopServer(server);
    }
  });
});
