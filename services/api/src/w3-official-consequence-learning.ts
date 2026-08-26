import { createHash } from "node:crypto";
import type {
  ActorRole,
  AuditLog,
  Decision,
  ParameterSet,
  SettlementResult,
  StudentLearningReport,
  TeacherConfirmationVersion
} from "@simwar/shared-contracts";
import {
  isW3OfficialConsequenceContext,
  isW3OfficialConsequenceRecord,
  type W3CounterfactualCommandInput,
  type W3CounterfactualProjection,
  type W3EvidenceSelectionCommandInput,
  type W3EvidenceSelectionProjection,
  type W3ExactRef,
  type W3HypothesisCommandInput,
  type W3NextRoundHypothesis,
  type W3OfficialConsequenceContext,
  type W3OfficialConsequenceRecord,
  type W3OfficialConsequenceResponse,
  type OperatingWorldConsequenceTrace,
  type W3ReflectionCommandInput,
  type W3ReflectionProjection
} from "@simwar/shared-contracts";
import type {
  D2EvidenceArtifactVersion,
  D2ProvenanceEdge,
  StudentLearningReportListDto
} from "@simwar/shared-contracts";
import { previewSettlementReplay } from "./simulation.js";

export const W3_KNOWN_LIMITS = [
  "W3 records are auditable learning traces, not a second Truth or SettlementResult authority.",
  "Counterfactuals are one-change, exact-context, non-official and model-conditioned; causal claims are not proven.",
  "D2 EvidenceArtifact, D3 Teacher Confirmation and D4 StudentLearningReport remain owned by their existing services.",
  "Runtime authority is JSON_INTERNAL_ONLY; durable recovery and Human Validation are not proven."
] as const;

export type W3Surface = "student" | "teacher";

export interface W3Actor {
  readonly roles: readonly ActorRole[];
  readonly tenant_id: string;
  readonly user_id: string;
  readonly team_id?: string;
}

export interface W3Repository {
  readonly auditLogs: {
    appendAuditLog(log: AuditLog): Promise<void>;
    listAuditLogs(query: {
      action?: string;
      resource_id?: string;
      resource_type?: string;
      scope: "tenant";
      tenant_id: string;
    }): Promise<AuditLog[]>;
  };
  readonly decisions: {
    getCanonicalDecisionForTeamRound(
      tenantId: string,
      runId: string,
      roundId: string,
      teamId: string
    ): Promise<Decision | null>;
    listDecisionsForRound(tenantId: string, runId: string, roundId: string): Promise<Decision[]>;
  };
  readonly parameterSets: {
    getParameterSet(tenantId: string, parameterSetId: string): Promise<ParameterSet | null>;
  };
  readonly rounds: {
    listRoundsForRun(tenantId: string, runId: string): Promise<RoundLike[]>;
  };
  readonly runs: {
    getRun(tenantId: string, runId: string): Promise<RunLike | null>;
  };
  readonly scenarios: {
    getScenarioPackage(tenantId: string, scenarioPackageId: string): Promise<ScenarioLike | null>;
  };
  readonly settlements: {
    listSettlementResultsForRound(
      tenantId: string,
      runId: string,
      roundId: string
    ): Promise<SettlementResult[]>;
  };
  readonly teams: {
    getTeam(tenantId: string, teamId: string): Promise<TeamLike | null>;
    listTeamsForRun(tenantId: string, runId: string): Promise<TeamLike[]>;
  };
}

export interface W3EvidenceRepository {
  listEvidenceArtifacts(tenantId: string): Promise<D2EvidenceArtifactVersion[]>;
  listProvenanceEdges(tenantId: string): Promise<D2ProvenanceEdge[]>;
}

export interface W3ConfirmationRepository {
  list(tenantId: string): Promise<TeacherConfirmationVersion[]>;
}

export interface W3ReportProjection {
  listStudent(actor: {
    tenant_id: string;
    user_id: string;
    team_id?: string;
  }): Promise<StudentLearningReportListDto>;
  listPreview(actor: { tenant_id: string; user_id: string }): Promise<StudentLearningReportListDto>;
}

export interface W3IdGenerator {
  createAuditLogId(): string;
}

export type W3RoundContext = W3OfficialConsequenceContext;

export interface W3OperatingWorldConsequenceProvider {
  getTrace(input: {
    readonly actor: W3Actor;
    readonly context: W3RoundContext;
    readonly decision: Decision;
    readonly settlement: SettlementResult;
    readonly publication: W3OfficialConsequenceRecord["publication"];
    readonly surface: W3Surface;
  }): Promise<OperatingWorldConsequenceTrace | undefined>;
}

interface RunLike {
  readonly course_id: string;
  readonly parameter_set_id: string;
  readonly run_id: string;
  readonly scenario_package_id: string;
  readonly seed: number;
  readonly status: string;
  readonly tenant_id: string;
}

interface RoundLike {
  readonly decision_batch_id?: string;
  readonly replay_hash?: string;
  readonly round_id: string;
  readonly round_no: number;
  readonly run_id: string;
  readonly status: string;
  readonly tenant_id: string;
}

interface TeamLike {
  readonly course_id: string;
  readonly members: readonly { user_id: string }[];
  readonly team_id: string;
  readonly tenant_id: string;
}

interface ScenarioLike {
  readonly plugin_package_ids?: readonly string[];
  readonly scenario_package_id: string;
  readonly version?: string;
}

export class W3OfficialConsequenceLearningError extends Error {
  constructor(
    readonly code:
      | "W3_ACTOR_SCOPE_VIOLATION"
      | "W3_CANONICAL_DECISION_REQUIRED"
      | "W3_CONTEXT_INVALID"
      | "W3_COUNTERFACTUAL_CONFLICT"
      | "W3_EVIDENCE_NOT_FOUND"
      | "W3_HYPOTHESIS_BLOCKED"
      | "W3_IDEMPOTENCY_CONFLICT"
      | "W3_OFFICIAL_RESULT_NOT_PUBLISHED"
      | "W3_OFFICIAL_RESULT_REQUIRED"
      | "W3_OUTPUT_INVALID"
      | "W3_REQUEST_INVALID"
      | "W3_SETTLEMENT_CONFLICT",
    message: string = code
  ) {
    super(message);
    this.name = "W3OfficialConsequenceLearningError";
  }
}

export class W3OfficialConsequenceLearningService {
  private readonly now: () => string;

  constructor(
    private readonly dependencies: {
      readonly confirmations: W3ConfirmationRepository;
      readonly evidence: W3EvidenceRepository;
      readonly idGenerator: W3IdGenerator;
      readonly now?: () => string;
      readonly operatingWorldConsequence?: W3OperatingWorldConsequenceProvider;
      readonly reports: W3ReportProjection;
      readonly repository: W3Repository;
    }
  ) {
    this.now = dependencies.now ?? (() => new Date().toISOString());
  }

  async getConsequence(
    actor: W3Actor,
    context: W3RoundContext,
    surface: W3Surface
  ): Promise<W3OfficialConsequenceResponse> {
    return this.getConsequenceWithEvidenceScope(actor, context, surface, "legacy_compatible");
  }

  async getConsequenceExact(
    actor: W3Actor,
    context: W3RoundContext,
    surface: W3Surface
  ): Promise<W3OfficialConsequenceResponse> {
    return this.getConsequenceWithEvidenceScope(actor, context, surface, "exact_round");
  }

  private async getConsequenceWithEvidenceScope(
    actor: W3Actor,
    context: W3RoundContext,
    surface: W3Surface,
    evidenceScope: "exact_round" | "legacy_compatible"
  ): Promise<W3OfficialConsequenceResponse> {
    const record = await this.buildRecord(actor, context, surface, evidenceScope);
    if (surface === "student" && record.publication.status !== "PUBLISHED") {
      throw new W3OfficialConsequenceLearningError(
        "W3_OFFICIAL_RESULT_NOT_PUBLISHED",
        "student consequence is unavailable until official publication"
      );
    }
    return {
      known_limits: [...W3_KNOWN_LIMITS],
      record,
      runtime_authority: "JSON_INTERNAL_ONLY",
      visibility: surface === "student" ? "student_safe" : "teacher_safe"
    };
  }

  async createCounterfactual(
    actor: W3Actor,
    input: W3CounterfactualCommandInput,
    requestId: string
  ): Promise<W3OfficialConsequenceResponse> {
    this.requireTeacher(actor);
    const context = this.validateContext(input.context);
    const record = await this.buildRecord(actor, context, "teacher");
    if (record.publication.status !== "PUBLISHED") {
      throw new W3OfficialConsequenceLearningError("W3_OFFICIAL_RESULT_NOT_PUBLISHED");
    }
    const decision = await this.getCanonicalDecision(actor.tenant_id, context);
    const originalValue = readDecisionField(decision, input.changed_field);
    assertChangedValue(input.changed_field, input.changed_value, originalValue);
    const teams = await this.dependencies.repository.teams.listTeamsForRun(
      actor.tenant_id,
      context.run_id
    );
    const decisions = await this.dependencies.repository.decisions.listDecisionsForRound(
      actor.tenant_id,
      context.run_id,
      context.round_id
    );
    const canonicalDecisions = await Promise.all(
      teams.map(async (team) => {
        const canonical =
          await this.dependencies.repository.decisions.getCanonicalDecisionForTeamRound(
            actor.tenant_id,
            context.run_id,
            context.round_id,
            team.team_id
          );
        return canonical ?? latestDecision(decisions, team.team_id);
      })
    );
    if (canonicalDecisions.some((item) => !item)) {
      throw new W3OfficialConsequenceLearningError("W3_CANONICAL_DECISION_REQUIRED");
    }
    const run = await this.dependencies.repository.runs.getRun(actor.tenant_id, context.run_id);
    const scenario = run
      ? await this.dependencies.repository.scenarios.getScenarioPackage(
          actor.tenant_id,
          run.scenario_package_id
        )
      : null;
    const parameterSet = run
      ? await this.dependencies.repository.parameterSets.getParameterSet(
          actor.tenant_id,
          run.parameter_set_id
        )
      : null;
    const round = (
      await this.dependencies.repository.rounds.listRoundsForRun(actor.tenant_id, context.run_id)
    ).find((candidate) => candidate.round_id === context.round_id);
    if (!run || !scenario || !parameterSet || !round) {
      throw new W3OfficialConsequenceLearningError("W3_OFFICIAL_RESULT_REQUIRED");
    }
    const changedDecision = {
      ...(decision as Decision),
      payload: writeDecisionField(decision.payload, input.changed_field, input.changed_value)
    };
    const replay = previewSettlementReplay({
      decisions: canonicalDecisions.map((item) =>
        item?.team_id === context.team_id ? changedDecision : (item as Decision)
      ),
      parameterSet: parameterSet as never,
      round: round as never,
      run: run as never,
      scenario: scenario as never,
      teams: teams as never
    });
    const officialTeam = record.official_result;
    const counterfactualTeam = replay.team_results.find((item) => item.team_id === context.team_id);
    if (!counterfactualTeam) {
      throw new W3OfficialConsequenceLearningError("W3_OFFICIAL_RESULT_REQUIRED");
    }
    const counterfactualId = `w3_cf_${hash({ context, idempotency_key: input.idempotency_key }).slice(0, 24)}`;
    const counterfactual: W3CounterfactualProjection = {
      causal_label: "model_conditioned_association",
      changed_field: input.changed_field,
      changed_value_digest: hash(input.changed_value),
      comparison: {
        counterfactual_rank: counterfactualTeam.state_obs.rank,
        counterfactual_score: counterfactualTeam.state_obs.score,
        official_rank: officialTeam.rank,
        official_score: officialTeam.score,
        rank_delta: counterfactualTeam.state_obs.rank - officialTeam.rank,
        score_delta: counterfactualTeam.state_obs.score - officialTeam.score
      },
      counterfactual_id: counterfactualId,
      exact_context_ref: exactRef("round", context.round_id, context.tenant_id, hash(context)),
      official: false,
      original_value_digest: hash(originalValue)
    };
    const existing = await this.findAuditByResource(
      actor.tenant_id,
      "w3.counterfactual.create",
      counterfactualId
    );
    if (existing) {
      if (existing.after?.content_digest !== hash(counterfactual)) {
        throw new W3OfficialConsequenceLearningError("W3_COUNTERFACTUAL_CONFLICT");
      }
    } else {
      await this.appendAudit(actor, requestId, "w3.counterfactual.create", counterfactualId, {
        content_digest: hash(counterfactual),
        context,
        counterfactual,
        idempotency_key: input.idempotency_key,
        record_id: record.record_id
      });
    }
    return this.getConsequence(actor, context, "teacher");
  }

  async saveReflection(
    actor: W3Actor,
    input: W3ReflectionCommandInput,
    requestId: string
  ): Promise<W3OfficialConsequenceResponse> {
    this.requireStudent(actor);
    const context = this.validateContext(input.context);
    const record = await this.buildRecord(actor, context, "student");
    if (record.publication.status !== "PUBLISHED") {
      throw new W3OfficialConsequenceLearningError("W3_OFFICIAL_RESULT_NOT_PUBLISHED");
    }
    if (!identity(input.prompt_id) || !safeText(input.response)) {
      throw new W3OfficialConsequenceLearningError("W3_REQUEST_INVALID");
    }
    const reflectionId = `w3_reflection_${hash({ context, idempotency_key: input.idempotency_key }).slice(0, 24)}`;
    const reflection: W3ReflectionProjection = {
      ai_used: false,
      advisory_only: true,
      prompt_id: input.prompt_id,
      reflection_id: reflectionId,
      response: input.response,
      status: "SUBMITTED"
    };
    const existing = await this.findAuditByResource(
      actor.tenant_id,
      "w3.reflection.save",
      reflectionId
    );
    if (existing && existing.after?.content_digest !== hash(reflection)) {
      throw new W3OfficialConsequenceLearningError("W3_IDEMPOTENCY_CONFLICT");
    }
    if (!existing) {
      await this.appendAudit(actor, requestId, "w3.reflection.save", reflectionId, {
        content_digest: hash(reflection),
        context,
        idempotency_key: input.idempotency_key,
        record_id: record.record_id,
        reflection
      });
    }
    return this.getConsequence(actor, context, "student");
  }

  async selectEvidence(
    actor: W3Actor,
    input: W3EvidenceSelectionCommandInput,
    requestId: string
  ): Promise<W3OfficialConsequenceResponse> {
    this.requireTeacher(actor);
    const context = this.validateContext(input.context);
    const record = await this.buildRecord(actor, context, "teacher");
    if (
      input.evidence_refs.length === 0 ||
      input.evidence_refs.some((ref) => ref.tenant_id !== actor.tenant_id)
    ) {
      throw new W3OfficialConsequenceLearningError("W3_REQUEST_INVALID");
    }
    const artifacts = await this.dependencies.evidence.listEvidenceArtifacts(actor.tenant_id);
    const valid = input.evidence_refs.every((ref) =>
      artifacts.some(
        (artifact) =>
          artifact.artifact_ref.resource_id === ref.resource_id &&
          artifact.artifact_ref.version === ref.version &&
          artifact.artifact_ref.content_digest === ref.content_digest &&
          artifact.context.activity_id === context.activity_id &&
          artifact.context.course_id === context.course_id &&
          artifact.context.role_key === context.role_key &&
          artifact.context.run_id === context.run_id &&
          artifact.context.team_id === context.team_id
      )
    );
    if (!valid) throw new W3OfficialConsequenceLearningError("W3_EVIDENCE_NOT_FOUND");
    const selectionId = `w3_selection_${hash({ context, idempotency_key: input.idempotency_key }).slice(0, 24)}`;
    const selection: W3EvidenceSelectionProjection = {
      evidence_refs: input.evidence_refs,
      selection_id: selectionId,
      status: "SELECTED"
    };
    const existing = await this.findAuditByResource(
      actor.tenant_id,
      "w3.evidence.select",
      selectionId
    );
    if (existing && existing.after?.content_digest !== hash(selection)) {
      throw new W3OfficialConsequenceLearningError("W3_IDEMPOTENCY_CONFLICT");
    }
    if (!existing) {
      await this.appendAudit(actor, requestId, "w3.evidence.select", selectionId, {
        content_digest: hash(selection),
        context,
        idempotency_key: input.idempotency_key,
        record_id: record.record_id,
        selection
      });
    }
    return this.getConsequence(actor, context, "teacher");
  }

  async prepareNextRoundHypothesis(
    actor: W3Actor,
    input: W3HypothesisCommandInput,
    requestId: string
  ): Promise<W3OfficialConsequenceResponse> {
    this.requireTeacher(actor);
    const context = this.validateContext(input.context);
    const record = await this.buildRecord(actor, context, "teacher");
    if (record.publication.status !== "PUBLISHED") {
      throw new W3OfficialConsequenceLearningError("W3_OFFICIAL_RESULT_NOT_PUBLISHED");
    }
    const reasons: string[] = [];
    if (!record.reflection) reasons.push("student_reflection_required");
    if (record.learning.teacher_confirmation_status !== "CONFIRMED")
      reasons.push("teacher_confirmation_required");
    if (record.learning.evidence_selection_status !== "SELECTED")
      reasons.push("evidence_selection_required");
    if (reasons.length > 0) {
      return this.getConsequence(actor, context, "teacher");
    }
    const hypothesis: W3NextRoundHypothesis = {
      basis: "published official result plus confirmed learning evidence",
      hypothesis:
        "Test one bounded decision change next round and compare it with the official baseline.",
      status: "READY"
    };
    const existing = await this.findAuditByResource(
      actor.tenant_id,
      "w3.next_round_hypothesis.ready",
      record.record_id
    );
    if (!existing) {
      await this.appendAudit(actor, requestId, "w3.next_round_hypothesis.ready", record.record_id, {
        context,
        hypothesis,
        record_id: record.record_id
      });
    }
    return this.getConsequence(actor, context, "teacher");
  }

  private async buildRecord(
    actor: W3Actor,
    context: W3RoundContext,
    surface: W3Surface,
    evidenceScope: "exact_round" | "legacy_compatible" = "legacy_compatible"
  ): Promise<W3OfficialConsequenceRecord> {
    const run = await this.dependencies.repository.runs.getRun(actor.tenant_id, context.run_id);
    const rounds = await this.dependencies.repository.rounds.listRoundsForRun(
      actor.tenant_id,
      context.run_id
    );
    const round = rounds.find((candidate) => candidate.round_id === context.round_id);
    const team = await this.dependencies.repository.teams.getTeam(actor.tenant_id, context.team_id);
    if (
      !run ||
      !round ||
      !team ||
      run.course_id !== context.course_id ||
      run.tenant_id !== context.tenant_id ||
      round.run_id !== context.run_id ||
      round.round_no !== context.round_no ||
      team.course_id !== context.course_id ||
      team.tenant_id !== actor.tenant_id
    ) {
      throw new W3OfficialConsequenceLearningError("W3_CONTEXT_INVALID");
    }
    if (surface === "student" && !team.members.some((member) => member.user_id === actor.user_id)) {
      throw new W3OfficialConsequenceLearningError("W3_ACTOR_SCOPE_VIOLATION");
    }
    const decision = await this.getCanonicalDecision(actor.tenant_id, context);
    const settlements =
      await this.dependencies.repository.settlements.listSettlementResultsForRound(
        actor.tenant_id,
        context.run_id,
        context.round_id
      );
    const matchingSettlements = settlements.filter(
      (candidate) =>
        candidate.tenant_id === actor.tenant_id &&
        candidate.run_id === context.run_id &&
        candidate.round_id === context.round_id &&
        candidate.round_no === context.round_no
    );
    if (!decision) throw new W3OfficialConsequenceLearningError("W3_CANONICAL_DECISION_REQUIRED");
    if (matchingSettlements.length !== 1) {
      throw new W3OfficialConsequenceLearningError(
        matchingSettlements.length === 0 ? "W3_OFFICIAL_RESULT_REQUIRED" : "W3_SETTLEMENT_CONFLICT"
      );
    }
    const settlement = matchingSettlements[0] as SettlementResult;
    const teamResult = settlement.team_results.find(
      (candidate) => candidate.team_id === context.team_id
    );
    if (!teamResult) throw new W3OfficialConsequenceLearningError("W3_OFFICIAL_RESULT_REQUIRED");
    const [audits, publicationAudits] = await Promise.all([
      this.dependencies.repository.auditLogs.listAuditLogs({
        resource_type: "w3_official_consequence",
        scope: "tenant",
        tenant_id: actor.tenant_id
      }),
      this.dependencies.repository.auditLogs.listAuditLogs({
        action: "round.publish",
        resource_id: round.round_id,
        resource_type: "round",
        scope: "tenant",
        tenant_id: actor.tenant_id
      })
    ]);
    const recordAudits = audits.filter((audit) => audit.after?.record_id === recordId(context));
    const confirmation = latestConfirmation(
      await this.dependencies.confirmations.list(actor.tenant_id),
      context,
      evidenceScope
    );
    const report = await this.findReport(actor, context, surface, evidenceScope);
    const selection = latestAfter<W3EvidenceSelectionProjection>(
      recordAudits,
      "w3.evidence.select",
      "selection"
    );
    const reflection = latestAfter<W3ReflectionProjection>(
      recordAudits,
      "w3.reflection.save",
      "reflection"
    );
    const counterfactual = latestAfter<W3CounterfactualProjection>(
      recordAudits,
      "w3.counterfactual.create",
      "counterfactual"
    );
    const hypothesis = latestAfter<W3NextRoundHypothesis>(
      recordAudits,
      "w3.next_round_hypothesis.ready",
      "hypothesis"
    );
    const publicationStatus = round.status === "published" ? "PUBLISHED" : "SETTLED_UNPUBLISHED";
    const publishedAt = publicationTimestamp(publicationAudits);
    const publication = {
      ...(round.status === "published" && publishedAt ? { published_at: publishedAt } : {}),
      status: publicationStatus
    } as W3OfficialConsequenceRecord["publication"];
    const source = {
      canonical_decision_ref: exactRef(
        "canonical_decision",
        decision.decision_id,
        actor.tenant_id,
        hash(decision)
      ),
      round_ref: exactRef("round", round.round_id, actor.tenant_id, hash(round)),
      settlement_ref: exactRef(
        "settlement_result",
        settlement.settlement_result_id,
        actor.tenant_id,
        settlement.replay_hash
      )
    } as W3OfficialConsequenceRecord["source"];
    const operatingWorldConsequence = await this.dependencies.operatingWorldConsequence?.getTrace({
      actor,
      context,
      decision,
      settlement,
      publication,
      surface
    });
    const record: W3OfficialConsequenceRecord = {
      causal_debrief: {
        label: "model_conditioned_association",
        statements: [
          "Observed consequence is linked to the exact admitted Decision and official model context.",
          "This label describes a bounded association; it is not a causal proof."
        ]
      },
      context,
      ...(counterfactual ? { counterfactual } : {}),
      decision_story: {
        consequence_summary: `Published official outcome for ${teamResult.team_id} is available in the safe result layer.`,
        decision_summary:
          "Canonical Decision admission was resolved through the existing W027 path."
      },
      ...(surface === "teacher" && selection ? { evidence_selection: selection } : {}),
      known_limits: [...W3_KNOWN_LIMITS],
      learning: {
        evidence_selection_status: selection ? "SELECTED" : "NOT_SELECTED",
        next_round_hypothesis_status: hypothesis?.status ?? "BLOCKED",
        ...(report ? { student_learning_report_ref: report.report_ref as W3ExactRef } : {}),
        ...(surface === "teacher" && confirmation
          ? { teacher_confirmation_ref: confirmation.confirmation_ref as W3ExactRef }
          : {}),
        teacher_confirmation_status:
          confirmation?.status === "CONFIRMED"
            ? "CONFIRMED"
            : confirmation?.status === "DRAFT"
              ? "DRAFT"
              : "MISSING"
      },
      ...(operatingWorldConsequence
        ? { operating_world_consequence_trace: operatingWorldConsequence }
        : {}),
      ...(hypothesis ? { next_round_hypothesis: hypothesis } : {}),
      official_result: {
        outcome_label:
          publicationStatus === "PUBLISHED" ? "official_published" : "official_settled_unpublished",
        profit_band: teamResult.state_obs.profit_band,
        rank: teamResult.state_obs.rank,
        score: teamResult.state_obs.score,
        team_id: teamResult.team_id
      },
      publication,
      ...(reflection ? { reflection } : {}),
      record_id: recordId(context),
      runtime_authority: "JSON_INTERNAL_ONLY",
      schema_version: "w3-official-consequence-learning.v1",
      source
    };
    if (!isW3OfficialConsequenceRecord(record)) {
      throw new W3OfficialConsequenceLearningError("W3_OUTPUT_INVALID");
    }
    return record;
  }

  private async getCanonicalDecision(tenantId: string, context: W3RoundContext): Promise<Decision> {
    const decision = await this.dependencies.repository.decisions.getCanonicalDecisionForTeamRound(
      tenantId,
      context.run_id,
      context.round_id,
      context.team_id
    );
    if (!decision || decision.canonical_source !== "role_merge_commit") {
      throw new W3OfficialConsequenceLearningError("W3_CANONICAL_DECISION_REQUIRED");
    }
    return decision;
  }

  private async findReport(
    actor: W3Actor,
    context: W3RoundContext,
    surface: W3Surface,
    evidenceScope: "exact_round" | "legacy_compatible"
  ): Promise<StudentLearningReport | undefined> {
    const data =
      surface === "student"
        ? await this.dependencies.reports.listStudent({
            tenant_id: actor.tenant_id,
            user_id: actor.user_id,
            ...(actor.team_id ? { team_id: actor.team_id } : {})
          })
        : await this.dependencies.reports.listPreview({
            tenant_id: actor.tenant_id,
            user_id: actor.user_id
          });
    return data.reports.find(
      (report) =>
        report.context.course_id === context.course_id &&
        report.context.run_id === context.run_id &&
        report.context.team_id === context.team_id &&
        report.context.role_key === context.role_key &&
        roundEvidenceMatches(report.context, context, evidenceScope)
    );
  }

  private validateContext(context: W3RoundContext): W3RoundContext {
    if (!isW3OfficialConsequenceContext(context)) {
      throw new W3OfficialConsequenceLearningError("W3_CONTEXT_INVALID");
    }
    return context;
  }

  private requireTeacher(actor: W3Actor): void {
    if (!actor.roles.some((role) => ["teacher", "tenant_admin", "platform_admin"].includes(role))) {
      throw new W3OfficialConsequenceLearningError("W3_ACTOR_SCOPE_VIOLATION");
    }
  }

  private requireStudent(actor: W3Actor): void {
    if (!actor.roles.some((role) => ["learner", "team_captain"].includes(role))) {
      throw new W3OfficialConsequenceLearningError("W3_ACTOR_SCOPE_VIOLATION");
    }
  }

  private async findAuditByResource(
    tenantId: string,
    action: string,
    resourceId: string
  ): Promise<AuditLog | undefined> {
    return (
      await this.dependencies.repository.auditLogs.listAuditLogs({
        action,
        resource_id: resourceId,
        scope: "tenant",
        tenant_id: tenantId
      })
    )[0];
  }

  private async appendAudit(
    actor: W3Actor,
    requestId: string,
    action: string,
    resourceId: string,
    after: Record<string, unknown>
  ): Promise<void> {
    await this.dependencies.repository.auditLogs.appendAuditLog({
      action,
      actor_id: actor.user_id,
      actor_role: actor.roles[0] ?? "learner",
      audit_id: this.dependencies.idGenerator.createAuditLogId(),
      created_at: this.now(),
      request_id: requestId,
      resource_id: resourceId,
      resource_type: "w3_official_consequence",
      tenant_id: actor.tenant_id,
      after
    });
  }
}

function exactRef(
  resource_type: W3ExactRef["resource_type"],
  resource_id: string,
  tenant_id: string,
  content_digest: string
): W3ExactRef {
  return {
    content_digest,
    discriminator: "exact_ref",
    resource_id,
    resource_type,
    tenant_id,
    version: "1.0.0"
  };
}

function recordId(context: W3RoundContext): string {
  return `w3_consequence_${context.run_id}_${context.round_no}_${context.team_id}`;
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function identity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(value) &&
    !/(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i.test(value)
  );
}

function safeText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 2000 &&
    !value.includes("<") &&
    !value.includes(">") &&
    !Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code < 0x20 || code === 0x7f;
    })
  );
}

function latestDecision(decisions: readonly Decision[], teamId: string): Decision | undefined {
  return decisions
    .filter((decision) => decision.team_id === teamId)
    .sort(
      (left, right) =>
        left.version - right.version || left.decision_id.localeCompare(right.decision_id)
    )
    .at(-1);
}

function latestConfirmation(
  confirmations: readonly TeacherConfirmationVersion[],
  context: W3RoundContext,
  evidenceScope: "exact_round" | "legacy_compatible"
): TeacherConfirmationVersion | undefined {
  return confirmations
    .filter(
      (confirmation) =>
        confirmation.context.course_id === context.course_id &&
        confirmation.context.run_id === context.run_id &&
        confirmation.context.team_id === context.team_id &&
        confirmation.context.role_key === context.role_key &&
        roundEvidenceMatches(confirmation.context, context, evidenceScope)
    )
    .sort((left, right) =>
      left.confirmation_ref.version.localeCompare(right.confirmation_ref.version)
    )
    .at(-1);
}

function roundEvidenceMatches(
  candidate: { readonly round_id?: string; readonly round_no?: number },
  context: W3RoundContext,
  evidenceScope: "exact_round" | "legacy_compatible"
): boolean {
  if (evidenceScope === "exact_round") {
    return candidate.round_id === context.round_id && candidate.round_no === context.round_no;
  }
  return (
    (candidate.round_id === undefined || candidate.round_id === context.round_id) &&
    (candidate.round_no === undefined || candidate.round_no === context.round_no)
  );
}

function latestAfter<T>(audits: readonly AuditLog[], action: string, key: string): T | undefined {
  const audit = audits.filter((item) => item.action === action).at(-1);
  const value = audit?.after?.[key];
  return value as T | undefined;
}

function publicationTimestamp(audits: readonly AuditLog[]): string | undefined {
  return audits
    .filter((audit) => audit.action === "round.publish")
    .map((audit) => audit.created_at)
    .at(-1);
}

function readDecisionField(
  decision: Decision,
  field: W3CounterfactualProjection["changed_field"]
): number | string {
  if (field === "pricing.base_price") return decision.payload.pricing.base_price;
  if (field === "capacity_plan") return decision.payload.capacity_plan;
  if (field === "cash_buffer_target") return decision.payload.cash_buffer_target;
  if (field === "marketing_budget") return decision.payload.marketing_budget;
  return decision.payload.service_quality_budget;
}

function writeDecisionField(
  payload: Decision["payload"],
  field: W3CounterfactualProjection["changed_field"],
  value: number | string
): Decision["payload"] {
  if (field === "pricing.base_price")
    return { ...payload, pricing: { base_price: value as number } };
  if (field === "capacity_plan")
    return { ...payload, capacity_plan: value as Decision["payload"]["capacity_plan"] };
  if (field === "cash_buffer_target") return { ...payload, cash_buffer_target: value as number };
  if (field === "marketing_budget") return { ...payload, marketing_budget: value as number };
  return { ...payload, service_quality_budget: value as number };
}

function assertChangedValue(
  field: W3CounterfactualProjection["changed_field"],
  value: number | string,
  original: number | string
): void {
  if (typeof value !== typeof original || value === original) {
    throw new W3OfficialConsequenceLearningError("W3_REQUEST_INVALID");
  }
  if (field === "capacity_plan" && !["contract", "hold", "expand"].includes(value as string)) {
    throw new W3OfficialConsequenceLearningError("W3_REQUEST_INVALID");
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new W3OfficialConsequenceLearningError("W3_REQUEST_INVALID");
  }
}
