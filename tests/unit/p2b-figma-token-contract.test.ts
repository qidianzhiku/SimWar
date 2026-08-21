import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tokens = readFileSync(resolve(process.cwd(), "packages/ui/src/tokens.css"), "utf8");
const studentCss = readFileSync(
  resolve(process.cwd(), "apps/student/src/p2b-decision-learning.css"),
  "utf8"
);
const teacherCss = readFileSync(
  resolve(process.cwd(), "apps/teacher/src/p2b-teacher-debrief.css"),
  "utf8"
);

describe("P2-B Figma token contract", () => {
  it("keeps the P2-B handoff values in the shared UI token layer", () => {
    for (const token of [
      "--sw-color-surface-warm",
      "--sw-color-surface-navy",
      "--sw-color-surface-teal-subtle",
      "--sw-color-surface-metric",
      "--sw-color-surface-mechanism",
      "--sw-color-surface-blocked",
      "--sw-color-border-soft",
      "--sw-color-border-input",
      "--sw-color-state-critical",
      "--sw-color-focus-warm",
      "--sw-control-min-height"
    ]) {
      expect(tokens).toContain(token);
    }
  });

  it("does not introduce an app-local P2-B palette", () => {
    for (const css of [studentCss, teacherCss]) {
      expect(css).not.toMatch(
        /#(?:1f6b69|eef4f3|d4a72c|9f2f2c|d8e3e7|b7c6cf|52646e|627d98|f5f8fa|fff8e7|ead69a|a6cbc4|8eb8b1|f7f3ea)/i
      );
      expect(css).toContain("var(--sw-color-");
      expect(css).toContain("var(--sw-space-");
    }
  });
});
