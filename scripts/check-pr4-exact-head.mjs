import { execFileSync } from "node:child_process";

const scriptArgs = process.argv.slice(2);
const allowDirty = scriptArgs.includes("--allow-dirty");
const expectedSha = scriptArgs.find((argument) => !argument.startsWith("-"))?.trim();
if (!expectedSha) {
  console.error("Usage: node scripts/check-pr4-exact-head.mjs <expected-sha>");
  process.exit(2);
}

const runGit = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const actualSha = runGit(["rev-parse", "HEAD"]);
const branch = runGit(["branch", "--show-current"]);
const status = runGit(["status", "--porcelain"]);
const report = {
  schema_version: 1,
  expected_sha: expectedSha,
  actual_sha: actualSha,
  branch,
  clean: status.length === 0
};

console.log(JSON.stringify(report, null, 2));
if (expectedSha !== actualSha) {
  process.exitCode = 1;
}
if (!report.clean && !allowDirty) {
  process.exitCode = 1;
}
