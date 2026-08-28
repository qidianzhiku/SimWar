import { describe, expect, it } from "vitest";
import { resolveM4SourceRoundNo } from "../../packages/ui/src/components/M4MultipathCounterfactualTransferPanel";

describe("M4 UI source round binding", () => {
  it("accepts a published result from the requested run", () => {
    expect(
      resolveM4SourceRoundNo(
        { run_id: "m4-run", round_no: 1, status: "published" },
        "m4-run"
      )
    ).toBe(1);
  });

  it("fails closed for an open or different-run result", () => {
    expect(
      resolveM4SourceRoundNo({ run_id: "m4-run", round_no: 2, status: "open" }, "m4-run")
    ).toBeUndefined();
    expect(
      resolveM4SourceRoundNo(
        { run_id: "other-run", round_no: 1, status: "published" },
        "m4-run"
      )
    ).toBeUndefined();
  });
});
