export const PLUGIN_RELEASE_LIFECYCLE_STATUSES = [
  "DRAFT",
  "VALIDATED",
  "APPROVED",
  "AVAILABLE",
  "RETIRED"
] as const;

export type PluginReleaseLifecycleStatus = (typeof PLUGIN_RELEASE_LIFECYCLE_STATUSES)[number];

export interface PluginReleaseReference {
  content_digest: string;
  plugin_package_id: string;
  version: string;
}

export interface PluginReleaseReferenceInput {
  content_digest: string;
  plugin_package_id: string;
  version: string;
}

export interface PluginReleaseAuthorityReadProjection {
  content_digest: string;
  plugin_package_id: string;
  reference: PluginReleaseReference;
  status: PluginReleaseLifecycleStatus;
  version: string;
}

export interface PluginReleaseAuthorityReadPort {
  getByReference(
    reference: PluginReleaseReference
  ): Promise<PluginReleaseAuthorityReadProjection | null>;
  resolveAvailableForNewBinding(
    pluginPackageId: string,
    version: string
  ): Promise<PluginReleaseAuthorityReadProjection | null>;
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

/**
 * Normalizes a plugin release to its immutable identity. Lifecycle state is
 * intentionally outside this reference, so a retired historical release can
 * still resolve by its exact content digest.
 */
export function createPluginReleaseReference(
  input: PluginReleaseReferenceInput
): PluginReleaseReference {
  if (
    !isNonBlankString(input.plugin_package_id) ||
    !isNonBlankString(input.version) ||
    !isSha256(input.content_digest)
  ) {
    throw new Error("PLUGIN_RELEASE_REFERENCE_INVALID");
  }

  return Object.freeze({
    content_digest: input.content_digest,
    plugin_package_id: input.plugin_package_id,
    version: input.version
  });
}
