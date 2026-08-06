import { describe, expect, it, vi } from "vitest";
import { TeachingClosureQueryService } from "../../services/api/src/teaching-closure-query.js";

const context = {
  activity_id: "activity_001",
  course_id: "course_001",
  role_key: "marketing",
  run_id: "run_001",
  team_id: "team_001"
} as const;

function service() {
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
        confirmations: [],
        known_limits: ["limit"],
        runtime_authority: "JSON_INTERNAL_ONLY"
      }))
    } as never,
    studentReports: {
      listPreview: vi.fn(async () => ({
        known_limits: ["limit"],
        reports: [],
        report_schema_version: "student-learning-report.v1",
        runtime_authority: "JSON_INTERNAL_ONLY",
        scope: "tenant_preview"
      }))
    } as never,
    claims: { findByContext: vi.fn(() => undefined) } as never
  });
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
});
