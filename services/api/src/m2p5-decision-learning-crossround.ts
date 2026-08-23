import type {
  M2P5CrossRoundProjection,
  M2P5DecisionLearningContext,
  M2P5DecisionLearningResponse,
  M2P5NextRoundProjection,
  M2P5ProjectContextProjection,
  M2P5DecisionLearningSurface,
  Round,
  StudentLearningReport,
  W3OfficialConsequenceContext,
  W3OfficialConsequenceResponse,
  W4ProjectionBase,
  W4StateRef
} from "@simwar/shared-contracts";
import { type W3Actor } from "./w3-official-consequence-learning.js";

const KNOWN_LIMITS = [
  "M2-P5 is a read-only composition of existing W3, D3, D4, W4, Project, and Round authorities.",
  "Learning, counterfactual, and project projections never write canonical Decision, Settlement, EnterpriseState, or official Round truth.",
  "Counterfactuals remain non-official, exact-context, one-change evidence only.",
  "JSON_INTERNAL_ONLY is the active runtime authority; durable recovery and Human Validation are not proven.",
  "PostgreSQL, Pilot, Production, provider/model activation, and W6 are outside this mission."
] as const;

export class M2P5DecisionLearningError extends Error {
  constructor(
    readonly code:
      | "M2P5_CONTEXT_INVALID"
      | "M2P5_SCOPE_VIOLATION"
      | "M2P5_ROUND_NOT_FOUND"
      | "M2P5_OFFICIAL_RESULT_NOT_PUBLISHED"
      | "M2P5_OUTPUT_INVALID"
  ) {
    super(code);
    this.name = "M2P5DecisionLearningError";
  }
}

export type M2P5DecisionLearningActor = W3Actor;

export interface M2P5ProjectContextInput {
  readonly actor: M2P5DecisionLearningActor;
  readonly context: M2P5DecisionLearningContext;
  readonly surface: M2P5DecisionLearningSurface;
}

export interface M2P5W4ProjectionInput {
  readonly actor: M2P5DecisionLearningActor;
  readonly context: M2P5DecisionLearningContext;
}

export interface M2P5NextRoundOpeningInput extends M2P5W4ProjectionInput {
  readonly next_round: Round;
  readonly opening_state_ref: W4StateRef;
}

export interface M2P5DecisionLearningDependencies {
  readonly getExactRound: (
    tenantId: string,
    runId: string,
    roundNo: number
  ) => Promise<Round | null>;
  readonly getNextRound: (
    tenantId: string,
    runId: string,
    roundNo: number
  ) => Promise<Round | null>;
  readonly getOfficialConsequence: (
    actor: M2P5DecisionLearningActor,
    context: W3OfficialConsequenceContext,
    surface: M2P5DecisionLearningSurface
  ) => Promise<W3OfficialConsequenceResponse>;
  readonly getLearningReport: (
    actor: M2P5DecisionLearningActor,
    context: M2P5DecisionLearningContext,
    surface: M2P5DecisionLearningSurface
  ) => Promise<StudentLearningReport | undefined>;
  readonly getProjectContext: (
    input: M2P5ProjectContextInput
  ) => Promise<M2P5ProjectContextProjection>;
  readonly getW4Projection: (
    input: M2P5W4ProjectionInput
  ) => Promise<Pick<W4ProjectionBase, "opening_state_ref" | "closing_state_ref">>;
  readonly validateNextRoundOpening: (
    input: M2P5NextRoundOpeningInput
  ) => Promise<{ state_ref: W4StateRef; source_closing_state_ref: W4StateRef }>;
}

function identity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(value) &&
    !/(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i.test(value)
  );
}

function assertContext(context: M2P5DecisionLearningContext): void {
  if (
    !identity(context.activity_id) ||
    !identity(context.course_id) ||
    !identity(context.role_key) ||
    !identity(context.round_id) ||
    !Number.isInteger(context.round_no) ||
    context.round_no < 1 ||
    !identity(context.run_id) ||
    !identity(context.team_id) ||
    !identity(context.tenant_id)
  ) {
    throw new M2P5DecisionLearningError("M2P5_CONTEXT_INVALID");
  }
}

function sameRef(left: W4StateRef, right: W4StateRef): boolean {
  return (
    left.tenant_id === right.tenant_id &&
    left.course_id === right.course_id &&
    left.run_id === right.run_id &&
    left.team_id === right.team_id &&
    left.round_id === right.round_id &&
    left.enterprise_state_id === right.enterprise_state_id &&
    left.version === right.version &&
    left.state_digest === right.state_digest
  );
}

function learningProjection(
  record: W3OfficialConsequenceResponse["record"],
  report: StudentLearningReport | undefined
): M2P5DecisionLearningResponse["learning"] {
  const reflectionStatus = record.reflection ? "SUBMITTED" : "MISSING";
  const reportStatus = report ? "CONFIRMED" : "MISSING";
  const gate =
    reflectionStatus === "SUBMITTED" &&
    record.learning.teacher_confirmation_status === "CONFIRMED" &&
    record.learning.evidence_selection_status === "SELECTED" &&
    reportStatus === "CONFIRMED" &&
    record.learning.next_round_hypothesis_status === "READY"
      ? "READY"
      : "BLOCKED";
  return {
    gate,
    reflection_status: reflectionStatus,
    teacher_confirmation_status: record.learning.teacher_confirmation_status,
    evidence_selection_status: record.learning.evidence_selection_status,
    student_learning_report_status: reportStatus,
    ...(record.learning.teacher_confirmation_ref
      ? { teacher_confirmation_ref: record.learning.teacher_confirmation_ref }
      : {}),
    ...(record.learning.student_learning_report_ref
      ? { student_learning_report_ref: record.learning.student_learning_report_ref }
      : {}),
    next_round_hypothesis_status: record.learning.next_round_hypothesis_status
  };
}

function reportIsExactForRound(
  report: StudentLearningReport,
  context: M2P5DecisionLearningContext,
  expectedRef: M2P5DecisionLearningResponse["official_consequence"]["record"]["learning"]["student_learning_report_ref"],
  expectedConfirmationRef: M2P5DecisionLearningResponse["official_consequence"]["record"]["learning"]["teacher_confirmation_ref"]
): boolean {
  const reportContext = report.context as StudentLearningReport["context"] & {
    round_id?: string;
    round_no?: number;
  };
  return (
    reportContext.course_id === context.course_id &&
    reportContext.run_id === context.run_id &&
    reportContext.team_id === context.team_id &&
    reportContext.role_key === context.role_key &&
    reportContext.round_id === context.round_id &&
    reportContext.round_no === context.round_no &&
    (!expectedRef ||
      (report.report_ref.resource_id === expectedRef.resource_id &&
        report.report_ref.version === expectedRef.version &&
        report.report_ref.content_digest === expectedRef.content_digest &&
        report.report_ref.tenant_id === expectedRef.tenant_id)) &&
    (!expectedConfirmationRef ||
      (report.teacher_confirmation_ref.resource_id === expectedConfirmationRef.resource_id &&
        report.teacher_confirmation_ref.version === expectedConfirmationRef.version &&
        report.teacher_confirmation_ref.content_digest === expectedConfirmationRef.content_digest &&
        report.teacher_confirmation_ref.tenant_id === expectedConfirmationRef.tenant_id))
  );
}

function nextRoundProjection(
  nextRound: Round,
  opening: { state_ref: W4StateRef; source_closing_state_ref: W4StateRef }
): M2P5NextRoundProjection {
  return {
    round_id: nextRound.round_id,
    round_no: nextRound.round_no,
    status: nextRound.status,
    opening_state_ref: structuredClone(opening.state_ref),
    source_closing_state_ref: structuredClone(opening.source_closing_state_ref)
  };
}

function crossRoundProjection(input: {
  learningGate: "BLOCKED" | "READY";
  projectContext: M2P5ProjectContextProjection;
  predecessorClosing: W4StateRef | null;
  nextRound: Round | null;
  opening?: { state_ref: W4StateRef; source_closing_state_ref: W4StateRef };
  openingError?: unknown;
}): M2P5CrossRoundProjection {
  const blockers: string[] = [];
  if (input.learningGate !== "READY") blockers.push("LEARNING_PREREQUISITES_REQUIRED");
  if (input.projectContext.status !== "RESOLVED") blockers.push("PROJECT_CONTEXT_REQUIRED");
  if (!input.predecessorClosing) blockers.push("W4_CLOSING_STATE_REQUIRED");
  if (input.openingError) blockers.push("W4_CLOSING_OPENING_LINEAGE_CONFLICT");

  if (blockers.length > 0) {
    return {
      status: "BLOCKED",
      entry_status: "BLOCKED",
      blocker_codes: blockers,
      ...(input.predecessorClosing
        ? { predecessor_closing_state_ref: structuredClone(input.predecessorClosing) }
        : {}),
      ...(input.nextRound && input.opening
        ? { next_round: nextRoundProjection(input.nextRound, input.opening) }
        : {})
    };
  }

  if (!input.nextRound) {
    return {
      status: "READY_TO_CONTINUE",
      entry_status: "NOT_CREATED",
      blocker_codes: [],
      predecessor_closing_state_ref: structuredClone(input.predecessorClosing!)
    };
  }

  const next = nextRoundProjection(input.nextRound, input.opening!);
  if (input.nextRound.status === "open") {
    return {
      status: "ENTRY_READY",
      entry_status: "OPEN",
      blocker_codes: [],
      predecessor_closing_state_ref: structuredClone(input.predecessorClosing!),
      next_round: next
    };
  }
  return {
    status: "READY_TO_CONTINUE",
    entry_status: input.nextRound.status === "draft" ? "DRAFT" : "BLOCKED",
    blocker_codes: input.nextRound.status === "draft" ? [] : ["NEXT_ROUND_NOT_OPEN"],
    predecessor_closing_state_ref: structuredClone(input.predecessorClosing!),
    next_round: next
  };
}

export class M2P5DecisionLearningCrossRoundService {
  constructor(private readonly dependencies: M2P5DecisionLearningDependencies) {}

  async getJourney(input: {
    actor: M2P5DecisionLearningActor;
    context: M2P5DecisionLearningContext;
    surface: M2P5DecisionLearningSurface;
  }): Promise<M2P5DecisionLearningResponse> {
    assertContext(input.context);
    if (
      input.actor.tenant_id !== input.context.tenant_id ||
      (input.surface === "student" && input.actor.team_id !== input.context.team_id)
    ) {
      throw new M2P5DecisionLearningError("M2P5_SCOPE_VIOLATION");
    }
    const round = await this.dependencies.getExactRound(
      input.context.tenant_id,
      input.context.run_id,
      input.context.round_no
    );
    if (
      !round ||
      round.round_id !== input.context.round_id ||
      round.run_id !== input.context.run_id ||
      round.round_no !== input.context.round_no ||
      round.tenant_id !== input.context.tenant_id
    ) {
      throw new M2P5DecisionLearningError("M2P5_ROUND_NOT_FOUND");
    }
    if (round.status !== "published") {
      throw new M2P5DecisionLearningError("M2P5_OFFICIAL_RESULT_NOT_PUBLISHED");
    }

    const official = await this.dependencies.getOfficialConsequence(
      input.actor,
      input.context,
      input.surface
    );
    if (official.record.publication.status !== "PUBLISHED") {
      throw new M2P5DecisionLearningError("M2P5_OFFICIAL_RESULT_NOT_PUBLISHED");
    }
    const [candidateReport, projectContext, w4Projection, nextRound] = await Promise.all([
      this.dependencies.getLearningReport(input.actor, input.context, input.surface),
      this.dependencies
        .getProjectContext({
          actor: input.actor,
          context: input.context,
          surface: input.surface
        })
        .catch((error: unknown) => ({
          status: "BLOCKED" as const,
          blockers: [error instanceof Error ? error.message : "PROJECT_CONTEXT_UNAVAILABLE"]
        })),
      this.dependencies
        .getW4Projection({ actor: input.actor, context: input.context })
        .catch(() => ({
          opening_state_ref: null,
          closing_state_ref: null
        })),
      this.dependencies.getNextRound(
        input.context.tenant_id,
        input.context.run_id,
        input.context.round_no + 1
      )
    ]);
    const report =
      candidateReport &&
      reportIsExactForRound(
        candidateReport,
        input.context,
        official.record.learning.student_learning_report_ref,
        official.record.learning.teacher_confirmation_ref
      )
        ? candidateReport
        : undefined;
    const learning = learningProjection(official.record, report);
    const predecessorClosing = w4Projection.closing_state_ref;
    let opening: { state_ref: W4StateRef; source_closing_state_ref: W4StateRef } | undefined;
    let openingError: unknown;
    if (nextRound && predecessorClosing) {
      try {
        opening = await this.dependencies.validateNextRoundOpening({
          actor: input.actor,
          context: input.context,
          next_round: nextRound,
          opening_state_ref: predecessorClosing
        });
        if (!sameRef(opening.source_closing_state_ref, predecessorClosing)) {
          openingError = new Error("W4_CLOSING_OPENING_LINEAGE_CONFLICT");
        }
      } catch (error: unknown) {
        openingError = error;
      }
    }
    const crossRound = crossRoundProjection({
      learningGate: learning.gate,
      projectContext,
      predecessorClosing,
      nextRound,
      ...(opening ? { opening } : {}),
      ...(openingError ? { openingError } : {})
    });
    const response: M2P5DecisionLearningResponse = {
      schema_version: "m2p5-decision-learning-crossround.v1",
      runtime_authority: "JSON_INTERNAL_ONLY",
      visibility: input.surface === "student" ? "student_safe" : "teacher_safe",
      exact_scope: structuredClone(input.context),
      official_consequence: structuredClone(official),
      learning,
      ...(report ? { learning_report: structuredClone(report) } : {}),
      project_context: structuredClone(projectContext),
      cross_round: crossRound,
      known_limits: [...KNOWN_LIMITS]
    };
    if (JSON.stringify(response).includes('"state_true"')) {
      throw new M2P5DecisionLearningError("M2P5_OUTPUT_INVALID");
    }
    return response;
  }
}
