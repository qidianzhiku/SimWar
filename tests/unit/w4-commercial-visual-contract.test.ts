import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(".");

function source(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("W4 commercial visual contract", () => {
  it("loads one shared Figma-aligned visual layer in all three W4 surfaces", () => {
    for (const path of [
      "apps/admin/src/W4EnterprisePortfolioPanel.tsx",
      "apps/teacher/src/W4EnterpriseStateWorkbench.tsx",
      "apps/student/src/W4EnterpriseStatePanel.tsx"
    ]) {
      expect(source(path)).toContain('import("@simwar/ui/w4-commercial.css")');
      expect(source(path)).toContain("sw-w4-panel");
    }

    const styles = source("packages/ui/src/w4-commercial.css");
    expect(styles).toContain("--sw-color-surface-warm");
    expect(styles).toContain("--sw-control-min-height: 44px");
    expect(styles).toContain(".sw-w4-metric-grid");
    expect(styles).toContain("@media (max-width: 720px)");
  });

  it("keeps customer-facing W4 copy free of internal object names", () => {
    for (const path of [
      "apps/admin/src/W4EnterprisePortfolioPanel.tsx",
      "apps/teacher/src/W4EnterpriseStateWorkbench.tsx",
      "apps/student/src/W4EnterpriseStatePanel.tsx"
    ]) {
      const content = source(path);
      expect(content).not.toMatch(
        /Enterprise Portfolio|Enterprise State|Strategic Evolution|Process Information|Outcome Information|Opening State|Closing State|OperatingUnit|Initiative|Commitment|Lead time|New Project/
      );
    }
  });
});
