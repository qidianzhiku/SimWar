import { describe, expect, it } from "vitest";
import { TRUTH_PROTECTED_FIELDS, createHealthPayload } from "../../packages/shared-contracts/src";
import { getApiHealthPayload } from "../../services/api/src/health";

describe("Phase 0 health contracts", () => {
  it("marks health responses as structured-core-only", () => {
    const payload = createHealthPayload("test-service", "0.0.0-test");

    expect(payload.status).toBe("ok");
    expect(payload.truthBoundary).toBe("structured-core-only");
  });

  it("exposes API health metadata", () => {
    expect(getApiHealthPayload()).toMatchObject({
      service: "@simwar/api",
      status: "ok",
      truthBoundary: "structured-core-only"
    });
  });

  it("keeps settlement fields in the protected truth boundary", () => {
    expect(TRUTH_PROTECTED_FIELDS).toContain("score");
    expect(TRUTH_PROTECTED_FIELDS).toContain("settlementStatus");
  });
});
