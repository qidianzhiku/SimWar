#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  statSync,
  writeFileSync
} from "node:fs";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import { arch, platform, release, type } from "node:os";

const EXPERIMENT_ID = "O7-OBS-01";
const SCHEMA_VERSION = "simwar.o7_observability.v1";
const DEFAULT_MAX_LOG_BYTES = 1024 * 1024;
const DEFAULT_SNAPSHOT_INTERVAL_MS = 1000;

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(2);
};

const parseArguments = (argv) => {
  const separator = argv.indexOf("--");
  const optionArgs = separator === -1 ? argv : argv.slice(0, separator);
  const command = separator === -1 ? [] : argv.slice(separator + 1);
  const options = {
    evidenceRoot: null,
    role: "process",
    port: null,
    maxLogBytes: DEFAULT_MAX_LOG_BYTES,
    recordEnvironment: false,
    recordEvent: null,
    command
  };

  for (let index = 0; index < optionArgs.length; index += 1) {
    const arg = optionArgs[index];
    const value = () => {
      index += 1;
      if (index >= optionArgs.length) fail(`Missing value for ${arg}`);
      return optionArgs[index];
    };
    if (arg === "--evidence-root") options.evidenceRoot = value();
    else if (arg === "--role") options.role = value();
    else if (arg === "--port") options.port = Number(value());
    else if (arg === "--max-log-bytes") options.maxLogBytes = Number(value());
    else if (arg === "--record-environment") options.recordEnvironment = true;
    else if (arg === "--record-event") options.recordEvent = value();
    else fail(`Unknown option: ${arg}`);
  }

  if (!options.evidenceRoot) fail("--evidence-root is required");
  if (!/^[a-z0-9_-]+$/i.test(options.role)) fail("--role contains unsupported characters");
  if (
    options.port !== null &&
    (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535)
  ) {
    fail("--port must be an integer between 1 and 65535");
  }
  if (
    !Number.isInteger(options.maxLogBytes) ||
    options.maxLogBytes < 256 ||
    options.maxLogBytes > 16 * 1024 * 1024
  ) {
    fail("--max-log-bytes must be between 256 and 16777216");
  }
  return options;
};

const ensurePrivateEvidenceRoot = (requestedRoot) => {
  const repositoryRoot = realpathSync(resolve("."));
  const evidenceRoot = resolve(requestedRoot);
  const relationship = relative(repositoryRoot, evidenceRoot);
  if (
    relationship === "" ||
    (!relationship.startsWith(`..${sep}`) && relationship !== ".." && !isAbsolute(relationship))
  ) {
    fail("Evidence root must be outside the repository");
  }
  mkdirSync(evidenceRoot, { recursive: true });
  const canonicalRoot = realpathSync(evidenceRoot);
  const canonicalRelationship = relative(repositoryRoot, canonicalRoot);
  if (
    canonicalRelationship === "" ||
    (!canonicalRelationship.startsWith(`..${sep}`) &&
      canonicalRelationship !== ".." &&
      !isAbsolute(canonicalRelationship))
  ) {
    fail("Canonical evidence root resolves inside the repository");
  }
  return canonicalRoot;
};

const nowEvent = (eventType, extra = {}) => ({
  schema_version: SCHEMA_VERSION,
  experiment_id: EXPERIMENT_ID,
  event_type: eventType,
  wall_time_utc: new Date().toISOString(),
  monotonic_ns: process.hrtime.bigint().toString(),
  observer_pid: process.pid,
  observer_ppid: process.ppid,
  github_run_id: process.env.GITHUB_RUN_ID ?? null,
  github_run_attempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  github_job: process.env.GITHUB_JOB ?? null,
  product_base_sha: process.env.O7_OBS_PRODUCT_BASE_SHA ?? null,
  observed_head_sha: process.env.O7_OBSERVED_HEAD_SHA ?? process.env.GITHUB_SHA ?? null,
  api_wrapper_enabled: process.env.O7_OBS_ENABLE_API_WRAPPER === "true",
  ...extra
});

const appendJsonLine = (path, event) => {
  appendFileSync(path, `${JSON.stringify(event)}\n`, { encoding: "utf8" });
};

const redact = (input) =>
  input
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/\b(Authorization|Cookie|Set-Cookie)\s*:\s*[^\r\n]*/gi, "$1: [REDACTED]")
    .replace(/\b(token|secret|password|cookie|session)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/(https?:\/\/[^\s"'?]+)\?[^\s"']+/gi, "$1?[REDACTED_QUERY]")
    .replace(
      /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}\b/g,
      "[REDACTED_JWT]"
    );

class BoundedLog {
  constructor(path, maxBytes) {
    this.path = path;
    this.maxBytes = maxBytes;
    this.bytesWritten = 0;
    this.truncated = false;
    this.stream = createWriteStream(path, { flags: "a", encoding: "utf8" });
  }

  write(chunk) {
    if (this.bytesWritten >= this.maxBytes) return;
    let text = redact(String(chunk));
    const remaining = this.maxBytes - this.bytesWritten;
    let buffer = Buffer.from(text, "utf8");
    if (buffer.length > remaining) {
      buffer = buffer.subarray(0, remaining);
      this.truncated = true;
    }
    this.bytesWritten += buffer.length;
    this.stream.write(buffer);
  }

  close() {
    return new Promise((resolveClose) => this.stream.end(resolveClose));
  }
}

const sha256File = (path) => {
  if (!existsSync(path) || !statSync(path).isFile()) return null;
  const hash = createHash("sha256");
  const input = readFileSync(path);
  hash.update(input);
  return hash.digest("hex");
};

const readPackageVersion = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8")).version ?? null;
  } catch {
    return null;
  }
};

const npmVersion = () => {
  const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["--version"], {
    encoding: "utf8",
    windowsHide: true
  });
  return result.status === 0 ? result.stdout.trim() : null;
};

const writeEnvironment = (evidenceRoot) => {
  const repositoryRoot = resolve(".");
  const environment = {
    schema_version: SCHEMA_VERSION,
    experiment_id: EXPERIMENT_ID,
    recorded_at_utc: new Date().toISOString(),
    node_version: process.version,
    npm_version: npmVersion(),
    playwright_version: readPackageVersion(
      resolve(repositoryRoot, "node_modules/@playwright/test/package.json")
    ),
    tsx_version: readPackageVersion(resolve(repositoryRoot, "node_modules/tsx/package.json")),
    os_type: type(),
    os_release: release(),
    platform: platform(),
    architecture: arch(),
    github_run_id: process.env.GITHUB_RUN_ID ?? null,
    github_run_attempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    github_job: process.env.GITHUB_JOB ?? null,
    github_sha: process.env.GITHUB_SHA ?? null,
    product_base_sha: process.env.O7_OBS_PRODUCT_BASE_SHA ?? null,
    observed_head_sha: process.env.O7_OBSERVED_HEAD_SHA ?? process.env.GITHUB_SHA ?? null,
    package_lock_sha256: sha256File(resolve(repositoryRoot, "package-lock.json")),
    playwright_config_sha256: sha256File(resolve(repositoryRoot, "playwright.config.ts")),
    ci_workflow_sha256: sha256File(resolve(repositoryRoot, ".github/workflows/ci.yml")),
    environment_capture_policy: "ALLOWLIST_ONLY_NO_ENVIRONMENT_DUMP"
  };
  const contract = {
    schema_version: SCHEMA_VERSION,
    experiment_id: EXPERIMENT_ID,
    purpose:
      "Distinguish API/watch process exit or restart from a stable-lifecycle unresolved transport/context failure.",
    changed_factor: "PASSIVE_OBSERVABILITY_ONLY",
    product_content_changed: false,
    request_retry_added: false,
    child_restart_added: false,
    sleep_added: false,
    timeout_changed: false,
    keep_alive_changed: false,
    test_selection_or_order_changed: false,
    worker_retry_or_assertion_changed: false,
    package_or_lockfile_changed: false,
    internal_api_command_chain: "npm run dev:api -> @simwar/api dev -> tsx watch src/server.ts",
    log_root_policy: "OUTSIDE_REPOSITORY_REQUIRED",
    log_max_bytes_per_stream: DEFAULT_MAX_LOG_BYTES,
    privacy_policy: "REDACT_AUTHENTICATION_AND_QUERY_VALUES_NO_ENVIRONMENT_DUMP",
    observer_effect:
      "Child stdout/stderr are piped through one bounded redaction writer while being forwarded unchanged to the parent; process and port snapshots read procfs once per second on Linux.",
    activation_scope: "EXACT_TEST_E2E_UI_CORE_COMMAND_ONLY",
    causal_claim_limit: "ONE_OBSERVATION_IS_NOT_ROOT_CAUSE_PROOF"
  };
  writeFileSync(
    resolve(evidenceRoot, "environment.json"),
    `${JSON.stringify(environment, null, 2)}\n`,
    "utf8"
  );
  writeFileSync(
    resolve(evidenceRoot, "MEASUREMENT_CONTRACT.json"),
    `${JSON.stringify(contract, null, 2)}\n`,
    "utf8"
  );
};

const parseProcStatus = (pid) => {
  try {
    const status = readFileSync(`/proc/${pid}/status`, "utf8");
    const name = status.match(/^Name:\s+(.+)$/m)?.[1]?.trim() ?? "unknown";
    const ppid = Number(status.match(/^PPid:\s+(\d+)$/m)?.[1] ?? -1);
    return { pid: Number(pid), ppid, name };
  } catch {
    return null;
  }
};

const collectDescendants = (rootPid) => {
  if (process.platform !== "linux" || !existsSync("/proc")) {
    return { status: "NOT_SUPPORTED_ON_THIS_PLATFORM", processes: [] };
  }
  const all = readdirSync("/proc")
    .filter((name) => /^\d+$/.test(name))
    .map(parseProcStatus)
    .filter(Boolean);
  const descendants = [];
  const queue = [rootPid];
  const seen = new Set(queue);
  while (queue.length > 0) {
    const parent = queue.shift();
    for (const item of all) {
      if (item.ppid === parent && !seen.has(item.pid)) {
        seen.add(item.pid);
        queue.push(item.pid);
        descendants.push(item);
      }
    }
  }
  return { status: "READ", processes: descendants };
};

const listeningSocketInodes = (port) => {
  const wantedPort = port.toString(16).toUpperCase().padStart(4, "0");
  const inodes = new Set();
  for (const path of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    if (!existsSync(path)) continue;
    const lines = readFileSync(path, "utf8").split("\n").slice(1);
    for (const line of lines) {
      const columns = line.trim().split(/\s+/);
      if (columns.length < 10) continue;
      const local = columns[1]?.split(":");
      if (local?.[1]?.toUpperCase() === wantedPort && columns[3] === "0A") {
        inodes.add(columns[9]);
      }
    }
  }
  return inodes;
};

const findPortOwners = (port, processes) => {
  if (process.platform !== "linux" || !existsSync("/proc")) {
    return {
      status: "NOT_SUPPORTED_ON_THIS_PLATFORM",
      listening: null,
      socket_inodes: [],
      owners: []
    };
  }
  const inodes = listeningSocketInodes(port);
  const owners = [];
  for (const item of processes) {
    const fdRoot = `/proc/${item.pid}/fd`;
    if (!existsSync(fdRoot)) continue;
    try {
      for (const fd of readdirSync(fdRoot)) {
        try {
          const target = readlinkSync(`${fdRoot}/${fd}`);
          const inode = target.match(/^socket:\[(\d+)\]$/)?.[1];
          if (inode && inodes.has(inode)) {
            owners.push({ pid: item.pid, ppid: item.ppid, name: item.name, socket_inode: inode });
          }
        } catch {
          // The descriptor may close between enumeration and read; that race is itself non-material.
        }
      }
    } catch {
      // The process may exit between snapshots; the next process-tree snapshot records the change.
    }
  }
  return {
    status: "READ",
    listening: inodes.size > 0,
    socket_inodes: [...inodes],
    owners
  };
};

const runObservedProcess = async (options, evidenceRoot) => {
  if (options.command.length === 0) fail("A child command is required after --");
  const lifecyclePath = resolve(evidenceRoot, `lifecycle-${options.role}-${process.pid}.jsonl`);
  const stdoutLog = new BoundedLog(
    resolve(evidenceRoot, `stdout-${options.role}-${process.pid}.log`),
    options.maxLogBytes
  );
  const stderrLog = new BoundedLog(
    resolve(evidenceRoot, `stderr-${options.role}-${process.pid}.log`),
    options.maxLogBytes
  );
  const [command, ...args] = options.command;
  let child;
  let receivedSignal = null;
  let previousProcessIds = new Set();

  appendJsonLine(
    lifecyclePath,
    nowEvent("observer_start", {
      role: options.role,
      target_port: options.port,
      child_command: basename(command),
      child_argument_count: args.length,
      max_log_bytes_per_stream: options.maxLogBytes,
      snapshot_interval_ms: DEFAULT_SNAPSHOT_INTERVAL_MS
    })
  );

  const snapshot = (reason) => {
    const tree = collectDescendants(process.pid);
    const currentIds = new Set(tree.processes.map((item) => item.pid));
    const appeared = [...currentIds].filter((pid) => !previousProcessIds.has(pid));
    const disappeared = [...previousProcessIds].filter((pid) => !currentIds.has(pid));
    previousProcessIds = currentIds;
    appendJsonLine(
      lifecyclePath,
      nowEvent("process_port_snapshot", {
        reason,
        process_tree_status: tree.status,
        processes: tree.processes,
        appeared_pids: appeared,
        disappeared_pids: disappeared,
        port: options.port,
        port_ownership:
          options.port === null
            ? { status: "NOT_REQUESTED", listening: null, socket_inodes: [], owners: [] }
            : findPortOwners(options.port, tree.processes)
      })
    );
  };

  child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    shell: false,
    windowsHide: true,
    stdio: ["inherit", "pipe", "pipe"]
  });

  child.once("spawn", () => {
    appendJsonLine(
      lifecyclePath,
      nowEvent("child_start", {
        role: options.role,
        child_pid: child.pid,
        child_ppid: process.pid,
        child_command: basename(command),
        child_argument_count: args.length
      })
    );
    snapshot("child_started");
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
    stdoutLog.write(chunk);
    const text = String(chunk);
    if (/watch|restart|restarting/i.test(text)) {
      appendJsonLine(lifecyclePath, nowEvent("watch_output_observed", { role: options.role }));
    }
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
    stderrLog.write(chunk);
    const text = String(chunk);
    if (/watch|restart|restarting/i.test(text)) {
      appendJsonLine(lifecyclePath, nowEvent("watch_output_observed", { role: options.role }));
    }
  });

  child.once("error", (error) => {
    appendJsonLine(
      lifecyclePath,
      nowEvent("child_spawn_error", { role: options.role, error_code: error.code ?? "UNKNOWN" })
    );
  });

  const signals = ["SIGINT", "SIGTERM", "SIGHUP"];
  const handlers = new Map();
  for (const signal of signals) {
    const handler = () => {
      if (receivedSignal) return;
      receivedSignal = signal;
      appendJsonLine(
        lifecyclePath,
        nowEvent("observer_signal_received", { role: options.role, signal })
      );
      try {
        const forwarded = child.kill(signal);
        appendJsonLine(
          lifecyclePath,
          nowEvent("signal_forwarded", { role: options.role, signal, forwarded })
        );
      } catch (error) {
        appendJsonLine(
          lifecyclePath,
          nowEvent("signal_forward_error", {
            role: options.role,
            signal,
            error_code: error.code ?? "UNKNOWN"
          })
        );
      }
    };
    handlers.set(signal, handler);
    process.on(signal, handler);
  }

  const timer = setInterval(() => snapshot("interval"), DEFAULT_SNAPSHOT_INTERVAL_MS);
  timer.unref();

  const result = await new Promise((resolveResult) => {
    child.once("exit", (code, signal) => {
      appendJsonLine(
        lifecyclePath,
        nowEvent("child_exit", {
          role: options.role,
          child_pid: child.pid,
          exit_code: code,
          signal
        })
      );
    });
    child.once("close", (code, signal) => resolveResult({ code, signal }));
  });

  clearInterval(timer);
  snapshot("child_closed");
  await Promise.all([stdoutLog.close(), stderrLog.close()]);
  for (const [signal, handler] of handlers) process.off(signal, handler);
  appendJsonLine(
    lifecyclePath,
    nowEvent("observer_exit", {
      role: options.role,
      child_pid: child.pid,
      child_exit_code: result.code,
      child_exit_signal: result.signal,
      received_signal: receivedSignal,
      stdout_log_bytes: stdoutLog.bytesWritten,
      stderr_log_bytes: stderrLog.bytesWritten,
      stdout_log_truncated: stdoutLog.truncated,
      stderr_log_truncated: stderrLog.truncated,
      child_restart_count: 0
    })
  );

  if (result.signal && process.platform !== "win32") {
    process.kill(process.pid, result.signal);
    return;
  }
  process.exit(result.code ?? 1);
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  const evidenceRoot = ensurePrivateEvidenceRoot(options.evidenceRoot);
  if (options.recordEnvironment) {
    writeEnvironment(evidenceRoot);
    return;
  }
  if (options.recordEvent) {
    appendJsonLine(resolve(evidenceRoot, "markers.jsonl"), nowEvent(options.recordEvent));
    return;
  }
  await runObservedProcess(options, evidenceRoot);
};

main().catch((error) => {
  process.stderr.write(
    `O7 observer failed: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(2);
});
