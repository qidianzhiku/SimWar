import { describe, expect, it, vi } from "vitest";
import type { PluginManifest } from "../../packages/shared-contracts/src";
import {
  InMemoryJsonPluginReleaseRegistry,
  PluginReleaseAuthorityError,
  PluginReleaseCommandService,
  calculatePluginReleaseContentDigest,
  type InMemoryJsonPluginReleaseRegistryOptions,
  type PluginReleaseDraftInput
} from "../../services/api/src/plugin-release-authority";
import { ELDERCARE_WELLNESS_PLUGIN_MANIFEST } from "../../plugins/wellness/eldercare-plugin-v1";

const actor = {
  actor_id: "plugin_release_admin",
  capabilities: [
    "plugin_release:manage",
    "plugin_release:approve",
    "plugin_release:make_available"
  ] as const,
  correlation_id: "correlation_plugin_release"
};

function approvedManifest(input: { plugin_id: string; version: string }): PluginManifest {
  return {
    ...ELDERCARE_WELLNESS_PLUGIN_MANIFEST,
    plugin_id: input.plugin_id,
    status: "approved",
    version: input.version
  };
}

function draftInput(
  input: {
    manifest?: PluginManifest;
    plugin_package_id?: string;
    version?: string;
  } = {}
): PluginReleaseDraftInput {
  const plugin_manifest = input.manifest ?? ELDERCARE_WELLNESS_PLUGIN_MANIFEST;

  return {
    compatibility_metadata: {
      engine_family: "eldercare-core.v1",
      parameter_schema: plugin_manifest.parameter_schema_version
    },
    official_commit_permissions: [],
    plugin_manifest,
    plugin_package_id: input.plugin_package_id ?? plugin_manifest.plugin_id,
    schema_version: "plugin-release.v1",
    version: input.version ?? plugin_manifest.version
  };
}

async function createValidatedCandidate() {
  const registry = new InMemoryJsonPluginReleaseRegistry();
  const service = new PluginReleaseCommandService(registry);
  const draft = await service.createDraft(actor, draftInput());
  const validated = await service.validate(actor, draft.reference);

  return { registry, service, validated };
}

async function createAvailableRelease() {
  const registry = new InMemoryJsonPluginReleaseRegistry();
  const service = new PluginReleaseCommandService(registry);
  const manifest = approvedManifest({
    plugin_id: "plugin_wellness_eldercare_release_test",
    version: "2.0.0"
  });
  const draft = await service.createDraft(actor, draftInput({ manifest }));
  const validated = await service.validate(actor, draft.reference);
  const approved = await service.approve(actor, validated.reference, "owner-decision-plugin-001");
  const available = await service.makeAvailable(
    actor,
    approved.version.reference,
    "availability-decision-plugin-001"
  );

  return { approved, available, registry, service };
}

describe("PluginReleaseCommandService", () => {
  it("keeps the current Eldercare candidate registered and validated but unavailable for binding", async () => {
    const { service, validated } = await createValidatedCandidate();

    expect(validated.status).toBe("VALIDATED");
    expect(validated.official_commit_permissions).toEqual([]);
    expect(validated.content_digest).toMatch(/^[a-f0-9]{64}$/);
    await expect(service.assertApprovedForFormalBinding(validated.reference)).rejects.toThrow(
      new PluginReleaseAuthorityError("PLUGIN_RELEASE_NOT_APPROVED")
    );
    await expect(service.assertAvailableForRuntime(validated.reference)).rejects.toThrow(
      new PluginReleaseAuthorityError("PLUGIN_RELEASE_NOT_AVAILABLE")
    );
  });

  it("requires exact approval and availability records before a release becomes bindable", async () => {
    const { approved, available, registry, service } = await createAvailableRelease();

    expect(available.version.status).toBe("AVAILABLE");
    expect(approved.approval_record.owner_decision_id).toBe("owner-decision-plugin-001");
    expect(available.availability_record.availability_decision_id).toBe(
      "availability-decision-plugin-001"
    );
    await expect(
      service.assertApprovedForFormalBinding(available.version.reference)
    ).resolves.toBeUndefined();
    await expect(
      service.assertAvailableForRuntime(available.version.reference)
    ).resolves.toBeUndefined();
    expect(
      await registry.listLifecycleSnapshots(
        available.version.reference.plugin_package_id,
        available.version.reference.version
      )
    ).toHaveLength(4);

    const retired = await service.retire(actor, available.version.reference);
    await expect(service.assertAvailableForRuntime(retired.reference)).rejects.toThrow(
      new PluginReleaseAuthorityError("PLUGIN_RELEASE_RETIRED_FOR_NEW_BINDING")
    );
    await expect(service.getByReference(retired.reference)).resolves.toMatchObject({
      status: "RETIRED"
    });
  });

  it("persists append-only lifecycle, approval, and availability records through its JSON seam", async () => {
    const approvals: NonNullable<InMemoryJsonPluginReleaseRegistryOptions["approvals"]> = [];
    const availability: NonNullable<InMemoryJsonPluginReleaseRegistryOptions["availability"]> = [];
    const snapshots: NonNullable<InMemoryJsonPluginReleaseRegistryOptions["snapshots"]> = [];
    const onAppend = vi.fn();
    const registry = new InMemoryJsonPluginReleaseRegistry({
      approvals,
      availability,
      onAppend,
      snapshots
    });
    const service = new PluginReleaseCommandService(registry);
    const manifest = approvedManifest({
      plugin_id: "plugin_persisted_authority_test",
      version: "1.0.0"
    });

    const draft = await service.createDraft(actor, draftInput({ manifest }));
    const validated = await service.validate(actor, draft.reference);
    const approved = await service.approve(
      actor,
      validated.reference,
      "owner-decision-persisted-001"
    );
    await service.makeAvailable(actor, approved.version.reference, "availability-persisted-001");

    expect(snapshots).toHaveLength(4);
    expect(approvals).toHaveLength(1);
    expect(availability).toHaveLength(1);
    expect(onAppend).toHaveBeenCalledTimes(4);
  });

  it("rolls back an append when the JSON persistence seam fails", async () => {
    const snapshots: NonNullable<InMemoryJsonPluginReleaseRegistryOptions["snapshots"]> = [];
    const registry = new InMemoryJsonPluginReleaseRegistry({
      onAppend: () => {
        throw new Error("persist failed");
      },
      snapshots
    });
    const service = new PluginReleaseCommandService(registry);

    await expect(
      service.createDraft(
        actor,
        draftInput({
          manifest: approvedManifest({
            plugin_id: "plugin_persisted_authority_rollback_test",
            version: "1.0.0"
          })
        })
      )
    ).rejects.toThrow("persist failed");

    expect(snapshots).toHaveLength(0);
  });

  it("rejects manifest identity drift and any plugin official-commit permission", async () => {
    const registry = new InMemoryJsonPluginReleaseRegistry();
    const service = new PluginReleaseCommandService(registry);
    const mismatched = await service.createDraft(
      actor,
      draftInput({ plugin_package_id: "plugin_identity_mismatch" })
    );

    await expect(service.validate(actor, mismatched.reference)).rejects.toThrow(
      new PluginReleaseAuthorityError("PLUGIN_RELEASE_MANIFEST_IDENTITY_MISMATCH")
    );

    const withPermission = await service.createDraft(actor, {
      ...draftInput({
        manifest: approvedManifest({
          plugin_id: "plugin_permission_test",
          version: "1.0.0"
        })
      }),
      official_commit_permissions: ["SettlementResult"]
    });

    await expect(service.validate(actor, withPermission.reference)).rejects.toThrow(
      new PluginReleaseAuthorityError("PLUGIN_RELEASE_OFFICIAL_COMMIT_FORBIDDEN")
    );
  });

  it("canonicalizes equivalent release content before hashing", () => {
    const first = draftInput({
      manifest: approvedManifest({ plugin_id: "plugin_digest_test", version: "1.0.0" })
    });
    const reordered: PluginReleaseDraftInput = {
      ...first,
      compatibility_metadata: {
        parameter_schema: first.compatibility_metadata.parameter_schema,
        engine_family: first.compatibility_metadata.engine_family
      }
    };

    expect(calculatePluginReleaseContentDigest(first)).toBe(
      calculatePluginReleaseContentDigest(reordered)
    );
  });
});
