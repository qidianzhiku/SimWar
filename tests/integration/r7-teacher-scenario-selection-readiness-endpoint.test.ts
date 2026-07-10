import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type { ApiEnvelope, AuthSession, Run } from "../../packages/shared-contracts/src";
import { createR7BffEndpointImplementationGate } from "../../packages/shared-contracts/src";
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

async function request<TBody>(
  baseUrl: string,
  path: string,
  options: {
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

  const response = await fetch(`${baseUrl}${path}`, { headers });
  return { body: (await response.json()) as TBody, status: response.status };
}

async function login(
  baseUrl: string,
  username: string,
  password: string,
  tenantId = DEFAULT_TENANT_ID
): Promise<AuthSession> {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    body: JSON.stringify({ password, username }),
    headers: { "content-type": "application/json", "x-tenant-id": tenantId },
    method: "POST"
  });
  const body = (await response.json()) as ApiEnvelope<AuthSession>;
  expect(response.status).toBe(200);
  return body.data;
}

function endpointPath(
  runId = RUN_ID,
  scenarioPackageId = SCENARIO_PACKAGE_ID,
  parameterSetId = PARAMETER_SET_ID
): string {
  return `/api/v1/bff/teacher/runs/${runId}/scenario-selection-readiness?scenarioPackageId=${scenarioPackageId}&parameterSetId=${parameterSetId}`;
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
