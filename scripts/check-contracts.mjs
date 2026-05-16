import { existsSync } from "node:fs";
import { resolve } from "node:path";

const requiredFiles = [
  "docs/contracts/api-contract.md",
  "docs/contracts/model-engineering-contract.md",
  "packages/shared-contracts/src/index.ts",
  "services/api/src/health.ts"
];

const missing = requiredFiles.filter((file) => !existsSync(resolve(file)));

if (missing.length > 0) {
  console.error("Missing contract baseline files:");
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log("Contract baseline files are present.");
