import { createHash } from "node:crypto";
import {
  isTeacherConfirmationExactRef,
  isTeacherConfirmationVersion,
  type LearningGoalVersion,
  type RubricVersion,
  type TeacherConfirmationCommandInput,
  type TeacherConfirmationContext,
  type TeacherConfirmationExactRef,
  type TeacherConfirmationRejectInput,
  type TeacherConfirmationTeacherDto,
  type TeacherConfirmationVersion
} from "@simwar/shared-contracts";
import type { AuditLog } from "@simwar/shared-contracts";
import type {
  TeacherConfirmationAppendCommand,
  TeacherConfirmationRepositoryPort
} from "./repository-ports.js";
import type { TeacherConfirmationClaimVerification } from "./teacher-confirmation-work-claim.js";

const KNOWN_LIMITS = [
  "D3 confirmation is teacher-only and is not final grading.",
  "JSON_INTERNAL_ONLY is the active runtime authority; durable locking and recovery are not proven.",
  "D3 does not write Truth, SettlementResult, Score, Rank, or Replay authority.",
  "Human Validation is not performed."
] as const;

export interface TeacherConfirmationCoursePackageLookup {
  getByReference(
    tenantId: string,
    reference: TeacherConfirmationExactRef
  ): Promise<{ status: string; content_digest: string } | null>;
}

export interface TeacherConfirmationLearningDesignLookup {
  getGoal(reference: {
    goal_id: string;
    tenant_id: string;
    version: string;
    content_digest: string;
  }): Promise<LearningGoalVersion | null>;
  getRubric(reference: {
    rubric_id: string;
    tenant_id: string;
    version: string;
    content_digest: string;
  }): Promise<RubricVersion | null>;
}

export interface TeacherConfirmationEvidenceLookup {
  getByReference(
    tenantId: string,
    reference: TeacherConfirmationExactRef
  ): Promise<{
    artifact_ref: TeacherConfirmationExactRef;
    context: { course_id: string; run_id: string; team_id: string; role_key: string };
    visibility: "teacher_only";
  } | null>;
}

export interface TeacherConfirmationCommandDependencies {
  coursePackages: TeacherConfirmationCoursePackageLookup;
  learningDesign: TeacherConfirmationLearningDesignLookup;
  evidence: TeacherConfirmationEvidenceLookup;
  claims: TeacherConfirmationClaimVerification;
  repository: TeacherConfirmationRepositoryPort;
  now?: () => string;
  createId?: (kind: string) => string;
  records?: TeacherConfirmationVersion[];
  audits?: AuditLog[];
}

export class TeacherConfirmationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "TeacherConfirmationError";
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number")
    return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
      .join(",")}}`;
  }
  throw new TeacherConfirmationError("D3_INPUT_INVALID");
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

function evidenceSetDigest(refs: readonly TeacherConfirmationExactRef[]): string {
  const normalized = refs
    .map((ref) => ({
      content_digest: ref.content_digest,
      resource_id: ref.resource_id,
      resource_type: ref.resource_type,
      tenant_id: ref.tenant_id,
      version: ref.version
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function identity(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    !/^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(value) ||
    /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i.test(value)
  ) {
    throw new TeacherConfirmationError("D3_INPUT_INVALID");
  }
  return value;
}

function hasUnsafeText(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return character === "<" || character === ">" || code < 0x20 || code === 0x7f;
  });
}

function versionNumber(version: string): number {
  const match = /^([1-9]\d*)\.0\.0$/.exec(version);
  if (!match) throw new TeacherConfirmationError("D3_LIFECYCLE_INVALID");
  return Number(match[1]);
}

function equalRef(left: TeacherConfirmationExactRef, right: TeacherConfirmationExactRef): boolean {
  return canonicalize(left) === canonicalize(right);
}

function ensureSameTenant(tenantId: string, refs: readonly TeacherConfirmationExactRef[]): void {
  if (refs.some((reference) => reference.tenant_id !== tenantId)) {
    throw new TeacherConfirmationError("D3_SCOPE_CONFLICT");
  }
}

export class TeacherConfirmationCommandService {
  private readonly now: () => string;
  private readonly createId: (kind: string) => string;

  constructor(private readonly dependencies: TeacherConfirmationCommandDependencies) {
    this.now = dependencies.now ?? (() => new Date().toISOString());
    this.createId = dependencies.createId ?? ((kind) => `${kind}_${Date.now()}`);
  }

  async saveDraft(
    actor: { actor_id: string; tenant_id: string },
    input: TeacherConfirmationCommandInput,
    requestId: string
  ): Promise<{
    data: { confirmation: TeacherConfirmationVersion; status: "generated" | "reused" };
    known_limits: readonly string[];
    runtime_authority: "JSON_INTERNAL_ONLY";
  }> {
    identity(actor.actor_id);
    identity(actor.tenant_id);
    identity(requestId);
    this.assertInput(actor.tenant_id, input);
    this.assertClaim(actor, input.claim_id, input.context, input.evidence_refs);
    const refs = [
      input.course_package_ref,
      input.learning_goal_ref,
      input.rubric_ref,
      ...input.evidence_refs
    ];
    ensureSameTenant(actor.tenant_id, refs);
    await this.assertReferences(actor.tenant_id, input);
    const existing = (await this.dependencies.repository.list(actor.tenant_id)).find(
      (record) =>
        record.confirmation_ref.resource_id === input.confirmation_id &&
        record.confirmation_ref.version === "1.0.0"
    );
    const contentDigest = digest({ ...input, status: "DRAFT" });
    if (existing) {
      if (existing.content_digest !== contentDigest)
        throw new TeacherConfirmationError("D3_DUPLICATE_CONFLICT");
      return {
        data: { confirmation: clone(existing), status: "reused" },
        known_limits: [...KNOWN_LIMITS],
        runtime_authority: "JSON_INTERNAL_ONLY"
      };
    }
    const confirmation = this.createVersion(
      actor,
      input,
      "DRAFT",
      "1.0.0",
      contentDigest,
      requestId
    );
    await this.append(confirmation, actor, requestId, "teacher_confirmation.draft_save");
    return {
      data: { confirmation, status: "generated" },
      known_limits: [...KNOWN_LIMITS],
      runtime_authority: "JSON_INTERNAL_ONLY"
    };
  }

  async confirm(
    actor: { actor_id: string; tenant_id: string },
    confirmationId: string,
    claimId: string,
    requestId: string
  ): Promise<{ data: TeacherConfirmationTeacherDto; known_limits: readonly string[] }> {
    identity(confirmationId);
    identity(claimId);
    const latest = await this.latest(actor.tenant_id, confirmationId);
    if (!latest || latest.status !== "DRAFT")
      throw new TeacherConfirmationError("D3_LIFECYCLE_INVALID");
    this.assertClaim(actor, claimId, latest.context, latest.evidence_refs);
    const version = `${versionNumber(latest.confirmation_ref.version) + 1}.0.0`;
    const contentDigest = digest({ ...latest, status: "CONFIRMED", version });
    const confirmation: TeacherConfirmationVersion = {
      ...clone(latest),
      audit_receipt: {
        action: "teacher_confirmation.confirm",
        actor_id: actor.actor_id,
        audit_id: this.createId("audit"),
        recorded_at: this.now(),
        request_id: requestId
      },
      confirmation_ref: { ...latest.confirmation_ref, content_digest: contentDigest, version },
      content_digest: contentDigest,
      created_at: this.now(),
      created_by: actor.actor_id,
      status: "CONFIRMED",
      supersedes_ref: latest.confirmation_ref
    };
    if (!isTeacherConfirmationVersion(confirmation))
      throw new TeacherConfirmationError("D3_OUTPUT_INVALID");
    await this.append(confirmation, actor, requestId, "teacher_confirmation.confirm");
    return {
      data: {
        confirmation,
        known_limits: [...KNOWN_LIMITS],
        runtime_authority: "JSON_INTERNAL_ONLY"
      },
      known_limits: [...KNOWN_LIMITS]
    };
  }

  async reject(
    actor: { actor_id: string; tenant_id: string },
    confirmationId: string,
    claimId: string,
    input: TeacherConfirmationRejectInput,
    requestId: string
  ): Promise<{ data: TeacherConfirmationTeacherDto; known_limits: readonly string[] }> {
    identity(confirmationId);
    identity(claimId);
    identity(requestId);
    if (input.claim_id !== claimId) throw new TeacherConfirmationError("D3_SCOPE_CONFLICT");
    if (
      typeof input.rejection_reason !== "string" ||
      input.rejection_reason.length === 0 ||
      input.rejection_reason.length > 500 ||
      hasUnsafeText(input.rejection_reason)
    ) {
      throw new TeacherConfirmationError("D3_INPUT_INVALID");
    }
    const latest = await this.latest(actor.tenant_id, confirmationId);
    if (!latest || latest.status !== "DRAFT")
      throw new TeacherConfirmationError("D3_LIFECYCLE_INVALID");
    this.assertClaim(actor, claimId, latest.context, latest.evidence_refs);
    const version = `${versionNumber(latest.confirmation_ref.version) + 1}.0.0`;
    const contentDigest = digest({
      ...latest,
      rejection_reason: input.rejection_reason,
      status: "REJECTED",
      version
    });
    const confirmation: TeacherConfirmationVersion = {
      ...clone(latest),
      audit_receipt: {
        action: "teacher_confirmation.reject",
        actor_id: actor.actor_id,
        audit_id: this.createId("audit"),
        recorded_at: this.now(),
        request_id: requestId
      },
      confirmation_ref: { ...latest.confirmation_ref, content_digest: contentDigest, version },
      content_digest: contentDigest,
      created_at: this.now(),
      created_by: actor.actor_id,
      rejection_reason: input.rejection_reason,
      status: "REJECTED",
      supersedes_ref: latest.confirmation_ref
    };
    if (!isTeacherConfirmationVersion(confirmation))
      throw new TeacherConfirmationError("D3_OUTPUT_INVALID");
    await this.append(confirmation, actor, requestId, "teacher_confirmation.reject");
    return {
      data: {
        confirmation,
        known_limits: [...KNOWN_LIMITS],
        runtime_authority: "JSON_INTERNAL_ONLY"
      },
      known_limits: [...KNOWN_LIMITS]
    };
  }

  async revise(
    actor: { actor_id: string; tenant_id: string },
    confirmationId: string,
    input: TeacherConfirmationCommandInput,
    requestId: string
  ): Promise<{
    data: { confirmation: TeacherConfirmationVersion; status: "generated" };
    known_limits: readonly string[];
    runtime_authority: "JSON_INTERNAL_ONLY";
  }> {
    identity(confirmationId);
    if (input.confirmation_id !== confirmationId)
      throw new TeacherConfirmationError("D3_SCOPE_CONFLICT");
    identity(actor.actor_id);
    identity(actor.tenant_id);
    identity(requestId);
    this.assertInput(actor.tenant_id, input);
    this.assertClaim(actor, input.claim_id, input.context, input.evidence_refs);
    ensureSameTenant(actor.tenant_id, [
      input.course_package_ref,
      input.learning_goal_ref,
      input.rubric_ref,
      ...input.evidence_refs
    ]);
    await this.assertReferences(actor.tenant_id, input);
    const latest = await this.latest(actor.tenant_id, confirmationId);
    if (!latest || (latest.status !== "CONFIRMED" && latest.status !== "REJECTED")) {
      throw new TeacherConfirmationError("D3_LIFECYCLE_INVALID");
    }
    const version = `${versionNumber(latest.confirmation_ref.version) + 1}.0.0`;
    const contentDigest = digest({ ...input, status: "DRAFT", version });
    const confirmation = this.createVersion(
      actor,
      input,
      "DRAFT",
      version,
      contentDigest,
      requestId,
      latest.confirmation_ref
    );
    await this.append(confirmation, actor, requestId, "teacher_confirmation.revise");
    return {
      data: { confirmation, status: "generated" },
      known_limits: [...KNOWN_LIMITS],
      runtime_authority: "JSON_INTERNAL_ONLY"
    };
  }

  async list(tenantId: string): Promise<TeacherConfirmationVersion[]> {
    return clone(await this.dependencies.repository.list(tenantId));
  }

  private async latest(
    tenantId: string,
    confirmationId: string
  ): Promise<TeacherConfirmationVersion | null> {
    const records = await this.dependencies.repository.list(tenantId);
    return (
      records
        .filter((record) => record.confirmation_ref.resource_id === confirmationId)
        .sort(
          (left, right) =>
            versionNumber(left.confirmation_ref.version) -
            versionNumber(right.confirmation_ref.version)
        )
        .at(-1) ?? null
    );
  }

  private assertClaim(
    actor: { actor_id: string; tenant_id: string },
    claimId: string,
    context: TeacherConfirmationContext,
    evidenceRefs: readonly TeacherConfirmationExactRef[]
  ): void {
    this.dependencies.claims.assertActive({
      actor_id: actor.actor_id,
      claim_id: claimId,
      context,
      evidence_set_digest: evidenceSetDigest(evidenceRefs),
      now: this.now(),
      tenant_id: actor.tenant_id
    });
  }

  private async assertReferences(
    tenantId: string,
    input: TeacherConfirmationCommandInput
  ): Promise<void> {
    if (
      !isTeacherConfirmationExactRef(input.course_package_ref) ||
      input.course_package_ref.resource_type !== "course_package_version"
    )
      throw new TeacherConfirmationError("D3_EXACT_REF_INVALID");
    const coursePackage = await this.dependencies.coursePackages.getByReference(
      tenantId,
      input.course_package_ref
    );
    if (
      !coursePackage ||
      coursePackage.status !== "AVAILABLE" ||
      coursePackage.content_digest !== input.course_package_ref.content_digest
    )
      throw new TeacherConfirmationError("D3_NOT_FOUND");
    const goal = await this.dependencies.learningDesign.getGoal({
      content_digest: input.learning_goal_ref.content_digest,
      goal_id: input.learning_goal_ref.resource_id,
      tenant_id: tenantId,
      version: input.learning_goal_ref.version
    });
    const rubric = await this.dependencies.learningDesign.getRubric({
      content_digest: input.rubric_ref.content_digest,
      rubric_id: input.rubric_ref.resource_id,
      tenant_id: tenantId,
      version: input.rubric_ref.version
    });
    if (
      !goal ||
      goal.status !== "PUBLISHED" ||
      goal.content_digest !== input.learning_goal_ref.content_digest
    )
      throw new TeacherConfirmationError("D3_NOT_FOUND");
    if (
      !rubric ||
      rubric.status !== "PUBLISHED" ||
      rubric.content_digest !== input.rubric_ref.content_digest
    )
      throw new TeacherConfirmationError("D3_NOT_FOUND");
    if (
      goal.course_package_reference.course_package_id !== input.course_package_ref.resource_id ||
      rubric.course_package_reference.course_package_id !== input.course_package_ref.resource_id
    )
      throw new TeacherConfirmationError("D3_SCOPE_CONFLICT");
    const criterionIds = new Map(
      rubric.criteria.map((criterion) => [
        criterion.criterion_id,
        new Set(criterion.levels.map((level) => level.ordinal))
      ])
    );
    for (const decision of input.criterion_decisions) {
      const levels = criterionIds.get(decision.criterion_id);
      if (!levels || !levels.has(decision.level_ordinal))
        throw new TeacherConfirmationError("D3_RUBRIC_OPTION_INVALID");
    }
    for (const evidenceRef of input.evidence_refs) {
      if (
        !isTeacherConfirmationExactRef(evidenceRef) ||
        evidenceRef.resource_type !== "evidence_artifact"
      )
        throw new TeacherConfirmationError("D3_EVIDENCE_INVALID");
      const evidence = await this.dependencies.evidence.getByReference(tenantId, evidenceRef);
      if (
        !evidence ||
        !equalRef(evidence.artifact_ref, evidenceRef) ||
        evidence.visibility !== "teacher_only" ||
        evidence.context.course_id !== input.context.course_id ||
        evidence.context.run_id !== input.context.run_id ||
        evidence.context.team_id !== input.context.team_id ||
        evidence.context.role_key !== input.context.role_key
      )
        throw new TeacherConfirmationError("D3_EVIDENCE_INVALID");
    }
  }

  private assertInput(tenantId: string, input: TeacherConfirmationCommandInput): void {
    identity(input.confirmation_id);
    identity(input.claim_id);
    identity(input.idempotency_key);
    if (
      !isTeacherConfirmationExactRef(input.learning_goal_ref) ||
      input.learning_goal_ref.resource_type !== "learning_goal_version" ||
      !isTeacherConfirmationExactRef(input.rubric_ref) ||
      input.rubric_ref.resource_type !== "rubric_version"
    )
      throw new TeacherConfirmationError("D3_EXACT_REF_INVALID");
    if (!input.evidence_refs.length || !input.criterion_decisions.length)
      throw new TeacherConfirmationError("D3_INPUT_INVALID");
    if (input.teacher_feedback.length > 2000 || hasUnsafeText(input.teacher_feedback))
      throw new TeacherConfirmationError("D3_INPUT_INVALID");
    ensureSameTenant(tenantId, [
      input.course_package_ref,
      input.learning_goal_ref,
      input.rubric_ref,
      ...input.evidence_refs
    ]);
    [
      input.context.course_id,
      input.context.run_id,
      input.context.team_id,
      input.context.role_key
    ].forEach(identity);
  }

  private createVersion(
    actor: { actor_id: string; tenant_id: string },
    input: TeacherConfirmationCommandInput,
    status: "DRAFT",
    version: string,
    contentDigest: string,
    requestId: string,
    supersedesRef?: TeacherConfirmationExactRef
  ): TeacherConfirmationVersion {
    const confirmation: TeacherConfirmationVersion = {
      audit_receipt: {
        action: "teacher_confirmation.draft_save",
        actor_id: actor.actor_id,
        audit_id: this.createId("audit"),
        recorded_at: this.now(),
        request_id: requestId
      },
      confirmation_ref: {
        content_digest: contentDigest,
        discriminator: "exact_ref",
        resource_id: input.confirmation_id,
        resource_type: "teacher_confirmation_version",
        tenant_id: actor.tenant_id,
        version
      },
      content_digest: contentDigest,
      context: clone(input.context),
      course_package_ref: clone(input.course_package_ref),
      created_at: this.now(),
      created_by: actor.actor_id,
      criterion_decisions: clone(input.criterion_decisions),
      discriminator: "teacher_confirmation_version",
      evidence_refs: clone(input.evidence_refs),
      idempotency_key: input.idempotency_key,
      known_limits: [...KNOWN_LIMITS],
      learning_goal_ref: clone(input.learning_goal_ref),
      rubric_ref: clone(input.rubric_ref),
      schema_version: "teacher-confirmation.v1",
      status,
      teacher_feedback: input.teacher_feedback,
      ...(supersedesRef ? { supersedes_ref: clone(supersedesRef) } : {})
    };
    if (!isTeacherConfirmationVersion(confirmation))
      throw new TeacherConfirmationError("D3_OUTPUT_INVALID");
    return confirmation;
  }

  private async append(
    confirmation: TeacherConfirmationVersion,
    actor: { actor_id: string; tenant_id: string },
    requestId: string,
    action: string
  ): Promise<void> {
    const auditLog: AuditLog = {
      action,
      actor_id: actor.actor_id,
      actor_role: "teacher",
      audit_id: confirmation.audit_receipt.audit_id,
      created_at: confirmation.created_at,
      resource_id: confirmation.confirmation_ref.resource_id,
      resource_type: "teacher_confirmation_version",
      request_id: requestId,
      tenant_id: actor.tenant_id,
      after: {
        confirmation_ref: confirmation.confirmation_ref,
        status: confirmation.status,
        content_digest: confirmation.content_digest
      }
    };
    const command: TeacherConfirmationAppendCommand = { audit_log: auditLog, confirmation };
    await this.dependencies.repository.append(command);
  }
}
