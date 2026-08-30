import { once } from "node:events";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  ShanghaiC0Request
} from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store } from "../../services/api/src/store";
import {
  createFormalRunRuntimeBinding,
  type FormalRunBindingAuthorityPorts
} from "../../services/api/src/formal-run-runtime-binding";

const tenantId = "tenant_demo";
const runId = "shanghai-c0-http-run";
const roundId = "shanghai-c0-http-round-1";

async function appendFormalBinding(store: ReturnType<typeof createP1Store>): Promise<void> {
  const parameterReference = {
    content_digest: "a".repeat(64),
    parameter_set_id: "param_toy_approved_1",
    version: "1.0.0"
  };
  const scenarioReference = {
    content_digest: "b".repeat(64),
    scenario_package_id: "scenario_eldercare_demo",
    tenant_id: tenantId,
    version: "1.0.0"
  };
  const parameter = {
    compatibility_metadata: { engine_family: "toy_logit" },
    content_digest: parameterReference.content_digest,
    model_version_ref: "model_shanghai_http@1.0.0",
    parameter_values: {},
    parameter_set_id: parameterReference.parameter_set_id,
    reference: parameterReference,
    schema_version: "parameter-set.v1",
    status: "APPROVED" as const,
    tenant_id: tenantId,
    version: parameterReference.version
  };
  const scenario = {
    artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" },
    compatibility_metadata: { engine_family: "toy_logit" },
    content: {},
    content_digest: scenarioReference.content_digest,
    metadata: {},
    parameter_set_reference: parameterReference,
    plugin_dependencies: [],
    reference: scenarioReference,
    scenario_package_id: scenarioReference.scenario_package_id,
    schema_version: "scenario-package.v1",
    status: "APPROVED" as const,
    tenant_id: tenantId,
    version: scenarioReference.version
  };
  const authorities: FormalRunBindingAuthorityPorts = {
    parameterSets: {
      assertBindable: async () => undefined,
      getByReference: async () => parameter
    },
    plugins: {
      getByReference: async () => null,
      resolveAvailableForNewBinding: async () => null
    },
    scenarios: {
      assertBindable: async () => undefined,
      getByReference: async () => scenario
    }
  };
  const binding = await createFormalRunRuntimeBinding({
    authorities,
    engine_reference: { engine_id: "toy_logit_wellness_v1", version: "0.1.0" },
    parameter_set_reference: parameterReference,
    run_id: runId,
    scenario_package_reference: scenarioReference,
    seed: 42,
    tenant_id: tenantId
  });
  store.formalRunRuntimeBindings.push(binding);
}

function request(macroId: ShanghaiC0Request["macro_id"]): ShanghaiC0Request {
  const experiment = {
    action:
      macroId === "M13"
        ? "loan"
        : macroId === "M14"
          ? "positioning"
          : macroId === "M15"
            ? "service_shock"
            : macroId === "M16"
              ? "requalification"
              : macroId === "M17"
                ? "episode"
                : "diff",
    option_id: `${macroId.toLowerCase()}-http-option`,
    region: "shanghai",
    cohort: "community-eldercare",
    service_bundle: "integrated-care",
    positioning: "trusted-care",
    staffing_shock: -0.1,
    capacity_shock: -0.1,
    quality_shock: -0.1,
    horizon_rounds: macroId === "M15" ? 2 : undefined,
    episode_no: macroId === "M17" ? 2 : undefined,
    target_version: macroId === "M18" ? "2.0.0" : undefined
  };
  return {
    discriminator: "shanghai_c0_conversion_request",
    macro_id: macroId,
    exact_binding: {
      exact_binding: true,
      tenant_id: tenantId,
      course_id: "course_demo",
      run_id: runId,
      team_id: "team_alpha",
      round_id: roundId,
      round_no: 1,
      scenario_package_id: "scenario_eldercare_demo",
      scenario_package_version: "1.0.0",
      parameter_set_id: "param_toy_approved_1",
      parameter_set_version: "1.0.0",
      model_version_id: "model_shanghai_http",
      model_version: "1.0.0",
      engine_id: "toy_logit_wellness_v1",
      seed: 42
    },
    experience_profile: "ADVANCED",
    experiment,
    idempotency_key: `shanghai-c0-http-${macroId}`
  };
}

async function login(baseUrl: string, username: "teacher" | "student" | "admin"): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-tenant-id": tenantId },
    body: JSON.stringify({ username, password: username })
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as ApiEnvelope<AuthSession>).data.access_token;
}

describe("Shanghai C0 conversion real BFF", () => {
  it("serves all six macros through Teacher, Student and Admin journeys", async () => {
    const store = createP1Store();
    store.runs.push({
      run_id: runId,
      tenant_id: tenantId,
      course_id: "course_demo",
      scenario_package_id: "scenario_eldercare_demo",
      parameter_set_id: "param_toy_approved_1",
      seed: 42,
      status: "active"
    });
    store.rounds.push({
      round_id: roundId,
      tenant_id: tenantId,
      run_id: runId,
      round_no: 1,
      status: "open"
    });
    await appendFormalBinding(store);
    const server = createApiServer(store);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server address unavailable");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    try {
      const teacher = await login(baseUrl, "teacher");
      const student = await login(baseUrl, "student");
      const admin = await login(baseUrl, "admin");
      const invalidResponse = await fetch(`${baseUrl}/api/v1/bff/teacher/shanghai-c0/conversions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${teacher}`,
          "content-type": "application/json",
          "x-tenant-id": tenantId
        },
        body: JSON.stringify({
          ...request("M14"),
          experiment: { ...request("M14").experiment, score: 0.8 }
        })
      });
      expect(invalidResponse.status).toBe(422);
      const invalidBody = (await invalidResponse.json()) as { code: string };
      expect(invalidBody.code).toBe("SH_C0_INPUT_INVALID");
      expect(invalidBody.code).not.toBe("OK");

      const unauthenticatedResponse = await fetch(
        `${baseUrl}/api/v1/bff/teacher/shanghai-c0/conversions`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-tenant-id": tenantId },
          body: JSON.stringify(request("M13"))
        }
      );
      expect(unauthenticatedResponse.status).toBe(401);
      const unauthenticatedBody = (await unauthenticatedResponse.json()) as { code: string };
      expect(unauthenticatedBody.code).not.toBe("SH_C0_INPUT_INVALID");
      for (const macroId of ["M13", "M14", "M15", "M16", "M17", "M18"] as const) {
        const createResponse = await fetch(
          `${baseUrl}/api/v1/bff/teacher/shanghai-c0/conversions`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${teacher}`,
              "content-type": "application/json",
              "x-tenant-id": tenantId
            },
            body: JSON.stringify(request(macroId))
          }
        );
        expect(createResponse.status).toBe(201);
        const created = (await createResponse.json()) as ApiEnvelope<{
          receipt: { receipt_id: string; consumer_status: string };
        }>;
        expect(created.data.receipt.consumer_status).toBe("C0_CONSUMED");
        const receiptId = created.data.receipt.receipt_id;

        const studentResponse = await fetch(
          `${baseUrl}/api/v1/bff/student/shanghai-c0/conversions/${encodeURIComponent(receiptId)}`,
          { headers: { authorization: `Bearer ${student}`, "x-tenant-id": tenantId } }
        );
        expect(studentResponse.status).toBe(200);
        const studentProjection = (await studentResponse.json()) as ApiEnvelope<
          Record<string, unknown>
        >;
        expect(JSON.stringify(studentProjection.data)).not.toContain("parameter_set_id");

        const adminResponse = await fetch(
          `${baseUrl}/api/v1/bff/admin/shanghai-c0/conversions/${encodeURIComponent(receiptId)}`,
          { headers: { authorization: `Bearer ${admin}`, "x-tenant-id": tenantId } }
        );
        expect(adminResponse.status).toBe(200);
        const adminProjection = (await adminResponse.json()) as ApiEnvelope<
          Record<string, unknown>
        >;
        expect(JSON.stringify(adminProjection.data)).toContain("NOT_PROVEN");
      }
    } finally {
      server.close();
    }
  });

  it("keeps a student choice outside the official store", async () => {
    const store = createP1Store();
    store.runs.push({
      run_id: runId,
      tenant_id: tenantId,
      course_id: "course_demo",
      scenario_package_id: "scenario_eldercare_demo",
      parameter_set_id: "param_toy_approved_1",
      seed: 42,
      status: "active"
    });
    store.rounds.push({
      round_id: roundId,
      tenant_id: tenantId,
      run_id: runId,
      round_no: 1,
      status: "open"
    });
    await appendFormalBinding(store);
    const before = JSON.stringify({
      decisions: store.decisions,
      settlementResults: store.settlementResults
    });
    const server = createApiServer(store);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server address unavailable");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    try {
      const teacher = await login(baseUrl, "teacher");
      const student = await login(baseUrl, "student");
      const createResponse = await fetch(`${baseUrl}/api/v1/bff/teacher/shanghai-c0/conversions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${teacher}`,
          "content-type": "application/json",
          "x-tenant-id": tenantId
        },
        body: JSON.stringify(request("M14"))
      });
      const created = (await createResponse.json()) as ApiEnvelope<{
        receipt: { receipt_id: string };
      }>;
      const choiceResponse = await fetch(
        `${baseUrl}/api/v1/bff/student/shanghai-c0/conversions/${created.data.receipt.receipt_id}/choice`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${student}`,
            "content-type": "application/json",
            "x-tenant-id": tenantId
          },
          body: JSON.stringify({ option_id: "positioning-choice" })
        }
      );
      expect(choiceResponse.status).toBe(200);
      expect(JSON.stringify(store.decisions)).toBe(JSON.stringify([]));
      expect(JSON.stringify(store.settlementResults)).toBe(JSON.stringify([]));
      expect(
        JSON.stringify({ decisions: store.decisions, settlementResults: store.settlementResults })
      ).toBe(before);
    } finally {
      server.close();
    }
  });
});
