import { createHash } from "node:crypto";
import {
  COURSE_PACKAGE_VERSION_SCHEMA_VERSION,
  COURSE_PACKAGE_VERSION_STATUSES,
  type CoursePackageVersion,
  type CoursePackageVersionDraftInput,
  type CoursePackageVersionReference,
  type CoursePackageVersionStatus
} from "@simwar/shared-contracts";

export class CoursePackageRegistryError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "CoursePackageRegistryError";
  }
}

export interface CoursePackageJsonRegistryDependencies {
  now?: () => string;
  persist?: (snapshots: readonly CoursePackageVersion[]) => void;
}

export interface CoursePackageRegistryPort {
  currentTime(): string;
  append(snapshot: CoursePackageVersion): Promise<void>;
  captureAuditCheckpointForCompensation(): CoursePackageVersion[];
  restoreAuditCheckpointAfterFailure(checkpoint: readonly CoursePackageVersion[]): void;
  getByReference(
    tenantId: string,
    reference: CoursePackageVersionReference
  ): Promise<CoursePackageVersion | null>;
  listForTenant(tenantId: string): Promise<CoursePackageVersion[]>;
  listLifecycleSnapshots(
    tenantId: string,
    coursePackageId: string,
    version: string
  ): Promise<CoursePackageVersion[]>;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
      .join(",")}}`;
  }
  throw new CoursePackageRegistryError("COURSE_PACKAGE_INPUT_INVALID");
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value === value.trim();
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isExactIdentity(value: unknown): value is string {
  return (
    nonBlank(value) &&
    /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(value) &&
    !/(?:^|[._:-])(?:any|current|default|fallback|latest|next|unresolved)(?:$|[._:-])/i.test(value)
  );
}

function isExactVersion(value: unknown): value is string {
  return isExactIdentity(value) && !/(?:^|[._:-])[xX*](?:$|[._:-])/.test(value);
}

function sameReference(
  left: CoursePackageVersionReference,
  right: CoursePackageVersionReference
): boolean {
  return (
    left.tenant_id === right.tenant_id &&
    left.course_package_id === right.course_package_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function coursePackageIdentityKey(...parts: readonly string[]): string {
  return JSON.stringify(parts);
}

function isCourseBlueprintReference(
  value: CoursePackageVersion["course_blueprint_reference"]
): boolean {
  return (
    isExactIdentity(value.course_blueprint_id) &&
    isExactIdentity(value.tenant_id) &&
    isExactVersion(value.version) &&
    isDigest(value.content_digest)
  );
}

function isScenarioPackageReference(
  value: CoursePackageVersion["scenario_package_reference"]
): boolean {
  return (
    isExactIdentity(value.scenario_package_id) &&
    isExactIdentity(value.tenant_id) &&
    isExactVersion(value.version) &&
    isDigest(value.content_digest)
  );
}

function isParameterSetReference(value: CoursePackageVersion["parameter_set_reference"]): boolean {
  return (
    isExactIdentity(value.parameter_set_id) &&
    isExactVersion(value.version) &&
    isDigest(value.content_digest)
  );
}

export function calculateCoursePackageContentDigest(input: CoursePackageVersionDraftInput): string {
  const digestInput = {
    course_blueprint_reference: input.course_blueprint_reference,
    course_package_id: input.course_package_id,
    description: input.description,
    parameter_set_reference: input.parameter_set_reference,
    scenario_package_reference: input.scenario_package_reference,
    ...(input.studio_configuration ? { studio_configuration: input.studio_configuration } : {}),
    ...(input.factory_metadata ? { factory_metadata: input.factory_metadata } : {}),
    title: input.title,
    version: input.version
  };
  return createHash("sha256")
    .update(canonicalize(digestInput as never))
    .digest("hex");
}

export function createCoursePackageVersionReference(
  version: Pick<
    CoursePackageVersion,
    "content_digest" | "course_package_id" | "tenant_id" | "version"
  >
): CoursePackageVersionReference {
  return deepFreeze({
    content_digest: version.content_digest,
    course_package_id: version.course_package_id,
    tenant_id: version.tenant_id,
    version: version.version
  });
}

export function assertValidCoursePackageVersion(version: Readonly<CoursePackageVersion>): void {
  const expectedDigest = calculateCoursePackageContentDigest(version);
  if (
    !isExactIdentity(version.course_package_id) ||
    !isExactIdentity(version.tenant_id) ||
    !isExactIdentity(version.created_by) ||
    !nonBlank(version.title) ||
    !nonBlank(version.description) ||
    !isExactVersion(version.version) ||
    !isDigest(version.content_digest) ||
    version.content_digest !== expectedDigest ||
    version.schema_version !== COURSE_PACKAGE_VERSION_SCHEMA_VERSION ||
    !COURSE_PACKAGE_VERSION_STATUSES.includes(version.status) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(version.created_at) ||
    version.course_blueprint_reference.tenant_id !== version.tenant_id ||
    version.scenario_package_reference.tenant_id !== version.tenant_id ||
    !isCourseBlueprintReference(version.course_blueprint_reference) ||
    !isScenarioPackageReference(version.scenario_package_reference) ||
    !isParameterSetReference(version.parameter_set_reference)
  ) {
    throw new CoursePackageRegistryError("COURSE_PACKAGE_INPUT_INVALID");
  }
}

export function assertValidCoursePackageLifecycleSnapshots(
  snapshots: readonly CoursePackageVersion[]
): void {
  const expected: readonly CoursePackageVersionStatus[] = [
    "DRAFT",
    "VALIDATED",
    "AVAILABLE",
    "RETIRED"
  ];
  const histories = new Map<string, CoursePackageVersion[]>();
  for (const snapshot of snapshots) {
    assertValidCoursePackageVersion(snapshot);
    const key = coursePackageIdentityKey(
      snapshot.tenant_id,
      snapshot.course_package_id,
      snapshot.version
    );
    histories.set(key, [...(histories.get(key) ?? []), snapshot]);
  }
  for (const history of histories.values()) {
    const first = history[0];
    const factoryStatuses = history.map((snapshot) => snapshot.status);
    const isFactoryHistory = history.some((snapshot) => snapshot.factory_metadata !== undefined);
    const factoryLifecycleValid = isFactoryHistory
      ? factoryStatuses.every((status, index) => {
          const expected = ["DRAFT", "VALIDATED", "APPROVED", "PUBLISHED"] as const;
          if (index < expected.length) return status === expected[index];
          if (index === expected.length) return status === "SUPERSEDED" || status === "RETIRED";
          return factoryStatuses[index - 1] === "SUPERSEDED" && status === "RETIRED";
        })
      : true;
    const legacyLifecycleValid = history.every(
      (snapshot, index) => snapshot.status === expected[index]
    );
    const immutableHistoryValid = history.every(
      (snapshot) =>
        snapshot.content_digest === first?.content_digest &&
        snapshot.created_at === first?.created_at &&
        snapshot.created_by === first?.created_by &&
        (!isFactoryHistory || snapshot.factory_metadata !== undefined)
    );
    if (
      !first ||
      (!isFactoryHistory && !legacyLifecycleValid) ||
      !factoryLifecycleValid ||
      !immutableHistoryValid
    ) {
      throw new CoursePackageRegistryError("COURSE_PACKAGE_LIFECYCLE_INVALID");
    }
  }
}

export function createCoursePackageDraftVersion(input: {
  actor_id: string;
  draft: CoursePackageVersionDraftInput;
  now: string;
  tenant_id: string;
}): CoursePackageVersion {
  const candidate: CoursePackageVersion = {
    ...clone(input.draft),
    content_digest: calculateCoursePackageContentDigest(input.draft),
    created_at: input.now,
    created_by: input.actor_id,
    schema_version: COURSE_PACKAGE_VERSION_SCHEMA_VERSION,
    status: "DRAFT",
    tenant_id: input.tenant_id
  };
  assertValidCoursePackageVersion(candidate);
  return deepFreeze(candidate);
}

export function createCoursePackageLifecycleSnapshot(
  version: CoursePackageVersion,
  status: CoursePackageVersionStatus
): CoursePackageVersion {
  const next = { ...clone(version), status };
  assertValidCoursePackageVersion(next);
  return deepFreeze(next);
}

/** Private JSON registry for C5 only. It stores no Course, Run, truth, or replay record. */
export class CoursePackageJsonRegistry implements CoursePackageRegistryPort {
  private readonly now: () => string;
  private readonly persist: (snapshots: readonly CoursePackageVersion[]) => void;
  private readonly snapshots: CoursePackageVersion[];

  constructor(
    dependencies: CoursePackageJsonRegistryDependencies = {},
    snapshots: readonly CoursePackageVersion[] = []
  ) {
    assertValidCoursePackageLifecycleSnapshots(snapshots);
    this.now = dependencies.now ?? (() => new Date().toISOString());
    this.persist = dependencies.persist ?? (() => undefined);
    this.snapshots = snapshots.map((snapshot) => clone(snapshot));
  }

  currentTime(): string {
    return this.now();
  }

  async append(snapshot: CoursePackageVersion): Promise<void> {
    this.replaceSnapshots([...this.snapshots, clone(snapshot)]);
  }

  captureAuditCheckpointForCompensation(): CoursePackageVersion[] {
    return clone(this.snapshots);
  }

  restoreAuditCheckpointAfterFailure(checkpoint: readonly CoursePackageVersion[]): void {
    assertValidCoursePackageLifecycleSnapshots(checkpoint);
    this.snapshots.splice(0, this.snapshots.length, ...clone(checkpoint));
    try {
      this.persist(clone(this.snapshots));
    } catch {
      // One explicit compensation recovery write; the enclosing command still fails.
      // A second failure remains an error; no crash-safe or durable recovery is attempted.
      this.persist(clone(this.snapshots));
    }
  }

  private replaceSnapshots(next: readonly CoursePackageVersion[]): void {
    assertValidCoursePackageLifecycleSnapshots(next);
    const previous = clone(this.snapshots);
    this.snapshots.splice(0, this.snapshots.length, ...clone(next));
    try {
      this.persist(clone(this.snapshots));
    } catch (error) {
      this.snapshots.splice(0, this.snapshots.length, ...previous);
      throw error;
    }
  }

  async getByReference(
    tenantId: string,
    reference: CoursePackageVersionReference
  ): Promise<CoursePackageVersion | null> {
    if (reference.tenant_id !== tenantId) return null;
    const candidate = this.history(tenantId, reference.course_package_id, reference.version).at(-1);
    if (!candidate || !sameReference(createCoursePackageVersionReference(candidate), reference))
      return null;
    return clone(candidate);
  }

  async listForTenant(tenantId: string): Promise<CoursePackageVersion[]> {
    const latest = new Map<string, CoursePackageVersion>();
    for (const snapshot of this.snapshots) {
      if (snapshot.tenant_id !== tenantId) continue;
      latest.set(coursePackageIdentityKey(snapshot.course_package_id, snapshot.version), snapshot);
    }
    return [...latest.values()]
      .sort(
        (left, right) =>
          left.course_package_id.localeCompare(right.course_package_id) ||
          left.version.localeCompare(right.version)
      )
      .map(clone);
  }

  async listLifecycleSnapshots(
    tenantId: string,
    coursePackageId: string,
    version: string
  ): Promise<CoursePackageVersion[]> {
    return this.history(tenantId, coursePackageId, version).map(clone);
  }

  private history(
    tenantId: string,
    coursePackageId: string,
    version: string
  ): CoursePackageVersion[] {
    return this.snapshots.filter(
      (snapshot) =>
        snapshot.tenant_id === tenantId &&
        snapshot.course_package_id === coursePackageId &&
        snapshot.version === version
    );
  }
}
