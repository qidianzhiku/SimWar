import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tokenSource = readFileSync(resolve("packages/ui/src/tokens.css"), "utf8");
const styleSource = readFileSync(resolve("packages/ui/src/styles.css"), "utf8");
const studentStyleSource = readFileSync(resolve("apps/student/src/styles.css"), "utf8");

describe("Figma P1 design contract", () => {
  it("maps the approved Design System board values into shared CSS tokens", () => {
    const expected = {
      "--sw-primitive-color-brand-primary": "#2f6bff",
      "--sw-primitive-color-brand-secondary": "#6b4eff",
      "--sw-primitive-color-state-success": "#1f9d55",
      "--sw-primitive-color-state-warning": "#c88719",
      "--sw-primitive-color-state-danger": "#d14343",
      "--sw-primitive-color-state-ai": "#8b5cf6",
      "--sw-primitive-color-official": "#0f766e",
      "--sw-primitive-color-replay": "#a16207",
      "--sw-primitive-color-surface-base": "#f7f9fc",
      "--sw-primitive-color-border": "#d9e2ec",
      "--sw-primitive-color-text-strong": "#102a43",
      "--sw-primitive-color-text-muted": "#52606d",
      "--sw-space-page": "24px",
      "--sw-space-card": "20px",
      "--sw-space-form": "16px",
      "--sw-space-row": "52px",
      "--sw-control-min-height": "44px",
      "--sw-radius-card": "12px",
      "--sw-radius-button": "10px",
      "--sw-radius-modal": "16px"
    } as const;

    for (const [token, value] of Object.entries(expected)) {
      expect(tokenSource).toContain(`${token}: ${value}`);
    }
  });

  it("uses shared Figma aliases for controls, cards, and state surfaces", () => {
    for (const token of [
      "var(--sw-color-brand-primary-accessible)",
      "var(--sw-color-brand-secondary-accessible)",
      "var(--sw-color-action-primary-accessible)",
      "var(--sw-color-surface-border)",
      "var(--sw-color-text-muted)",
      "var(--sw-control-min-height)",
      "var(--sw-radius-button)",
      "var(--sw-radius-card)"
    ]) {
      expect(styleSource).toContain(token);
    }
  });

  it("keeps long compatibility copy inside the responsive student surface", () => {
    expect(studentStyleSource).toContain(".compatibility-copy");
    expect(studentStyleSource).toContain("overflow-wrap: anywhere");
    expect(studentStyleSource).toContain("word-break: break-word");
  });
});
