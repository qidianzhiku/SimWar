import { describe, expect, it } from "vitest";
import {
  InMemoryJsonParameterSetRegistry,
  ParameterSetAuthorityError,
  ParameterSetCommandService,
  calculateParameterSetContentDigest,
  type ParameterSetDraftInput
} from "../../services/api/src/parameter-set-authority";

const actor = {
  actor_id: "admin_001",
  capabilities: ["parameter_set:manage"] as const,
  correlation_id: "corr_001",
  tenant_id: "tenant_001"
};

const draftInput: ParameterSetDraftInput = {
  compatibility_metadata: {
    engine: "toy_logit.v1",
    plugin: "wellness.v1"
  },
  model_version_ref: "toy_logit.v1",
  parameter_set_id: "parameter_set_001",
  parameter_values: {
    base_capacity: 120,
    base_market_size: 240,
    demand: { price_sensitivity: 0.5 }
  },
  schema_version: "wellness.parameters.v1",
  tenant_id: "tenant_001",
  version: "1.0.0"
};

async function createApprovedVersion() {
  const registry = new InMemoryJsonParameterSetRegistry();
  const service = new ParameterSetCommandService(registry);
  const draft = await service.createDraft(actor, draftInput);
  const validated = await service.validate(actor, draft.reference);
  const frozen = await service.freeze(actor, validated.reference);
  const approved = await service.approve(actor, frozen.reference, "approval_001");

  return { approved, registry, service };
}

describe("ParameterSetCommandService", () => {
  it("uses a stable digest and an append-only lifecycle before binding", async () => {
    const { approved, registry, service } = await createApprovedVersion();

    expect(approved.version.status).toBe("APPROVED");
    expect(approved.approval_record.approval_id).toBe("approval_001");
    await expect(
      service.assertBindable("tenant_001", approved.version.reference)
    ).resolves.toBeUndefined();
    expect(
      await registry.listLifecycleSnapshots("tenant_001", "parameter_set_001", "1.0.0")
    ).toHaveLength(4);
  });

  it("rejects duplicate versions, cross-tenant commands, mutable frozen content, and retired binding", async () => {
    const { approved, service } = await createApprovedVersion();

    await expect(service.createDraft(actor, draftInput)).rejects.toThrow(
      new ParameterSetAuthorityError("PARAMETER_SET_VERSION_ALREADY_EXISTS")
    );
    await expect(
      service.createDraft({ ...actor, tenant_id: "tenant_other" }, draftInput)
    ).rejects.toThrow(new ParameterSetAuthorityError("TENANT_SCOPE_VIOLATION"));
    expect(() => {
      (approved.version.parameter_values.demand as Record<string, number>).price_sensitivity = 1;
    }).toThrow();

    const retired = await service.retire(actor, approved.version.reference);
    await expect(service.assertBindable("tenant_001", retired.reference)).rejects.toThrow(
      new ParameterSetAuthorityError("RETIRED_FOR_NEW_BINDING")
    );
    await expect(service.getByReference("tenant_001", retired.reference)).resolves.toMatchObject({
      status: "RETIRED"
    });
  });

  it("canonicalizes equivalent parameter content before hashing", () => {
    const reordered: ParameterSetDraftInput = {
      ...draftInput,
      compatibility_metadata: {
        plugin: "wellness.v1",
        engine: "toy_logit.v1"
      },
      parameter_values: {
        demand: { price_sensitivity: 0.5 },
        base_market_size: 240,
        base_capacity: 120
      }
    };

    expect(calculateParameterSetContentDigest(draftInput)).toBe(
      calculateParameterSetContentDigest(reordered)
    );
  });
  it("rejects invalid numeric and cross-field parameter content before validation", async () => {
    const registry = new InMemoryJsonParameterSetRegistry();
    const service = new ParameterSetCommandService(registry);
    const draft = await service.createDraft(actor, {
      ...draftInput,
      parameter_set_id: "parameter_set_invalid",
      parameter_values: {
        base_capacity: 241,
        base_market_size: 240,
        demand: { price_sensitivity: -0.5 }
      }
    });

    await expect(service.validate(actor, draft.reference)).rejects.toThrow(
      new ParameterSetAuthorityError("PARAMETER_SET_VALIDATION_FAILED")
    );
  });
});
