import { describe, expect, it } from "vitest";
import {
  ParameterSetAuthorityError,
  createParameterSetReference
} from "../../packages/shared-contracts/src/parameter-set-authority";

describe("ParameterSet authority shared contract", () => {
  it("creates an exact immutable ParameterSet reference", () => {
    expect(
      createParameterSetReference({
        content_digest: "a".repeat(64),
        parameter_set_id: "parameter_set_demo",
        version: "1.2.0"
      })
    ).toEqual({
      content_digest: "a".repeat(64),
      parameter_set_id: "parameter_set_demo",
      version: "1.2.0"
    });
  });

  it("rejects blank identities and floating versions", () => {
    expect(() =>
      createParameterSetReference({
        content_digest: "a".repeat(64),
        parameter_set_id: "parameter_set_demo",
        version: "latest"
      })
    ).toThrow(new ParameterSetAuthorityError("PARAMETER_SET_REFERENCE_INVALID"));
  });
});
