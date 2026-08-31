import { createHash } from "node:crypto";
import { createDeterministicMockGateway, type AgentGatewayInput } from "@simwar/agent-gateway";
import {
  DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES,
  type CurrentUser,
  type W020AdvisoryAuditDto,
  type W020AdvisoryContext,
  type W020AdvisoryEvaluation,
  type W020AdvisoryPolicy,
  type W020AdvisoryProjection,
  type W020AdvisoryReceipt,
  type W020AdvisoryRecord,
  type W020AdvisoryRequest,
  type W020AdvisorySurface,
  type W020EvidenceCitation,
  type W020RoleKey
} from "@simwar/shared-contracts";
import type {
  GovernedAdvisoryRepositoryPort,
  RoleWorkflowRepositoryPort
} from "./repository-ports.js";

const KNOWN_LIMITS = [
  "JSON_INTERNAL_ONLY is the active runtime authority.",
  "The deterministic mock is advisory-only and does not prove AI effectiveness.",
  "Human Validation, Pilot and Production are not performed or authorized.",
  "Durable recovery and external provider integration are not proven.",
  "Human review remains the final authority for every recommendation."
] as const;

const STUDENT_SURFACES = new Set<W020AdvisorySurface>(["student_role", "student_coach"]);
const TEACHER_SURFACES = new Set<W020AdvisorySurface>([
  "teacher_copilot",
  "teacher_debrief",
  "rubric_assistant",
  "competitive_challenge",
  "stakeholder_challenge"
]);

export class W020AdvisoryError extends Error {
  constructor(
    readonly code:
      | "W020_INPUT_INVALID"
      | "W020_FORBIDDEN"
      | "W020_CONTEXT_NOT_FOUND"
      | "W020_DUPLICATE_CONFLICT"
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

function roleForActor(actor: W020Actor): "student" | "teacher" | "admin" {
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
  return "teacher";
}

function assertId(value: string | undefined): string {
  if (!value || value.trim() !== value || !/^[A-Za-z0-9._:-]+$/.test(value))
    throw new W020AdvisoryError("W020_INPUT_INVALID");
  return value;
}

function titleForSurface(surface: W020AdvisorySurface): string {
  const titles: Record<W020AdvisorySurface, string> = {
    competitive_challenge: "Competitive Challenge",
    rubric_assistant: "Debrief Rubric Assistant",
    stakeholder_challenge: "Stakeholder Challenge",
    student_coach: "Student Coach",
    student_role: "Student Role Advisor",
    teacher_copilot: "Teacher Copilot",
    teacher_debrief: "Teacher Debrief Advisor"
  };
  return titles[surface];
}

function citationsForContext(context: W020AdvisoryContext): W020EvidenceCitation[] {
  if (context.source_event_ids.length > 0) {
    return context.source_event_ids.map((sourceId, index) => ({
      citation_id: `event:${sourceId}`,
      label: context.source_event_types[index] ?? "workflow_event",
      source_id: sourceId,
      source_type: "workflow_event"
    }));
  }
  return [
    {
      citation_id: `context:${context.context_digest}`,
      label: "No source event evidence available",
      source_id: context.context_digest,
      source_type: "governed_context"
    }
  ];
}

function policy(): W020AdvisoryPolicy {
  return {
    formal_truth_write: false,
    human_final_authority: true,
    pre_publish_student_exposure: false,
    provider: "OFF"
  };
}

function evaluation(context: W020AdvisoryContext): W020AdvisoryEvaluation {
  const hasSourceEvidence = context.source_event_ids.length > 0;
  return {
    checks: [
      "exact_course_run_round_team_binding",
      "role_scope_allowlist",
      "evidence_citation_present",
      "provider_off",
      "formal_truth_write_false",
      "human_final_authority"
    ],
    fallback: hasSourceEvidence ? "deterministic_rule" : "abstain_no_source_evidence",
    status: hasSourceEvidence ? "passed" : "abstained"
  };
}

function projection(record: W020AdvisoryRecord): W020AdvisoryProjection {
  const evaluated = evaluation(record.context);
  return {
    advisory_only: true,
    evidence_citations: citationsForContext(record.context),
    evaluation: evaluated,
    evidence_refs: [...record.coach_output.evidence_refs],
    known_limits: [
      ...KNOWN_LIMITS,
      ...(evaluated.status === "abstained"
        ? ["No source events were available; the assistant abstained."]
        : [])
    ],
    policy: policy(),
    recommendations: [record.coach_output.advisory_text],
    surface: record.surface,
    title: titleForSurface(record.surface)
  };
}

function scopesForSurface(
  roleKey: W020RoleKey | undefined,
  surface: W020AdvisorySurface
): string[] {
  if (roleKey)
    return [...(DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES[roleKey]?.advisory_scopes ?? [])];
  return surface === "teacher_copilot"
    ? ["strategy", "cross_functional_alignment"]
    : surface === "rubric_assistant"
      ? ["learning_objectives", "rubric"]
      : surface.endsWith("challenge")
        ? ["bounded_challenge", "evidence_review"]
        : ["debrief"];
}

function supportedRoleKey(value: string | undefined): W020RoleKey | undefined {
  return value && ["CEO", "CFO", "CMO", "COO"].includes(value) ? (value as W020RoleKey) : undefined;
}

export interface W020AdvisoryServiceDependencies {
  repository: GovernedAdvisoryRepositoryPort;
  roleWorkflow: RoleWorkflowRepositoryPort;
  gateway?: ReturnType<typeof createDeterministicMockGateway>;
  now?: () => string;
}

export class GovernedAdvisoryService {
  private readonly gateway: ReturnType<typeof createDeterministicMockGateway>;
  private readonly now: () => string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly dependencies: W020AdvisoryServiceDependencies) {
    this.gateway = dependencies.gateway ?? createDeterministicMockGateway();
    this.now = dependencies.now ?? (() => new Date().toISOString());
  }

  async createAdvisory(
    actor: W020Actor,
    request: W020AdvisoryRequest,
    requestId: string
  ): Promise<W020AdvisoryReceipt> {
    const actorRole = roleForActor(actor);
    if (STUDENT_SURFACES.has(request.surface)) {
      if (actorRole !== "student" || !actor.team_id || request.team_id !== actor.team_id)
        throw new W020AdvisoryError("W020_FORBIDDEN");
      return this.create(actor, request, requestId, actorRole);
    }
    if (!TEACHER_SURFACES.has(request.surface) || actorRole === "student")
      throw new W020AdvisoryError("W020_FORBIDDEN");
    return this.create(actor, request, requestId, actorRole);
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
    if (
      request.surface !== "teacher_debrief" ||
      !["teacher", "admin"].includes(roleForActor(actor))
    )
      throw new W020AdvisoryError("W020_FORBIDDEN");
    return this.create(actor, request, requestId, roleForActor(actor));
  }

  async listTeacherAudit(actor: W020Actor): Promise<W020AdvisoryAuditDto[]> {
    if (!["teacher", "admin"].includes(roleForActor(actor)))
      throw new W020AdvisoryError("W020_FORBIDDEN");
    const records = await this.dependencies.repository.list(actor.tenant_id);
    return records.map((record) => ({
      context_digest: record.context.context_digest,
      cost_usd: record.model_call_log.cost_usd,
      created_at: record.model_call_log.created_at,
      input_hash: record.model_call_log.input_hash,
      latency_ms: record.model_call_log.latency_ms,
      model: record.model_call_log.model,
      model_call_log_id: record.model_call_log.model_call_log_id,
      output_hash: record.model_call_log.output_hash,
      prompt_tokens: record.model_call_log.prompt_tokens,
      completion_tokens: record.model_call_log.completion_tokens,
      provider: record.model_call_log.provider,
      purpose: record.model_call_log.purpose,
      status: record.model_call_log.status,
      surface: record.surface,
      tenant_id: record.tenant_id
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
    const idempotencyKey = assertId(request.idempotency_key);
    const snapshot = await this.dependencies.roleWorkflow.readRoleWorkflow({
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
      snapshot.run.tenant_id !== actor.tenant_id ||
      snapshot.team.tenant_id !== actor.tenant_id ||
      snapshot.team.course_id !== snapshot.run.course_id ||
      snapshot.round.round_id !== roundId
    ) {
      throw new W020AdvisoryError("W020_CONTEXT_NOT_FOUND");
    }
    const assignment = snapshot.assignments.find(
      (candidate) =>
        candidate.status === "active" &&
        (actorRole !== "student" || candidate.user_id === actor.user_id) &&
        (!request.role_key || candidate.role_key === request.role_key)
    );
    if (actorRole === "student" && (!assignment || assignment.user_id !== actor.user_id))
      throw new W020AdvisoryError("W020_FORBIDDEN");
    const roleKey = assignment?.role_key ?? request.role_key;
    const advisoryRoleKey = supportedRoleKey(roleKey);
    const scopes = scopesForSurface(advisoryRoleKey, request.surface);
    if (scopes.length === 0) throw new W020AdvisoryError("W020_FORBIDDEN");
    const safeEvents = snapshot.events
      .filter((event) => !event.round_id || event.round_id === roundId)
      .slice(-50)
      .map((event) => ({
        event_id: event.event_id,
        event_type: event.event_type,
        created_at: event.created_at
      }));
    const context: W020AdvisoryContext = {
      actor_id_hash: digest(actor.user_id),
      actor_role: actorRole,
      advisory_scopes: scopes,
      context_digest: digest({
        actor_role: actorRole,
        course_id: snapshot.course.course_id,
        role_key: advisoryRoleKey ?? null,
        round_id: roundId,
        run_id: runId,
        source_events: safeEvents,
        team_id: teamId,
        tenant_id: actor.tenant_id
      }),
      course_id: snapshot.course.course_id,
      discriminator: "w020_role_safe_context",
      ...(advisoryRoleKey ? { role_key: advisoryRoleKey } : {}),
      round_id: roundId,
      run_id: runId,
      source_event_ids: safeEvents.map((event) => event.event_id),
      source_event_types: safeEvents.map((event) => event.event_type),
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
        const existingRoleKey = existing.context.role_key ?? null;
        const requestRoleKey = context.role_key ?? null;
        const sameExactScope =
          existing.tenant_id === actor.tenant_id &&
          existing.context.course_id === context.course_id &&
          existing.context.run_id === context.run_id &&
          existing.context.round_id === context.round_id &&
          existing.context.team_id === context.team_id &&
          existing.surface === request.surface &&
          existingRoleKey === requestRoleKey;
        if (!sameExactScope || existing.request_digest !== requestDigest)
          throw new W020AdvisoryError("W020_DUPLICATE_CONFLICT");
        return this.receipt(existing, requestId, "reused");
      }
      const gatewayInput: AgentGatewayInput = {
        context,
        surface: request.surface,
        ...(roleKey ? { role_key: roleKey as W020RoleKey } : {})
      };
      const generated = this.gateway.generate(gatewayInput);
      const createdAt = this.now();
      const citations = citationsForContext(context);
      const record: W020AdvisoryRecord = {
        coach_output: {
          ...generated.coach_output,
          evidence_refs: citations.map((citation) => citation.citation_id)
        },
        context,
        created_at: createdAt,
        discriminator: "w020_advisory_record",
        idempotency_key: idempotencyKey,
        model_call_log: { ...generated.model_call_log, created_at: createdAt },
        request_digest: requestDigest,
        surface: request.surface,
        tenant_id: actor.tenant_id
      };
      try {
        await this.dependencies.repository.append(record);
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
      coach_output: clone(record.coach_output),
      context: clone(record.context),
      discriminator: "w020_advisory_receipt",
      formal_truth_write: false,
      known_limits: [...KNOWN_LIMITS],
      model_call_log: clone(record.model_call_log),
      projection: projection(record),
      request_digest: record.request_digest,
      request_id: requestId,
      status
    };
  }
}
