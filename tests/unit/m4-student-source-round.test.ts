import { describe, expect, it } from "vitest";
import { resolveM4SourceRoundNo } from "../../apps/student/src/m4-source-round";

describe("M4 Student source round binding", () => {
  it("selects the latest published source round instead of the current open round", () => {
    expect(
      resolveM4SourceRoundNo(
        [
          { run_id: "m4-run", round_no: 1, status: "published" },
          { run_id: "m4-run", round_no: 2, status: "open" }
        ],
        "m4-run"
      )
    ).toBe(1);
  });

  it("does not invent a source round when the run has no published round", () => {
    expect(
      resolveM4SourceRoundNo([{ run_id: "m4-run", round_no: 1, status: "open" }], "m4-run")
    ).toBeUndefined();
  });
});
