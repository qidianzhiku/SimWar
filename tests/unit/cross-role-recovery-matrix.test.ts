import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function parseCsv(source: string): string[][] {
  return source
    .trim()
    .split(/\r?\n/u)
    .map((line) => line.split(","));
}

describe("R3 cross-role recovery matrix", () => {
  const rows = parseCsv(
    readFileSync(resolve("docs/design/ui-refoundation/recovery-state-matrix.csv"), "utf8")
  );
  const header = rows[0] ?? [];
  const rowData = rows.slice(1);

  it("covers all four critical role journeys with one rectangular matrix", () => {
    expect(rowData).toHaveLength(4);
    expect(new Set(rowData.map((row) => row[0]))).toEqual(
      new Set(["admin", "teacher", "student", "enterprise"])
    );
    expect(rowData.every((row) => row.length === header.length)).toBe(true);
    expect(header).toEqual([
      "role",
      "critical_journey",
      "loading",
      "ready",
      "stale",
      "reauth_required",
      "conflict",
      "rollback_available",
      "error",
      "keyboard_focus",
      "reflow_200",
      "reduced_motion",
      "non_color_cue",
      "evidence_boundary"
    ]);
  });

  it("makes every recovery state and accessibility expectation explicit", () => {
    const requiredColumns = [
      "loading",
      "ready",
      "stale",
      "reauth_required",
      "conflict",
      "rollback_available",
      "error",
      "keyboard_focus",
      "reflow_200",
      "reduced_motion",
      "non_color_cue"
    ];

    for (const column of requiredColumns) {
      const index = header.indexOf(column);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(rowData.every((row) => (row[index] ?? "").length > 0)).toBe(true);
    }
  });
});
