import { createHash } from "node:crypto";
import {
  createParameterSetReference,
  type ParameterSetAuthorityReadPort,
  type ParameterSetReference
} from "@simwar/shared-contracts";

export type ParameterSetVersionStatus = "DRAFT" | "VALIDATED" | "FROZEN" | "APPROVED" | "RETIRED";

export type ParameterSetJsonValue =
  | boolean
  | null
  | number
  | string
  | readonly ParameterSetJsonValue[]
  | { readonly [key: string]: ParameterSetJsonValue };

export interface ParameterSetAuthorityActor {
  actor_id: string;
  capabilities: readonly string[];
  correlation_id: string;
  tenant_id: string;
}

export interface ParameterSetDraftInput {
  compatibility_metadata: Readonly<Record<string, string>>;
  model_version_ref: string;
  parameter_set_id: string;
  parameter_values: ParameterSetJsonValue;
  parent_reference?: ParameterSetReference;
  schema_version: string;
  tenant_id: string;
  version: string;
}

export interface ParameterSetVersion {
  compatibility_metadata: Readonly<Record<string, string>>;
  content_digest: string;
  model_version_ref: string;
  parameter_set_id: string;
  parameter_values: ParameterSetJsonValue;
  parent_reference?: ParameterSetReference;
  reference: ParameterSetReference;
  schema_version: string;
  status: ParameterSetVersionStatus;
  tenant_id: string;
  version: string;
}

export interface ParameterSetApprovalRecord {
  approval_id: string;
  approved_by: string;
  correlation_id: string;
  parameter_set_reference: ParameterSetReference;
  tenant_id: string;
}

export interface ParameterSetApprovalResult {
  approval_record: ParameterSetApprovalRecord;
  version: ParameterSetVersion;
}

export type ParameterSetCommandFailureCode =
  | "DIGEST_MISMATCH"
  | "NOT_APPROVED"
  | "NOT_FOUND"
  | "PARAMETER_SET_CAPABILITY_REQUIRED"
  | "PARAMETER_SET_INVALID_TRANSITION"
  | "PARAMETER_SET_VALIDATION_FAILED"
  | "PARAMETER_SET_VERSION_ALREADY_EXISTS"
  | "RETIRED_FOR_NEW_BINDING"
  | "TENANT_SCOPE_VIOLATION";

export class ParameterSetAuthorityError extends Error {
  readonly code: ParameterSetCommandFailureCode;

  constructor(code: ParameterSetCommandFailureCode) {
    super(code);
    this.code = code;
    this.name = "ParameterSetAuthorityError";
  }
}

export interface ParameterSetRegistryPort extends ParameterSetAuthorityReadPort {
  appendApproval(record: ParameterSetApprovalRecord): Promise<void>;
  appendVersion(version: ParameterSetVersion): Promise<void>;
  getByReference(
    tenantId: string,
    reference: ParameterSetReference
  ): Promise<ParameterSetVersion | null>;
  listApprovalRecords(
    tenantId: string,
    reference: ParameterSetReference
  ): Promise<ParameterSetApprovalRecord[]>;
  listLifecycleSnapshots(
    tenantId: string,
    parameterSetId: string,
    version: string
  ): Promise<ParameterSetVersion[]>;
}

function canonicalize(value: ParameterSetJsonValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }

  const objectValue = value as { readonly [key: string]: ParameterSetJsonValue };

  return `{${Object.keys(objectValue)
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${canonicalize(objectValue[key] as ParameterSetJsonValue)}`
    )
    .join(",")}}`;
}

function cloneValue<T extends ParameterSetJsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }

    Object.freeze(value);
  }

  return value;
}

function createImmutableVersion(
  input: ParameterSetDraftInput,
  status: ParameterSetVersionStatus
): ParameterSetVersion {
  const content_digest = calculateParameterSetContentDigest(input);
  const reference = createParameterSetReference({
    content_digest,
    parameter_set_id: input.parameter_set_id,
    version: input.version
  });

  return Object.freeze({
    compatibility_metadata: deepFreeze(cloneValue(input.compatibility_metadata)),
    content_digest,
    model_version_ref: input.model_version_ref,
    parameter_set_id: input.parameter_set_id,
    parameter_values: deepFreeze(cloneValue(input.parameter_values)),
    ...(input.parent_reference ? { parent_reference: input.parent_reference } : {}),
    reference,
    schema_version: input.schema_version,
    status,
    tenant_id: input.tenant_id,
    version: input.version
  });
}

function hasManageCapability(actor: ParameterSetAuthorityActor): boolean {
  return actor.capabilities.includes("parameter_set:manage");
}

function assertActorScope(actor: ParameterSetAuthorityActor, tenantId: string): void {
  if (actor.tenant_id !== tenantId) {
    throw new ParameterSetAuthorityError("TENANT_SCOPE_VIOLATION");
  }

  if (!hasManageCapability(actor)) {
    throw new ParameterSetAuthorityError("PARAMETER_SET_CAPABILITY_REQUIRED");
  }
}

function assertParameterSetContentValid(version: ParameterSetVersion): void {
  if (
    version.schema_version.trim().length === 0 ||
    version.model_version_ref.trim().length === 0 ||
    Object.values(version.compatibility_metadata).some((value) => value.trim().length === 0)
  ) {
    throw new ParameterSetAuthorityError("PARAMETER_SET_VALIDATION_FAILED");
  }

  const validateValue = (value: ParameterSetJsonValue): void => {
    if (typeof value === "number" && (!Number.isFinite(value) || value < 0)) {
      throw new ParameterSetAuthorityError("PARAMETER_SET_VALIDATION_FAILED");
    }

    if (Array.isArray(value)) {
      value.forEach(validateValue);
      return;
    }

    if (value && typeof value === "object") {
      Object.values(value).forEach((child) => validateValue(child as ParameterSetJsonValue));
    }
  };

  validateValue(version.parameter_values);

  const parameters = version.parameter_values as Record<string, ParameterSetJsonValue>;
  const capacity = parameters.base_capacity;
  const marketSize = parameters.base_market_size;

  if (typeof capacity === "number" && typeof marketSize === "number" && capacity > marketSize) {
    throw new ParameterSetAuthorityError("PARAMETER_SET_VALIDATION_FAILED");
  }
}
function transition(
  current: ParameterSetVersion,
  expected: ParameterSetVersionStatus,
  next: ParameterSetVersionStatus
): ParameterSetVersion {
  if (current.status !== expected) {
    throw new ParameterSetAuthorityError("PARAMETER_SET_INVALID_TRANSITION");
  }

  return Object.freeze({ ...current, status: next });
}

export function calculateParameterSetContentDigest(input: ParameterSetDraftInput): string {
  const canonical = canonicalize({
    compatibility_metadata: input.compatibility_metadata,
    model_version_ref: input.model_version_ref,
    parameter_set_id: input.parameter_set_id,
    parameter_values: input.parameter_values,
    schema_version: input.schema_version,
    tenant_id: input.tenant_id,
    version: input.version
  });

  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export class InMemoryJsonParameterSetRegistry implements ParameterSetRegistryPort {
  private readonly approvals: ParameterSetApprovalRecord[] = [];
  private readonly snapshots: ParameterSetVersion[] = [];

  async appendApproval(record: ParameterSetApprovalRecord): Promise<void> {
    const existing = this.approvals.find(
      (candidate) =>
        candidate.tenant_id === record.tenant_id && candidate.approval_id === record.approval_id
    );

    if (existing) {
      throw new ParameterSetAuthorityError("PARAMETER_SET_VERSION_ALREADY_EXISTS");
    }

    this.approvals.push(Object.freeze({ ...record }));
  }

  async appendVersion(version: ParameterSetVersion): Promise<void> {
    const history = this.snapshots.filter(
      (candidate) =>
        candidate.tenant_id === version.tenant_id &&
        candidate.parameter_set_id === version.parameter_set_id &&
        candidate.version === version.version
    );

    if (
      history.some(
        (candidate) =>
          candidate.content_digest !== version.content_digest || candidate.status === version.status
      )
    ) {
      throw new ParameterSetAuthorityError("PARAMETER_SET_VERSION_ALREADY_EXISTS");
    }

    this.snapshots.push(version);
  }

  async assertBindable(tenantId: string, reference: ParameterSetReference): Promise<void> {
    const matchingIdentity = this.snapshots.filter(
      (candidate) =>
        candidate.parameter_set_id === reference.parameter_set_id &&
        candidate.version === reference.version
    );

    if (matchingIdentity.length === 0) {
      throw new ParameterSetAuthorityError("NOT_FOUND");
    }

    const tenantHistory = matchingIdentity.filter((candidate) => candidate.tenant_id === tenantId);

    if (tenantHistory.length === 0) {
      throw new ParameterSetAuthorityError("TENANT_SCOPE_VIOLATION");
    }

    const exactHistory = tenantHistory.filter(
      (candidate) => candidate.content_digest === reference.content_digest
    );

    if (exactHistory.length === 0) {
      throw new ParameterSetAuthorityError("DIGEST_MISMATCH");
    }

    const latest = exactHistory.at(-1);

    if (!latest) {
      throw new ParameterSetAuthorityError("NOT_FOUND");
    }

    if (latest.status === "RETIRED") {
      throw new ParameterSetAuthorityError("RETIRED_FOR_NEW_BINDING");
    }

    if (latest.status !== "APPROVED") {
      throw new ParameterSetAuthorityError("NOT_APPROVED");
    }
  }

  async getByReference(
    tenantId: string,
    reference: ParameterSetReference
  ): Promise<ParameterSetVersion | null> {
    const exactHistory = this.snapshots.filter(
      (candidate) =>
        candidate.tenant_id === tenantId &&
        candidate.parameter_set_id === reference.parameter_set_id &&
        candidate.version === reference.version &&
        candidate.content_digest === reference.content_digest
    );

    return exactHistory.at(-1) ?? null;
  }

  async listApprovalRecords(
    tenantId: string,
    reference: ParameterSetReference
  ): Promise<ParameterSetApprovalRecord[]> {
    return this.approvals.filter(
      (record) =>
        record.tenant_id === tenantId &&
        record.parameter_set_reference.parameter_set_id === reference.parameter_set_id &&
        record.parameter_set_reference.version === reference.version &&
        record.parameter_set_reference.content_digest === reference.content_digest
    );
  }

  async listLifecycleSnapshots(
    tenantId: string,
    parameterSetId: string,
    version: string
  ): Promise<ParameterSetVersion[]> {
    return this.snapshots.filter(
      (candidate) =>
        candidate.tenant_id === tenantId &&
        candidate.parameter_set_id === parameterSetId &&
        candidate.version === version
    );
  }
}

export class ParameterSetCommandService implements ParameterSetAuthorityReadPort {
  constructor(private readonly registry: ParameterSetRegistryPort) {}

  async assertBindable(tenantId: string, reference: ParameterSetReference): Promise<void> {
    await this.registry.assertBindable(tenantId, reference);
  }

  async createDraft(
    actor: ParameterSetAuthorityActor,
    input: ParameterSetDraftInput
  ): Promise<ParameterSetVersion> {
    assertActorScope(actor, input.tenant_id);
    const version = createImmutableVersion(input, "DRAFT");
    const existing = await this.registry.listLifecycleSnapshots(
      input.tenant_id,
      input.parameter_set_id,
      input.version
    );

    if (existing.length > 0) {
      throw new ParameterSetAuthorityError("PARAMETER_SET_VERSION_ALREADY_EXISTS");
    }

    await this.registry.appendVersion(version);
    return version;
  }

  async freeze(
    actor: ParameterSetAuthorityActor,
    reference: ParameterSetReference
  ): Promise<ParameterSetVersion> {
    return this.transition(actor, reference, "VALIDATED", "FROZEN");
  }

  async getByReference(
    tenantId: string,
    reference: ParameterSetReference
  ): Promise<ParameterSetVersion | null> {
    return this.registry.getByReference(tenantId, reference);
  }

  async approve(
    actor: ParameterSetAuthorityActor,
    reference: ParameterSetReference,
    approvalId: string
  ): Promise<ParameterSetApprovalResult> {
    const version = await this.transition(actor, reference, "FROZEN", "APPROVED");
    const approval_record = Object.freeze({
      approval_id: approvalId,
      approved_by: actor.actor_id,
      correlation_id: actor.correlation_id,
      parameter_set_reference: version.reference,
      tenant_id: actor.tenant_id
    });

    await this.registry.appendApproval(approval_record);
    return { approval_record, version };
  }

  async retire(
    actor: ParameterSetAuthorityActor,
    reference: ParameterSetReference
  ): Promise<ParameterSetVersion> {
    return this.transition(actor, reference, "APPROVED", "RETIRED");
  }

  async validate(
    actor: ParameterSetAuthorityActor,
    reference: ParameterSetReference
  ): Promise<ParameterSetVersion> {
    const draft = await this.getVersionForTransition(actor, reference, "DRAFT");
    assertParameterSetContentValid(draft);
    const validated = transition(draft, "DRAFT", "VALIDATED");
    await this.registry.appendVersion(validated);
    return validated;
  }

  private async getVersionForTransition(
    actor: ParameterSetAuthorityActor,
    reference: ParameterSetReference,
    expected: ParameterSetVersionStatus
  ): Promise<ParameterSetVersion> {
    assertActorScope(actor, actor.tenant_id);
    const current = await this.registry.getByReference(actor.tenant_id, reference);

    if (!current) {
      throw new ParameterSetAuthorityError("NOT_FOUND");
    }

    if (current.status !== expected) {
      throw new ParameterSetAuthorityError("PARAMETER_SET_INVALID_TRANSITION");
    }

    return current;
  }
  private async transition(
    actor: ParameterSetAuthorityActor,
    reference: ParameterSetReference,
    expected: ParameterSetVersionStatus,
    next: ParameterSetVersionStatus
  ): Promise<ParameterSetVersion> {
    assertActorScope(actor, actor.tenant_id);
    const current = await this.registry.getByReference(actor.tenant_id, reference);

    if (!current) {
      throw new ParameterSetAuthorityError("NOT_FOUND");
    }

    const updated = transition(current, expected, next);
    await this.registry.appendVersion(updated);
    return updated;
  }
}
