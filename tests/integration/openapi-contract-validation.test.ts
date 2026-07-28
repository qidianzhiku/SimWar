import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, it } from "vitest";
import { runContractValidation } from "../../scripts/contract-validation-facade.mjs";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("OpenAPI contract validation", () => {
  it("rejects an otherwise complete OpenAPI document with an unsupported version", async () => {
    const directory = mkdtempSync("contracts/openapi/.simwar-openapi-contract-");
    temporaryDirectories.push(directory);
    const openApiPath = join(directory, "p0-api.openapi.yaml");
    const canonicalDocument = readFileSync("contracts/openapi/p0-api.openapi.yaml", "utf8");

    writeFileSync(
      openApiPath,
      canonicalDocument.replace("openapi: 3.1.0", "openapi: 9.9.9"),
      "utf8"
    );

    try {
      await runContractValidation({ openApiPath });
    } catch {
      return;
    }

    throw new Error("Expected an unsupported OpenAPI version to be rejected by the parser.");
  });
});
