import { createHash } from "node:crypto";
import {
  D2_ELIGIBLE_EVENT_TYPES,
  D2_EVIDENCE_SCHEMA_VERSION,
  isD2ExactRef,
  isD2EvidenceArtifactVersion,
  type D2CaptureReceipt,
  type D2EvidenceArtifactVersion,
  type D2EvidenceCaptureInput,
  type D2EvidenceListDto,
  type D2EvidenceQuery,
  type D2ExactRef,
  type D2ProvenanceEdge,
  type D2SourceEventDto
} from "@simwar/shared-contracts";
import type {
  AuditLog,
  LearningGoalVersion,
  RubricVersion,
  RoleWorkflowEvent
} from "@simwar/shared-contracts";
import type {
  EvidenceProvenanceRepositoryPort,
  RoleWorkflowRepositoryPort
} from "./repository-ports.js";

const KNOWN_LIMITS = [
  "D2 evidence is not learning confirmation or final grading.",
  "JSON_INTERNAL_ONLY is the active runtime authority; durable recovery is not proven.",
  "D2 does not write Truth, SettlementResult, Score, Rank, or Replay authority.",
  "Current RoleWorkflowEvent records do not carry a native activity_id; activity filtering is bounded to the teacher request context."
] as const;
const TRANSFORMATION_RULE_VERSION = "1.0.0";
const TRANSFORMATION_RULE_DIGEST = createHash("sha256")
  .update("simwar:d2:role-workflow-event-to-evidence:v1")
  .digest("hex");
const RESERVED_REFERENCE_TOKEN =
  /(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i;

export interface D2CoursePackageLookup {
  getByReference(
    tenantId: string,
    reference: {
      course_package_id: string;
      tenant_id: string;
      version: string;
      content_digest: string;
    }
  ): Promise<{
    status: string;
    content_digest: string;
    tenant_id: string;
    version: string;
    course_package_id: string;
  } | null>;
}

export interface D2LearningDesignLookup {
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

export interface D2EvidenceDependencies {
  now?: () => string;
  createId?: (kind: string) => string;
  coursePackages: D2CoursePackageLookup;
  learningDesign: D2LearningDesignLookup;
  repository: EvidenceProvenanceRepositoryPort;
  roleWorkflow: RoleWorkflowRepositoryPort;
}

export class D2EvidenceError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "D2EvidenceError";
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
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`)
      .join(",")}}`;
  }
  throw new D2EvidenceError("D2_EVIDENCE_INPUT_INVALID");
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

function identity(value: string, _field: string): string {
  if (
    !value ||
    value.trim() !== value ||
    !/^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(value) ||
    RESERVED_REFERENCE_TOKEN.test(value)
  ) {
    throw new D2EvidenceError("D2_EVIDENCE_INPUT_INVALID");
  }
  return value;
}

function exactRef(
  tenantId: string,
  resourceType: D2ExactRef["resource_type"],
  resourceId: string,
  version: string,
  contentDigest: string
): D2ExactRef {
  identity(tenantId, "tenant_id");
  identity(resourceId, "resource_id");
  identity(version, "version");
  if (!/^[a-f0-9]{64}$/.test(contentDigest))
    throw new D2EvidenceError("D2_EVIDENCE_REFERENCE_INVALID");
  return {
    content_digest: contentDigest,
    discriminator: "exact_ref",
    resource_id: resourceId,
    resource_type: resourceType,
    tenant_id: tenantId,
    version
  };
}

function sameRef(left: D2ExactRef, right: D2ExactRef): boolean {
  return canonicalize(left) === canonicalize(right);
}

function eventRef(event: RoleWorkflowEvent): D2ExactRef {
  return exactRef(event.tenant_id, "role_workflow_event", event.event_id, "1.0.0", digest(event));
}

function coursePackageRef(reference: D2EvidenceCaptureInput["course_package_ref"]): D2ExactRef {
  if (reference.resource_type !== "course_package_version")
    throw new D2EvidenceError("D2_EVIDENCE_REFERENCE_INVALID");
  return reference;
}

function goalRef(reference: D2EvidenceCaptureInput["learning_goal_ref"]): D2ExactRef {
  if (reference.resource_type !== "learning_goal_version")
    throw new D2EvidenceError("D2_EVIDENCE_REFERENCE_INVALID");
  return reference;
}

function rubricRef(reference: D2EvidenceCaptureInput["rubric_ref"]): D2ExactRef {
  if (reference.resource_type !== "rubric_version")
    throw new D2EvidenceError("D2_EVIDENCE_REFERENCE_INVALID");
  return reference;
}

function roleIsAssigned(
  snapshot: Awaited<ReturnType<RoleWorkflowRepositoryPort["readRoleWorkflow"]>>,
  roleKey: string
): boolean {
  return snapshot.assignments.some(
    (assignment) => assignment.role_key === roleKey && assignment.status === "active"
  );
}

function eventMatchesRole(
  snapshot: Awaited<ReturnType<RoleWorkflowRepositoryPort["readRoleWorkflow"]>>,
  event: RoleWorkflowEvent,
  roleKey: string
): boolean {
  return snapshot.assignments.some(
    (assignment) =>
      assignment.role_key === roleKey &&
      assignment.status === "active" &&
      assignment.user_id === event.actor_id
  );
}

export class EvidenceCaptureCommandService {
  private readonly now: () => string;
  private readonly createId: (kind: string) => string;

  constructor(private readonly dependencies: D2EvidenceDependencies) {
    this.now = dependencies.now ?? (() => new Date().toISOString());
    this.createId = dependencies.createId ?? ((kind) => `${kind}_${Date.now()}`);
  }

  async listTeacherEvidence(tenantId: string, query: D2EvidenceQuery): Promise<D2EvidenceListDto> {
    this.assertQuery(tenantId, query);
    const snapshot = await this.dependencies.roleWorkflow.readRoleWorkflow({
      run_id: query.run_id,
      team_id: query.team_id,
      tenant_id: tenantId
    });
    this.assertScope(snapshot, tenantId, query);
    const events = snapshot.events
      .filter((event) =>
        D2_ELIGIBLE_EVENT_TYPES.includes(
          event.event_type as (typeof D2_ELIGIBLE_EVENT_TYPES)[number]
        )
      )
      .filter((event) => eventMatchesRole(snapshot, event, query.role_key))
      .map((event) => this.toSourceEvent(event, snapshot.course!.course_id, query));
    const artifacts = (await this.dependencies.repository.listEvidenceArtifacts(tenantId)).filter(
      (artifact) => this.matchesContext(artifact, query)
    );
    const edges = (await this.dependencies.repository.listProvenanceEdges(tenantId)).filter(
      (edge) => artifacts.some((artifact) => sameRef(edge.source_ref, artifact.artifact_ref))
    );
    return {
      artifacts,
      eligible_events: events,
      known_limits: [...KNOWN_LIMITS],
      provenance_edges: edges,
      runtime_authority: "JSON_INTERNAL_ONLY"
    };
  }

  async capture(
    actor: { actor_id: string; tenant_id: string },
    input: D2EvidenceCaptureInput,
    requestId: string
  ): Promise<D2CaptureReceipt> {
    this.assertQuery(actor.tenant_id, input);
    identity(actor.actor_id, "actor_id");
    const snapshot = await this.dependencies.roleWorkflow.readRoleWorkflow({
      run_id: input.run_id,
      team_id: input.team_id,
      tenant_id: actor.tenant_id
    });
    this.assertScope(snapshot, actor.tenant_id, input);
    const event = snapshot.events.find((candidate) => candidate.event_id === input.source_event_id);
    if (
      !event ||
      !D2_ELIGIBLE_EVENT_TYPES.includes(
        event.event_type as (typeof D2_ELIGIBLE_EVENT_TYPES)[number]
      )
    ) {
      throw new D2EvidenceError("D2_EVIDENCE_EVENT_NOT_ELIGIBLE");
    }
    if (
      event.tenant_id !== actor.tenant_id ||
      event.run_id !== input.run_id ||
      event.team_id !== input.team_id
    ) {
      throw new D2EvidenceError("D2_EVIDENCE_SCOPE_VIOLATION");
    }
    if (!eventMatchesRole(snapshot, event, input.role_key)) {
      throw new D2EvidenceError("D2_EVIDENCE_ROLE_SCOPE_VIOLATION");
    }
    const packageRef = coursePackageRef(input.course_package_ref);
    const goal = await this.requirePublishedGoal(actor.tenant_id, goalRef(input.learning_goal_ref));
    const rubric = await this.requirePublishedRubric(actor.tenant_id, rubricRef(input.rubric_ref));
    const coursePackage = await this.dependencies.coursePackages.getByReference(actor.tenant_id, {
      course_package_id: packageRef.resource_id,
      content_digest: packageRef.content_digest,
      tenant_id: packageRef.tenant_id,
      version: packageRef.version
    });
    if (
      !coursePackage ||
      coursePackage.status !== "AVAILABLE" ||
      coursePackage.content_digest !== packageRef.content_digest
    ) {
      throw new D2EvidenceError("D2_EVIDENCE_COURSE_PACKAGE_NOT_AVAILABLE");
    }
    if (
      goal.course_package_reference.course_package_id !== packageRef.resource_id ||
      goal.course_package_reference.version !== packageRef.version ||
      goal.course_package_reference.content_digest !== packageRef.content_digest ||
      rubric.course_package_reference.course_package_id !== packageRef.resource_id ||
      rubric.course_package_reference.version !== packageRef.version ||
      rubric.course_package_reference.content_digest !== packageRef.content_digest
    ) {
      throw new D2EvidenceError("D2_EVIDENCE_REFERENCE_STALE");
    }
    const sourceRef = eventRef(event);
    const transformationRef = exactRef(
      actor.tenant_id,
      "transformation_rule",
      "d2-role-workflow-event-to-evidence-v1",
      TRANSFORMATION_RULE_VERSION,
      TRANSFORMATION_RULE_DIGEST
    );
    const context = {
      activity_id: identity(input.activity_id, "activity_id"),
      course_id: snapshot.course!.course_id,
      role_key: identity(input.role_key, "role_key"),
      run_id: input.run_id,
      team_id: input.team_id
    };
    const idempotencyKey = digest({
      context,
      course_package_ref: packageRef,
      learning_goal_ref: input.learning_goal_ref,
      rubric_ref: input.rubric_ref,
      source_event_ref: sourceRef,
      transformation_rule_ref: transformationRef
    });
    const artifactDigest = digest({
      artifact_kind: "observation",
      context,
      course_package_ref: packageRef,
      learning_goal_ref: input.learning_goal_ref,
      rubric_ref: input.rubric_ref,
      source_event_ref: sourceRef,
      transformation_rule_ref: transformationRef
    });
    const existing = (
      await this.dependencies.repository.listEvidenceArtifacts(actor.tenant_id)
    ).find((candidate) => candidate.idempotency_key === idempotencyKey);
    if (existing) {
      if (existing.artifact_digest !== artifactDigest)
        throw new D2EvidenceError("D2_EVIDENCE_DUPLICATE_CONFLICT");
      const edges = (
        await this.dependencies.repository.listProvenanceEdges(actor.tenant_id)
      ).filter((edge) => sameRef(edge.source_ref, existing.artifact_ref));
      return this.receipt(existing, edges, "reused", requestId);
    }
    const artifact: D2EvidenceArtifactVersion = {
      artifact_digest: artifactDigest,
      artifact_kind: "observation",
      artifact_ref: exactRef(
        actor.tenant_id,
        "evidence_artifact",
        `artifact_${idempotencyKey.slice(0, 24)}`,
        "1.0.0",
        artifactDigest
      ),
      captured_at: this.now(),
      captured_by: actor.actor_id,
      context,
      course_package_ref: packageRef,
      discriminator: "d2_evidence_artifact_version",
      idempotency_key: idempotencyKey,
      known_limits: [...KNOWN_LIMITS],
      learning_goal_ref: input.learning_goal_ref,
      rubric_ref: input.rubric_ref,
      schema_version: D2_EVIDENCE_SCHEMA_VERSION,
      source_event_ref: sourceRef,
      transformation_rule_ref: transformationRef,
      visibility: "teacher_only"
    };
    if (!isD2EvidenceArtifactVersion(artifact))
      throw new D2EvidenceError("D2_EVIDENCE_OUTPUT_INVALID");
    const provenanceEdges: D2ProvenanceEdge[] = [
      {
        discriminator: "d2_provenance_edge",
        relation: "derived_from",
        source_ref: artifact.artifact_ref,
        target_ref: sourceRef
      },
      {
        discriminator: "d2_provenance_edge",
        relation: "supported_by",
        source_ref: artifact.artifact_ref,
        target_ref: input.learning_goal_ref
      },
      {
        discriminator: "d2_provenance_edge",
        relation: "supported_by",
        source_ref: artifact.artifact_ref,
        target_ref: input.rubric_ref
      }
    ];
    const auditLog: AuditLog = {
      action: "evidence_artifact.capture",
      actor_id: actor.actor_id,
      actor_role: "teacher",
      audit_id: this.createId("audit"),
      created_at: this.now(),
      resource_id: artifact.artifact_ref.resource_id,
      resource_type: "evidence_artifact",
      request_id: requestId,
      tenant_id: actor.tenant_id,
      after: {
        artifact_ref: artifact.artifact_ref,
        artifact_digest: artifact.artifact_digest,
        visibility: artifact.visibility
      }
    };
    await this.dependencies.repository.appendEvidenceCapture({
      artifact,
      provenance_edges: provenanceEdges,
      audit_log: auditLog
    });
    return this.receipt(artifact, provenanceEdges, "generated", requestId);
  }

  private receipt(
    artifact: D2EvidenceArtifactVersion,
    edges: readonly D2ProvenanceEdge[],
    status: "generated" | "reused",
    requestId: string
  ): D2CaptureReceipt {
    return {
      data: { artifact: clone(artifact), provenance_edges: clone(edges), status },
      formal_truth_write: false,
      known_limits: [...KNOWN_LIMITS],
      request_id: requestId,
      schema_version: D2_EVIDENCE_SCHEMA_VERSION
    };
  }

  private toSourceEvent(
    event: RoleWorkflowEvent,
    courseId: string,
    query: D2EvidenceQuery
  ): D2SourceEventDto {
    return {
      created_at: event.created_at,
      event_id: event.event_id,
      event_type: event.event_type as D2SourceEventDto["event_type"],
      eligibility: "eligible",
      scope: {
        course_id: courseId,
        role_key: query.role_key,
        run_id: event.run_id,
        team_id: event.team_id
      },
      source_event_ref: eventRef(event)
    };
  }

  private matchesContext(artifact: D2EvidenceArtifactVersion, query: D2EvidenceQuery): boolean {
    return (
      artifact.context.course_id === query.course_id &&
      artifact.context.run_id === query.run_id &&
      artifact.context.team_id === query.team_id &&
      artifact.context.role_key === query.role_key &&
      artifact.context.activity_id === query.activity_id
    );
  }

  private assertQuery(tenantId: string, query: D2EvidenceQuery | D2EvidenceCaptureInput): void {
    [
      tenantId,
      query.course_id,
      query.run_id,
      query.team_id,
      query.role_key,
      query.activity_id
    ].forEach((value) => identity(value, "scope"));
    if ("source_event_id" in query) identity(query.source_event_id, "source_event_id");
    if ("course_package_ref" in query) {
      if (
        !isD2ExactRef(query.course_package_ref) ||
        !isD2ExactRef(query.learning_goal_ref) ||
        !isD2ExactRef(query.rubric_ref)
      ) {
        throw new D2EvidenceError("D2_EVIDENCE_REFERENCE_INVALID");
      }
      if (
        query.course_package_ref.tenant_id !== tenantId ||
        query.learning_goal_ref.tenant_id !== tenantId ||
        query.rubric_ref.tenant_id !== tenantId
      ) {
        throw new D2EvidenceError("D2_EVIDENCE_TENANT_SCOPE_VIOLATION");
      }
    }
  }

  private assertScope(
    snapshot: Awaited<ReturnType<RoleWorkflowRepositoryPort["readRoleWorkflow"]>>,
    tenantId: string,
    query: D2EvidenceQuery
  ): void {
    if (
      !snapshot.course ||
      !snapshot.run ||
      !snapshot.team ||
      snapshot.course.course_id !== query.course_id ||
      snapshot.run.course_id !== query.course_id ||
      snapshot.team.course_id !== query.course_id ||
      snapshot.run.tenant_id !== tenantId ||
      snapshot.team.tenant_id !== tenantId
    ) {
      throw new D2EvidenceError("D2_EVIDENCE_SCOPE_VIOLATION");
    }
    if (!roleIsAssigned(snapshot, query.role_key))
      throw new D2EvidenceError("D2_EVIDENCE_ROLE_SCOPE_VIOLATION");
  }

  private async requirePublishedGoal(
    tenantId: string,
    reference: D2ExactRef
  ): Promise<LearningGoalVersion> {
    const goal = await this.dependencies.learningDesign.getGoal({
      content_digest: reference.content_digest,
      goal_id: reference.resource_id,
      tenant_id: tenantId,
      version: reference.version
    });
    if (!goal || goal.status !== "PUBLISHED" || goal.content_digest !== reference.content_digest)
      throw new D2EvidenceError("D2_EVIDENCE_LEARNING_GOAL_NOT_PUBLISHED");
    return goal;
  }

  private async requirePublishedRubric(
    tenantId: string,
    reference: D2ExactRef
  ): Promise<RubricVersion> {
    const rubric = await this.dependencies.learningDesign.getRubric({
      content_digest: reference.content_digest,
      rubric_id: reference.resource_id,
      tenant_id: tenantId,
      version: reference.version
    });
    if (
      !rubric ||
      rubric.status !== "PUBLISHED" ||
      rubric.content_digest !== reference.content_digest
    )
      throw new D2EvidenceError("D2_EVIDENCE_RUBRIC_NOT_PUBLISHED");
    return rubric;
  }
}
