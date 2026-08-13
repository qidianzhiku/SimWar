import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const args = process.argv.slice(2);
const valueFor = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const baselineRoot = resolve(valueFor("--baseline", "tmp/pr4-playwright/baseline"));
const candidateRoot = resolve(valueFor("--candidate", "tmp/pr4-playwright/candidate"));
const outputPath = valueFor("--output", "");
const threshold = Number(valueFor("--threshold", "0"));
const expectedSha = valueFor("--expected-sha", process.env.GITHUB_SHA ?? null);
const captureState = valueFor("--state", "candidate");
const actualSha = (() => {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
})();
const branch = (() => {
  try {
    return execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
})();
const clean = (() => {
  try {
    return execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim() === "";
  } catch {
    return null;
  }
})();
const filesUnder = (root) => {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [relative(root, path).replaceAll("\\", "/")];
  });
};
const digest = (root, path) =>
  createHash("sha256")
    .update(readFileSync(join(root, path)))
    .digest("hex");
const paths = [...new Set([...filesUnder(baselineRoot), ...filesUnder(candidateRoot)])].sort();
const surfaces = paths.map((path) => ({
  path,
  role: path.match(/^(admin|teacher|student|enterprise)(?:-|\/)/i)?.[1]?.toLowerCase() ?? null,
  viewport: path.match(/(?:^|-)(1440|1280|1024|390)(?:-|x|\.)/)?.[1]
    ? Number(path.match(/(?:^|-)(1440|1280|1024|390)(?:-|x|\.)/)?.[1])
    : null,
  state: captureState,
  base_sha: expectedSha,
  expected_sha: expectedSha,
  actual_sha: actualSha,
  baseline_sha256: existsSync(join(baselineRoot, path)) ? digest(baselineRoot, path) : null,
  candidate_sha256: existsSync(join(candidateRoot, path)) ? digest(candidateRoot, path) : null
}));
const manifest = {
  schema_version: 1,
  status: "not_ready",
  ready_for_review: false,
  head: { expected_sha: expectedSha, actual_sha: actualSha, branch, clean },
  base_sha: expectedSha,
  baseline_root: baselineRoot,
  candidate_root: candidateRoot,
  threshold: { max_diff_ratio: threshold },
  automatic_threshold: { max_diff_ratio: threshold, enforced: false },
  pixel_diff: {
    status: "not_run",
    reason: "Pixel diff is intentionally delegated to the parent visual runner."
  },
  dialog_drawer: "N/A: no dialog or drawer is implemented by these surfaces.",
  surfaces
};
const serialized = JSON.stringify(manifest, null, 2);
if (outputPath) {
  writeFileSync(resolve(outputPath), `${serialized}\n`);
} else {
  console.log(serialized);
}
