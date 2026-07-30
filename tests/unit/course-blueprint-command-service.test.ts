import { describe, expect, it } from "vitest";
import {
  CourseBlueprintAuthorityError,
  CourseBlueprintCommandService,
  InMemoryJsonCourseBlueprintRegistry,
  calculateCourseBlueprintContentDigest,
  type CourseBlueprintDraftInput
} from "../../services/api/src/course-blueprint-authority";

const actor = {
  actor_id: "platform_001",
  capabilities: ["course_blueprint:manage"] as const,
  correlation_id: "corr_course_blueprint_001",
  tenant_id: "tenant_001"
};

const draftInput: CourseBlueprintDraftInput = {
  activity_plan: [{ activity_id: "activity_001", phase_id: "phase_001", title: "Discuss" }],
  course_blueprint_id: "course_blueprint_001",
  description: "A bounded teaching blueprint.",
  duration_minutes: 60,
  instructor_guidance_reference: "guide://course-blueprint-001",
  objectives: ["Complete one structured simulation round."],
  ordered_phases: [
    {
      activity_type: "discussion",
      duration_minutes: 20,
      order: 1,
      phase_id: "phase_001",
      student_instruction: "Discuss the decision.",
      teacher_guidance: "Keep the discussion bounded.",
      title: "Decision"
    }
  ],
  required_product_capabilities: ["decision_submit", "round_publish"],
  scenario_compatibility_constraints: { scenario_family: "wellness" },
  schema_version: "course-blueprint.v1",
  tenant_id: "tenant_001",
  title: "M1 Course Blueprint",
  version: "1.0.0"
};

async function createApproved() {
  const registry = new InMemoryJsonCourseBlueprintRegistry();
  const service = new CourseBlueprintCommandService(registry);
  const draft = await service.createDraft(actor, draftInput);
  const validated = await service.validate(actor, draft.reference);
  const frozen = await service.freeze(actor, validated.reference);
  const approved = await service.approve(actor, frozen.reference, "approval_001");
  return { approved, registry, service };
}

function createRawDraft(input: CourseBlueprintDraftInput) {
  const content_digest = calculateCourseBlueprintContentDigest(input);
  return {
    ...input,
    content_digest,
    reference: {
      content_digest,
      course_blueprint_id: input.course_blueprint_id,
      tenant_id: input.tenant_id,
      version: input.version
    },
    status: "DRAFT" as const
  };
}

describe("CourseBlueprintCommandService", () => {
  it("creates a stable exact digest and an append-only lifecycle", async () => {
    const { approved, registry, service } = await createApproved();
    expect(approved.version.status).toBe("APPROVED");
    await expect(
      service.assertBindable("tenant_001", approved.version.reference)
    ).resolves.toBeUndefined();
    await expect(
      registry.listLifecycleSnapshots("tenant_001", "course_blueprint_001", "1.0.0")
    ).resolves.toHaveLength(4);
  });

  it("rejects mutable same-version content, cross-tenant commands, and retired new binding", async () => {
    const { approved, service } = await createApproved();
    await expect(
      service.createDraft(actor, { ...draftInput, title: "Different content" })
    ).rejects.toThrow(new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VERSION_ALREADY_EXISTS"));
    await expect(
      service.createDraft({ ...actor, tenant_id: "tenant_other" }, draftInput)
    ).rejects.toThrow(new CourseBlueprintAuthorityError("TENANT_SCOPE_VIOLATION"));
    const retired = await service.retire(actor, approved.version.reference);
    await expect(service.assertBindable("tenant_001", retired.reference)).rejects.toThrow(
      new CourseBlueprintAuthorityError("RETIRED_FOR_NEW_BINDING")
    );
  });

  it("rejects an exact reference whose tenant does not match the requested tenant", async () => {
    const { approved, service } = await createApproved();
    await expect(
      service.assertBindable("tenant_001", {
        ...approved.version.reference,
        tenant_id: "tenant_other"
      })
    ).rejects.toThrow(new CourseBlueprintAuthorityError("TENANT_SCOPE_VIOLATION"));
  });

  it("rejects a blank approval id without appending an approved snapshot", async () => {
    const registry = new InMemoryJsonCourseBlueprintRegistry();
    const service = new CourseBlueprintCommandService(registry);
    const draft = await service.createDraft(actor, draftInput);
    const validated = await service.validate(actor, draft.reference);
    const frozen = await service.freeze(actor, validated.reference);

    await expect(service.approve(actor, frozen.reference, "   ")).rejects.toThrow(
      new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VALIDATION_FAILED")
    );
    await expect(
      registry.listLifecycleSnapshots("tenant_001", "course_blueprint_001", "1.0.0")
    ).resolves.toHaveLength(3);
    await expect(registry.listApprovalRecords("tenant_001", frozen.reference)).resolves.toEqual([]);
  });

  it("does not allow a draft to bypass validation and canonicalizes object-key order", async () => {
    const registry = new InMemoryJsonCourseBlueprintRegistry();
    const service = new CourseBlueprintCommandService(registry);
    const draft = await service.createDraft(actor, draftInput);
    await expect(service.approve(actor, draft.reference, "approval_invalid")).rejects.toThrow(
      new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_INVALID_TRANSITION")
    );
    expect(
      calculateCourseBlueprintContentDigest({
        ...draftInput,
        scenario_compatibility_constraints: { scenario_family: "wellness", region: "cn" }
      })
    ).toBe(
      calculateCourseBlueprintContentDigest({
        ...draftInput,
        scenario_compatibility_constraints: { region: "cn", scenario_family: "wellness" }
      })
    );
  });

  it("lists only current approved versions for the requesting tenant", async () => {
    const { approved, service } = await createApproved();
    expect(await service.listApprovedForTenant("tenant_001")).toEqual([approved.version]);
    expect(await service.listApprovedForTenant("tenant_other")).toEqual([]);
    await service.retire(actor, approved.version.reference);
    expect(await service.listApprovedForTenant("tenant_001")).toEqual([]);
  });

  it("fails closed when a persisted snapshot has a forged digest, approval mismatch, or illegal lifecycle order", async () => {
    const { approved } = await createApproved();
    const forged = { ...approved.version, content_digest: "f".repeat(64) };
    await expect(() => new InMemoryJsonCourseBlueprintRegistry({ snapshots: [forged] })).toThrow(
      new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VALIDATION_FAILED")
    );
    await expect(
      () => new InMemoryJsonCourseBlueprintRegistry({ snapshots: [approved.version] })
    ).toThrow(new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VALIDATION_FAILED"));
    const draft = { ...approved.version, status: "DRAFT" as const };
    const frozen = { ...approved.version, status: "FROZEN" as const };
    await expect(
      () => new InMemoryJsonCourseBlueprintRegistry({ snapshots: [draft, frozen] })
    ).toThrow(new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VALIDATION_FAILED"));
  });

  it("fails closed when persisted history contains two digests for the same version", async () => {
    const first = await createApproved();
    const secondRegistry = new InMemoryJsonCourseBlueprintRegistry();
    const secondService = new CourseBlueprintCommandService(secondRegistry);
    const secondDraft = await secondService.createDraft(actor, {
      ...draftInput,
      description: "Different immutable content."
    });
    const secondValidated = await secondService.validate(actor, secondDraft.reference);
    const secondFrozen = await secondService.freeze(actor, secondValidated.reference);
    await secondService.approve(actor, secondFrozen.reference, "approval_002");
    const approvals = [
      ...(await first.registry.listApprovalRecords("tenant_001", first.approved.version.reference)),
      ...(await secondRegistry.listApprovalRecords("tenant_001", secondDraft.reference))
    ];
    const snapshots = [
      ...(await first.registry.listLifecycleSnapshots(
        "tenant_001",
        "course_blueprint_001",
        "1.0.0"
      )),
      ...(await secondRegistry.listLifecycleSnapshots(
        "tenant_001",
        "course_blueprint_001",
        "1.0.0"
      ))
    ];

    await expect(
      () =>
        new InMemoryJsonCourseBlueprintRegistry({
          approvals,
          snapshots
        })
    ).toThrow(new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VALIDATION_FAILED"));
  });

  it.each([
    ["tenant_id", { ...draftInput, tenant_id: "" }],
    ["course_blueprint_id", { ...draftInput, course_blueprint_id: "" }],
    ["version", { ...draftInput, version: "" }]
  ] as const)("rejects a blank %s at the raw registry boundary", async (_field, input) => {
    const registry = new InMemoryJsonCourseBlueprintRegistry();

    await expect(registry.appendVersion(createRawDraft(input))).rejects.toThrow(
      new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VALIDATION_FAILED")
    );
    await expect(
      registry.listLifecycleSnapshots(input.tenant_id, input.course_blueprint_id, input.version)
    ).resolves.toEqual([]);
  });

  it("rejects duplicate tenant-scoped approval ids when persisted histories reload", async () => {
    const first = await createApproved();
    const secondRegistry = new InMemoryJsonCourseBlueprintRegistry();
    const secondService = new CourseBlueprintCommandService(secondRegistry);
    const secondDraft = await secondService.createDraft(actor, {
      ...draftInput,
      course_blueprint_id: "course_blueprint_002"
    });
    const secondValidated = await secondService.validate(actor, secondDraft.reference);
    const secondFrozen = await secondService.freeze(actor, secondValidated.reference);
    const secondApproved = await secondService.approve(
      actor,
      secondFrozen.reference,
      "approval_001"
    );
    const firstSnapshots = await first.registry.listLifecycleSnapshots(
      "tenant_001",
      first.approved.version.course_blueprint_id,
      first.approved.version.version
    );
    const secondSnapshots = await secondRegistry.listLifecycleSnapshots(
      "tenant_001",
      secondApproved.version.course_blueprint_id,
      secondApproved.version.version
    );

    await expect(
      () =>
        new InMemoryJsonCourseBlueprintRegistry({
          approvals: [first.approved.approval_record, secondApproved.approval_record],
          snapshots: [...firstSnapshots, ...secondSnapshots]
        })
    ).toThrow(new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VALIDATION_FAILED"));
  });

  it("rejects illegal lifecycle order at the registry write boundary", async () => {
    const { approved } = await createApproved();
    const registry = new InMemoryJsonCourseBlueprintRegistry();

    await expect(
      registry.appendVersion({
        ...approved.version,
        status: "FROZEN"
      })
    ).rejects.toThrow(new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_INVALID_TRANSITION"));
  });

  it("requires an exact matching approval record at the registry write boundary", async () => {
    const registry = new InMemoryJsonCourseBlueprintRegistry();
    const service = new CourseBlueprintCommandService(registry);
    const draft = await service.createDraft(actor, draftInput);
    const validated = await service.validate(actor, draft.reference);
    const frozen = await service.freeze(actor, validated.reference);
    const approved = { ...frozen, status: "APPROVED" as const };

    await expect(registry.appendVersion(approved)).rejects.toThrow(
      new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_INVALID_TRANSITION")
    );
    await expect(
      registry.appendApprovedVersion(approved, {
        approval_id: "approval_mismatch",
        approved_by: actor.actor_id,
        correlation_id: actor.correlation_id,
        course_blueprint_reference: {
          ...approved.reference,
          content_digest: "f".repeat(64)
        },
        tenant_id: actor.tenant_id
      })
    ).rejects.toThrow(new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VALIDATION_FAILED"));
    await expect(
      registry.listLifecycleSnapshots("tenant_001", "course_blueprint_001", "1.0.0")
    ).resolves.toHaveLength(3);
    await expect(registry.listApprovalRecords("tenant_001", approved.reference)).resolves.toEqual(
      []
    );
  });

  it("requires the executable schema version and non-blank objectives", async () => {
    const service = new CourseBlueprintCommandService(new InMemoryJsonCourseBlueprintRegistry());
    const wrongSchema = await service.createDraft(actor, {
      ...draftInput,
      course_blueprint_id: "course_blueprint_wrong_schema",
      schema_version: "future-schema"
    });
    await expect(service.validate(actor, wrongSchema.reference)).rejects.toThrow(
      new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VALIDATION_FAILED")
    );

    const blankObjective = await service.createDraft(actor, {
      ...draftInput,
      course_blueprint_id: "course_blueprint_blank_objective",
      objectives: [" "]
    });
    await expect(service.validate(actor, blankObjective.reference)).rejects.toThrow(
      new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VALIDATION_FAILED")
    );
  });

  it("derives only a globally monotonic version while serializing source retirement", async () => {
    const { approved, service } = await createApproved();
    await service.createDraft(actor, {
      ...draftInput,
      title: "Future draft",
      version: "2.0.0"
    });
    await expect(
      service.createDraftFromApprovedSource(actor, approved.version.reference, {
        ...draftInput,
        title: "Non-monotonic draft",
        version: "1.1.0"
      })
    ).rejects.toThrow(new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VERSION_ALREADY_EXISTS"));

    const isolated = await createApproved();
    const create = isolated.service.createDraftFromApprovedSource(
      actor,
      isolated.approved.version.reference,
      {
        ...draftInput,
        title: "Serialized derived draft",
        version: "1.1.0"
      }
    );
    const retire = isolated.service.retire(actor, isolated.approved.version.reference);
    await expect(create).resolves.toMatchObject({
      draft: { status: "DRAFT", version: "1.1.0" },
      source: { status: "APPROVED", version: "1.0.0" }
    });
    await expect(retire).resolves.toMatchObject({ status: "RETIRED" });
  });

  it("rolls back a failed post-append action before queued lifecycle commands can run", async () => {
    const { approved, registry, service } = await createApproved();
    let concurrentValidation: ReturnType<CourseBlueprintCommandService["validate"]> | undefined;
    await expect(
      service.createDraftFromApprovedSource(
        actor,
        approved.version.reference,
        {
          ...draftInput,
          title: "Compensated draft",
          version: "1.1.0"
        },
        async ({ draft }) => {
          concurrentValidation = service.validate(actor, draft.reference);
          throw new Error("injected draft audit failure");
        }
      )
    ).rejects.toThrow("injected draft audit failure");
    await expect(
      registry.listLifecycleSnapshots(actor.tenant_id, draftInput.course_blueprint_id, "1.1.0")
    ).resolves.toEqual([]);
    await expect(concurrentValidation!).rejects.toThrow(
      new CourseBlueprintAuthorityError("NOT_FOUND")
    );

    const recreated = await service.createDraftFromApprovedSource(
      actor,
      approved.version.reference,
      {
        ...draftInput,
        title: "Compensated validated draft",
        version: "1.1.0"
      }
    );
    let concurrentFreeze: ReturnType<CourseBlueprintCommandService["freeze"]> | undefined;
    await expect(
      service.validate(actor, recreated.draft.reference, async (validated) => {
        concurrentFreeze = service.freeze(actor, validated.reference);
        throw new Error("injected validation audit failure");
      })
    ).rejects.toThrow("injected validation audit failure");
    await expect(
      registry.listLifecycleSnapshots(
        actor.tenant_id,
        recreated.draft.course_blueprint_id,
        recreated.draft.version
      )
    ).resolves.toMatchObject([{ status: "DRAFT" }]);
    await expect(concurrentFreeze!).rejects.toThrow(
      new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_INVALID_TRANSITION")
    );
  });

  it("rolls back only its own snapshot when another Blueprint appends concurrently", async () => {
    const { approved, registry, service } = await createApproved();
    const otherDraft = await service.createDraft(actor, {
      ...draftInput,
      course_blueprint_id: "course_blueprint_other",
      title: "Other Blueprint",
      version: "1.0.0"
    });

    await expect(
      service.createDraftFromApprovedSource(
        actor,
        approved.version.reference,
        {
          ...draftInput,
          title: "Failed derived draft",
          version: "1.1.0"
        },
        async () => {
          await service.validate(actor, otherDraft.reference);
          throw new Error("injected cross-blueprint audit failure");
        }
      )
    ).rejects.toThrow("injected cross-blueprint audit failure");

    await expect(
      registry.listLifecycleSnapshots(
        actor.tenant_id,
        approved.version.course_blueprint_id,
        "1.1.0"
      )
    ).resolves.toEqual([]);
    await expect(
      registry.listLifecycleSnapshots(
        actor.tenant_id,
        otherDraft.course_blueprint_id,
        otherDraft.version
      )
    ).resolves.toMatchObject([{ status: "DRAFT" }, { status: "VALIDATED" }]);
  });
});
