import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(".");

function source(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("Project-aware commercial visual contract", () => {
  it("derives Student evidence enablement from the runtime assignment projection", () => {
    const app = source("apps/student/src/App.tsx");
    const brief = source("apps/student/src/ProjectBriefPanel.tsx");
    expect(app).not.toContain("VITE_SIMWAR_PROJECT_AWARE_COURSE_ID");
    expect(app).not.toContain("VITE_SIMWAR_PROJECT_AWARE_RUN_ID");
    expect(app).toContain("onAvailabilityChange={setProjectAwareEvidenceAvailability}");
    expect(app).toContain("roundId={latestRound?.round_id}");
    expect(brief).toContain("decision_context_evidence_required");
    expect(brief).toContain('onAvailabilityChange?.("error")');
  });

  it("keeps the role workspace read continuity independent from evidence readiness", () => {
    const panel = source("apps/student/src/StudentRoleWorkflowPanel.tsx");
    const contextKey = panel.slice(
      panel.indexOf("const contextKey"),
      panel.indexOf("const decisionContextGateReady")
    );
    expect(contextKey).not.toContain("decisionContextEvidenceId");
    expect(contextKey).not.toContain("decisionContextEvidenceRequired");
    expect(contextKey).not.toContain("decisionContextEvidenceReady");
    expect(panel).toContain("props.token\n    ]");
    expect(panel).not.toContain("decisionContextGateReady\n    ]");
  });

  it("loads one shared Figma-aligned visual layer in all three apps", () => {
    for (const app of ["admin", "teacher", "student"]) {
      expect(
        source(
          `apps/${app}/src/ProjectAware${app === "admin" ? "LaunchAudit" : app === "teacher" ? "CourseLaunch" : "StudentContext"}Panel.tsx`
        )
      ).toContain('import("@simwar/ui/project-aware.css")');
    }

    const styles = source("packages/ui/src/project-aware.css");
    expect(styles).toContain(".sw-project-aware");
    expect(styles).toContain("--sw-color-surface-warm");
    expect(styles).toContain("--sw-control-min-height: 44px");
    expect(styles).toContain("@media (max-width: 720px)");
  });

  it("keeps Project-aware customer language free of internal workflow labels", () => {
    const componentPaths = [
      "apps/admin/src/ProjectAwareLaunchAuditPanel.tsx",
      "apps/teacher/src/ProjectAwareCourseLaunchPanel.tsx",
      "apps/student/src/ProjectAwareStudentContextPanel.tsx"
    ];

    for (const path of componentPaths) {
      const content = source(path);
      expect(content).toContain("sw-project-aware");
      expect(content).not.toMatch(
        /M2-P3|tenant-scoped|READ ONLY|SERVER_SCOPED|formal binding|Successor available|Launch receipts|Project-aware/
      );
    }
  });
});
