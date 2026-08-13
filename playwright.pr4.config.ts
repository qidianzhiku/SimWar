import { defineConfig } from "@playwright/test";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const evidenceRoot = process.env.PR4_EVIDENCE_ROOT;
const storeFile = process.env.SIMWAR_PLAYWRIGHT_STORE_FILE;
const baseSha = process.env.PR4_BASE_SHA;
const headSha = process.env.PR4_HEAD_SHA;
if (!evidenceRoot) {
  throw new Error("PR4_EVIDENCE_ROOT is required for focused PR4 browser evidence.");
}
if (!baseSha || !/^[0-9a-f]{40}$/i.test(baseSha)) {
  throw new Error("PR4_BASE_SHA must be a 40-character hexadecimal commit SHA.");
}
if (!headSha || !/^[0-9a-f]{40}$/i.test(headSha)) {
  throw new Error("PR4_HEAD_SHA must be a 40-character hexadecimal commit SHA.");
}
let actualSha: string;
try {
  actualSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
} catch {
  throw new Error("Unable to resolve the checked-out PR4 HEAD SHA.");
}
if (headSha.toLowerCase() !== actualSha.toLowerCase()) {
  throw new Error(`PR4_HEAD_SHA must match actual checked-out HEAD (${headSha} vs ${actualSha}).`);
}
const allowDirtyEvidence = process.env.PR4_ALLOW_DIRTY_EVIDENCE === "true";
const dirtyWorktree = (() => {
  try {
    return execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim() !== "";
  } catch {
    return true;
  }
})();
if (dirtyWorktree && !allowDirtyEvidence) {
  throw new Error(
    "Focused PR4 browser evidence requires a clean checkout; set PR4_ALLOW_DIRTY_EVIDENCE=true only for non-acceptance local debugging."
  );
}
if (!isAbsolute(evidenceRoot)) {
  throw new Error("PR4_EVIDENCE_ROOT must be an absolute external path.");
}
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const resolvedEvidenceRoot = resolve(evidenceRoot);
const evidenceRelativeToRepo = relative(repoRoot, resolvedEvidenceRoot);
if (
  resolvedEvidenceRoot === repoRoot ||
  (!isAbsolute(evidenceRelativeToRepo) &&
    !evidenceRelativeToRepo.startsWith(`..${sep}`) &&
    evidenceRelativeToRepo !== "..")
) {
  throw new Error("PR4_EVIDENCE_ROOT must be outside the product repository.");
}
if (!storeFile || !isAbsolute(storeFile)) {
  throw new Error("SIMWAR_PLAYWRIGHT_STORE_FILE must be an absolute external temporary path.");
}
const resolvedStoreFile = resolve(storeFile);
const designSystemLab = {
  port: 3004,
  command: "npm run dev:lab -w @simwar/ui"
} as const;
const controlledStoreRoot = resolve(tmpdir(), "simwar-playwright");
const storeRelative = resolvedStoreFile.slice(
  `${controlledStoreRoot}${process.platform === "win32" ? "\\" : "/"}`.length
);
if (
  !resolvedStoreFile.startsWith(
    `${controlledStoreRoot}${process.platform === "win32" ? "\\" : "/"}`
  ) ||
  !/^pr4-[a-zA-Z0-9-]+[\\/]playwright-store\.json$/.test(storeRelative)
) {
  throw new Error(
    `SIMWAR_PLAYWRIGHT_STORE_FILE must be inside ${controlledStoreRoot}/pr4-<id>/playwright-store.json`
  );
}

const { default: baseConfig } = await import("./playwright.config");
const labBaseUrl = `http://127.0.0.1:${designSystemLab.port}`;

export default defineConfig({
  ...baseConfig,
  testMatch: /pr4-.*\.spec\.ts/,
  testIgnore: [],
  outputDir: resolve(resolvedEvidenceRoot, "test-results"),
  reporter: process.env.CI
    ? [
        ["github"],
        ["html", { open: "never", outputFolder: resolve(resolvedEvidenceRoot, "report") }],
        ["junit", { outputFile: resolve(resolvedEvidenceRoot, "playwright-junit.xml") }]
      ]
    : [["list"]],
  use: {
    ...baseConfig.use,
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  metadata: {
    designSystemLab
  },
  webServer: [
    ...(baseConfig.webServer ?? []),
    {
      command: designSystemLab.command,
      env: { PR4_EVIDENCE_ROOT: resolvedEvidenceRoot },
      reuseExistingServer: false,
      timeout: 180_000,
      url: labBaseUrl
    }
  ]
});
