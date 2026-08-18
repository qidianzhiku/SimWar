import { createHash } from "node:crypto";
import {
  W027_FORMAL_ROLE_KEYS,
  W027_KNOWN_LIMITS,
  createDefaultW027DecisionRightPolicies,
  createDefaultW027Roster,
  normalizeW027RoleKey,
  type W027DivergenceDimension,
  type W027DivergenceRow,
  type W027DivergenceSet,
  type W027PrivateJudgment,
  type W027PrivateJudgmentInput,
  type W027ResolutionSafeDTO,
  type W027ResolutionV2,
  type W027RoleContext,
  type W027RoleKey,
  type W027RolePosition,
  type W027RolePositionSafeDTO,
  type W027RolePositionInput,
  type W027RoleRoster,
  type W027DecisionTraceV2,
  type W027DecisionTraceV2Stage,
  type W027StudentDecisionExperienceDTO,
  type W027TeacherDecisionExperienceDTO
} from "@simwar/shared-contracts";
import type {
  RoleWorkflowRepositoryPort,
  W027DecisionExperienceRepositoryPort,
  W027DecisionExperienceRepositoryQuery
} from "./repository-ports.js";

export interface W027DecisionExperienceActor {
  actor_id: string;
  actor_role: "student" | "teacher";
  tenant_id: string;
}

export type W027DecisionExperienceScope = W027DecisionExperienceRepositoryQuery;

export interface W027DecisionExperienceDependencies {
  repository: W027DecisionExperienceRepositoryPort;
  roleWorkflow: RoleWorkflowRepositoryPort;
  now?: () => string;
  createId?: (kind: string) => string;
}

export class W027DecisionExperienceError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "W027DecisionExperienceError";
  }
}

const POSITION_DIMENSIONS: W027DivergenceDimension[] = [
  "value",
  "assumption",
  "evidence",
  "risk",
  "tradeoff"
];

const safeLimits = [...W027_KNOWN_LIMITS];

function clone<T>(value: T): T {
  return structuredClone(value);
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function nonEmpty(value: string, code: string, max = 1200): string {
  const result = value.trim();
  if (!result || result.length > max) throw new W027DecisionExperienceError(code);
  return result;
}

function boundedStrings(value: readonly string[] | undefined, code: string): string[] {
  if (!value) return [];
  if (
    value.length > 8 ||
    value.some((item) => typeof item !== "string" || !item.trim() || item.length > 240)
  ) {
    throw new W027DecisionExperienceError(code);
  }
  return value.map((item) => item.trim());
}

function positionDimensionValue(
  position: W027RolePosition,
  dimension: W027DivergenceDimension
): string {
  switch (dimension) {
    case "value":
      return position.summary;
    case "assumption":
      return position.assumptions.join("|");
    case "evidence":
      return position.evidence_refs.join("|");
    case "risk":
      return position.risk_flags.join("|");
    case "tradeoff":
      return position.tradeoffs.join("|");
  }
}

export class W027DecisionExperienceService {
  private readonly now: () => string;
  private readonly createId: (kind: string) => string;
  private readonly policies = createDefaultW027DecisionRightPolicies();

  constructor(private readonly dependencies: W027DecisionExperienceDependencies) {
    this.now = dependencies.now ?? (() => new Date().toISOString());
    this.createId =
      dependencies.createId ??
      ((kind) => `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
  }

  async configureRoster(
    actor: W027DecisionExperienceActor,
    scope: W027DecisionExperienceScope,
    roleInputs: readonly string[]
  ): Promise<W027RoleRoster> {
    this.requireTeacher(actor);
    if (roleInputs.length === 0 || roleInputs.length > W027_FORMAL_ROLE_KEYS.length) {
      throw new W027DecisionExperienceError("W027_ROSTER_INVALID");
    }
    let roleKeys: W027RoleKey[];
    try {
      roleKeys = [...new Set(roleInputs.map((value) => normalizeW027RoleKey(value as never)))];
    } catch {
      throw new W027DecisionExperienceError("W027_ROSTER_INVALID");
    }
    const roster: W027RoleRoster = createDefaultW027Roster({
      configured_at: this.now(),
      configured_by: actor.actor_id,
      course_id: scope.course_id,
      roster_id: this.createId("w027_roster"),
      run_id: scope.run_id,
      team_id: scope.team_id,
      tenant_id: actor.tenant_id,
      version: 1
    });
    roster.role_keys = roleKeys;
    const existing = (await this.read(scope)).rosters.at(-1);
    if (existing) {
      roster.roster_id = existing.roster_id;
      roster.version = existing.version + 1;
    }
    await this.dependencies.repository.commitW027DecisionExperience({
      kind: "upsert_roster",
      roster
    });
    return clone(roster);
  }

  async getStudentWorkspace(
    actor: W027DecisionExperienceActor,
    scope: W027DecisionExperienceScope
  ): Promise<W027StudentDecisionExperienceDTO> {
    this.requireStudent(actor);
    const snapshot = await this.read(scope);
    const assignment = await this.findAssignment(actor, scope);
    const roster = this.currentRoster(snapshot, scope, actor.actor_id);
    if (!roster.role_keys.includes(normalizeW027RoleKey(assignment.role_key as never))) {
      throw new W027DecisionExperienceError("W027_ROLE_NOT_IN_ROSTER");
    }
    const roleKey = normalizeW027RoleKey(assignment.role_key as never);
    const context = this.context(actor, scope, roleKey);
    const ownJudgments = snapshot.private_judgments.filter(
      (judgment) => judgment.created_by === actor.actor_id && judgment.role_key === roleKey
    );
    const positions = snapshot.role_positions.filter((position) => position.status === "ready");
    const ownPosition = positions.filter((position) => position.role_key === roleKey).at(-1);
    const divergence = this.buildDivergence(scope, roster, positions);
    const resolution = this.safeResolution(this.currentResolution(snapshot, divergence));
    return {
      context,
      known_limits: safeLimits,
      private_judgments: clone(ownJudgments),
      roster: clone(roster),
      schema_version: "w027-student-decision-experience.v1",
      team_safe_positions: clone(
        positions.map(
          ({ created_by: _createdBy, ...position }) => position as W027RolePositionSafeDTO
        )
      ),
      trace: this.buildTrace(
        actor,
        scope,
        roleKey,
        ownJudgments,
        ownPosition,
        divergence,
        resolution
      ),
      ...(ownPosition ? { own_role_position: clone(ownPosition) } : {}),
      ...(divergence ? { divergence: clone(divergence) } : {}),
      ...(resolution ? { resolution: clone(resolution) } : {})
    };
  }

  async getTeacherWorkspace(
    actor: W027DecisionExperienceActor,
    scope: W027DecisionExperienceScope
  ): Promise<W027TeacherDecisionExperienceDTO> {
    this.requireTeacher(actor);
    const snapshot = await this.read(scope);
    const roster = this.currentRoster(snapshot, scope, actor.actor_id);
    const positions = snapshot.role_positions.filter((position) => position.status === "ready");
    const divergence = this.buildDivergence(scope, roster, positions);
    const resolution = this.currentResolution(snapshot, divergence);
    return {
      known_limits: safeLimits,
      private_judgment_summary: snapshot.private_judgments.map((judgment) => ({
        created_at: judgment.created_at,
        judgment_id: judgment.judgment_id,
        kind: judgment.kind,
        role_key: judgment.role_key,
        status: judgment.status,
        version: judgment.version,
        visibility: judgment.visibility
      })),
      role_positions: clone(positions),
      roster: clone(roster),
      schema_version: "w027-teacher-decision-experience.v1",
      ...(divergence ? { divergence: clone(divergence) } : {}),
      ...(resolution ? { resolution: clone(resolution) } : {})
    };
  }

  async savePrivateJudgment(
    actor: W027DecisionExperienceActor,
    scope: W027DecisionExperienceScope,
    input: W027PrivateJudgmentInput
  ): Promise<W027PrivateJudgment> {
    this.requireStudent(actor);
    const assignment = await this.findAssignment(actor, scope);
    const roleKey = normalizeW027RoleKey(assignment.role_key as never);
    const policy = this.policies[roleKey];
    if (!policy.private_judgment_kinds.includes(input.kind)) {
      throw new W027DecisionExperienceError("W027_JUDGMENT_KIND_DENIED");
    }
    const snapshot = await this.read(scope);
    const previous = snapshot.private_judgments
      .filter(
        (judgment) =>
          judgment.created_by === actor.actor_id &&
          judgment.role_key === roleKey &&
          judgment.kind === input.kind
      )
      .at(-1);
    const judgment: W027PrivateJudgment = {
      created_at: this.now(),
      created_by: actor.actor_id,
      course_id: scope.course_id,
      evidence_refs: boundedStrings(input.evidence_refs, "W027_JUDGMENT_EVIDENCE_INVALID"),
      judgment_id: this.createId("w027_judgment"),
      kind: input.kind,
      role_key: roleKey,
      run_id: scope.run_id,
      round_id: scope.round_id,
      schema_version: "w027-private-judgment.v1",
      statement: nonEmpty(input.statement, "W027_JUDGMENT_STATEMENT_INVALID"),
      status: input.status ?? "draft",
      team_id: scope.team_id,
      tenant_id: actor.tenant_id,
      version: (previous?.version ?? 0) + 1,
      visibility: "role_private"
    };
    await this.dependencies.repository.commitW027DecisionExperience({
      kind: "append_private_judgment",
      judgment
    });
    return clone(judgment);
  }

  async saveRolePosition(
    actor: W027DecisionExperienceActor,
    scope: W027DecisionExperienceScope,
    input: W027RolePositionInput
  ): Promise<W027RolePosition> {
    this.requireStudent(actor);
    const assignment = await this.findAssignment(actor, scope);
    const roleKey = normalizeW027RoleKey(assignment.role_key as never);
    const snapshot = await this.read(scope);
    const previous = snapshot.role_positions
      .filter((position) => position.created_by === actor.actor_id && position.role_key === roleKey)
      .at(-1);
    const position: W027RolePosition = {
      assumptions: boundedStrings(input.assumptions, "W027_POSITION_ASSUMPTIONS_INVALID"),
      created_at: this.now(),
      created_by: actor.actor_id,
      course_id: scope.course_id,
      evidence_refs: boundedStrings(input.evidence_refs, "W027_POSITION_EVIDENCE_INVALID"),
      position_id: this.createId("w027_position"),
      risk_flags: boundedStrings(input.risk_flags, "W027_POSITION_RISK_INVALID"),
      role_key: roleKey,
      round_id: scope.round_id,
      run_id: scope.run_id,
      schema_version: "w027-role-position.v1",
      status: input.status ?? "draft",
      summary: nonEmpty(input.summary, "W027_POSITION_SUMMARY_INVALID", 600),
      team_id: scope.team_id,
      tenant_id: actor.tenant_id,
      tradeoffs: boundedStrings(input.tradeoffs, "W027_POSITION_TRADEOFF_INVALID"),
      version: (previous?.version ?? 0) + 1,
      visibility: "team_safe"
    };
    await this.dependencies.repository.commitW027DecisionExperience({
      kind: "append_role_position",
      position
    });
    return clone(position);
  }

  async proposeResolution(
    actor: W027DecisionExperienceActor,
    scope: W027DecisionExperienceScope,
    input: {
      source_digest: string;
      selected_position_ids: string[];
      preserved_dissent_role_keys?: string[];
    }
  ): Promise<W027ResolutionV2> {
    this.requireStudent(actor);
    const assignment = await this.findAssignment(actor, scope);
    const roleKey = normalizeW027RoleKey(assignment.role_key as never);
    if (!this.policies[roleKey].can_propose_resolution)
      throw new W027DecisionExperienceError("W027_RESOLUTION_DENIED");
    const snapshot = await this.read(scope);
    const roster = this.currentRoster(snapshot, scope, actor.actor_id);
    const positions = snapshot.role_positions.filter((position) => position.status === "ready");
    const divergence = this.buildDivergence(scope, roster, positions);
    if (!divergence || divergence.source_digest !== input.source_digest)
      throw new W027DecisionExperienceError("W027_DIVERGENCE_STALE");
    if (
      input.selected_position_ids.some(
        (id) => !positions.some((position) => position.position_id === id)
      )
    ) {
      throw new W027DecisionExperienceError("W027_RESOLUTION_POSITION_INVALID");
    }
    const resolution: W027ResolutionV2 = {
      acknowledged_role_keys: [],
      course_id: scope.course_id,
      preserved_dissent_role_keys: [
        ...new Set(
          (input.preserved_dissent_role_keys ?? []).map((value) =>
            normalizeW027RoleKey(value as never)
          )
        )
      ],
      proposed_at: this.now(),
      proposed_by: actor.actor_id,
      resolution_id: this.createId("w027_resolution"),
      round_id: scope.round_id,
      run_id: scope.run_id,
      schema_version: "w027-resolution.v2",
      selected_position_ids: [...input.selected_position_ids],
      source_digest: divergence.source_digest,
      status: "PROPOSED",
      team_id: scope.team_id,
      tenant_id: actor.tenant_id
    };
    await this.dependencies.repository.commitW027DecisionExperience({
      kind: "append_resolution",
      resolution
    });
    return clone(resolution);
  }

  async acknowledgeResolution(
    actor: W027DecisionExperienceActor,
    scope: W027DecisionExperienceScope,
    input: {
      resolution_id: string;
      status: "ACKNOWLEDGED" | "DISSENT_PRESERVED";
      dissent_note?: string;
    }
  ): Promise<W027ResolutionV2> {
    this.requireStudent(actor);
    const assignment = await this.findAssignment(actor, scope);
    const roleKey = normalizeW027RoleKey(assignment.role_key as never);
    const snapshot = await this.read(scope);
    const resolution = snapshot.resolutions.find(
      (candidate) => candidate.resolution_id === input.resolution_id
    );
    if (!resolution) throw new W027DecisionExperienceError("W027_RESOLUTION_NOT_FOUND");
    if (
      input.status === "DISSENT_PRESERVED" &&
      !nonEmpty(input.dissent_note ?? "", "W027_DISSENT_NOTE_INVALID", 600)
    ) {
      throw new W027DecisionExperienceError("W027_DISSENT_NOTE_INVALID");
    }
    if (
      snapshot.acknowledgements.some(
        (ack) => ack.resolution_id === resolution.resolution_id && ack.role_key === roleKey
      )
    ) {
      throw new W027DecisionExperienceError("W027_ACKNOWLEDGEMENT_EXISTS");
    }
    const acknowledgement = {
      acknowledged_at: this.now(),
      acknowledged_by: actor.actor_id,
      acknowledgement_id: this.createId("w027_ack"),
      ...(input.status === "DISSENT_PRESERVED"
        ? { dissent_note: nonEmpty(input.dissent_note ?? "", "W027_DISSENT_NOTE_INVALID", 600) }
        : {}),
      resolution_id: resolution.resolution_id,
      role_key: roleKey,
      status: input.status,
      tenant_id: actor.tenant_id,
      run_id: scope.run_id,
      round_id: scope.round_id,
      team_id: scope.team_id,
      course_id: scope.course_id
    };
    await this.dependencies.repository.commitW027DecisionExperience({
      kind: "append_acknowledgement",
      acknowledgement
    });
    return clone(resolution);
  }

  private async read(scope: W027DecisionExperienceScope) {
    const snapshot = await this.dependencies.repository.readW027DecisionExperience(scope);
    const workflow = await this.dependencies.roleWorkflow.readRoleWorkflow(scope);
    if (
      !workflow.run ||
      !workflow.round ||
      !workflow.team ||
      workflow.run.tenant_id !== scope.tenant_id ||
      workflow.run.course_id !== scope.course_id ||
      workflow.run.run_id !== scope.run_id ||
      workflow.round.run_id !== scope.run_id ||
      workflow.round.round_id !== scope.round_id ||
      workflow.team.tenant_id !== scope.tenant_id ||
      workflow.team.course_id !== scope.course_id ||
      workflow.team.team_id !== scope.team_id
    ) {
      throw new W027DecisionExperienceError("W027_SCOPE_INVALID");
    }
    return snapshot;
  }

  private findAssignment(actor: W027DecisionExperienceActor, scope: W027DecisionExperienceScope) {
    return this.dependencies.roleWorkflow
      .readRoleWorkflow(scope)
      .then((snapshot) =>
        snapshot.assignments.find(
          (assignment) =>
            assignment.user_id === actor.actor_id &&
            assignment.status === "active" &&
            assignment.tenant_id === scope.tenant_id &&
            assignment.course_id === scope.course_id &&
            assignment.run_id === scope.run_id &&
            assignment.team_id === scope.team_id
        )
      )
      .then((assignment) => {
        if (!assignment) throw new W027DecisionExperienceError("W027_ASSIGNMENT_NOT_FOUND");
        return assignment;
      });
  }

  private currentRoster(
    snapshot: Awaited<
      ReturnType<W027DecisionExperienceRepositoryPort["readW027DecisionExperience"]>
    >,
    scope: W027DecisionExperienceScope,
    configuredBy: string
  ): W027RoleRoster {
    return clone(
      snapshot.rosters.at(-1) ??
        createDefaultW027Roster({
          configured_at: this.now(),
          configured_by: configuredBy,
          course_id: scope.course_id,
          roster_id: `w027_default_roster_${scope.team_id}`,
          run_id: scope.run_id,
          team_id: scope.team_id,
          tenant_id: scope.tenant_id
        })
    );
  }

  private buildDivergence(
    scope: W027DecisionExperienceScope,
    roster: W027RoleRoster,
    positions: W027RolePosition[]
  ): W027DivergenceSet | undefined {
    if (positions.length === 0) return undefined;
    const sourcePositionIds = positions.map((position) => position.position_id);
    const sourceDigest = digest(sourcePositionIds);
    const divergences: W027DivergenceRow[] = [];
    for (const dimension of POSITION_DIMENSIONS) {
      const candidates = positions.map((position) => ({
        position_id: position.position_id,
        role_key: position.role_key,
        value: positionDimensionValue(position, dimension)
      }));
      if (new Set(candidates.map((candidate) => candidate.value)).size > 1) {
        divergences.push({
          candidates,
          dimension,
          divergence_id: `w027_divergence_${dimension}`,
          status: "OPEN"
        });
      }
    }
    return {
      course_id: scope.course_id,
      divergences,
      known_limits: safeLimits,
      round_id: scope.round_id,
      run_id: scope.run_id,
      schema_version: "w027-team-divergence.v2",
      source_digest: sourceDigest,
      source_position_ids: sourcePositionIds,
      status: divergences.length ? "OPEN" : "NONE",
      team_id: scope.team_id,
      tenant_id: scope.tenant_id
    };
  }

  private currentResolution(
    snapshot: Awaited<
      ReturnType<W027DecisionExperienceRepositoryPort["readW027DecisionExperience"]>
    >,
    divergence?: W027DivergenceSet
  ): W027ResolutionV2 | undefined {
    if (!divergence) return undefined;
    const resolution = snapshot.resolutions
      .filter((candidate) => candidate.source_digest === divergence.source_digest)
      .at(-1);
    if (!resolution) return undefined;
    const acknowledgements = snapshot.acknowledgements.filter(
      (ack) => ack.resolution_id === resolution.resolution_id
    );
    return {
      ...clone(resolution),
      acknowledged_role_keys: [...new Set(acknowledgements.map((ack) => ack.role_key))],
      status: acknowledgements.length >= W027_FORMAL_ROLE_KEYS.length ? "ACKS_COMPLETE" : "PROPOSED"
    };
  }

  private safeResolution(resolution?: W027ResolutionV2): W027ResolutionSafeDTO | undefined {
    if (!resolution) return undefined;
    const safe = clone(resolution) as W027ResolutionSafeDTO & { proposed_by?: string };
    delete safe.proposed_by;
    return safe;
  }

  private buildTrace(
    actor: W027DecisionExperienceActor,
    scope: W027DecisionExperienceScope,
    roleKey: W027RoleKey,
    judgments: W027PrivateJudgment[],
    position: W027RolePosition | undefined,
    divergence: W027DivergenceSet | undefined,
    resolution: W027ResolutionSafeDTO | undefined
  ): W027DecisionTraceV2 {
    const stages: W027DecisionTraceV2Stage[] = [
      {
        occurred_at: this.now(),
        safe_evidence_reference: "w027_role_assignment",
        safe_label: "W027 角色已配置",
        stage_key: "ROLE_ASSIGNED"
      }
    ];
    if (judgments.length)
      stages.push({
        occurred_at: judgments.at(-1)!.created_at,
        safe_evidence_reference: "w027_private_judgment",
        safe_label: "角色私有判断已记录",
        stage_key: "PRIVATE_JUDGMENT_CAPTURED"
      });
    if (position)
      stages.push({
        occurred_at: position.created_at,
        safe_evidence_reference: "w027_role_position",
        safe_label: "角色立场已发布为团队安全投影",
        stage_key: "ROLE_POSITION_PUBLISHED"
      });
    if (divergence?.divergences.length)
      stages.push({
        occurred_at: this.now(),
        safe_evidence_reference: "w027_divergence_v2",
        safe_label: "已显示价值、假设、证据、风险或权衡分歧",
        stage_key: "DIVERGENCE_V2_REVEALED"
      });
    if (resolution) {
      stages.push({
        occurred_at: resolution.proposed_at,
        safe_evidence_reference: "w027_resolution_v2",
        safe_label: "团队已提出解决方案",
        stage_key: "RESOLUTION_V2_PROPOSED"
      });
      if (resolution.preserved_dissent_role_keys.includes(roleKey))
        stages.push({
          occurred_at: resolution.proposed_at,
          safe_evidence_reference: "w027_preserved_dissent",
          safe_label: "本角色异议已保留",
          stage_key: "DISSENT_PRESERVED_V2"
        });
    }
    const currentStage = stages.at(-1)?.stage_key ?? "NOT_STARTED";
    return {
      current_stage: currentStage,
      known_limits: safeLimits,
      role_key: roleKey,
      round_id: scope.round_id,
      run_id: scope.run_id,
      schema_version: "w027-decision-trace.v2",
      stages,
      team_id: scope.team_id,
      tenant_id: actor.tenant_id
    };
  }

  private context(
    actor: W027DecisionExperienceActor,
    scope: W027DecisionExperienceScope,
    roleKey: W027RoleKey
  ): W027RoleContext {
    return {
      course_id: scope.course_id,
      permissions: clone(this.policies[roleKey]),
      role_key: roleKey,
      round_id: scope.round_id,
      run_id: scope.run_id,
      schema_version: "w027-role-context.v1",
      source: "resolved_from_w027_assignment",
      team_id: scope.team_id,
      tenant_id: actor.tenant_id,
      user_id: actor.actor_id
    };
  }

  private requireStudent(actor: W027DecisionExperienceActor): void {
    if (actor.actor_role !== "student")
      throw new W027DecisionExperienceError("W027_STUDENT_REQUIRED");
  }

  private requireTeacher(actor: W027DecisionExperienceActor): void {
    if (actor.actor_role !== "teacher")
      throw new W027DecisionExperienceError("W027_TEACHER_REQUIRED");
  }
}
