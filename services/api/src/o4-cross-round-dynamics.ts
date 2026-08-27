import {
  buildO4CrossRoundDynamicsCandidate,
  O4CrossRoundDynamicsError as CoreO4CrossRoundDynamicsError
} from "@simwar/simulation-core";
import {
  projectO4StudentState,
  type CurrentUser,
  type O4CrossRoundDynamicsResponse,
  type O4CrossRoundDynamicsSurface,
  type W4StoreState
} from "@simwar/shared-contracts";

const KNOWN_LIMITS = [
  "O4 is a deterministic read-only differential candidate over existing W4 enterprise state records.",
  "The candidate does not write SettlementResult, REALIZED, canonical Decision, official EnterpriseState, or replay truth.",
  "JSON_INTERNAL_ONLY is the active runtime authority; PostgreSQL/RLS is not activated.",
  "Student output is limited to the authenticated team and omits peer paths, raw metrics, exact state references, outcomes, and decision provenance.",
  "The differential is bounded to the selected three-round horizon and does not claim a full economic model or calibrated Shanghai behavior.",
  "Human Validation, Pilot, Production, and automatic successor are outside O4."
] as const;

export class O4CrossRoundDynamicsServiceError extends Error {
  constructor(
    readonly code:
      | "O4_CONTEXT_INVALID"
      | "O4_SCOPE_VIOLATION"
      | "O4_RUN_NOT_FOUND"
      | "O4_COURSE_SCOPE_CONFLICT"
      | "O4_INSUFFICIENT_HISTORY"
      | "O4_DUPLICATE_STATE"
      | "O4_OUTPUT_INVALID"
  ) {
    super(code);
    this.name = "O4CrossRoundDynamicsServiceError";
  }
}

export interface O4CrossRoundDynamicsDependencies {
  readonly getRun: (tenantId: string, runId: string) => Promise<{ course_id: string } | null>;
  readonly readW4State: () => W4StoreState;
}

export interface O4CrossRoundDynamicsRequest {
  readonly actor: Pick<CurrentUser, "tenant_id" | "user_id" | "roles" | "team_id">;
  readonly surface: O4CrossRoundDynamicsSurface;
  readonly course_id: string;
  readonly run_id: string;
  readonly target_round_no?: number;
}

function exactIdentity(value: string): boolean {
  return (
    value.trim() === value &&
    /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(value) &&
    !/(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i.test(value)
  );
}

function mapCoreError(error: unknown): never {
  if (error instanceof CoreO4CrossRoundDynamicsError) {
    if (error.code === "O4_INSUFFICIENT_HISTORY") {
      throw new O4CrossRoundDynamicsServiceError("O4_INSUFFICIENT_HISTORY");
    }
    if (error.code === "O4_DUPLICATE_STATE") {
      throw new O4CrossRoundDynamicsServiceError("O4_DUPLICATE_STATE");
    }
  }
  throw new O4CrossRoundDynamicsServiceError("O4_OUTPUT_INVALID");
}

export class O4CrossRoundDynamicsService {
  constructor(private readonly dependencies: O4CrossRoundDynamicsDependencies) {}

  async getCandidate(
    input: O4CrossRoundDynamicsRequest
  ): Promise<O4CrossRoundDynamicsResponse> {
    if (
      !exactIdentity(input.actor.tenant_id) ||
      !exactIdentity(input.course_id) ||
      !exactIdentity(input.run_id) ||
      (input.target_round_no !== undefined &&
        (!Number.isInteger(input.target_round_no) || input.target_round_no < 3))
    ) {
      throw new O4CrossRoundDynamicsServiceError("O4_CONTEXT_INVALID");
    }
    if (input.surface === "student" && !input.actor.team_id) {
      throw new O4CrossRoundDynamicsServiceError("O4_SCOPE_VIOLATION");
    }
    const run = await this.dependencies.getRun(input.actor.tenant_id, input.run_id);
    if (!run) throw new O4CrossRoundDynamicsServiceError("O4_RUN_NOT_FOUND");
    if (run.course_id !== input.course_id) {
      throw new O4CrossRoundDynamicsServiceError("O4_COURSE_SCOPE_CONFLICT");
    }

    const snapshot = this.dependencies.readW4State();
    let candidate;
    try {
      candidate = buildO4CrossRoundDynamicsCandidate({
        tenant_id: input.actor.tenant_id,
        course_id: input.course_id,
        run_id: input.run_id,
        ...(input.target_round_no !== undefined
          ? { target_round_no: input.target_round_no }
          : {}),
        states: snapshot.states,
        outcomes: snapshot.outcomes,
        decisions: snapshot.decisions
      });
    } catch (error) {
      return mapCoreError(error);
    }

    const scopedStateCount = snapshot.states.filter(
      (state) =>
        state.tenant_id === input.actor.tenant_id &&
        state.course_id === input.course_id &&
        state.run_id === input.run_id
    ).length;
    const scopedOutcomeCount = snapshot.outcomes.filter(
      (outcome) =>
        outcome.tenant_id === input.actor.tenant_id &&
        outcome.course_id === input.course_id &&
        outcome.run_id === input.run_id
    ).length;
    const scopedDecisionCount = snapshot.decisions.filter(
      (decision) =>
        decision.tenant_id === input.actor.tenant_id &&
        decision.course_id === input.course_id &&
        decision.run_id === input.run_id
    ).length;
    const response: O4CrossRoundDynamicsResponse = {
      schema_version: "o4-cross-round-dynamics.v1",
      runtime_authority: "JSON_INTERNAL_ONLY",
      visibility:
        input.surface === "student"
          ? "student_safe"
          : input.surface === "admin"
            ? "admin_safe"
            : "teacher_safe",
      exact_scope: {
        tenant_id: input.actor.tenant_id,
        course_id: input.course_id,
        run_id: input.run_id,
        target_round_no: candidate.team_paths[0]?.rounds.at(-1)?.round_no ?? 0
      },
      candidate,
      provenance: {
        source: "W4_ENTERPRISE_STATE_READ_MODEL",
        state_ref_count: scopedStateCount,
        official_outcome_count: scopedOutcomeCount,
        source_decision_count: scopedDecisionCount,
        replay_writes_formal_results: false
      },
      authority: {
        candidate_writer: "SIMULATION_CORE_READ_ONLY",
        official_truth_write: false,
        settlement_write: false,
        replay_write: false,
        provider_calls: 0
      },
      known_limits: [...KNOWN_LIMITS]
    };
    if (input.surface !== "student") return response;
    const teamId = input.actor.team_id;
    if (!teamId || !candidate.team_paths.some((path) => path.team_id === teamId)) {
      throw new O4CrossRoundDynamicsServiceError("O4_SCOPE_VIOLATION");
    }
    return projectO4StudentState(response, teamId);
  }
}
