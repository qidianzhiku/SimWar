import type {
  M2P5CrossRoundProjection,
  M2P5DecisionLearningContext,
  M2P5DecisionLearningResponse,
  M2P5NextRoundProjection,
  M2P5ProjectContextProjection,
  M2P5DecisionLearningSurface,
  M2P6LearningLoopAction,
  M2P6LearningLoopProjection,
  OperatingWorldConsequenceTrace,
  Round,
  StudentLearningReport,
  TeachingClosureDto,
  W3ExactRef,
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
  "Operating World consequence traces are inherited from W3 as read-only projections; M2-P5 never creates or writes them.",
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
  readonly getTeachingClosure: (
    actor: M2P5DecisionLearningActor,
    context: M2P5DecisionLearningContext
  ) => Promise<TeachingClosureDto>;
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

function assertInheritedOperatingWorldTrace(
  trace: OperatingWorldConsequenceTrace | undefined,
  context: M2P5DecisionLearningContext
): void {
  if (!trace) return;
  if (
    trace.scope.tenant_id !== context.tenant_id ||
    trace.scope.course_id !== context.course_id ||
    trace.scope.run_id !== context.run_id ||
    trace.scope.round_no !== context.round_no ||
    trace.scope.team_id !== context.team_id ||
    trace.writes_official_state !== false ||
    trace.ai_generated !== false
  ) {
    throw new M2P5DecisionLearningError("M2P5_OUTPUT_INVALID");
  }
}

function sameExactContext(
  left: W3OfficialConsequenceContext,
  right: M2P5DecisionLearningContext
): boolean {
  return (
    left.activity_id === right.activity_id &&
    left.course_id === right.course_id &&
    left.role_key === right.role_key &&
    left.round_id === right.round_id &&
    left.round_no === right.round_no &&
    left.run_id === right.run_id &&
    left.team_id === right.team_id &&
    left.tenant_id === right.tenant_id
  );
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
  report: StudentLearningReport | undefined,
  surface: M2P5DecisionLearningSurface
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
    ...(surface === "teacher" && record.learning.teacher_confirmation_ref
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

function roleSafeOfficialConsequence(
  official: W3OfficialConsequenceResponse,
  surface: M2P5DecisionLearningSurface
): W3OfficialConsequenceResponse {
  const cloned = structuredClone(official);
  if (surface === "teacher") return cloned;
  return {
    ...cloned,
    visibility: "student_safe",
    record: {
      ...cloned.record,
      learning: {
        evidence_selection_status: cloned.record.learning.evidence_selection_status,
        next_round_hypothesis_status: cloned.record.learning.next_round_hypothesis_status,
        ...(cloned.record.learning.student_learning_report_ref
          ? { student_learning_report_ref: cloned.record.learning.student_learning_report_ref }
          : {}),
        teacher_confirmation_status: cloned.record.learning.teacher_confirmation_status
      }
    }
  };
}

function uniqueExactRefs(refs: readonly W3ExactRef[]): readonly W3ExactRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = [
      ref.tenant_id,
      ref.resource_type,
      ref.resource_id,
      ref.version,
      ref.content_digest
    ].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function learningLoopProjection(input: {
  context: M2P5DecisionLearningContext;
  surface: M2P5DecisionLearningSurface;
  official: W3OfficialConsequenceResponse;
  candidateReport: StudentLearningReport | undefined;
  report: StudentLearningReport | undefined;
  projectContext: M2P5ProjectContextProjection;
  crossRound: M2P5CrossRoundProjection;
  openingError?: unknown;
  teachingClosure?: TeachingClosureDto;
  teachingClosureError?: unknown;
}): M2P6LearningLoopProjection {
  const record = input.official.record;
  const exactReportConflict = Boolean(input.candidateReport && !input.report);
  const teacherDebriefAvailability =
    input.surface === "teacher"
      ? input.teachingClosureError
        ? "UNKNOWN"
        : input.teachingClosure?.queue_item.confirmation_status === "CONFIRMED" &&
            input.teachingClosure.student_safe_preview.status === "CONFIRMED"
          ? "AVAILABLE"
          : "BLOCKED"
      : record.learning.teacher_confirmation_status === "CONFIRMED"
        ? "AVAILABLE"
        : "BLOCKED";
  const reportStatus = input.report ? "CONFIRMED" : "MISSING";
  const reflectionStatus = record.reflection ? "SUBMITTED" : "MISSING";
  const whatIfAvailability = record.counterfactual
    ? "AVAILABLE"
    : record.publication.status === "PUBLISHED" && reflectionStatus === "SUBMITTED"
      ? "NOT_GENERATED"
      : "BLOCKED";
  const transferReady =
    teacherDebriefAvailability === "AVAILABLE" &&
    reportStatus === "CONFIRMED" &&
    reflectionStatus === "SUBMITTED" &&
    whatIfAvailability === "AVAILABLE" &&
    record.learning.next_round_hypothesis_status === "READY" &&
    input.projectContext.status === "RESOLVED";
  const nextOpeningReadiness = input.crossRound.status;
  const blockers: string[] = [];
  if (exactReportConflict) {
    blockers.push("STUDENT_LEARNING_REPORT_EXACT_CONTEXT_CONFLICT");
  }
  if (input.openingError) blockers.push("W4_CLOSING_OPENING_LINEAGE_CONFLICT");
  if (input.teachingClosureError) blockers.push("TEACHING_CLOSURE_UNAVAILABLE");
  if (record.learning.teacher_confirmation_status !== "CONFIRMED") {
    blockers.push("TEACHER_CONFIRMATION_REQUIRED");
  }
  if (!input.teachingClosureError && teacherDebriefAvailability === "BLOCKED") {
    blockers.push("TEACHER_DEBRIEF_REQUIRED");
  }
  if (!exactReportConflict && reportStatus === "MISSING") {
    blockers.push("STUDENT_LEARNING_REPORT_REQUIRED");
  }
  if (reflectionStatus === "MISSING") blockers.push("REFLECTION_REQUIRED");
  if (whatIfAvailability !== "AVAILABLE") blockers.push("WHAT_IF_REQUIRED");
  if (record.learning.next_round_hypothesis_status !== "READY") {
    blockers.push("TRANSFER_HYPOTHESIS_REQUIRED");
  }
  if (input.projectContext.status !== "RESOLVED") blockers.push("PROJECT_CONTEXT_REQUIRED");
  if (
    nextOpeningReadiness === "BLOCKED" &&
    !input.openingError &&
    !blockers.includes("REFLECTION_REQUIRED") &&
    !exactReportConflict
  ) {
    blockers.push("NEXT_OPENING_STATE_BLOCKED");
  }

  const status =
    exactReportConflict || input.openingError
      ? "CONFLICT"
      : input.teachingClosureError
        ? "UNKNOWN"
        : transferReady && nextOpeningReadiness !== "BLOCKED"
          ? "READY"
          : "BLOCKED";
  const allowedActions: M2P6LearningLoopAction[] = [];
  if (input.surface === "teacher") {
    allowedActions.push("REVIEW_EVIDENCE");
    if (record.learning.teacher_confirmation_status === "CONFIRMED") {
      allowedActions.push("USE_EXISTING_D3_CONFIRMATION");
    }
    if (teacherDebriefAvailability === "AVAILABLE") allowedActions.push("PREPARE_DEBRIEF");
    if (reflectionStatus === "SUBMITTED" && whatIfAvailability !== "AVAILABLE") {
      allowedActions.push("CREATE_NON_OFFICIAL_WHAT_IF");
    }
    if (transferReady) allowedActions.push("REVIEW_TRANSFER");
  } else {
    if (reflectionStatus === "MISSING") allowedActions.push("SUBMIT_AI_OFF_REFLECTION");
    if (whatIfAvailability === "AVAILABLE") {
      allowedActions.push("REVIEW_NON_OFFICIAL_WHAT_IF");
    }
    if (transferReady) allowedActions.push("REVIEW_TRANSFER");
    if (transferReady && nextOpeningReadiness === "ENTRY_READY") {
      allowedActions.push("ENTER_NEXT_ROUND");
    }
  }

  const publicRefs: W3ExactRef[] = [
    record.source.canonical_decision_ref,
    record.source.round_ref,
    record.source.settlement_ref
  ];
  if (input.report && record.learning.student_learning_report_ref) {
    publicRefs.push(record.learning.student_learning_report_ref);
  }
  const roleSafeRefs = [...publicRefs];
  if (input.surface === "teacher" && record.learning.teacher_confirmation_ref) {
    roleSafeRefs.push(record.learning.teacher_confirmation_ref);
  }
  const refs = uniqueExactRefs(roleSafeRefs).map((ref) => structuredClone(ref));

  return {
    schema_version: "m2p6-teacher-debrief-learning-transfer.v1",
    status,
    exact_context: structuredClone(input.context),
    canonical_decision_ref: structuredClone(record.source.canonical_decision_ref),
    published_consequence_ref: {
      record_id: record.record_id,
      round_ref: structuredClone(record.source.round_ref),
      settlement_ref: structuredClone(record.source.settlement_ref)
    },
    teacher_confirmation_status: record.learning.teacher_confirmation_status,
    ...(input.surface === "teacher" && record.learning.teacher_confirmation_ref
      ? { teacher_confirmation_ref: structuredClone(record.learning.teacher_confirmation_ref) }
      : {}),
    teacher_debrief_availability: teacherDebriefAvailability,
    student_learning_report_status: reportStatus,
    reflection_status: reflectionStatus,
    what_if_availability: whatIfAvailability,
    transfer_status: transferReady ? "READY" : "BLOCKED",
    next_opening_state_readiness: nextOpeningReadiness,
    blockers,
    allowed_actions: allowedActions,
    recovery_state: "EXACT_CONTEXT_RESTORED",
    source_receipts: refs,
    provenance_refs: refs.map((ref) => structuredClone(ref))
  };
}

const FORBIDDEN_OUTPUT_KEYS = new Set([
  "state_true",
  "replay_hash",
  "replay_input_manifest",
  "full_manifest",
  "decision_batch_hash",
  "json_runtime_source_digest",
  "canonical_evidence_digest",
  "authority_diagnostics",
  "teacher_private_evidence",
  "private_role_information"
]);

function containsForbiddenOutputKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenOutputKey);
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value).some(
    ([key, child]) => FORBIDDEN_OUTPUT_KEYS.has(key) || containsForbiddenOutputKey(child)
  );
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
    if (
      !sameExactContext(official.record.context, input.context) ||
      official.visibility !== (input.surface === "student" ? "student_safe" : "teacher_safe")
    ) {
      throw new M2P5DecisionLearningError("M2P5_OUTPUT_INVALID");
    }
    assertInheritedOperatingWorldTrace(
      official.record.operating_world_consequence_trace,
      input.context
    );
    if (official.record.publication.status !== "PUBLISHED") {
      throw new M2P5DecisionLearningError("M2P5_OFFICIAL_RESULT_NOT_PUBLISHED");
    }
    const teachingClosureRead: Promise<{
      readonly value?: TeachingClosureDto;
      readonly error?: unknown;
    }> =
      input.surface === "teacher"
        ? this.dependencies
            .getTeachingClosure(input.actor, input.context)
            .then((value) => ({ value }))
            .catch((error: unknown) => ({ error }))
        : Promise.resolve({});
    const [candidateReport, projectContext, w4Projection, nextRound, teachingClosure] =
      await Promise.all([
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
        ),
        teachingClosureRead
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
    const learning = learningProjection(official.record, report, input.surface);
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
    const learningLoop = learningLoopProjection({
      context: input.context,
      surface: input.surface,
      official,
      candidateReport,
      report,
      projectContext,
      crossRound,
      ...(openingError ? { openingError } : {}),
      ...(teachingClosure.value ? { teachingClosure: teachingClosure.value } : {}),
      ...(teachingClosure.error ? { teachingClosureError: teachingClosure.error } : {})
    });
    const response: M2P5DecisionLearningResponse = {
      schema_version: "m2p5-decision-learning-crossround.v1",
      runtime_authority: "JSON_INTERNAL_ONLY",
      visibility: input.surface === "student" ? "student_safe" : "teacher_safe",
      exact_scope: structuredClone(input.context),
      official_consequence: roleSafeOfficialConsequence(official, input.surface),
      learning,
      ...(report ? { learning_report: structuredClone(report) } : {}),
      project_context: structuredClone(projectContext),
      cross_round: crossRound,
      learning_loop: learningLoop,
      known_limits: [...KNOWN_LIMITS]
    };
    if (
      containsForbiddenOutputKey(response) ||
      (input.surface === "student" &&
        JSON.stringify({
          learning: response.learning,
          learning_loop: response.learning_loop
        }).includes('"teacher_confirmation_ref"'))
    ) {
      throw new M2P5DecisionLearningError("M2P5_OUTPUT_INVALID");
    }
    return response;
  }
}
