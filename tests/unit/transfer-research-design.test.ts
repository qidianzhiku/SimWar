import { describe, expect, it } from "vitest";
import { InMemoryTransferResearchDesignRegistry } from "../../services/api/src/transfer-research-design-registry.js";
import { TransferResearchDesignCommandService } from "../../services/api/src/transfer-research-design.js";

const tenantId = "tenant_demo";
const exact = (resource_id: string, resource_type: string, content_digest: string) => ({
  content_digest,
  discriminator: "exact_ref" as const,
  resource_id,
  resource_type,
  tenant_id: tenantId,
  version: "1.0.0"
});
const input = () => ({
  analysis_plan_ref: exact("plan_d6", "transfer_analysis_plan_version", "1".repeat(64)),
  course_package_ref: exact("package_d6", "course_package_version", "2".repeat(64)),
  d4_source_ref: exact("report_d4", "student_learning_report", "3".repeat(64)),
  d5_source_ref: exact("bundle_d5", "learning_export_bundle_version", "4".repeat(64)),
  instrument: {
    items: [
      { item_id: "item_1", prompt: "Describe the opportunity", response_type: "TEXT" as const }
    ],
    source_type: "LEARNER_SELF_REPORT" as const
  },
  context_factors: ["OPPORTUNITY_TO_PERFORM", "MANAGER_SUPPORT"],
  learning_goal_ref: exact("goal_d6", "learning_goal_version", "5".repeat(64)),
  observation_windows: [
    { code: "W0_BASELINE" as const, offset_days: 0, tolerance_days: 7 },
    { code: "W2_30D" as const, offset_days: 30, tolerance_days: 7 }
  ],
  outcome_measures: [
    {
      code: "APPLICATION_STATE",
      allowed_states: ["NOT_ASSESSED", "ATTEMPTED_APPLICATION", "OBSERVED_APPLICATION"] as const,
      missing_is_not_negative: true as const,
      role: "PRIMARY" as const
    }
  ],
  provenance_source_policy: {
    allowed_source_types: ["LEARNER_SELF_REPORT", "SUPERVISOR_OBSERVATION"] as const,
    minimum_source_types: 2,
    required_provenance_complete: true as const,
    small_cohort_minimum: 5,
    retention_days: 90,
    deletion_mode: "DELETE_ON_EXPIRY" as const
  },
  research_questions: [
    { question_id: "q_transfer_1", prompt: "What transfer opportunity was available?" }
  ],
  rubric_ref: exact("rubric_d6", "rubric_version", "6".repeat(64)),
  scope: {
    activity_id: "activity_d6",
    course_id: "package_d6",
    role_key: "CEO",
    run_id: "run_d6",
    team_id: "team_d6"
  },
  title: "D6 synthetic transfer design"
});

describe("D6 TransferResearchDesignCommandService", () => {
  it("previews and freezes immutable synthetic-only research design", async () => {
    const service = new TransferResearchDesignCommandService(
      new InMemoryTransferResearchDesignRegistry(),
      () => "2026-08-04T00:00:00.000Z"
    );
    const preview = await service.preview(tenantId, input());
    expect(preview.study.lifecycle).toBe("READY_WITH_LIMITS");
    expect(preview.synthetic_preview.runtime_status).toBe("SYNTHETIC_ONLY");
    expect(preview.synthetic_preview.formal_transfer_claim_write).toBe(false);
    const frozen = await service.freeze({ actor_id: "usr_teacher", tenant_id: tenantId }, input());
    expect(frozen.status).toBe("created");
    expect(frozen.bundle.study.lifecycle).toBe("FROZEN");
    expect((await service.list(tenantId)).studies).toHaveLength(1);
    expect(
      (
        await service.syntheticPreview(
          { actor_id: "usr_teacher", tenant_id: tenantId },
          frozen.bundle.study.study_ref.resource_id
        )
      ).study_ref
    ).toEqual(frozen.bundle.study.study_ref);
    const revised = await service.revise(
      { actor_id: "usr_teacher", tenant_id: tenantId },
      frozen.bundle.study.study_ref.resource_id,
      { ...input(), title: "D6 revised transfer design" }
    );
    expect(revised.bundle.study.supersedes_ref).toEqual(frozen.bundle.study.study_ref);
    expect((await service.list(tenantId)).studies).toHaveLength(2);
    const retired = await service.retire(
      { actor_id: "usr_teacher", tenant_id: tenantId },
      revised.bundle.study.study_ref.resource_id
    );
    expect(retired.lifecycle).toBe("RETIRED");
    expect(await new InMemoryTransferResearchDesignRegistry().listAudit(tenantId)).toEqual([]);
  });

  it("rejects cross-tenant references and never creates a second version for the same digest", async () => {
    const registry = new InMemoryTransferResearchDesignRegistry();
    const service = new TransferResearchDesignCommandService(
      registry,
      () => "2026-08-04T00:00:00.000Z"
    );
    await service.freeze({ actor_id: "usr_teacher", tenant_id: tenantId }, input());
    const reused = await service.freeze({ actor_id: "usr_teacher", tenant_id: tenantId }, input());
    expect(reused.status).toBe("reused");
    const wrong = input();
    wrong.rubric_ref.tenant_id = "tenant_other";
    await expect(service.preview(tenantId, wrong)).rejects.toMatchObject({
      code: "D6_TENANT_SCOPE_VIOLATION"
    });
  });

  it("records one audit entry per created or lifecycle-changing command", async () => {
    const registry = new InMemoryTransferResearchDesignRegistry();
    const service = new TransferResearchDesignCommandService(
      registry,
      () => "2026-08-04T00:00:00.000Z"
    );
    const actor = { actor_id: "usr_teacher", tenant_id: tenantId };
    const frozen = await service.freeze(actor, input());
    await service.freeze(actor, input());
    await service.revise(actor, frozen.bundle.study.study_ref.resource_id, {
      ...input(),
      title: "Audit revision"
    });
    await service.retire(actor, frozen.bundle.study.study_ref.resource_id);
    expect((await registry.listAudit(tenantId)).map((entry) => entry.action)).toEqual([
      "D6_RESEARCH_DESIGN_FROZEN",
      "D6_RESEARCH_DESIGN_REVISED",
      "D6_RESEARCH_DESIGN_RETIRED"
    ]);
  });
});
