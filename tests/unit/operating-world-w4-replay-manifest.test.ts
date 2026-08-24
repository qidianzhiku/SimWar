import { describe, expect, it } from "vitest";
import { resolveOperatingWorldBindingDigest } from "../../services/api/src/operating-world-consequence-trace.js";

describe("W4 replay manifest Operating World identity seam", () => {
  it("accepts only an exact operating-world binding digest from the existing W4 action source", () => {
    const digest = "a".repeat(64);

    expect(resolveOperatingWorldBindingDigest(`operating-world:${digest}`)).toBe(digest);
    expect(resolveOperatingWorldBindingDigest(`operating-world:${"b".repeat(63)}`)).toBeUndefined();
    expect(resolveOperatingWorldBindingDigest("operating-world:latest")).toBeUndefined();
    expect(resolveOperatingWorldBindingDigest("parameter-set:params_r3")).toBeUndefined();
  });
});
