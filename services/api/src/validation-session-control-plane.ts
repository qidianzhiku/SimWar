import { createHash, randomUUID } from "node:crypto";
import type {
  AuditLog,
  CurrentUser,
  ValidationSessionIncident,
  ValidationSessionListDto,
  ValidationSessionObservation,
  ValidationSessionParticipant,
  ValidationSessionPreflight,
  ValidationSessionRecord,
  ValidationSessionStatus
} from "@simwar/shared-contracts";
import {
  actorHasPermission,
  VALIDATION_SESSION_SCHEMA_VERSION,
  VALIDATION_SESSION_DUTIES,
  type ValidationSessionDuty,
  type ValidationSessionEvidenceBundle
} from "@simwar/shared-contracts";
import type { RepositoryProvider } from "./repository-provider.js";

const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const FORBIDDEN = [
  "state_true",
  "private_replay",
  "replay_manifest",
  "settlement_payload",
  "decision_batch_hash",
  "json_runtime_source_digest",
  "canonical_evidence_digest",
  "provider_secret"
];
const LIMITS = [
  "JSON_INTERNAL_ONLY",
  "HUMAN_VALIDATION_NOT_PERFORMED",
  "TEACHING_EFFECTIVENESS_NOT_PROVEN",
  "REAL_HUMAN_ATTESTATION_NOT_PROVEN",
  "DURABLE_RECOVERY_NOT_PROVEN",
  "SESSION_DUTY_IS_NOT_PLATFORM_RBAC"
] as const;

export class ValidationSessionControlPlaneError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ValidationSessionControlPlaneError";
  }
}

function reject(statusCode: number, code: string, message: string): never {
  throw new ValidationSessionControlPlaneError(statusCode, code, message);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function assertTeacher(actor: CurrentUser, tenantId: string): void {
  if (
    actor.tenant_id !== tenantId ||
    !actorHasPermission(actor, "course:read") ||
    (!actor.roles.includes("teacher") && !actor.roles.includes("tenant_admin"))
  ) {
    reject(403, "W023_AUTHZ-403-001", "teacher session-control authority required");
  }
}

function assertId(value: unknown, field: string): string {
  if (typeof value !== "string" || !ID.test(value)) {
    reject(422, "W023-422-001", `${field} is invalid`);
  }
  return value;
}

function assertDigest(value: unknown, field: string): string {
  if (typeof value !== "string" || !DIGEST.test(value)) {
    reject(422, "W023-422-002", `${field} must be a sha256 digest`);
  }
  return value;
}

function assertNoForbidden(value: unknown): void {
  const serialized = JSON.stringify(value).toLowerCase();
  if (FORBIDDEN.some((marker) => serialized.includes(marker.toLowerCase()))) {
    reject(422, "W023_PRIVACY-422-001", "private or formal truth payload is not allowed");
  }
}

function now(): string {
  return new Date().toISOString();
}

function transition(
  session: ValidationSessionRecord,
  actor: CurrentUser,
  to: ValidationSessionStatus,
  requestId: string
): void {
  const from = session.status;
  session.status = to;
  session.transitions.push({ at: now(), from, to, actor_id: actor.user_id, request_id: requestId });
}

function withoutBundle(
  session: ValidationSessionRecord
): Omit<ValidationSessionRecord, "evidence_bundle"> {
  const copy = { ...session };
  delete copy.evidence_bundle;
  return copy;
}

function buildBundle(session: ValidationSessionRecord): ValidationSessionEvidenceBundle {
  const source = withoutBundle(session);
  const evidenceDigest = digest(source);
  const report = [
    `# Validation Session ${session.session_id}`,
    "",
    `- Execution mode: ${session.execution_mode}`,
    `- Status: ${session.status}`,
    `- Source product merge: ${session.source_product_merge_sha}`,
    `- Context: ${session.tenant_id} / ${session.course_id} / ${session.run_id}`,
    `- Evidence digest: ${evidenceDigest}`,
    "- Human validation: NOT_PERFORMED",
    "- Teaching effectiveness: NOT_PROVEN",
    "- Real human attestation: NOT_PROVEN",
    "- Runtime authority: JSON_INTERNAL_ONLY",
    "",
    "## Known Limits",
    ...LIMITS.map((limit) => `- ${limit}`)
  ].join("\n");
  return {
    schema_version: VALIDATION_SESSION_SCHEMA_VERSION,
    session: source,
    evidence_digest: evidenceDigest,
    execution_mode: "SYNTHETIC_REHEARSAL",
    human_validation: "NOT_PERFORMED",
    teaching_effectiveness: "NOT_PROVEN",
    real_human_attestation: "NOT_PROVEN",
    markdown_report: report
  };
}

export interface CreateValidationSessionInput {
  source_product_merge_sha: string;
  course_id: string;
  run_id: string;
  machine_admission_reference: string;
  machine_admission_digest: string;
  idempotency_key: string;
}

export class ValidationSessionControlPlane {
  constructor(private readonly provider: RepositoryProvider) {}

  async list(actor: CurrentUser, tenantId: string): Promise<ValidationSessionListDto> {
    assertTeacher(actor, tenantId);
    return {
      sessions: await this.provider.facade.validationSessions.list(tenantId),
      known_limits: [...LIMITS],
      runtime_authority: "JSON_INTERNAL_ONLY"
    };
  }

  async create(
    actor: CurrentUser,
    tenantId: string,
    input: CreateValidationSessionInput,
    requestId: string
  ): Promise<ValidationSessionRecord> {
    assertTeacher(actor, tenantId);
    if (!SHA.test(input.source_product_merge_sha))
      reject(422, "W023-422-003", "source merge SHA is invalid");
    const courseId = assertId(input.course_id, "course_id");
    const runId = assertId(input.run_id, "run_id");
    const idempotencyKey = assertId(input.idempotency_key, "idempotency_key");
    const machineRef = assertId(input.machine_admission_reference, "machine_admission_reference");
    const admissionDigest = assertDigest(
      input.machine_admission_digest,
      "machine_admission_digest"
    );
    const existing = (await this.provider.facade.validationSessions.list(tenantId)).find(
      (candidate) => candidate.idempotency_key === idempotencyKey
    );
    if (existing) {
      if (
        existing.course_id !== courseId ||
        existing.run_id !== runId ||
        existing.source_product_merge_sha !== input.source_product_merge_sha
      )
        reject(409, "W023_SESSION-409-001", "conflicting create retry");
      return existing;
    }
    const [course, run] = await Promise.all([
      this.provider.facade.courses.getCourse(tenantId, courseId),
      this.provider.facade.runs.getRun(tenantId, runId)
    ]);
    if (!course || !run || run.course_id !== courseId)
      reject(404, "W023_SESSION-404-001", "exact course/run context not found");
    const session: ValidationSessionRecord = {
      schema_version: VALIDATION_SESSION_SCHEMA_VERSION,
      session_id: `vsession_${randomUUID().replaceAll("-", "")}`,
      execution_mode: "SYNTHETIC_REHEARSAL",
      source_product_merge_sha: input.source_product_merge_sha,
      tenant_id: tenantId,
      course_id: courseId,
      run_id: runId,
      machine_admission_reference: machineRef,
      machine_admission_digest: admissionDigest,
      idempotency_key: idempotencyKey,
      status: "DRAFT",
      created_by: actor.user_id,
      created_at: now(),
      participants: [],
      transitions: [
        { at: now(), from: null, to: "DRAFT", actor_id: actor.user_id, request_id: requestId }
      ],
      observations: [],
      incidents: []
    };
    assertNoForbidden(session);
    await this.provider.facade.validationSessions.save(session);
    await this.audit(
      actor,
      tenantId,
      session.session_id,
      "validation_session.created",
      requestId,
      null,
      session
    );
    return clone(session);
  }

  async get(
    actor: CurrentUser,
    tenantId: string,
    sessionId: string
  ): Promise<ValidationSessionRecord> {
    assertTeacher(actor, tenantId);
    const session = await this.provider.facade.validationSessions.get(tenantId, sessionId);
    if (!session) reject(404, "W023_SESSION-404-002", "validation session not found");
    return session;
  }

  async setRoster(
    actor: CurrentUser,
    tenantId: string,
    sessionId: string,
    participants: ValidationSessionParticipant[],
    requestId: string
  ): Promise<ValidationSessionRecord> {
    const session = await this.get(actor, tenantId, sessionId);
    if (session.status !== "DRAFT" && session.status !== "PREFLIGHT_READY")
      reject(409, "W023_SESSION-409-002", "roster is frozen after LIVE");
    assertNoForbidden(participants);
    if (!Array.isArray(participants) || participants.length < 5)
      reject(422, "W023_ROSTER-422-001", "all five session duties are required");
    const ids = participants.map((participant) =>
      assertId(participant.participant_id, "participant_id")
    );
    if (new Set(ids).size !== ids.length)
      reject(409, "W023_ROSTER-409-001", "duplicate participant id");
    for (const duty of VALIDATION_SESSION_DUTIES) {
      if (!participants.some((participant) => participant.session_duty === duty))
        reject(422, "W023_ROSTER-422-002", `missing duty: ${duty}`);
    }
    for (const participant of participants) {
      if (!VALIDATION_SESSION_DUTIES.includes(participant.session_duty as ValidationSessionDuty))
        reject(422, "W023_ROSTER-422-003", "unknown session duty");
      if (
        participant.session_duty === "LEARNER" &&
        (!participant.product_user_id || !participant.team_id || !participant.role_key)
      )
        reject(422, "W023_ROSTER-422-004", "learner must bind product user, team and role");
      if (participant.product_user_id) {
        const user = await this.provider.facade.identity.getUser(
          tenantId,
          participant.product_user_id
        );
        if (!user || user.status !== "active")
          reject(403, "W023_ROSTER-403-001", "participant user is not active in this tenant");
      }
      if (participant.session_duty === "LEARNER") {
        const team = await this.provider.facade.teams.getTeam(tenantId, participant.team_id ?? "");
        if (
          !team ||
          team.course_id !== session.course_id ||
          !team.members.some(
            (member) =>
              member.user_id === participant.product_user_id &&
              member.role_slot === participant.role_key
          )
        ) {
          reject(403, "W023_ROSTER-403-002", "learner team and role binding is not current");
        }
      }
    }
    session.participants = clone(participants);
    delete session.preflight;
    session.status = "DRAFT";
    await this.provider.facade.validationSessions.save(session);
    await this.audit(
      actor,
      tenantId,
      session.session_id,
      "validation_session.roster_changed",
      requestId,
      null,
      session
    );
    return session;
  }

  async preflight(
    actor: CurrentUser,
    tenantId: string,
    sessionId: string,
    requestId: string
  ): Promise<ValidationSessionRecord> {
    const session = await this.get(actor, tenantId, sessionId);
    if (session.status === "LIVE" || session.status === "CLOSED" || session.status === "ABORTED")
      reject(409, "W023_PREFLIGHT-409-001", "session cannot be preflighted in its current state");
    const [course, run, teams] = await Promise.all([
      this.provider.facade.courses.getCourse(tenantId, session.course_id),
      this.provider.facade.runs.getRun(tenantId, session.run_id),
      this.provider.facade.teams.listTeamsForRun(tenantId, session.run_id)
    ]);
    const reasons: string[] = [];
    if (!course || !run || run.course_id !== session.course_id || run.status !== "active") {
      reasons.push("EXACT_COURSE_RUN_MISMATCH");
    }
    if (
      !session.participants.some(
        (participant) =>
          participant.session_duty === "TEACHER" && participant.product_user_id === actor.user_id
      )
    )
      reasons.push("TEACHER_ROSTER_MISSING");
    if (
      session.participants.filter((participant) => participant.session_duty === "LEARNER")
        .length === 0
    )
      reasons.push("LEARNER_ROSTER_MISSING");
    if (teams.length < 2) reasons.push("FRESH_COHORT_NOT_PRESENT");
    const ready = reasons.length === 0;
    const preflight: ValidationSessionPreflight = {
      evaluated_at: now(),
      status: ready ? "PREFLIGHT_READY" : "BLOCKED",
      reasons,
      source_product_merge_sha: session.source_product_merge_sha,
      exact_context: { tenant_id: tenantId, course_id: session.course_id, run_id: session.run_id },
      w022_admission_status: ready ? "READY_FOR_MACHINE_E4" : "BLOCKED",
      cleanup_ready: Boolean(run)
    };
    session.preflight = preflight;
    if (ready) transition(session, actor, "PREFLIGHT_READY", requestId);
    await this.provider.facade.validationSessions.save(session);
    await this.audit(
      actor,
      tenantId,
      session.session_id,
      "validation_session.preflight",
      requestId,
      null,
      preflight
    );
    return session;
  }

  async start(
    actor: CurrentUser,
    tenantId: string,
    sessionId: string,
    requestId: string
  ): Promise<ValidationSessionRecord> {
    const session = await this.get(actor, tenantId, sessionId);
    if (session.status === "LIVE") return session;
    if (session.status !== "PREFLIGHT_READY" || session.preflight?.status !== "PREFLIGHT_READY")
      reject(409, "W023_SESSION-409-003", "passed preflight is required before LIVE");
    transition(session, actor, "LIVE", requestId);
    await this.provider.facade.validationSessions.save(session);
    await this.audit(
      actor,
      tenantId,
      session.session_id,
      "validation_session.started",
      requestId,
      null,
      session
    );
    return session;
  }

  async appendObservation(
    actor: CurrentUser,
    tenantId: string,
    sessionId: string,
    input: Omit<ValidationSessionObservation, "session_id" | "observation_id" | "captured_at">,
    requestId: string
  ): Promise<ValidationSessionRecord> {
    const session = await this.get(actor, tenantId, sessionId);
    if (session.status !== "LIVE")
      reject(409, "W023_OBSERVATION-409-001", "observations require LIVE session");
    if (
      !session.participants.some(
        (participant) =>
          participant.participant_id === input.participant_id &&
          participant.session_duty === input.session_duty
      )
    )
      reject(403, "W023_OBSERVATION-403-001", "participant is not on the session roster");
    assertNoForbidden(input);
    const observation: ValidationSessionObservation = {
      ...input,
      session_id: sessionId,
      observation_id: `observation_${randomUUID().replaceAll("-", "")}`,
      captured_at: now(),
      evidence_refs: clone(input.evidence_refs ?? [])
    };
    session.observations.push(observation);
    await this.provider.facade.validationSessions.save(session);
    await this.audit(
      actor,
      tenantId,
      session.session_id,
      "validation_session.observation_appended",
      requestId,
      null,
      { observation_id: observation.observation_id }
    );
    return session;
  }

  async appendIncident(
    actor: CurrentUser,
    tenantId: string,
    sessionId: string,
    input: Omit<ValidationSessionIncident, "session_id" | "incident_id" | "created_at">,
    requestId: string
  ): Promise<ValidationSessionRecord> {
    const session = await this.get(actor, tenantId, sessionId);
    if (session.status !== "LIVE")
      reject(409, "W023_INCIDENT-409-001", "incidents require LIVE session");
    assertNoForbidden(input);
    const incident: ValidationSessionIncident = {
      ...input,
      session_id: sessionId,
      incident_id: `incident_${randomUUID().replaceAll("-", "")}`,
      created_at: now(),
      evidence_refs: clone(input.evidence_refs ?? [])
    };
    session.incidents.push(incident);
    await this.provider.facade.validationSessions.save(session);
    await this.audit(
      actor,
      tenantId,
      session.session_id,
      "validation_session.incident_appended",
      requestId,
      null,
      { incident_id: incident.incident_id }
    );
    return session;
  }

  async close(
    actor: CurrentUser,
    tenantId: string,
    sessionId: string,
    requestId: string
  ): Promise<ValidationSessionRecord> {
    const session = await this.get(actor, tenantId, sessionId);
    if (session.status === "CLOSED") return session;
    if (session.status !== "LIVE")
      reject(409, "W023_SESSION-409-004", "only LIVE session can close");
    session.closed_at = now();
    transition(session, actor, "CLOSED", requestId);
    session.cleanup_receipt = {
      cleanup_id: `cleanup_${session.session_id}`,
      status: "COMPLETED",
      at: now()
    };
    session.evidence_bundle = buildBundle(session);
    await this.provider.facade.validationSessions.save(session);
    await this.audit(
      actor,
      tenantId,
      session.session_id,
      "validation_session.closed",
      requestId,
      null,
      { evidence_digest: session.evidence_bundle.evidence_digest }
    );
    return session;
  }

  async cleanup(
    actor: CurrentUser,
    tenantId: string,
    sessionId: string,
    requestId: string
  ): Promise<ValidationSessionRecord> {
    const session = await this.get(actor, tenantId, sessionId);
    if (session.status !== "ABORTED")
      reject(409, "W023_CLEANUP-409-001", "cleanup requires an aborted session");
    if (session.cleanup_receipt?.status === "COMPLETED") return session;
    session.cleanup_receipt = {
      cleanup_id: `cleanup_${session.session_id}`,
      status: "COMPLETED",
      at: now()
    };
    session.evidence_bundle = buildBundle(session);
    await this.provider.facade.validationSessions.save(session);
    await this.audit(
      actor,
      tenantId,
      session.session_id,
      "validation_session.cleanup",
      requestId,
      null,
      {
        cleanup_id: session.cleanup_receipt.cleanup_id
      }
    );
    return session;
  }

  async abort(
    actor: CurrentUser,
    tenantId: string,
    sessionId: string,
    requestId: string
  ): Promise<ValidationSessionRecord> {
    const session = await this.get(actor, tenantId, sessionId);
    if (session.status === "ABORTED") return session;
    if (session.status === "CLOSED")
      reject(409, "W023_SESSION-409-005", "closed session cannot abort");
    session.aborted_at = now();
    transition(session, actor, "ABORTED", requestId);
    session.cleanup_receipt = {
      cleanup_id: `cleanup_${session.session_id}`,
      status: "READY",
      at: now()
    };
    session.evidence_bundle = buildBundle(session);
    await this.provider.facade.validationSessions.save(session);
    await this.audit(
      actor,
      tenantId,
      session.session_id,
      "validation_session.aborted",
      requestId,
      null,
      { evidence_digest: session.evidence_bundle.evidence_digest }
    );
    return session;
  }

  private async audit(
    actor: CurrentUser,
    tenantId: string,
    resourceId: string,
    action: string,
    requestId: string,
    before: unknown,
    after: unknown
  ): Promise<void> {
    const log: AuditLog = {
      audit_id: this.provider.idGenerator.createAuditLogId(),
      action,
      actor_id: actor.user_id,
      actor_role: actor.roles[0] ?? "teacher",
      created_at: now(),
      request_id: requestId,
      resource_id: resourceId,
      resource_type: "validation_session",
      tenant_id: tenantId,
      ...(before && typeof before === "object"
        ? { before: clone(before) as Record<string, unknown> }
        : {}),
      ...(after && typeof after === "object"
        ? { after: clone(after) as Record<string, unknown> }
        : {})
    };
    await this.provider.facade.auditLogs.appendAuditLog(log);
  }
}
