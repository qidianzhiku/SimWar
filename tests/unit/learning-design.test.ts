import { describe, expect, it } from "vitest";
import {
  LearningDesignCommandError,
  LearningDesignCommandService,
  LearningDesignJsonRegistry
} from "../../services/api/src/learning-design.js";

const digest = "a".repeat(64);
const packageReference = {
  content_digest: digest,
  course_package_id: "course_package_demo",
  tenant_id: "tenant_demo",
  version: "1.0.0"
};

function createService() {
  const registry = new LearningDesignJsonRegistry({ now: () => "2026-08-03T00:00:00.000Z" });
  const coursePackages = {
    getByReference: async () => ({ status: "AVAILABLE" as const })
  };
  return new LearningDesignCommandService(registry, coursePackages);
}

function goalDraft(version = "1.0.0") {
  return {
    activity_refs: [{ activity_id: "activity_observe_v1", content_digest: digest, version }],
    course_package_reference: packageReference,
    expected_evidence_classes: ["reflection"],
    goal_id: "goal_measure_market",
    observable_behaviors: ["compare observed demand with a stated hypothesis"],
    role_scope: ["teacher"],
    statement: "Compare observed demand with a stated hypothesis.",
    title: "Market observation",
    version
  };
}

describe("D1 learning design sole writer", () => {
  it("runs goal draft -> validate -> publish and keeps published versions immutable", async () => {
    const service = createService();
    const actor = { actor_id: "user_teacher", tenant_id: "tenant_demo" };
    const draft = await service.createGoalDraft(actor, goalDraft());
    const validated = await service.validateGoal(actor, {
      content_digest: draft.content_digest,
      goal_id: draft.goal_id,
      tenant_id: draft.tenant_id,
      version: draft.version
    });
    const published = await service.publishGoal(actor, {
      content_digest: validated.content_digest,
      goal_id: validated.goal_id,
      tenant_id: validated.tenant_id,
      version: validated.version
    });
    expect(published.status).toBe("PUBLISHED");
    const revision = await service.reviseGoal(actor, {
      source_reference: {
        content_digest: published.content_digest,
        goal_id: published.goal_id,
        tenant_id: published.tenant_id,
        version: published.version
      },
      version: "2.0.0"
    });
    expect(revision.status).toBe("DRAFT");
    expect(revision.supersedes_ref?.version).toBe("1.0.0");
    await expect(
      service.validateGoal(actor, {
        content_digest: published.content_digest,
        goal_id: published.goal_id,
        tenant_id: published.tenant_id,
        version: published.version
      })
    ).rejects.toMatchObject({ code: "LEARNING_DESIGN_INVALID_TRANSITION" });
  });

  it("rejects cross-tenant writes and latest references", async () => {
    const service = createService();
    await expect(
      service.createGoalDraft({ actor_id: "user_teacher", tenant_id: "tenant_other" }, goalDraft())
    ).rejects.toMatchObject({ code: "LEARNING_DESIGN_TENANT_SCOPE_VIOLATION" });
    await expect(
      service.validateGoal(
        { actor_id: "user_teacher", tenant_id: "tenant_demo" },
        {
          content_digest: digest,
          goal_id: "goal_measure_market",
          tenant_id: "tenant_demo",
          version: "latest"
        }
      )
    ).rejects.toBeInstanceOf(LearningDesignCommandError);
  });

  it("requires published exact goals before publishing a rubric and excludes score semantics", async () => {
    const service = createService();
    const actor = { actor_id: "user_teacher", tenant_id: "tenant_demo" };
    const rubric = await service.createRubricDraft(actor, {
      course_package_reference: packageReference,
      criteria: [
        {
          criterion_id: "criterion_reasoning",
          levels: [{ description: "evidence", label: "developing", ordinal: 1 }],
          prompt: "How clear?"
        }
      ],
      learning_goal_references: [
        {
          content_digest: digest,
          goal_id: "goal_missing",
          tenant_id: "tenant_demo",
          version: "1.0.0"
        }
      ],
      rubric_id: "rubric_market_reasoning",
      title: "Market reasoning",
      version: "1.0.0"
    });
    await service.validateRubric(actor, {
      content_digest: rubric.content_digest,
      rubric_id: rubric.rubric_id,
      tenant_id: rubric.tenant_id,
      version: rubric.version
    });
    await expect(
      service.publishRubric(actor, {
        content_digest: rubric.content_digest,
        rubric_id: rubric.rubric_id,
        tenant_id: rubric.tenant_id,
        version: rubric.version
      })
    ).rejects.toMatchObject({ code: "LEARNING_DESIGN_DEPENDENCY_NOT_PUBLISHED" });
  });

  it("runs the rubric lifecycle after its exact goal dependency is published", async () => {
    const service = createService();
    const actor = { actor_id: "user_teacher", tenant_id: "tenant_demo" };
    const goal = await service.createGoalDraft(actor, goalDraft());
    await service.validateGoal(actor, {
      content_digest: goal.content_digest,
      goal_id: goal.goal_id,
      tenant_id: goal.tenant_id,
      version: goal.version
    });
    const publishedGoal = await service.publishGoal(actor, {
      content_digest: goal.content_digest,
      goal_id: goal.goal_id,
      tenant_id: goal.tenant_id,
      version: goal.version
    });
    const rubric = await service.createRubricDraft(actor, {
      course_package_reference: packageReference,
      criteria: [
        {
          criterion_id: "criterion_reasoning",
          levels: [{ description: "evidence", label: "developing", ordinal: 1 }],
          prompt: "How clear?"
        }
      ],
      learning_goal_references: [
        {
          content_digest: publishedGoal.content_digest,
          goal_id: publishedGoal.goal_id,
          tenant_id: publishedGoal.tenant_id,
          version: publishedGoal.version
        }
      ],
      rubric_id: "rubric_market_reasoning",
      title: "Market reasoning",
      version: "1.0.0"
    });
    const validated = await service.validateRubric(actor, {
      content_digest: rubric.content_digest,
      rubric_id: rubric.rubric_id,
      tenant_id: rubric.tenant_id,
      version: rubric.version
    });
    const published = await service.publishRubric(actor, {
      content_digest: validated.content_digest,
      rubric_id: validated.rubric_id,
      tenant_id: validated.tenant_id,
      version: validated.version
    });
    expect(published.status).toBe("PUBLISHED");
    expect(published.scoring_policy).toBe("NOT_ACTIVE_D1");
  });
});
