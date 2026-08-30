import { createHash } from "node:crypto";
import type {
  CoachOutput,
  ModelCallLog,
  W020AdvisoryContext,
  W020AdvisorySurface,
  W020RoleKey
} from "@simwar/shared-contracts";
import {
  qualifyWorkflowEvidence,
  type WorkflowEvidenceResult
} from "./workflow-evidence-policy.js";
import { buildStudentDecisionChallenge } from "./student-decision-challenge.js";

export interface AgentGatewayInput {
  context: W020AdvisoryContext;
  surface: W020AdvisorySurface;
  role_key?: W020RoleKey;
}

export interface AgentGatewayResult {
  coach_output: CoachOutput;
  model_call_log: ModelCallLog;
}

export class AgentGatewayError extends Error {
  constructor(readonly code: "AGENT_POLICY_DENIED" | "AGENT_CONTEXT_INVALID") {
    super(code);
    this.name = "AgentGatewayError";
  }
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`).join(",")}}`;
  }
  throw new AgentGatewayError("AGENT_CONTEXT_INVALID");
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

function assertPolicy(input: AgentGatewayInput): void {
  const candidate = input as unknown as {
    context?: Record<string, unknown>;
    surface?: unknown;
  };
  if (!candidate.context || typeof candidate.context !== "object") {
    throw new AgentGatewayError("AGENT_CONTEXT_INVALID");
  }
  if (candidate.surface !== "student_role" && candidate.surface !== "teacher_debrief") {
    throw new AgentGatewayError("AGENT_CONTEXT_INVALID");
  }
  if (
    !["student", "teacher", "admin"].includes(String(candidate.context.actor_role)) ||
    typeof candidate.context.context_digest !== "string" ||
    !/^[a-f0-9]{64}$/i.test(candidate.context.context_digest) ||
    !Array.isArray(candidate.context.source_event_ids) ||
    !Array.isArray(candidate.context.source_event_types) ||
    !Array.isArray(candidate.context.advisory_scopes)
  ) {
    throw new AgentGatewayError("AGENT_CONTEXT_INVALID");
  }
  if (input.context.actor_role === "student" && input.surface !== "student_role") throw new AgentGatewayError("AGENT_POLICY_DENIED");
  if (input.context.actor_role !== "student" && input.surface !== "teacher_debrief") throw new AgentGatewayError("AGENT_POLICY_DENIED");
  if (input.context.source_event_ids.length > 50) throw new AgentGatewayError("AGENT_CONTEXT_INVALID");
  if (input.context.advisory_scopes.length === 0) throw new AgentGatewayError("AGENT_POLICY_DENIED");
  if (input.context.advisory_scopes.some((scope) => typeof scope !== "string" || scope.trim().length === 0)) {
    throw new AgentGatewayError("AGENT_CONTEXT_INVALID");
  }
  if (input.surface === "student_role" && (!input.role_key || input.context.role_key !== input.role_key)) throw new AgentGatewayError("AGENT_POLICY_DENIED");
}

export function createDeterministicMockGateway(): { generate(input: AgentGatewayInput): AgentGatewayResult } {
  return {
    generate(input) {
      assertPolicy(input);
      let evidence: WorkflowEvidenceResult;
      try {
        evidence = qualifyWorkflowEvidence(input.context);
      } catch {
        throw new AgentGatewayError("AGENT_CONTEXT_INVALID");
      }
      const safeInput = {
        context: input.context,
        role_key: input.role_key ?? null,
        surface: input.surface
      };
      const inputHash = digest(safeInput);
      const generatedAdvice = input.surface === "student_role"
        ? buildStudentDecisionChallenge(input.context, evidence)
        : {
            advisory_text: evidence.status === "abstained"
              ? "No qualified workflow evidence is available; advisory generation is withheld until a valid workflow sequence is visible."
              : `Workflow evidence qualified at ${evidence.current_stage.toLowerCase().replaceAll("_", " ")}; compare the visible workflow evidence and document a follow-up question without inferring official outcomes.`,
            output_type: "advisory" as const
          };
      const outputText = generatedAdvice.advisory_text;
      const outputHash = digest({ inputHash, outputText });
      const modelCallLogId = `model_call_${inputHash.slice(0, 24)}`;
      const coachOutputId = `coach_output_${outputHash.slice(0, 24)}`;
      const now = new Date(0).toISOString();
      return {
        coach_output: {
          advisory_only: true,
          advisory_text: outputText,
          coach_output_id: coachOutputId,
          created_at: now,
          evidence_refs: evidence.qualified_event_ids,
          model_call_log_id: modelCallLogId,
          output_type: generatedAdvice.output_type,
          round_id: input.context.round_id,
          run_id: input.context.run_id,
          ...(input.context.role_key ? { role_key: input.context.role_key } : {}),
          team_id: input.context.team_id,
          tenant_id: input.context.tenant_id
        },
        model_call_log: {
          advisory_only: true,
          completion_tokens: outputText.length,
          cost_usd: 0,
          created_at: now,
          input_hash: inputHash,
          latency_ms: 0,
          model: "simwar-w020-deterministic-mock-v1",
          model_call_log_id: modelCallLogId,
          output_hash: outputHash,
          prompt_tokens: 0,
          provider: "deterministic-mock",
          purpose: input.surface === "student_role" ? "coach_advice" : "debrief",
          status: "succeeded",
          tenant_id: input.context.tenant_id
        }
      };
    }
  };
}
