import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type { ApiEnvelope, AuthSession } from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import { CourseBlueprintBindingStore } from "../../services/api/src/course-blueprint-binding-store";
import { createCourseBlueprintBinding } from "../../services/api/src/course-blueprint-binding";
import { createP1Store, type SimWarStore } from "../../services/api/src/store";

const exactBlueprintRef = {
  content_digest: "a".repeat(64),
  discriminator: "exact_ref",
  resource_id: "blueprint_course_001",
  resource_type: "course_blueprint",
  tenant_id: "tenant_demo",
  version: "1.0.0"
} as const;

async function startServer(
  store: SimWarStore = createP1Store()
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

async function login(baseUrl: string, username: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    body: JSON.stringify({ password: username, username }),
    headers: { "content-type": "application/json", "x-tenant-id": "tenant_demo" },
    method: "POST"
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as ApiEnvelope<AuthSession>).data.access_token;
}

async function request<T>(
  baseUrl: string,
  path: string,
  token: string,
  body?: unknown,
  method?: "GET" | "POST"
): Promise<{ body: ApiEnvelope<T>; status: number }> {
  const response = await fetch(`${baseUrl}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-tenant-id": "tenant_demo"
    },
    method: method ?? (body === undefined ? "GET" : "POST")
  });
  return { body: (await response.json()) as ApiEnvelope<T>, status: response.status };
}

describe("Instructor Intelligence teacher boundary", () => {
  it("requires an exact CourseBlueprint ref, publishes only explicitly, and leaves truth state unchanged", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const teacher = await login(baseUrl, "teacher");
      const student = await login(baseUrl, "student");
      new CourseBlueprintBindingStore(store).append(
        createCourseBlueprintBinding({
          binding_schema_version: "course-blueprint-binding.v1",
          course_blueprint_reference: {
            content_digest: exactBlueprintRef.content_digest,
            course_blueprint_id: exactBlueprintRef.resource_id,
            tenant_id: exactBlueprintRef.tenant_id,
            version: exactBlueprintRef.version
          },
          course_id: "course_demo",
          tenant_id: "tenant_demo"
        })
      );
      new CourseBlueprintBindingStore(store).append(
        createCourseBlueprintBinding({
          binding_schema_version: "course-blueprint-binding.v1",
          course_blueprint_reference: {
            content_digest: exactBlueprintRef.content_digest,
            course_blueprint_id: "blueprint_course_other_001",
            tenant_id: exactBlueprintRef.tenant_id,
            version: exactBlueprintRef.version
          },
          course_id: "course_other",
          tenant_id: "tenant_demo"
        })
      );

      const denied = await request<unknown>(
        baseUrl,
        "/api/v1/bff/teacher/instructor-assets",
        student
      );
      expect(denied.status).toBe(403);

      const unbound = await request<unknown>(
        baseUrl,
        "/api/v1/bff/teacher/instructor-assets/drafts",
        teacher,
        {
          course_id: "course_not_bound",
          title: "Unbound debrief"
        }
      );
      expect(unbound.status).toBe(422);
      expect(store.instructorAssets).toHaveLength(0);

      const draft = await request<{ asset_id: string; status: string }>(
        baseUrl,
        "/api/v1/bff/teacher/instructor-assets/drafts",
        teacher,
        { course_id: "course_demo", title: "Round one debrief" }
      );
      expect(draft.status).toBe(201);
      expect(draft.body.data.status).toBe("draft");
      expect(JSON.stringify(draft.body.data)).not.toContain("state_true");

      const published = await request<{ status: string }>(
        baseUrl,
        `/api/v1/bff/teacher/instructor-assets/${draft.body.data.asset_id}/publish`,
        teacher,
        {}
      );
      expect(published.status).toBe(200);
      expect(published.body.data.status).toBe("teacher_published");
      expect(
        (
          await request<unknown>(
            baseUrl,
            `/api/v1/bff/teacher/instructor-assets/${draft.body.data.asset_id}/reject`,
            teacher,
            undefined,
            "POST"
          )
        ).status
      ).toBe(422);
      expect(
        (
          await request<unknown>(
            baseUrl,
            `/api/v1/bff/teacher/instructor-assets/${draft.body.data.asset_id}/reject`,
            teacher,
            []
          )
        ).status
      ).toBe(422);
      expect(
        (
          await request<unknown>(
            baseUrl,
            `/api/v1/bff/teacher/instructor-assets/${draft.body.data.asset_id}/reject`,
            teacher,
            {}
          )
        ).status
      ).toBe(409);
      const otherCourseDraft = await request<{ asset_id: string }>(
        baseUrl,
        "/api/v1/bff/teacher/instructor-assets/drafts",
        teacher,
        { course_id: "course_other", title: "Other course debrief" }
      );
      const courseAssets = await request<Array<{ asset_id: string }>>(
        baseUrl,
        "/api/v1/bff/teacher/instructor-assets?course_id=course_demo",
        teacher
      );
      expect(courseAssets.status).toBe(200);
      expect(courseAssets.body.data.map((asset) => asset.asset_id)).not.toContain(
        otherCourseDraft.body.data.asset_id
      );
      store.runs.push({
        course_id: "course_other",
        parameter_set_id: "param_toy_approved_1",
        run_id: "run_other_course_001",
        scenario_package_id: "scenario_eldercare_demo",
        seed: 8,
        status: "active",
        tenant_id: "tenant_demo"
      });
      store.rounds.push({
        round_id: "round_other_course_001",
        round_no: 1,
        run_id: "run_other_course_001",
        status: "published",
        tenant_id: "tenant_demo"
      });
      const crossCourse = await request<unknown>(
        baseUrl,
        `/api/v1/bff/teacher/instructor-intelligence?asset_id=${draft.body.data.asset_id}&run_id=run_other_course_001&round_no=1`,
        teacher
      );
      expect(crossCourse.status).toBe(404);
      const rejectedDraft = await request<{ asset_id: string; status: string }>(
        baseUrl,
        "/api/v1/bff/teacher/instructor-assets/drafts",
        teacher,
        { course_id: "course_demo", title: "Rejected debrief" }
      );
      const rejected = await request<{ status: string }>(
        baseUrl,
        `/api/v1/bff/teacher/instructor-assets/${rejectedDraft.body.data.asset_id}/reject`,
        teacher,
        {}
      );
      expect(rejected.status).toBe(200);
      expect(rejected.body.data.status).toBe("rejected");
      const revision = await request<{ revision_of_asset_id?: string; status: string }>(
        baseUrl,
        `/api/v1/bff/teacher/instructor-assets/${rejectedDraft.body.data.asset_id}/revisions`,
        teacher,
        { title: "Rejected debrief revised" }
      );
      expect(revision.status).toBe(201);
      expect(revision.body.data.status).toBe("draft");
      expect(revision.body.data.revision_of_asset_id).toBe(rejectedDraft.body.data.asset_id);
      expect(
        (
          await request<unknown>(
            baseUrl,
            `/api/v1/bff/teacher/instructor-assets/${revision.body.data.asset_id}/revisions`,
            teacher,
            { title: "Must fail while draft" }
          )
        ).status
      ).toBe(409);
      store.runs.push({
        course_id: "course_demo",
        parameter_set_id: "param_toy_approved_1",
        run_id: "run_instructor_001",
        scenario_package_id: "scenario_eldercare_demo",
        seed: 7,
        status: "active",
        tenant_id: "tenant_demo"
      });
      store.rounds.push({
        round_id: "round_instructor_001",
        round_no: 1,
        run_id: "run_instructor_001",
        status: "published",
        tenant_id: "tenant_demo"
      });
      const truthBefore = JSON.stringify({
        decisions: store.decisions,
        results: store.settlementResults,
        rounds: store.rounds,
        runs: store.runs
      });
      store.rounds.at(-1)!.status = "open";
      expect(
        (
          await request<unknown>(
            baseUrl,
            `/api/v1/bff/teacher/instructor-intelligence?asset_id=${draft.body.data.asset_id}&run_id=run_instructor_001&round_no=1`,
            teacher
          )
        ).status
      ).toBe(409);
      store.rounds.at(-1)!.status = "published";
      const kit = await request<{
        ai_status: string;
        anomaly_status: string;
        known_limits: string[];
      }>(
        baseUrl,
        `/api/v1/bff/teacher/instructor-intelligence?asset_id=${draft.body.data.asset_id}&run_id=run_instructor_001&round_no=1`,
        teacher
      );
      expect(kit.status, JSON.stringify(kit.body)).toBe(200);
      expect(kit.body.data.ai_status).toBe("off");
      expect(kit.body.data.anomaly_status).toBe("baseline_unavailable");
      expect(kit.body.data.known_limits).toContain("not_postgresql_active_runtime");
      expect(
        JSON.stringify({
          decisions: store.decisions,
          results: store.settlementResults,
          rounds: store.rounds,
          runs: store.runs
        })
      ).toBe(truthBefore);
    } finally {
      await stopServer(server);
    }
  });

  it("compensates created, transitioned, and revised assets when audit persistence fails", async () => {
    const store = createP1Store();
    let rejectedAuditAction: string | undefined;
    store.persist = () => {
      if (store.auditLogs.at(-1)?.action === rejectedAuditAction) {
        rejectedAuditAction = undefined;
        throw new Error("injected instructor audit persistence failure");
      }
    };
    const { baseUrl, server } = await startServer(store);
    try {
      const teacher = await login(baseUrl, "teacher");
      new CourseBlueprintBindingStore(store).append(
        createCourseBlueprintBinding({
          binding_schema_version: "course-blueprint-binding.v1",
          course_blueprint_reference: {
            content_digest: exactBlueprintRef.content_digest,
            course_blueprint_id: exactBlueprintRef.resource_id,
            tenant_id: exactBlueprintRef.tenant_id,
            version: exactBlueprintRef.version
          },
          course_id: "course_demo",
          tenant_id: "tenant_demo"
        })
      );
      rejectedAuditAction = "instructor_asset.draft_create";
      const beforeCreateAudit = {
        auditLogs: structuredClone(store.auditLogs),
        counters: { ...store.counters }
      };
      expect(
        (
          await request<unknown>(baseUrl, "/api/v1/bff/teacher/instructor-assets/drafts", teacher, {
            course_id: "course_demo",
            title: "Audit rollback create"
          })
        ).status
      ).toBe(500);
      expect(store.instructorAssets).toEqual([]);
      expect(store.auditLogs).toEqual(beforeCreateAudit.auditLogs);
      expect(store.counters).toEqual(beforeCreateAudit.counters);

      const draft = await request<{ asset_id: string }>(
        baseUrl,
        "/api/v1/bff/teacher/instructor-assets/drafts",
        teacher,
        { course_id: "course_demo", title: "Audit rollback transition" }
      );
      rejectedAuditAction = "instructor_asset.publish";
      const beforePublishAudit = {
        auditLogs: structuredClone(store.auditLogs),
        counters: { ...store.counters }
      };
      const beforePublishAsset = structuredClone(store.instructorAssets);
      expect(
        (
          await request<unknown>(
            baseUrl,
            `/api/v1/bff/teacher/instructor-assets/${draft.body.data.asset_id}/publish`,
            teacher,
            {}
          )
        ).status
      ).toBe(500);
      expect(store.instructorAssets).toEqual([
        expect.objectContaining({ asset_id: draft.body.data.asset_id, status: "draft" })
      ]);
      expect(store.instructorAssets).toEqual(beforePublishAsset);
      expect(store.auditLogs).toEqual(beforePublishAudit.auditLogs);
      expect(store.counters).toEqual(beforePublishAudit.counters);

      await request<unknown>(
        baseUrl,
        `/api/v1/bff/teacher/instructor-assets/${draft.body.data.asset_id}/publish`,
        teacher,
        {}
      );
      rejectedAuditAction = "instructor_asset.revision_create";
      const beforeRevisionAudit = {
        auditLogs: structuredClone(store.auditLogs),
        counters: { ...store.counters }
      };
      expect(
        (
          await request<unknown>(
            baseUrl,
            `/api/v1/bff/teacher/instructor-assets/${draft.body.data.asset_id}/revisions`,
            teacher,
            { title: "Audit rollback revision" }
          )
        ).status
      ).toBe(500);
      expect(store.instructorAssets).toHaveLength(1);
      expect(store.auditLogs).toEqual(beforeRevisionAudit.auditLogs);
      expect(store.counters).toEqual(beforeRevisionAudit.counters);
    } finally {
      await stopServer(server);
    }
  });

  it("compares adjacent published rounds through state_obs only", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const teacher = await login(baseUrl, "teacher");
      new CourseBlueprintBindingStore(store).append(
        createCourseBlueprintBinding({
          binding_schema_version: "course-blueprint-binding.v1",
          course_blueprint_reference: {
            content_digest: exactBlueprintRef.content_digest,
            course_blueprint_id: exactBlueprintRef.resource_id,
            tenant_id: exactBlueprintRef.tenant_id,
            version: exactBlueprintRef.version
          },
          course_id: "course_demo",
          tenant_id: "tenant_demo"
        })
      );
      const draft = await request<{ asset_id: string }>(
        baseUrl,
        "/api/v1/bff/teacher/instructor-assets/drafts",
        teacher,
        { course_id: "course_demo", title: "Published delta debrief" }
      );
      await request<unknown>(
        baseUrl,
        `/api/v1/bff/teacher/instructor-assets/${draft.body.data.asset_id}/publish`,
        teacher,
        {}
      );
      store.runs.push({
        course_id: "course_demo",
        parameter_set_id: "param_toy_approved_1",
        run_id: "run_delta_001",
        scenario_package_id: "scenario_eldercare_demo",
        seed: 13,
        status: "active",
        tenant_id: "tenant_demo"
      });
      for (const round_no of [1, 2]) {
        store.rounds.push({
          round_id: `round_delta_${round_no}`,
          round_no,
          run_id: "run_delta_001",
          status: "published",
          tenant_id: "tenant_demo"
        });
        store.settlementResults.push({
          parameter_set_id: "param_toy_approved_1",
          replay_hash: "c".repeat(64),
          round_id: `round_delta_${round_no}`,
          round_no,
          run_id: "run_delta_001",
          scenario_package_id: "scenario_eldercare_demo",
          settlement_result_id: `settlement_delta_${round_no}`,
          team_results: [
            {
              state_est: {
                explanation: "Observed result",
                next_round_risk: "balanced",
                recommended_focus: "Observe"
              },
              state_obs: {
                demand_band: "medium",
                profit_band: "thin",
                rank: round_no === 1 ? 1 : 2,
                revenue: 100,
                score: round_no === 1 ? 50 : 62,
                served_demand: 10
              },
              state_true: {
                cash_flow: round_no === 1 ? -999 : 999999,
                cost: 0,
                demand: 0,
                market_share: 0,
                profit: 0,
                rank: 1,
                revenue: 0,
                score: 0,
                served_demand: 0,
                settlement_status: "settled"
              },
              team_id: "team_delta",
              team_name: "Delta Team"
            }
          ],
          tenant_id: "tenant_demo"
        });
      }
      const kit = await request<{
        anomaly_status: string;
        result_delta: {
          average_score_delta: number;
          baseline_round_no: number;
          rank_change_count: number;
        };
      }>(
        baseUrl,
        `/api/v1/bff/teacher/instructor-intelligence?asset_id=${draft.body.data.asset_id}&run_id=run_delta_001&round_no=2`,
        teacher
      );
      expect(kit.status, JSON.stringify(kit.body)).toBe(200);
      expect(kit.body.data.anomaly_status).toBe("material_delta");
      expect(kit.body.data.result_delta).toMatchObject({
        average_score_delta: 12,
        baseline_round_no: 1,
        rank_change_count: 1
      });
      expect(JSON.stringify(kit.body.data)).not.toContain("state_true");
    } finally {
      await stopServer(server);
    }
  });
});
