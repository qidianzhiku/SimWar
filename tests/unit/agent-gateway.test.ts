import { describe, expect, expectTypeOf, it } from "vitest";
import {
  isW020AdvisoryContext,
  isW020AdvisoryRequest,
  isW020CoachOutput,
  isW020ModelCallLog
} from "../../packages/shared-contracts/src/w020-governed-ai-advisory.js";
import {
  AgentGatewayError,
  createDeterministicMockGateway,
  createDeterministicMockProvider,
  createGovernedAgentGateway,
  type AgentGatewayOutcome,
  type AgentProviderPort,
  type GovernedAgentGateway
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

function governedGateway(provider?: AgentProviderPort): GovernedAgentGateway {
  return createGovernedAgentGateway(provider);
}

function deterministicProvider(): AgentProviderPort {
  return createDeterministicMockProvider();
}

function requireSuccess(outcome: AgentGatewayOutcome) {
  expect(outcome.status).toBe("succeeded");
  if (outcome.status !== "succeeded") throw new Error(`Expected success, got ${outcome.status}`);
  return outcome;
}

function candidateFor(
  candidateContext: W020AdvisoryContext = context,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    advisory_text: "Review the visible role scope and prepare a reversible next decision.",
    evidence_refs: [...candidateContext.source_event_ids],
    ...overrides
  };
}

function outputFor(
  candidateContext: W020AdvisoryContext = context,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    ...candidateFor(candidateContext),
    advisory_only: true,
    coach_output_id: "coach-output-001",
    created_at: "1970-01-01T00:00:00.000Z",
    model_call_log_id: "model-call-001",
    output_type: "advisory",
    round_id: candidateContext.round_id,
    run_id: candidateContext.run_id,
    ...(candidateContext.role_key ? { role_key: candidateContext.role_key } : {}),
    team_id: candidateContext.team_id,
    tenant_id: candidateContext.tenant_id,
    ...overrides
  };
}

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

  it("exposes a closed injectable provider port and governed composition", () => {
    expectTypeOf<AgentProviderPort>().toHaveProperty("provider").toBeString();
    expectTypeOf<AgentProviderPort>().toHaveProperty("model").toBeString();
    expectTypeOf<AgentProviderPort>().toHaveProperty("generate").toBeFunction();

    const provider: AgentProviderPort = {
      model: "test-model",
      provider: "test-provider",
      generate: () => candidateFor()
    };
    const gateway = governedGateway(provider);

    const outcome = requireSuccess(
      gateway.generate({ context, role_key: "CEO", surface: "student_role" })
    );
    expect(outcome.coach_output.advisory_only).toBe(true);
    expect(outcome.coach_output.coach_output_id).toMatch(/^coach_output_[a-f0-9]{24}$/);
    expect(outcome.coach_output.tenant_id).toBe(context.tenant_id);
    expect(outcome.coach_output.run_id).toBe(context.run_id);
    expect(outcome.coach_output.round_id).toBe(context.round_id);
    expect(outcome.coach_output.team_id).toBe(context.team_id);
    expect(outcome.coach_output.role_key).toBe(context.role_key);
    expect(isW020CoachOutput(outcome.coach_output, context)).toBe(true);
    expect(
      isW020ModelCallLog(outcome.model_call_log, {
        model_call_log_id: outcome.coach_output.model_call_log_id,
        status: "succeeded",
        tenant_id: context.tenant_id
      })
    ).toBe(true);
    expect(outcome.coach_output.model_call_log_id).toBe(outcome.model_call_log.model_call_log_id);
    expect(outcome.model_call_log.status).toBe("succeeded");
  });

  it("returns a failed outcome with a gateway-authored failed log when the provider throws", () => {
    const provider: AgentProviderPort = {
      model: "throwing-model",
      provider: "throwing-provider",
      generate: () => {
        throw new Error("provider secret must not escape");
      }
    };
    const gateway = governedGateway(provider);

    const outcome = gateway.generate({ context, role_key: "CEO", surface: "student_role" });
    expect(outcome).toMatchObject({ status: "failed", code: "AGENT_PROVIDER_FAILED" });
    expect(outcome).not.toHaveProperty("coach_output");
    expect(outcome.model_call_log).toMatchObject({
      advisory_only: true,
      model: "throwing-model",
      provider: "throwing-provider",
      status: "failed",
      tenant_id: context.tenant_id
    });
    expect(JSON.stringify(outcome)).not.toContain("provider secret must not escape");
  });

  it("returns a rejected outcome with no CoachOutput when provider output is malformed", () => {
    const provider: AgentProviderPort = {
      model: "malformed-model",
      provider: "malformed-provider",
      generate: () => candidateFor(context, { advisory_text: "   " })
    };
    const gateway = governedGateway(provider);

    const outcome = gateway.generate({ context, role_key: "CEO", surface: "student_role" });
    expect(outcome).toMatchObject({ status: "rejected", code: "AGENT_OUTPUT_REJECTED" });
    expect(outcome).not.toHaveProperty("coach_output");
    expect(outcome.model_call_log).toMatchObject({
      advisory_only: true,
      model: "malformed-model",
      provider: "malformed-provider",
      status: "rejected",
      tenant_id: context.tenant_id
    });
  });

  it("rejects every malformed or out-of-scope provider candidate at the gateway boundary", () => {
    const invalidCandidates: Array<[string, unknown]> = [
      ["null", null],
      ["missing fields", {}],
      ["provider-authored tenant", candidateFor(context, { tenant_id: "tenant_other" })],
      ["provider-authored run", candidateFor(context, { run_id: "run_other" })],
      ["provider-authored role", candidateFor(context, { role_key: "CFO" })],
      ["unbound evidence", candidateFor(context, { evidence_refs: ["event_other"] })],
      ["malformed scope", candidateFor(context, { tenant_id: "tenant bad" })],
      ["reserved scope", candidateFor(context, { tenant_id: "latest" })],
      ["wildcard evidence", candidateFor(context, { evidence_refs: ["*"] })],
      ["extra private payload", candidateFor(context, { private_payload: { secret: true } })],
      ["truth field", candidateFor(context, { state_true: { score: 100 } })],
      ["blank advisory", candidateFor(context, { advisory_text: "   " })]
    ];

    for (const [label, candidate] of invalidCandidates) {
      const provider: AgentProviderPort = {
        model: "invalid-candidate-model",
        provider: "invalid-candidate-provider",
        generate: () => candidate
      };
      const outcome = governedGateway(provider).generate({
        context,
        role_key: "CEO",
        surface: "student_role"
      });
      expect(outcome.status, label).toBe("rejected");
      expect(outcome, label).toMatchObject({ code: "AGENT_OUTPUT_REJECTED" });
      expect(outcome, label).not.toHaveProperty("coach_output");
      expect(
        isW020ModelCallLog(outcome.model_call_log, {
          status: "rejected",
          tenant_id: context.tenant_id
        }),
        label
      ).toBe(true);
      expect(JSON.stringify(outcome), label).not.toContain("private_payload");
      expect(JSON.stringify(outcome), label).not.toContain("state_true");
    }
  });

  it("fails closed for every forbidden or out-of-scope CoachOutput shape", () => {
    const invalidCases: Array<[string, Record<string, unknown>]> = [
      [
        "missing field",
        (() => {
          const value = outputFor();
          delete value.coach_output_id;
          return value;
        })()
      ],
      ["extra field", outputFor(context, { unexpected_field: "reject" })],
      ["advisory_only false", outputFor(context, { advisory_only: false })],
      ["wrong tenant", outputFor(context, { tenant_id: "tenant_other" })],
      ["wrong run", outputFor(context, { run_id: "run_other" })],
      ["wrong round", outputFor(context, { round_id: "round_other" })],
      ["wrong team", outputFor(context, { team_id: "team_other" })],
      ["wrong role", outputFor(context, { role_key: "CFO" })],
      ["forbidden output type", outputFor(context, { output_type: "learning_note" })],
      ["blank text", outputFor(context, { advisory_text: " \t" })],
      ["malformed evidence reference", outputFor(context, { evidence_refs: ["event 001"] })],
      ["wildcard evidence reference", outputFor(context, { evidence_refs: ["*"] })],
      ["unbound evidence reference", outputFor(context, { evidence_refs: ["event_other"] })],
      ["reserved identity", outputFor(context, { coach_output_id: "LATEST" })],
      ["unresolved log identity", outputFor(context, { model_call_log_id: "unresolved" })],
      ["raw prompt", outputFor(context, { raw_prompt: "do not retain" })],
      ["private payload", outputFor(context, { private_payload: { secret: true } })],
      ["formal truth field", outputFor(context, { formal_truth_write: false })],
      ["state truth field", outputFor(context, { state_true: { score: 100 } })],
      ["settlement field", outputFor(context, { SettlementResult: {} })]
    ];

    for (const [label, value] of invalidCases) {
      expect(isW020CoachOutput(value, context), label).toBe(false);
    }
    expect(isW020CoachOutput(outputFor(), context)).toBe(true);
  });

  it("rejects reserved and wildcard identifiers across public W020 values", () => {
    expect(
      isW020AdvisoryRequest({
        discriminator: "w020_advisory_request",
        idempotency_key: "idem-001",
        role_key: "CEO",
        round_id: "round-001",
        run_id: "latest",
        surface: "student_role",
        team_id: "team-001"
      })
    ).toBe(false);
    expect(isW020AdvisoryContext({ ...context, tenant_id: "DEFAULT" })).toBe(false);
    expect(isW020CoachOutput(outputFor(context, { coach_output_id: "foo*" }), context)).toBe(false);

    const success = requireSuccess(
      governedGateway().generate({ context, role_key: "CEO", surface: "student_role" })
    );
    expect(isW020ModelCallLog({ ...success.model_call_log, model_call_log_id: "unresolved" })).toBe(
      false
    );
  });

  it("validates Student and Teacher advisory requests as closed discriminated inputs", () => {
    const studentRequest = {
      discriminator: "w020_advisory_request",
      idempotency_key: "idem-student-001",
      role_key: "CEO",
      round_id: "round-001",
      run_id: "run-001",
      surface: "student_role",
      team_id: "team-001"
    };
    const teacherRequest = {
      ...studentRequest,
      activity_id: "activity-001",
      idempotency_key: "idem-teacher-001",
      surface: "teacher_debrief"
    };
    expect(isW020AdvisoryRequest(studentRequest)).toBe(true);
    expect(isW020AdvisoryRequest(teacherRequest)).toBe(true);

    const invalidRequests: Array<[string, Record<string, unknown>]> = [
      ["student activity", { ...studentRequest, activity_id: "activity-001" }],
      [
        "teacher missing activity",
        (() => {
          const value = { ...teacherRequest } as Record<string, unknown>;
          delete value.activity_id;
          return value;
        })()
      ],
      [
        "missing role",
        (() => {
          const value = { ...studentRequest } as Record<string, unknown>;
          delete value.role_key;
          return value;
        })()
      ],
      ["unknown role", { ...studentRequest, role_key: "OBSERVER" }],
      ["reserved activity", { ...teacherRequest, activity_id: "LATEST" }],
      ["reserved run", { ...studentRequest, run_id: "unresolved" }],
      ["unknown discriminator", { ...studentRequest, discriminator: "advisor_request" }],
      ["unexpected field", { ...studentRequest, raw_prompt: "private" }]
    ];
    for (const [label, value] of invalidRequests) {
      expect(isW020AdvisoryRequest(value), label).toBe(false);
    }
  });

  it("uses role-specific deterministic advice for at least CEO and CFO", () => {
    const provider = deterministicProvider();
    const gateway = governedGateway(provider);

    const ceoContext = { ...context, role_key: "CEO" as const };
    const cfoContext = { ...context, role_key: "CFO" as const };
    const ceo = requireSuccess(
      gateway.generate({ context: ceoContext, role_key: "CEO", surface: "student_role" })
    );
    const cfo = requireSuccess(
      gateway.generate({ context: cfoContext, role_key: "CFO", surface: "student_role" })
    );

    expect(ceo.coach_output.advisory_text).toContain("Role CEO");
    expect(cfo.coach_output.advisory_text).toContain("Role CFO");
    expect(ceo.coach_output.advisory_text).not.toBe(cfo.coach_output.advisory_text);
  });

  it("rejects provider attempts to author the authoritative ModelCallLog", () => {
    const provider: AgentProviderPort = {
      model: "trusted-model",
      provider: "trusted-provider",
      generate: () => ({
        ...candidateFor(),
        model_call_log: {
          advisory_only: false,
          input_hash: "provider-input-hash",
          model: "provider-forged-model",
          model_call_log_id: "provider-log-id",
          output_hash: "provider-output-hash",
          provider: "provider-forged-provider",
          status: "failed",
          tenant_id: "tenant-forged"
        }
      })
    };
    const gateway = governedGateway(provider);

    const outcome = gateway.generate({ context, role_key: "CEO", surface: "student_role" });
    expect(outcome.status).toBe("rejected");
    expect(outcome).not.toHaveProperty("coach_output");
    expect(outcome.model_call_log).toMatchObject({
      advisory_only: true,
      model: "trusted-model",
      provider: "trusted-provider",
      status: "rejected",
      tenant_id: context.tenant_id
    });
    expect(outcome.model_call_log).not.toMatchObject({
      model: "provider-forged-model",
      provider: "provider-forged-provider",
      status: "failed",
      tenant_id: "tenant-forged"
    });
    expect(outcome.model_call_log.input_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(outcome.model_call_log.output_hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
