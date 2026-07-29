import { createHash } from "node:crypto";
import {
  createCourseBlueprintReference,
  type CourseBlueprintReference
} from "@simwar/shared-contracts";

export type CourseBlueprintVersionStatus =
  | "DRAFT"
  | "VALIDATED"
  | "FROZEN"
  | "APPROVED"
  | "RETIRED";

export type CourseBlueprintJsonValue =
  | boolean
  | null
  | number
  | string
  | readonly CourseBlueprintJsonValue[]
  | { readonly [key: string]: CourseBlueprintJsonValue };

export interface CourseBlueprintAuthorityActor {
  actor_id: string;
  capabilities: readonly string[];
  correlation_id: string;
  tenant_id: string;
}

export interface CourseBlueprintPhase {
  activity_type: string;
  duration_minutes: number;
  order: number;
  phase_id: string;
  student_instruction: string;
  teacher_guidance: string;
  title: string;
}

export interface CourseBlueprintDraftInput {
  activity_plan: readonly CourseBlueprintJsonValue[];
  course_blueprint_id: string;
  description: string;
  duration_minutes: number;
  instructor_guidance_reference: string;
  objectives: readonly string[];
  ordered_phases: readonly CourseBlueprintPhase[];
  required_product_capabilities: readonly string[];
  scenario_compatibility_constraints: Readonly<Record<string, string>>;
  schema_version: string;
  tenant_id: string;
  title: string;
  version: string;
}

export interface CourseBlueprintVersion extends CourseBlueprintDraftInput {
  content_digest: string;
  reference: CourseBlueprintReference;
  status: CourseBlueprintVersionStatus;
}

export interface CourseBlueprintApprovalRecord {
  approval_id: string;
  approved_by: string;
  correlation_id: string;
  course_blueprint_reference: CourseBlueprintReference;
  tenant_id: string;
}

export interface CourseBlueprintApprovalResult {
  approval_record: CourseBlueprintApprovalRecord;
  version: CourseBlueprintVersion;
}

export type CourseBlueprintCommandFailureCode =
  | "COURSE_BLUEPRINT_CAPABILITY_REQUIRED"
  | "COURSE_BLUEPRINT_INVALID_TRANSITION"
  | "COURSE_BLUEPRINT_VALIDATION_FAILED"
  | "COURSE_BLUEPRINT_VERSION_ALREADY_EXISTS"
  | "DIGEST_MISMATCH"
  | "NOT_APPROVED"
  | "NOT_FOUND"
  | "RETIRED_FOR_NEW_BINDING"
  | "TENANT_SCOPE_VIOLATION";

export class CourseBlueprintAuthorityError extends Error {
  constructor(readonly code: CourseBlueprintCommandFailureCode) {
    super(code);
    this.name = "CourseBlueprintAuthorityError";
  }
}

export interface CourseBlueprintRegistryPort {
  appendApprovedVersion(
    version: CourseBlueprintVersion,
    record: CourseBlueprintApprovalRecord
  ): Promise<void>;
  appendVersion(version: CourseBlueprintVersion): Promise<void>;
  getByReference(
    tenantId: string,
    reference: CourseBlueprintReference
  ): Promise<CourseBlueprintVersion | null>;
  listApprovalRecords(
    tenantId: string,
    reference: CourseBlueprintReference
  ): Promise<CourseBlueprintApprovalRecord[]>;
  listLifecycleSnapshots(
    tenantId: string,
    courseBlueprintId: string,
    version: string
  ): Promise<CourseBlueprintVersion[]>;
  listForTenant(tenantId: string): Promise<CourseBlueprintVersion[]>;
}

function canonicalize(value: CourseBlueprintJsonValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as { readonly [key: string]: CourseBlueprintJsonValue };
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key] as CourseBlueprintJsonValue)}`).join(",")}}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child));
    Object.freeze(value);
  }
  return value;
}

export function calculateCourseBlueprintContentDigest(input: CourseBlueprintDraftInput): string {
  return createHash("sha256")
    .update(canonicalize({
      activity_plan: input.activity_plan,
      course_blueprint_id: input.course_blueprint_id,
      description: input.description,
      duration_minutes: input.duration_minutes,
      instructor_guidance_reference: input.instructor_guidance_reference,
      objectives: input.objectives,
      ordered_phases: input.ordered_phases as unknown as readonly CourseBlueprintJsonValue[],
      required_product_capabilities: input.required_product_capabilities,
      scenario_compatibility_constraints: input.scenario_compatibility_constraints,
      schema_version: input.schema_version,
      tenant_id: input.tenant_id,
      title: input.title,
      version: input.version
    }), "utf8")
    .digest("hex");
}

function createVersion(input: CourseBlueprintDraftInput, status: CourseBlueprintVersionStatus): CourseBlueprintVersion {
  const content_digest = calculateCourseBlueprintContentDigest(input);
  return deepFreeze({
    ...clone(input),
    content_digest,
    reference: createCourseBlueprintReference({
      content_digest,
      course_blueprint_id: input.course_blueprint_id,
      tenant_id: input.tenant_id,
      version: input.version
    }),
    status
  });
}

function assertActor(actor: CourseBlueprintAuthorityActor, tenantId: string): void {
  if (actor.tenant_id !== tenantId) throw new CourseBlueprintAuthorityError("TENANT_SCOPE_VIOLATION");
  if (!actor.capabilities.includes("course_blueprint:manage")) {
    throw new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_CAPABILITY_REQUIRED");
  }
}

function assertValid(version: CourseBlueprintVersion): void {
  const positiveInteger = (value: number) => Number.isInteger(value) && value > 0;
  if (
    version.schema_version !== "course-blueprint.v1" || !version.title.trim() || !version.description.trim() ||
    !version.instructor_guidance_reference.trim() || !positiveInteger(version.duration_minutes) ||
    version.objectives.length === 0 || version.objectives.some((objective) => !objective.trim()) ||
    version.ordered_phases.length === 0 ||
    version.required_product_capabilities.some((capability) => !capability.trim()) ||
    Object.entries(version.scenario_compatibility_constraints).some(
      ([key, value]) => !key.trim() || !value.trim()
    ) ||
    version.ordered_phases.some((phase, index) =>
      !phase.phase_id.trim() || !phase.title.trim() || !phase.activity_type.trim() ||
      !phase.teacher_guidance.trim() || !phase.student_instruction.trim() ||
      !positiveInteger(phase.duration_minutes) || phase.order !== index + 1)
  ) {
    throw new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VALIDATION_FAILED");
  }
}

function assertStoredVersion(version: CourseBlueprintVersion): void {
  const statusOrder: CourseBlueprintVersionStatus[] = ["DRAFT", "VALIDATED", "FROZEN", "APPROVED", "RETIRED"];
  if (
    !version ||
    !statusOrder.includes(version.status) ||
    typeof version.tenant_id !== "string" ||
    typeof version.course_blueprint_id !== "string" ||
    typeof version.version !== "string" ||
    !Array.isArray(version.objectives) ||
    !Array.isArray(version.ordered_phases) ||
    !Array.isArray(version.activity_plan) ||
    !version.reference ||
    version.reference.tenant_id !== version.tenant_id ||
    version.reference.course_blueprint_id !== version.course_blueprint_id ||
    version.reference.version !== version.version ||
    !/^[a-f0-9]{64}$/.test(version.content_digest) ||
    version.reference.content_digest !== version.content_digest ||
    calculateCourseBlueprintContentDigest(version) !== version.content_digest
  ) {
    throw new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VALIDATION_FAILED");
  }
}

function assertStoredApproval(record: CourseBlueprintApprovalRecord): void {
  if (
    !record ||
    !record.approval_id?.trim() ||
    !record.approved_by?.trim() ||
    !record.correlation_id?.trim() ||
    !record.tenant_id?.trim() ||
    !record.course_blueprint_reference ||
    record.course_blueprint_reference.tenant_id !== record.tenant_id
  ) {
    throw new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VALIDATION_FAILED");
  }
}

export interface InMemoryJsonCourseBlueprintRegistryOptions {
  approvals?: CourseBlueprintApprovalRecord[];
  onAppend?: () => void;
  snapshots?: CourseBlueprintVersion[];
}

export class InMemoryJsonCourseBlueprintRegistry implements CourseBlueprintRegistryPort {
  private readonly approvals: CourseBlueprintApprovalRecord[];
  private readonly onAppend: (() => void) | undefined;
  private readonly snapshots: CourseBlueprintVersion[];

  constructor(options: InMemoryJsonCourseBlueprintRegistryOptions = {}) {
    this.approvals = options.approvals ?? [];
    this.onAppend = options.onAppend;
    this.snapshots = options.snapshots ?? [];
    this.approvals.forEach((record) => { assertStoredApproval(record); deepFreeze(record); });
    this.snapshots.forEach((snapshot) => { assertStoredVersion(snapshot); deepFreeze(snapshot); });
    this.assertStoredHistory();
  }

  async appendVersion(version: CourseBlueprintVersion): Promise<void> {
    this.assertAppendable(version);
    this.snapshots.push(version);
    this.persistOrRollback(() => this.snapshots.pop());
  }

  async appendApprovedVersion(version: CourseBlueprintVersion, record: CourseBlueprintApprovalRecord): Promise<void> {
    this.assertAppendable(version);
    assertStoredApproval(record);
    if (this.approvals.some((item) => item.tenant_id === record.tenant_id && item.approval_id === record.approval_id)) {
      throw new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VERSION_ALREADY_EXISTS");
    }
    this.snapshots.push(version);
    this.approvals.push(deepFreeze(clone(record)));
    this.persistOrRollback(() => { this.snapshots.pop(); this.approvals.pop(); });
  }

  async getByReference(tenantId: string, reference: CourseBlueprintReference): Promise<CourseBlueprintVersion | null> {
    if (reference.tenant_id !== tenantId) {
      throw new CourseBlueprintAuthorityError("TENANT_SCOPE_VIOLATION");
    }
    return this.snapshots.filter((item) =>
      item.tenant_id === tenantId && item.reference.course_blueprint_id === reference.course_blueprint_id &&
      item.reference.version === reference.version && item.content_digest === reference.content_digest
    ).at(-1) ?? null;
  }

  async listApprovalRecords(tenantId: string, reference: CourseBlueprintReference): Promise<CourseBlueprintApprovalRecord[]> {
    return this.approvals.filter((item) => item.tenant_id === tenantId &&
      item.course_blueprint_reference.course_blueprint_id === reference.course_blueprint_id &&
      item.course_blueprint_reference.version === reference.version &&
      item.course_blueprint_reference.content_digest === reference.content_digest).map(clone);
  }

  async listLifecycleSnapshots(tenantId: string, courseBlueprintId: string, version: string): Promise<CourseBlueprintVersion[]> {
    return this.snapshots.filter((item) => item.tenant_id === tenantId && item.course_blueprint_id === courseBlueprintId && item.version === version).map(clone);
  }

  async listForTenant(tenantId: string): Promise<CourseBlueprintVersion[]> {
    const latestByIdentity = new Map<string, CourseBlueprintVersion>();
    this.snapshots.filter((item) => item.tenant_id === tenantId).forEach((item) => {
      latestByIdentity.set(`${item.course_blueprint_id}:${item.version}:${item.content_digest}`, item);
    });
    return [...latestByIdentity.values()].map(clone);
  }

  private assertAppendable(version: CourseBlueprintVersion): void {
    assertStoredVersion(version);
    const history = this.snapshots.filter((item) => item.tenant_id === version.tenant_id && item.course_blueprint_id === version.course_blueprint_id && item.version === version.version);
    if (history.some((item) => item.content_digest !== version.content_digest || item.status === version.status)) {
      throw new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VERSION_ALREADY_EXISTS");
    }
    const expected: CourseBlueprintVersionStatus[] = ["DRAFT", "VALIDATED", "FROZEN", "APPROVED", "RETIRED"];
    if (version.status !== expected[history.length]) {
      throw new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_INVALID_TRANSITION");
    }
  }

  private assertStoredHistory(): void {
    const expected: CourseBlueprintVersionStatus[] = ["DRAFT", "VALIDATED", "FROZEN", "APPROVED", "RETIRED"];
    const byIdentity = new Map<string, CourseBlueprintVersion[]>();
    for (const snapshot of this.snapshots) {
      const key = `${snapshot.tenant_id}:${snapshot.course_blueprint_id}:${snapshot.version}`;
      byIdentity.set(key, [...(byIdentity.get(key) ?? []), snapshot]);
    }
    for (const history of byIdentity.values()) {
      if (
        history.some((snapshot, index) =>
          snapshot.status !== expected[index] ||
          snapshot.content_digest !== history[0]!.content_digest
        )
      ) {
        throw new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VALIDATION_FAILED");
      }
      const approved = history.some((snapshot) => snapshot.status === "APPROVED");
      const matchingApprovals = this.approvals.filter((record) =>
        record.tenant_id === history[0]!.tenant_id &&
        record.course_blueprint_reference.content_digest === history[0]!.content_digest &&
        record.course_blueprint_reference.course_blueprint_id === history[0]!.course_blueprint_id &&
        record.course_blueprint_reference.version === history[0]!.version
      );
      if (matchingApprovals.length !== (approved ? 1 : 0)) {
        throw new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VALIDATION_FAILED");
      }
    }
    for (const approval of this.approvals) {
      if (!this.snapshots.some((snapshot) =>
        snapshot.status === "APPROVED" &&
        snapshot.tenant_id === approval.tenant_id &&
        snapshot.content_digest === approval.course_blueprint_reference.content_digest &&
        snapshot.course_blueprint_id === approval.course_blueprint_reference.course_blueprint_id &&
        snapshot.version === approval.course_blueprint_reference.version
      )) {
        throw new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VALIDATION_FAILED");
      }
    }
  }

  private persistOrRollback(rollback: () => void): void {
    try { this.onAppend?.(); } catch (error) { rollback(); throw error; }
  }
}

export class CourseBlueprintCommandService {
  constructor(private readonly registry: CourseBlueprintRegistryPort) {}

  async createDraft(actor: CourseBlueprintAuthorityActor, input: CourseBlueprintDraftInput): Promise<CourseBlueprintVersion> {
    assertActor(actor, input.tenant_id);
    const existing = await this.registry.listLifecycleSnapshots(input.tenant_id, input.course_blueprint_id, input.version);
    if (existing.length) throw new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VERSION_ALREADY_EXISTS");
    const draft = createVersion(input, "DRAFT");
    await this.registry.appendVersion(draft);
    return draft;
  }

  async validate(actor: CourseBlueprintAuthorityActor, reference: CourseBlueprintReference): Promise<CourseBlueprintVersion> {
    const draft = await this.requireTransition(actor, reference, "DRAFT");
    assertValid(draft);
    return this.appendTransition(draft, "VALIDATED");
  }

  async freeze(actor: CourseBlueprintAuthorityActor, reference: CourseBlueprintReference): Promise<CourseBlueprintVersion> {
    return this.appendTransition(await this.requireTransition(actor, reference, "VALIDATED"), "FROZEN");
  }

  async approve(actor: CourseBlueprintAuthorityActor, reference: CourseBlueprintReference, approvalId: string): Promise<CourseBlueprintApprovalResult> {
    if (!approvalId.trim()) {
      throw new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VALIDATION_FAILED");
    }
    const frozen = await this.requireTransition(actor, reference, "FROZEN");
    const version = deepFreeze({ ...frozen, status: "APPROVED" as const });
    const approval_record = deepFreeze({ approval_id: approvalId, approved_by: actor.actor_id, correlation_id: actor.correlation_id, course_blueprint_reference: clone(version.reference), tenant_id: actor.tenant_id });
    await this.registry.appendApprovedVersion(version, approval_record);
    return { approval_record, version };
  }

  async retire(actor: CourseBlueprintAuthorityActor, reference: CourseBlueprintReference): Promise<CourseBlueprintVersion> {
    return this.appendTransition(await this.requireTransition(actor, reference, "APPROVED"), "RETIRED");
  }

  async assertBindable(tenantId: string, reference: CourseBlueprintReference): Promise<void> {
    if (reference.tenant_id !== tenantId) {
      throw new CourseBlueprintAuthorityError("TENANT_SCOPE_VIOLATION");
    }
    const matches = await this.registry.listLifecycleSnapshots(tenantId, reference.course_blueprint_id, reference.version);
    if (!matches.length) throw new CourseBlueprintAuthorityError("NOT_FOUND");
    const exact = matches.filter((item) => item.content_digest === reference.content_digest);
    if (!exact.length) throw new CourseBlueprintAuthorityError("DIGEST_MISMATCH");
    const latest = exact.at(-1);
    if (!latest) throw new CourseBlueprintAuthorityError("NOT_FOUND");
    if (latest.status === "RETIRED") throw new CourseBlueprintAuthorityError("RETIRED_FOR_NEW_BINDING");
    if (latest.status !== "APPROVED") throw new CourseBlueprintAuthorityError("NOT_APPROVED");
  }

  async getByReference(tenantId: string, reference: CourseBlueprintReference): Promise<CourseBlueprintVersion | null> {
    return this.registry.getByReference(tenantId, reference);
  }

  async listApprovedForTenant(tenantId: string): Promise<CourseBlueprintVersion[]> {
    return (await this.registry.listForTenant(tenantId)).filter((record) => record.status === "APPROVED").map(clone);
  }

  private async requireTransition(actor: CourseBlueprintAuthorityActor, reference: CourseBlueprintReference, expected: CourseBlueprintVersionStatus): Promise<CourseBlueprintVersion> {
    assertActor(actor, reference.tenant_id);
    const current = await this.registry.getByReference(actor.tenant_id, reference);
    if (!current) throw new CourseBlueprintAuthorityError("NOT_FOUND");
    if (current.status !== expected) throw new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_INVALID_TRANSITION");
    return current;
  }

  private async appendTransition(current: CourseBlueprintVersion, status: CourseBlueprintVersionStatus): Promise<CourseBlueprintVersion> {
    const next = deepFreeze({ ...current, status });
    await this.registry.appendVersion(next);
    return next;
  }
}
