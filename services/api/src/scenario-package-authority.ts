import { createHash } from "node:crypto";
import {
  TRUTH_PROTECTED_FIELDS,
  createParameterSetReference,
  createScenarioPackageReference,
  isExactVersion,
  type ParameterSetAuthorityReadPort,
  type ParameterSetReference,
  type ScenarioPackageAuthorityReadPort,
  type ScenarioPackageAuthorityReadProjection,
  type ScenarioPackageReference
} from "@simwar/shared-contracts";

export type ScenarioPackageVersionStatus =
  | "DRAFT"
  | "VALIDATED"
  | "FROZEN"
  | "APPROVED"
  | "RETIRED";

export type ScenarioPackageJsonValue =
  | boolean
  | null
  | number
  | string
  | readonly ScenarioPackageJsonValue[]
  | { readonly [key: string]: ScenarioPackageJsonValue };

export interface ScenarioPackageArtifactPolicy {
  artifact_digest?: string;
  artifact_media_type?: string;
  artifact_reference?: string;
  mode: "INLINE" | "IMMUTABLE_REFERENCE";
  retention: "IMMUTABLE";
}

export interface ScenarioPackagePluginDependency {
  plugin_package_id: string;
  version: string;
}

export interface ScenarioPackageAuthorityActor {
  actor_id: string;
  capabilities: readonly string[];
  correlation_id: string;
  tenant_id: string;
}

export interface ScenarioPackageDraftInput {
  artifact_policy: ScenarioPackageArtifactPolicy;
  compatibility_metadata: Readonly<Record<string, string>>;
  content: ScenarioPackageJsonValue;
  metadata: Readonly<Record<string, ScenarioPackageJsonValue>>;
  parameter_set_reference: ParameterSetReference;
  plugin_dependencies: readonly ScenarioPackagePluginDependency[];
  scenario_package_id: string;
  schema_version: string;
  tenant_id: string;
  version: string;
}

export interface ScenarioPackageVersion {
  artifact_policy: Readonly<ScenarioPackageArtifactPolicy>;
  compatibility_metadata: Readonly<Record<string, string>>;
  content: ScenarioPackageJsonValue;
  content_digest: string;
  metadata: Readonly<Record<string, ScenarioPackageJsonValue>>;
  parameter_set_reference: ParameterSetReference;
  plugin_dependencies: readonly Readonly<ScenarioPackagePluginDependency>[];
  reference: ScenarioPackageReference;
  scenario_package_id: string;
  schema_version: string;
  status: ScenarioPackageVersionStatus;
  tenant_id: string;
  version: string;
}

export interface ScenarioPackageApprovalRecord {
  approval_id: string;
  approved_by: string;
  correlation_id: string;
  scenario_package_reference: ScenarioPackageReference;
  tenant_id: string;
}

export interface ScenarioPackageApprovalResult {
  approval_record: ScenarioPackageApprovalRecord;
  version: ScenarioPackageVersion;
}

export type ScenarioPackageCommandFailureCode =
  | "DIGEST_MISMATCH"
  | "NOT_APPROVED"
  | "NOT_FOUND"
  | "RETIRED_FOR_NEW_BINDING"
  | "SCENARIO_PACKAGE_CAPABILITY_REQUIRED"
  | "SCENARIO_PACKAGE_DIGEST_CONFLICT"
  | "SCENARIO_PACKAGE_INVALID_TRANSITION"
  | "SCENARIO_PACKAGE_PARAMETER_SET_NOT_BINDABLE"
  | "SCENARIO_PACKAGE_VALIDATION_FAILED"
  | "SCENARIO_PACKAGE_VERSION_ALREADY_EXISTS"
  | "TENANT_SCOPE_VIOLATION";

export class ScenarioPackageAuthorityError extends Error {
  readonly code: ScenarioPackageCommandFailureCode;

  constructor(code: ScenarioPackageCommandFailureCode) {
    super(code);
    this.code = code;
    this.name = "ScenarioPackageAuthorityError";
  }
}

export interface ScenarioPackageRegistryPort extends ScenarioPackageAuthorityReadPort {
  appendApprovedVersion(
    version: ScenarioPackageVersion,
    record: ScenarioPackageApprovalRecord
  ): Promise<void>;
  appendVersion(version: ScenarioPackageVersion): Promise<void>;
  getByReference(
    tenantId: string,
    reference: ScenarioPackageReference
  ): Promise<ScenarioPackageVersion | null>;
  listApprovalRecords(
    tenantId: string,
    reference: ScenarioPackageReference
  ): Promise<ScenarioPackageApprovalRecord[]>;
  listLifecycleSnapshots(
    tenantId: string,
    scenarioPackageId: string,
    version: string
  ): Promise<ScenarioPackageVersion[]>;
}

const FORBIDDEN_SCENARIO_CONTENT_KEYS = new Set([
  ...TRUTH_PROTECTED_FIELDS,
  "SettlementResult",
  "parameter_values",
  "replay_hash",
  "truth_hash"
]);

function canonicalize(value: unknown): string {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_VALIDATION_FAILED");
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

  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;

    return `{${Object.keys(objectValue)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(objectValue[key])}`)
      .join(",")}}`;
  }

  throw new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_VALIDATION_FAILED");
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

function isNonBlankString(value: string): boolean {
  return value.trim().length > 0;
}

function createImmutableVersion(
  input: ScenarioPackageDraftInput,
  status: ScenarioPackageVersionStatus
): ScenarioPackageVersion {
  const content_digest = calculateScenarioPackageContentDigest(input);
  const reference = createScenarioPackageReference({
    content_digest,
    scenario_package_id: input.scenario_package_id,
    tenant_id: input.tenant_id,
    version: input.version
  });
  const parameter_set_reference = createParameterSetReference(input.parameter_set_reference);

  return deepFreeze({
    artifact_policy: cloneValue(input.artifact_policy),
    compatibility_metadata: cloneValue(input.compatibility_metadata),
    content: cloneValue(input.content),
    content_digest,
    metadata: cloneValue(input.metadata),
    parameter_set_reference,
    plugin_dependencies: cloneValue(input.plugin_dependencies),
    reference,
    scenario_package_id: input.scenario_package_id,
    schema_version: input.schema_version,
    status,
    tenant_id: input.tenant_id,
    version: input.version
  });
}

function hasManageCapability(actor: ScenarioPackageAuthorityActor): boolean {
  return actor.capabilities.includes("scenario_package:manage");
}

function assertActorScope(actor: ScenarioPackageAuthorityActor, tenantId: string): void {
  if (actor.tenant_id !== tenantId) {
    throw new ScenarioPackageAuthorityError("TENANT_SCOPE_VIOLATION");
  }

  if (!hasManageCapability(actor)) {
    throw new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_CAPABILITY_REQUIRED");
  }
}

function assertJsonValueValid(value: ScenarioPackageJsonValue): void {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_VALIDATION_FAILED");
  }

  if (Array.isArray(value)) {
    value.forEach(assertJsonValueValid);
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (!isNonBlankString(key) || FORBIDDEN_SCENARIO_CONTENT_KEYS.has(key)) {
        throw new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_VALIDATION_FAILED");
      }
      assertJsonValueValid(child as ScenarioPackageJsonValue);
    }
  }
}

function assertScenarioPackageContentValid(version: ScenarioPackageVersion): void {
  if (
    !isNonBlankString(version.schema_version) ||
    Object.entries(version.compatibility_metadata).some(
      ([key, value]) => !isNonBlankString(key) || !isNonBlankString(value)
    ) ||
    Object.keys(version.metadata).some((key) => !isNonBlankString(key))
  ) {
    throw new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_VALIDATION_FAILED");
  }

  if (
    version.artifact_policy.retention !== "IMMUTABLE" ||
    !["INLINE", "IMMUTABLE_REFERENCE"].includes(version.artifact_policy.mode)
  ) {
    throw new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_VALIDATION_FAILED");
  }

  if (
    version.artifact_policy.mode === "IMMUTABLE_REFERENCE" &&
    (!version.artifact_policy.artifact_reference ||
      !isNonBlankString(version.artifact_policy.artifact_reference) ||
      !version.artifact_policy.artifact_digest ||
      !/^[a-f0-9]{64}$/.test(version.artifact_policy.artifact_digest))
  ) {
    throw new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_VALIDATION_FAILED");
  }

  const pluginIdentities = new Set<string>();
  for (const dependency of version.plugin_dependencies) {
    if (!isNonBlankString(dependency.plugin_package_id) || !isExactVersion(dependency.version)) {
      throw new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_VALIDATION_FAILED");
    }

    const identity = `${dependency.plugin_package_id}@${dependency.version}`;
    if (pluginIdentities.has(identity)) {
      throw new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_VALIDATION_FAILED");
    }
    pluginIdentities.add(identity);
  }

  assertJsonValueValid(version.content);
  assertJsonValueValid(version.metadata);
}

function transition(
  current: ScenarioPackageVersion,
  expected: ScenarioPackageVersionStatus,
  next: ScenarioPackageVersionStatus
): ScenarioPackageVersion {
  if (current.status !== expected) {
    throw new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_INVALID_TRANSITION");
  }

  return deepFreeze({ ...current, status: next });
}

function compareScenarioPackageVersions(
  left: ScenarioPackageVersion,
  right: ScenarioPackageVersion
): number {
  return (
    left.scenario_package_id.localeCompare(right.scenario_package_id) ||
    left.version.localeCompare(right.version) ||
    left.content_digest.localeCompare(right.content_digest)
  );
}

function createScenarioPackageVersionIdentity(version: ScenarioPackageVersion): string {
  return JSON.stringify([
    version.tenant_id,
    version.scenario_package_id,
    version.version,
    version.content_digest
  ]);
}

function toAuthorityReadProjection(
  version: ScenarioPackageVersion
): ScenarioPackageAuthorityReadProjection {
  return deepFreeze({
    artifact_policy: cloneValue(version.artifact_policy),
    compatibility_metadata: cloneValue(version.compatibility_metadata),
    content_digest: version.content_digest,
    parameter_set_reference: createParameterSetReference(version.parameter_set_reference),
    plugin_dependencies: cloneValue(version.plugin_dependencies),
    reference: createScenarioPackageReference(version.reference),
    scenario_package_id: version.scenario_package_id,
    schema_version: version.schema_version,
    status: "APPROVED" as const,
    tenant_id: version.tenant_id,
    version: version.version
  });
}

export function calculateScenarioPackageContentDigest(input: ScenarioPackageDraftInput): string {
  const canonical = canonicalize({
    artifact_policy: input.artifact_policy,
    compatibility_metadata: input.compatibility_metadata,
    content: input.content,
    metadata: input.metadata,
    parameter_set_reference: input.parameter_set_reference,
    plugin_dependencies: input.plugin_dependencies,
    scenario_package_id: input.scenario_package_id,
    schema_version: input.schema_version,
    tenant_id: input.tenant_id,
    version: input.version
  });

  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Validates a candidate without appending it to the formal ScenarioPackage
 * lifecycle. The command service remains the sole writer for persisted versions.
 */
export function validateScenarioPackageDraftInput(input: ScenarioPackageDraftInput): {
  content_digest: string;
  reference: ScenarioPackageReference;
} {
  const draft = createImmutableVersion(input, "DRAFT");
  assertScenarioPackageContentValid(draft);

  return deepFreeze({
    content_digest: draft.content_digest,
    reference: draft.reference
  });
}

export interface InMemoryJsonScenarioPackageRegistryOptions {
  approvals?: ScenarioPackageApprovalRecord[];
  onAppend?: () => void;
  snapshots?: ScenarioPackageVersion[];
}

export class InMemoryJsonScenarioPackageRegistry implements ScenarioPackageRegistryPort {
  private readonly approvals: ScenarioPackageApprovalRecord[];
  private readonly onAppend: (() => void) | undefined;
  private readonly snapshots: ScenarioPackageVersion[];

  constructor(options: InMemoryJsonScenarioPackageRegistryOptions = {}) {
    this.approvals = options.approvals ?? [];
    this.onAppend = options.onAppend;
    this.snapshots = options.snapshots ?? [];

    this.approvals.forEach((record) => deepFreeze(record));
    this.snapshots.forEach((version) => deepFreeze(version));
  }

  async appendApprovedVersion(
    version: ScenarioPackageVersion,
    record: ScenarioPackageApprovalRecord
  ): Promise<void> {
    this.assertVersionAppendable(version);
    this.assertApprovalAppendable(record);
    this.snapshots.push(version);
    this.approvals.push(deepFreeze({ ...record }));
    this.persistOrRollback(() => {
      this.snapshots.pop();
      this.approvals.pop();
    });
  }

  async appendVersion(version: ScenarioPackageVersion): Promise<void> {
    this.assertVersionAppendable(version);
    this.snapshots.push(version);
    this.persistOrRollback(() => {
      this.snapshots.pop();
    });
  }

  private persistOrRollback(rollback: () => void): void {
    try {
      this.onAppend?.();
    } catch (error) {
      rollback();
      throw error;
    }
  }

  private assertApprovalAppendable(record: ScenarioPackageApprovalRecord): void {
    const existing = this.approvals.find(
      (candidate) =>
        candidate.tenant_id === record.tenant_id && candidate.approval_id === record.approval_id
    );

    if (existing) {
      throw new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_VERSION_ALREADY_EXISTS");
    }
  }

  private assertVersionAppendable(version: ScenarioPackageVersion): void {
    const history = this.snapshots.filter(
      (candidate) =>
        candidate.tenant_id === version.tenant_id &&
        candidate.scenario_package_id === version.scenario_package_id &&
        candidate.version === version.version
    );

    if (history.some((candidate) => candidate.content_digest !== version.content_digest)) {
      throw new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_DIGEST_CONFLICT");
    }

    if (history.some((candidate) => candidate.status === version.status)) {
      throw new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_VERSION_ALREADY_EXISTS");
    }
  }

  async assertBindable(tenantId: string, reference: ScenarioPackageReference): Promise<void> {
    const matchingIdentity = this.snapshots.filter(
      (candidate) =>
        candidate.scenario_package_id === reference.scenario_package_id &&
        candidate.version === reference.version
    );

    if (matchingIdentity.length === 0) {
      throw new ScenarioPackageAuthorityError("NOT_FOUND");
    }

    if (reference.tenant_id !== tenantId) {
      throw new ScenarioPackageAuthorityError("TENANT_SCOPE_VIOLATION");
    }

    const tenantHistory = matchingIdentity.filter((candidate) => candidate.tenant_id === tenantId);
    if (tenantHistory.length === 0) {
      throw new ScenarioPackageAuthorityError("TENANT_SCOPE_VIOLATION");
    }

    const exactHistory = tenantHistory.filter(
      (candidate) => candidate.content_digest === reference.content_digest
    );
    if (exactHistory.length === 0) {
      throw new ScenarioPackageAuthorityError("DIGEST_MISMATCH");
    }

    const latest = exactHistory.at(-1);
    if (!latest) {
      throw new ScenarioPackageAuthorityError("NOT_FOUND");
    }

    if (latest.status === "RETIRED") {
      throw new ScenarioPackageAuthorityError("RETIRED_FOR_NEW_BINDING");
    }

    if (latest.status !== "APPROVED") {
      throw new ScenarioPackageAuthorityError("NOT_APPROVED");
    }
  }

  async getByReference(
    tenantId: string,
    reference: ScenarioPackageReference
  ): Promise<ScenarioPackageVersion | null> {
    if (reference.tenant_id !== tenantId) {
      return null;
    }

    const exactHistory = this.snapshots.filter(
      (candidate) =>
        candidate.tenant_id === tenantId &&
        candidate.scenario_package_id === reference.scenario_package_id &&
        candidate.version === reference.version &&
        candidate.content_digest === reference.content_digest
    );

    return exactHistory.at(-1) ?? null;
  }

  async listApprovedForTenant(tenantId: string): Promise<ScenarioPackageAuthorityReadProjection[]> {
    const latestSnapshots = new Map<string, ScenarioPackageVersion>();

    for (const candidate of this.snapshots) {
      if (candidate.tenant_id === tenantId) {
        latestSnapshots.set(createScenarioPackageVersionIdentity(candidate), candidate);
      }
    }

    return [...latestSnapshots.values()]
      .filter((candidate) => candidate.status === "APPROVED")
      .sort(compareScenarioPackageVersions)
      .map(toAuthorityReadProjection);
  }

  async listApprovalRecords(
    tenantId: string,
    reference: ScenarioPackageReference
  ): Promise<ScenarioPackageApprovalRecord[]> {
    return this.approvals.filter(
      (record) =>
        record.tenant_id === tenantId &&
        record.scenario_package_reference.scenario_package_id === reference.scenario_package_id &&
        record.scenario_package_reference.version === reference.version &&
        record.scenario_package_reference.content_digest === reference.content_digest
    );
  }

  async listLifecycleSnapshots(
    tenantId: string,
    scenarioPackageId: string,
    version: string
  ): Promise<ScenarioPackageVersion[]> {
    return this.snapshots.filter(
      (candidate) =>
        candidate.tenant_id === tenantId &&
        candidate.scenario_package_id === scenarioPackageId &&
        candidate.version === version
    );
  }
}

export class ScenarioPackageCommandService implements ScenarioPackageAuthorityReadPort {
  constructor(
    private readonly registry: ScenarioPackageRegistryPort,
    private readonly parameterSetAuthority: ParameterSetAuthorityReadPort
  ) {}

  async assertBindable(tenantId: string, reference: ScenarioPackageReference): Promise<void> {
    await this.registry.assertBindable(tenantId, reference);
  }

  async createDraft(
    actor: ScenarioPackageAuthorityActor,
    input: ScenarioPackageDraftInput
  ): Promise<ScenarioPackageVersion> {
    assertActorScope(actor, input.tenant_id);
    await this.assertParameterSetBindable(input.tenant_id, input.parameter_set_reference);
    const version = createImmutableVersion(input, "DRAFT");
    const existing = await this.registry.listLifecycleSnapshots(
      input.tenant_id,
      input.scenario_package_id,
      input.version
    );

    if (existing.some((candidate) => candidate.content_digest !== version.content_digest)) {
      throw new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_DIGEST_CONFLICT");
    }

    if (existing.length > 0) {
      throw new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_VERSION_ALREADY_EXISTS");
    }

    await this.registry.appendVersion(version);
    return version;
  }

  async freeze(
    actor: ScenarioPackageAuthorityActor,
    reference: ScenarioPackageReference
  ): Promise<ScenarioPackageVersion> {
    return this.transition(actor, reference, "VALIDATED", "FROZEN");
  }

  async getByReference(
    tenantId: string,
    reference: ScenarioPackageReference
  ): Promise<ScenarioPackageVersion | null> {
    return this.registry.getByReference(tenantId, reference);
  }

  async listApprovedForTenant(tenantId: string): Promise<ScenarioPackageAuthorityReadProjection[]> {
    return this.registry.listApprovedForTenant(tenantId);
  }

  async approve(
    actor: ScenarioPackageAuthorityActor,
    reference: ScenarioPackageReference,
    approvalId: string
  ): Promise<ScenarioPackageApprovalResult> {
    if (!isNonBlankString(approvalId)) {
      throw new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_VALIDATION_FAILED");
    }

    const frozen = await this.getVersionForTransition(actor, reference, "FROZEN");
    await this.assertParameterSetBindable(actor.tenant_id, frozen.parameter_set_reference);
    const version = transition(frozen, "FROZEN", "APPROVED");
    const approval_record = deepFreeze({
      approval_id: approvalId,
      approved_by: actor.actor_id,
      correlation_id: actor.correlation_id,
      scenario_package_reference: version.reference,
      tenant_id: actor.tenant_id
    });

    await this.registry.appendApprovedVersion(version, approval_record);
    return deepFreeze({ approval_record, version });
  }

  async retire(
    actor: ScenarioPackageAuthorityActor,
    reference: ScenarioPackageReference
  ): Promise<ScenarioPackageVersion> {
    return this.transition(actor, reference, "APPROVED", "RETIRED");
  }

  async validate(
    actor: ScenarioPackageAuthorityActor,
    reference: ScenarioPackageReference
  ): Promise<ScenarioPackageVersion> {
    const draft = await this.getVersionForTransition(actor, reference, "DRAFT");
    assertScenarioPackageContentValid(draft);
    const validated = transition(draft, "DRAFT", "VALIDATED");
    await this.registry.appendVersion(validated);
    return validated;
  }

  private async assertParameterSetBindable(
    tenantId: string,
    reference: ParameterSetReference
  ): Promise<void> {
    try {
      await this.parameterSetAuthority.assertBindable(tenantId, reference);
    } catch {
      throw new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_PARAMETER_SET_NOT_BINDABLE");
    }
  }

  private async getVersionForTransition(
    actor: ScenarioPackageAuthorityActor,
    reference: ScenarioPackageReference,
    expected: ScenarioPackageVersionStatus
  ): Promise<ScenarioPackageVersion> {
    assertActorScope(actor, reference.tenant_id);
    const current = await this.registry.getByReference(actor.tenant_id, reference);

    if (!current) {
      throw new ScenarioPackageAuthorityError("NOT_FOUND");
    }

    if (current.status !== expected) {
      throw new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_INVALID_TRANSITION");
    }

    return current;
  }

  private async transition(
    actor: ScenarioPackageAuthorityActor,
    reference: ScenarioPackageReference,
    expected: ScenarioPackageVersionStatus,
    next: ScenarioPackageVersionStatus
  ): Promise<ScenarioPackageVersion> {
    const current = await this.getVersionForTransition(actor, reference, expected);
    const updated = transition(current, expected, next);
    await this.registry.appendVersion(updated);
    return updated;
  }
}
