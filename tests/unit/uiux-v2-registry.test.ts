import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(".");

function readRegistry() {
  const [headerLine, ...lines] = readFileSync(
    resolve(root, "docs/uiux-v2/phase1/UI_SURFACE_REGISTRY.csv"),
    "utf8"
  )
    .trim()
    .split(/\r?\n/);
  const headers = headerLine.split(",");
  return lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

describe("UI/UX V2 reachable surface registry", () => {
  it("binds the three current navigation denominators to 36 unique surfaces", () => {
    const rows = readRegistry();
    expect(rows).toHaveLength(36);
    expect(new Set(rows.map((row) => row.SURFACE_ID)).size).toBe(36);
    expect(rows.filter((row) => row.ROLE === "Teacher")).toHaveLength(12);
    expect(rows.filter((row) => row.ROLE === "Student")).toHaveLength(13);
    expect(rows.filter((row) => row.ROLE === "Admin")).toHaveLength(11);
  });

  it("does not leave a surface with an unknown classification", () => {
    const rows = readRegistry();
    expect(rows.every((row) => row.CURRENT_DESIGN_CLASS !== "UNKNOWN")).toBe(true);
    expect(rows.every((row) => row.FIGMA_AUTHORITY !== "UNKNOWN")).toBe(true);
  });

  it("keeps Student submission and results bound to their actual desktop source", () => {
    const rows = readRegistry();
    for (const id of ["STU-09", "STU-10"]) {
      expect(rows.find((row) => row.SURFACE_ID === id)?.SOURCE_ANCHOR).toContain(
        "apps/student/src/StudentDecisionDesktop.tsx"
      );
    }
  });

  it("records current Figma foundation assets without promoting them to exact 36-surface authority", () => {
    const authority = JSON.parse(
      readFileSync(resolve(root, "docs/uiux-v2/phase1/FIGMA_AUTHORITY_REGISTRY.json"), "utf8")
    ) as {
      pages: Array<{ id: string; name: string; classification: string }>;
      role_surface_authority: Record<string, string>;
      code_connect: string;
      variables: { variable_count: number };
    };
    expect(authority.pages.find((page) => page.name === "01 Design System")?.classification).toBe(
      "CURRENT_REFERENCE_CANDIDATE"
    );
    expect(authority.pages.find((page) => page.name === "02 Components")?.id).toBe("18:4");
    expect(authority.variables.variable_count).toBe(31);
    expect(authority.role_surface_authority).toEqual({
      teacher: "NOT_PROVEN",
      student: "NOT_PROVEN",
      admin: "NOT_PROVEN"
    });
    expect(authority.code_connect).toBe("NOT_PROVEN_UNAVAILABLE");
  });
});
