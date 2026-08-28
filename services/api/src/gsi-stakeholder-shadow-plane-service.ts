import { createHash } from "node:crypto";
import {
  GSI_RESOLVER_VERSION,
  GSI_MODEL_ARTIFACT_ID,
  GSI_MODEL_ARTIFACT_VERSION,
  GSI_MODEL_VERSION,
  GSI_MODEL_VERSION_ID,
  isGSIRequest,
  type CurrentUser,
  type GSIAbstention,
  type GSIAdminProjection,
  type GSIExactBinding,
  type GSIProposal,
  type GSIRecord,
  type GSIReceipt,
  type GSIRequest,
  type GSIResolverResult,
  type GSISignal,
  type GSIStudentProjection,
  type GSITeacherProjection,
  type GSIStakeholderType,
  type W020AdvisoryContext,
  W020_TRANSFORMATION_VERSION
} from "@simwar/shared-contracts";
import { createDeterministicMockGateway } from "@simwar/agent-gateway";
import type {
  GSIStakeholderRepositoryPort,
  ParameterSetRepositoryPort,
  RoleWorkflowRepositoryPort,
  RoleWorkflowRepositorySnapshot,
  ScenarioRepositoryPort
} from "./repository-ports.js";

const KNOWN_LIMITS = [
  "Provider OFF; the deterministic resolver is a candidate path only.",
  "The candidate has no official state, settlement, score, rank, or replay influence.",
  "Student output is a published role-safe projection; raw proposals remain teacher/admin scoped.",
  "JSON_INTERNAL_ONLY is the active runtime authority."
] as const;

export class GSIStakeholderShadowPlaneError extends Error {
  constructor(
    readonly code:
      | "GSI_INPUT_INVALID"
      | "GSI_FORBIDDEN"
      | "GSI_CONTEXT_NOT_FOUND"
      | "GSI_DUPLICATE_CONFLICT"
      | "GSI_NOT_FOUND"
      | "GSI_NOT_PUBLISHED"
      | "GSI_PERSISTENCE_FAILED"
  ) {
    super(code);
    this.name = "GSIStakeholderShadowPlaneError";
  }
}

type GSIActor = Pick<CurrentUser, "user_id" | "tenant_id" | "roles" | "team_id">;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function canonicalize(value: unknown): string {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`)
      .join(",")}}`;
  }
  throw new GSIStakeholderShadowPlaneError("GSI_INPUT_INVALID");
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

function round(value: number): number {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function compareStableStrings(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function isTeacherLike(actor: GSIActor): boolean {
  return actor.roles.some((role) => ["teacher", "tenant_admin", "platform_admin"].includes(role));
}

function isStudentLike(actor: GSIActor): boolean {
  return actor.roles.some((role) => ["student", "learner", "team_captain"].includes(role));
}

function assertBinding(binding: GSIExactBinding, actor: GSIActor): void {
  if (binding.tenant_id !== actor.tenant_id) {
    throw new GSIStakeholderShadowPlaneError("GSI_FORBIDDEN");
  }
  const values = Object.values(binding);
  if (
    values.some(
      (value) =>
        value.length === 0 ||
        value.trim() !== value ||
        ["latest", "default"].includes(value.toLowerCase())
    )
  ) {
    throw new GSIStakeholderShadowPlaneError("GSI_INPUT_INVALID");
  }
}

function assertContext(binding: GSIExactBinding, snapshot: RoleWorkflowRepositorySnapshot): void {
  const matches =
    snapshot.course?.course_id === binding.course_id &&
    snapshot.course.tenant_id === binding.tenant_id &&
    snapshot.run?.run_id === binding.run_id &&
    snapshot.run.course_id === binding.course_id &&
    snapshot.run.tenant_id === binding.tenant_id &&
    snapshot.run.scenario_package_id === binding.scenario_package_id &&
    snapshot.run.parameter_set_id === binding.parameter_set_id &&
    snapshot.round?.round_id === binding.round_id &&
    snapshot.round.run_id === binding.run_id &&
    snapshot.round.tenant_id === binding.tenant_id &&
    snapshot.team?.team_id === binding.team_id &&
    snapshot.team.course_id === binding.course_id &&
    snapshot.team.tenant_id === binding.tenant_id;
  if (!matches) throw new GSIStakeholderShadowPlaneError("GSI_CONTEXT_NOT_FOUND");
}

async function assertExactReferences(
  binding: GSIExactBinding,
  exactReferences: {
    getScenarioPackage: ScenarioRepositoryPort["getScenarioPackage"];
    getParameterSet: ParameterSetRepositoryPort["getParameterSet"];
  }
): Promise<void> {
  if (
    binding.model_version_id !== GSI_MODEL_VERSION_ID ||
    binding.model_version !== GSI_MODEL_VERSION ||
    binding.model_artifact_id !== GSI_MODEL_ARTIFACT_ID ||
    binding.model_artifact_version !== GSI_MODEL_ARTIFACT_VERSION
  ) {
    throw new GSIStakeholderShadowPlaneError("GSI_CONTEXT_NOT_FOUND");
  }
  const [scenario, parameterSet] = await Promise.all([
    exactReferences.getScenarioPackage(binding.tenant_id, binding.scenario_package_id),
    exactReferences.getParameterSet(binding.tenant_id, binding.parameter_set_id)
  ]);
  if (
    !scenario ||
    scenario.tenant_id !== binding.tenant_id ||
    scenario.scenario_package_id !== binding.scenario_package_id ||
    scenario.version !== binding.scenario_version ||
    !parameterSet ||
    parameterSet.tenant_id !== binding.tenant_id ||
    parameterSet.parameter_set_id !== binding.parameter_set_id ||
    parameterSet.version !== binding.parameter_set_version
  ) {
    throw new GSIStakeholderShadowPlaneError("GSI_CONTEXT_NOT_FOUND");
  }
}

function safeW020Context(
  actor: GSIActor,
  binding: GSIExactBinding,
  snapshot: RoleWorkflowRepositorySnapshot
): W020AdvisoryContext {
  const sourceEvents = snapshot.events
    .filter((event) => !event.round_id || event.round_id === binding.round_id)
    .slice(-50)
    .map((event) => ({
      event_id: event.event_id,
      event_type: event.event_type,
      created_at: event.created_at
    }));
  return {
    actor_id_hash: digest(actor.user_id),
    actor_role: "teacher",
    advisory_scopes: ["debrief", "stakeholder_shadow"],
    context_digest: digest({
      actor_role: "teacher",
      course_id: binding.course_id,
      round_id: binding.round_id,
      run_id: binding.run_id,
      source_events: sourceEvents,
      team_id: binding.team_id,
      tenant_id: binding.tenant_id
    }),
    course_id: binding.course_id,
    discriminator: "w020_role_safe_context",
    round_id: binding.round_id,
    run_id: binding.run_id,
    source_event_ids: sourceEvents.map((event) => event.event_id),
    source_event_types: sourceEvents.map((event) => event.event_type),
    team_id: binding.team_id,
    tenant_id: binding.tenant_id,
    transformation_version: W020_TRANSFORMATION_VERSION
  };
}

function summary(signals: GSISignal[], abstentions: GSIAbstention[]): string {
  return `${signals.length} bounded stakeholder signal${signals.length === 1 ? "" : "s"} resolved; ${abstentions.length} proposal${abstentions.length === 1 ? "" : "s"} abstained in Provider-OFF shadow mode.`;
}

export function resolveGSIProposal(proposals: readonly GSIProposal[]): GSIResolverResult {
  if (proposals.length === 0 || proposals.length > 5) {
    throw new GSIStakeholderShadowPlaneError("GSI_INPUT_INVALID");
  }
  const sorted = [...proposals].sort((left, right) =>
    compareStableStrings(left.proposal_id, right.proposal_id)
  );
  const accepted: string[] = [];
  const signals: GSISignal[] = [];
  const abstentions: GSIAbstention[] = [];
  const seenIntents = new Set<string>();
  const signalCounters = new Map<GSIStakeholderType, number>();

  for (const proposal of sorted) {
    const priority = proposal.priority;
    const influence = proposal.influence;
    if (!Number.isFinite(priority) || !Number.isFinite(influence)) {
      abstentions.push({ proposal_id: proposal.proposal_id, reason: "non_finite" });
      continue;
    }
    if (priority < 0 || priority > 1 || influence < -1 || influence > 1) {
      abstentions.push({ proposal_id: proposal.proposal_id, reason: "out_of_bounds" });
      continue;
    }
    const intentKey = `${proposal.stakeholder_type}:${proposal.intent}`;
    if (seenIntents.has(intentKey)) {
      abstentions.push({ proposal_id: proposal.proposal_id, reason: "duplicate" });
      continue;
    }
    seenIntents.add(intentKey);
    accepted.push(proposal.proposal_id);
    const nextCounter = (signalCounters.get(proposal.stakeholder_type) ?? 0) + 1;
    signalCounters.set(proposal.stakeholder_type, nextCounter);
    signals.push({
      signal_id: `signal_${proposal.stakeholder_type}_${nextCounter}`,
      stakeholder_type: proposal.stakeholder_type,
      intent: proposal.intent,
      bounded_value: round(clamp(priority * influence, -1, 1)),
      source_proposal_count: 1
    });
  }

  const outsideOption = 0.2;
  const candidateValue = round(
    clamp(
      signals.reduce((total, signal) => total + signal.bounded_value, 0),
      -1,
      1
    )
  );
  const signalDigest = digest(signals);
  const abstentionDigest = digest({
    accepted_proposal_ids: accepted,
    abstentions,
    signals
  });
  const candidateDigest = digest({
    candidate_value: candidateValue,
    outside_option: outsideOption,
    signal_digest: signalDigest
  });
  return {
    resolver_version: GSI_RESOLVER_VERSION,
    accepted_proposal_ids: accepted,
    signals,
    abstentions,
    outside_option: outsideOption,
    candidate_value: candidateValue,
    resolver_digest: abstentionDigest,
    signal_digest: signalDigest,
    candidate_digest: candidateDigest
  };
}

export interface GSIStakeholderShadowPlaneServiceDependencies {
  repository: GSIStakeholderRepositoryPort;
  roleWorkflow: RoleWorkflowRepositoryPort;
  exactReferences: {
    getScenarioPackage: ScenarioRepositoryPort["getScenarioPackage"];
    getParameterSet: ParameterSetRepositoryPort["getParameterSet"];
  };
  gateway?: ReturnType<typeof createDeterministicMockGateway>;
  now?: () => string;
}

export class GSIStakeholderShadowPlaneService {
  private readonly gateway: ReturnType<typeof createDeterministicMockGateway>;
  private readonly now: () => string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly dependencies: GSIStakeholderShadowPlaneServiceDependencies) {
    this.gateway = dependencies.gateway ?? createDeterministicMockGateway();
    this.now = dependencies.now ?? (() => new Date().toISOString());
  }

  async createCandidate(
    actor: GSIActor,
    request: GSIRequest,
    requestId: string
  ): Promise<GSIReceipt> {
    if (!isTeacherLike(actor) || !isGSIRequest(request)) {
      throw new GSIStakeholderShadowPlaneError(
        isTeacherLike(actor) ? "GSI_INPUT_INVALID" : "GSI_FORBIDDEN"
      );
    }
    assertBinding(request.binding, actor);
    const snapshot = await this.dependencies.roleWorkflow.readRoleWorkflow({
      tenant_id: actor.tenant_id,
      run_id: request.binding.run_id,
      round_id: request.binding.round_id,
      team_id: request.binding.team_id
    });
    assertContext(request.binding, snapshot);
    await assertExactReferences(request.binding, this.dependencies.exactReferences);
    const requestDigest = digest(request);
    const candidateId = `gsi_candidate_${requestDigest.slice(0, 16)}`;
    return this.withWriteLock(async () => {
      const existing = await this.dependencies.repository.list(actor.tenant_id);
      const sameIdempotency = existing.find(
        (record) => record.idempotency_key === request.idempotency_key
      );
      if (sameIdempotency) {
        if (sameIdempotency.request_digest !== requestDigest) {
          throw new GSIStakeholderShadowPlaneError("GSI_DUPLICATE_CONFLICT");
        }
        return this.receipt(sameIdempotency, requestId, "reused");
      }
      const resolver = resolveGSIProposal(request.proposals);
      const advisoryContext = safeW020Context(actor, request.binding, snapshot);
      const gatewayResult = this.gateway.generate({
        context: advisoryContext,
        surface: "teacher_debrief"
      });
      const createdAt = this.now();
      const modelCallLog = { ...clone(gatewayResult.model_call_log), created_at: createdAt };
      const auditLog = {
        action: "gsi.candidate.create",
        actor_id: actor.user_id,
        actor_role: actor.roles.includes("platform_admin")
          ? "platform_admin"
          : actor.roles.includes("tenant_admin")
            ? "tenant_admin"
            : "teacher",
        after: {
          context_digest: advisoryContext.context_digest,
          model_call_log_id: modelCallLog.model_call_log_id,
          provider: "OFF",
          writes_official_truth: false
        },
        audit_id: `gsi_audit_${candidateId}`,
        created_at: createdAt,
        request_id: requestId,
        resource_id: candidateId,
        resource_type: "gsi_stakeholder_shadow_candidate",
        tenant_id: actor.tenant_id
      } as const;
      const knownLimits = [...KNOWN_LIMITS];
      const activeAssignment = snapshot.assignments.find(
        (assignment) => assignment.status === "active"
      );
      const teacherProjection: GSITeacherProjection = {
        surface: "teacher",
        summary: summary(resolver.signals, resolver.abstentions),
        advisory_text: gatewayResult.coach_output.advisory_text,
        known_limits: knownLimits
      };
      const studentProjection: GSIStudentProjection = {
        surface: "student",
        ...(activeAssignment ? { role_key: activeAssignment.role_key } : {}),
        summary: "Published role-safe stakeholder signal summary.",
        signals: resolver.signals.map(({ stakeholder_type, intent, bounded_value }) => ({
          stakeholder_type,
          intent,
          bounded_value
        })),
        abstentions: resolver.abstentions.map(({ reason }) => ({ reason })),
        known_limits: knownLimits
      };
      const adminProjection: GSIAdminProjection = {
        surface: "admin",
        tenant_id: actor.tenant_id,
        binding: clone(request.binding),
        context_digest: advisoryContext.context_digest,
        model_call_log_id: modelCallLog.model_call_log_id,
        audit_log_id: auditLog.audit_id,
        plane_mode: request.plane_mode,
        provider: "OFF",
        resolver_digest: resolver.resolver_digest,
        signal_digest: resolver.signal_digest,
        candidate_digest: resolver.candidate_digest,
        writes_official_truth: false,
        known_limits: knownLimits
      };
      const record: GSIRecord = {
        discriminator: "gsi_stakeholder_shadow_record",
        tenant_id: actor.tenant_id,
        candidate_id: candidateId,
        actor_id_hash: digest(actor.user_id),
        idempotency_key: request.idempotency_key,
        request_digest: requestDigest,
        request: clone(request),
        context: clone(advisoryContext),
        coach_output: clone(gatewayResult.coach_output),
        model_call_log: modelCallLog,
        audit_log: auditLog,
        resolver,
        teacher_projection: teacherProjection,
        student_projection: studentProjection,
        admin_projection: adminProjection,
        created_at: createdAt
      };
      try {
        await this.dependencies.repository.append(record);
      } catch {
        throw new GSIStakeholderShadowPlaneError("GSI_PERSISTENCE_FAILED");
      }
      return this.receipt(record, requestId, "generated");
    });
  }

  async getTeacherReceipt(actor: GSIActor, candidateId: string, requestId: string) {
    if (!isTeacherLike(actor)) throw new GSIStakeholderShadowPlaneError("GSI_FORBIDDEN");
    const record = await this.getRecord(actor.tenant_id, candidateId);
    return this.receipt(record, requestId, "generated");
  }

  async getStudentProjection(actor: GSIActor, candidateId: string): Promise<GSIStudentProjection> {
    if (!isStudentLike(actor) || !actor.team_id) {
      throw new GSIStakeholderShadowPlaneError("GSI_FORBIDDEN");
    }
    const record = await this.getRecord(actor.tenant_id, candidateId);
    if (record.request.publication_status !== "PUBLISHED") {
      throw new GSIStakeholderShadowPlaneError("GSI_NOT_PUBLISHED");
    }
    if (record.request.binding.team_id !== actor.team_id) {
      throw new GSIStakeholderShadowPlaneError("GSI_FORBIDDEN");
    }
    const snapshot = await this.dependencies.roleWorkflow.readRoleWorkflow({
      tenant_id: actor.tenant_id,
      run_id: record.request.binding.run_id,
      round_id: record.request.binding.round_id,
      team_id: record.request.binding.team_id
    });
    const assignment = snapshot.assignments.find(
      (candidate) => candidate.status === "active" && candidate.user_id === actor.user_id
    );
    if (!assignment) throw new GSIStakeholderShadowPlaneError("GSI_FORBIDDEN");
    return clone({
      ...record.student_projection,
      role_key: assignment.role_key
    });
  }

  async getAdminProjection(
    actor: GSIActor,
    tenantId: string,
    candidateId: string
  ): Promise<GSIAdminProjection> {
    if (!actor.roles.some((role) => ["tenant_admin", "platform_admin"].includes(role))) {
      throw new GSIStakeholderShadowPlaneError("GSI_FORBIDDEN");
    }
    if (!tenantId || (actor.tenant_id !== tenantId && !actor.roles.includes("platform_admin"))) {
      throw new GSIStakeholderShadowPlaneError("GSI_FORBIDDEN");
    }
    const record = await this.getRecord(tenantId, candidateId);
    if (record.admin_projection.tenant_id !== tenantId) {
      throw new GSIStakeholderShadowPlaneError("GSI_CONTEXT_NOT_FOUND");
    }
    return clone(record.admin_projection);
  }

  private async getRecord(tenantId: string, candidateId: string): Promise<GSIRecord> {
    const record = await this.dependencies.repository.get(tenantId, candidateId);
    if (!record) throw new GSIStakeholderShadowPlaneError("GSI_NOT_FOUND");
    return record;
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
    record: GSIRecord,
    requestId: string,
    status: "generated" | "reused"
  ): GSIReceipt {
    return {
      discriminator: "gsi_stakeholder_shadow_receipt",
      status,
      request_id: requestId,
      candidate_id: record.candidate_id,
      request_digest: record.request_digest,
      binding: clone(record.request.binding),
      plane_mode: record.request.plane_mode,
      publication_status: record.request.publication_status,
      resolver: clone(record.resolver),
      teacher_projection: clone(record.teacher_projection),
      formal_truth_write: false,
      writes_official_truth: false,
      provider: "OFF",
      known_limits: [...KNOWN_LIMITS]
    };
  }
}
