import { createHash } from "node:crypto";
import {
  DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES,
  DEFAULT_STUDENT_ROLE_TEMPLATES,
  type Decision,
  type DecisionAdmissionPolicy,
  type DecisionMergeCommit,
  type DecisionPayload,
  type DecisionPayloadFieldPath,
  type RoleContext,
  type RoleDecisionSection,
  type RoleId,
  type RoleWorkflowEvent,
  type StudentRoleAssignment,
  type StudentDecisionTraceDTO,
  type StudentDecisionTraceStage,
  type StudentDecisionTraceStageKey,
  type StudentRoleWorkflowMergeDTO,
  type StudentRoleWorkflowWorkspaceDTO,
  type TeacherRoleWorkflowWorkspaceDTO,
  type TeamConfirmation
} from "@simwar/shared-contracts";
import type {
  ResolutionAcknowledgement,
  ResolutionAcknowledgementSafeDTO,
  TeamDivergenceCandidate,
  TeamDivergenceRow,
  TeamDivergenceSet,
  TeamDivergenceValue,
  TeamResolution,
  TeamResolutionSafeDTO,
  TeacherDivergenceSummary
} from "@simwar/shared-contracts";
import type {
  RoleWorkflowRepositoryPort,
  RoleWorkflowRepositoryQuery,
  RoleWorkflowRepositorySnapshot
} from "./repository-ports.js";

export type RoleWorkflowActorRole = "student" | "teacher";

export interface RoleWorkflowActor {
  actor_id: string;
  actor_role: RoleWorkflowActorRole;
  tenant_id: string;
}

export interface RoleWorkflowDependencies {
  createId?: (kind: string) => string;
  now?: () => string;
  resolveW027DecisionPolicy?: (
    input: RoundWorkflowScope & { tenant_id: string; course_id?: string },
    roleKey: string
  ) => Promise<
    | {
        can_merge_team_decision: boolean;
        can_propose_resolution: boolean;
        can_confirm_team_decision: boolean;
      }
    | undefined
  >;
}

export class RoleWorkflowError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "RoleWorkflowError";
  }
}

interface WorkflowScope {
  run_id: string;
  team_id: string;
}

interface RoundWorkflowScope extends WorkflowScope {
  round_id: string;
}

interface AssignRoleInput extends WorkflowScope {
  course_id: string;
  role_key: RoleId;
  user_id: string;
}

interface SaveSectionInput extends RoundWorkflowScope {
  expected_version: number;
  payload: Partial<DecisionPayload>;
}

interface MarkSectionReadyInput extends RoundWorkflowScope {
  expected_version: number;
}

interface ConfirmTeamDecisionInput extends RoundWorkflowScope {
  merge_commit_id: string;
}

export interface TeamResolutionInput extends RoundWorkflowScope {
  source_section_ids: string[];
  source_digest: string;
  selected_values: Partial<Record<DecisionPayloadFieldPath, TeamDivergenceValue>>;
}

export interface ResolutionAcknowledgementInput extends RoundWorkflowScope {
  resolution_id: string;
  status: "ACKNOWLEDGED" | "DISSENT_PRESERVED";
  dissent_note?: string;
}

const LEGACY_ROLE_MERGE_ORDER: RoleId[] = ["CEO", "CFO", "CMO", "COO"];
const W027_ROLE_MERGE_ORDER: RoleId[] = ["CEO", "CFO", "CMO", "COO", "CHRO"];

function normalizeTeamRoleKey(roleKey: string): RoleId | undefined {
  if (roleKey === "risk" || roleKey === "Quality & Risk") return "COO";
  return W027_ROLE_MERGE_ORDER.includes(roleKey as RoleId) ? (roleKey as RoleId) : undefined;
}

function roleMergeOrderForRoleKeys(roleKeys: readonly string[]): RoleId[] {
  const normalized = roleKeys
    .map(normalizeTeamRoleKey)
    .filter((roleKey): roleKey is RoleId => roleKey !== undefined);
  return normalized.includes("CHRO") ? W027_ROLE_MERGE_ORDER : LEGACY_ROLE_MERGE_ORDER;
}

function roleMergeOrderForSnapshot(snapshot: RoleWorkflowRepositorySnapshot): RoleId[] {
  return roleMergeOrderForRoleKeys([
    ...(snapshot.team?.members ?? []).map((member) => member.role_slot),
    ...snapshot.assignments.map((assignment) => assignment.role_key)
  ]);
}

const DIVERGENCE_FIELDS: DecisionPayloadFieldPath[] = [
  "pricing.base_price",
  "marketing_budget",
  "service_quality_budget",
  "capacity_plan",
  "cash_buffer_target",
  "strategy_statement"
];

const DIVERGENCE_KNOWN_LIMITS = [
  "READY_SECTIONS_ONLY",
  "TEAM_SCOPED_ONLY",
  "OBSERVED_CANDIDATE_VALUES_ONLY",
  "PRIVATE_JUDGMENT_NOT_SEPARATELY_MODELED",
  "PRESERVED_DISSENT_IS_PROCESS_EVIDENCE",
  "OUTCOME_TRUTH_EXCLUDED",
  "SETTLEMENT_AND_REPLAY_EXCLUDED"
] as const;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function digest(value: unknown): string {
  return createHash("sha256").update(stableSerialize(value), "utf8").digest("hex");
}

function fieldValue(
  section: RoleDecisionSection,
  field: DecisionPayloadFieldPath
): TeamDivergenceValue | undefined {
  if (field === "pricing.base_price") return section.payload.pricing?.base_price;
  return section.payload[field as Exclude<DecisionPayloadFieldPath, "pricing.base_price">];
}

function sameValue(left: TeamDivergenceValue, right: TeamDivergenceValue): boolean {
  return left === right;
}

function toSafeResolution(resolution: TeamResolution): TeamResolutionSafeDTO {
  const safe = clone(resolution) as TeamResolutionSafeDTO & { proposed_by?: string };
  delete safe.proposed_by;
  return safe;
}

function toSafeAcknowledgement(
  acknowledgement: ResolutionAcknowledgement
): ResolutionAcknowledgementSafeDTO {
  const safe = clone(acknowledgement) as ResolutionAcknowledgementSafeDTO & {
    acknowledged_by?: string;
  };
  delete safe.acknowledged_by;
  return safe;
}

function payloadFieldPaths(payload: Partial<DecisionPayload>): DecisionPayloadFieldPath[] {
  const fields: DecisionPayloadFieldPath[] = [];
  if (payload.pricing !== undefined) fields.push("pricing.base_price");
  if (payload.marketing_budget !== undefined) fields.push("marketing_budget");
  if (payload.service_quality_budget !== undefined) fields.push("service_quality_budget");
  if (payload.capacity_plan !== undefined) fields.push("capacity_plan");
  if (payload.cash_buffer_target !== undefined) fields.push("cash_buffer_target");
  if (payload.strategy_statement !== undefined) fields.push("strategy_statement");
  return fields;
}

function sameStrings(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    [...left].sort().every((value, index) => value === [...right].sort()[index])
  );
}

function toStudentMergeDto(mergeCommit: DecisionMergeCommit): StudentRoleWorkflowMergeDTO {
  return {
    created_at: mergeCommit.created_at,
    merge_commit_id: mergeCommit.merge_commit_id,
    status: mergeCommit.status
  };
}

const STUDENT_DECISION_TRACE_KNOWN_LIMITS = [
  "PRIVATE_JUDGMENT_NOT_SEPARATELY_MODELED",
  "ROLE_POSITION_NOT_SEPARATELY_MODELED",
  "OTHER_ROLE_PAYLOADS_EXCLUDED",
  "OTHER_ROLE_ACTOR_IDENTIFIERS_EXCLUDED",
  "OUTCOME_TRUTH_EXCLUDED",
  "LEARNING_EVIDENCE_EXCLUDED"
] as const;

const STUDENT_DECISION_TRACE_STAGE_ORDER: Record<StudentDecisionTraceStageKey, number> = {
  ROLE_ASSIGNED: 0,
  ROLE_CONTRIBUTION_DRAFTED: 1,
  ROLE_CONTRIBUTION_READY: 2,
  DIVERGENCE_REVEALED: 3,
  RESOLUTION_PROPOSED: 4,
  RESOLUTION_ACKNOWLEDGED: 5,
  DISSENT_PRESERVED: 5,
  TEAM_MERGE_MILESTONE: 6,
  TEAM_CONFIRMED: 7,
  CANONICAL_DECISION_MILESTONE: 8
};

function createStudentTraceStage(
  stage_key: StudentDecisionTraceStageKey,
  occurred_at: string,
  safe_evidence_reference: string,
  safe_label: string
): StudentDecisionTraceStage {
  return {
    occurred_at,
    safe_evidence_reference,
    safe_label,
    stage_key,
    status: "completed"
  };
}

function sortStudentTraceStages(stages: StudentDecisionTraceStage[]): StudentDecisionTraceStage[] {
  return stages.slice().sort((left, right) => {
    const stageOrder =
      STUDENT_DECISION_TRACE_STAGE_ORDER[left.stage_key] -
      STUDENT_DECISION_TRACE_STAGE_ORDER[right.stage_key];
    if (stageOrder !== 0) return stageOrder;
    return left.occurred_at.localeCompare(right.occurred_at);
  });
}

function buildMergedPayload(
  sections: RoleDecisionSection[],
  selectedValues: Partial<Record<DecisionPayloadFieldPath, TeamDivergenceValue>> = {}
): DecisionPayload {
  const merged: Partial<DecisionPayload> = {};
  const w4Actions = sections
    .map((section) => section.payload.w4_strategic_action)
    .filter(
      (action): action is NonNullable<DecisionPayload["w4_strategic_action"]> =>
        action !== undefined
    );
  if (w4Actions.length > 1) {
    const firstAction = stableSerialize(w4Actions[0]);
    if (w4Actions.some((action) => stableSerialize(action) !== firstAction)) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_MERGE_CONFLICT");
    }
  }
  if (w4Actions[0] !== undefined) merged.w4_strategic_action = clone(w4Actions[0]);

  const assign = (
    field: DecisionPayloadFieldPath,
    value: DecisionPayload[keyof DecisionPayload] | number | string
  ) => {
    const existing =
      field === "pricing.base_price"
        ? merged.pricing?.base_price
        : merged[field as Exclude<DecisionPayloadFieldPath, "pricing.base_price">];
    if (existing !== undefined && existing !== value && selectedValues[field] === undefined) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_MERGE_CONFLICT");
    }
    if (field === "pricing.base_price") {
      merged.pricing = { base_price: value as number };
    } else {
      Object.assign(merged, { [field]: value });
    }
  };

  for (const roleKey of roleMergeOrderForRoleKeys(sections.map((section) => section.role_key))) {
    const section = sections.find((candidate) => candidate.role_key === roleKey);
    if (!section) continue;
    const payload = section.payload;
    if (payload.pricing !== undefined) assign("pricing.base_price", payload.pricing.base_price);
    if (payload.marketing_budget !== undefined) {
      assign("marketing_budget", payload.marketing_budget);
    }
    if (payload.service_quality_budget !== undefined) {
      assign("service_quality_budget", payload.service_quality_budget);
    }
    if (payload.capacity_plan !== undefined) assign("capacity_plan", payload.capacity_plan);
    if (payload.cash_buffer_target !== undefined) {
      assign("cash_buffer_target", payload.cash_buffer_target);
    }
    if (payload.strategy_statement !== undefined) {
      assign("strategy_statement", payload.strategy_statement);
    }
  }

  for (const [field, value] of Object.entries(selectedValues) as Array<
    [DecisionPayloadFieldPath, TeamDivergenceValue]
  >) {
    if (field === "pricing.base_price") merged.pricing = { base_price: value as number };
    else Object.assign(merged, { [field]: value });
  }

  if (
    merged.pricing === undefined ||
    merged.marketing_budget === undefined ||
    merged.service_quality_budget === undefined ||
    merged.capacity_plan === undefined ||
    merged.cash_buffer_target === undefined ||
    merged.strategy_statement === undefined
  ) {
    throw new RoleWorkflowError("ROLE_WORKFLOW_MERGED_PAYLOAD_INCOMPLETE");
  }
  return merged as DecisionPayload;
}

export class RoleWorkflowCommandService {
  private readonly createId: (kind: string) => string;
  private readonly now: () => string;
  private readonly dependencies: RoleWorkflowDependencies;
  private readonly mergeLocks = new Map<string, Promise<void>>();

  constructor(
    private readonly repository: RoleWorkflowRepositoryPort,
    dependencies: RoleWorkflowDependencies = {}
  ) {
    this.dependencies = dependencies;
    this.createId =
      dependencies.createId ??
      ((kind) => `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
    this.now = dependencies.now ?? (() => new Date().toISOString());
  }

  async assignRole(
    actor: RoleWorkflowActor,
    input: AssignRoleInput
  ): Promise<StudentRoleAssignment> {
    this.requireTeacher(actor);
    const snapshot = await this.read(actor, input);
    this.assertScope(snapshot, input.course_id);
    const normalizedInputRole = normalizeTeamRoleKey(input.role_key);
    const member = snapshot.team!.members.find((candidate) => candidate.user_id === input.user_id);
    if (
      !normalizedInputRole ||
      !member ||
      normalizeTeamRoleKey(member.role_slot) !== normalizedInputRole
    ) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_MEMBER_ROLE_INVALID");
    }
    const template = DEFAULT_STUDENT_ROLE_TEMPLATES.find(
      (candidate) => candidate.role_key === normalizedInputRole
    );
    if (!template) throw new RoleWorkflowError("ROLE_WORKFLOW_TEMPLATE_NOT_FOUND");
    if (
      snapshot.assignments.some(
        (assignment) =>
          assignment.status === "active" &&
          (assignment.user_id === input.user_id || assignment.role_key === input.role_key)
      )
    ) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_ASSIGNMENT_EXISTS");
    }
    this.assertTeamWorkflowViable(snapshot);

    const assignment: StudentRoleAssignment = {
      assignment_id: this.createId("role_assignment"),
      assigned_at: this.now(),
      assigned_by: actor.actor_id,
      course_id: input.course_id,
      role_key: normalizedInputRole,
      role_template_id: template.role_template_id,
      run_id: input.run_id,
      source: "teacher_assigned",
      status: "active",
      team_id: input.team_id,
      tenant_id: actor.tenant_id,
      user_id: input.user_id
    };
    await this.repository.commitRoleWorkflow({
      assignment,
      event: this.createEvent(actor, input, "role_assigned", assignment.assignment_id),
      kind: "append_assignment"
    });
    return clone(assignment);
  }

  async getStudentWorkspace(
    actor: RoleWorkflowActor,
    input: RoundWorkflowScope
  ): Promise<StudentRoleWorkflowWorkspaceDTO> {
    this.requireStudent(actor);
    const snapshot = await this.read(actor, input);
    this.assertRoundScope(snapshot);
    const assignment = this.findActorAssignment(actor, snapshot);
    const permissions = DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES[assignment.role_key];
    const section = this.latestSection(snapshot, assignment);
    const mergeCommit = this.currentMergeCommit(snapshot);
    const divergenceSet = this.buildDivergenceSet(snapshot, input);
    const resolution = divergenceSet ? this.currentResolution(snapshot, divergenceSet) : undefined;
    const acknowledgements = resolution ? this.currentAcknowledgements(snapshot, resolution) : [];
    const confirmation = mergeCommit
      ? snapshot.confirmations.find(
          (candidate) => candidate.merge_commit_id === mergeCommit.merge_commit_id
        )
      : undefined;
    const context: RoleContext = {
      assignment_id: assignment.assignment_id,
      course_id: assignment.course_id,
      expires_at: new Date(new Date(this.now()).getTime() + 8 * 60 * 60 * 1000).toISOString(),
      permissions: clone(permissions),
      role_context_id: `role_context_${assignment.assignment_id}_${snapshot.round!.round_id}`,
      role_key: assignment.role_key,
      role_template_id: assignment.role_template_id,
      round_id: snapshot.round!.round_id,
      round_no: snapshot.round!.round_no,
      run_id: input.run_id,
      source: "resolved_from_assignment",
      team_id: input.team_id,
      tenant_id: actor.tenant_id,
      user_id: actor.actor_id
    };

    return {
      assignment: {
        assignment_id: assignment.assignment_id,
        assigned_at: assignment.assigned_at,
        course_id: assignment.course_id,
        role_key: assignment.role_key,
        role_template_id: assignment.role_template_id,
        run_id: assignment.run_id,
        source: assignment.source,
        status: assignment.status,
        team_id: assignment.team_id,
        tenant_id: assignment.tenant_id,
        user_id: assignment.user_id
      },
      context,
      schema_version: "student-role-workflow-workspace.v1",
      ...(section ? { section: clone(section) } : {}),
      ...(divergenceSet ? { divergence_set: clone(divergenceSet) } : {}),
      ...(resolution ? { team_resolution: toSafeResolution(resolution) } : {}),
      ...(resolution
        ? {
            resolution_acknowledgements: acknowledgements.map(toSafeAcknowledgement)
          }
        : {}),
      ...(mergeCommit && permissions.can_submit_canonical_decision
        ? {
            merge_candidate: {
              created_at: mergeCommit.created_at,
              merge_commit_id: mergeCommit.merge_commit_id,
              status: mergeCommit.status
            }
          }
        : {}),
      ...(confirmation
        ? {
            confirmation: {
              confirmed_at: confirmation.confirmed_at,
              status: confirmation.status
            }
          }
        : {})
    };
  }

  async getTeacherWorkspace(
    actor: RoleWorkflowActor,
    input: RoundWorkflowScope
  ): Promise<TeacherRoleWorkflowWorkspaceDTO> {
    this.requireTeacher(actor);
    const snapshot = await this.read(actor, input);
    this.assertRoundScope(snapshot);
    const activeAssignments = snapshot.assignments.filter(
      (assignment) => assignment.status === "active"
    );
    const divergenceSet = this.buildDivergenceSet(snapshot, input);
    const resolution = divergenceSet ? this.currentResolution(snapshot, divergenceSet) : undefined;
    const acknowledgements = resolution ? this.currentAcknowledgements(snapshot, resolution) : [];
    const divergenceSummary: TeacherDivergenceSummary = divergenceSet
      ? {
          acknowledged_role_keys: acknowledgements.map((ack) => ack.role_key as RoleId),
          divergence_count: divergenceSet.divergences.length,
          required_role_keys: activeAssignments.map((assignment) => assignment.role_key),
          resolved_count: divergenceSet.divergences.filter(
            (divergence) => divergence.status === "RESOLVED"
          ).length,
          status:
            divergenceSet.divergences.length === 0
              ? "NONE"
              : resolution && this.hasAllAcknowledgements(snapshot, resolution)
                ? "ACKS_COMPLETE"
                : resolution
                  ? "RESOLUTION_PROPOSED"
                  : "OPEN"
        }
      : {
          acknowledged_role_keys: [],
          divergence_count: 0,
          required_role_keys: activeAssignments.map((assignment) => assignment.role_key),
          resolved_count: 0,
          status: "NOT_READY"
        };

    return {
      assignments: clone(activeAssignments),
      confirmations: clone(snapshot.confirmations),
      history: clone(snapshot.events),
      known_limits: ["JSON_INTERNAL_ONLY", "COMPENSATING_ATOMICITY_NOT_CRASH_SAFE"],
      merge_commits: clone(snapshot.merge_commits),
      round_id: input.round_id,
      run_id: input.run_id,
      schema_version: "teacher-role-workflow-workspace.v1",
      section_summaries: activeAssignments.map((assignment) => {
        const section = this.latestSection(snapshot, assignment);
        return {
          role_key: assignment.role_key,
          status: section?.status ?? "missing",
          version: section?.version ?? 0,
          ...(section ? { submitted_by: section.submitted_by, updated_at: section.updated_at } : {})
        };
      }),
      sections: clone(snapshot.sections),
      team_id: input.team_id,
      tenant_id: actor.tenant_id,
      divergence_summary: divergenceSummary
    };
  }

  async getStudentDecisionTrace(
    actor: RoleWorkflowActor,
    input: RoundWorkflowScope
  ): Promise<StudentDecisionTraceDTO> {
    this.requireStudent(actor);
    const snapshot = await this.read(actor, input);
    this.assertReadableRoundScope(snapshot, input);
    const assignment = this.findActorAssignment(actor, snapshot);
    const permissions = DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES[assignment.role_key];
    const traceStages: StudentDecisionTraceStage[] = [
      createStudentTraceStage(
        "ROLE_ASSIGNED",
        assignment.assigned_at,
        "role_assignment",
        "角色已分配"
      )
    ];

    const ownSections = snapshot.sections.filter(
      (section) =>
        section.tenant_id === actor.tenant_id &&
        section.run_id === input.run_id &&
        section.round_id === input.round_id &&
        section.team_id === input.team_id &&
        section.role_key === assignment.role_key &&
        section.submitted_by === actor.actor_id &&
        (!section.assignment_id || section.assignment_id === assignment.assignment_id)
    );
    const ownSectionIds = new Set(ownSections.map((section) => section.section_id));
    for (const event of snapshot.events) {
      if (!ownSectionIds.has(event.resource_id)) continue;
      if (event.event_type === "section_saved") {
        const section = ownSections.find((candidate) => candidate.section_id === event.resource_id);
        traceStages.push(
          createStudentTraceStage(
            "ROLE_CONTRIBUTION_DRAFTED",
            event.created_at,
            section ? `role_contribution_revision_${section.version}` : "role_contribution",
            "已记录角色贡献"
          )
        );
      }
      if (event.event_type === "section_ready") {
        const section = ownSections.find((candidate) => candidate.section_id === event.resource_id);
        traceStages.push(
          createStudentTraceStage(
            "ROLE_CONTRIBUTION_READY",
            event.created_at,
            section ? `role_contribution_revision_${section.version}` : "role_contribution",
            "角色贡献已就绪"
          )
        );
      }
    }

    const divergenceSet = this.buildDivergenceSet(snapshot, input);
    const resolution = divergenceSet ? this.currentResolution(snapshot, divergenceSet) : undefined;
    const acknowledgements = resolution ? this.currentAcknowledgements(snapshot, resolution) : [];
    if (
      permissions.visible_scopes.includes("team.merge_summary") &&
      divergenceSet?.divergences.length
    ) {
      traceStages.push(
        createStudentTraceStage(
          "DIVERGENCE_REVEALED",
          this.now(),
          "team_divergence",
          "团队存在待解决分歧"
        )
      );
      if (resolution) {
        traceStages.push(
          createStudentTraceStage(
            "RESOLUTION_PROPOSED",
            resolution.proposed_at,
            "team_resolution",
            "团队已提出解决方案"
          )
        );
      }
      const ownAcknowledgement = acknowledgements.find(
        (acknowledgement) => acknowledgement.role_key === assignment.role_key
      );
      if (ownAcknowledgement) {
        traceStages.push(
          createStudentTraceStage(
            ownAcknowledgement.status === "DISSENT_PRESERVED"
              ? "DISSENT_PRESERVED"
              : "RESOLUTION_ACKNOWLEDGED",
            ownAcknowledgement.acknowledged_at,
            ownAcknowledgement.status === "DISSENT_PRESERVED"
              ? "dissent_preserved"
              : "resolution_acknowledged",
            ownAcknowledgement.status === "DISSENT_PRESERVED"
              ? "已保留本角色异议"
              : "本角色已确认解决方案"
          )
        );
      }
    }

    if (permissions.visible_scopes.includes("team.merge_summary")) {
      for (const mergeCommit of snapshot.merge_commits.filter(
        (candidate) =>
          candidate.tenant_id === actor.tenant_id &&
          candidate.run_id === input.run_id &&
          candidate.round_id === input.round_id &&
          candidate.team_id === input.team_id
      )) {
        traceStages.push(
          createStudentTraceStage(
            "TEAM_MERGE_MILESTONE",
            mergeCommit.created_at,
            "team_merge",
            "团队合并已校验"
          )
        );
      }
    }

    const confirmations = snapshot.confirmations.filter(
      (candidate) =>
        candidate.tenant_id === actor.tenant_id &&
        candidate.run_id === input.run_id &&
        candidate.round_id === input.round_id &&
        candidate.team_id === input.team_id &&
        candidate.status === "confirmed"
    );
    for (const confirmation of confirmations) {
      traceStages.push(
        createStudentTraceStage(
          "TEAM_CONFIRMED",
          confirmation.confirmed_at,
          "team_confirmation",
          "团队已确认"
        )
      );
    }

    if (permissions.can_submit_canonical_decision) {
      for (const decision of snapshot.decisions.filter(
        (candidate) =>
          candidate.tenant_id === actor.tenant_id &&
          candidate.run_id === input.run_id &&
          candidate.round_id === input.round_id &&
          candidate.team_id === input.team_id &&
          candidate.status === "submitted" &&
          candidate.canonical_source === "role_merge_commit" &&
          candidate.team_confirmation_id !== undefined &&
          confirmations.some(
            (confirmation) => confirmation.team_confirmation_id === candidate.team_confirmation_id
          )
      )) {
        const confirmation = confirmations.find(
          (candidate) => candidate.team_confirmation_id === decision.team_confirmation_id
        );
        if (!confirmation) continue;
        traceStages.push(
          createStudentTraceStage(
            "CANONICAL_DECISION_MILESTONE",
            confirmation.confirmed_at,
            "canonical_decision",
            "正式决策已提交"
          )
        );
      }
    }

    const orderedStages = sortStudentTraceStages(traceStages);
    const currentStage = orderedStages.at(-1)?.stage_key ?? "NOT_STARTED";
    return {
      current_stage: currentStage,
      known_limits: [...STUDENT_DECISION_TRACE_KNOWN_LIMITS],
      role_key: assignment.role_key,
      round_id: input.round_id,
      round_no: snapshot.round!.round_no,
      run_id: input.run_id,
      schema_version: "student-decision-trace.v1",
      team_id: input.team_id,
      tenant_id: actor.tenant_id,
      trace_completeness: orderedStages.some(
        (stage) => stage.stage_key === "CANONICAL_DECISION_MILESTONE"
      )
        ? "complete"
        : orderedStages.length > 0
          ? "partial"
          : "empty",
      trace_stages: orderedStages
    };
  }

  async saveSection(
    actor: RoleWorkflowActor,
    input: SaveSectionInput
  ): Promise<RoleDecisionSection> {
    this.requireStudent(actor);
    const snapshot = await this.read(actor, input);
    this.assertRoundScope(snapshot);
    this.assertPostConfirmationMutable(snapshot);
    const assignment = this.findActorAssignment(actor, snapshot);
    const policy = DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES[assignment.role_key];
    if (input.payload.w4_strategic_action !== undefined && assignment.role_key !== "CEO") {
      throw new RoleWorkflowError("ROLE_WORKFLOW_W4_ACTION_OWNER_REQUIRED");
    }
    if (payloadFieldPaths(input.payload).some((field) => !policy.editable_fields.includes(field))) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_FIELD_DENIED");
    }
    const current = this.latestSection(snapshot, assignment);
    if ((current?.version ?? 0) !== input.expected_version) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_STALE_SECTION");
    }
    if (current?.status === "ready") {
      throw new RoleWorkflowError("ROLE_WORKFLOW_SECTION_ALREADY_READY");
    }
    const timestamp = this.now();
    const section: RoleDecisionSection = {
      assignment_id: assignment.assignment_id,
      payload: clone(input.payload),
      role_key: assignment.role_key,
      round_id: input.round_id,
      run_id: input.run_id,
      section_id: this.createId("role_section"),
      status: "draft",
      submitted_at: current?.submitted_at ?? timestamp,
      submitted_by: actor.actor_id,
      team_id: input.team_id,
      tenant_id: actor.tenant_id,
      updated_at: timestamp,
      version: (current?.version ?? 0) + 1
    };
    await this.repository.commitRoleWorkflow({
      event: this.createEvent(actor, input, "section_saved", section.section_id),
      kind: "append_section",
      section
    });
    return clone(section);
  }

  async markSectionReady(
    actor: RoleWorkflowActor,
    input: MarkSectionReadyInput
  ): Promise<RoleDecisionSection> {
    this.requireStudent(actor);
    const snapshot = await this.read(actor, input);
    this.assertRoundScope(snapshot);
    this.assertPostConfirmationMutable(snapshot);
    const assignment = this.findActorAssignment(actor, snapshot);
    const current = this.latestSection(snapshot, assignment);
    if (!current) throw new RoleWorkflowError("ROLE_WORKFLOW_SECTION_NOT_FOUND");
    if (current.version !== input.expected_version) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_STALE_SECTION");
    }
    if (current.status === "ready") return clone(current);
    const ready: RoleDecisionSection = {
      ...clone(current),
      section_id: this.createId("role_section"),
      status: "ready",
      updated_at: this.now(),
      version: current.version + 1
    };
    await this.repository.commitRoleWorkflow({
      event: this.createEvent(actor, input, "section_ready", ready.section_id),
      kind: "append_section",
      section: ready
    });
    return clone(ready);
  }

  async proposeTeamResolution(
    actor: RoleWorkflowActor,
    input: TeamResolutionInput
  ): Promise<TeamResolutionSafeDTO> {
    this.requireStudent(actor);
    const snapshot = await this.read(actor, input);
    this.assertRoundScope(snapshot);
    this.assertPostConfirmationMutable(snapshot);
    const assignment = this.findActorAssignment(actor, snapshot);
    const configuredPolicy = await this.dependencies.resolveW027DecisionPolicy?.(
      { ...input, course_id: snapshot.run?.course_id ?? "", tenant_id: actor.tenant_id },
      assignment.role_key
    );
    if (!configuredPolicy && snapshot.team!.captain_user_id !== actor.actor_id) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_CAPTAIN_REQUIRED");
    }
    if (
      !(
        configuredPolicy?.can_propose_resolution ??
        DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES[assignment.role_key].can_create_merge_commit
      )
    ) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_MERGE_DENIED");
    }
    const divergenceSet = this.buildDivergenceSet(snapshot, input);
    if (!divergenceSet) throw new RoleWorkflowError("ROLE_WORKFLOW_SECTIONS_NOT_READY");
    if (divergenceSet.divergences.length === 0) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_NO_DIVERGENCE");
    }
    this.assertResolutionSource(divergenceSet, input);

    const divergenceByField = new Map(
      divergenceSet.divergences.map((divergence) => [divergence.field, divergence])
    );
    const selectedEntries = Object.entries(input.selected_values) as Array<
      [DecisionPayloadFieldPath, TeamDivergenceValue]
    >;
    if (
      selectedEntries.length !== divergenceSet.divergences.length ||
      selectedEntries.some(([field, value]) => {
        const divergence = divergenceByField.get(field);
        return (
          !divergence ||
          !divergence.candidates.some((candidate) => sameValue(candidate.value, value))
        );
      })
    ) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_RESOLUTION_CANDIDATE_INVALID");
    }

    const existing = this.currentResolution(snapshot, divergenceSet);
    if (existing) {
      if (stableSerialize(existing.selected_values) === stableSerialize(input.selected_values)) {
        return toSafeResolution(existing);
      }
      throw new RoleWorkflowError("ROLE_WORKFLOW_RESOLUTION_EXISTS");
    }

    const resolution: TeamResolution = {
      proposed_at: this.now(),
      proposed_by: actor.actor_id,
      resolution_id: this.createId("team_resolution"),
      round_id: input.round_id,
      run_id: input.run_id,
      selected_values: clone(input.selected_values),
      source_digest: input.source_digest,
      source_section_ids: clone(input.source_section_ids),
      status: "PROPOSED",
      team_id: input.team_id,
      tenant_id: actor.tenant_id
    };
    await this.repository.commitRoleWorkflow({
      event: this.createEvent(actor, input, "resolution_proposed", resolution.resolution_id),
      kind: "append_resolution",
      resolution
    });
    return toSafeResolution(resolution);
  }

  async acknowledgeResolution(
    actor: RoleWorkflowActor,
    input: ResolutionAcknowledgementInput
  ): Promise<ResolutionAcknowledgementSafeDTO> {
    this.requireStudent(actor);
    const snapshot = await this.read(actor, input);
    this.assertRoundScope(snapshot);
    this.assertPostConfirmationMutable(snapshot);
    const assignment = this.findActorAssignment(actor, snapshot);
    const divergenceSet = this.buildDivergenceSet(snapshot, input);
    if (!divergenceSet) throw new RoleWorkflowError("ROLE_WORKFLOW_SECTIONS_NOT_READY");
    const resolution = snapshot.resolutions.find(
      (candidate) => candidate.resolution_id === input.resolution_id
    );
    if (!resolution) throw new RoleWorkflowError("ROLE_WORKFLOW_RESOLUTION_NOT_FOUND");
    this.assertResolutionSource(divergenceSet, resolution);
    if (input.status === "ACKNOWLEDGED" && input.dissent_note !== undefined) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_DISSENT_NOTE_INVALID");
    }
    if (
      input.dissent_note !== undefined &&
      (input.dissent_note !== input.dissent_note.trim() ||
        input.dissent_note.length === 0 ||
        input.dissent_note.length > 280 ||
        [...input.dissent_note].some((character) => {
          const code = character.charCodeAt(0);
          return code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31);
        }))
    ) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_DISSENT_NOTE_INVALID");
    }
    const existing = snapshot.acknowledgements.find(
      (candidate) =>
        candidate.resolution_id === resolution.resolution_id &&
        candidate.role_key === assignment.role_key
    );
    if (existing) {
      if (existing.status === input.status && existing.dissent_note === input.dissent_note) {
        return toSafeAcknowledgement(existing);
      }
      throw new RoleWorkflowError("ROLE_WORKFLOW_ACKNOWLEDGEMENT_EXISTS");
    }

    const acknowledgement: ResolutionAcknowledgement = {
      acknowledged_at: this.now(),
      acknowledged_by: actor.actor_id,
      acknowledgement_id: this.createId("resolution_acknowledgement"),
      ...(input.dissent_note !== undefined ? { dissent_note: input.dissent_note } : {}),
      resolution_id: resolution.resolution_id,
      role_key: assignment.role_key,
      round_id: input.round_id,
      run_id: input.run_id,
      status: input.status,
      team_id: input.team_id,
      tenant_id: actor.tenant_id
    };
    await this.repository.commitRoleWorkflow({
      acknowledgement,
      event: this.createEvent(
        actor,
        input,
        "resolution_acknowledged",
        acknowledgement.acknowledgement_id
      ),
      kind: "append_acknowledgement"
    });
    return toSafeAcknowledgement(acknowledgement);
  }

  async createMergeCommit(
    actor: RoleWorkflowActor,
    input: RoundWorkflowScope
  ): Promise<StudentRoleWorkflowMergeDTO> {
    const key = `${actor.tenant_id}:${input.run_id}:${input.team_id}:${input.round_id}`;
    return this.withWorkflowLock(key, () => this.createMergeCommitUnsafe(actor, input));
  }

  async getExistingMergeCommit(
    actor: RoleWorkflowActor,
    input: RoundWorkflowScope
  ): Promise<StudentRoleWorkflowMergeDTO | undefined> {
    const key = `${actor.tenant_id}:${input.run_id}:${input.team_id}:${input.round_id}`;
    return this.withWorkflowLock(key, () => this.getExistingMergeCommitUnsafe(actor, input));
  }

  private async getExistingMergeCommitUnsafe(
    actor: RoleWorkflowActor,
    input: RoundWorkflowScope
  ): Promise<StudentRoleWorkflowMergeDTO | undefined> {
    this.requireStudent(actor);
    const snapshot = await this.read(actor, input);
    this.assertRoundScope(snapshot);
    this.assertPostConfirmationMutable(snapshot);
    const assignment = this.findActorAssignment(actor, snapshot);
    const configuredPolicy = await this.dependencies.resolveW027DecisionPolicy?.(
      { ...input, course_id: snapshot.run?.course_id ?? "", tenant_id: actor.tenant_id },
      assignment.role_key
    );
    if (
      !(
        configuredPolicy?.can_merge_team_decision ??
        DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES[assignment.role_key].can_create_merge_commit
      )
    ) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_MERGE_DENIED");
    }
    if (!configuredPolicy && snapshot.team!.captain_user_id !== actor.actor_id) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_CAPTAIN_REQUIRED");
    }
    const activeAssignments = snapshot.assignments.filter(
      (candidate) => candidate.status === "active"
    );
    const mergeOrder = roleMergeOrderForSnapshot(snapshot);
    const currentSections = activeAssignments
      .map((candidate) => this.latestSection(snapshot, candidate))
      .sort(
        (left, right) =>
          mergeOrder.indexOf(left?.role_key as RoleId) -
          mergeOrder.indexOf(right?.role_key as RoleId)
      );
    if (currentSections.length === 0 || currentSections.some((section) => !section))
      return undefined;
    const sourceSectionIds = currentSections.map((section) => section!.section_id);
    const existing = snapshot.merge_commits.find((candidate) =>
      sameStrings(candidate.source_section_ids, sourceSectionIds)
    );
    return existing ? toStudentMergeDto(existing) : undefined;
  }

  private async createMergeCommitUnsafe(
    actor: RoleWorkflowActor,
    input: RoundWorkflowScope
  ): Promise<StudentRoleWorkflowMergeDTO> {
    const { snapshot, readySections, resolution, sourceSectionIds, existing } =
      await this.loadMergeCandidate(actor, input);
    if (existing) return toStudentMergeDto(existing);

    const mergeCommit: DecisionMergeCommit = {
      created_at: this.now(),
      created_by: actor.actor_id,
      merge_commit_id: this.createId("merge_commit"),
      merged_payload: buildMergedPayload(
        readySections as RoleDecisionSection[],
        resolution?.selected_values
      ),
      round_id: input.round_id,
      run_id: input.run_id,
      source_section_ids: sourceSectionIds,
      status: "validated",
      team_id: input.team_id,
      tenant_id: actor.tenant_id
    };
    await this.repository.commitRoleWorkflow({
      event: this.createEvent(actor, input, "merge_created", mergeCommit.merge_commit_id),
      kind: "append_merge",
      merge_commit: mergeCommit
    });
    return toStudentMergeDto(mergeCommit);
  }

  private async loadMergeCandidate(
    actor: RoleWorkflowActor,
    input: RoundWorkflowScope
  ): Promise<{
    snapshot: RoleWorkflowRepositorySnapshot;
    readySections: Array<RoleDecisionSection | undefined>;
    resolution?: TeamResolution;
    sourceSectionIds: string[];
    existing?: DecisionMergeCommit;
  }> {
    this.requireStudent(actor);
    const snapshot = await this.read(actor, input);
    this.assertRoundScope(snapshot);
    this.assertPostConfirmationMutable(snapshot);
    const assignment = this.findActorAssignment(actor, snapshot);
    const configuredPolicy = await this.dependencies.resolveW027DecisionPolicy?.(
      { ...input, course_id: snapshot.run?.course_id ?? "", tenant_id: actor.tenant_id },
      assignment.role_key
    );
    if (
      !(
        configuredPolicy?.can_merge_team_decision ??
        DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES[assignment.role_key].can_create_merge_commit
      )
    ) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_MERGE_DENIED");
    }
    if (!configuredPolicy && snapshot.team!.captain_user_id !== actor.actor_id) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_CAPTAIN_REQUIRED");
    }
    const activeAssignments = snapshot.assignments.filter(
      (candidate) => candidate.status === "active"
    );
    const mergeOrder = roleMergeOrderForSnapshot(snapshot);
    const readySections = activeAssignments
      .map((candidate) => this.latestSection(snapshot, candidate))
      .sort(
        (left, right) =>
          mergeOrder.indexOf(left?.role_key as RoleId) -
          mergeOrder.indexOf(right?.role_key as RoleId)
      );
    if (
      readySections.some((section) => !section || section.status !== "ready") ||
      readySections.length === 0
    ) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_SECTIONS_NOT_READY");
    }
    const divergenceSet = this.buildDivergenceSet(snapshot, input);
    const resolution = divergenceSet ? this.currentResolution(snapshot, divergenceSet) : undefined;
    if (divergenceSet?.divergences.length) {
      if (!resolution) throw new RoleWorkflowError("ROLE_WORKFLOW_DIVERGENCE_UNRESOLVED");
      this.assertResolutionSource(divergenceSet, resolution);
      if (!this.hasAllAcknowledgements(snapshot, resolution)) {
        throw new RoleWorkflowError("ROLE_WORKFLOW_ACKNOWLEDGEMENTS_INCOMPLETE");
      }
    }
    const sourceSectionIds = readySections.map((section) => section!.section_id);
    const existing = snapshot.merge_commits.find((candidate) =>
      sameStrings(candidate.source_section_ids, sourceSectionIds)
    );
    return { existing, readySections, resolution, snapshot, sourceSectionIds };
  }

  async confirmTeamDecision(
    actor: RoleWorkflowActor,
    input: ConfirmTeamDecisionInput
  ): Promise<TeamConfirmation> {
    const key = `${actor.tenant_id}:${input.run_id}:${input.team_id}:${input.round_id}`;
    return this.withWorkflowLock(key, () => this.confirmTeamDecisionUnsafe(actor, input));
  }

  async getExistingTeamConfirmation(
    actor: RoleWorkflowActor,
    input: ConfirmTeamDecisionInput
  ): Promise<TeamConfirmation | undefined> {
    const key = `${actor.tenant_id}:${input.run_id}:${input.team_id}:${input.round_id}`;
    return this.withWorkflowLock(key, async () => {
      const { existing } = await this.loadConfirmableTeamDecision(actor, input);
      return existing ? clone(existing) : undefined;
    });
  }

  private async confirmTeamDecisionUnsafe(
    actor: RoleWorkflowActor,
    input: ConfirmTeamDecisionInput
  ): Promise<TeamConfirmation> {
    const { existing, mergeCommit, snapshot } = await this.loadConfirmableTeamDecision(
      actor,
      input
    );
    if (existing) return clone(existing);
    this.assertPostConfirmationMutable(snapshot);

    const confirmation: TeamConfirmation = {
      confirmed_at: this.now(),
      confirmed_by: actor.actor_id,
      merge_commit_id: mergeCommit.merge_commit_id,
      round_id: input.round_id,
      run_id: input.run_id,
      status: "confirmed",
      team_confirmation_id: this.createId("team_confirmation"),
      team_id: input.team_id,
      tenant_id: actor.tenant_id
    };
    const decision: Decision = {
      canonical_source: "role_merge_commit",
      decision_id: this.createId("decision"),
      merge_commit_id: mergeCommit.merge_commit_id,
      payload: clone(mergeCommit.merged_payload),
      round_id: input.round_id,
      round_no: snapshot.round!.round_no,
      run_id: input.run_id,
      status: "submitted",
      submitted_by: actor.actor_id,
      team_confirmation_id: confirmation.team_confirmation_id,
      team_id: input.team_id,
      tenant_id: actor.tenant_id,
      validation_report: [],
      version:
        Math.max(
          0,
          ...snapshot.decisions
            .filter((candidate) => candidate.team_id === input.team_id)
            .map((candidate) => candidate.version)
        ) + 1
    };
    await this.repository.commitRoleWorkflow({
      confirmation,
      decision,
      event: this.createEvent(actor, input, "team_confirmed", confirmation.team_confirmation_id),
      kind: "append_confirmation"
    });
    return clone(confirmation);
  }

  private async loadConfirmableTeamDecision(
    actor: RoleWorkflowActor,
    input: ConfirmTeamDecisionInput
  ): Promise<{
    existing: TeamConfirmation | undefined;
    mergeCommit: DecisionMergeCommit;
    snapshot: RoleWorkflowRepositorySnapshot;
  }> {
    this.requireStudent(actor);
    const snapshot = await this.read(actor, input);
    this.assertRoundScope(snapshot);
    const assignment = this.findActorAssignment(actor, snapshot);
    const policy = DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES[assignment.role_key];
    const configuredPolicy = await this.dependencies.resolveW027DecisionPolicy?.(
      { ...input, course_id: snapshot.run?.course_id ?? "", tenant_id: actor.tenant_id },
      assignment.role_key
    );
    if (
      !(configuredPolicy?.can_confirm_team_decision ?? policy.can_submit_canonical_decision) ||
      (!configuredPolicy &&
        (assignment.role_key !== "CEO" || snapshot.team!.captain_user_id !== actor.actor_id))
    ) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_CONFIRMATION_DENIED");
    }
    const mergeCommit = snapshot.merge_commits.find(
      (candidate) => candidate.merge_commit_id === input.merge_commit_id
    );
    if (!mergeCommit) throw new RoleWorkflowError("ROLE_WORKFLOW_MERGE_NOT_FOUND");
    this.assertCurrentMergeGeneration(snapshot, mergeCommit);
    const existing = snapshot.confirmations.find(
      (candidate) => candidate.merge_commit_id === input.merge_commit_id
    );
    return { existing, mergeCommit, snapshot };
  }

  async assertDirectDecisionSubmissionAllowed(
    actor: RoleWorkflowActor,
    input: RoundWorkflowScope,
    decisionAdmissionPolicy?: DecisionAdmissionPolicy
  ): Promise<void> {
    this.requireStudent(actor);
    const snapshot = await this.read(actor, input);
    this.assertRoundScope(snapshot);
    if (decisionAdmissionPolicy === undefined) {
      throw new RoleWorkflowError("DECISION_ADMISSION_POLICY_REQUIRED");
    }
    if (decisionAdmissionPolicy !== "LEGACY_DIRECT_EXPLICIT") {
      throw new RoleWorkflowError("ROLE_WORKFLOW_DIRECT_DECISION_DISABLED");
    }
    if (
      snapshot.assignments.length > 0 ||
      snapshot.confirmations.length > 0 ||
      snapshot.events.length > 0
    ) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_DIRECT_DECISION_DISABLED");
    }
  }

  async resetWorkflow(
    actor: RoleWorkflowActor,
    input: RoundWorkflowScope
  ): Promise<{ deactivated_assignments: number }> {
    this.requireTeacher(actor);
    const snapshot = await this.read(actor, input);
    this.assertRoundScope(snapshot);
    if (snapshot.confirmations.length > 0) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_CONFIRMED_IMMUTABLE");
    }
    const activeIds = snapshot.assignments
      .filter((assignment) => assignment.status === "active")
      .map((assignment) => assignment.assignment_id);
    await this.repository.commitRoleWorkflow({
      assignment_ids: activeIds,
      event: this.createEvent(actor, input, "workflow_reset", this.createId("workflow_reset")),
      kind: "reset"
    });
    return { deactivated_assignments: activeIds.length };
  }

  private read(
    actor: RoleWorkflowActor,
    input: WorkflowScope & { round_id?: string }
  ): Promise<RoleWorkflowRepositorySnapshot> {
    const query: RoleWorkflowRepositoryQuery = {
      run_id: input.run_id,
      team_id: input.team_id,
      tenant_id: actor.tenant_id,
      ...(input.round_id ? { round_id: input.round_id } : {})
    };
    return this.repository.readRoleWorkflow(query);
  }

  private buildDivergenceSet(
    snapshot: RoleWorkflowRepositorySnapshot,
    input: RoundWorkflowScope
  ): TeamDivergenceSet | undefined {
    const activeAssignments = snapshot.assignments.filter(
      (assignment) => assignment.status === "active"
    );
    if (activeAssignments.length === 0) return undefined;
    const readySections = activeAssignments.map((assignment) =>
      this.latestSection(snapshot, assignment)
    );
    if (
      readySections.length !== activeAssignments.length ||
      readySections.some(
        (section) =>
          !section ||
          section.status !== "ready" ||
          section.tenant_id !== snapshot.run?.tenant_id ||
          section.run_id !== input.run_id ||
          section.round_id !== input.round_id ||
          section.team_id !== input.team_id
      )
    ) {
      return undefined;
    }

    const orderedSections = readySections
      .filter((section): section is RoleDecisionSection => section !== undefined)
      .sort(
        (left, right) =>
          roleMergeOrderForSnapshot(snapshot).indexOf(left.role_key as RoleId) -
          roleMergeOrderForSnapshot(snapshot).indexOf(right.role_key as RoleId)
      );
    const sourceSectionIds = orderedSections.map((section) => section.section_id);
    const sourceDigest = digest(
      orderedSections.map((section) => ({
        payload: section.payload,
        role_key: section.role_key,
        section_id: section.section_id,
        status: section.status,
        team_id: section.team_id,
        tenant_id: section.tenant_id,
        version: section.version
      }))
    );
    const divergences: TeamDivergenceRow[] = [];
    for (const field of DIVERGENCE_FIELDS) {
      const candidates: TeamDivergenceCandidate[] = [];
      for (const section of orderedSections) {
        const value = fieldValue(section, field);
        if (value === undefined) continue;
        if (!candidates.some((candidate) => sameValue(candidate.value, value))) {
          candidates.push({
            role_key: section.role_key as RoleId,
            source_section_id: section.section_id,
            value
          });
        }
      }
      if (candidates.length > 1) {
        divergences.push({
          candidates,
          divergence_id: `divergence_${field.replace(".", "_")}`,
          field,
          status: "OPEN"
        });
      }
    }

    const base: TeamDivergenceSet = {
      divergences,
      known_limits: [...DIVERGENCE_KNOWN_LIMITS],
      round_id: input.round_id,
      run_id: input.run_id,
      schema_version: "team-divergence-set.v1",
      source_digest: sourceDigest,
      source_section_ids: sourceSectionIds,
      status: divergences.length === 0 ? "NONE" : "OPEN",
      team_id: input.team_id,
      tenant_id: snapshot.run?.tenant_id ?? ""
    };
    const resolution = this.currentResolution(snapshot, base);
    if (!resolution) return base;
    return {
      ...base,
      divergences: base.divergences.map((divergence) => ({ ...divergence, status: "RESOLVED" })),
      status: "RESOLVED"
    };
  }

  private currentResolution(
    snapshot: RoleWorkflowRepositorySnapshot,
    divergenceSet: Pick<TeamDivergenceSet, "source_digest" | "source_section_ids">
  ): TeamResolution | undefined {
    return snapshot.resolutions
      .filter(
        (resolution) =>
          resolution.source_digest === divergenceSet.source_digest &&
          sameStrings(resolution.source_section_ids, divergenceSet.source_section_ids)
      )
      .at(-1);
  }

  private currentAcknowledgements(
    snapshot: RoleWorkflowRepositorySnapshot,
    resolution: TeamResolution
  ): ResolutionAcknowledgement[] {
    return snapshot.acknowledgements
      .filter((acknowledgement) => acknowledgement.resolution_id === resolution.resolution_id)
      .sort(
        (left, right) =>
          roleMergeOrderForSnapshot(snapshot).indexOf(left.role_key as RoleId) -
          roleMergeOrderForSnapshot(snapshot).indexOf(right.role_key as RoleId)
      );
  }

  private hasAllAcknowledgements(
    snapshot: RoleWorkflowRepositorySnapshot,
    resolution: TeamResolution
  ): boolean {
    const requiredRoles = snapshot.assignments
      .filter((assignment) => assignment.status === "active")
      .map((assignment) => assignment.role_key);
    const acknowledgedRoles = new Set(
      this.currentAcknowledgements(snapshot, resolution).map(
        (acknowledgement) => acknowledgement.role_key
      )
    );
    return (
      requiredRoles.length > 0 && requiredRoles.every((roleKey) => acknowledgedRoles.has(roleKey))
    );
  }

  private assertResolutionSource(
    divergenceSet: Pick<TeamDivergenceSet, "source_digest" | "source_section_ids">,
    source: Pick<TeamResolutionInput, "source_digest" | "source_section_ids">
  ): void {
    if (
      divergenceSet.source_digest !== source.source_digest ||
      !sameStrings(divergenceSet.source_section_ids, source.source_section_ids)
    ) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_RESOLUTION_STALE");
    }
  }

  private assertPostConfirmationMutable(snapshot: RoleWorkflowRepositorySnapshot): void {
    if (snapshot.confirmations.some((confirmation) => confirmation.status === "confirmed")) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_CONFIRMED_IMMUTABLE");
    }
  }

  private async withWorkflowLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.mergeLocks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.mergeLocks.set(key, current);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.mergeLocks.get(key) === current) this.mergeLocks.delete(key);
    }
  }

  private assertScope(snapshot: RoleWorkflowRepositorySnapshot, courseId?: string): void {
    if (!snapshot.run || !snapshot.team || !snapshot.course) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_TENANT_DENIED");
    }
    if (
      snapshot.run.course_id !== snapshot.team.course_id ||
      snapshot.run.course_id !== snapshot.course.course_id ||
      (courseId !== undefined && snapshot.course.course_id !== courseId)
    ) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_SCOPE_INVALID");
    }
  }

  private assertRoundScope(snapshot: RoleWorkflowRepositorySnapshot): void {
    this.assertScope(snapshot);
    if (!snapshot.round || snapshot.round.status !== "open") {
      throw new RoleWorkflowError("ROLE_WORKFLOW_ROUND_NOT_OPEN");
    }
  }

  private assertReadableRoundScope(
    snapshot: RoleWorkflowRepositorySnapshot,
    input: RoundWorkflowScope
  ): void {
    this.assertScope(snapshot);
    if (!snapshot.round) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_ROUND_NOT_FOUND");
    }
    if (
      snapshot.round.tenant_id !== snapshot.run?.tenant_id ||
      snapshot.round.run_id !== input.run_id ||
      snapshot.round.round_id !== input.round_id
    ) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_SCOPE_INVALID");
    }
    if (!["open", "locked", "settled", "published"].includes(snapshot.round.status)) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_ROUND_NOT_OPEN");
    }
  }

  private assertTeamWorkflowViable(snapshot: RoleWorkflowRepositorySnapshot): void {
    const team = snapshot.team!;
    const requiredRoleKeys = roleMergeOrderForRoleKeys(
      team.members.map((member) => member.role_slot)
    );
    const requiredMembers = requiredRoleKeys.map((roleKey) =>
      team.members.filter((member) => normalizeTeamRoleKey(member.role_slot) === roleKey)
    );
    const ownerIds = requiredMembers.flatMap((members) => members.map((member) => member.user_id));
    const ceo = requiredMembers[0]?.[0];
    if (
      requiredMembers.some((members) => members.length !== 1) ||
      new Set(ownerIds).size !== requiredRoleKeys.length ||
      !ceo ||
      team.captain_user_id !== ceo.user_id
    ) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_TEAM_INCOMPLETE");
    }
  }

  private createEvent(
    actor: RoleWorkflowActor,
    input: WorkflowScope & { round_id?: string },
    eventType: RoleWorkflowEvent["event_type"],
    resourceId: string
  ): RoleWorkflowEvent {
    return {
      actor_id: actor.actor_id,
      created_at: this.now(),
      event_id: this.createId("role_event"),
      event_type: eventType,
      resource_id: resourceId,
      ...(input.round_id ? { round_id: input.round_id } : {}),
      run_id: input.run_id,
      team_id: input.team_id,
      tenant_id: actor.tenant_id
    };
  }

  private findActorAssignment(
    actor: RoleWorkflowActor,
    snapshot: RoleWorkflowRepositorySnapshot
  ): StudentRoleAssignment {
    const assignment = snapshot.assignments.find(
      (candidate) => candidate.user_id === actor.actor_id && candidate.status === "active"
    );
    if (!assignment) throw new RoleWorkflowError("ROLE_WORKFLOW_ASSIGNMENT_NOT_FOUND");
    return assignment;
  }

  private latestSection(
    snapshot: RoleWorkflowRepositorySnapshot,
    assignment: StudentRoleAssignment
  ): RoleDecisionSection | undefined {
    return snapshot.sections
      .filter(
        (candidate) =>
          candidate.role_key === assignment.role_key &&
          candidate.submitted_by === assignment.user_id &&
          (!candidate.assignment_id || candidate.assignment_id === assignment.assignment_id)
      )
      .sort((left, right) => left.version - right.version)
      .at(-1);
  }

  private assertCurrentMergeGeneration(
    snapshot: RoleWorkflowRepositorySnapshot,
    mergeCommit: DecisionMergeCommit
  ): void {
    const currentSectionIds = this.currentReadySectionIds(snapshot);
    if (
      currentSectionIds.length === 0 ||
      !sameStrings(currentSectionIds, mergeCommit.source_section_ids)
    ) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_STALE_MERGE");
    }
  }

  private currentMergeCommit(
    snapshot: RoleWorkflowRepositorySnapshot
  ): DecisionMergeCommit | undefined {
    const mergeCommit = snapshot.merge_commits.at(-1);
    const currentSectionIds = this.currentReadySectionIds(snapshot);
    return mergeCommit &&
      currentSectionIds.length > 0 &&
      sameStrings(currentSectionIds, mergeCommit.source_section_ids)
      ? mergeCommit
      : undefined;
  }

  private currentReadySectionIds(snapshot: RoleWorkflowRepositorySnapshot): string[] {
    const mergeOrder = roleMergeOrderForSnapshot(snapshot);
    return snapshot.assignments
      .filter((assignment) => assignment.status === "active")
      .map((assignment) => this.latestSection(snapshot, assignment))
      .filter(
        (section): section is RoleDecisionSection =>
          section !== undefined && section.status === "ready"
      )
      .sort(
        (left, right) =>
          mergeOrder.indexOf(left.role_key as RoleId) - mergeOrder.indexOf(right.role_key as RoleId)
      )
      .map((section) => section.section_id);
  }

  private requireStudent(actor: RoleWorkflowActor): void {
    if (actor.actor_role !== "student") {
      throw new RoleWorkflowError("ROLE_WORKFLOW_STUDENT_REQUIRED");
    }
  }

  private requireTeacher(actor: RoleWorkflowActor): void {
    if (actor.actor_role !== "teacher") {
      throw new RoleWorkflowError("ROLE_WORKFLOW_TEACHER_REQUIRED");
    }
  }
}
