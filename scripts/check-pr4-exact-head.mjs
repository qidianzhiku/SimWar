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
const prHeadSha = process.env.EXPECTED_PR_HEAD_SHA?.trim() || expectedSha;
const checkoutRef = (() => {
  if (process.env.GITHUB_REF?.trim()) return process.env.GITHUB_REF.trim();
  try {
    return runGit(["symbolic-ref", "--short", "HEAD"]);
  } catch {
    return runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
  }
})();
const branch = runGit(["branch", "--show-current"]);
const status = runGit(["status", "--porcelain"]);
const report = {
  schema_version: 1,
  expected_sha: expectedSha,
  pr_head_sha: prHeadSha,
  actual_sha: actualSha,
  checkout_sha: actualSha,
  checkout_ref: checkoutRef,
  branch,
  clean: status.length === 0
};

console.log(JSON.stringify(report, null, 2));
if (expectedSha !== actualSha || prHeadSha !== actualSha) {
  process.exitCode = 1;
}
if (!report.clean && !allowDirty) {
  process.exitCode = 1;
}
