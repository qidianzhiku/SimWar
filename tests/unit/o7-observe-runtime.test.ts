import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = resolve(".");
const observerPath = resolve(repositoryRoot, "scripts/o7-observe-runtime.mjs");
const fixtures: string[] = [];

const createEvidenceRoot = () => {
  const path = mkdtempSync(join(tmpdir(), "simwar-o7-observer-"));
  fixtures.push(path);
  return path;
};

const readJsonLines = (path: string) =>
  readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);

afterEach(() => {
  for (const path of fixtures.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

describe("O7 runtime observer", () => {
  it("runs the child once, preserves its exit code and output, and records lifecycle evidence", () => {
    const evidenceRoot = createEvidenceRoot();
    const childSource = [
      'console.log("observer-stdout")',
      'console.error("observer-stderr")',
      "process.exit(7)"
    ].join(";");

    const result = spawnSync(
      process.execPath,
      [
        observerPath,
        "--role",
        "api",
        "--evidence-root",
        evidenceRoot,
        "--port",
        "3100",
        "--",
        process.execPath,
        "-e",
        childSource
      ],
      { cwd: repositoryRoot, encoding: "utf8" }
    );

    expect(result.status).toBe(7);
    expect(result.stdout).toContain("observer-stdout");
    expect(result.stderr).toContain("observer-stderr");

    const lifecycleName = readdirSync(evidenceRoot).find((name) =>
      /^lifecycle-api-\d+\.jsonl$/.test(name)
    );
    expect(lifecycleName).toBeTruthy();
    const events = readJsonLines(join(evidenceRoot, lifecycleName!));
    expect(events.filter((event) => event.event_type === "child_start")).toHaveLength(1);
    expect(events.filter((event) => event.event_type === "child_exit")).toHaveLength(1);
    expect(events).not.toContainEqual(expect.objectContaining({ event_type: "child_restart" }));
    expect(events.at(-1)).toEqual(
      expect.objectContaining({ event_type: "observer_exit", child_exit_code: 7 })
    );
  });

  it("bounds and redacts captured output without changing child failure sensitivity", () => {
    const evidenceRoot = createEvidenceRoot();
    const secret = "synthetic-sensitive-value";
    const childSource = [
      `console.log("Authorization: Bearer ${secret}")`,
      `console.error("Cookie: session=${secret}")`,
      `console.log("http://127.0.0.1:3100/path?private=${secret}")`,
      'console.log("x".repeat(2048))',
      "process.exit(9)"
    ].join(";");

    const result = spawnSync(
      process.execPath,
      [
        observerPath,
        "--role",
        "api",
        "--evidence-root",
        evidenceRoot,
        "--max-log-bytes",
        "512",
        "--",
        process.execPath,
        "-e",
        childSource
      ],
      { cwd: repositoryRoot, encoding: "utf8" }
    );

    expect(result.status).toBe(9);
    const capturedLogs = readdirSync(evidenceRoot).filter((name) =>
      /^(stdout|stderr)-api-\d+\.log$/.test(name)
    );
    expect(capturedLogs).toHaveLength(2);
    const combined = capturedLogs
      .map((name) => readFileSync(join(evidenceRoot, name), "utf8"))
      .join("\n");
    expect(combined).not.toContain(secret);
    expect(combined).toContain("[REDACTED]");
    for (const name of capturedLogs) {
      expect(statSync(join(evidenceRoot, name)).size).toBeLessThanOrEqual(512);
    }
  });

  it("writes an allowlisted environment receipt and measurement contract outside the repository", () => {
    const evidenceRoot = createEvidenceRoot();
    const result = spawnSync(
      process.execPath,
      [observerPath, "--record-environment", "--evidence-root", evidenceRoot],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          GITHUB_RUN_ID: "123",
          GITHUB_RUN_ATTEMPT: "1",
          GITHUB_JOB: "browser-smoke",
          O7_OBS_PRODUCT_BASE_SHA: "a".repeat(40),
          O7_OBSERVED_HEAD_SHA: "b".repeat(40),
          SECRET_SHOULD_NOT_LEAK: "private"
        }
      }
    );

    expect(result.status).toBe(0);
    const environment = JSON.parse(
      readFileSync(join(evidenceRoot, "environment.json"), "utf8")
    ) as Record<string, unknown>;
    const contract = JSON.parse(
      readFileSync(join(evidenceRoot, "MEASUREMENT_CONTRACT.json"), "utf8")
    ) as Record<string, unknown>;
    const serialized = JSON.stringify({ environment, contract });

    expect(environment).toEqual(
      expect.objectContaining({
        github_run_id: "123",
        github_run_attempt: "1",
        github_job: "browser-smoke",
        product_base_sha: "a".repeat(40),
        observed_head_sha: "b".repeat(40)
      })
    );
    expect(contract).toEqual(
      expect.objectContaining({
        experiment_id: "O7-OBS-01",
        request_retry_added: false,
        child_restart_added: false,
        log_root_policy: "OUTSIDE_REPOSITORY_REQUIRED"
      })
    );
    expect(serialized).not.toContain("SECRET_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("private");
    expect(resolve(evidenceRoot).startsWith(repositoryRoot)).toBe(false);
  });

  it("records explicit suite markers without starting another process", () => {
    const evidenceRoot = createEvidenceRoot();
    const result = spawnSync(
      process.execPath,
      [observerPath, "--record-event", "test_command_start", "--evidence-root", evidenceRoot],
      { cwd: repositoryRoot, encoding: "utf8" }
    );

    expect(result.status).toBe(0);
    const events = readJsonLines(join(evidenceRoot, "markers.jsonl"));
    expect(events).toEqual([
      expect.objectContaining({
        event_type: "test_command_start",
        experiment_id: "O7-OBS-01"
      })
    ]);
    expect(events[0]).not.toHaveProperty("child_pid");
  });

  it("forwards termination signals once and records the child signal on POSIX", async () => {
    if (process.platform === "win32") {
      const source = readFileSync(observerPath, "utf8");
      expect(source).toContain('const signals = ["SIGINT", "SIGTERM", "SIGHUP"]');
      expect(source).toContain("child.kill(signal)");
      expect(source).toContain("process.kill(process.pid, result.signal)");
      return;
    }

    const evidenceRoot = createEvidenceRoot();
    const observer = spawn(
      process.execPath,
      [
        observerPath,
        "--role",
        "api",
        "--evidence-root",
        evidenceRoot,
        "--",
        process.execPath,
        "-e",
        "setInterval(() => {}, 1000)"
      ],
      { cwd: repositoryRoot, stdio: "ignore" }
    );

    await new Promise<void>((resolveStart, rejectStart) => {
      const deadline = Date.now() + 5000;
      const poll = () => {
        const lifecycleName = readdirSync(evidenceRoot).find((name) =>
          /^lifecycle-api-\d+\.jsonl$/.test(name)
        );
        if (lifecycleName) {
          const events = readJsonLines(join(evidenceRoot, lifecycleName));
          if (events.some((event) => event.event_type === "child_start")) {
            resolveStart();
            return;
          }
        }
        if (Date.now() >= deadline) {
          rejectStart(new Error("observer child did not start within 5 seconds"));
          return;
        }
        setTimeout(poll, 25);
      };
      poll();
    });

    observer.kill("SIGTERM");
    const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
      (resolveExit) => observer.once("close", (code, signal) => resolveExit({ code, signal }))
    );

    expect(result).toEqual({ code: null, signal: "SIGTERM" });
    const lifecycleName = readdirSync(evidenceRoot).find((name) =>
      /^lifecycle-api-\d+\.jsonl$/.test(name)
    );
    const events = readJsonLines(join(evidenceRoot, lifecycleName!));
    expect(events.filter((event) => event.event_type === "observer_signal_received")).toHaveLength(
      1
    );
    expect(events.filter((event) => event.event_type === "signal_forwarded")).toHaveLength(1);
    expect(events.filter((event) => event.event_type === "child_exit")).toHaveLength(1);
    expect(events.at(-1)).toEqual(
      expect.objectContaining({
        event_type: "observer_exit",
        child_exit_signal: "SIGTERM",
        received_signal: "SIGTERM",
        child_restart_count: 0
      })
    );
  });
});
