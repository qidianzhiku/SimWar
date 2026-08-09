import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@simwar/shared-contracts";
import { handleW020AdvisoryRoute } from "../../services/api/src/routes/w020-advisory-routes.js";
import { GovernedAdvisoryService } from "../../services/api/src/w020-advisory-service.js";

const actor: CurrentUser = { display_name: "Teacher", permissions: ["course:read"], roles: ["teacher"], tenant_id: "tenant_demo", user_id: "usr_teacher" };

function response() {
  return { statusCode: 0, body: "", writeHead(status: number) { this.statusCode = status; }, end(body: string) { this.body = body; } };
}

describe("W020 advisory BFF routes", () => {
  it("keeps student surface separate from teacher audit and returns safe projection", async () => {
    const records: never[] = [];
    const service = new GovernedAdvisoryService({
      repository: { list: async () => records, append: async (record) => records.push(record as never) },
      roleWorkflow: { readRoleWorkflow: () => ({ course: { course_id: "course_001" }, run: { tenant_id: "tenant_demo" }, round: { round_id: "round_001" }, team: { tenant_id: "tenant_demo" }, assignments: [], sections: [], merge_commits: [], confirmations: [], decisions: [], events: [] }), commitRoleWorkflow: () => undefined } as never
    });
    const res = response();
    const helpers = {
      readJson: async () => ({ run_id: "run_001", round_id: "round_001", team_id: "team_001", idempotency_key: "idem_001" }),
      sendJson: (_target: unknown, status: number, payload: unknown) => { res.writeHead(status); res.end(JSON.stringify(payload)); },
      createEnvelope: (_context: unknown, payload: unknown) => ({ code: "OK", data: payload }),
      requireStudent: () => undefined,
      requireTeacher: () => undefined
    };
    const handled = await handleW020AdvisoryRoute(service, { method: "GET" } as never, res as never, new URL("http://localhost/api/v1/bff/teacher/advisors/audit"), { requestId: "req_1", tenantId: "tenant_demo", actor }, helpers);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain("raw_prompt");
  });
});
