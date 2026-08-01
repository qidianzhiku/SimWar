import { createHash, randomUUID } from "node:crypto";
import { isExactRef, type ExactRef } from "@simwar/shared-contracts";

export type InstructorAssetStatus = "draft" | "teacher_published" | "rejected";

export interface InstructorAsset {
  readonly asset_id: string;
  readonly course_id: string;
  readonly course_blueprint_ref: ExactRef;
  readonly created_at: string;
  readonly created_by: string;
  readonly fact_digest: string;
  readonly revision_of_asset_id?: string;
  status: InstructorAssetStatus;
  readonly tenant_id: string;
  readonly title: string;
  updated_at: string;
}

export interface CreateInstructorAssetDraftInput {
  actor_id: string;
  course_id: string;
  course_blueprint_ref: ExactRef;
  tenant_id: string;
  title: string;
}

export interface InstructorAssetTransitionInput {
  actor_id: string;
  asset_id: string;
  tenant_id: string;
}

export interface CreateInstructorAssetRevisionInput extends InstructorAssetTransitionInput {
  title: string;
}

export interface InstructorAssetRegistryDependencies {
  captureAuditCheckpoint?: () => unknown;
  createId?: () => string;
  now?: () => string;
  persist?: (assets: readonly InstructorAsset[]) => void;
  restoreAuditCheckpoint?: (checkpoint: unknown) => void;
}

export class InstructorAssetRegistryError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "InstructorAssetRegistryError";
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value === value.trim();
}

function isCanonicalUtcTimestamp(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
  ) {
    return false;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return false;
  return parsed.toISOString() === (value.includes(".") ? value : `${value.slice(0, -1)}.000Z`);
}

function digestFor(
  input: Pick<
    InstructorAsset,
    | "asset_id"
    | "course_blueprint_ref"
    | "course_id"
    | "revision_of_asset_id"
    | "tenant_id"
    | "title"
  >
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        asset_id: input.asset_id,
        course_blueprint_ref: input.course_blueprint_ref,
        course_id: input.course_id,
        revision_of_asset_id: input.revision_of_asset_id ?? null,
        tenant_id: input.tenant_id,
        title: input.title
      })
    )
    .digest("hex");
}

export function assertValidInstructorAsset(asset: Readonly<InstructorAsset>): void {
  if (
    !nonBlank(asset.asset_id) ||
    !nonBlank(asset.course_id) ||
    !isExactRef(asset.course_blueprint_ref) ||
    asset.course_blueprint_ref.resource_type !== "course_blueprint" ||
    asset.course_blueprint_ref.tenant_id !== asset.tenant_id ||
    !isCanonicalUtcTimestamp(asset.created_at) ||
    !nonBlank(asset.created_by) ||
    !/^[a-f0-9]{64}$/.test(asset.fact_digest) ||
    asset.fact_digest !== digestFor(asset) ||
    (asset.revision_of_asset_id !== undefined && !nonBlank(asset.revision_of_asset_id)) ||
    !["draft", "teacher_published", "rejected"].includes(asset.status) ||
    !nonBlank(asset.tenant_id) ||
    !nonBlank(asset.title) ||
    !isCanonicalUtcTimestamp(asset.updated_at)
  ) {
    throw new InstructorAssetRegistryError("INSTRUCTOR_ASSET_INVALID");
  }
}

/**
 * C4's sole asset authority. It deliberately has no resolver, direct
 * persistence implementation, route, provider, or simulation dependency.
 */
export class InstructorAssetRegistry {
  private readonly assets: InstructorAsset[];
  private readonly createId: () => string;
  private readonly captureAuditCheckpoint: () => unknown;
  private readonly now: () => string;
  private readonly persist: (assets: readonly InstructorAsset[]) => void;
  private readonly restoreAuditCheckpoint: (checkpoint: unknown) => void;

  constructor(
    dependencies: InstructorAssetRegistryDependencies = {},
    assets: InstructorAsset[] = []
  ) {
    const assetIds = new Set<string>();
    assets.forEach((asset) => {
      assertValidInstructorAsset(asset);
      if (assetIds.has(asset.asset_id)) {
        throw new InstructorAssetRegistryError("INSTRUCTOR_ASSET_INVALID");
      }
      assetIds.add(asset.asset_id);
    });
    this.assets = clone(assets);
    this.createId = dependencies.createId ?? (() => `instructor_asset_${randomUUID()}`);
    this.captureAuditCheckpoint = dependencies.captureAuditCheckpoint ?? (() => undefined);
    this.now = dependencies.now ?? (() => new Date().toISOString());
    this.persist = dependencies.persist ?? (() => undefined);
    this.restoreAuditCheckpoint = dependencies.restoreAuditCheckpoint ?? (() => undefined);
  }

  createDraft(input: CreateInstructorAssetDraftInput): InstructorAsset {
    this.assertDraftInput(input);
    const createdAt = this.now();
    const assetId = this.createUniqueId();
    const assetCore = {
      asset_id: assetId,
      course_id: input.course_id,
      course_blueprint_ref: clone(input.course_blueprint_ref),
      created_at: createdAt,
      created_by: input.actor_id,
      status: "draft" as const,
      tenant_id: input.tenant_id,
      title: input.title,
      updated_at: createdAt
    };
    const asset: InstructorAsset = { ...assetCore, fact_digest: digestFor(assetCore) };
    assertValidInstructorAsset(asset);
    this.assets.push(asset);
    try {
      this.persist(clone(this.assets));
    } catch (error) {
      this.assets.pop();
      throw error;
    }
    return clone(asset);
  }

  createRevision(input: CreateInstructorAssetRevisionInput): InstructorAsset {
    const source = this.getOwned(input.tenant_id, input.asset_id);
    this.assertImmutable(source);
    if (!nonBlank(input.title))
      throw new InstructorAssetRegistryError("INSTRUCTOR_ASSET_TITLE_INVALID");
    const createdAt = this.now();
    const assetId = this.createUniqueId();
    const assetCore = {
      asset_id: assetId,
      course_id: source.course_id,
      course_blueprint_ref: clone(source.course_blueprint_ref),
      created_at: createdAt,
      created_by: input.actor_id,
      revision_of_asset_id: source.asset_id,
      status: "draft" as const,
      tenant_id: source.tenant_id,
      title: input.title,
      updated_at: createdAt
    };
    const asset: InstructorAsset = { ...assetCore, fact_digest: digestFor(assetCore) };
    assertValidInstructorAsset(asset);
    this.assets.push(asset);
    try {
      this.persist(clone(this.assets));
    } catch (error) {
      this.assets.pop();
      throw error;
    }
    return clone(asset);
  }

  list(tenantId: string, courseId?: string): InstructorAsset[] {
    return this.assets
      .filter(
        (asset) =>
          asset.tenant_id === tenantId && (courseId === undefined || asset.course_id === courseId)
      )
      .map(clone);
  }

  get(tenantId: string, assetId: string): InstructorAsset {
    return clone(this.getOwned(tenantId, assetId));
  }

  publish(input: InstructorAssetTransitionInput): InstructorAsset {
    return this.transition(input, "teacher_published");
  }

  reject(input: InstructorAssetTransitionInput): InstructorAsset {
    return this.transition(input, "rejected");
  }

  /** Compensates a created asset when its required audit append fails. */
  discardAfterAuditFailure(input: InstructorAssetTransitionInput): void {
    const index = this.assets.findIndex(
      (candidate) =>
        candidate.tenant_id === input.tenant_id && candidate.asset_id === input.asset_id
    );
    if (index < 0) throw new InstructorAssetRegistryError("INSTRUCTOR_ASSET_NOT_FOUND");
    const [asset] = this.assets.splice(index, 1);
    try {
      this.persist(clone(this.assets));
    } catch (error) {
      this.assets.splice(index, 0, asset!);
      throw error;
    }
  }

  /** Restores a terminal asset to draft when its required audit append fails. */
  revertTransitionAfterAuditFailure(input: InstructorAssetTransitionInput): void {
    const asset = this.getOwned(input.tenant_id, input.asset_id);
    if (asset.status === "draft")
      throw new InstructorAssetRegistryError("INSTRUCTOR_ASSET_IMMUTABLE");
    const previousStatus = asset.status;
    const previousUpdatedAt = asset.updated_at;
    asset.status = "draft";
    asset.updated_at = asset.created_at;
    try {
      this.persist(clone(this.assets));
    } catch (error) {
      asset.status = previousStatus;
      asset.updated_at = previousUpdatedAt;
      throw error;
    }
  }

  captureAuditCheckpointForCompensation(): unknown {
    return this.captureAuditCheckpoint();
  }

  restoreAuditCheckpointAfterFailure(checkpoint: unknown): void {
    this.restoreAuditCheckpoint(checkpoint);
  }

  private assertDraftInput(input: CreateInstructorAssetDraftInput): void {
    if (
      !nonBlank(input.actor_id) ||
      !nonBlank(input.course_id) ||
      !nonBlank(input.tenant_id) ||
      !nonBlank(input.title)
    ) {
      throw new InstructorAssetRegistryError("INSTRUCTOR_ASSET_INPUT_INVALID");
    }
    if (
      !isExactRef(input.course_blueprint_ref) ||
      input.course_blueprint_ref.resource_type !== "course_blueprint" ||
      input.course_blueprint_ref.tenant_id !== input.tenant_id
    ) {
      throw new InstructorAssetRegistryError("INSTRUCTOR_ASSET_EXACT_REFERENCE_REQUIRED");
    }
  }

  private createUniqueId(): string {
    const assetId = this.createId();
    if (!nonBlank(assetId) || this.assets.some((asset) => asset.asset_id === assetId)) {
      throw new InstructorAssetRegistryError("INSTRUCTOR_ASSET_ID_COLLISION");
    }
    return assetId;
  }

  private assertImmutable(asset: InstructorAsset): void {
    if (asset.status === "draft") {
      throw new InstructorAssetRegistryError("INSTRUCTOR_ASSET_REVISION_REQUIRES_FINAL_STATE");
    }
  }

  private getOwned(tenantId: string, assetId: string): InstructorAsset {
    const asset = this.assets.find(
      (candidate) => candidate.tenant_id === tenantId && candidate.asset_id === assetId
    );
    if (!asset) throw new InstructorAssetRegistryError("INSTRUCTOR_ASSET_NOT_FOUND");
    return asset;
  }

  private transition(
    input: InstructorAssetTransitionInput,
    status: Exclude<InstructorAssetStatus, "draft">
  ): InstructorAsset {
    const asset = this.getOwned(input.tenant_id, input.asset_id);
    if (asset.status !== "draft")
      throw new InstructorAssetRegistryError("INSTRUCTOR_ASSET_IMMUTABLE");
    const previousStatus = asset.status;
    const previousUpdatedAt = asset.updated_at;
    asset.status = status;
    asset.updated_at = this.now();
    try {
      this.persist(clone(this.assets));
    } catch (error) {
      asset.status = previousStatus;
      asset.updated_at = previousUpdatedAt;
      throw error;
    }
    return clone(asset);
  }
}
