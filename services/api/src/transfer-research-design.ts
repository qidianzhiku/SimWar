import { createHash } from "node:crypto";
import {
  D6_RUNTIME_AUTHORITY,
  D6_STUDY_STATES,
  D6_TRANSFER_SCHEMA_VERSION,
  isD6ExactRef,
  isTransferEvidenceSourcePolicy,
  isTransferInstrumentVersion,
  isTransferOutcomeMeasureDefinition,
  isTransferObservationWindowDefinition,
  isTransferResearchScope,
  isTransferStudyDefinitionVersion,
  type D6ExactRef,
  type TransferEvidenceRecordCandidate,
  type TransferInstrumentVersion,
  type TransferAnalysisPlanVersion,
  type TransferResearchDesignInput,
  type TransferResearchDesignListDto,
  type TransferStudyDefinitionVersion
} from "@simwar/shared-contracts";
import type {
  SyntheticTransferPreviewPort,
  TransferResearchAuditAction,
  TransferResearchDesignBundle,
  TransferResearchDesignCommandPort,
  TransferResearchDesignPersistencePort
} from "./transfer-research-design-ports.js";
import type { TransferResearchDesignQueryPort } from "./transfer-research-design-ports.js";

export type D6ResearchDesignFailureCode =
  | "D6_RESEARCH_INPUT_INVALID"
  | "D6_TENANT_SCOPE_VIOLATION"
  | "D6_DUPLICATE_CONFLICT"
  | "D6_STUDY_NOT_FOUND"
  | "D6_STUDY_NOT_REVISIONABLE"
  | "D6_SYNTHETIC_ONLY"
  | "D6_CAUSAL_CLAIM_FORBIDDEN"
  | "D6_REAL_DATA_FORBIDDEN"
  | "D6_HR_OUTPUT_FORBIDDEN";

export class TransferResearchDesignError extends Error {
  constructor(readonly code: D6ResearchDesignFailureCode) {
    super(code);
  }
}

const KNOWN_LIMITS = [
  "D6 is synthetic-only and does not accept real participant or external-system data.",
  "D6 is descriptive/associational only; causal claims, HR/talent outputs, and formal transfer claims are forbidden.",
  "JSON_INTERNAL_ONLY is the active runtime authority; durable recovery is not proven.",
  "Human Validation is not performed; Issue #111 remains an open known limit.",
  "PostgreSQL, external HRIS/LMS/LRS, Pilot, and Production are not active or authorized."
] as const;

const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
};
const digest = (value: unknown): string => createHash("sha256").update(stable(value)).digest("hex");
const ref = (
  tenantId: string,
  resourceId: string,
  resourceType: string,
  version: string,
  contentDigest: string
): D6ExactRef => ({
  content_digest: contentDigest,
  discriminator: "exact_ref",
  resource_id: resourceId,
  resource_type: resourceType,
  tenant_id: tenantId,
  version
});
const sameTenant = (tenantId: string, refs: readonly D6ExactRef[]) =>
  refs.every((item) => item.tenant_id === tenantId);

export interface TransferResearchDesignActor {
  readonly actor_id: string;
  readonly tenant_id: string;
}

export class TransferResearchDesignCommandService
  implements
    TransferResearchDesignCommandPort,
    TransferResearchDesignQueryPort,
    SyntheticTransferPreviewPort
{
  constructor(
    private readonly repository: TransferResearchDesignPersistencePort,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async list(tenantId: string): Promise<TransferResearchDesignListDto> {
    return {
      known_limits: [...KNOWN_LIMITS],
      runtime_authority: D6_RUNTIME_AUTHORITY,
      studies: await this.repository.listStudies(tenantId),
      synthetic_previews: await this.repository.listCandidates(tenantId)
    };
  }

  async preview(
    tenantId: string,
    input: TransferResearchDesignInput
  ): Promise<TransferResearchDesignBundle> {
    return this.build(tenantId, input, "PREVIEWED");
  }

  async freeze(
    actor: TransferResearchDesignActor,
    input: TransferResearchDesignInput
  ): Promise<{
    readonly bundle: TransferResearchDesignBundle;
    readonly status: "created" | "reused";
  }> {
    const bundle = await this.build(actor.tenant_id, input, "FROZEN");
    try {
      const status = await this.repository.appendBundle(
        bundle,
        this.audit(actor, "D6_RESEARCH_DESIGN_FROZEN", bundle.study)
      );
      return { bundle, status };
    } catch (error) {
      if (error instanceof Error && error.message === "D6_DUPLICATE_CONFLICT")
        throw new TransferResearchDesignError("D6_DUPLICATE_CONFLICT");
      throw error;
    }
  }

  async revise(
    actor: TransferResearchDesignActor,
    studyId: string,
    input: TransferResearchDesignInput
  ): Promise<{
    readonly bundle: TransferResearchDesignBundle;
    readonly status: "created" | "reused";
  }> {
    const current = await this.repository.getStudy(actor.tenant_id, studyId);
    if (!current || current.lifecycle === "RETIRED")
      throw new TransferResearchDesignError("D6_STUDY_NOT_REVISIONABLE");
    const bundle = await this.build(actor.tenant_id, input, "FROZEN", current.study_ref);
    try {
      const status = await this.repository.appendBundle(
        bundle,
        this.audit(actor, "D6_RESEARCH_DESIGN_REVISED", bundle.study)
      );
      return { bundle, status };
    } catch (error) {
      if (error instanceof Error && error.message === "D6_DUPLICATE_CONFLICT")
        throw new TransferResearchDesignError("D6_DUPLICATE_CONFLICT");
      throw error;
    }
  }

  async retire(
    actor: TransferResearchDesignActor,
    studyId: string
  ): Promise<TransferStudyDefinitionVersion> {
    const current = await this.repository.getStudy(actor.tenant_id, studyId);
    if (!current) throw new TransferResearchDesignError("D6_STUDY_NOT_FOUND");
    const retired = await this.repository.retireStudy(
      actor.tenant_id,
      studyId,
      this.audit(actor, "D6_RESEARCH_DESIGN_RETIRED", current)
    );
    if (!retired) throw new TransferResearchDesignError("D6_STUDY_NOT_FOUND");
    return retired;
  }

  async syntheticPreview(
    actor: TransferResearchDesignActor,
    studyId: string
  ): Promise<TransferEvidenceRecordCandidate> {
    const study = await this.repository.getStudy(actor.tenant_id, studyId);
    if (!study) throw new TransferResearchDesignError("D6_STUDY_NOT_FOUND");
    const candidates = await this.repository.listCandidates(actor.tenant_id);
    const candidate = candidates.find((item) => item.study_ref.resource_id === studyId);
    if (!candidate) throw new TransferResearchDesignError("D6_STUDY_NOT_FOUND");
    return candidate;
  }

  private async build(
    tenantId: string,
    input: TransferResearchDesignInput,
    status: "PREVIEWED" | "FROZEN",
    supersedesRef?: D6ExactRef
  ): Promise<TransferResearchDesignBundle> {
    const refs = [
      input.analysis_plan_ref,
      input.course_package_ref,
      input.d4_source_ref,
      input.d5_source_ref,
      input.learning_goal_ref,
      input.rubric_ref
    ];
    if (!refs.every(isD6ExactRef) || !sameTenant(tenantId, refs))
      throw new TransferResearchDesignError("D6_TENANT_SCOPE_VIOLATION");
    if (
      input.analysis_plan_ref.resource_type !== "transfer_analysis_plan_version" ||
      input.course_package_ref.resource_type !== "course_package_version" ||
      input.d4_source_ref.resource_type !== "student_learning_report" ||
      input.d5_source_ref.resource_type !== "learning_export_bundle_version" ||
      input.learning_goal_ref.resource_type !== "learning_goal_version" ||
      input.rubric_ref.resource_type !== "rubric_version"
    )
      throw new TransferResearchDesignError("D6_RESEARCH_INPUT_INVALID");
    if (
      !isTransferResearchScope(input.scope) ||
      input.scope.course_id !== input.course_package_ref.resource_id ||
      !Array.isArray(input.context_factors) ||
      input.context_factors.length === 0 ||
      !input.context_factors.every(
        (factor) => typeof factor === "string" && factor.trim() === factor && factor.length > 0
      ) ||
      !Array.isArray(input.research_questions) ||
      input.research_questions.length === 0 ||
      !input.research_questions.every(
        (question) =>
          typeof question.question_id === "string" &&
          typeof question.prompt === "string" &&
          question.question_id.trim() === question.question_id &&
          question.question_id.length > 0 &&
          question.prompt.trim() === question.prompt &&
          question.prompt.length > 0
      ) ||
      !isTransferEvidenceSourcePolicy(input.provenance_source_policy) ||
      !Array.isArray(input.observation_windows) ||
      input.observation_windows.length < 2 ||
      !input.observation_windows.some((window) => window.code === "W0_BASELINE") ||
      !input.observation_windows.every(isTransferObservationWindowDefinition) ||
      !Array.isArray(input.outcome_measures) ||
      input.outcome_measures.length === 0 ||
      !input.outcome_measures.every(isTransferOutcomeMeasureDefinition) ||
      input.outcome_measures.filter((measure) => measure.role === "PRIMARY").length !== 1 ||
      !input.title.trim()
    )
      throw new TransferResearchDesignError("D6_RESEARCH_INPUT_INVALID");
    const instrumentDigest = digest(input.instrument);
    const instrumentRef = ref(
      tenantId,
      "instrument_d6_" + instrumentDigest.slice(0, 12),
      "transfer_instrument_version",
      "1.0.0",
      instrumentDigest
    );
    const instrument: TransferInstrumentVersion = {
      ...input.instrument,
      content_digest: instrumentDigest,
      instrument_ref: instrumentRef,
      schema_version: D6_TRANSFER_SCHEMA_VERSION,
      status: "FROZEN",
      visibility: "teacher_admin_only"
    };
    if (!isTransferInstrumentVersion(instrument))
      throw new TransferResearchDesignError("D6_RESEARCH_INPUT_INVALID");
    const analysisPlan: TransferAnalysisPlanVersion = {
      analysis_plan_ref: input.analysis_plan_ref,
      claim_mode: "DESCRIPTIVE_ONLY",
      content_digest: input.analysis_plan_ref.content_digest,
      causal_claim: false,
      baseline_required: true,
      missing_data_policy: "MISSING_NOT_NEGATIVE",
      outcome_codes: input.outcome_measures.map((item) => item.code),
      schema_version: D6_TRANSFER_SCHEMA_VERSION,
      small_cell_suppression: input.provenance_source_policy.small_cohort_minimum
    };
    const studyDigest = digest({
      analysisPlan: input.analysis_plan_ref,
      context_factors: input.context_factors,
      course: input.course_package_ref,
      d4: input.d4_source_ref,
      d5: input.d5_source_ref,
      instrument: instrumentRef,
      learningGoal: input.learning_goal_ref,
      research_questions: input.research_questions,
      scope: input.scope,
      supersedes: supersedesRef ?? null,
      windows: input.observation_windows,
      outcomes: input.outcome_measures,
      policy: input.provenance_source_policy,
      rubric: input.rubric_ref,
      title: input.title
    });
    const studyRef = ref(
      tenantId,
      "study_d6_" + studyDigest.slice(0, 12),
      "transfer_study_definition_version",
      "1.0.0",
      studyDigest
    );
    const study: TransferStudyDefinitionVersion = {
      analysis_plan_ref: input.analysis_plan_ref,
      content_digest: studyDigest,
      course_package_ref: input.course_package_ref,
      created_at: this.now(),
      d4_source_ref: input.d4_source_ref,
      d4_reference_only: true,
      d5_source_ref: input.d5_source_ref,
      d5_reference_only: true,
      formal_transfer_claim_write: false,
      instrument_refs: [instrumentRef],
      lifecycle: status === "FROZEN" ? "FROZEN" : "READY_WITH_LIMITS",
      context_factors: input.context_factors,
      observation_windows: input.observation_windows,
      outcome_measures: input.outcome_measures,
      provenance_source_policy: input.provenance_source_policy,
      research_questions: input.research_questions,
      rubric_ref: input.rubric_ref,
      schema_version: D6_TRANSFER_SCHEMA_VERSION,
      study_ref: studyRef,
      title: input.title,
      learning_goal_ref: input.learning_goal_ref,
      scope: input.scope,
      ...(supersedesRef ? { supersedes_ref: supersedesRef } : {}),
      visibility: "teacher_admin_only"
    };
    if (!isTransferStudyDefinitionVersion(study) || !D6_STUDY_STATES.includes(study.lifecycle))
      throw new TransferResearchDesignError("D6_RESEARCH_INPUT_INVALID");
    const firstWindow = input.observation_windows[0];
    if (!firstWindow) throw new TransferResearchDesignError("D6_RESEARCH_INPUT_INVALID");
    const candidateDigest = digest({
      study: studyRef,
      instrument: instrumentRef,
      window: firstWindow
    });
    const candidateRef = ref(
      tenantId,
      "candidate_d6_" + candidateDigest.slice(0, 12),
      "transfer_evidence_record_candidate",
      "1.0.0",
      candidateDigest
    );
    const windowDigest = digest(firstWindow);
    const windowRef = ref(
      tenantId,
      "window_d6_" + firstWindow.code.toLowerCase(),
      "transfer_observation_window",
      "1.0.0",
      windowDigest
    );
    const participantRef = ref(
      tenantId,
      "participant_pseudo_synthetic",
      "pseudonymous_participant",
      "1.0.0",
      digest({ study: studyRef, participant: "synthetic" })
    );
    const candidate: TransferEvidenceRecordCandidate = {
      candidate_ref: candidateRef,
      content_digest: candidateDigest,
      context_snapshot: { factors: input.context_factors, opportunity_status: "AVAILABLE" },
      created_at: this.now(),
      formal_transfer_claim_write: false,
      instrument_ref: instrumentRef,
      missingness_status: "OBSERVED",
      observer_relation: "SELF",
      observer_conflict_status: "NOT_ASSESSED",
      participation_status: "NOT_ESTABLISHED",
      participant_ref: participantRef,
      provenance_edges: [
        {
          discriminator: "d6_transfer_provenance_edge",
          relation: "derived_from",
          source_ref: input.course_package_ref,
          target_ref: candidateRef
        }
      ],
      record_type: "TRANSFER_SELF_REPORT_RECORD",
      runtime_status: "SYNTHETIC_ONLY",
      schema_version: D6_TRANSFER_SCHEMA_VERSION,
      source_type: input.instrument.source_type,
      suppression_status: "SUPPRESSED_BELOW_THRESHOLD",
      scope: input.scope,
      study_ref: studyRef,
      transfer_state: "ATTEMPTED_APPLICATION",
      visibility: "teacher_admin_only",
      window_ref: windowRef
    };
    return {
      analysis_plan: analysisPlan,
      instrument,
      receipt: {
        created_at: this.now(),
        formal_transfer_claim_write: false,
        known_limits: [...KNOWN_LIMITS],
        runtime_authority: D6_RUNTIME_AUTHORITY,
        schema_version: D6_TRANSFER_SCHEMA_VERSION,
        status,
        study_ref: studyRef
      },
      study,
      synthetic_preview: candidate
    };
  }

  private audit(
    actor: TransferResearchDesignActor,
    action: TransferResearchAuditAction,
    study: TransferStudyDefinitionVersion
  ) {
    return {
      action,
      actor_id: actor.actor_id,
      audit_id: `${action.toLowerCase()}_${study.study_ref.resource_id}`,
      created_at: this.now(),
      request_digest: digest({ action, actor_id: actor.actor_id, study_ref: study.study_ref }),
      study_ref: study.study_ref,
      tenant_id: actor.tenant_id
    };
  }
}
