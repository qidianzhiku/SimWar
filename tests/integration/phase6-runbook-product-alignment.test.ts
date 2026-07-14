import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getKnownLimitsProjection } from "@simwar/shared-contracts";
import { STUDENT_BFF_FORBIDDEN_FIELDS } from "../../services/api/src/teacher-student-bff-dto";

function readRepositoryFile(path: string): string {
  return readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8");
}

describe("Phase 6 runbook product alignment", () => {
  it("aligns the operator flow with current read-only product boundaries", () => {
    const teacherKit = readRepositoryFile("docs/operations/l1-teacher-kit-internal-only.md");
    const runbook = readRepositoryFile("docs/operations/l1-session-runbook-lite.md");

    expect(teacherKit).toContain("Teacher Workspace");
    expect(teacherKit).toContain("Student redacted result");
    expect(teacherKit).toContain("Tenant Admin current-tenant");
    expect(runbook).toContain("service-kernel-only settlement boundary");
    expect(runbook).toContain("Do not call the internal settlement route from a frontend");
    expect(runbook).toContain("must not read `runtime.store`, edit the JSON snapshot");
    expect(runbook).not.toMatch(
      /^\d+\.\s+(?:Read `runtime\.store`|Edit the JSON snapshot|Call the internal settlement route)/m
    );
  });

  it("keeps Known Limits projections read-only for every product role", () => {
    for (const role of ["teacher", "student", "tenant_admin", "platform_admin"] as const) {
      const projection = getKnownLimitsProjection(role);

      expect(projection.allowed_actions).toEqual([]);
      expect(projection.mutation_capability).toBe("NONE");
    }
  });

  it("keeps protected markers in the Student no-go boundary", () => {
    const replayChecklist = readRepositoryFile(
      "docs/operations/l1-replay-evidence-review-checklist.md"
    );
    const escalation = readRepositoryFile("docs/operations/l1-issue-escalation-procedure.md");

    for (const marker of STUDENT_BFF_FORBIDDEN_FIELDS) {
      expect(`${replayChecklist}\n${escalation}`).toContain(marker);
    }
    expect(replayChecklist).toContain("replay_writes_formal_results = false");
  });
});
