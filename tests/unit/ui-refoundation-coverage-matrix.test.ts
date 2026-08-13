import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(".");

function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

describe("UI refoundation coverage evidence", () => {
  for (const file of ["route-state-matrix.csv", "page-inventory.csv"]) {
    it(`${file} is rectangular and has unique non-empty identifiers`, () => {
      const rows = parseCsv(
        readFileSync(resolve(root, "docs/design/ui-refoundation", file), "utf8")
      );
      const headerWidth = rows[0]?.length ?? 0;
      const malformed = rows
        .slice(1)
        .map((row, index) => ({ id: row[0], line: index + 2, width: row.length }))
        .filter((row) => row.width !== headerWidth);
      const identifiers = rows.slice(1).map((row) => row[0]);

      expect(malformed).toEqual([]);
      expect(identifiers.every(Boolean)).toBe(true);
      expect(new Set(identifiers).size).toBe(identifiers.length);
    });
  }

  it("documents separate route, inventory, and state coverage denominators", () => {
    const readme = readFileSync(resolve(root, "docs/design/ui-refoundation/README.md"), "utf8");

    expect(readme).toContain("34 个当前逻辑 hash 目的地");
    expect(readme).toContain("39 个 page inventory surface");
    expect(readme).toContain("32 个 aggregate route/BFF matrix 行");
    expect(readme).toContain(
      "不得把 DesignSystemLab 的 synthetic state 当作每个业务 workbench 的状态证据"
    );
  });

  it("binds the documented state-classification distribution to all 480 matrix cells", () => {
    const rows = parseCsv(
      readFileSync(resolve(root, "docs/design/ui-refoundation/route-state-matrix.csv"), "utf8")
    );
    const header = rows[0] ?? [];
    const stateColumns = [
      "loading",
      "empty",
      "partial",
      "ready",
      "blocked",
      "stale",
      "conflict",
      "unknown",
      "permission_denied",
      "error",
      "submitting",
      "committed",
      "reused",
      "command_conflict",
      "failed"
    ];
    const stateIndexes = stateColumns.map((column) => header.indexOf(column));
    const classifications = rows.slice(1).flatMap((row) =>
      stateIndexes.map((index) => {
        const value = row[index] ?? "";
        if (value.startsWith("observed")) return "observed";
        if (value.startsWith("source")) return "source";
        if (value === "known limits") return "known limit";
        return value;
      })
    );
    const counts = Object.fromEntries(
      [...new Set(classifications)]
        .sort()
        .map((value) => [value, classifications.filter((candidate) => candidate === value).length])
    );

    expect(stateIndexes.every((index) => index >= 0)).toBe(true);
    expect(classifications).toHaveLength(480);
    expect(counts).toEqual({
      "known contract gaps": 1,
      "known limit": 11,
      "not applicable": 22,
      "not captured": 67,
      "not implemented": 5,
      observed: 49,
      source: 325
    });
  });

  it("binds all 34 current logical hash destinations to role browser evidence", () => {
    const evidence = [
      {
        file: "tests/e2e-ui/ui-refoundation-admin.spec.ts",
        ids: [
          "admin-delivery-overview",
          "admin-tenants-entitlements",
          "admin-users-roles",
          "admin-assets",
          "admin-security-projection",
          "admin-audit-receipts",
          "admin-runtime-support",
          "admin-known-limits",
          "admin-environment-recovery",
          "admin-enterprise-course-factory"
        ]
      },
      {
        file: "tests/e2e-ui/ui-refoundation-teacher.spec.ts",
        ids: [
          "teacher-today",
          "teacher-blockers",
          "teacher-courses",
          "teacher-readiness",
          "teacher-teams-roles",
          "teacher-round-control",
          "teacher-results",
          "teacher-debrief",
          "teacher-evidence",
          "teacher-reports",
          "teacher-validation",
          "teacher-close-cleanup"
        ]
      },
      {
        file: "tests/e2e-ui/ui-refoundation-student.spec.ts",
        ids: [
          "student-role-mission",
          "student-cockpit",
          "student-evidence",
          "student-private-draft",
          "student-collaboration",
          "student-divergence",
          "student-confirmation",
          "student-submission",
          "student-results",
          "student-debrief",
          "student-learning-report",
          "student-learning-path"
        ]
      }
    ];

    expect(evidence.flatMap(({ ids }) => ids)).toHaveLength(34);
    for (const { file, ids } of evidence) {
      const source = readFileSync(resolve(root, file), "utf8");
      for (const id of ids) expect(source, `${file} -> ${id}`).toContain(id);
    }
  });
});
