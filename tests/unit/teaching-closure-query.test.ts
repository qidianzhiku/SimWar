import { describe, expect, it, vi } from "vitest";
import type {
  StudentLearningReport,
  StudentLearningReportExactRef,
  TeacherConfirmationExactRef,
  TeacherConfirmationVersion
} from "@simwar/shared-contracts";
import { TeachingClosureQueryService } from "../../services/api/src/teaching-closure-query.js";

const context = {
  activity_id: "activity_001",
  course_id: "course_001",
  role_key: "marketing",
  run_id: "run_001",
  team_id: "team_001"
} as const;

const actor = { actor_id: "teacher_001", tenant_id: "tenant_001" } as const;
const digest = "a".repeat(64);

function teacherRef(
  resource_type: TeacherConfirmationExactRef["resource_type"],
  resource_id: string,
  tenant_id = "tenant_001",
  version = "1.0.0"
): TeacherConfirmationExactRef {
  return {
    content_digest: digest,
    discriminator: "exact_ref",
    resource_id,
    resource_type,
    tenant_id,
    version
  };
}

function reportRef(
  resource_type: StudentLearningReportExactRef["resource_type"],
  resource_id: string,
  tenant_id = "tenant_001",
  version = "1.0.0"
): StudentLearningReportExactRef {
  return {
    content_digest: digest,
    discriminator: "exact_ref",
    resource_id,
    resource_type,
    tenant_id,
    version
  };
}

function confirmation(
  confirmationId: string,
  round: { readonly round_id: string; readonly round_no: number },
  version: string,
  created_at: string
): TeacherConfirmationVersion {
  return {
    audit_receipt: {
      action: "teacher_confirmation.confirm",
      actor_id: actor.actor_id,
      audit_id: `audit_${confirmationId}`,
      recorded_at: created_at,
      request_id: `request_${confirmationId}`
    },
    confirmation_ref: teacherRef(
      "teacher_confirmation_version",
      confirmationId,
      "tenant_001",
      version
    ),
    content_digest: digest,
    context: { ...context, ...round },
    course_package_ref: teacherRef("course_package_version", "package_001"),
    created_at,
    created_by: actor.actor_id,
    criterion_decisions: [{ criterion_id: "criterion_001", level_ordinal: 2 }],
    discriminator: "teacher_confirmation_version",
    evidence_refs: [teacherRef("evidence_artifact", `artifact_${confirmationId}`)],
    idempotency_key: `idem_${confirmationId}`,
    known_limits: ["D3 teacher-only"],
    learning_goal_ref: teacherRef("learning_goal_version", "goal_001"),
    rubric_ref: teacherRef("rubric_version", "rubric_001"),
    schema_version: "teacher-confirmation.v1",
    status: "CONFIRMED",
    teacher_feedback: "The evidence is bounded and reviewable."
  };
}

function report(source: TeacherConfirmationVersion, reportId: string): StudentLearningReport {
  const confirmationRef = reportRef(
    "teacher_confirmation_version",
    source.confirmation_ref.resource_id,
    source.confirmation_ref.tenant_id,
    source.confirmation_ref.version
  );
  return {
    business_outcome: {
      status: "SEPARATE_SAFE_OUTCOME",
      summary: "Published business outcome remains in its separate safe result surface."
    },
    context: source.context,
    course_package_ref: reportRef("course_package_version", "package_001"),
    generated_at: source.created_at,
    evidence_refs: [
      reportRef("evidence_artifact", `artifact_${source.confirmation_ref.resource_id}`)
    ],
    known_limits: ["D4 student-safe"],
    learning_goal_ref: reportRef("learning_goal_version", "goal_001"),
    learning_evidence: {
      criterion_results: [{ criterion_id: "criterion_001", level_ordinal: 2 }],
      provenance_chain: [],
      student_visible_feedback: []
    },
    report_digest: digest,
    report_ref: reportRef("student_learning_report", reportId),
    rubric_ref: reportRef("rubric_version", "rubric_001"),
    runtime_authority: "JSON_INTERNAL_ONLY",
    schema_version: "student-learning-report.v1",
    status: "CONFIRMED",
    source_confirmation_digest: source.content_digest,
    student_scope: {
      team_id: source.context.team_id,
      tenant_id: source.confirmation_ref.tenant_id,
      user_id: actor.actor_id
    },
    teacher_confirmation_ref: confirmationRef,
    visibility: "student_safe"
  };
}

const confirmationA = confirmation(
  "confirmation_round_1",
  { round_id: "round_001", round_no: 1 },
  "1.0.0",
  "2026-08-03T00:00:00.000Z"
);
const confirmationB = confirmation(
  "confirmation_round_2",
  { round_id: "round_002", round_no: 2 },
  "9.0.0",
  "2026-08-03T01:00:00.000Z"
);
const reportA = report(confirmationA, "report_round_1");
const reportB = report(confirmationB, "report_round_2");

function service(
  confirmations: readonly TeacherConfirmationVersion[] = [],
  reports: readonly StudentLearningReport[] = []
) {
  return new TeachingClosureQueryService({
    courseReports: { query: vi.fn(async () => ({ rows: [] })) } as never,
    evidence: {
      listTeacherEvidence: vi.fn(async () => ({
        artifacts: [],
        eligible_events: [],
        known_limits: ["limit"],
        provenance_edges: [],
        runtime_authority: "JSON_INTERNAL_ONLY"
      }))
    } as never,
    confirmations: {
      listTeacher: vi.fn(async () => ({
        confirmations,
        known_limits: ["limit"],
        runtime_authority: "JSON_INTERNAL_ONLY"
      }))
    } as never,
    studentReports: {
      listPreview: vi.fn(async () => ({
        known_limits: ["limit"],
        reports,
        report_schema_version: "student-learning-report.v1",
        runtime_authority: "JSON_INTERNAL_ONLY",
        scope: "tenant_preview"
      }))
    } as never,
    claims: { findByContext: vi.fn(() => undefined) } as never
  });
}

function exactService(confirmations: readonly TeacherConfirmationVersion[]) {
  return service(confirmations, [reportB, reportA]);
}

describe("W019 teaching closure query", () => {
  it("returns a context-bound pending queue without creating a writer", async () => {
    const result = await service().get(
      { actor_id: "teacher_001", tenant_id: "tenant_001" },
      context
    );
    expect(result.context).toEqual(context);
    expect(result.queue_item.missing).toEqual([
      "eligible_event",
      "evidence_artifact",
      "confirmation"
    ]);
    expect(result.student_safe_preview.status).toBe("UNAVAILABLE");
    expect(result.runtime_authority).toBe("JSON_INTERNAL_ONLY");
  });

  it("rejects an inexact context before calling any projection", async () => {
    const dependencies = service();
    await expect(
      dependencies.get(
        { actor_id: "teacher_001", tenant_id: "tenant_001" },
        { ...context, course_id: "latest" }
      )
    ).rejects.toMatchObject({ code: "W019_CONTEXT_INVALID" });
  });

  it("selects round-one confirmation A when newer confirmation B belongs to round two", async () => {
    const result = await exactService([confirmationA, confirmationB]).getExact(actor, {
      ...context,
      round_id: "round_001",
      round_no: 1
    });
    expect(result.queue_item.confirmation_status).toBe("CONFIRMED");
    expect(result.student_safe_preview.status).toBe("CONFIRMED");
    expect(result.context).toEqual(context);
  });

  it.each([
    ["round_id", { round_id: "round_other", round_no: 1 }],
    ["round_no", { round_id: "round_001", round_no: 2 }],
    ["team_id", { round_id: "round_001", round_no: 1, team_id: "team_other" }],
    ["run_id", { round_id: "round_001", round_no: 1, run_id: "run_other" }]
  ] as const)("returns no source data when exact %s does not match", async (_field, override) => {
    const result = await exactService([confirmationA, confirmationB]).getExact(actor, {
      ...context,
      ...override
    });
    expect(result.queue_item.confirmation_status).toBe("MISSING");
    expect(result.student_safe_preview.status).toBe("UNAVAILABLE");
  });

  it("returns no source data when the actor tenant does not own the exact records", async () => {
    const result = await exactService([confirmationA, confirmationB]).getExact(
      { ...actor, tenant_id: "tenant_other" },
      {
        ...context,
        round_id: "round_001",
        round_no: 1
      }
    );
    expect(result.queue_item.confirmation_status).toBe("MISSING");
    expect(result.student_safe_preview.status).toBe("UNAVAILABLE");
  });
});
