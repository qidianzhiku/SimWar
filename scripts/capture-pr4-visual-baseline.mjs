import { createHash } from "node:crypto";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync
} from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import net from "node:net";
import { tmpdir } from "node:os";
import { dirname, basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Capture the independent PR4 visual baseline from an exact, clean BASE
 * checkout.  This file deliberately does not import the Playwright browser
 * until after CLI validation so that `--dry-run` remains useful on machines
 * without browser binaries.
 */

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_ROOT = resolve(dirname(SCRIPT_PATH), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

export const CAPTURE_MANIFEST_SCHEMA = "pr4-base-visual-capture.v1";
export const CAPTURE_RECEIPT_SCHEMA = "pr4-base-visual-receipt.v1";
export const VIEWPORTS = Object.freeze([
  Object.freeze({ width: 1440, height: 900 }),
  Object.freeze({ width: 1280, height: 800 }),
  Object.freeze({ width: 1024, height: 768 }),
  Object.freeze({ width: 390, height: 844 })
]);

const DEFAULT_PORTS = Object.freeze({
  api: 3100,
  admin: 3103,
  teacher: 3101,
  student: 3102,
  lab: 3004
});

const SURFACES = Object.freeze([
  Object.freeze({
    key: "admin",
    portKey: "admin",
    hash: "#admin-tenants-entitlements",
    prefix: "admin-admin-tenants-entitlements-ready",
    username: "admin",
    password: "admin",
    loginLabel: "管理员登录",
    statusLabel: "当前权限边界"
  }),
  Object.freeze({
    key: "enterprise",
    portKey: "admin",
    hash: "#admin-enterprise-course-factory",
    prefix: "enterprise-admin-enterprise-course-factory-ready",
    username: null,
    password: null,
    loginLabel: null,
    statusLabel: null
  }),
  Object.freeze({
    key: "teacher",
    portKey: "teacher",
    hash: "#teacher-blockers",
    prefix: "teacher-teacher-blockers-ready",
    username: "teacher",
    password: "teacher",
    loginLabel: "教师登录",
    statusLabel: "当前权限边界"
  }),
  Object.freeze({
    key: "student",
    portKey: "student",
    hash: "#student-cockpit",
    prefix: "student-student-cockpit-ready",
    username: "student",
    password: "student",
    loginLabel: "学员登录",
    statusLabel: "learner status"
  }),
  Object.freeze({
    key: "lab",
    portKey: "lab",
    hash: "#sw-lab-actions",
    prefix: "lab-lab-state-matrix-state-matrix",
    username: null,
    password: null,
    loginLabel: null,
    statusLabel: null
  })
]);

function fileName(prefix, viewport) {
  return `${prefix}-${viewport.width}x${viewport.height}.png`;
}

export function buildCapturePlan() {
  return SURFACES.flatMap((surface) =>
    VIEWPORTS.map((viewport) => ({
      name: fileName(surface.prefix, viewport),
      surface: surface.key,
      route: surface.hash,
      state: surface.key === "lab" ? "state-matrix" : "ready",
      viewport: { ...viewport },
      full_page: false,
      scroll_y: 0,
      mouse: { x: 0, y: 0 }
    }))
  );
}

export const CAPTURE_PLAN = Object.freeze(buildCapturePlan());
export const EXPECTED_CAPTURE_NAMES = Object.freeze(CAPTURE_PLAN.map((entry) => entry.name).sort());

function usage() {
  return [
    "Usage: node scripts/capture-pr4-visual-baseline.mjs --source-root <absolute-base-checkout> --output <absolute-external-evidence-root> --expected-sha <40-char-sha> [options]",
    "Options:",
    "  --api-port <port>       API port (default 3100)",
    "  --admin-port <port>     Admin port (default 3103)",
    "  --teacher-port <port>   Teacher port (default 3101)",
    "  --student-port <port>   Student port (default 3102)",
    "  --lab-port <port>       DesignSystemLab port (default 3004)",
    "  --store <absolute-file>  External controlled Playwright store path",
    "  --dry-run               Validate provenance and emit the capture plan without starting servers",
    "  --help                  Show this help"
  ].join("\n");
}

function valueFor(argv, names, index) {
  const nameSet = new Set(names);
  if (!nameSet.has(argv[index])) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${argv[index]} requires a value.`);
  }
  return value;
}

function parsePort(name, value) {
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a decimal TCP port.`);
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be between 1 and 65535.`);
  }
  return port;
}

function portFlag(argv, index, key) {
  const value = valueFor(argv, [`--${key}-port`, `--port-${key}`], index);
  if (value !== null) return { value: parsePort(`--${key}-port`, value), consumed: 1 };
  return null;
}

export function parseCaptureArgs(argv = process.argv.slice(2), environment = process.env) {
  const values = {
    sourceRoot: null,
    outputRoot: null,
    expectedSha: null,
    storeFile: null,
    dryRun: false,
    candidateSha: null,
    ports: { ...DEFAULT_PORTS }
  };
  let help = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      help = true;
      continue;
    }
    if (argument === "--dry-run") {
      values.dryRun = true;
      continue;
    }
    const source = valueFor(argv, ["--source-root", "--source"], index);
    if (source !== null) {
      values.sourceRoot = source;
      index += 1;
      continue;
    }
    const output = valueFor(argv, ["--output", "--evidence-root"], index);
    if (output !== null) {
      values.outputRoot = output;
      index += 1;
      continue;
    }
    const expected = valueFor(argv, ["--expected-sha", "--base-sha"], index);
    if (expected !== null) {
      values.expectedSha = expected;
      index += 1;
      continue;
    }
    const store = valueFor(
      argv,
      ["--store", "--store-file", "--store-path", "--playwright-store"],
      index
    );
    if (store !== null) {
      values.storeFile = store;
      index += 1;
      continue;
    }
    const candidateSha = valueFor(argv, ["--candidate-sha", "--head-sha"], index);
    if (candidateSha !== null) {
      values.candidateSha = candidateSha;
      index += 1;
      continue;
    }
    let matchedPort = false;
    for (const key of Object.keys(DEFAULT_PORTS)) {
      const parsed = portFlag(argv, index, key);
      if (!parsed) continue;
      values.ports[key] = parsed.value;
      index += parsed.consumed;
      matchedPort = true;
      break;
    }
    if (matchedPort) continue;
    if (argument?.startsWith("--")) throw new Error(`Unknown option ${argument}.`);
    throw new Error(`Unexpected positional argument ${argument ?? ""}.`);
  }

  const sourceRoot = values.sourceRoot ?? environment.PR4_SOURCE_ROOT ?? null;
  const outputRoot =
    values.outputRoot ?? environment.PR4_OUTPUT_ROOT ?? environment.PR4_EVIDENCE_ROOT ?? null;
  const expectedSha =
    values.expectedSha ?? environment.PR4_BASE_SHA ?? environment.PR4_EXPECTED_SHA ?? null;
  const candidateSha =
    values.candidateSha ?? environment.PR4_HEAD_SHA ?? environment.GITHUB_SHA ?? null;
  const storeFile =
    values.storeFile ??
    environment.SIMWAR_PLAYWRIGHT_STORE_FILE ??
    environment.SIMWAR_STORE_FILE ??
    null;
  const configuredPort = (key) => {
    const upper = key.toUpperCase();
    const environmentValue =
      environment[`SIMWAR_PLAYWRIGHT_${upper}_PORT`] ??
      environment[`PR4_${upper}_PORT`] ??
      environment[`PORT_${upper}`] ??
      null;
    return environmentValue ? parsePort(`${key} port`, environmentValue) : values.ports[key];
  };
  const ports = {
    api: configuredPort("api"),
    admin: configuredPort("admin"),
    teacher: configuredPort("teacher"),
    student: configuredPort("student"),
    lab: configuredPort("lab")
  };
  if (new Set(Object.values(ports)).size !== Object.values(ports).length) {
    throw new Error("API, Admin, Teacher, Student, and Lab ports must be unique.");
  }
  return { ...values, sourceRoot, outputRoot, expectedSha, candidateSha, storeFile, ports, help };
}

function canonicalPath(path) {
  let cursor = resolve(path);
  const suffix = [];
  while (!existsSync(cursor)) {
    const parent = dirname(cursor);
    if (parent === cursor) break;
    suffix.unshift(basename(cursor));
    cursor = parent;
  }
  const existing = existsSync(cursor) ? realpathSync(cursor) : cursor;
  return resolve(existing, ...suffix);
}

function assertAbsolute(raw, label) {
  if (typeof raw !== "string" || !raw.trim()) throw new Error(`${label} is required.`);
  if (!isAbsolute(raw)) throw new Error(`${label} must be an absolute path.`);
}

function assertOutside(sourceRoot, target, label) {
  const source = canonicalPath(sourceRoot);
  const destination = canonicalPath(target);
  const pathFromSource = relative(source, destination);
  if (
    pathFromSource === "" ||
    (!isAbsolute(pathFromSource) &&
      pathFromSource !== ".." &&
      !pathFromSource.startsWith(`..${sep}`))
  ) {
    throw new Error(`${label} must be outside the source checkout.`);
  }
}

function assertSha(value, label) {
  if (!value || !/^[0-9a-f]{40}$/i.test(value)) {
    throw new Error(`${label} must be a 40-character hexadecimal commit SHA.`);
  }
}

function gitValue(sourceRoot, args) {
  try {
    return execFileSync("git", ["-C", sourceRoot, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch (error) {
    throw new Error(
      `Unable to inspect source checkout with git ${args.join(" ")}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function gitSnapshot(sourceRoot) {
  const sha = gitValue(sourceRoot, ["rev-parse", "HEAD"]);
  const status = gitValue(sourceRoot, ["status", "--porcelain=v1"]);
  let branch = "";
  try {
    branch = gitValue(sourceRoot, ["symbolic-ref", "--short", "HEAD"]);
  } catch {
    branch = "";
  }
  return { sha, status, clean: status === "", branch, detached: branch === "" };
}

function candidateSnapshot() {
  try {
    const sha = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: SCRIPT_ROOT,
      encoding: "utf8"
    }).trim();
    const status = execFileSync("git", ["status", "--porcelain=v1"], {
      cwd: SCRIPT_ROOT,
      encoding: "utf8"
    }).trim();
    return { sha, status, clean: status === "" };
  } catch {
    return { sha: null, status: null, clean: null };
  }
}

function defaultStoreFile(expectedSha) {
  const mission = `pr4-${expectedSha.slice(0, 12)}-${Date.now()}-${process.pid}`;
  return join(tmpdir(), "simwar-playwright", mission, "playwright-store.json");
}

export function validateCaptureConfig(parsed) {
  assertAbsolute(parsed.sourceRoot, "--source-root");
  assertAbsolute(parsed.outputRoot, "--output");
  assertSha(parsed.expectedSha, "--expected-sha");
  if (parsed.candidateSha) assertSha(parsed.candidateSha, "--candidate-sha");
  const sourceRoot = canonicalPath(parsed.sourceRoot);
  if (!existsSync(sourceRoot) || !statSync(sourceRoot).isDirectory()) {
    throw new Error(`Source checkout does not exist or is not a directory: ${sourceRoot}`);
  }
  if (!existsSync(join(sourceRoot, "package.json"))) {
    throw new Error(`Source checkout is missing package.json: ${sourceRoot}`);
  }
  const outputRoot = resolve(parsed.outputRoot);
  if (existsSync(outputRoot) && !statSync(outputRoot).isDirectory()) {
    throw new Error(`--output must point to a directory: ${outputRoot}`);
  }
  assertOutside(sourceRoot, outputRoot, "--output");
  const storeFile = resolve(parsed.storeFile ?? defaultStoreFile(parsed.expectedSha));
  assertAbsolute(parsed.storeFile ?? storeFile, "--store");
  assertOutside(sourceRoot, storeFile, "--store");
  const source = gitSnapshot(sourceRoot);
  if (source.sha.toLowerCase() !== parsed.expectedSha.toLowerCase()) {
    throw new Error(`Source SHA mismatch: expected ${parsed.expectedSha}, actual ${source.sha}.`);
  }
  if (!source.clean)
    throw new Error(`Source checkout must be clean before capture:\n${source.status}`);
  const candidateBefore = candidateSnapshot();
  if (parsed.candidateSha) {
    if (
      !candidateBefore.sha ||
      candidateBefore.sha.toLowerCase() !== parsed.candidateSha.toLowerCase()
    ) {
      throw new Error(
        `Candidate SHA mismatch: expected ${parsed.candidateSha}, actual ${candidateBefore.sha ?? "unavailable"}.`
      );
    }
    if (!candidateBefore.clean) {
      throw new Error("Candidate checkout must be clean when --candidate-sha is supplied.");
    }
  }
  return {
    ...parsed,
    sourceRoot,
    outputRoot,
    storeFile,
    sourceBefore: source,
    candidateBefore
  };
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function pngDimensions(buffer) {
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function wait(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function portAvailable(port) {
  return new Promise((resolvePromise) => {
    const server = net.createServer();
    let settled = false;
    const done = (available) => {
      if (settled) return;
      settled = true;
      server.removeListener("error", onError);
      if (server.listening) {
        server.close(() => resolvePromise(available));
      } else {
        resolvePromise(available);
      }
    };
    const onError = () => done(false);
    server.once("error", onError);
    server.listen({ port, host: "127.0.0.1" }, () => done(true));
  });
}

async function occupiedPorts(ports) {
  const entries = [];
  for (const [name, port] of Object.entries(ports)) {
    if (!(await portAvailable(port))) entries.push({ name, port });
  }
  return entries;
}

function startServer(label, args, cwd, environment, logDir, children, logLines) {
  const logPath = join(logDir, `${label}.log`);
  const logStream = createWriteStream(logPath, { flags: "w" });
  const child = spawn(npmCommand, args, {
    cwd,
    env: { ...process.env, ...environment },
    windowsHide: true,
    shell: process.platform === "win32",
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout?.pipe(logStream, { end: false });
  child.stderr?.pipe(logStream, { end: false });
  const record = { child, label, logPath, logStream, spawnError: null };
  child.once("error", (error) => {
    record.spawnError = error;
  });
  children.push(record);
  logLines.push(`started ${label} pid=${child.pid ?? "unknown"} log=${logPath}`);
  return record;
}

async function stopOwnedServers(children, logLines) {
  for (const record of [...children].reverse()) {
    const { child, label, logStream } = record;
    if (child.pid && process.platform === "win32") {
      try {
        execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      } catch {
        // The owned process may have exited already.
      }
    } else if (child.pid && child.exitCode === null) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        try {
          child.kill("SIGTERM");
        } catch {
          // The owned process may have exited already.
        }
      }
    }
    await wait(100);
    logLines.push(`stopped ${label} pid=${child.pid ?? "unknown"}`);
    logStream.end();
  }
  children.length = 0;
}

async function waitForHttp(url, record, timeoutMs = 180_000) {
  const startedAt = Date.now();
  let lastError = "not attempted";
  while (Date.now() - startedAt < timeoutMs) {
    if (record.spawnError) {
      throw new Error(`${record.label} failed to start: ${record.spawnError.message}`);
    }
    if (record.child.exitCode !== null && record.child.exitCode !== 0) {
      throw new Error(
        `${record.label} exited with code ${record.child.exitCode} while waiting for ${url}.`
      );
    }
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await wait(500);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

async function waitForCaptureStable(page) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolvePromise) => {
      let lastMutation = performance.now();
      let quietFrames = 0;
      const deadline = lastMutation + 1_500;
      const observer = new MutationObserver(() => {
        lastMutation = performance.now();
        quietFrames = 0;
      });
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true
      });
      const check = () => {
        const quiet = performance.now() - lastMutation >= 75;
        quietFrames = quiet ? quietFrames + 1 : 0;
        if (quietFrames >= 3 || performance.now() >= deadline) {
          observer.disconnect();
          resolvePromise();
          return;
        }
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
  });
}

async function setHash(page, hash) {
  await page.evaluate((nextHash) => {
    window.location.hash = nextHash;
    window.scrollTo({ left: 0, top: 0, behavior: "auto" });
  }, hash);
  await page.waitForTimeout(80);
  await waitForCaptureStable(page);
}

async function signIn(page, surface) {
  const config = SURFACES.find((entry) => entry.key === surface);
  if (!config?.username || !config.password || !config.loginLabel || !config.statusLabel) {
    throw new Error(`No sign-in contract configured for ${surface}.`);
  }
  await page.getByLabel("tenant").fill("tenant_demo");
  await page.getByLabel("username").fill(config.username);
  await page.getByLabel("password").fill(config.password);
  await page.getByRole("button", { name: config.loginLabel }).click();
  await page.getByLabel(config.statusLabel).waitFor({ state: "visible", timeout: 20_000 });
  await waitForCaptureStable(page);
}

async function captureScreenshot(page, outputPath, viewport) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.scrollTo({ left: 0, top: 0, behavior: "auto" }));
  await waitForCaptureStable(page);
  const actualViewport = page.viewportSize();
  if (
    !actualViewport ||
    actualViewport.width !== viewport.width ||
    actualViewport.height !== viewport.height
  ) {
    throw new Error(`Viewport mismatch before ${basename(outputPath)}.`);
  }
  await page.screenshot({ path: outputPath, fullPage: false });
  const dimensions = pngDimensions(readFileSync(outputPath));
  if (!dimensions || dimensions.width !== viewport.width || dimensions.height !== viewport.height) {
    throw new Error(
      `Screenshot dimensions for ${basename(outputPath)} were ${dimensions ? `${dimensions.width}x${dimensions.height}` : "not a PNG"}; expected ${viewport.width}x${viewport.height}.`
    );
  }
}

async function captureRole(browser, config, ports, candidateDir, logLines) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  try {
    await page.goto(`http://127.0.0.1:${ports[config.portKey]}`, { waitUntil: "domcontentloaded" });
    await signIn(page, config.key);
    await setHash(page, config.hash);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      const outputPath = join(candidateDir, fileName(config.prefix, viewport));
      await captureScreenshot(page, outputPath, viewport);
      logLines.push(`captured ${basename(outputPath)} bytes=${statSync(outputPath).size}`);
    }
  } finally {
    await context.close();
  }
}

async function captureAdmin(browser, ports, candidateDir, logLines) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  try {
    await page.goto(`http://127.0.0.1:${ports.admin}`, { waitUntil: "domcontentloaded" });
    await signIn(page, "admin");
    for (const config of SURFACES.filter(
      (entry) => entry.key === "admin" || entry.key === "enterprise"
    )) {
      await setHash(page, config.hash);
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        const outputPath = join(candidateDir, fileName(config.prefix, viewport));
        await captureScreenshot(page, outputPath, viewport);
        logLines.push(`captured ${basename(outputPath)} bytes=${statSync(outputPath).size}`);
      }
    }
  } finally {
    await context.close();
  }
}

async function captureLab(browser, ports, candidateDir, logLines) {
  const config = SURFACES.find((entry) => entry.key === "lab");
  if (!config) throw new Error("Lab capture contract is missing.");
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  try {
    await page.goto(`http://127.0.0.1:${ports.lab}`, { waitUntil: "domcontentloaded" });
    await page
      .getByRole("heading", { name: "组件画廊", exact: true })
      .waitFor({ state: "visible" });
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await setHash(page, config.hash);
      await page
        .getByRole("heading", { name: "动作与回执", exact: true })
        .waitFor({ state: "visible" });
      const outputPath = join(candidateDir, fileName(config.prefix, viewport));
      await captureScreenshot(page, outputPath, viewport);
      logLines.push(`captured ${basename(outputPath)} bytes=${statSync(outputPath).size}`);
    }
  } finally {
    await context.close();
  }
}

function inventory(candidateDir) {
  if (!existsSync(candidateDir)) return [];
  return readdirSync(candidateDir)
    .filter((name) => name.toLowerCase().endsWith(".png"))
    .sort()
    .map((name) => {
      const plan = CAPTURE_PLAN.find((entry) => entry.name === name);
      const path = join(candidateDir, name);
      return {
        name,
        bytes: statSync(path).size,
        sha256: sha256File(path),
        surface: plan?.surface ?? null,
        state: plan?.state ?? null,
        viewport: plan?.viewport ?? null,
        full_page: false,
        scroll_y: 0,
        mouse: { x: 0, y: 0 }
      };
    });
}

function stringifyError(error) {
  return error instanceof Error
    ? `${error.name}: ${error.message}\n${error.stack ?? ""}`
    : String(error);
}

function writeArtifacts(config, data) {
  const outputRoot = config.outputRoot;
  const candidateDir = join(outputRoot, "candidate");
  const harnessSha = sha256File(SCRIPT_PATH);
  mkdirSync(outputRoot, { recursive: true });
  mkdirSync(candidateDir, { recursive: true });
  mkdirSync(join(outputRoot, "logs"), { recursive: true });
  writeFileSync(join(outputRoot, "capture.log"), `${data.logLines.join("\n")}\n`);

  const actualNames = data.files.map((entry) => entry.name).sort();
  const exactNames = JSON.stringify(actualNames) === JSON.stringify(EXPECTED_CAPTURE_NAMES);
  const sourceAfter = data.sourceAfter ?? data.sourceBefore;
  const portsAfter = data.portsAfter ?? [];
  const captureStatus = config.dryRun
    ? "DRY_RUN"
    : data.captureError ||
        sourceAfter.sha !== config.expectedSha ||
        !sourceAfter.clean ||
        portsAfter.length ||
        !exactNames
      ? "FAIL"
      : "CAPTURED_BASE_NOT_COMPARATOR_PASS";
  const manifest = {
    schema_version: CAPTURE_MANIFEST_SCHEMA,
    baseline_kind: "independent exact-base checkout",
    status: captureStatus,
    dry_run: config.dryRun,
    base_sha: config.expectedSha,
    candidate_head_sha: config.candidateBefore.sha,
    actual_source_sha_before: data.sourceBefore.sha,
    actual_source_sha_after: sourceAfter.sha,
    tracked_clean_before: data.sourceBefore.clean,
    tracked_clean_after: sourceAfter.clean,
    detached_source_before: data.sourceBefore.detached,
    detached_source_after: sourceAfter.detached,
    ports_before: data.portsBefore,
    ports_after: portsAfter,
    evidence_root: outputRoot,
    candidate_directory: candidateDir,
    harness_path: SCRIPT_PATH,
    harness_sha256: harnessSha,
    store_file: config.storeFile,
    expected_pair_count: EXPECTED_CAPTURE_NAMES.length,
    actual_pair_count: data.files.length,
    expected_names: EXPECTED_CAPTURE_NAMES,
    actual_names: actualNames,
    exact_expected_names: exactNames,
    viewports: VIEWPORTS,
    capture_plan: CAPTURE_PLAN,
    files: data.files,
    capture_error: data.captureError,
    limitations: [
      "BASE capture intentionally does not enforce PR4 Axe, target-size, overflow, or performance gates.",
      "This receipt proves capture provenance only; it does not claim visual comparator PASS.",
      "The harness uses a dedicated external Playwright store and does not write product-state files in the source checkout."
    ]
  };
  writeFileSync(join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  const receipt = {
    schema_version: CAPTURE_RECEIPT_SCHEMA,
    status: captureStatus,
    source_sha: sourceAfter.sha,
    required_source_sha: config.expectedSha,
    candidate_head_sha: config.candidateBefore.sha,
    tracked_clean_before: data.sourceBefore.clean,
    tracked_clean_after: sourceAfter.clean,
    ports_before: data.portsBefore,
    ports_after: portsAfter,
    evidence_root: outputRoot,
    harness_path: SCRIPT_PATH,
    harness_sha256: harnessSha,
    store_file: config.storeFile,
    expected_pair_count: EXPECTED_CAPTURE_NAMES.length,
    actual_pair_count: data.files.length,
    exact_expected_names: exactNames,
    capture_error: data.captureError,
    note: "No PASS claim is made for the visual diff. Parent must run the comparator against independent BASE and candidate roots."
  };
  writeFileSync(join(outputRoot, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  return { manifest, receipt };
}

async function executeCapture(parsed) {
  const config = validateCaptureConfig(parsed);
  const candidateDir = join(config.outputRoot, "candidate");
  const logDir = join(config.outputRoot, "logs");
  mkdirSync(config.outputRoot, { recursive: true });
  mkdirSync(candidateDir, { recursive: true });
  mkdirSync(logDir, { recursive: true });
  mkdirSync(dirname(config.storeFile), { recursive: true });
  const logLines = [];
  const portsBefore = config.dryRun ? [] : await occupiedPorts(config.ports);
  if (portsBefore.length > 0) {
    throw new Error(
      `Required capture ports are occupied before capture: ${JSON.stringify(portsBefore)}`
    );
  }
  const data = {
    sourceBefore: config.sourceBefore,
    sourceAfter: null,
    portsBefore,
    portsAfter: [],
    files: [],
    captureError: null,
    logLines
  };
  if (config.dryRun) {
    const artifacts = writeArtifacts(config, data);
    return { exitCode: 0, ...artifacts };
  }

  const children = [];
  const apiEnvironment = {
    API_PORT: String(config.ports.api),
    API_HOST: "127.0.0.1",
    INTERNAL_SERVICE_TOKEN: "playwright-internal-service-token",
    JWT_SECRET: "playwright-jwt-secret-with-sufficient-length",
    SIMWAR_ENV: "test",
    SIMWAR_PLAYWRIGHT_STORE_FILE: config.storeFile,
    SIMWAR_STORE_FILE: config.storeFile
  };
  const uiEnvironment = { VITE_API_BASE_URL: `http://127.0.0.1:${config.ports.api}` };
  try {
    const api = startServer(
      "api",
      ["run", "dev", "-w", "@simwar/api"],
      config.sourceRoot,
      apiEnvironment,
      logDir,
      children,
      logLines
    );
    await waitForHttp(`http://127.0.0.1:${config.ports.api}/healthz`, api);
    const admin = startServer(
      "admin",
      [
        "run",
        "dev",
        "-w",
        "@simwar/admin",
        "--",
        "--host",
        "127.0.0.1",
        "--port",
        String(config.ports.admin)
      ],
      config.sourceRoot,
      uiEnvironment,
      logDir,
      children,
      logLines
    );
    await waitForHttp(`http://127.0.0.1:${config.ports.admin}`, admin);
    const teacher = startServer(
      "teacher",
      [
        "run",
        "dev",
        "-w",
        "@simwar/teacher",
        "--",
        "--host",
        "127.0.0.1",
        "--port",
        String(config.ports.teacher)
      ],
      config.sourceRoot,
      uiEnvironment,
      logDir,
      children,
      logLines
    );
    await waitForHttp(`http://127.0.0.1:${config.ports.teacher}`, teacher);
    const student = startServer(
      "student",
      [
        "run",
        "dev",
        "-w",
        "@simwar/student",
        "--",
        "--host",
        "127.0.0.1",
        "--port",
        String(config.ports.student)
      ],
      config.sourceRoot,
      uiEnvironment,
      logDir,
      children,
      logLines
    );
    await waitForHttp(`http://127.0.0.1:${config.ports.student}`, student);
    const lab = startServer(
      "lab",
      [
        "run",
        "dev:lab",
        "-w",
        "@simwar/ui",
        "--",
        "--host",
        "127.0.0.1",
        "--port",
        String(config.ports.lab)
      ],
      config.sourceRoot,
      {},
      logDir,
      children,
      logLines
    );
    await waitForHttp(`http://127.0.0.1:${config.ports.lab}`, lab);

    const requirePlaywright = createRequire(SCRIPT_PATH);
    const { chromium } = requirePlaywright("@playwright/test");
    const browser = await chromium.launch({ headless: true });
    try {
      await captureAdmin(browser, config.ports, candidateDir, logLines);
      await captureRole(
        browser,
        SURFACES.find((entry) => entry.key === "teacher"),
        config.ports,
        candidateDir,
        logLines
      );
      await captureRole(
        browser,
        SURFACES.find((entry) => entry.key === "student"),
        config.ports,
        candidateDir,
        logLines
      );
      await captureLab(browser, config.ports, candidateDir, logLines);
    } finally {
      await browser.close();
    }
  } catch (error) {
    data.captureError = stringifyError(error);
    logLines.push(`capture failed: ${data.captureError}`);
  } finally {
    await stopOwnedServers(children, logLines);
  }

  data.sourceAfter = gitSnapshot(config.sourceRoot);
  data.portsAfter = await occupiedPorts(config.ports);
  data.files = inventory(candidateDir);
  const artifacts = writeArtifacts(config, data);
  return {
    exitCode: artifacts.receipt.status === "CAPTURED_BASE_NOT_COMPARATOR_PASS" ? 0 : 1,
    ...artifacts
  };
}

export async function runCaptureCli(argv = process.argv.slice(2), environment = process.env) {
  try {
    const parsed = parseCaptureArgs(argv, environment);
    if (parsed.help) {
      console.log(usage());
      return 0;
    }
    const result = await executeCapture(parsed);
    return result.exitCode;
  } catch (error) {
    console.error(
      `capture-pr4-visual-baseline: ${error instanceof Error ? error.message : String(error)}`
    );
    console.error(usage());
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(SCRIPT_PATH)) {
  process.exitCode = await runCaptureCli();
}
