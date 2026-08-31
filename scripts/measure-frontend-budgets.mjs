import { gzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const args = process.argv.slice(2);
const valueFor = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const distRoot = resolve(valueFor("--dist-root", "."));
const outputPath = valueFor("--output", "");
const maxIncreaseRatio = Number(valueFor("--max-increase", "0.1"));
if (!Number.isFinite(maxIncreaseRatio) || maxIncreaseRatio < 0) {
  throw new Error("--max-increase must be a finite non-negative number.");
}
const baseSha = valueFor("--base-sha", process.env.PR4_BASE_SHA ?? null);
const headSha = valueFor("--head-sha", process.env.PR4_HEAD_SHA ?? process.env.GITHUB_SHA ?? null);
const gitValue = (command) => {
  try {
    return execFileSync("git", command, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
};
const actualSha = gitValue(["rev-parse", "HEAD"]);
const branch = gitValue(["branch", "--show-current"]);
const clean = (() => {
  try {
    return execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim() === "";
  } catch {
    return null;
  }
})();
const baseline = {
  // Exact production assets measured from the current protected master source
  // epoch 4d1f6c409ddb8c9b670428254f725f10d39ad412 in a clean base worktree.
  // Keeping the baseline at the actual PR base avoids charging current master
  // history against a stale PR4-only budget while retaining the same 10% cap.
  admin: { js: [299.58, 90.7], css: [32.54, 5.99] },
  teacher: { js: [423.79, 121.49], css: [40.55, 7.32] },
  student: { js: [290.86, 89.42], css: [28.6, 5.28] }
};

const allFiles = (directory) => {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? allFiles(path) : [path];
  });
};
const kb = (bytes) => Number((bytes / 1000).toFixed(2));
const measured = (app, kind) => {
  const files = allFiles(join(distRoot, "apps", app, "dist", "assets"));
  if (files.length === 0) {
    throw new Error(`No built assets found for ${app}; expected apps/${app}/dist/assets`);
  }
  // Measure the initial entry assets only. Lazy route/workbench chunks are
  // intentionally reported by the runtime/route evidence rather than being
  // counted twice as initial transfer budget.
  const selected = files.filter(
    (file) =>
      file.toLowerCase().endsWith(`.${kind}`) && /^index-/i.test(file.split(/[\\/]/).pop() ?? "")
  );
  if (selected.length === 0) {
    throw new Error(`No ${kind} entry asset found for ${app}; expected index-* assets`);
  }
  const rawBytes = selected.reduce((total, file) => total + readFileSync(file).byteLength, 0);
  const gzipBytes = selected.length
    ? selected
        .map((file) => gzipSync(readFileSync(file)).byteLength)
        .reduce((total, bytes) => total + bytes, 0)
    : 0;
  return { measured_raw_kb: kb(rawBytes), measured_gzip_kb: kb(gzipBytes) };
};

const budgets = {};
const failures = [];
if (!baseSha || !headSha) {
  failures.push("BASE/HEAD provenance is required for bundle budget measurement");
}
if (!actualSha || (headSha && headSha !== actualSha)) {
  failures.push(
    `HEAD provenance does not match actual checked-out HEAD (${headSha ?? "missing"} vs ${actualSha ?? "missing"})`
  );
}
for (const app of Object.keys(baseline)) {
  budgets[app] = {};
  for (const kind of ["js", "css"]) {
    const [baselineRaw, baselineGzip] = baseline[app][kind];
    const actual = measured(app, kind);
    const rawLimit = baselineRaw * (1 + maxIncreaseRatio);
    const gzipLimit = baselineGzip * (1 + maxIncreaseRatio);
    if (actual.measured_raw_kb > rawLimit) {
      failures.push(`${app} ${kind} raw ${actual.measured_raw_kb} > ${rawLimit.toFixed(2)} kB`);
    }
    if (actual.measured_gzip_kb > gzipLimit) {
      failures.push(`${app} ${kind} gzip ${actual.measured_gzip_kb} > ${gzipLimit.toFixed(2)} kB`);
    }
    budgets[app][kind] = {
      baseline_raw_kb: baselineRaw,
      baseline_gzip_kb: baselineGzip,
      ...actual,
      max_increase_ratio: maxIncreaseRatio
    };
  }
}

const report = {
  schema_version: 1,
  dist_root: distRoot,
  base_sha: baseSha,
  head_sha: headSha,
  actual_sha: actualSha,
  branch,
  clean,
  max_increase_ratio: maxIncreaseRatio,
  budgets,
  failures,
  status: failures.length === 0 ? "passed" : "failed"
};
const serialized = JSON.stringify(report, null, 2);
if (outputPath) {
  mkdirSync(dirname(resolve(outputPath)), { recursive: true });
  writeFileSync(resolve(outputPath), `${serialized}\n`);
} else {
  console.log(serialized);
}
if (failures.length > 0) process.exitCode = 1;
