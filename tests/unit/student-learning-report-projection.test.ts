import { describe, expect, it, vi } from "vitest";
import type {
  D2EvidenceArtifactVersion,
  D2ProvenanceEdge,
  TeacherConfirmationVersion
} from "@simwar/shared-contracts";
import type { EvidenceProvenanceRepositoryPort } from "../../services/api/src/repository-ports.js";
import { StudentLearningReportProjectionService } from "../../services/api/src/student-learning-report-projection.js";

const digest = "a".repeat(64);
const tenant = "tenant_d4";
const confirmationRef = {
  content_digest: digest,
  discriminator: "exact_ref" as const,
  resource_id: "confirmation_d4",
  resource_type: "teacher_confirmation_version" as const,
  tenant_id: tenant,
  version: "2.0.0"
};
const evidenceRef = {
  content_digest: digest,
  discriminator: "exact_ref" as const,
  resource_id: "artifact_d4",
  resource_type: "evidence_artifact" as const,
  tenant_id: tenant,
  version: "1.0.0"
};

function confirmation(
  overrides: Partial<TeacherConfirmationVersion> = {}
): TeacherConfirmationVersion {
  return {
    audit_receipt: {
      action: "teacher_confirmation.confirm",
      actor_id: "usr_teacher",
      audit_id: "audit_d4",
      recorded_at: "2026-08-03T00:00:00.000Z",
      request_id: "request_d4"
    },
    confirmation_ref: confirmationRef,
    content_digest: digest,
    context: { course_id: "course_d4", role_key: "CEO", run_id: "run_d4", team_id: "team_d4" },
    course_package_ref: {
      content_digest: digest,
      discriminator: "exact_ref",
      resource_id: "package_d4",
      resource_type: "course_package_version",
      tenant_id: tenant,
      version: "1.0.0"
    },
    created_at: "2026-08-03T00:00:00.000Z",
    created_by: "usr_teacher",
    criterion_decisions: [{ criterion_id: "criterion_d4", level_ordinal: 2 }],
    discriminator: "teacher_confirmation_version",
    evidence_refs: [evidenceRef],
    idempotency_key: "idem_d4",
    known_limits: ["D3 teacher-only"],
    learning_goal_ref: {
      content_digest: digest,
      discriminator: "exact_ref",
      resource_id: "goal_d4",
      resource_type: "learning_goal_version",
      tenant_id: tenant,
      version: "1.0.0"
    },
    rubric_ref: {
      content_digest: digest,
      discriminator: "exact_ref",
      resource_id: "rubric_d4",
      resource_type: "rubric_version",
      tenant_id: tenant,
      version: "1.0.0"
    },
    schema_version: "teacher-confirmation.v1",
    status: "CONFIRMED",
    teacher_feedback: "Private teacher feedback must not leak.",
    ...overrides
  };
}

const artifact: D2EvidenceArtifactVersion = {
  artifact_digest: digest,
  artifact_kind: "observation",
  artifact_ref: evidenceRef,
  captured_at: "2026-08-03T00:00:00.000Z",
  captured_by: "usr_teacher",
  context: {
    activity_id: "activity_d4",
    course_id: "course_d4",
    role_key: "CEO",
    run_id: "run_d4",
    team_id: "team_d4"
  },
  course_package_ref: {
    content_digest: digest,
    discriminator: "exact_ref",
    resource_id: "package_d4",
    resource_type: "course_package_version",
    tenant_id: tenant,
    version: "1.0.0"
  },
  discriminator: "d2_evidence_artifact_version",
  idempotency_key: "idem_artifact_d4",
  known_limits: ["teacher_only"],
  learning_goal_ref: {
    content_digest: digest,
    discriminator: "exact_ref",
    resource_id: "goal_d4",
    resource_type: "learning_goal_version",
    tenant_id: tenant,
    version: "1.0.0"
  },
  rubric_ref: {
    content_digest: digest,
    discriminator: "exact_ref",
    resource_id: "rubric_d4",
    resource_type: "rubric_version",
    tenant_id: tenant,
    version: "1.0.0"
  },
  schema_version: "evidence-provenance.v1",
  source_event_ref: {
    content_digest: digest,
    discriminator: "exact_ref",
    resource_id: "event_d4",
    resource_type: "role_workflow_event",
    tenant_id: tenant,
    version: "1.0.0"
  },
  transformation_rule_ref: {
    content_digest: digest,
    discriminator: "exact_ref",
    resource_id: "rule_d4",
    resource_type: "transformation_rule",
    tenant_id: tenant,
    version: "1.0.0"
  },
  visibility: "teacher_only"
};

describe("D4 StudentLearningReportProjectionService", () => {
  it("projects confirmed D3 evidence into a student-safe report without private feedback", async () => {
    const edge: D2ProvenanceEdge = {
      discriminator: "d2_provenance_edge",
      relation: "derived_from",
      source_ref: artifact.source_event_ref,
      target_ref: artifact.artifact_ref
    };
    const repository: EvidenceProvenanceRepositoryPort = {
      listEvidenceArtifacts: vi.fn(async () => [artifact]),
      listProvenanceEdges: vi.fn(async () => [edge]),
      appendEvidenceCapture: vi.fn()
    };
    const service = new StudentLearningReportProjectionService({
      confirmations: { list: vi.fn(async () => [confirmation()]) } as never,
      evidence: repository
    });

    const result = await service.listStudent({
      tenant_id: tenant,
      team_id: "team_d4",
      user_id: "usr_student"
    });
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0]?.status).toBe("CONFIRMED");
    expect(result.reports[0]?.learning_evidence.student_visible_feedback).toEqual([]);
    expect(result.reports[0]?.learning_evidence.provenance_chain).toHaveLength(1);
    expect("teacher_feedback" in (result.reports[0] as object)).toBe(false);
    expect("raw_evidence_payload" in (result.reports[0] as object)).toBe(false);
    expect(result.reports[0]?.business_outcome.summary).not.toMatch(/score|rank|state_true/i);
  });

  it("filters reports to the learner team and marks later confirmed versions amended", async () => {
    const later = confirmation({
      confirmation_ref: { ...confirmationRef, version: "4.0.0" },
      created_at: "2026-08-03T01:00:00.000Z",
      content_digest: "b".repeat(64)
    });
    const otherTeam = confirmation({
      confirmation_ref: { ...confirmationRef, resource_id: "confirmation_other" },
      context: { course_id: "course_d4", role_key: "CEO", run_id: "run_d4", team_id: "team_other" }
    });
    const service = new StudentLearningReportProjectionService({
      confirmations: { list: vi.fn(async () => [confirmation(), later, otherTeam]) } as never,
      evidence: {
        listEvidenceArtifacts: vi.fn(async () => [artifact]),
        listProvenanceEdges: vi.fn(async () => []),
        appendEvidenceCapture: vi.fn()
      }
    });
    const result = await service.listStudent({
      tenant_id: tenant,
      team_id: "team_d4",
      user_id: "usr_student"
    });
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0]?.status).toBe("AMENDED");
    await expect(
      service.listStudent({ tenant_id: tenant, user_id: "usr_student" })
    ).rejects.toMatchObject({
      code: "D4_REPORT_SCOPE_VIOLATION"
    });
  });
});
