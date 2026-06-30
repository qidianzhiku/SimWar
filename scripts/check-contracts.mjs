import { runContractValidation } from "./contract-validation-facade.mjs";

try {
  const summary = runContractValidation();
  console.log(
    [
      "Contract conformance gate passed:",
      `${summary.baselineFiles} baseline files present,`,
      `${summary.m1ContractFiles} M1 contract files present,`,
      `${summary.fixtureCases} schema/fixture case groups validated.`
    ].join(" ")
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
