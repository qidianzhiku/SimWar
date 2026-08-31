import { describe, expect, it } from "vitest";
import {
  createDeterministicMockGateway,
  AgentGatewayError
} from "../../services/agent-gateway/src/index.js";
import type { W020AdvisoryContext } from "@simwar/shared-contracts";

const context: W020AdvisoryContext = {
  actor_id_hash: "a".repeat(64),
  actor_role: "student",
  advisory_scopes: ["strategy"],
  context_digest: "b".repeat(64),
  course_id: "course_001",
  discriminator: "w020_role_safe_context",
  role_key: "CEO",
  round_id: "round_001",
  run_id: "run_001",
  source_event_ids: ["event_001"],
  source_event_types: ["section_saved"],
  team_id: "team_001",
  tenant_id: "tenant_demo",
  transformation_version: "w020-role-safe-context-v1"
};

describe("W020 deterministic Agent Gateway", () => {
  it("returns deterministic advisory and audit records without business-state fields", () => {
    const gateway = createDeterministicMockGateway();
    const first = gateway.generate({ context, role_key: "CEO", surface: "student_role" });
    const second = gateway.generate({ context, role_key: "CEO", surface: "student_role" });
    expect(first.coach_output.advisory_only).toBe(true);
    expect(first.coach_output).toEqual(second.coach_output);
    expect(first.model_call_log).toEqual(second.model_call_log);
    expect(first.coach_output).not.toHaveProperty("state_true");
    expect(first.coach_output).not.toHaveProperty("SettlementResult");
    expect(first.model_call_log.provider).toBe("deterministic-mock");
  });

  it("fails closed when a student asks for teacher debrief", () => {
    const gateway = createDeterministicMockGateway();
    expect(() =>
      gateway.generate({ context, role_key: "CEO", surface: "teacher_debrief" })
    ).toThrow(AgentGatewayError);
  });

  it("returns a governed context error instead of leaking a type error for malformed input", () => {
    const gateway = createDeterministicMockGateway();
    expect(() =>
      gateway.generate({ context: undefined as never, surface: "student_coach" })
    ).toThrowError(new AgentGatewayError("AGENT_CONTEXT_INVALID"));
  });
});
