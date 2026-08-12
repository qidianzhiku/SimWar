import { createHash } from "node:crypto";
import {
  createDeterministicMockProvider,
  createGovernedAgentGateway,
  type AgentGatewayInput,
  type GovernedAgentGateway
} from "@simwar/agent-gateway";
import {
  DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES,
  type CurrentUser,
  type TeachingClosureDto,
  type W020AdvisoryAuditDto,
  type W020AdvisoryAuditRecord,
  type W020AdvisoryContext,
  type W020AdvisoryProjection,
  type W020AdvisoryReceipt,
  type W020AdvisoryRecord,
  type W020AdvisoryRequest,
  type W020RoleKey,
  type W020TeacherSafeSource
} from "@simwar/shared-contracts";
import type {
  GovernedAdvisoryRepositoryPort,
  RoleWorkflowRepositoryPort
} from "./repository-ports.js";
import type { TeachingClosureQueryService } from "./teaching-closure-query.js";

const KNOWN_LIMITS = [
  "JSON_INTERNAL_ONLY is the active runtime authority.",
  "The deterministic mock is advisory-only and does not prove AI effectiveness.",
  "Human Validation, Pilot and Production are not performed or authorized.",
  "Durable recovery and external provider integration are not proven."
] as const;

export class W020AdvisoryError extends Error {
  constructor(
    readonly code:
      | "W020_INPUT_INVALID"
      | "W020_FORBIDDEN"
      | "W020_CONTEXT_NOT_FOUND"
      | "W020_SOURCE_NOT_ELIGIBLE"
      | "W020_DUPLICATE_CONFLICT"
      | "W020_PROVIDER_FAILED"
      | "W020_OUTPUT_REJECTED"
      | "W020_PERSISTENCE_FAILED"
  ) {
    super(code);
    this.name = "W020AdvisoryError";
  }
}

type W020Actor = Pick<CurrentUser, "user_id" | "tenant_id" | "roles" | "team_id">;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function canonicalize(value: unknown): string {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  )
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`)
      .join(",")}}`;
  }
  throw new W020AdvisoryError("W020_INPUT_INVALID");
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

function roleForActor(actor: W020Actor): "student" | "teacher" | "admin" | undefined {
  if (
    actor.roles.includes("student") ||
    actor.roles.includes("learner") ||
    actor.roles.includes("team_captain")
  )
    return "student";
  if (
    actor.roles.includes("admin") ||
    actor.roles.includes("tenant_admin") ||
    actor.roles.includes("platform_admin")
  )
    return "admin";
  if (actor.roles.includes("teacher")) return "teacher";
  return undefined;
}

function assertId(value: string | undefined): string {
  if (
    !value ||
    value.trim() !== value ||
    !/^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(value) ||
    /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i.test(value)
  )
    throw new W020AdvisoryError("W020_INPUT_INVALID");
  return value;
}

function toTeacherSafeSource(
  closure: TeachingClosureDto,
  expected: {
    activity_id: string;
    course_id: string;
    role_key: W020RoleKey;
    run_id: string;
    team_id: string;
  }
): W020TeacherSafeSource {
  const sameContext =
    closure.context.activity_id === expected.activity_id &&
    closure.context.course_id === expected.course_id &&
    closure.context.role_key === expected.role_key &&
    closure.context.run_id === expected.run_id &&
    closure.context.team_id === expected.team_id &&
    JSON.stringify(closure.queue_item.context) === JSON.stringify(closure.context);
  if (
    !sameContext ||
    !closure.course_report_available ||
    closure.runtime_authority !== "JSON_INTERNAL_ONLY" ||
    closure.queue_item.confirmation_status !== "CONFIRMED" ||
    closure.queue_item.outcome_status !== "CONFIRMED" ||
    closure.queue_item.eligible_event_count < 1 ||
    closure.queue_item.evidence_count < 1 ||
    closure.queue_item.missing.length !== 0 ||
    closure.student_safe_preview.status !== "CONFIRMED" ||
    closure.student_safe_preview.visibility !== "student_safe" ||
    closure.student_safe_preview.criterion_count < 1 ||
    closure.student_safe_preview.evidence_count < 1
  ) {
    throw new W020AdvisoryError("W020_SOURCE_NOT_ELIGIBLE");
  }
  return {
    activity_id: expected.activity_id,
    confirmation_status: "CONFIRMED",
    course_report_available: true,
    eligible_event_count: closure.queue_item.eligible_event_count,
    evidence_count: closure.queue_item.evidence_count,
    known_limits: [...closure.known_limits],
    missing: [],
    outcome_status: "CONFIRMED",
    role_key: expected.role_key,
    runtime_authority: "JSON_INTERNAL_ONLY",
    source_schema_version: "teaching-closure.v1",
    student_safe_preview: {
      criterion_count: closure.student_safe_preview.criterion_count,
      evidence_count: closure.student_safe_preview.evidence_count,
      next_focus: closure.student_safe_preview.next_focus,
      status: "CONFIRMED",
      visibility: "student_safe"
    }
  };
}

function projection(record: W020AdvisoryRecord): W020AdvisoryProjection {
  const result: W020AdvisoryProjection = {
    advisory_only: true,
    evidence_refs: [...record.context.source_event_ids],
    known_limits: [...KNOWN_LIMITS],
    recommendations: [record.coach_output.advisory_text],
    surface: record.surface,
    title: record.surface === "student_role" ? "Student Role Advisor" : "Teacher Debrief Advisor"
  };
  if (record.surface === "teacher_debrief" && record.context.teacher_safe_source) {
    const source = record.context.teacher_safe_source;
    result.teacher_debrief = {
      activity_id: source.activity_id,
      discussion_prompts: [
        `Discuss the confirmed ${source.role_key} evidence for ${source.activity_id}.`
      ],
      explanations: [
        `${source.evidence_count} evidence artifact(s) and ${source.eligible_event_count} eligible event(s) support the confirmed outcome.`
      ],
      next_focus: source.student_safe_preview.next_focus,
      role_key: source.role_key,
      tradeoffs: [
        "Compare the confirmed evidence coverage with the listed Known Limits before selecting a follow-up question."
      ]
    };
  }
  return result;
}

export interface W020AdvisoryServiceDependencies {
  repository: GovernedAdvisoryRepositoryPort;
  roleWorkflow: RoleWorkflowRepositoryPort;
  teachingClosure: Pick<TeachingClosureQueryService, "get">;
  gateway?: GovernedAgentGateway;
  now?: () => string;
}

export class GovernedAdvisoryService {
  private readonly gateway: GovernedAgentGateway;
  private readonly now: () => string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly dependencies: W020AdvisoryServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date().toISOString());
    this.gateway =
      dependencies.gateway ??
      createGovernedAgentGateway(createDeterministicMockProvider(), {
        now: () => new Date(this.now())
      });
  }

  async createStudentRoleAdvisory(
    actor: W020Actor,
    request: W020AdvisoryRequest,
    requestId: string
  ): Promise<W020AdvisoryReceipt> {
    if (request.surface !== "student_role" || roleForActor(actor) !== "student")
      throw new W020AdvisoryError("W020_FORBIDDEN");
    if (!actor.team_id || request.team_id !== actor.team_id)
      throw new W020AdvisoryError("W020_FORBIDDEN");
    return this.create(actor, request, requestId, "student");
  }

  async createTeacherDebriefAdvisory(
    actor: W020Actor,
    request: W020AdvisoryRequest,
    requestId: string
  ): Promise<W020AdvisoryReceipt> {
    const actorRole = roleForActor(actor);
    if (
      request.surface !== "teacher_debrief" ||
      !actorRole ||
      !["teacher", "admin"].includes(actorRole)
    )
      throw new W020AdvisoryError("W020_FORBIDDEN");
    return this.create(actor, request, requestId, actorRole);
  }

  async listTeacherAudit(actor: W020Actor): Promise<W020AdvisoryAuditDto[]> {
    const actorRole = roleForActor(actor);
    if (!actorRole || !["teacher", "admin"].includes(actorRole))
      throw new W020AdvisoryError("W020_FORBIDDEN");
    const audits = await this.dependencies.repository.listAudit(actor.tenant_id);
    return audits.map((audit) => ({
      context_digest: audit.context_digest,
      cost_usd: audit.model_call_log.cost_usd,
      created_at: audit.model_call_log.created_at,
      input_hash: audit.model_call_log.input_hash,
      latency_ms: audit.model_call_log.latency_ms,
      model: audit.model_call_log.model,
      model_call_log_id: audit.model_call_log.model_call_log_id,
      output_hash: audit.model_call_log.output_hash,
      prompt_tokens: audit.model_call_log.prompt_tokens,
      completion_tokens: audit.model_call_log.completion_tokens,
      provider: audit.model_call_log.provider,
      purpose: audit.model_call_log.purpose,
      status: audit.model_call_log.status,
      surface: audit.surface,
      tenant_id: audit.tenant_id
    }));
  }

  private async create(
    actor: W020Actor,
    request: W020AdvisoryRequest,
    requestId: string,
    actorRole: "student" | "teacher" | "admin"
  ): Promise<W020AdvisoryReceipt> {
    const runId = assertId(request.run_id);
    const roundId = assertId(request.round_id);
    const teamId = assertId(request.team_id);
    const roleKey = assertId(request.role_key) as W020RoleKey;
    const idempotencyKey = assertId(request.idempotency_key);
    const activityId =
      request.surface === "teacher_debrief" ? assertId(request.activity_id) : undefined;
    const snapshot = this.dependencies.roleWorkflow.readRoleWorkflow({
      round_id: roundId,
      run_id: runId,
      team_id: teamId,
      tenant_id: actor.tenant_id
    });
    if (
      !snapshot.course ||
      !snapshot.run ||
      !snapshot.round ||
      !snapshot.team ||
      snapshot.course.tenant_id !== actor.tenant_id ||
      snapshot.run.run_id !== runId ||
      snapshot.run.tenant_id !== actor.tenant_id ||
      snapshot.run.course_id !== snapshot.course.course_id ||
      snapshot.team.team_id !== teamId ||
      snapshot.team.tenant_id !== actor.tenant_id ||
      snapshot.team.course_id !== snapshot.course.course_id ||
      snapshot.round.round_id !== roundId ||
      snapshot.round.run_id !== runId ||
      snapshot.round.tenant_id !== actor.tenant_id
    ) {
      throw new W020AdvisoryError("W020_CONTEXT_NOT_FOUND");
    }
    const assignment = snapshot.assignments.find(
      (candidate) =>
        candidate.status === "active" &&
        (actorRole !== "student" || candidate.user_id === actor.user_id) &&
        candidate.role_key === roleKey
    );
    if (actorRole === "student" && (!assignment || assignment.user_id !== actor.user_id))
      throw new W020AdvisoryError("W020_FORBIDDEN");
    if (actorRole !== "student" && !assignment)
      throw new W020AdvisoryError("W020_SOURCE_NOT_ELIGIBLE");
    const scopes =
      actorRole === "student"
        ? [...(DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES[roleKey]?.advisory_scopes ?? [])]
        : ["debrief"];
    if (scopes.length === 0) throw new W020AdvisoryError("W020_FORBIDDEN");
    let teacherSafeSource: W020TeacherSafeSource | undefined;
    if (actorRole !== "student") {
      if (
        !["published", "active"].includes(snapshot.course.status) ||
        snapshot.run.status !== "completed" ||
        snapshot.round.status !== "published" ||
        !activityId
      ) {
        throw new W020AdvisoryError("W020_SOURCE_NOT_ELIGIBLE");
      }
      let closure: TeachingClosureDto;
      try {
        closure = await this.dependencies.teachingClosure.get(
          { actor_id: actor.user_id, tenant_id: actor.tenant_id },
          {
            activity_id: activityId,
            course_id: snapshot.course.course_id,
            role_key: roleKey,
            run_id: runId,
            team_id: teamId
          }
        );
      } catch {
        throw new W020AdvisoryError("W020_SOURCE_NOT_ELIGIBLE");
      }
      teacherSafeSource = toTeacherSafeSource(closure, {
        activity_id: activityId,
        course_id: snapshot.course.course_id,
        role_key: roleKey,
        run_id: runId,
        team_id: teamId
      });
    }
    const safeEvents =
      actorRole === "student"
        ? snapshot.events
            .filter((event) => !event.round_id || event.round_id === roundId)
            .slice(-50)
            .map((event) => ({
              event_id: event.event_id,
              event_type: event.event_type
            }))
        : [];
    const actorIdHash = digest(actor.user_id);
    const context: W020AdvisoryContext = {
      actor_id_hash: actorIdHash,
      actor_role: actorRole,
      advisory_scopes: scopes,
      context_digest: digest({
        actor_id_hash: actorIdHash,
        actor_role: actorRole,
        course_id: snapshot.course.course_id,
        activity_id: activityId ?? null,
        role_key: roleKey,
        round_id: roundId,
        run_id: runId,
        source_events: safeEvents,
        teacher_safe_source: teacherSafeSource ?? null,
        team_id: teamId,
        tenant_id: actor.tenant_id
      }),
      course_id: snapshot.course.course_id,
      discriminator: "w020_role_safe_context",
      role_key: roleKey,
      ...(activityId ? { activity_id: activityId } : {}),
      round_id: roundId,
      run_id: runId,
      source_event_ids: safeEvents.map((event) => event.event_id),
      source_event_types: safeEvents.map((event) => event.event_type),
      ...(teacherSafeSource ? { teacher_safe_source: teacherSafeSource } : {}),
      team_id: teamId,
      tenant_id: actor.tenant_id,
      transformation_version: "w020-role-safe-context-v1"
    };
    const requestDigest = digest({
      context_digest: context.context_digest,
      idempotency_key: idempotencyKey,
      surface: request.surface
    });
    return this.withWriteLock(async () => {
      const existing = (await this.dependencies.repository.list(actor.tenant_id)).find(
        (record) => record.idempotency_key === idempotencyKey
      );
      if (existing) {
        if (existing.request_digest !== requestDigest)
          throw new W020AdvisoryError("W020_DUPLICATE_CONFLICT");
        return this.receipt(existing, requestId, "reused");
      }
      const gatewayInput: AgentGatewayInput = {
        context,
        surface: request.surface,
        role_key: roleKey
      };
      const generated = this.gateway.generate(gatewayInput);
      const audit: W020AdvisoryAuditRecord = {
        context_digest: context.context_digest,
        created_at: generated.model_call_log.created_at,
        discriminator: "w020_advisory_audit_record",
        idempotency_key: idempotencyKey,
        model_call_log: generated.model_call_log,
        request_digest: requestDigest,
        surface: request.surface,
        tenant_id: actor.tenant_id
      };
      if (generated.status !== "succeeded") {
        try {
          await this.dependencies.repository.appendAudit(audit);
        } catch {
          throw new W020AdvisoryError("W020_PERSISTENCE_FAILED");
        }
        throw new W020AdvisoryError(
          generated.status === "failed" ? "W020_PROVIDER_FAILED" : "W020_OUTPUT_REJECTED"
        );
      }
      const record: W020AdvisoryRecord = {
        coach_output: generated.coach_output,
        context,
        created_at: generated.model_call_log.created_at,
        discriminator: "w020_advisory_record",
        idempotency_key: idempotencyKey,
        model_call_log: generated.model_call_log,
        request_digest: requestDigest,
        surface: request.surface,
        tenant_id: actor.tenant_id
      };
      try {
        await this.dependencies.repository.appendSuccess({ audit, record });
      } catch {
        throw new W020AdvisoryError("W020_PERSISTENCE_FAILED");
      }
      return this.receipt(record, requestId, "generated");
    });
  }

  private async withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const turn = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this.writeQueue;
    this.writeQueue = previous.then(() => turn);
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private receipt(
    record: W020AdvisoryRecord,
    requestId: string,
    status: "generated" | "reused"
  ): W020AdvisoryReceipt {
    return {
      context: clone(record.context),
      discriminator: "w020_advisory_receipt",
      formal_truth_write: false,
      known_limits: [...KNOWN_LIMITS],
      projection: projection(record),
      request_digest: record.request_digest,
      request_id: requestId,
      status
    };
  }
}
