import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createConnection, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const temporaryRoot = await mkdtemp(join(tmpdir(), "simwar-built-esm-startup-"));
let apiProcess: ChildProcessWithoutNullStreams | undefined;

function buildApi(): void {
  const result = spawnSync(
    process.execPath,
    [
      resolve(repositoryRoot, "node_modules/typescript/bin/tsc"),
      "-p",
      "services/api/tsconfig.json"
    ],
    { cwd: repositoryRoot, encoding: "utf8" }
  );

  if (result.status !== 0) {
    throw new Error(`API build failed:\n${result.stdout}\n${result.stderr}`);
  }
}

async function allocatePort(): Promise<number> {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  server.close();
  await once(server, "close");
  return port;
}

async function waitForHealth(
  url: string,
  process: ChildProcessWithoutNullStreams
): Promise<Response> {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    if (process.exitCode !== null) {
      throw new Error(`API exited before health readiness with code ${process.exitCode}`);
    }

    try {
      return await fetch(url);
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
    }
  }

  throw new Error("API did not become healthy within 5000ms");
}

async function stopApi(): Promise<void> {
  if (!apiProcess || apiProcess.exitCode !== null || apiProcess.signalCode !== null) {
    return;
  }

  const exited = once(apiProcess, "exit");
  apiProcess.kill();
  await exited;
}

async function isPortListening(port: number): Promise<boolean> {
  return await new Promise((resolveListening) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolveListening(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolveListening(false);
    });
  });
}

beforeAll(buildApi);

afterAll(async () => {
  await stopApi();
  await rm(temporaryRoot, { force: true, recursive: true });
});

describe("built shared-contracts Node ESM runtime", () => {
  it("loads the package root through native Node resolution with public exports intact", () => {
    const probe = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `const value = await import("@simwar/shared-contracts"); console.log(JSON.stringify({ health: typeof value.createHealthPayload, limits: typeof value.getKnownLimitsProjection, policy: value.KNOWN_LIMITS_POLICY_VERSION, scenario: typeof value.createR7ScenarioFactorySeedPackage }));`
      ],
      { cwd: repositoryRoot, encoding: "utf8" }
    );

    expect(probe.stderr).toBe("");
    expect(probe.status).toBe(0);
    expect(JSON.parse(probe.stdout.trim())).toEqual({
      health: "function",
      limits: "function",
      policy: "phase7-known-limits-runtime.v1",
      scenario: "function"
    });
  });

  it("starts the built API and serves health without module resolution errors", async () => {
    const port = await allocatePort();
    const storeFile = join(temporaryRoot, "store.json");
    let stderr = "";
    apiProcess = spawn(process.execPath, ["services/api/dist/server.js"], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        API_PORT: String(port),
        APP_ENV: "test",
        INTERNAL_SERVICE_TOKEN: "test-internal-service-token",
        JWT_SECRET: "test-jwt-secret-with-sufficient-length",
        SIMWAR_STORE_FILE: storeFile
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    apiProcess.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const response = await waitForHealth(`http://127.0.0.1:${port}/healthz`, apiProcess);
    const body = (await response.json()) as { data?: { service?: string; status?: string } };

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ service: "@simwar/api", status: "ok" });
    expect(stderr).not.toContain("ERR_MODULE_NOT_FOUND");

    const stabilityStatuses: number[] = [];
    for (let probe = 0; probe < 3; probe += 1) {
      stabilityStatuses.push((await fetch(`http://127.0.0.1:${port}/healthz`)).status);
    }
    expect(stabilityStatuses).toEqual([200, 200, 200]);

    const startedProcess = apiProcess;
    await stopApi();
    await rm(storeFile, { force: true });

    expect(startedProcess.killed).toBe(true);
    expect(await isPortListening(port)).toBe(false);
    expect(existsSync(storeFile)).toBe(false);
  });
});
