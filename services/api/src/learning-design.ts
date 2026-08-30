import { createHash } from "node:crypto";
import {
  assertValidLearningGoalVersion,
  assertValidRubricVersion,
  LEARNING_DESIGN_SCHEMA_VERSION,
  type LearningGoalDraftInput,
  type LearningGoalRevisionInput,
  type LearningGoalVersion,
  type LearningGoalVersionReference,
  type LearningDesignExactReference,
  type LearningDesignListDto,
  type LearningDesignStatus,
  type RubricDraftInput,
  type RubricRevisionInput,
  type RubricVersion,
  type RubricVersionReference
} from "@simwar/shared-contracts";
import { isDeliveryReadyCoursePackage } from "./course-package-query-service.js";

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number")
    return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`)
      .join(",")}}`;
  }
  throw new LearningDesignCommandError("LEARNING_DESIGN_INPUT_INVALID");
}

function calculateLearningGoalContentDigest(input: LearningGoalDraftInput): string {
  return createHash("sha256").update(canonicalize(input)).digest("hex");
}

function calculateRubricContentDigest(input: RubricDraftInput): string {
  return createHash("sha256").update(canonicalize(input)).digest("hex");
}

export interface LearningDesignCommandActor {
  actor_id: string;
  tenant_id: string;
}

export interface LearningDesignCoursePackageLookup {
  getByReference(
    tenantId: string,
    reference: LearningDesignExactReference & { course_package_id: string }
  ): Promise<{ status: string } | null>;
}

export interface LearningDesignJsonRegistryDependencies {
  now?: () => string;
  persist?: (goals: readonly LearningGoalVersion[], rubrics: readonly RubricVersion[]) => void;
}

export interface LearningDesignAuditCheckpoint {
  goals: LearningGoalVersion[];
  rubrics: RubricVersion[];
}

export class LearningDesignCommandError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "LearningDesignCommandError";
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function identityKey(tenantId: string, id: string, version: string): string {
  return JSON.stringify([tenantId, id, version]);
}

function sameReference(
  left: LearningGoalVersion | RubricVersion,
  right: LearningGoalVersionReference | RubricVersionReference
): boolean {
  const leftId = "goal_id" in left ? left.goal_id : left.rubric_id;
  const rightId = "goal_id" in right ? right.goal_id : right.rubric_id;
  return (
    left.tenant_id === right.tenant_id &&
    leftId === rightId &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function statusIndex(status: LearningDesignStatus): number {
  return { DRAFT: 0, VALIDATED: 1, PUBLISHED: 2, REJECTED: 2 }[status];
}

export class LearningDesignJsonRegistry {
  private readonly now: () => string;
  private readonly persist: (
    goals: readonly LearningGoalVersion[],
    rubrics: readonly RubricVersion[]
  ) => void;
  private readonly goals: LearningGoalVersion[];
  private readonly rubrics: RubricVersion[];

  constructor(
    dependencies: LearningDesignJsonRegistryDependencies = {},
    goals: readonly LearningGoalVersion[] = [],
    rubrics: readonly RubricVersion[] = []
  ) {
    this.now = dependencies.now ?? (() => new Date().toISOString());
    this.persist = dependencies.persist ?? (() => undefined);
    goals.forEach(assertValidLearningGoalVersion);
    rubrics.forEach(assertValidRubricVersion);
    this.goals = goals.map(clone);
    this.rubrics = rubrics.map(clone);
  }

  currentTime(): string {
    return this.now();
  }

  captureAuditCheckpointForCompensation(): LearningDesignAuditCheckpoint {
    return { goals: clone(this.goals), rubrics: clone(this.rubrics) };
  }

  restoreAuditCheckpointAfterFailure(checkpoint: LearningDesignAuditCheckpoint): void {
    this.replace(checkpoint.goals, checkpoint.rubrics);
  }

  async appendGoal(candidate: LearningGoalVersion): Promise<void> {
    assertValidLearningGoalVersion(candidate);
    const history = this.goalHistory(candidate.tenant_id, candidate.goal_id, candidate.version);
    this.assertTransition(history, candidate.status, candidate.content_digest);
    this.replace([...this.goals, clone(candidate)], this.rubrics);
  }

  async appendRubric(candidate: RubricVersion): Promise<void> {
    assertValidRubricVersion(candidate);
    const history = this.rubricHistory(candidate.tenant_id, candidate.rubric_id, candidate.version);
    this.assertTransition(history, candidate.status, candidate.content_digest);
    this.replace(this.goals, [...this.rubrics, clone(candidate)]);
  }

  async getGoal(reference: LearningGoalVersionReference): Promise<LearningGoalVersion | null> {
    const current = this.goalHistory(reference.tenant_id, reference.goal_id, reference.version).at(
      -1
    );
    return current && sameReference(current, reference) ? clone(current) : null;
  }

  async getRubric(reference: RubricVersionReference): Promise<RubricVersion | null> {
    const current = this.rubricHistory(
      reference.tenant_id,
      reference.rubric_id,
      reference.version
    ).at(-1);
    return current && sameReference(current, reference) ? clone(current) : null;
  }

  async listGoals(tenantId: string): Promise<LearningGoalVersion[]> {
    return this.latest(this.goals, tenantId, (item) => item.goal_id);
  }

  async listRubrics(tenantId: string): Promise<RubricVersion[]> {
    return this.latest(this.rubrics, tenantId, (item) => item.rubric_id);
  }

  private assertTransition(
    history: Array<LearningGoalVersion | RubricVersion>,
    status: LearningDesignStatus,
    digest: string
  ): void {
    const current = history.at(-1);
    if (!current) {
      if (status !== "DRAFT")
        throw new LearningDesignCommandError("LEARNING_DESIGN_INVALID_TRANSITION");
      return;
    }
    const rejection = status === "REJECTED" && ["DRAFT", "VALIDATED"].includes(current.status);
    if (
      current.content_digest !== digest ||
      (!rejection && statusIndex(status) !== statusIndex(current.status) + 1)
    ) {
      throw new LearningDesignCommandError("LEARNING_DESIGN_INVALID_TRANSITION");
    }
  }

  private replace(goals: readonly LearningGoalVersion[], rubrics: readonly RubricVersion[]): void {
    const previousGoals = clone(this.goals);
    const previousRubrics = clone(this.rubrics);
    this.goals.splice(0, this.goals.length, ...clone(goals));
    this.rubrics.splice(0, this.rubrics.length, ...clone(rubrics));
    try {
      this.persist(clone(this.goals), clone(this.rubrics));
    } catch (error) {
      this.goals.splice(0, this.goals.length, ...previousGoals);
      this.rubrics.splice(0, this.rubrics.length, ...previousRubrics);
      throw error;
    }
  }

  private goalHistory(tenantId: string, goalId: string, version: string): LearningGoalVersion[] {
    return this.goals.filter(
      (item) => item.tenant_id === tenantId && item.goal_id === goalId && item.version === version
    );
  }

  private rubricHistory(tenantId: string, rubricId: string, version: string): RubricVersion[] {
    return this.rubrics.filter(
      (item) =>
        item.tenant_id === tenantId && item.rubric_id === rubricId && item.version === version
    );
  }

  private latest<T extends { tenant_id: string; version: string; content_digest: string }>(
    values: T[],
    tenantId: string,
    id: (value: T) => string
  ): T[] {
    const latest = new Map<string, T>();
    values
      .filter((item) => item.tenant_id === tenantId)
      .forEach((item) => latest.set(identityKey(tenantId, id(item), item.version), item));
    return [...latest.values()].map(clone);
  }
}

function assertActor(actor: LearningDesignCommandActor): void {
  if (!actor.actor_id.trim() || !actor.tenant_id.trim())
    throw new LearningDesignCommandError("LEARNING_DESIGN_FORBIDDEN");
}

function assertReferenceTenant(
  actor: LearningDesignCommandActor,
  reference: LearningDesignExactReference
): void {
  if (reference.tenant_id !== actor.tenant_id)
    throw new LearningDesignCommandError("LEARNING_DESIGN_TENANT_SCOPE_VIOLATION");
}

export class LearningDesignCommandService {
  constructor(
    private readonly registry: LearningDesignJsonRegistry,
    private readonly coursePackages: LearningDesignCoursePackageLookup
  ) {}

  captureAuditCheckpointForCompensation(): LearningDesignAuditCheckpoint {
    return this.registry.captureAuditCheckpointForCompensation();
  }

  restoreAuditCheckpointAfterFailure(checkpoint: LearningDesignAuditCheckpoint): void {
    this.registry.restoreAuditCheckpointAfterFailure(checkpoint);
  }

  async createGoalDraft(
    actor: LearningDesignCommandActor,
    input: LearningGoalDraftInput,
    supersedesRef?: LearningGoalVersionReference
  ): Promise<LearningGoalVersion> {
    assertActor(actor);
    assertReferenceTenant(actor, input.course_package_reference);
    await this.assertCoursePackage(input.course_package_reference, actor.tenant_id);
    const candidate: LearningGoalVersion = {
      ...clone(input),
      content_digest: calculateLearningGoalContentDigest(input),
      created_at: this.registry.currentTime(),
      created_by: actor.actor_id,
      schema_version: LEARNING_DESIGN_SCHEMA_VERSION,
      status: "DRAFT",
      tenant_id: actor.tenant_id,
      ...(supersedesRef ? { supersedes_ref: clone(supersedesRef) } : {})
    };
    try {
      await this.registry.appendGoal(candidate);
    } catch (error) {
      if (error instanceof LearningDesignCommandError) throw error;
      throw new LearningDesignCommandError("LEARNING_DESIGN_DUPLICATE_VERSION");
    }
    return candidate;
  }

  async createRubricDraft(
    actor: LearningDesignCommandActor,
    input: RubricDraftInput,
    supersedesRef?: RubricVersionReference
  ): Promise<RubricVersion> {
    assertActor(actor);
    assertReferenceTenant(actor, input.course_package_reference);
    await this.assertCoursePackage(input.course_package_reference, actor.tenant_id);
    const candidate: RubricVersion = {
      ...clone(input),
      content_digest: calculateRubricContentDigest(input),
      created_at: this.registry.currentTime(),
      created_by: actor.actor_id,
      schema_version: LEARNING_DESIGN_SCHEMA_VERSION,
      scoring_policy: "NOT_ACTIVE_D1",
      status: "DRAFT",
      tenant_id: actor.tenant_id,
      ...(supersedesRef ? { supersedes_ref: clone(supersedesRef) } : {})
    };
    try {
      await this.registry.appendRubric(candidate);
    } catch (error) {
      if (error instanceof LearningDesignCommandError) throw error;
      throw new LearningDesignCommandError("LEARNING_DESIGN_DUPLICATE_VERSION");
    }
    return candidate;
  }

  validateGoal = (actor: LearningDesignCommandActor, reference: LearningGoalVersionReference) =>
    this.transitionGoal(actor, reference, "VALIDATED");
  publishGoal = (actor: LearningDesignCommandActor, reference: LearningGoalVersionReference) =>
    this.transitionGoal(actor, reference, "PUBLISHED");
  rejectGoal = (actor: LearningDesignCommandActor, reference: LearningGoalVersionReference) =>
    this.transitionGoal(actor, reference, "REJECTED");
  validateRubric = (actor: LearningDesignCommandActor, reference: RubricVersionReference) =>
    this.transitionRubric(actor, reference, "VALIDATED");
  publishRubric = (actor: LearningDesignCommandActor, reference: RubricVersionReference) =>
    this.transitionRubric(actor, reference, "PUBLISHED");
  rejectRubric = (actor: LearningDesignCommandActor, reference: RubricVersionReference) =>
    this.transitionRubric(actor, reference, "REJECTED");

  async reviseGoal(
    actor: LearningDesignCommandActor,
    input: LearningGoalRevisionInput
  ): Promise<LearningGoalVersion> {
    const source = await this.requireGoal(actor, input.source_reference);
    if (source.status !== "PUBLISHED")
      throw new LearningDesignCommandError("LEARNING_DESIGN_INVALID_TRANSITION");
    return this.createGoalDraft(
      actor,
      {
        activity_refs: clone(source.activity_refs),
        course_package_reference: clone(source.course_package_reference),
        expected_evidence_classes: clone(source.expected_evidence_classes),
        goal_id: source.goal_id,
        observable_behaviors: clone(source.observable_behaviors),
        role_scope: clone(source.role_scope),
        statement: source.statement,
        title: source.title,
        version: input.version
      },
      input.source_reference
    );
  }

  async reviseRubric(
    actor: LearningDesignCommandActor,
    input: RubricRevisionInput
  ): Promise<RubricVersion> {
    const source = await this.requireRubric(actor, input.source_reference);
    if (source.status !== "PUBLISHED")
      throw new LearningDesignCommandError("LEARNING_DESIGN_INVALID_TRANSITION");
    return this.createRubricDraft(
      actor,
      {
        course_package_reference: clone(source.course_package_reference),
        criteria: clone(source.criteria),
        learning_goal_references: clone(source.learning_goal_references),
        rubric_id: source.rubric_id,
        title: source.title,
        version: input.version
      },
      input.source_reference
    );
  }

  private async transitionGoal(
    actor: LearningDesignCommandActor,
    reference: LearningGoalVersionReference,
    status: "VALIDATED" | "PUBLISHED" | "REJECTED"
  ): Promise<LearningGoalVersion> {
    const current = await this.requireGoal(actor, reference);
    if (
      (status === "VALIDATED" && current.status !== "DRAFT") ||
      (status === "PUBLISHED" && current.status !== "VALIDATED") ||
      (status === "REJECTED" && !["DRAFT", "VALIDATED"].includes(current.status))
    ) {
      throw new LearningDesignCommandError("LEARNING_DESIGN_INVALID_TRANSITION");
    }
    const next = { ...clone(current), status };
    await this.registry.appendGoal(next);
    return next;
  }

  private async transitionRubric(
    actor: LearningDesignCommandActor,
    reference: RubricVersionReference,
    status: "VALIDATED" | "PUBLISHED" | "REJECTED"
  ): Promise<RubricVersion> {
    const current = await this.requireRubric(actor, reference);
    if (
      (status === "VALIDATED" && current.status !== "DRAFT") ||
      (status === "PUBLISHED" && current.status !== "VALIDATED") ||
      (status === "REJECTED" && !["DRAFT", "VALIDATED"].includes(current.status))
    ) {
      throw new LearningDesignCommandError("LEARNING_DESIGN_INVALID_TRANSITION");
    }
    if (status === "PUBLISHED") {
      for (const goalReference of current.learning_goal_references) {
        const goal = await this.registry.getGoal(goalReference);
        if (!goal || goal.status !== "PUBLISHED")
          throw new LearningDesignCommandError("LEARNING_DESIGN_DEPENDENCY_NOT_PUBLISHED");
      }
    }
    const next = { ...clone(current), status };
    await this.registry.appendRubric(next);
    return next;
  }

  private async requireGoal(
    actor: LearningDesignCommandActor,
    reference: LearningGoalVersionReference
  ): Promise<LearningGoalVersion> {
    assertActor(actor);
    assertReferenceTenant(actor, reference);
    const current = await this.registry.getGoal(reference);
    if (!current) throw new LearningDesignCommandError("LEARNING_DESIGN_REFERENCE_DIGEST_MISMATCH");
    return current;
  }

  private async requireRubric(
    actor: LearningDesignCommandActor,
    reference: RubricVersionReference
  ): Promise<RubricVersion> {
    assertActor(actor);
    assertReferenceTenant(actor, reference);
    const current = await this.registry.getRubric(reference);
    if (!current) throw new LearningDesignCommandError("LEARNING_DESIGN_REFERENCE_DIGEST_MISMATCH");
    return current;
  }

  private async assertCoursePackage(
    reference: LearningGoalVersion["course_package_reference"],
    tenantId: string
  ): Promise<void> {
    const packageVersion = await this.coursePackages.getByReference(tenantId, reference);
    if (!isDeliveryReadyCoursePackage(packageVersion))
      throw new LearningDesignCommandError("LEARNING_DESIGN_COURSE_PACKAGE_NOT_AVAILABLE");
  }
}

export class LearningDesignQueryService {
  constructor(private readonly registry: LearningDesignJsonRegistry) {}

  async listTeacher(tenantId: string): Promise<LearningDesignListDto> {
    return {
      explicit_non_proofs: [
        "D1 does not write Truth, SettlementResult, Score, Rank, EvidenceArtifact or LearningConfirmation.",
        "Scoring policy is NOT_ACTIVE_D1; no final grade is produced.",
        "JSON_INTERNAL_ONLY remains the active runtime authority."
      ],
      learning_goals: await this.registry.listGoals(tenantId),
      rubrics: await this.registry.listRubrics(tenantId),
      runtime_authority: "JSON_INTERNAL_ONLY"
    };
  }
}
