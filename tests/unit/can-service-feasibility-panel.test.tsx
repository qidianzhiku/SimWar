/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { isCanServiceFeasibilityNotAvailable } from "../../packages/ui/src/components/CanServiceFeasibilityPanel";

describe("R1 CAN service-feasibility panel availability", () => {
  it("recognizes a missing exact candidate context as an unavailable projection", () => {
    const notFound = Object.assign(new Error("CAN candidate not found"), { status: 404 });

    expect(isCanServiceFeasibilityNotAvailable(notFound)).toBe(true);
    expect(
      isCanServiceFeasibilityNotAvailable(Object.assign(new Error("server error"), { status: 500 }))
    ).toBe(false);
    expect(isCanServiceFeasibilityNotAvailable(new Error("network error"))).toBe(false);
  });
});
