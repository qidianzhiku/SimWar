import { createHash } from "node:crypto";
import {
  W027_FORMAL_ROLE_KEYS,
  W027_KNOWN_LIMITS,
  W027_MAX_ROLE_INPUTS,
  createDefaultW027DecisionRightPolicies,
  createDefaultW027Roster,
  normalizeW027RoleKey,
  type W027DivergenceDimension,
  type W027DivergenceRow,
  type W027DivergenceSet,
  type W027PrivateJudgment,
  type W027PrivateJudgmentInput,
  type W027ResolutionSafeDTO,
  type W027ResolutionInput,
  type W027ResolutionV2,
  type W027RoleContext,
  type W027RoleKey,
  type W027RolePosition,
  type W027RolePositionSafeDTO,
  type W027RolePositionInput,
  type W027RoleRoster,
  type W027DecisionTraceV2,
  type W027DecisionTraceV2Stage,
  type W027DecisionRightPolicy,
  type W027DecisionRightPolicyInput,
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

function boundedConfidence(value: number | undefined, code: string): number {
  const result = value ?? 0.5;
  if (!Number.isFinite(result) || result < 0 || result > 1) {
    throw new W027DecisionExperienceError(code);
  }
  return result;
}

function normalizePolicyInput(
  input: W027DecisionRightPolicyInput,
  defaults: Record<W027RoleKey, W027DecisionRightPolicy>
): W027DecisionRightPolicy {
  if (!W027_FORMAL_ROLE_KEYS.includes(input.role_key)) {
    throw new W027DecisionExperienceError("W027_POLICY_ROLE_INVALID");
  }
  const defaultPolicy = defaults[input.role_key];
  const boolFields = [
    "can_read_role_workspace",
    "can_write_private_judgment",
    "can_publish_role_position",
    "can_propose_resolution",
    "can_acknowledge_resolution",
    "can_merge_team_decision",
    "can_confirm_team_decision"
  ] as const;
  if (boolFields.some((field) => typeof input[field] !== "boolean")) {
    throw new W027DecisionExperienceError("W027_POLICY_INVALID");
  }
  const privateKinds = boundedStrings(
    input.private_judgment_kinds,
    "W027_POLICY_JUDGMENT_KINDS_INVALID"
  ) as W027DecisionRightPolicy["private_judgment_kinds"];
  if (
    privateKinds.some(
      (kind) => !["value", "assumption", "evidence", "risk", "tradeoff"].includes(kind)
    )
  ) {
    throw new W027DecisionExperienceError("W027_POLICY_JUDGMENT_KINDS_INVALID");
  }
  return {
    ...defaultPolicy,
    ...input,
    known_limits: [...new Set([...(input.known_limits ?? []), ...safeLimits])],
    operational_capabilities: boundedStrings(
      input.operational_capabilities,
      "W027_POLICY_CAPABILITIES_INVALID"
    ),
    policy_id: input.policy_id?.trim() || defaultPolicy.policy_id,
    private_judgment_kinds: privateKinds,
    schema_version: "w027-decision-right-policy.v1"
  };
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
  private readonly defaultPolicies = createDefaultW027DecisionRightPolicies();

  constructor(private readonly dependencies: W027DecisionExperienceDependencies) {
    this.now = dependencies.now ?? (() => new Date().toISOString());
    this.createId =
      dependencies.createId ??
      ((kind) => `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
  }

  async resolveRoleWorkflowPolicy(
    scope: W027DecisionExperienceScope,
    roleKeyInput: string
  ): Promise<
    | {
        can_merge_team_decision: boolean;
        can_propose_resolution: boolean;
        can_confirm_team_decision: boolean;
      }
    | undefined
  > {
    let roleKey: W027RoleKey;
    try {
      roleKey = normalizeW027RoleKey(roleKeyInput as never);
    } catch {
      return undefined;
    }
    const snapshot = await this.dependencies.repository.readW027DecisionExperience(scope);
    const roster = snapshot.rosters.at(-1);
    if (!roster) return undefined;
    const policy = this.policyFor(roster, roleKey);
    return {
      can_confirm_team_decision: policy.can_confirm_team_decision,
      can_merge_team_decision: policy.can_merge_team_decision,
      can_propose_resolution: policy.can_propose_resolution
    };
  }

  async configureRoster(
    actor: W027DecisionExperienceActor,
    scope: W027DecisionExperienceScope,
    roleInputs: readonly string[],
    decisionRightPolicies?: readonly W027DecisionRightPolicyInput[]
  ): Promise<W027RoleRoster> {
    this.requireTeacher(actor);
    if (roleInputs.length === 0 || roleInputs.length > W027_MAX_ROLE_INPUTS) {
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
    if (decisionRightPolicies) {
      if (decisionRightPolicies.length > W027_FORMAL_ROLE_KEYS.length) {
        throw new W027DecisionExperienceError("W027_POLICY_INVALID");
      }
      const seen = new Set<W027RoleKey>();
      roster.decision_right_policies = decisionRightPolicies.map((input) => {
        const policy = normalizePolicyInput(input, this.defaultPolicies);
        if (seen.has(policy.role_key)) {
          throw new W027DecisionExperienceError("W027_POLICY_DUPLICATE_ROLE");
        }
        seen.add(policy.role_key);
        return policy;
      });
    }
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
    const roleWorkflowSnapshot = await this.dependencies.roleWorkflow.readRoleWorkflow(scope);
    const assignment = await this.findAssignment(actor, scope);
    const roster = this.currentRoster(snapshot, scope, actor.actor_id);
    if (!roster.role_keys.includes(normalizeW027RoleKey(assignment.role_key as never))) {
      throw new W027DecisionExperienceError("W027_ROLE_NOT_IN_ROSTER");
    }
    const roleKey = normalizeW027RoleKey(assignment.role_key as never);
    const policy = this.policyFor(roster, roleKey);
    if (!policy.can_read_role_workspace) {
      throw new W027DecisionExperienceError("W027_WORKSPACE_READ_DENIED");
    }
    const context = this.context(actor, scope, roleKey, policy);
    const ownJudgments = snapshot.private_judgments.filter(
      (judgment) => judgment.created_by === actor.actor_id && judgment.role_key === roleKey
    );
    const positions = this.projectRolePositions(snapshot, roleWorkflowSnapshot, scope);
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
        resolution,
        roleWorkflowSnapshot
      ),
      ...(ownPosition
        ? {
            own_role_position: clone(
              (({ created_by: _createdBy, ...position }) => position as W027RolePositionSafeDTO)(
                ownPosition
              )
            )
          }
        : {}),
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
    const roleWorkflowSnapshot = await this.dependencies.roleWorkflow.readRoleWorkflow(scope);
    const positions = this.projectRolePositions(snapshot, roleWorkflowSnapshot, scope);
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
      role_positions: clone(
        positions.map(
          ({ created_by: _createdBy, ...position }) => position as W027RolePositionSafeDTO
        )
      ),
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
    const snapshot = await this.read(scope);
    const roster = this.currentRoster(snapshot, scope, actor.actor_id);
    const policy = this.policyFor(roster, roleKey);
    if (!policy.can_write_private_judgment) {
      throw new W027DecisionExperienceError("W027_JUDGMENT_DENIED");
    }
    if (!policy.private_judgment_kinds.includes(input.kind)) {
      throw new W027DecisionExperienceError("W027_JUDGMENT_KIND_DENIED");
    }
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
      problem_frame: nonEmpty(
        input.problem_frame ?? input.statement,
        "W027_JUDGMENT_PROBLEM_FRAME_INVALID"
      ),
      assumptions: boundedStrings(input.assumptions, "W027_JUDGMENT_ASSUMPTIONS_INVALID"),
      options_considered: boundedStrings(input.options_considered, "W027_JUDGMENT_OPTIONS_INVALID"),
      trade_offs: boundedStrings(input.trade_offs, "W027_JUDGMENT_TRADE_OFFS_INVALID"),
      prediction: nonEmpty(input.prediction ?? input.statement, "W027_JUDGMENT_PREDICTION_INVALID"),
      confidence: boundedConfidence(input.confidence, "W027_JUDGMENT_CONFIDENCE_INVALID"),
      rationale: nonEmpty(input.rationale ?? input.statement, "W027_JUDGMENT_RATIONALE_INVALID"),
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
    const roster = this.currentRoster(snapshot, scope, actor.actor_id);
    const policy = this.policyFor(roster, roleKey);
    if (!policy.can_publish_role_position) {
      throw new W027DecisionExperienceError("W027_POSITION_DENIED");
    }
    void input;
    const roleWorkflowSnapshot = await this.dependencies.roleWorkflow.readRoleWorkflow(scope);
    const position = this.projectRolePositions(snapshot, roleWorkflowSnapshot, scope).find(
      (candidate) => candidate.role_key === roleKey && candidate.created_by === actor.actor_id
    );
    if (!position) throw new W027DecisionExperienceError("W027_POSITION_NOT_READY");
    return clone(position);
  }

  async proposeResolution(
    actor: W027DecisionExperienceActor,
    scope: W027DecisionExperienceScope,
    input: W027ResolutionInput
  ): Promise<W027ResolutionV2> {
    this.requireStudent(actor);
    const assignment = await this.findAssignment(actor, scope);
    const roleKey = normalizeW027RoleKey(assignment.role_key as never);
    const snapshot = await this.read(scope);
    const roster = this.currentRoster(snapshot, scope, actor.actor_id);
    const policy = this.policyFor(roster, roleKey);
    if (!policy.can_propose_resolution)
      throw new W027DecisionExperienceError("W027_RESOLUTION_DENIED");
    const roleWorkflowSnapshot = await this.dependencies.roleWorkflow.readRoleWorkflow(scope);
    const positions = this.projectRolePositions(snapshot, roleWorkflowSnapshot, scope);
    const divergence = this.buildDivergence(scope, roster, positions);
    if (!divergence || divergence.source_digest !== input.source_digest)
      throw new W027DecisionExperienceError("W027_DIVERGENCE_STALE");
    const resolutionMode = input.resolution_mode ?? "OBSERVED_CANDIDATE_SELECTION";
    if (
      resolutionMode === "EXPLICIT_TEAM_COMPROMISE" &&
      !policy.operational_capabilities.includes("explicit_team_compromise")
    ) {
      throw new W027DecisionExperienceError("W027_COMPROMISE_NOT_AUTHORIZED");
    }
    if (input.selected_position_ids.length === 0 && resolutionMode !== "EXPLICIT_TEAM_COMPROMISE") {
      throw new W027DecisionExperienceError("W027_RESOLUTION_POSITION_INVALID");
    }
    if (
      input.selected_position_ids.some(
        (id) => !positions.some((position) => position.position_id === id)
      )
    ) {
      throw new W027DecisionExperienceError("W027_RESOLUTION_POSITION_INVALID");
    }
    const selectedOption = nonEmpty(
      input.selected_option ??
        positions
          .filter((position) => input.selected_position_ids.includes(position.position_id))
          .map((position) => position.summary)
          .join("; "),
      "W027_RESOLUTION_OPTION_INVALID",
      600
    );
    const resolution: W027ResolutionV2 = {
      acknowledged_role_keys: [],
      course_id: scope.course_id,
      affected_divergence_ids: input.affected_divergence_ids
        ? boundedStrings(input.affected_divergence_ids, "W027_RESOLUTION_DIVERGENCE_INVALID")
        : divergence.divergences.map((row) => row.divergence_id),
      authority_role_key: roleKey,
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
      rationale: nonEmpty(
        input.rationale ?? "Selected team-safe evidence for the current divergence.",
        "W027_RESOLUTION_RATIONALE_INVALID",
        1200
      ),
      round_id: scope.round_id,
      run_id: scope.run_id,
      resolution_mode: resolutionMode,
      risk: nonEmpty(
        input.risk ?? "Preserved dissent remains process evidence only.",
        "W027_RESOLUTION_RISK_INVALID",
        600
      ),
      schema_version: "w027-resolution.v2",
      selected_option: selectedOption,
      selected_position_ids: [...input.selected_position_ids],
      source_digest: divergence.source_digest,
      status: "PROPOSED",
      supporting_evidence_refs: boundedStrings(
        input.supporting_evidence_refs ?? [
          `w027_divergence_${divergence.source_digest.slice(0, 16)}`
        ],
        "W027_RESOLUTION_EVIDENCE_INVALID"
      ),
      team_id: scope.team_id,
      tenant_id: actor.tenant_id,
      trade_off: nonEmpty(
        input.trade_off ?? "Selection balances the recorded team-safe positions.",
        "W027_RESOLUTION_TRADE_OFF_INVALID",
        600
      )
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
    const roster = this.currentRoster(snapshot, scope, actor.actor_id);
    if (!this.policyFor(roster, roleKey).can_acknowledge_resolution) {
      throw new W027DecisionExperienceError("W027_ACKNOWLEDGEMENT_DENIED");
    }
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

  private projectRolePositions(
    snapshot: Awaited<
      ReturnType<W027DecisionExperienceRepositoryPort["readW027DecisionExperience"]>
    >,
    workflow: Awaited<ReturnType<RoleWorkflowRepositoryPort["readRoleWorkflow"]>>,
    scope: W027DecisionExperienceScope
  ): W027RolePosition[] {
    const projected = workflow.assignments
      .filter((assignment) => assignment.status === "active")
      .map((assignment) => {
        const section = workflow.sections
          .filter(
            (candidate) =>
              candidate.assignment_id === assignment.assignment_id && candidate.status === "ready"
          )
          .at(-1);
        if (!section) return undefined;
        const roleKey = normalizeW027RoleKey(assignment.role_key as never);
        const judgments = snapshot.private_judgments.filter(
          (judgment) => judgment.role_key === roleKey && judgment.status === "ready"
        );
        if (judgments.length === 0) return undefined;
        const sourceDigest = digest({
          judgment_ids: judgments.map((judgment) => judgment.judgment_id),
          section_id: section.section_id
        });
        const safeKindDigest = (kind: W027DivergenceDimension): string[] => {
          const matching = judgments.filter((judgment) => judgment.kind === kind);
          return matching.length ? [`${kind}_digest:${digest(matching).slice(0, 16)}`] : [];
        };
        const summary =
          typeof section.payload.strategy_statement === "string" &&
          section.payload.strategy_statement.trim()
            ? section.payload.strategy_statement.trim()
            : `${roleKey} contribution is ready`;
        return {
          assumptions: safeKindDigest("assumption"),
          created_at: section.updated_at,
          created_by: section.submitted_by,
          course_id: scope.course_id,
          evidence_refs: safeKindDigest("evidence"),
          position_id: `w027_projection_${sourceDigest.slice(0, 24)}`,
          risk_flags: safeKindDigest("risk"),
          role_key: roleKey,
          round_id: scope.round_id,
          run_id: scope.run_id,
          schema_version: "w027-role-position.v1" as const,
          status: "ready" as const,
          summary,
          team_id: scope.team_id,
          tenant_id: scope.tenant_id,
          tradeoffs: safeKindDigest("tradeoff"),
          version: section.version,
          visibility: "team_safe" as const
        } satisfies W027RolePosition;
      })
      .filter(
        (position): position is NonNullable<typeof position> => position !== undefined
      ) as W027RolePosition[];
    if (projected.length > 0) return projected;
    return snapshot.role_positions.filter((position) => position.status === "ready");
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
    resolution: W027ResolutionSafeDTO | undefined,
    roleWorkflowSnapshot: Awaited<ReturnType<RoleWorkflowRepositoryPort["readRoleWorkflow"]>>
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
    const merge = roleWorkflowSnapshot.merge_commits.at(-1);
    if (merge)
      stages.push({
        occurred_at: merge.created_at,
        safe_evidence_reference: "w027_role_merge",
        safe_label: "团队角色贡献已合并",
        stage_key: "TEAM_MERGE_MILESTONE"
      });
    const confirmation = roleWorkflowSnapshot.confirmations.at(-1);
    if (confirmation)
      stages.push({
        occurred_at: confirmation.confirmed_at,
        safe_evidence_reference: "w027_team_confirmation",
        safe_label: "团队决策已确认",
        stage_key: "TEAM_CONFIRMED"
      });
    const canonicalDecision = roleWorkflowSnapshot.decisions.at(-1);
    if (canonicalDecision)
      stages.push({
        occurred_at: confirmation?.confirmed_at ?? merge?.created_at ?? this.now(),
        safe_evidence_reference: "w027_canonical_decision",
        safe_label: "正式 Decision 已由既有 RoleWorkflow 提交",
        stage_key: "CANONICAL_DECISION_MILESTONE"
      });
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
    roleKey: W027RoleKey,
    permissions: W027DecisionRightPolicy
  ): W027RoleContext {
    return {
      course_id: scope.course_id,
      permissions: clone(permissions),
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

  private policyFor(roster: W027RoleRoster, roleKey: W027RoleKey): W027DecisionRightPolicy {
    return clone(
      roster.decision_right_policies?.find((policy) => policy.role_key === roleKey) ??
        this.defaultPolicies[roleKey]
    );
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
