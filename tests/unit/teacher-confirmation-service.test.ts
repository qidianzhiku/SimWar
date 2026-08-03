import { describe, expect, it } from "vitest";
import {
  TeacherConfirmationCommandService,
  TeacherConfirmationError,
  type TeacherConfirmationCommandDependencies
} from "../../services/api/src/teacher-confirmation.js";
import type { AuditLog, TeacherConfirmationVersion } from "@simwar/shared-contracts";

const digest = "a".repeat(64);
const ref = (
  resource_type:
    | "course_package_version"
    | "learning_goal_version"
    | "rubric_version"
    | "evidence_artifact",
  resource_id: string
) => ({
  content_digest: digest,
  discriminator: "exact_ref" as const,
  resource_id,
  resource_type,
  tenant_id: "tenant_demo",
  version: "1.0.0"
});

function dependencies(): TeacherConfirmationCommandDependencies & {
  records: TeacherConfirmationVersion[];
  audits: AuditLog[];
} {
  const records: TeacherConfirmationVersion[] = [];
  const audits: AuditLog[] = [];
  return {
    records,
    audits,
    coursePackages: {
      getByReference: async () => ({ status: "AVAILABLE", content_digest: digest })
    },
    learningDesign: {
      getGoal: async () => ({
        status: "PUBLISHED",
        content_digest: digest,
        course_package_reference: { course_package_id: "package_001" }
      }),
      getRubric: async () => ({
        status: "PUBLISHED",
        content_digest: digest,
        course_package_reference: { course_package_id: "package_001" },
        criteria: [{ criterion_id: "criterion_001", levels: [{ ordinal: 1 }, { ordinal: 2 }] }]
      })
    },
    evidence: {
      getByReference: async () => ({
        artifact_ref: ref("evidence_artifact", "artifact_001"),
        context: {
          course_id: "course_001",
          run_id: "run_001",
          team_id: "team_001",
          role_key: "marketing",
          activity_id: "activity_001"
        },
        visibility: "teacher_only"
      })
    },
    claims: { assertActive: () => undefined },
    repository: {
      list: async () => records,
      append: async ({ confirmation, audit_log }) => {
        records.push(confirmation);
        audits.push(audit_log);
      }
    },
    now: () => "2026-08-03T00:00:00.000Z",
    createId: (kind: string) => `${kind}_001`
  };
}

const input = {
  claim_id: "claim_001",
  confirmation_id: "confirmation_001",
  course_package_ref: ref("course_package_version", "package_001"),
  learning_goal_ref: ref("learning_goal_version", "goal_001"),
  rubric_ref: ref("rubric_version", "rubric_001"),
  evidence_refs: [ref("evidence_artifact", "artifact_001")],
  context: {
    course_id: "course_001",
    run_id: "run_001",
    team_id: "team_001",
    role_key: "marketing"
  },
  criterion_decisions: [{ criterion_id: "criterion_001", level_ordinal: 2 }],
  teacher_feedback: "The evidence is bounded and reviewable.",
  idempotency_key: "idem_001"
} as const;

describe("TeacherConfirmationCommandService", () => {
  it("creates an immutable draft and confirms it as a new version", async () => {
    const deps = dependencies();
    const service = new TeacherConfirmationCommandService(deps);
    const draft = await service.saveDraft(
      { actor_id: "usr_teacher", tenant_id: "tenant_demo" },
      input,
      "req_001"
    );
    const confirmed = await service.confirm(
      { actor_id: "usr_teacher", tenant_id: "tenant_demo" },
      "confirmation_001",
      "claim_001",
      "req_002"
    );
    expect(draft.data.status).toBe("generated");
    expect(confirmed.data.confirmation.status).toBe("CONFIRMED");
    expect(deps.records).toHaveLength(2);
    expect(deps.records[0].content_digest).not.toBe(deps.records[1].content_digest);
  });

  it("appends a bounded rejection and revises it into a new draft", async () => {
    const deps = dependencies();
    const service = new TeacherConfirmationCommandService(deps);
    await service.saveDraft(
      { actor_id: "usr_teacher", tenant_id: "tenant_demo" },
      input,
      "req_001"
    );
    const rejected = await service.reject(
      { actor_id: "usr_teacher", tenant_id: "tenant_demo" },
      "confirmation_001",
      "claim_001",
      { claim_id: "claim_001", rejection_reason: "Evidence needs a clearer role-scoped source." },
      "req_002"
    );
    const revised = await service.revise(
      { actor_id: "usr_teacher", tenant_id: "tenant_demo" },
      "confirmation_001",
      { ...input, teacher_feedback: "Updated bounded feedback." },
      "req_003"
    );
    expect(rejected.data.confirmation.status).toBe("REJECTED");
    expect(rejected.data.confirmation.rejection_reason).toContain("clearer");
    expect(revised.data.confirmation.status).toBe("DRAFT");
    expect(revised.data.confirmation.confirmation_ref.version).toBe("3.0.0");
    expect(revised.data.confirmation.supersedes_ref?.version).toBe("2.0.0");
    expect(deps.records.map((record) => record.status)).toEqual(["DRAFT", "REJECTED", "DRAFT"]);
  });

  it("rejects an empty or unsafe rejection reason without appending", async () => {
    const deps = dependencies();
    const service = new TeacherConfirmationCommandService(deps);
    await service.saveDraft(
      { actor_id: "usr_teacher", tenant_id: "tenant_demo" },
      input,
      "req_001"
    );
    await expect(
      service.reject(
        { actor_id: "usr_teacher", tenant_id: "tenant_demo" },
        "confirmation_001",
        "claim_001",
        { claim_id: "claim_001", rejection_reason: "<private>" },
        "req_002"
      )
    ).rejects.toMatchObject({ code: "D3_INPUT_INVALID" });
    expect(deps.records).toHaveLength(1);
  });

  it("reuses an identical command and rejects a conflicting identity", async () => {
    const deps = dependencies();
    const service = new TeacherConfirmationCommandService(deps);
    const first = await service.saveDraft(
      { actor_id: "usr_teacher", tenant_id: "tenant_demo" },
      input,
      "req_001"
    );
    const second = await service.saveDraft(
      { actor_id: "usr_teacher", tenant_id: "tenant_demo" },
      input,
      "req_002"
    );
    expect(second.data.status).toBe("reused");
    expect(deps.records).toHaveLength(1);
    await expect(
      service.saveDraft(
        { actor_id: "usr_teacher", tenant_id: "tenant_demo" },
        { ...input, teacher_feedback: "changed" },
        "req_003"
      )
    ).rejects.toMatchObject({ code: "D3_DUPLICATE_CONFLICT" });
    expect(first.data.confirmation.confirmation_ref.resource_type).toBe(
      "teacher_confirmation_version"
    );
  });

  it("fails closed for cross-context evidence and never writes a business result", async () => {
    const deps = dependencies();
    deps.evidence.getByReference = async () => ({
      artifact_ref: ref("evidence_artifact", "artifact_001"),
      context: {
        course_id: "course_other",
        run_id: "run_001",
        team_id: "team_001",
        role_key: "marketing",
        activity_id: "activity_001"
      },
      visibility: "teacher_only"
    });
    const service = new TeacherConfirmationCommandService(deps);
    await expect(
      service.saveDraft({ actor_id: "usr_teacher", tenant_id: "tenant_demo" }, input, "req_001")
    ).rejects.toBeInstanceOf(TeacherConfirmationError);
    expect(deps.records).toHaveLength(0);
    expect(deps.audits).toHaveLength(0);
  });

  it("requires the active work claim before any confirmation write", async () => {
    const deps = dependencies();
    deps.claims.assertActive = () => {
      throw new Error("D3_WORK_CLAIM_CONFLICT");
    };
    const service = new TeacherConfirmationCommandService(deps);
    await expect(
      service.saveDraft({ actor_id: "usr_teacher", tenant_id: "tenant_demo" }, input, "req_001")
    ).rejects.toThrow("D3_WORK_CLAIM_CONFLICT");
    expect(deps.records).toHaveLength(0);
    expect(deps.audits).toHaveLength(0);
  });
});
