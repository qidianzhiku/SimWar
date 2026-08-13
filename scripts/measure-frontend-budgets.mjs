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
  admin: { js: [273.62, 84.49], css: [27.06, 5.29] },
  teacher: { js: [367.35, 106.24], css: [34.18, 6.52] },
  student: { js: [249.73, 77.44], css: [24.26, 4.73] }
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
  const selected = files.filter((file) => file.toLowerCase().endsWith(`.${kind}`));
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
