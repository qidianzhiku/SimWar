import {
  DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES,
  DEFAULT_STUDENT_ROLE_TEMPLATES,
  type Decision,
  type DecisionMergeCommit,
  type DecisionPayload,
  type DecisionPayloadFieldPath,
  type RoleContext,
  type RoleDecisionSection,
  type RoleId,
  type RoleWorkflowEvent,
  type StudentRoleAssignment,
  type StudentRoleWorkflowMergeDTO,
  type StudentRoleWorkflowWorkspaceDTO,
  type TeacherRoleWorkflowWorkspaceDTO,
  type TeamConfirmation
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

const ROLE_MERGE_ORDER: RoleId[] = ["CEO", "CFO", "CMO", "COO"];

function clone<T>(value: T): T {
  return structuredClone(value);
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

function buildMergedPayload(sections: RoleDecisionSection[]): DecisionPayload {
  const merged: Partial<DecisionPayload> = {};

  const assign = (
    field: DecisionPayloadFieldPath,
    value: DecisionPayload[keyof DecisionPayload] | number | string
  ) => {
    const existing =
      field === "pricing.base_price"
        ? merged.pricing?.base_price
        : merged[field as Exclude<DecisionPayloadFieldPath, "pricing.base_price">];
    if (existing !== undefined && existing !== value) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_MERGE_CONFLICT");
    }
    if (field === "pricing.base_price") {
      merged.pricing = { base_price: value as number };
    } else {
      Object.assign(merged, { [field]: value });
    }
  };

  for (const roleKey of ROLE_MERGE_ORDER) {
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

  constructor(
    private readonly repository: RoleWorkflowRepositoryPort,
    dependencies: RoleWorkflowDependencies = {}
  ) {
    this.createId =
      dependencies.createId ??
      ((kind) => `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
    this.now = dependencies.now ?? (() => new Date().toISOString());
  }

  assignRole(actor: RoleWorkflowActor, input: AssignRoleInput): StudentRoleAssignment {
    this.requireTeacher(actor);
    const snapshot = this.read(actor, input);
    this.assertScope(snapshot, input.course_id);
    const member = snapshot.team!.members.find((candidate) => candidate.user_id === input.user_id);
    if (!member || member.role_slot !== input.role_key) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_MEMBER_ROLE_INVALID");
    }
    const template = DEFAULT_STUDENT_ROLE_TEMPLATES.find(
      (candidate) => candidate.role_key === input.role_key
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

    const assignment: StudentRoleAssignment = {
      assignment_id: this.createId("role_assignment"),
      assigned_at: this.now(),
      assigned_by: actor.actor_id,
      course_id: input.course_id,
      role_key: input.role_key,
      role_template_id: template.role_template_id,
      run_id: input.run_id,
      source: "teacher_assigned",
      status: "active",
      team_id: input.team_id,
      tenant_id: actor.tenant_id,
      user_id: input.user_id
    };
    this.repository.commitRoleWorkflow({
      assignment,
      event: this.createEvent(actor, input, "role_assigned", assignment.assignment_id),
      kind: "append_assignment"
    });
    return clone(assignment);
  }

  getStudentWorkspace(
    actor: RoleWorkflowActor,
    input: RoundWorkflowScope
  ): StudentRoleWorkflowWorkspaceDTO {
    this.requireStudent(actor);
    const snapshot = this.read(actor, input);
    this.assertRoundScope(snapshot);
    const assignment = this.findActorAssignment(actor, snapshot);
    const permissions = DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES[assignment.role_key];
    const section = this.latestSection(snapshot, assignment);
    const mergeCommit = this.currentMergeCommit(snapshot);
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

  getTeacherWorkspace(
    actor: RoleWorkflowActor,
    input: RoundWorkflowScope
  ): TeacherRoleWorkflowWorkspaceDTO {
    this.requireTeacher(actor);
    const snapshot = this.read(actor, input);
    this.assertRoundScope(snapshot);
    const activeAssignments = snapshot.assignments.filter(
      (assignment) => assignment.status === "active"
    );

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
      tenant_id: actor.tenant_id
    };
  }

  saveSection(actor: RoleWorkflowActor, input: SaveSectionInput): RoleDecisionSection {
    this.requireStudent(actor);
    const snapshot = this.read(actor, input);
    this.assertRoundScope(snapshot);
    const assignment = this.findActorAssignment(actor, snapshot);
    const policy = DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES[assignment.role_key];
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
    this.repository.commitRoleWorkflow({
      event: this.createEvent(actor, input, "section_saved", section.section_id),
      kind: "append_section",
      section
    });
    return clone(section);
  }

  markSectionReady(actor: RoleWorkflowActor, input: MarkSectionReadyInput): RoleDecisionSection {
    this.requireStudent(actor);
    const snapshot = this.read(actor, input);
    this.assertRoundScope(snapshot);
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
    this.repository.commitRoleWorkflow({
      event: this.createEvent(actor, input, "section_ready", ready.section_id),
      kind: "append_section",
      section: ready
    });
    return clone(ready);
  }

  createMergeCommit(
    actor: RoleWorkflowActor,
    input: RoundWorkflowScope
  ): StudentRoleWorkflowMergeDTO {
    this.requireStudent(actor);
    const snapshot = this.read(actor, input);
    this.assertRoundScope(snapshot);
    const assignment = this.findActorAssignment(actor, snapshot);
    if (!DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES[assignment.role_key].can_create_merge_commit) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_MERGE_DENIED");
    }
    if (snapshot.team!.captain_user_id !== actor.actor_id) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_CAPTAIN_REQUIRED");
    }
    const activeAssignments = snapshot.assignments.filter(
      (candidate) => candidate.status === "active"
    );
    const readySections = activeAssignments.map((candidate) =>
      this.latestSection(snapshot, candidate)
    );
    if (
      readySections.some((section) => !section || section.status !== "ready") ||
      readySections.length === 0
    ) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_SECTIONS_NOT_READY");
    }
    const sourceSectionIds = readySections.map((section) => section!.section_id);
    const existing = snapshot.merge_commits.find((candidate) =>
      sameStrings(candidate.source_section_ids, sourceSectionIds)
    );
    if (existing) return toStudentMergeDto(existing);

    const mergeCommit: DecisionMergeCommit = {
      created_at: this.now(),
      created_by: actor.actor_id,
      merge_commit_id: this.createId("merge_commit"),
      merged_payload: buildMergedPayload(readySections as RoleDecisionSection[]),
      round_id: input.round_id,
      run_id: input.run_id,
      source_section_ids: sourceSectionIds,
      status: "validated",
      team_id: input.team_id,
      tenant_id: actor.tenant_id
    };
    this.repository.commitRoleWorkflow({
      event: this.createEvent(actor, input, "merge_created", mergeCommit.merge_commit_id),
      kind: "append_merge",
      merge_commit: mergeCommit
    });
    return toStudentMergeDto(mergeCommit);
  }

  confirmTeamDecision(actor: RoleWorkflowActor, input: ConfirmTeamDecisionInput): TeamConfirmation {
    this.requireStudent(actor);
    const snapshot = this.read(actor, input);
    this.assertRoundScope(snapshot);
    const assignment = this.findActorAssignment(actor, snapshot);
    const policy = DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES[assignment.role_key];
    if (
      !policy.can_submit_canonical_decision ||
      assignment.role_key !== "CEO" ||
      snapshot.team!.captain_user_id !== actor.actor_id
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
    if (existing) return clone(existing);

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
      status: "validated",
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
    this.repository.commitRoleWorkflow({
      confirmation,
      decision,
      event: this.createEvent(actor, input, "team_confirmed", confirmation.team_confirmation_id),
      kind: "append_confirmation"
    });
    return clone(confirmation);
  }

  assertDirectDecisionSubmissionAllowed(actor: RoleWorkflowActor, input: RoundWorkflowScope): void {
    this.requireStudent(actor);
    const snapshot = this.read(actor, input);
    this.assertRoundScope(snapshot);
    if (
      snapshot.assignments.length > 0 ||
      snapshot.confirmations.length > 0 ||
      snapshot.events.length > 0
    ) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_DIRECT_DECISION_DISABLED");
    }
  }

  resetWorkflow(
    actor: RoleWorkflowActor,
    input: RoundWorkflowScope
  ): { deactivated_assignments: number } {
    this.requireTeacher(actor);
    const snapshot = this.read(actor, input);
    this.assertRoundScope(snapshot);
    if (snapshot.confirmations.length > 0) {
      throw new RoleWorkflowError("ROLE_WORKFLOW_CONFIRMED_IMMUTABLE");
    }
    const activeIds = snapshot.assignments
      .filter((assignment) => assignment.status === "active")
      .map((assignment) => assignment.assignment_id);
    this.repository.commitRoleWorkflow({
      assignment_ids: activeIds,
      event: this.createEvent(actor, input, "workflow_reset", this.createId("workflow_reset")),
      kind: "reset"
    });
    return { deactivated_assignments: activeIds.length };
  }

  private read(
    actor: RoleWorkflowActor,
    input: WorkflowScope & { round_id?: string }
  ): RoleWorkflowRepositorySnapshot {
    const query: RoleWorkflowRepositoryQuery = {
      run_id: input.run_id,
      team_id: input.team_id,
      tenant_id: actor.tenant_id,
      ...(input.round_id ? { round_id: input.round_id } : {})
    };
    return this.repository.readRoleWorkflow(query);
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
    return snapshot.assignments
      .filter((assignment) => assignment.status === "active")
      .map((assignment) => this.latestSection(snapshot, assignment))
      .filter(
        (section): section is RoleDecisionSection =>
          section !== undefined && section.status === "ready"
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
