import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const require = createRequire(import.meta.url);
// Playwright already bundles the PNG decoder used by its screenshot comparator.
const { PNG } = require("playwright-core/lib/utilsBundle");

const args = process.argv.slice(2);
const valueFor = (name, fallback = null) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const evidenceRoot = process.env.PR4_EVIDENCE_ROOT ? resolve(process.env.PR4_EVIDENCE_ROOT) : null;
const baselineArg = valueFor("--baseline", null);
const candidateArg = valueFor("--candidate", null);
const diffArg = valueFor("--diff-root", null);
const outputArg = valueFor("--output", null);
if ([baselineArg, candidateArg, diffArg, outputArg].some((path) => path && !isAbsolute(path))) {
  throw new Error("PR4 visual comparison paths must be absolute.");
}
if (!evidenceRoot && [baselineArg, candidateArg, diffArg, outputArg].some((path) => !path)) {
  throw new Error(
    "PR4 visual comparison requires PR4_EVIDENCE_ROOT or explicit absolute --baseline, --candidate, --diff-root, and --output paths."
  );
}
const baselineRoot = resolve(baselineArg ?? join(evidenceRoot, "baseline"));
const candidateRoot = resolve(candidateArg ?? join(evidenceRoot, "candidate"));
const diffRoot = resolve(diffArg ?? join(evidenceRoot, "diff"));
const outputPath = outputArg ?? join(evidenceRoot, "visual-manifest.json");
const maxDiffPixelRatio = Number(valueFor("--max-diff-pixel-ratio", valueFor("--threshold", "0")));
if (!Number.isFinite(maxDiffPixelRatio) || maxDiffPixelRatio < 0 || maxDiffPixelRatio > 1) {
  throw new Error("--max-diff-pixel-ratio must be a finite number between 0 and 1.");
}
const allowDirty = args.includes("--allow-dirty");
const baseSha = valueFor("--base-sha", process.env.PR4_BASE_SHA ?? null);
const headSha = valueFor("--head-sha", process.env.PR4_HEAD_SHA ?? process.env.GITHUB_SHA ?? null);
const captureState = valueFor("--state", "candidate");

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
const parseViewport = (path) => {
  const match = path.match(/(?:^|-)(\d+)x(\d+)(?:-|\.)/);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
};
const parseRole = (path) =>
  path.match(/^(admin|teacher|student|enterprise|lab)(?:-|\/)/i)?.[1]?.toLowerCase() ?? null;
const parseState = (path) => {
  const match = path.match(
    /(?:^|-)\b(ready|loading|empty|partial|blocked|stale|conflict|unknown|permission-denied|error|disabled|state-matrix)\b(?:-|\.)/i
  );
  return match?.[1]?.toLowerCase() ?? captureState;
};
const manifestBase = outputPath ? dirname(resolve(outputPath)) : process.cwd();
const relativeManifestPath = (path) => relative(manifestBase, path).replaceAll("\\", "/");

const comparePng = (baselineBuffer, candidateBuffer) => {
  const baseline = PNG.sync.read(baselineBuffer);
  const candidate = PNG.sync.read(candidateBuffer);
  if (baseline.width !== candidate.width || baseline.height !== candidate.height) {
    return {
      ratio: 1,
      diff: null,
      dimensionMismatch: true,
      dimensions: {
        baseline: { width: baseline.width, height: baseline.height },
        candidate: { width: candidate.width, height: candidate.height }
      }
    };
  }

  const totalPixels = baseline.width * baseline.height;
  const diffData = Buffer.alloc(baseline.data.length);
  let differentPixels = 0;
  for (let index = 0; index < baseline.data.length; index += 4) {
    const changed =
      baseline.data[index] !== candidate.data[index] ||
      baseline.data[index + 1] !== candidate.data[index + 1] ||
      baseline.data[index + 2] !== candidate.data[index + 2] ||
      baseline.data[index + 3] !== candidate.data[index + 3];
    if (changed) {
      differentPixels += 1;
      diffData[index] = 255;
      diffData[index + 1] = 0;
      diffData[index + 2] = 0;
      diffData[index + 3] = 255;
    } else {
      diffData[index] = baseline.data[index];
      diffData[index + 1] = baseline.data[index + 1];
      diffData[index + 2] = baseline.data[index + 2];
      diffData[index + 3] = 64;
    }
  }
  return {
    ratio: totalPixels === 0 ? 0 : differentPixels / totalPixels,
    diff:
      differentPixels === 0
        ? null
        : PNG.sync.write({ width: baseline.width, height: baseline.height, data: diffData }),
    dimensionMismatch: false,
    dimensions: {
      baseline: { width: baseline.width, height: baseline.height },
      candidate: { width: candidate.width, height: candidate.height }
    }
  };
};

const paths = [...new Set([...filesUnder(baselineRoot), ...filesUnder(candidateRoot)])]
  .filter((path) => path.toLowerCase().endsWith(".png"))
  .sort();
const failures = [];
const surfaces = paths.map((path) => {
  const baselinePath = join(baselineRoot, path);
  const candidatePath = join(candidateRoot, path);
  const baselinePresent = existsSync(baselinePath);
  const candidatePresent = existsSync(candidatePath);
  const surface = {
    path,
    role: parseRole(path),
    viewport: parseViewport(path),
    state: parseState(path),
    base_sha: baseSha,
    head_sha: headSha,
    baseline_present: baselinePresent,
    candidate_present: candidatePresent,
    baseline_sha256: baselinePresent ? digest(baselineRoot, path) : null,
    candidate_sha256: candidatePresent ? digest(candidateRoot, path) : null,
    diff_path: null,
    diff_sha256: null,
    diff_pixel_ratio: null,
    dimensions: null,
    dimension_mismatch: false,
    failure_reason: null,
    status: "not_ready"
  };
  if (!baselinePresent || !candidatePresent) {
    failures.push(`${path}: missing ${!baselinePresent ? "baseline" : "candidate"} file`);
    return surface;
  }

  try {
    const comparison = comparePng(readFileSync(baselinePath), readFileSync(candidatePath));
    surface.diff_pixel_ratio = Number(comparison.ratio.toFixed(8));
    surface.dimensions = comparison.dimensions;
    surface.dimension_mismatch = comparison.dimensionMismatch;
    if (comparison.dimensionMismatch) {
      surface.status = "failed";
      failures.push(
        `${path}: dimensions mismatch baseline ${comparison.dimensions.baseline.width}x${comparison.dimensions.baseline.height} vs candidate ${comparison.dimensions.candidate.width}x${comparison.dimensions.candidate.height}`
      );
      return surface;
    }
    if (comparison.ratio > 0) {
      const diffPath = resolve(diffRoot, path);
      mkdirSync(dirname(diffPath), { recursive: true });
      if (comparison.diff) {
        writeFileSync(diffPath, comparison.diff);
        surface.diff_path = relativeManifestPath(diffPath);
        surface.diff_sha256 = createHash("sha256").update(comparison.diff).digest("hex");
      }
      if (comparison.ratio > maxDiffPixelRatio) {
        surface.status = "failed";
        failures.push(`${path}: diff ratio ${comparison.ratio} > ${maxDiffPixelRatio}`);
      } else {
        surface.status = "passed";
      }
    } else {
      surface.status = "passed";
    }
  } catch (error) {
    surface.status = "failed";
    surface.failure_reason = "decode_error";
    failures.push(
      `${path}: PNG decode/compare failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  return surface;
});

const allCompared = surfaces.length > 0 && surfaces.every((surface) => surface.status === "passed");
const missingOrInvalid = surfaces.some((surface) => surface.status === "not_ready");
const provenanceReady = Boolean(
  baseSha && headSha && actualSha && headSha === actualSha && clean === true
);
const comparisonReady = Boolean(
  baseSha && headSha && actualSha && headSha === actualSha && (clean === true || allowDirty)
);
const status =
  !comparisonReady || missingOrInvalid || surfaces.length === 0
    ? "not_ready"
    : allCompared
      ? "passed"
      : "failed";
if (!provenanceReady && headSha && actualSha && headSha !== actualSha) {
  failures.push(`head SHA ${headSha} does not match actual checked-out SHA ${actualSha}`);
}
if (!baseSha || !headSha) failures.push("BASE/HEAD SHA provenance is required");
if (clean !== true) failures.push("visual evidence requires a clean checked-out worktree");

const manifest = {
  schema_version: 2,
  status,
  ready_for_review: status === "passed" && provenanceReady,
  base_sha: baseSha,
  head_sha: headSha,
  actual_sha: actualSha,
  branch,
  clean,
  baseline_root: baselineRoot,
  candidate_root: candidateRoot,
  diff_root: diffRoot,
  threshold: { max_diff_pixel_ratio: maxDiffPixelRatio },
  automatic_threshold: {
    max_diff_pixel_ratio: maxDiffPixelRatio,
    enforced: provenanceReady && !missingOrInvalid && surfaces.length > 0
  },
  acceptance_ready: status === "passed" && provenanceReady,
  dirty_override: allowDirty,
  pixel_diff: {
    status: status === "passed" ? "passed" : status === "failed" ? "failed" : "not_ready",
    compared_pairs: surfaces.filter(
      (surface) => surface.status === "passed" || surface.status === "failed"
    ).length,
    max_diff_pixel_ratio: maxDiffPixelRatio,
    failures
  },
  dialog_drawer: "N/A: no dialog or drawer is implemented by these surfaces.",
  surfaces
};
const serialized = JSON.stringify(manifest, null, 2);
if (outputPath) {
  mkdirSync(dirname(resolve(outputPath)), { recursive: true });
  writeFileSync(resolve(outputPath), `${serialized}\n`);
} else {
  console.log(serialized);
}
if (status !== "passed") process.exitCode = 1;
