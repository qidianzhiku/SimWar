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

describe("CourseBlueprintCommandService", () => {
  it("creates a stable exact digest and an append-only lifecycle", async () => {
    const { approved, registry, service } = await createApproved();
    expect(approved.version.status).toBe("APPROVED");
    await expect(service.assertBindable("tenant_001", approved.version.reference)).resolves.toBeUndefined();
    await expect(registry.listLifecycleSnapshots("tenant_001", "course_blueprint_001", "1.0.0")).resolves.toHaveLength(4);
  });

  it("rejects mutable same-version content, cross-tenant commands, and retired new binding", async () => {
    const { approved, service } = await createApproved();
    await expect(service.createDraft(actor, { ...draftInput, title: "Different content" })).rejects.toThrow(
      new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VERSION_ALREADY_EXISTS")
    );
    await expect(service.createDraft({ ...actor, tenant_id: "tenant_other" }, draftInput)).rejects.toThrow(
      new CourseBlueprintAuthorityError("TENANT_SCOPE_VIOLATION")
    );
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
    await expect(
      registry.listApprovalRecords("tenant_001", frozen.reference)
    ).resolves.toEqual([]);
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
    await expect(() => new InMemoryJsonCourseBlueprintRegistry({ snapshots: [approved.version] })).toThrow(
      new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VALIDATION_FAILED")
    );
    const draft = { ...approved.version, status: "DRAFT" as const };
    const frozen = { ...approved.version, status: "FROZEN" as const };
    await expect(() => new InMemoryJsonCourseBlueprintRegistry({ snapshots: [draft, frozen] })).toThrow(
      new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VALIDATION_FAILED")
    );
  });
});
