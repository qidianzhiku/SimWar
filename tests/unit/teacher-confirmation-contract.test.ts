import { describe, expect, it } from "vitest";
import {
  isTeacherConfirmationExactRef,
  isTeacherConfirmationVersion,
  type TeacherConfirmationVersion
} from "@simwar/shared-contracts";

const digest = "a".repeat(64);

const ref = (resource_type: TeacherConfirmationVersion["confirmation_ref"]["resource_type"], resource_id: string) => ({
  content_digest: digest,
  discriminator: "exact_ref" as const,
  resource_id,
  resource_type,
  tenant_id: "tenant_demo",
  version: "1.0.0"
});

const confirmation: TeacherConfirmationVersion = {
  audit_receipt: {
    action: "teacher_confirmation.draft_save",
    actor_id: "usr_teacher",
    audit_id: "audit_001",
    recorded_at: "2026-08-03T00:00:00.000Z",
    request_id: "req_001"
  },
  confirmation_ref: ref("teacher_confirmation_version", "confirmation_001"),
  content_digest: digest,
  context: { course_id: "course_001", role_key: "marketing", run_id: "run_001", team_id: "team_001" },
  course_package_ref: ref("course_package_version", "package_001"),
  created_at: "2026-08-03T00:00:00.000Z",
  created_by: "usr_teacher",
  criterion_decisions: [{ criterion_id: "criterion_001", level_ordinal: 2 }],
  discriminator: "teacher_confirmation_version",
  evidence_refs: [ref("evidence_artifact", "artifact_001")],
  idempotency_key: "idem_001",
  known_limits: ["Human validation is not performed."],
  learning_goal_ref: ref("learning_goal_version", "goal_001"),
  rubric_ref: ref("rubric_version", "rubric_001"),
  schema_version: "teacher-confirmation.v1",
  status: "DRAFT",
  teacher_feedback: "The teacher recorded a bounded confirmation."
};

describe("D3 Teacher Confirmation shared contract", () => {
  it("accepts a closed teacher confirmation version", () => {
    expect(isTeacherConfirmationVersion(confirmation)).toBe(true);
  });

  it("rejects reserved and cross-tenant exact refs", () => {
    expect(isTeacherConfirmationExactRef({ ...confirmation.course_package_ref, resource_id: "latest" })).toBe(false);
    expect(isTeacherConfirmationVersion({ ...confirmation, rubric_ref: { ...confirmation.rubric_ref, tenant_id: "tenant_other" } })).toBe(false);
  });

  it("rejects extra fields, unsafe feedback, and invalid criterion levels", () => {
    expect(isTeacherConfirmationVersion({ ...confirmation, extra: true })).toBe(false);
    expect(isTeacherConfirmationVersion({ ...confirmation, teacher_feedback: "<script>" })).toBe(false);
    expect(isTeacherConfirmationVersion({ ...confirmation, criterion_decisions: [{ criterion_id: "criterion_001", level_ordinal: 0 }] })).toBe(false);
  });
});
