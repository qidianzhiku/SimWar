import { createHash } from "node:crypto";
import {
  createPluginReleaseReference,
  isExactVersion,
  type PluginManifest,
  type PluginReleaseAuthorityReadPort,
  type PluginReleaseLifecycleStatus,
  type PluginReleaseReference
} from "@simwar/shared-contracts";

export interface PluginReleaseAuthorityActor {
  actor_id: string;
  capabilities: readonly string[];
  correlation_id: string;
}

export interface PluginReleaseDraftInput {
  compatibility_metadata: Readonly<Record<string, string>>;
  official_commit_permissions: readonly string[];
  plugin_manifest: PluginManifest;
  plugin_package_id: string;
  schema_version: string;
  version: string;
}

export interface PluginReleaseVersion {
  compatibility_metadata: Readonly<Record<string, string>>;
  content_digest: string;
  official_commit_permissions: readonly string[];
  plugin_manifest: Readonly<PluginManifest>;
  plugin_package_id: string;
  reference: PluginReleaseReference;
  schema_version: string;
  status: PluginReleaseLifecycleStatus;
  version: string;
}

export interface PluginReleaseApprovalRecord {
  approved_by: string;
  correlation_id: string;
  owner_decision_id: string;
  plugin_release_reference: PluginReleaseReference;
}

export interface PluginReleaseAvailabilityRecord {
  availability_decision_id: string;
  made_available_by: string;
  plugin_release_reference: PluginReleaseReference;
}

export interface PluginReleaseApprovalResult {
  approval_record: PluginReleaseApprovalRecord;
  version: PluginReleaseVersion;
}

export interface PluginReleaseAvailabilityResult {
  availability_record: PluginReleaseAvailabilityRecord;
  version: PluginReleaseVersion;
}

export type PluginReleaseCommandFailureCode =
  | "PLUGIN_RELEASE_CAPABILITY_REQUIRED"
  | "PLUGIN_RELEASE_CONTENT_DIGEST_CONFLICT"
  | "PLUGIN_RELEASE_INVALID_TRANSITION"
  | "PLUGIN_RELEASE_MANIFEST_IDENTITY_MISMATCH"
  | "PLUGIN_RELEASE_MANIFEST_NOT_APPROVED"
  | "PLUGIN_RELEASE_NOT_APPROVED"
  | "PLUGIN_RELEASE_NOT_AVAILABLE"
  | "PLUGIN_RELEASE_NOT_FOUND"
  | "PLUGIN_RELEASE_OFFICIAL_COMMIT_FORBIDDEN"
  | "PLUGIN_RELEASE_RETIRED_FOR_NEW_BINDING"
  | "PLUGIN_RELEASE_VALIDATION_FAILED"
  | "PLUGIN_RELEASE_VERSION_ALREADY_EXISTS";

export class PluginReleaseAuthorityError extends Error {
  readonly code: PluginReleaseCommandFailureCode;

  constructor(code: PluginReleaseCommandFailureCode) {
    super(code);
    this.code = code;
    this.name = "PluginReleaseAuthorityError";
  }
}

export interface PluginReleaseRegistryPort extends PluginReleaseAuthorityReadPort {
  appendApprovedVersion(
    version: PluginReleaseVersion,
    record: PluginReleaseApprovalRecord
  ): Promise<void>;
  appendAvailableVersion(
    version: PluginReleaseVersion,
    record: PluginReleaseAvailabilityRecord
  ): Promise<void>;
  appendVersion(version: PluginReleaseVersion): Promise<void>;
  getByReference(reference: PluginReleaseReference): Promise<PluginReleaseVersion | null>;
  listApprovalRecords(reference: PluginReleaseReference): Promise<PluginReleaseApprovalRecord[]>;
  listAvailabilityRecords(
    reference: PluginReleaseReference
  ): Promise<PluginReleaseAvailabilityRecord[]>;
  listLifecycleSnapshots(pluginPackageId: string, version: string): Promise<PluginReleaseVersion[]>;
}

function canonicalize(value: unknown): string {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_VALIDATION_FAILED");
  }

  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    return `{${Object.keys(objectValue)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(objectValue[key])}`)
      .join(",")}}`;
  }

  throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_VALIDATION_FAILED");
}

function cloneValue<T>(value: T): T {
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

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasCapability(actor: PluginReleaseAuthorityActor, capability: string): boolean {
  return actor.capabilities.includes(capability);
}

function assertCapability(actor: PluginReleaseAuthorityActor, capability: string): void {
  if (!isNonBlankString(actor.actor_id) || !isNonBlankString(actor.correlation_id)) {
    throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_VALIDATION_FAILED");
  }

  if (!hasCapability(actor, capability)) {
    throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_CAPABILITY_REQUIRED");
  }
}

function createImmutableVersion(
  input: PluginReleaseDraftInput,
  status: PluginReleaseLifecycleStatus
): PluginReleaseVersion {
  const content_digest = calculatePluginReleaseContentDigest(input);
  const reference = createPluginReleaseReference({
    content_digest,
    plugin_package_id: input.plugin_package_id,
    version: input.version
  });

  return deepFreeze({
    compatibility_metadata: cloneValue(input.compatibility_metadata),
    content_digest,
    official_commit_permissions: cloneValue(input.official_commit_permissions),
    plugin_manifest: cloneValue(input.plugin_manifest),
    plugin_package_id: input.plugin_package_id,
    reference,
    schema_version: input.schema_version,
    status,
    version: input.version
  });
}

function assertPluginReleaseContentValid(version: PluginReleaseVersion): void {
  if (
    !isExactVersion(version.version) ||
    !isNonBlankString(version.plugin_package_id) ||
    !isNonBlankString(version.schema_version) ||
    Object.entries(version.compatibility_metadata).some(
      ([key, value]) => !isNonBlankString(key) || !isNonBlankString(value)
    )
  ) {
    throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_VALIDATION_FAILED");
  }

  if (version.official_commit_permissions.length !== 0) {
    throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_OFFICIAL_COMMIT_FORBIDDEN");
  }

  const manifest = version.plugin_manifest;
  if (manifest.plugin_id !== version.plugin_package_id || manifest.version !== version.version) {
    throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_MANIFEST_IDENTITY_MISMATCH");
  }

  if (
    manifest.industry !== "wellness" ||
    !isNonBlankString(manifest.adapter_ref) ||
    !isNonBlankString(manifest.name) ||
    !isNonBlankString(manifest.parameter_schema_ref) ||
    !isNonBlankString(manifest.parameter_schema_version) ||
    manifest.supported_hooks.length === 0 ||
    new Set(manifest.supported_hooks).size !== manifest.supported_hooks.length ||
    manifest.settlement_hook_refs.some((reference) => !isNonBlankString(reference)) ||
    new Set(manifest.settlement_hook_refs).size !== manifest.settlement_hook_refs.length ||
    manifest.status === "deprecated"
  ) {
    throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_VALIDATION_FAILED");
  }
}

function transition(
  current: PluginReleaseVersion,
  expected: PluginReleaseLifecycleStatus,
  next: PluginReleaseLifecycleStatus
): PluginReleaseVersion {
  if (current.status !== expected) {
    throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_INVALID_TRANSITION");
  }

  return deepFreeze({ ...current, status: next });
}

function sameReference(left: PluginReleaseReference, right: PluginReleaseReference): boolean {
  return (
    left.plugin_package_id === right.plugin_package_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

export function calculatePluginReleaseContentDigest(input: PluginReleaseDraftInput): string {
  return createHash("sha256")
    .update(
      canonicalize({
        compatibility_metadata: input.compatibility_metadata,
        official_commit_permissions: input.official_commit_permissions,
        plugin_manifest: input.plugin_manifest,
        plugin_package_id: input.plugin_package_id,
        schema_version: input.schema_version,
        version: input.version
      }),
      "utf8"
    )
    .digest("hex");
}

export class InMemoryJsonPluginReleaseRegistry implements PluginReleaseRegistryPort {
  private readonly approvalRecords: PluginReleaseApprovalRecord[] = [];
  private readonly availabilityRecords: PluginReleaseAvailabilityRecord[] = [];
  private readonly snapshots: PluginReleaseVersion[] = [];

  async appendApprovedVersion(
    version: PluginReleaseVersion,
    record: PluginReleaseApprovalRecord
  ): Promise<void> {
    this.assertVersionAppendable(version);
    this.assertApprovalAppendable(record);
    this.snapshots.push(version);
    this.approvalRecords.push(deepFreeze({ ...record }));
  }

  async appendAvailableVersion(
    version: PluginReleaseVersion,
    record: PluginReleaseAvailabilityRecord
  ): Promise<void> {
    this.assertVersionAppendable(version);
    this.assertAvailabilityAppendable(record);
    this.snapshots.push(version);
    this.availabilityRecords.push(deepFreeze({ ...record }));
  }

  async appendVersion(version: PluginReleaseVersion): Promise<void> {
    this.assertVersionAppendable(version);
    this.snapshots.push(version);
  }

  async getByReference(reference: PluginReleaseReference): Promise<PluginReleaseVersion | null> {
    return (
      this.snapshots.filter((candidate) => sameReference(candidate.reference, reference)).at(-1) ??
      null
    );
  }

  async listApprovalRecords(
    reference: PluginReleaseReference
  ): Promise<PluginReleaseApprovalRecord[]> {
    return this.approvalRecords.filter((record) =>
      sameReference(record.plugin_release_reference, reference)
    );
  }

  async listAvailabilityRecords(
    reference: PluginReleaseReference
  ): Promise<PluginReleaseAvailabilityRecord[]> {
    return this.availabilityRecords.filter((record) =>
      sameReference(record.plugin_release_reference, reference)
    );
  }

  async listLifecycleSnapshots(
    pluginPackageId: string,
    version: string
  ): Promise<PluginReleaseVersion[]> {
    return this.snapshots.filter(
      (candidate) =>
        candidate.plugin_package_id === pluginPackageId && candidate.version === version
    );
  }

  async resolveAvailableForNewBinding(
    pluginPackageId: string,
    version: string
  ): Promise<PluginReleaseVersion | null> {
    const matches = this.snapshots.filter(
      (candidate) =>
        candidate.plugin_package_id === pluginPackageId && candidate.version === version
    );
    const contentDigests = new Set(matches.map((candidate) => candidate.content_digest));
    if (contentDigests.size > 1) {
      throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_CONTENT_DIGEST_CONFLICT");
    }

    return matches.at(-1)?.status === "AVAILABLE" ? (matches.at(-1) ?? null) : null;
  }

  private assertApprovalAppendable(record: PluginReleaseApprovalRecord): void {
    if (
      this.approvalRecords.some(
        (candidate) => candidate.owner_decision_id === record.owner_decision_id
      )
    ) {
      throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_VERSION_ALREADY_EXISTS");
    }
  }

  private assertAvailabilityAppendable(record: PluginReleaseAvailabilityRecord): void {
    if (
      this.availabilityRecords.some(
        (candidate) => candidate.availability_decision_id === record.availability_decision_id
      )
    ) {
      throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_VERSION_ALREADY_EXISTS");
    }
  }

  private assertVersionAppendable(version: PluginReleaseVersion): void {
    const history = this.snapshots.filter(
      (candidate) =>
        candidate.plugin_package_id === version.plugin_package_id &&
        candidate.version === version.version
    );

    if (history.some((candidate) => candidate.content_digest !== version.content_digest)) {
      throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_CONTENT_DIGEST_CONFLICT");
    }

    if (history.some((candidate) => candidate.status === version.status)) {
      throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_VERSION_ALREADY_EXISTS");
    }
  }
}

export class PluginReleaseCommandService implements PluginReleaseAuthorityReadPort {
  constructor(private readonly registry: PluginReleaseRegistryPort) {}

  async assertApprovedForFormalBinding(reference: PluginReleaseReference): Promise<void> {
    const current = await this.getRequired(reference);
    if (current.status === "RETIRED") {
      throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_RETIRED_FOR_NEW_BINDING");
    }
    if (current.status !== "APPROVED" && current.status !== "AVAILABLE") {
      throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_NOT_APPROVED");
    }
  }

  async assertAvailableForRuntime(reference: PluginReleaseReference): Promise<void> {
    const current = await this.getRequired(reference);
    if (current.status === "RETIRED") {
      throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_RETIRED_FOR_NEW_BINDING");
    }
    if (current.status !== "AVAILABLE") {
      throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_NOT_AVAILABLE");
    }
  }

  async approve(
    actor: PluginReleaseAuthorityActor,
    reference: PluginReleaseReference,
    ownerDecisionId: string
  ): Promise<PluginReleaseApprovalResult> {
    assertCapability(actor, "plugin_release:approve");
    if (!isNonBlankString(ownerDecisionId)) {
      throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_VALIDATION_FAILED");
    }

    const validated = await this.getVersionForTransition(reference, "VALIDATED");
    if (validated.plugin_manifest.status !== "approved") {
      throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_MANIFEST_NOT_APPROVED");
    }

    const version = transition(validated, "VALIDATED", "APPROVED");
    const approval_record = deepFreeze({
      approved_by: actor.actor_id,
      correlation_id: actor.correlation_id,
      owner_decision_id: ownerDecisionId,
      plugin_release_reference: version.reference
    });
    await this.registry.appendApprovedVersion(version, approval_record);
    return deepFreeze({ approval_record, version });
  }

  async createDraft(
    actor: PluginReleaseAuthorityActor,
    input: PluginReleaseDraftInput
  ): Promise<PluginReleaseVersion> {
    assertCapability(actor, "plugin_release:manage");
    const version = createImmutableVersion(input, "DRAFT");
    const existing = await this.registry.listLifecycleSnapshots(
      version.plugin_package_id,
      version.version
    );
    if (existing.length > 0) {
      throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_VERSION_ALREADY_EXISTS");
    }

    await this.registry.appendVersion(version);
    return version;
  }

  async getByReference(reference: PluginReleaseReference): Promise<PluginReleaseVersion | null> {
    return this.registry.getByReference(reference);
  }

  async makeAvailable(
    actor: PluginReleaseAuthorityActor,
    reference: PluginReleaseReference,
    availabilityDecisionId: string
  ): Promise<PluginReleaseAvailabilityResult> {
    assertCapability(actor, "plugin_release:make_available");
    if (!isNonBlankString(availabilityDecisionId)) {
      throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_VALIDATION_FAILED");
    }

    const approved = await this.getVersionForTransition(reference, "APPROVED");
    const version = transition(approved, "APPROVED", "AVAILABLE");
    const availability_record = deepFreeze({
      availability_decision_id: availabilityDecisionId,
      made_available_by: actor.actor_id,
      plugin_release_reference: version.reference
    });
    await this.registry.appendAvailableVersion(version, availability_record);
    return deepFreeze({ availability_record, version });
  }

  async resolveAvailableForNewBinding(
    pluginPackageId: string,
    version: string
  ): Promise<PluginReleaseVersion | null> {
    const projection = await this.registry.resolveAvailableForNewBinding(pluginPackageId, version);
    return projection ? this.registry.getByReference(projection.reference) : null;
  }

  async retire(
    actor: PluginReleaseAuthorityActor,
    reference: PluginReleaseReference
  ): Promise<PluginReleaseVersion> {
    assertCapability(actor, "plugin_release:manage");
    const available = await this.getVersionForTransition(reference, "AVAILABLE");
    const retired = transition(available, "AVAILABLE", "RETIRED");
    await this.registry.appendVersion(retired);
    return retired;
  }

  async validate(
    actor: PluginReleaseAuthorityActor,
    reference: PluginReleaseReference
  ): Promise<PluginReleaseVersion> {
    assertCapability(actor, "plugin_release:manage");
    const draft = await this.getVersionForTransition(reference, "DRAFT");
    assertPluginReleaseContentValid(draft);
    const validated = transition(draft, "DRAFT", "VALIDATED");
    await this.registry.appendVersion(validated);
    return validated;
  }

  private async getRequired(reference: PluginReleaseReference): Promise<PluginReleaseVersion> {
    const current = await this.registry.getByReference(reference);
    if (!current) {
      throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_NOT_FOUND");
    }
    return current;
  }

  private async getVersionForTransition(
    reference: PluginReleaseReference,
    expected: PluginReleaseLifecycleStatus
  ): Promise<PluginReleaseVersion> {
    const current = await this.getRequired(reference);
    if (current.status !== expected) {
      throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_INVALID_TRANSITION");
    }
    return current;
  }
}
