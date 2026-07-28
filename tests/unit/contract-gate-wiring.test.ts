import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("M1 contract gate wiring", () => {
  it("runs the handler conformance suite from the CI contract command", () => {
    const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["test:contract"]).toContain(
      "tests/integration/m1-handler-contract-conformance.test.ts"
    );
  });
});
