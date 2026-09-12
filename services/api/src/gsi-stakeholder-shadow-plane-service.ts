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
  type GSICrossRoundAdminProjection,
  type GSICrossRoundPairOptions,
  type GSICrossRoundSelectionContext,
  type GSICrossRoundStudentProjection,
  type GSICrossRoundTeacherProjection,
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
import { compareGSICandidates, type GSIComparisonCandidate } from "./gsi-cross-round-comparison.js";
import {
  GSICrossRoundContextAdapter,
  GSICrossRoundContextError,
  type GSIContextBinding
} from "./gsi-cross-round-context-adapter.js";

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
      | "GSI_COMPARISON_INVALID"
      | "GSI_REBASE_REQUIRED"
      | "GSI_CONTEXT_UNAVAILABLE"
      | "GSI_PAIR_NOT_AVAILABLE"
      | "GSI_PAIR_AMBIGUOUS"
  ) {
    super(code);
    this.name = "GSIStakeholderShadowPlaneError";
  }
}

type GSIActor = Pick<CurrentUser, "user_id" | "tenant_id" | "roles" | "team_id">;

export type GSIRequestSurface = "teacher" | "student" | "admin";

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

function surfaceForActor(actor: GSIActor): "teacher" | "student" | "admin" | null {
  return actor.roles.some((role) => ["tenant_admin", "platform_admin"].includes(role))
    ? "admin"
    : isStudentLike(actor)
      ? "student"
      : isTeacherLike(actor)
        ? "teacher"
        : null;
}

function surfaceForRequest(
  actor: GSIActor,
  requestedSurface?: GSIRequestSurface
): GSIRequestSurface {
  if (!requestedSurface) {
    const inferredSurface = surfaceForActor(actor);
    if (!inferredSurface) throw new GSIStakeholderShadowPlaneError("GSI_FORBIDDEN");
    return inferredSurface;
  }
  const authorized =
    requestedSurface === "admin"
      ? actor.roles.some((role) => ["tenant_admin", "platform_admin"].includes(role))
      : requestedSurface === "student"
        ? isStudentLike(actor)
        : isTeacherLike(actor);
  if (!authorized) throw new GSIStakeholderShadowPlaneError("GSI_FORBIDDEN");
  return requestedSurface;
}

function assertExactSelectionValue(value: string): void {
  if (
    !value ||
    value.trim() !== value ||
    ["latest", "current", "default", "fallback", "first", "last", "newest"].includes(
      value.toLowerCase()
    )
  ) {
    throw new GSIStakeholderShadowPlaneError("GSI_INPUT_INVALID");
  }
}

function assertSelectionContext(input: GSICrossRoundSelectionContext): void {
  for (const value of Object.values(input)) assertExactSelectionValue(value);
}

function sameProducerLineage(left: GSIRecord, right: GSIRecord): boolean {
  const leftBinding = left.request.binding;
  const rightBinding = right.request.binding;
  return (
    leftBinding.tenant_id === rightBinding.tenant_id &&
    leftBinding.course_id === rightBinding.course_id &&
    leftBinding.run_id === rightBinding.run_id &&
    leftBinding.team_id === rightBinding.team_id &&
    leftBinding.scenario_package_id === rightBinding.scenario_package_id &&
    leftBinding.scenario_version === rightBinding.scenario_version &&
    leftBinding.parameter_set_id === rightBinding.parameter_set_id &&
    leftBinding.parameter_set_version === rightBinding.parameter_set_version &&
    leftBinding.model_version_id === rightBinding.model_version_id &&
    leftBinding.model_version === rightBinding.model_version &&
    leftBinding.model_artifact_id === rightBinding.model_artifact_id &&
    leftBinding.model_artifact_version === rightBinding.model_artifact_version
  );
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
  crossRoundContextAdapter?: GSICrossRoundContextAdapter;
}

export interface GSICrossRoundComparisonQuery {
  readonly from_candidate_id: string;
  readonly to_candidate_id: string;
  readonly activity_id: string;
  readonly role_key: string;
  readonly expected_comparison_digest?: string;
  readonly expected_context_digest?: string;
}

export interface GSICrossRoundRoundPairQuery extends GSICrossRoundSelectionContext {
  readonly from_round_id: string;
  readonly to_round_id: string;
  readonly expected_comparison_digest?: string;
  readonly expected_context_digest?: string;
}

export type GSICrossRoundPairOptionsQuery = GSICrossRoundSelectionContext;

export class GSIStakeholderShadowPlaneService {
  private readonly gateway: ReturnType<typeof createDeterministicMockGateway>;
  private readonly now: () => string;
  private readonly crossRoundContextAdapter: GSICrossRoundContextAdapter;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly dependencies: GSIStakeholderShadowPlaneServiceDependencies) {
    this.gateway = dependencies.gateway ?? createDeterministicMockGateway();
    this.now = dependencies.now ?? (() => new Date().toISOString());
    this.crossRoundContextAdapter =
      dependencies.crossRoundContextAdapter ??
      new GSICrossRoundContextAdapter({
        readW3: async () => null,
        readM2P5: async () => null
      });
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

  async compareCandidates(
    actor: GSIActor,
    input: GSICrossRoundComparisonQuery,
    tenantId = actor.tenant_id,
    requestedSurface?: GSIRequestSurface
  ): Promise<
    GSICrossRoundTeacherProjection | GSICrossRoundAdminProjection | GSICrossRoundStudentProjection
  > {
    const surface = surfaceForRequest(actor, requestedSurface);
    if (tenantId !== actor.tenant_id && !actor.roles.includes("platform_admin")) {
      throw new GSIStakeholderShadowPlaneError("GSI_FORBIDDEN");
    }
    if (
      !input.from_candidate_id ||
      !input.to_candidate_id ||
      !input.activity_id ||
      !input.role_key
    ) {
      throw new GSIStakeholderShadowPlaneError("GSI_INPUT_INVALID");
    }
    assertExactSelectionValue(input.from_candidate_id);
    assertExactSelectionValue(input.to_candidate_id);
    assertExactSelectionValue(input.activity_id);
    assertExactSelectionValue(input.role_key);
    if (input.from_candidate_id === input.to_candidate_id) {
      throw new GSIStakeholderShadowPlaneError("GSI_COMPARISON_INVALID");
    }
    const [fromRecord, toRecord] = await Promise.all([
      this.getRecord(tenantId, input.from_candidate_id),
      this.getRecord(tenantId, input.to_candidate_id)
    ]);
    return this.compareRecordPair(actor, surface, tenantId, input, fromRecord, toRecord);
  }

  async getPairOptions(
    actor: GSIActor,
    input: GSICrossRoundPairOptionsQuery,
    tenantId = actor.tenant_id,
    requestedSurface?: GSIRequestSurface
  ): Promise<GSICrossRoundPairOptions> {
    const surface = surfaceForRequest(actor, requestedSurface);
    if (tenantId !== actor.tenant_id && !actor.roles.includes("platform_admin")) {
      throw new GSIStakeholderShadowPlaneError("GSI_FORBIDDEN");
    }
    assertSelectionContext({
      course_id: input.course_id,
      run_id: input.run_id,
      team_id: input.team_id,
      activity_id: input.activity_id,
      role_key: input.role_key
    });
    if (surface === "student" && input.team_id !== actor.team_id) {
      throw new GSIStakeholderShadowPlaneError("GSI_FORBIDDEN");
    }
    const records = (await this.dependencies.repository.list(tenantId)).filter((record) => {
      const binding = record.request.binding;
      return (
        binding.tenant_id === tenantId &&
        binding.course_id === input.course_id &&
        binding.run_id === input.run_id &&
        binding.team_id === input.team_id
      );
    });
    const visibleRecords: GSIRecord[] = [];
    for (const record of records) {
      try {
        await this.readSelectionSnapshot(
          actor,
          surface,
          tenantId,
          input,
          record.request.binding.round_id,
          record
        );
        visibleRecords.push(record);
      } catch (error) {
        if (
          surface === "student" &&
          error instanceof GSIStakeholderShadowPlaneError &&
          error.code === "GSI_PAIR_NOT_AVAILABLE"
        ) {
          continue;
        }
        throw error;
      }
    }
    const grouped = new Map<string, GSIRecord[]>();
    for (const record of visibleRecords) {
      const roundRecords = grouped.get(record.request.binding.round_id) ?? [];
      roundRecords.push(record);
      grouped.set(record.request.binding.round_id, roundRecords);
    }
    const rounds: Array<{ round_id: string; round_no: number }> = [];
    for (const [roundId, roundRecords] of grouped) {
      if (roundRecords.length !== 1) continue;
      const record = roundRecords[0];
      if (!record) continue;
      const snapshot = await this.dependencies.roleWorkflow.readRoleWorkflow({
        tenant_id: tenantId,
        run_id: record.request.binding.run_id,
        round_id: record.request.binding.round_id,
        team_id: record.request.binding.team_id
      });
      assertContext(record.request.binding, snapshot);
      if (!snapshot.round) throw new GSIStakeholderShadowPlaneError("GSI_CONTEXT_NOT_FOUND");
      rounds.push({ round_id: roundId, round_no: snapshot.round.round_no });
    }
    rounds.sort((left, right) => {
      const roundDifference = left.round_no - right.round_no;
      if (roundDifference !== 0) return roundDifference;
      return compareStableStrings(left.round_id, right.round_id);
    });
    return {
      surface,
      context: { ...input, tenant_id: tenantId },
      rounds,
      provider: "OFF",
      official_truth_write: false,
      non_causal: true,
      causal_proof: false,
      known_limits: [...KNOWN_LIMITS, "回合列表只展示服务器确认的唯一、兼容且可见候选。"]
    };
  }

  async compareRoundPair(
    actor: GSIActor,
    input: GSICrossRoundRoundPairQuery,
    tenantId = actor.tenant_id,
    requestedSurface?: GSIRequestSurface
  ): Promise<
    GSICrossRoundTeacherProjection | GSICrossRoundAdminProjection | GSICrossRoundStudentProjection
  > {
    const surface = surfaceForRequest(actor, requestedSurface);
    if (tenantId !== actor.tenant_id && !actor.roles.includes("platform_admin")) {
      throw new GSIStakeholderShadowPlaneError("GSI_FORBIDDEN");
    }
    assertSelectionContext({
      course_id: input.course_id,
      run_id: input.run_id,
      team_id: input.team_id,
      activity_id: input.activity_id,
      role_key: input.role_key
    });
    assertExactSelectionValue(input.from_round_id);
    assertExactSelectionValue(input.to_round_id);
    if (input.from_round_id === input.to_round_id) {
      throw new GSIStakeholderShadowPlaneError("GSI_COMPARISON_INVALID");
    }
    const records = (await this.dependencies.repository.list(tenantId)).filter((record) => {
      const binding = record.request.binding;
      return (
        binding.tenant_id === tenantId &&
        binding.course_id === input.course_id &&
        binding.run_id === input.run_id &&
        binding.team_id === input.team_id &&
        (binding.round_id === input.from_round_id || binding.round_id === input.to_round_id)
      );
    });
    const visibleRecords: GSIRecord[] = [];
    for (const record of records) {
      try {
        if (surface === "student") {
          await this.readSelectionSnapshot(
            actor,
            surface,
            tenantId,
            input,
            record.request.binding.round_id,
            record
          );
        }
        visibleRecords.push(record);
      } catch (error) {
        if (
          surface === "student" &&
          error instanceof GSIStakeholderShadowPlaneError &&
          error.code === "GSI_PAIR_NOT_AVAILABLE"
        ) {
          continue;
        }
        throw error;
      }
    }
    const byRound = (roundId: string): GSIRecord[] =>
      visibleRecords.filter((record) => record.request.binding.round_id === roundId);
    const fromMatches = byRound(input.from_round_id);
    const toMatches = byRound(input.to_round_id);
    if (fromMatches.length === 0 || toMatches.length === 0) {
      throw new GSIStakeholderShadowPlaneError("GSI_PAIR_NOT_AVAILABLE");
    }
    if (fromMatches.length > 1 || toMatches.length > 1) {
      throw new GSIStakeholderShadowPlaneError("GSI_PAIR_AMBIGUOUS");
    }
    const fromRecord = fromMatches[0];
    const toRecord = toMatches[0];
    if (!fromRecord || !toRecord) {
      throw new GSIStakeholderShadowPlaneError("GSI_PAIR_NOT_AVAILABLE");
    }
    await Promise.all([
      this.readSelectionSnapshot(actor, surface, tenantId, input, input.from_round_id, fromRecord),
      this.readSelectionSnapshot(actor, surface, tenantId, input, input.to_round_id, toRecord)
    ]);
    if (!sameProducerLineage(fromRecord, toRecord)) {
      throw new GSIStakeholderShadowPlaneError("GSI_COMPARISON_INVALID");
    }
    return this.compareRecordPair(
      actor,
      surface,
      tenantId,
      {
        from_candidate_id: fromRecord.candidate_id,
        to_candidate_id: toRecord.candidate_id,
        activity_id: input.activity_id,
        role_key: input.role_key,
        ...(input.expected_comparison_digest
          ? { expected_comparison_digest: input.expected_comparison_digest }
          : {}),
        ...(input.expected_context_digest
          ? { expected_context_digest: input.expected_context_digest }
          : {})
      },
      fromRecord,
      toRecord
    );
  }

  private async compareRecordPair(
    actor: GSIActor,
    surface: "teacher" | "student" | "admin",
    tenantId: string,
    input: GSICrossRoundComparisonQuery,
    fromRecord: GSIRecord,
    toRecord: GSIRecord
  ): Promise<
    GSICrossRoundTeacherProjection | GSICrossRoundAdminProjection | GSICrossRoundStudentProjection
  > {
    if (
      fromRecord.request.binding.tenant_id !== tenantId ||
      toRecord.request.binding.tenant_id !== tenantId
    ) {
      throw new GSIStakeholderShadowPlaneError("GSI_FORBIDDEN");
    }
    if (fromRecord.request.binding.team_id !== toRecord.request.binding.team_id) {
      throw new GSIStakeholderShadowPlaneError("GSI_COMPARISON_INVALID");
    }
    if (
      surface === "student" &&
      (fromRecord.request.publication_status !== "PUBLISHED" ||
        toRecord.request.publication_status !== "PUBLISHED")
    ) {
      throw new GSIStakeholderShadowPlaneError("GSI_NOT_PUBLISHED");
    }
    if (surface === "student" && fromRecord.request.binding.team_id !== actor.team_id) {
      throw new GSIStakeholderShadowPlaneError("GSI_FORBIDDEN");
    }
    const [fromSnapshot, toSnapshot] = await Promise.all([
      this.dependencies.roleWorkflow.readRoleWorkflow({
        tenant_id: tenantId,
        run_id: fromRecord.request.binding.run_id,
        round_id: fromRecord.request.binding.round_id,
        team_id: fromRecord.request.binding.team_id
      }),
      this.dependencies.roleWorkflow.readRoleWorkflow({
        tenant_id: tenantId,
        run_id: toRecord.request.binding.run_id,
        round_id: toRecord.request.binding.round_id,
        team_id: toRecord.request.binding.team_id
      })
    ]);
    assertContext(fromRecord.request.binding, fromSnapshot);
    assertContext(toRecord.request.binding, toSnapshot);
    if (!fromSnapshot.round || !toSnapshot.round) {
      throw new GSIStakeholderShadowPlaneError("GSI_CONTEXT_NOT_FOUND");
    }
    if (
      surface === "student" &&
      [fromSnapshot, toSnapshot].some(
        (snapshot) =>
          !snapshot.assignments.some(
            (assignment) =>
              assignment.status === "active" &&
              assignment.user_id === actor.user_id &&
              assignment.role_key === input.role_key
          )
      )
    ) {
      throw new GSIStakeholderShadowPlaneError("GSI_FORBIDDEN");
    }
    const fromCandidate: GSIComparisonCandidate = {
      candidate_id: fromRecord.candidate_id,
      binding: fromRecord.request.binding,
      round_no: fromSnapshot.round.round_no,
      candidate_digest: fromRecord.resolver.candidate_digest,
      signals: fromRecord.resolver.signals.map(({ stakeholder_type, intent, bounded_value }) => ({
        stakeholder_type,
        intent,
        bounded_value
      }))
    };
    const toCandidate: GSIComparisonCandidate = {
      candidate_id: toRecord.candidate_id,
      binding: toRecord.request.binding,
      round_no: toSnapshot.round.round_no,
      candidate_digest: toRecord.resolver.candidate_digest,
      signals: toRecord.resolver.signals.map(({ stakeholder_type, intent, bounded_value }) => ({
        stakeholder_type,
        intent,
        bounded_value
      }))
    };
    let comparison;
    try {
      comparison = compareGSICandidates({
        from: fromCandidate,
        to: toCandidate,
        ...(input.expected_comparison_digest
          ? { expected_comparison_digest: input.expected_comparison_digest }
          : {})
      });
    } catch (error) {
      if (error instanceof Error && error.message === "GSI_REBASE_REQUIRED") {
        throw new GSIStakeholderShadowPlaneError("GSI_REBASE_REQUIRED");
      }
      throw new GSIStakeholderShadowPlaneError("GSI_COMPARISON_INVALID");
    }
    const context: GSIContextBinding = {
      activity_id: input.activity_id,
      course_id: fromRecord.request.binding.course_id,
      role_key: input.role_key,
      round_id: toRecord.request.binding.round_id,
      round_no: toSnapshot.round.round_no,
      run_id: toRecord.request.binding.run_id,
      team_id: toRecord.request.binding.team_id,
      tenant_id: tenantId
    };
    let contextProjection;
    try {
      contextProjection = await this.crossRoundContextAdapter.read({
        context,
        ...(input.expected_context_digest
          ? { expected_context_digest: input.expected_context_digest }
          : {})
      });
    } catch (error) {
      if (error instanceof GSICrossRoundContextError) {
        throw new GSIStakeholderShadowPlaneError(
          error.code === "GSI_CONTEXT_REBASE_REQUIRED"
            ? "GSI_REBASE_REQUIRED"
            : "GSI_COMPARISON_INVALID"
        );
      }
      throw new GSIStakeholderShadowPlaneError("GSI_COMPARISON_INVALID");
    }
    if (surface === "student") {
      return {
        surface,
        movements: comparison.movements.map(
          ({ stakeholder_type, intent, from_value, to_value, delta, direction }) => ({
            stakeholder_type,
            intent,
            ...(from_value === undefined ? {} : { from_value }),
            ...(to_value === undefined ? {} : { to_value }),
            ...(delta === undefined ? {} : { delta }),
            direction
          })
        ),
        context_status: contextProjection.status,
        non_causal: true,
        causal_proof: false,
        provider: "OFF",
        official_truth_write: false,
        known_limits: [...comparison.known_limits, ...contextProjection.known_limits],
        recovery: contextProjection.recovery
      };
    }
    if (surface === "admin") {
      return {
        surface: "admin",
        tenant_id: tenantId,
        comparison,
        context: { ...contextProjection, context_binding: context },
        provider: "OFF",
        official_truth_write: false,
        known_limits: [...comparison.known_limits, ...contextProjection.known_limits],
        recovery: contextProjection.recovery
      };
    }
    const teacherProjection: GSICrossRoundTeacherProjection = {
      surface: "teacher",
      comparison,
      context: contextProjection,
      provider: "OFF",
      official_truth_write: false,
      known_limits: [...comparison.known_limits, ...contextProjection.known_limits],
      recovery: contextProjection.recovery
    };
    return teacherProjection;
  }

  private async readSelectionSnapshot(
    actor: GSIActor,
    surface: "teacher" | "student" | "admin",
    tenantId: string,
    input: GSICrossRoundSelectionContext,
    roundId: string,
    record: GSIRecord
  ): Promise<RoleWorkflowRepositorySnapshot> {
    if (record.request.binding.round_id !== roundId) {
      throw new GSIStakeholderShadowPlaneError("GSI_CONTEXT_NOT_FOUND");
    }
    if (surface === "student") {
      if (record.request.publication_status !== "PUBLISHED") {
        throw new GSIStakeholderShadowPlaneError("GSI_PAIR_NOT_AVAILABLE");
      }
      if (record.request.binding.team_id !== actor.team_id) {
        throw new GSIStakeholderShadowPlaneError("GSI_FORBIDDEN");
      }
    }
    const snapshot = await this.dependencies.roleWorkflow.readRoleWorkflow({
      tenant_id: tenantId,
      run_id: record.request.binding.run_id,
      round_id: record.request.binding.round_id,
      team_id: record.request.binding.team_id
    });
    assertContext(record.request.binding, snapshot);
    if (!snapshot.round) throw new GSIStakeholderShadowPlaneError("GSI_CONTEXT_NOT_FOUND");
    if (surface === "student") {
      const assignment = snapshot.assignments.some(
        (candidate) =>
          candidate.status === "active" &&
          candidate.user_id === actor.user_id &&
          candidate.role_key === input.role_key
      );
      if (!assignment) throw new GSIStakeholderShadowPlaneError("GSI_PAIR_NOT_AVAILABLE");
    }
    return snapshot;
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
