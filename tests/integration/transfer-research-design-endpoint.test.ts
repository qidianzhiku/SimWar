import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import { createApiServer } from "../../services/api/src/server.js";
import { createP1Store } from "../../services/api/src/store.js";

const tenantId = "tenant_demo";
const ref = (resource_id: string, resource_type: string, content_digest: string) => ({
  content_digest,
  discriminator: "exact_ref",
  resource_id,
  resource_type,
  tenant_id: tenantId,
  version: "1.0.0"
});

async function start(): Promise<{ baseUrl: string; server: Server }> {
  const server = createApiServer(createP1Store());
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

async function login(baseUrl: string, username: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    body: JSON.stringify({ password: username, username }),
    headers: { "content-type": "application/json", "x-tenant-id": tenantId },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: { access_token: string } }).data.access_token;
}

function body() {
  return {
    analysis_plan_ref: ref("plan_d6", "transfer_analysis_plan_version", "1".repeat(64)),
    course_package_ref: ref("package_d6", "course_package_version", "2".repeat(64)),
    d4_source_ref: ref("report_d4", "student_learning_report", "3".repeat(64)),
    d5_source_ref: ref("bundle_d5", "learning_export_bundle_version", "4".repeat(64)),
    instrument: {
      items: [{ item_id: "item_1", prompt: "Describe the opportunity", response_type: "TEXT" }],
      source_type: "LEARNER_SELF_REPORT"
    },
    learning_goal_ref: ref("goal_d6", "learning_goal_version", "5".repeat(64)),
    observation_windows: [
      { code: "W0_BASELINE", offset_days: 0, tolerance_days: 7 },
      { code: "W2_30D", offset_days: 30, tolerance_days: 7 }
    ],
    outcome_measures: [
      {
        code: "APPLICATION_STATE",
        allowed_states: ["NOT_ASSESSED", "ATTEMPTED_APPLICATION"],
        missing_is_not_negative: true,
        role: "PRIMARY"
      }
    ],
    provenance_source_policy: {
      allowed_source_types: ["LEARNER_SELF_REPORT", "SUPERVISOR_OBSERVATION"],
      minimum_source_types: 2,
      required_provenance_complete: true,
      small_cohort_minimum: 5,
      retention_days: 90,
      deletion_mode: "DELETE_ON_EXPIRY"
    },
    rubric_ref: ref("rubric_d6", "rubric_version", "6".repeat(64)),
    title: "D6 API synthetic design"
  };
}

describe("D6 transfer research design endpoint", () => {
  it("supports teacher preview/freeze/list and has no student route", async () => {
    const { baseUrl, server } = await start();
    try {
      const token = await login(baseUrl, "teacher");
      const headers = {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-tenant-id": tenantId
      };
      const preview = await fetch(
        `${baseUrl}/api/v1/bff/teacher/transfer-research-designs/preview`,
        { body: JSON.stringify(body()), headers, method: "POST" }
      );
      expect(preview.status).toBe(200);
      expect((await preview.json()).data.study.lifecycle).toBe("READY_WITH_LIMITS");
      const frozen = await fetch(`${baseUrl}/api/v1/bff/teacher/transfer-research-designs/freeze`, {
        body: JSON.stringify(body()),
        headers,
        method: "POST"
      });
      expect(frozen.status).toBe(201);
      const frozenBody = await frozen.json();
      expect(frozenBody.data.synthetic_preview.runtime_status).toBe("SYNTHETIC_ONLY");
      expect(frozenBody.data.study.formal_transfer_claim_write).toBe(false);
      const list = await fetch(`${baseUrl}/api/v1/bff/teacher/transfer-research-designs`, {
        headers
      });
      expect(list.status).toBe(200);
      expect((await list.json()).data.studies).toHaveLength(1);
      const student = await fetch(`${baseUrl}/api/v1/bff/student/transfer-research-designs`, {
        headers
      });
      expect(student.status).toBe(404);
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
