import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(".");

function source(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("Project-aware commercial visual contract", () => {
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
