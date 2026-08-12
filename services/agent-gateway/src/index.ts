import { createHash } from "node:crypto";
import {
  isW020AdvisoryContext,
  isW020CoachOutput,
  type ModelCallLog,
  type W020AdvisoryContext,
  type W020CoachOutput,
  type W020AdvisorySurface,
  type W020RoleKey
} from "@simwar/shared-contracts";

export interface AgentGatewayInput {
  context: W020AdvisoryContext;
  surface: W020AdvisorySurface;
  role_key?: W020RoleKey;
}

export interface AgentGatewayResult {
  coach_output: W020CoachOutput;
  model_call_log: ModelCallLog;
}

export interface AgentProviderPort {
  provider: string;
  model: string;
  generate(input: AgentGatewayInput): unknown;
}

export interface W020ProviderCoachOutputCandidate {
  advisory_text: string;
  evidence_refs: string[];
}

export type AgentGatewayOutcome =
  | {
      status: "succeeded";
      coach_output: W020CoachOutput;
      model_call_log: ModelCallLog;
    }
  | {
      status: "failed";
      code: "AGENT_PROVIDER_FAILED";
      model_call_log: ModelCallLog;
    }
  | {
      status: "rejected";
      code: "AGENT_OUTPUT_REJECTED";
      model_call_log: ModelCallLog;
    };

export interface GovernedAgentGateway {
  generate(input: AgentGatewayInput): AgentGatewayOutcome;
}

interface AgentGatewayOptions {
  now?: () => Date;
}

export class AgentGatewayError extends Error {
  constructor(readonly code: "AGENT_POLICY_DENIED" | "AGENT_CONTEXT_INVALID") {
    super(code);
    this.name = "AgentGatewayError";
  }
}

function canonicalize(value: unknown): string {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`)
      .join(",")}}`;
  }
  throw new AgentGatewayError("AGENT_CONTEXT_INVALID");
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

function assertPolicy(input: AgentGatewayInput): void {
  if (!isW020AdvisoryContext(input.context)) {
    throw new AgentGatewayError("AGENT_CONTEXT_INVALID");
  }
  if (input.context.actor_role === "student" && input.surface !== "student_role") {
    throw new AgentGatewayError("AGENT_POLICY_DENIED");
  }
  if (input.context.actor_role !== "student" && input.surface !== "teacher_debrief") {
    throw new AgentGatewayError("AGENT_POLICY_DENIED");
  }
  if (input.context.source_event_ids.length > 50) {
    throw new AgentGatewayError("AGENT_CONTEXT_INVALID");
  }
  if (input.context.advisory_scopes.length === 0) {
    throw new AgentGatewayError("AGENT_POLICY_DENIED");
  }
  if (
    input.surface === "student_role" &&
    (!input.role_key || input.context.role_key !== input.role_key)
  ) {
    throw new AgentGatewayError("AGENT_POLICY_DENIED");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isProviderCandidate(
  value: unknown,
  input: AgentGatewayInput
): value is W020ProviderCoachOutputCandidate {
  if (!isRecord(value)) return false;
  const required = ["advisory_text", "evidence_refs"];
  const allowed = new Set(required);
  const keys = Object.keys(value);
  if (
    keys.length < required.length ||
    !required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) ||
    !keys.every((key) => allowed.has(key))
  ) {
    return false;
  }
  if (typeof value.advisory_text !== "string" || value.advisory_text.trim().length === 0) {
    return false;
  }
  if (
    !Array.isArray(value.evidence_refs) ||
    value.evidence_refs.length !== input.context.source_event_ids.length ||
    !value.evidence_refs.every((item, index) => item === input.context.source_event_ids[index])
  ) {
    return false;
  }
  return true;
}

function buildModelCallLog(params: {
  provider: AgentProviderPort;
  input: AgentGatewayInput;
  inputHash: string;
  outputHash: string;
  status: ModelCallLog["status"];
  modelCallLogId: string;
  createdAt: string;
  completionTokens?: number;
}): ModelCallLog {
  return {
    advisory_only: true,
    completion_tokens: params.completionTokens ?? 0,
    cost_usd: 0,
    created_at: params.createdAt,
    input_hash: params.inputHash,
    latency_ms: 0,
    model: params.provider.model,
    model_call_log_id: params.modelCallLogId,
    output_hash: params.outputHash,
    prompt_tokens: 0,
    provider: params.provider.provider,
    purpose: params.input.surface === "student_role" ? "coach_advice" : "debrief",
    status: params.status,
    tenant_id: params.input.context.tenant_id
  };
}

function assertProviderMetadata(provider: AgentProviderPort): void {
  if (
    !provider ||
    typeof provider.generate !== "function" ||
    typeof provider.provider !== "string" ||
    provider.provider.trim().length === 0 ||
    typeof provider.model !== "string" ||
    provider.model.trim().length === 0
  ) {
    throw new AgentGatewayError("AGENT_CONTEXT_INVALID");
  }
}

export function createDeterministicMockProvider(): AgentProviderPort {
  return {
    model: "simwar-w020-deterministic-mock-v1",
    provider: "deterministic-mock",
    generate(input) {
      const outputText =
        input.surface === "student_role"
          ? `Role ${input.role_key ?? "member"} advisory: review the visible role scope and prepare a reversible next decision.`
          : "Teacher debrief advisory: compare the visible workflow evidence with the course objective and document a follow-up question.";
      return {
        advisory_text: outputText,
        evidence_refs: [...input.context.source_event_ids]
      } satisfies W020ProviderCoachOutputCandidate;
    }
  };
}

export function createGovernedAgentGateway(
  provider: AgentProviderPort = createDeterministicMockProvider(),
  options: AgentGatewayOptions = {}
): GovernedAgentGateway {
  assertProviderMetadata(provider);
  const now = options.now ?? (() => new Date());
  return {
    generate(input) {
      assertPolicy(input);
      const safeInput = {
        context: input.context,
        role_key: input.role_key ?? null,
        surface: input.surface
      };
      const inputHash = digest(safeInput);
      const modelCallLogId = `model_call_${digest({
        inputHash,
        model: provider.model,
        provider: provider.provider
      }).slice(0, 24)}`;
      const createdAt = now().toISOString();
      let providerOutput: unknown;

      try {
        providerOutput = provider.generate(input);
      } catch {
        const outputHash = digest({ inputHash, status: "failed" });
        return {
          code: "AGENT_PROVIDER_FAILED",
          model_call_log: buildModelCallLog({
            createdAt,
            input,
            inputHash,
            modelCallLogId,
            outputHash,
            provider,
            status: "failed"
          }),
          status: "failed"
        };
      }

      if (!isProviderCandidate(providerOutput, input)) {
        const outputHash = digest({ inputHash, status: "rejected" });
        return {
          code: "AGENT_OUTPUT_REJECTED",
          model_call_log: buildModelCallLog({
            createdAt,
            input,
            inputHash,
            modelCallLogId,
            outputHash,
            provider,
            status: "rejected"
          }),
          status: "rejected"
        };
      }

      const outputHash = digest(providerOutput);
      const coachOutput: W020CoachOutput = {
        advisory_only: true,
        advisory_text: providerOutput.advisory_text,
        coach_output_id: `coach_output_${outputHash.slice(0, 24)}`,
        created_at: createdAt,
        evidence_refs: [...providerOutput.evidence_refs],
        model_call_log_id: modelCallLogId,
        output_type: "advisory",
        round_id: input.context.round_id,
        run_id: input.context.run_id,
        role_key: input.context.role_key,
        team_id: input.context.team_id,
        tenant_id: input.context.tenant_id
      };
      if (!isW020CoachOutput(coachOutput, input.context)) {
        return {
          code: "AGENT_OUTPUT_REJECTED",
          model_call_log: buildModelCallLog({
            createdAt,
            input,
            inputHash,
            modelCallLogId,
            outputHash,
            provider,
            status: "rejected"
          }),
          status: "rejected"
        };
      }

      return {
        coach_output: coachOutput,
        model_call_log: buildModelCallLog({
          completionTokens: coachOutput.advisory_text.length,
          createdAt,
          input,
          inputHash,
          modelCallLogId,
          outputHash,
          provider,
          status: "succeeded"
        }),
        status: "succeeded"
      };
    }
  };
}

export function createDeterministicMockGateway(): {
  generate(input: AgentGatewayInput): AgentGatewayResult;
} {
  const gateway = createGovernedAgentGateway(createDeterministicMockProvider(), {
    now: () => new Date(0)
  });
  return {
    generate(input) {
      const outcome = gateway.generate(input);
      if (outcome.status !== "succeeded") {
        throw new AgentGatewayError("AGENT_CONTEXT_INVALID");
      }
      return outcome;
    }
  };
}
