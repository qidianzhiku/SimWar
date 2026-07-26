import { describe, expect, it } from "vitest";
import { TRUTH_PROTECTED_FIELDS } from "../../packages/shared-contracts/src/index";
import {
  InMemoryJsonParameterSetRegistry,
  ParameterSetCommandService,
  type ParameterSetDraftInput
} from "../../services/api/src/parameter-set-authority";
import {
  InMemoryJsonScenarioPackageRegistry,
  ScenarioPackageAuthorityError,
  ScenarioPackageCommandService,
  calculateScenarioPackageContentDigest,
  type ScenarioPackageAuthorityActor,
  type ScenarioPackageDraftInput
} from "../../services/api/src/scenario-package-authority";

const actor: ScenarioPackageAuthorityActor = {
  actor_id: "admin_001",
  capabilities: ["scenario_package:manage"],
  correlation_id: "corr_001",
  tenant_id: "tenant_001"
};

const parameterActor = {
  actor_id: "parameter_admin_001",
  capabilities: ["parameter_set:manage"] as const,
  correlation_id: "parameter_corr_001",
  tenant_id: "tenant_001"
};

const parameterDraftInput: ParameterSetDraftInput = {
  compatibility_metadata: {
    engine: "simulation-core.v1",
    plugin: "generic-plugin.v1"
  },
  model_version_ref: "simulation-core.v1",
  parameter_set_id: "parameter_set_001",
  parameter_values: {
    base_capacity: 120,
    base_market_size: 240
  },
  schema_version: "generic.parameters.v1",
  tenant_id: "tenant_001",
  version: "1.0.0"
};

async function createParameterAuthority() {
  const registry = new InMemoryJsonParameterSetRegistry();
  const service = new ParameterSetCommandService(registry);
  const draft = await service.createDraft(parameterActor, parameterDraftInput);
  const validated = await service.validate(parameterActor, draft.reference);
  const frozen = await service.freeze(parameterActor, validated.reference);
  const approved = await service.approve(
    parameterActor,
    frozen.reference,
    "parameter_approval_001"
  );

  return { approved: approved.version, registry, service };
}

async function createScenarioHarness(inputOverrides: Partial<ScenarioPackageDraftInput> = {}) {
  const parameterAuthority = await createParameterAuthority();
  const registry = new InMemoryJsonScenarioPackageRegistry();
  const service = new ScenarioPackageCommandService(registry, parameterAuthority.service);
  const draftInput: ScenarioPackageDraftInput = {
    artifact_policy: {
      mode: "INLINE",
      retention: "IMMUTABLE"
    },
    compatibility_metadata: {
      engine: "simulation-core.v1",
      plugin_api: "plugin-api.v1"
    },
    content: {
      objectives: ["operate", "learn"],
      rounds: [{ index: 1, label: "baseline" }]
    },
    metadata: {
      license_provenance_id: "internal-synthetic-v1",
      privacy_classification: "synthetic_internal",
      title: "Generic scenario"
    },
    parameter_set_reference: parameterAuthority.approved.reference,
    plugin_dependencies: [
      {
        plugin_package_id: "generic-plugin",
        version: "1.0.0"
      }
    ],
    scenario_package_id: "scenario_package_001",
    schema_version: "scenario-package.v1",
    tenant_id: "tenant_001",
    version: "1.0.0",
    ...inputOverrides
  };

  return { draftInput, parameterAuthority, registry, service };
}

async function createApprovedScenario(
  inputOverrides: Partial<ScenarioPackageDraftInput> = {},
  approvalId = "scenario_approval_001"
) {
  const harness = await createScenarioHarness(inputOverrides);
  const draft = await harness.service.createDraft(actor, harness.draftInput);
  const validated = await harness.service.validate(actor, draft.reference);
  const frozen = await harness.service.freeze(actor, validated.reference);
  const approved = await harness.service.approve(actor, frozen.reference, approvalId);

  return { ...harness, approved };
}

async function approveScenario(
  service: ScenarioPackageCommandService,
  draftInput: ScenarioPackageDraftInput,
  scenarioPackageId: string,
  approvalId: string
) {
  const draft = await service.createDraft(actor, {
    ...draftInput,
    scenario_package_id: scenarioPackageId
  });
  const validated = await service.validate(actor, draft.reference);
  const frozen = await service.freeze(actor, validated.reference);

  return service.approve(actor, frozen.reference, approvalId);
}

describe("ScenarioPackageCommandService", () => {
  it("creates a deeply immutable DRAFT without retaining mutable input references", async () => {
    const { draftInput, service } = await createScenarioHarness();
    const draft = await service.createDraft(actor, draftInput);

    expect(draft.status).toBe("DRAFT");
    expect(Object.isFrozen(draft)).toBe(true);
    expect(Object.isFrozen(draft.content)).toBe(true);
    expect(Object.isFrozen((draft.content as { rounds: unknown[] }).rounds)).toBe(true);
    expect(Object.isFrozen(draft.metadata)).toBe(true);
    expect(Object.isFrozen(draft.artifact_policy)).toBe(true);
    expect(Object.isFrozen(draft.plugin_dependencies)).toBe(true);

    (draftInput.content as { objectives: string[] }).objectives.push("mutated-after-create");
    expect((draft.content as { objectives: string[] }).objectives).toEqual(["operate", "learn"]);
    expect(() => {
      (draft.content as { rounds: Array<{ label: string }> }).rounds[0]!.label = "mutated";
    }).toThrow();
  });

  it("calculates a stable key-order-independent digest over immutable content identity", async () => {
    const { draftInput } = await createScenarioHarness();
    const reordered: ScenarioPackageDraftInput = {
      ...draftInput,
      artifact_policy: {
        retention: "IMMUTABLE",
        mode: "INLINE"
      },
      compatibility_metadata: {
        plugin_api: "plugin-api.v1",
        engine: "simulation-core.v1"
      },
      content: {
        rounds: [{ label: "baseline", index: 1 }],
        objectives: ["operate", "learn"]
      },
      metadata: {
        title: "Generic scenario",
        privacy_classification: "synthetic_internal",
        license_provenance_id: "internal-synthetic-v1"
      },
      parameter_set_reference: {
        version: draftInput.parameter_set_reference.version,
        parameter_set_id: draftInput.parameter_set_reference.parameter_set_id,
        content_digest: draftInput.parameter_set_reference.content_digest
      },
      plugin_dependencies: [
        {
          version: "1.0.0",
          plugin_package_id: "generic-plugin"
        }
      ]
    };

    expect(calculateScenarioPackageContentDigest(draftInput)).toBe(
      calculateScenarioPackageContentDigest(reordered)
    );
  });

  it("excludes lifecycle and approval metadata from the content digest", async () => {
    const { draftInput } = await createScenarioHarness();
    const decorated = {
      ...draftInput,
      approval_id: "approval_runtime_only",
      approved_at: "2099-01-01T00:00:00Z",
      status: "APPROVED"
    } as ScenarioPackageDraftInput;

    expect(calculateScenarioPackageContentDigest(decorated)).toBe(
      calculateScenarioPackageContentDigest(draftInput)
    );
  });

  it("appends the valid lifecycle and approval evidence before allowing binding", async () => {
    const { approved, registry, service } = await createApprovedScenario();

    expect(approved.version.status).toBe("APPROVED");
    expect(approved.approval_record.approval_id).toBe("scenario_approval_001");
    await expect(
      service.assertBindable("tenant_001", approved.version.reference)
    ).resolves.toBeUndefined();

    const snapshots = await registry.listLifecycleSnapshots(
      "tenant_001",
      "scenario_package_001",
      "1.0.0"
    );
    expect(snapshots.map(({ status }) => status)).toEqual([
      "DRAFT",
      "VALIDATED",
      "FROZEN",
      "APPROVED"
    ]);
    expect(await registry.listApprovalRecords("tenant_001", approved.version.reference)).toEqual([
      approved.approval_record
    ]);
  });

  it("rejects invalid, skipped, reverse, and duplicate lifecycle transitions", async () => {
    const { draftInput, service } = await createScenarioHarness();
    const draft = await service.createDraft(actor, draftInput);

    await expect(service.freeze(actor, draft.reference)).rejects.toThrow(
      new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_INVALID_TRANSITION")
    );
    await expect(service.approve(actor, draft.reference, "approval_skipped")).rejects.toThrow(
      new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_INVALID_TRANSITION")
    );
    await expect(service.retire(actor, draft.reference)).rejects.toThrow(
      new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_INVALID_TRANSITION")
    );

    const validated = await service.validate(actor, draft.reference);
    await expect(service.validate(actor, validated.reference)).rejects.toThrow(
      new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_INVALID_TRANSITION")
    );
  });

  it("enforces tenant scope and the existing capability authority", async () => {
    const { draftInput, service } = await createScenarioHarness();

    await expect(
      service.createDraft({ ...actor, tenant_id: "tenant_other" }, draftInput)
    ).rejects.toThrow(new ScenarioPackageAuthorityError("TENANT_SCOPE_VIOLATION"));
    await expect(service.createDraft({ ...actor, capabilities: [] }, draftInput)).rejects.toThrow(
      new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_CAPABILITY_REQUIRED")
    );
  });

  it("distinguishes duplicate identity from conflicting content digest", async () => {
    const { draftInput, service } = await createScenarioHarness();
    await service.createDraft(actor, draftInput);

    await expect(service.createDraft(actor, draftInput)).rejects.toThrow(
      new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_VERSION_ALREADY_EXISTS")
    );
    await expect(
      service.createDraft(actor, {
        ...draftInput,
        content: { objectives: ["different"] }
      })
    ).rejects.toThrow(new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_DIGEST_CONFLICT"));
  });

  it("keeps approval snapshot and record appends atomic on approval-id conflict", async () => {
    const { parameterAuthority, registry, service, draftInput } = await createScenarioHarness();
    const createFrozen = async (scenario_package_id: string) => {
      const draft = await service.createDraft(actor, { ...draftInput, scenario_package_id });
      const validated = await service.validate(actor, draft.reference);
      return service.freeze(actor, validated.reference);
    };
    const first = await createFrozen("scenario_package_first");
    await service.approve(actor, first.reference, "approval_duplicate");
    const second = await createFrozen("scenario_package_second");

    await expect(service.approve(actor, second.reference, "approval_duplicate")).rejects.toThrow(
      new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_VERSION_ALREADY_EXISTS")
    );
    await expect(service.getByReference("tenant_001", second.reference)).resolves.toMatchObject({
      status: "FROZEN"
    });
    await expect(registry.listApprovalRecords("tenant_001", second.reference)).resolves.toEqual([]);
    await expect(
      parameterAuthority.service.getByReference("tenant_001", parameterAuthority.approved.reference)
    ).resolves.toMatchObject({ status: "APPROVED" });
  });

  it("makes only APPROVED versions bindable and preserves RETIRED history", async () => {
    const { draftInput, registry, service } = await createScenarioHarness();
    const draft = await service.createDraft(actor, draftInput);
    await expect(service.assertBindable("tenant_001", draft.reference)).rejects.toThrow(
      new ScenarioPackageAuthorityError("NOT_APPROVED")
    );
    const validated = await service.validate(actor, draft.reference);
    await expect(service.assertBindable("tenant_001", validated.reference)).rejects.toThrow(
      new ScenarioPackageAuthorityError("NOT_APPROVED")
    );
    const frozen = await service.freeze(actor, validated.reference);
    await expect(service.assertBindable("tenant_001", frozen.reference)).rejects.toThrow(
      new ScenarioPackageAuthorityError("NOT_APPROVED")
    );
    const approved = await service.approve(actor, frozen.reference, "approval_bindable");
    await expect(
      service.assertBindable("tenant_001", approved.version.reference)
    ).resolves.toBeUndefined();
    const retired = await service.retire(actor, approved.version.reference);
    await expect(service.assertBindable("tenant_001", retired.reference)).rejects.toThrow(
      new ScenarioPackageAuthorityError("RETIRED_FOR_NEW_BINDING")
    );
    await expect(service.getByReference("tenant_001", retired.reference)).resolves.toMatchObject({
      status: "RETIRED"
    });
    expect(
      await registry.listLifecycleSnapshots("tenant_001", "scenario_package_001", "1.0.0")
    ).toHaveLength(5);
  });

  it("preserves only the exact approved ParameterSetReference without embedding its content", async () => {
    const { draftInput, parameterAuthority, service } = await createScenarioHarness();
    const draft = await service.createDraft(actor, draftInput);

    expect(draft.parameter_set_reference).toEqual(parameterAuthority.approved.reference);
    expect(Object.keys(draft.parameter_set_reference).sort()).toEqual([
      "content_digest",
      "parameter_set_id",
      "version"
    ]);
    expect(draft).not.toHaveProperty("parameter_values");
    expect(JSON.stringify(draft)).not.toContain("base_market_size");
  });

  it("rejects a ParameterSet reference that is not exactly bindable", async () => {
    const { draftInput, service } = await createScenarioHarness();

    await expect(
      service.createDraft(actor, {
        ...draftInput,
        parameter_set_reference: {
          ...draftInput.parameter_set_reference,
          content_digest: "f".repeat(64)
        }
      })
    ).rejects.toThrow(
      new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_PARAMETER_SET_NOT_BINDABLE")
    );
  });

  it("validates generic metadata and compatibility without requiring an industry schema", async () => {
    const { draftInput, service } = await createScenarioHarness({
      content: {
        arbitrary_domain: {
          choices: ["a", "b"],
          constraints: { maximum: 10 }
        }
      },
      metadata: {
        title: "Industry-neutral scenario"
      }
    });
    const draft = await service.createDraft(actor, draftInput);
    await expect(service.validate(actor, draft.reference)).resolves.toMatchObject({
      status: "VALIDATED"
    });

    const invalidHarness = await createScenarioHarness({
      compatibility_metadata: { engine: " " }
    });
    const invalid = await invalidHarness.service.createDraft(actor, invalidHarness.draftInput);
    await expect(invalidHarness.service.validate(actor, invalid.reference)).rejects.toThrow(
      new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_VALIDATION_FAILED")
    );
  });

  it("rejects floating and range plugin dependency versions", async () => {
    for (const version of [
      "latest",
      "next",
      "*",
      "1.x",
      "1.2.x",
      "1.X",
      "^1.0.0",
      "~1.0.0",
      ">1.0.0",
      ">=1.0.0",
      "<2.0.0",
      "<=2.0.0",
      "=1.0.0",
      "1.0.0 || 2.0.0",
      "1.0.0,2.0.0",
      "1.0.0 2.0.0",
      "1.0.0 - 2.0.0",
      "v1.0.0",
      "1.0.0/2"
    ]) {
      const harness = await createScenarioHarness({
        plugin_dependencies: [{ plugin_package_id: "generic-plugin", version }]
      });
      const draft = await harness.service.createDraft(actor, harness.draftInput);

      await expect(harness.service.validate(actor, draft.reference)).rejects.toThrow(
        new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_VALIDATION_FAILED")
      );
    }
  });

  it.each(TRUTH_PROTECTED_FIELDS)(
    "rejects canonical truth-protected field %s in nested content",
    async (protectedField) => {
      const harness = await createScenarioHarness({
        content: {
          nested: {
            [protectedField]: "forbidden"
          }
        }
      });
      const draft = await harness.service.createDraft(actor, harness.draftInput);

      await expect(harness.service.validate(actor, draft.reference)).rejects.toThrow(
        new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_VALIDATION_FAILED")
      );
    }
  );

  it.each(TRUTH_PROTECTED_FIELDS)(
    "rejects canonical truth-protected field %s in nested metadata",
    async (protectedField) => {
      const harness = await createScenarioHarness({
        metadata: {
          nested: {
            [protectedField]: "forbidden"
          }
        }
      });
      const draft = await harness.service.createDraft(actor, harness.draftInput);

      await expect(harness.service.validate(actor, draft.reference)).rejects.toThrow(
        new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_VALIDATION_FAILED")
      );
    }
  );

  it("rejects embedded ParameterSet values and formal truth output fields", async () => {
    for (const content of [
      { parameter_values: { demand: 100 } },
      { result: { state_true: { profit: 10 } } },
      { replay_hash: "not-scenario-content" },
      { SettlementResult: { rank: 1 } }
    ]) {
      const harness = await createScenarioHarness({
        content
      });
      const draft = await harness.service.createDraft(actor, harness.draftInput);

      await expect(harness.service.validate(actor, draft.reference)).rejects.toThrow(
        new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_VALIDATION_FAILED")
      );
    }
  });

  it("rejects non-finite values before creating an unstable JSON digest", async () => {
    const harness = await createScenarioHarness({
      content: {
        invalid_number: Number.NaN
      }
    });

    await expect(harness.service.createDraft(actor, harness.draftInput)).rejects.toThrow(
      new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_VALIDATION_FAILED")
    );
  });

  it("keeps lifecycle and approval history append-only for callers", async () => {
    const { approved, registry } = await createApprovedScenario();
    const firstSnapshots = await registry.listLifecycleSnapshots(
      "tenant_001",
      "scenario_package_001",
      "1.0.0"
    );
    const firstApprovals = await registry.listApprovalRecords(
      "tenant_001",
      approved.version.reference
    );

    firstSnapshots.splice(0);
    firstApprovals.splice(0);

    await expect(
      registry.listLifecycleSnapshots("tenant_001", "scenario_package_001", "1.0.0")
    ).resolves.toHaveLength(4);
    await expect(
      registry.listApprovalRecords("tenant_001", approved.version.reference)
    ).resolves.toHaveLength(1);
  });

  it("lists approved ScenarioPackage Authority projections in deterministic identifier order", async () => {
    const { draftInput, service } = await createScenarioHarness();
    const authorityReadService = service as unknown as {
      listApprovedForTenant(
        tenantId: string
      ): Promise<Array<{ scenario_package_id: string; status: string }>>;
    };

    await approveScenario(service, draftInput, "scenario_z", "approval_z");
    await approveScenario(service, draftInput, "scenario_a", "approval_a");
    await service.createDraft(actor, {
      ...draftInput,
      scenario_package_id: "scenario_draft"
    });

    const projections = await authorityReadService.listApprovedForTenant("tenant_001");

    expect(
      projections.map(({ scenario_package_id, status }) => ({ scenario_package_id, status }))
    ).toEqual([
      {
        scenario_package_id: "scenario_a",
        status: "APPROVED"
      },
      {
        scenario_package_id: "scenario_z",
        status: "APPROVED"
      }
    ]);
  });

  it("keeps Authority projection reads tenant-scoped and free of mutable scenario content", async () => {
    const { approved, service } = await createApprovedScenario();
    const authorityReadService = service as unknown as {
      listApprovedForTenant(tenantId: string): Promise<
        Array<{
          compatibility_metadata: Readonly<Record<string, string>>;
          content_digest: string;
          parameter_set_reference: unknown;
          reference: unknown;
          scenario_package_id: string;
          status: string;
        }>
      >;
    };

    const projections = await authorityReadService.listApprovedForTenant("tenant_001");

    expect(projections).toHaveLength(1);
    expect(projections[0]).toMatchObject({
      content_digest: approved.version.content_digest,
      parameter_set_reference: approved.version.parameter_set_reference,
      reference: approved.version.reference,
      scenario_package_id: "scenario_package_001",
      status: "APPROVED"
    });
    expect(projections[0]).not.toHaveProperty("content");
    expect(projections[0]).not.toHaveProperty("metadata");
    expect(Object.isFrozen(projections[0])).toBe(true);
    expect(Object.isFrozen(projections[0]!.compatibility_metadata)).toBe(true);
    expect(() => {
      (projections[0]!.compatibility_metadata as Record<string, string>).engine = "tampered";
    }).toThrow();

    projections.splice(0);

    await expect(authorityReadService.listApprovedForTenant("tenant_001")).resolves.toHaveLength(1);
    await expect(authorityReadService.listApprovedForTenant("tenant_other")).resolves.toEqual([]);
  });
});
