import { describe, expect, it } from "vitest";
import {
  TeacherConfirmationCommandService,
  TeacherConfirmationError,
  type TeacherConfirmationCommandDependencies
} from "../../services/api/src/teacher-confirmation.js";
import { createJsonTeacherConfirmationRepositoryPort } from "../../services/api/src/json-repository-adapter.js";
import { createP1Store } from "../../services/api/src/store.js";
import type {
  AuditLog,
  TeacherConfirmationExactRef,
  TeacherConfirmationVersion
} from "@simwar/shared-contracts";

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

const exactRound = { round_id: "round_001", round_no: 1 } as const;

const exactInput = {
  ...input,
  context: { ...input.context, ...exactRound }
} as const;

function artifactContext(round: { round_id?: string; round_no?: number } = {}) {
  return {
    activity_id: "activity_001",
    course_id: "course_001",
    run_id: "run_001",
    team_id: "team_001",
    role_key: "marketing",
    ...round
  };
}

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

  it("preserves a genuine no-round teacher confirmation as legacy non-exact", async () => {
    const deps = dependencies();
    deps.evidence.getByReference = async () => ({
      artifact_ref: ref("evidence_artifact", "artifact_001"),
      context: artifactContext(exactRound),
      visibility: "teacher_only"
    });
    const service = new TeacherConfirmationCommandService(deps);

    const result = await service.saveDraft(
      { actor_id: "usr_teacher", tenant_id: "tenant_demo" },
      input,
      "req_legacy"
    );

    expect(result.data.status).toBe("generated");
    expect(result.data.confirmation.context).toEqual(input.context);
    expect(result.data.confirmation.context.round_id).toBeUndefined();
    expect(result.data.confirmation.context.round_no).toBeUndefined();
  });

  it("accepts a fully bound exact round artifact and preserves its exact context", async () => {
    const deps = dependencies();
    deps.evidence.getByReference = async () => ({
      artifact_ref: ref("evidence_artifact", "artifact_001"),
      context: artifactContext(exactRound),
      visibility: "teacher_only"
    });
    const service = new TeacherConfirmationCommandService(deps);

    const result = await service.saveDraft(
      { actor_id: "usr_teacher", tenant_id: "tenant_demo" },
      exactInput,
      "req_exact"
    );

    expect(result.data.status).toBe("generated");
    expect(result.data.confirmation.context).toEqual(exactInput.context);
    expect(result.data.confirmation.evidence_refs[0]).toEqual(input.evidence_refs[0]);
    expect(deps.records).toHaveLength(1);
  });

  it.each([
    ["round_id only", { round_id: exactRound.round_id }],
    ["round_no only", { round_no: exactRound.round_no }]
  ] as const)("rejects an exact request with a %s round pair", async (_label, requestedRound) => {
    const deps = dependencies();
    deps.evidence.getByReference = async () => ({
      artifact_ref: ref("evidence_artifact", "artifact_001"),
      context: artifactContext(exactRound),
      visibility: "teacher_only"
    });
    const service = new TeacherConfirmationCommandService(deps);

    await expect(
      service.saveDraft(
        { actor_id: "usr_teacher", tenant_id: "tenant_demo" },
        { ...input, context: { ...input.context, ...requestedRound } },
        "req_partial_round"
      )
    ).rejects.toMatchObject({ code: "D3_EVIDENCE_INVALID" });
    expect(deps.records).toHaveLength(0);
    expect(deps.audits).toHaveLength(0);
  });

  it("rejects an exact request when its evidence artifact is unbound", async () => {
    const deps = dependencies();
    deps.evidence.getByReference = async () => null;
    const service = new TeacherConfirmationCommandService(deps);

    await expect(
      service.saveDraft(
        { actor_id: "usr_teacher", tenant_id: "tenant_demo" },
        exactInput,
        "req_unbound_artifact"
      )
    ).rejects.toMatchObject({ code: "D3_EVIDENCE_INVALID" });
    expect(deps.records).toHaveLength(0);
    expect(deps.audits).toHaveLength(0);
  });

  it.each([
    ["missing round pair", {}],
    ["missing round_id", { round_no: exactRound.round_no }],
    ["missing round_no", { round_id: exactRound.round_id }],
    ["wrong round pair", { round_id: "round_002", round_no: 2 }],
    ["wrong round_id", { round_id: "round_002", round_no: exactRound.round_no }],
    ["wrong round_no", { round_id: exactRound.round_id, round_no: 2 }]
  ] as const)("rejects an exact request when the artifact is %s", async (_label, artifactRound) => {
    const deps = dependencies();
    deps.evidence.getByReference = async () => ({
      artifact_ref: ref("evidence_artifact", "artifact_001"),
      context: artifactContext(artifactRound),
      visibility: "teacher_only"
    });
    const service = new TeacherConfirmationCommandService(deps);

    await expect(
      service.saveDraft(
        { actor_id: "usr_teacher", tenant_id: "tenant_demo" },
        exactInput,
        "req_bad_artifact_round"
      )
    ).rejects.toMatchObject({ code: "D3_EVIDENCE_INVALID" });
    expect(deps.records).toHaveLength(0);
    expect(deps.audits).toHaveLength(0);
  });

  it.each([
    ["tenant_id", { tenant_id: "tenant_other" }],
    ["resource_type", { resource_type: "teacher_confirmation_version" }],
    ["resource_id", { resource_id: "artifact_other" }],
    ["version", { version: "2.0.0" }],
    ["content_digest", { content_digest: "b".repeat(64) }]
  ] as const)(
    "rejects an exact request when the artifact full ref has a %s mismatch",
    async (_label, mutation) => {
      const deps = dependencies();
      const mismatchedRef = {
        ...ref("evidence_artifact", "artifact_001"),
        ...mutation
      } as TeacherConfirmationExactRef;
      deps.evidence.getByReference = async () => ({
        artifact_ref: mismatchedRef,
        context: artifactContext(exactRound),
        visibility: "teacher_only"
      });
      const service = new TeacherConfirmationCommandService(deps);

      await expect(
        service.saveDraft(
          { actor_id: "usr_teacher", tenant_id: "tenant_demo" },
          exactInput,
          "req_bad_artifact_ref"
        )
      ).rejects.toMatchObject({ code: "D3_EVIDENCE_INVALID" });
      expect(deps.records).toHaveLength(0);
      expect(deps.audits).toHaveLength(0);
    }
  );

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

  it("rolls back confirmation and audit state when persistence fails", async () => {
    const store = createP1Store();
    store.persist = () => {
      throw new Error("audit_persist_failed");
    };
    const deps = dependencies();
    deps.repository = createJsonTeacherConfirmationRepositoryPort(store);
    const service = new TeacherConfirmationCommandService(deps);

    await expect(
      service.saveDraft({ actor_id: "usr_teacher", tenant_id: "tenant_demo" }, input, "req_001")
    ).rejects.toThrow("audit_persist_failed");
    expect(store.teacherConfirmationVersions).toHaveLength(0);
    expect(store.auditLogs).toHaveLength(0);
  });
});
