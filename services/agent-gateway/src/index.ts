import { createHash } from "node:crypto";
import type {
  CoachOutput,
  ModelCallLog,
  W020AdvisoryContext,
  W020AdvisorySurface,
  W020RoleKey
} from "@simwar/shared-contracts";

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
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  )
    return JSON.stringify(value);
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
  const studentSurfaces = new Set(["student_role", "student_coach"]);
  const teacherSurfaces = new Set([
    "teacher_copilot",
    "teacher_debrief",
    "rubric_assistant",
    "competitive_challenge",
    "stakeholder_challenge"
  ]);
  if (input.context.actor_role === "student" && !studentSurfaces.has(input.surface))
    throw new AgentGatewayError("AGENT_POLICY_DENIED");
  if (input.context.actor_role !== "student" && !teacherSurfaces.has(input.surface))
    throw new AgentGatewayError("AGENT_POLICY_DENIED");
  if (input.context.context_digest.length !== 64 || input.context.source_event_ids.length > 50)
    throw new AgentGatewayError("AGENT_CONTEXT_INVALID");
  if (input.context.advisory_scopes.length === 0)
    throw new AgentGatewayError("AGENT_POLICY_DENIED");
  if (
    input.surface === "student_role" &&
    (!input.role_key || input.context.role_key !== input.role_key)
  )
    throw new AgentGatewayError("AGENT_POLICY_DENIED");
}

export function createDeterministicMockGateway(): {
  generate(input: AgentGatewayInput): AgentGatewayResult;
} {
  return {
    generate(input) {
      assertPolicy(input);
      const safeInput = {
        context: input.context,
        role_key: input.role_key ?? null,
        surface: input.surface
      };
      const inputHash = digest(safeInput);
      const outputText =
        input.context.source_event_ids.length === 0
          ? "No source evidence is available; the assistant abstains and asks the human reviewer to inspect the exact context."
          : input.surface === "student_role" || input.surface === "student_coach"
            ? `Role ${input.role_key ?? "member"} coach: review the cited role evidence and prepare a reversible next decision for human review.`
            : input.surface === "teacher_copilot"
              ? "Teacher Copilot: compare the cited workflow evidence with the course objective and document a reversible follow-up question."
              : input.surface === "rubric_assistant"
                ? "Rubric Assistant: use the cited workflow evidence to draft a discussion point; the teacher remains the final evaluator."
                : input.surface === "competitive_challenge"
                  ? "Competitive Challenge: inspect the cited evidence, test one bounded hypothesis, and keep the conclusion advisory-only."
                  : input.surface === "stakeholder_challenge"
                    ? "Stakeholder Challenge: inspect the cited evidence, name one stakeholder trade-off, and keep the conclusion advisory-only."
                    : "Teacher debrief advisory: compare the visible workflow evidence with the course objective and document a follow-up question.";
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
          evidence_refs: input.context.source_event_ids,
          model_call_log_id: modelCallLogId,
          output_type: "advisory",
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
          purpose:
            input.surface === "student_role" ||
            input.surface === "student_coach" ||
            input.surface === "teacher_copilot"
              ? "coach_advice"
              : input.surface === "teacher_debrief"
                ? "debrief"
                : "learning_support",
          status: "succeeded",
          tenant_id: input.context.tenant_id
        }
      };
    }
  };
}
