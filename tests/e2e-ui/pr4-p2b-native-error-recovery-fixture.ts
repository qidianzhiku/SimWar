import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { CDPSession, Page, Response } from "@playwright/test";

export type NativeScope = Readonly<{
  activity_id: string;
  course_id: string;
  role_key: string;
  round_id: string;
  round_no: number;
  run_id: string;
  team_id: string;
  tenant_id: string;
}>;

type Phase = "initial" | "retry" | "recovery";
type NativeResponse = { request_id: string; status: number; code?: string };
type Paused = {
  reason: string;
  data?: Record<string, string>;
  hitBreakpoints?: string[];
  callFrames: {
    callFrameId: string;
    location: { scriptId: string; lineNumber: number; columnNumber: number };
  }[];
};

const consequencePath = "/api/v1/bff/student/w3/consequence";
const modulePath = "/src/P2BDecisionLearningJourney.tsx";
const apiBase = `http://127.0.0.1:${process.env.SIMWAR_PLAYWRIGHT_API_PORT ?? 3100}`;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  // Observe early rejection without changing the original rejecting promise.
  // Callers await that original promise; dispose also rethrows a recorded fault.
  void promise.catch(() => undefined);
  return { promise, resolve, reject };
}

async function readNativeStudentSession(response: Response): Promise<string> {
  assert.equal(new URL(response.url()).origin, apiBase, "native login origin");
  assert.equal(new URL(response.url()).pathname, "/api/v1/auth/login");
  assert.equal(response.status(), 200);
  const envelope = await response.json();
  assert.equal(envelope.code, "OK");
  assert.equal(envelope.data?.user?.tenant_id, "tenant_demo");
  assert.equal(envelope.data?.user?.user_id, "usr_student");
  assert.ok(envelope.data?.user?.roles?.includes("learner"));
  assert.ok(
    typeof envelope.data?.access_token === "string" && envelope.data.access_token.length > 0,
    "native student session contract"
  );
  return envelope.data.access_token;
}

export async function assertNativeInvalidRound(
  page: Page,
  login: Response,
  invalidQuery: string
): Promise<{ status: number; code: string }> {
  const token = await readNativeStudentSession(login);
  const response = await page.request.get(`${apiBase}${consequencePath}?${invalidQuery}`, {
    headers: { authorization: `Bearer ${token}`, "x-tenant-id": "tenant_demo" }
  });
  const envelope = await response.json();
  assert.equal(response.status(), 422);
  assert.equal(envelope.code, "W3_CONTEXT_INVALID");
  return { status: response.status(), code: envelope.code };
}

/** No test registration or import-time resource start. No intercepted responses,
 * request mutation, product script edits, DOM writes or store injection. */
export async function prepareNativeAuthRecovery(
  page: Page,
  nativeLogin: Promise<Response>,
  expected: NativeScope
) {
  const client: CDPSession = await page.context().newCDPSession(page);
  const scripts = new Map<string, string>();
  const requests = new Map<string, { phase: Phase; status?: number }>();
  const jobs = new Set<Promise<void>>();
  const results = {
    initial: deferred<NativeResponse>(),
    retry: deferred<NativeResponse>(),
    recovery: deferred<NativeResponse>()
  };
  const revoked = deferred<void>();
  const proof: Record<string, unknown>[] = [];
  let phase: Phase = "initial";
  let instrumentation = "";
  let breakpoint = "";
  let paused = false;
  let disposed = false;
  let revocationStarted = false;
  let fatal: Error | undefined;
  let token = "";
  const record = (event: string, value: Record<string, unknown> = {}) => {
    proof.push({ event, at: new Date().toISOString(), ...value });
  };
  const fail = () => {
    fatal ??= new Error("native P2B fixture boundary failed; inspect sanitized lifecycle proof");
    revoked.reject(fatal);
    for (const result of Object.values(results)) result.reject(fatal);
  };
  const track = (operation: () => Promise<void>) => {
    const job = operation().catch(() => {
      record("BOUNDARY_FAILURE");
      fail();
    });
    jobs.add(job);
    void job.then(() => jobs.delete(job));
  };
  const onScript = (event: { scriptId: string; url: string }) => {
    scripts.set(event.scriptId, event.url);
  };
  const onPaused = (event: Paused) => {
    paused = true;
    track(async () => {
      const scriptId = event.data?.scriptId ?? event.callFrames[0]?.location.scriptId;
      if (event.reason === "instrumentation") {
        if (scriptId && scripts.get(scriptId)?.includes(modulePath)) {
          const { scriptSource } = await client.send("Debugger.getScriptSource", { scriptId });
          const lines = scriptSource.split("\n");
          const matches = lines.flatMap((line, index) =>
            line.includes("fetch(") && line.includes(`${consequencePath}?`) ? [index] : []
          );
          assert.equal(matches.length, 1, "unique native P2B fetch boundary");
          const bound = await client.send("Debugger.setBreakpoint", {
            location: { scriptId, lineNumber: matches[0]!, columnNumber: 0 }
          });
          assert.equal(bound.actualLocation.lineNumber, matches[0]);
          breakpoint = bound.breakpointId;
          record("NATIVE_FETCH_BOUND", {
            script_sha256: createHash("sha256").update(scriptSource).digest("hex"),
            line: bound.actualLocation.lineNumber + 1
          });
          await client.send("Debugger.removeBreakpoint", { breakpointId: instrumentation });
          instrumentation = "";
        }
      } else if (breakpoint && event.hitBreakpoints?.includes(breakpoint)) {
        assert.equal(revocationStarted, false, "one native logout only");
        revocationStarted = true;
        const frame = event.callFrames[0];
        assert.ok(frame);
        const observed = await client.send("Debugger.evaluateOnCallFrame", {
          callFrameId: frame.callFrameId,
          returnByValue: true,
          throwOnSideEffect: true,
          expression:
            "({published,tokenPresent:typeof token==='string'&&token.length>0,context:{activity_id:context.activity_id,course_id:context.course_id,role_key:context.role_key,round_id:context.round_id,round_no:context.round_no,run_id:context.run_id,team_id:context.team_id,tenant_id:context.tenant_id}})"
        });
        assert.equal(observed.exceptionDetails, undefined, "read-only native scope observation");
        assert.equal(observed.result.value?.published, true);
        assert.equal(observed.result.value?.tokenPresent, true);
        assert.deepEqual(observed.result.value?.context, expected);
        record("PUBLISHED_NATIVE_CONTEXT_ADMITTED", { context: expected });
        token = await readNativeStudentSession(await nativeLogin);
        const logout = await page.request.post(`${apiBase}/api/v1/auth/logout`, {
          headers: { authorization: `Bearer ${token}`, "x-tenant-id": expected.tenant_id }
        });
        const logoutEnvelope = await logout.json();
        assert.equal(logout.status(), 200);
        assert.equal(logoutEnvelope.code, "OK");
        assert.equal(logoutEnvelope.data?.revoked, true);
        record("NATIVE_SESSION_REVOKED", { status: 200 });
        const me = await page.request.get(`${apiBase}/api/v1/auth/me`, {
          headers: { authorization: `Bearer ${token}`, "x-tenant-id": expected.tenant_id }
        });
        const meEnvelope = await me.json();
        assert.equal(me.status(), 401);
        assert.equal(meEnvelope.code, "AUTH-401-001");
        record("OLD_SESSION_NATIVE_AUTH_REJECTED", { status: 401, code: "AUTH-401-001" });
        token = "";
        await client.send("Debugger.removeBreakpoint", { breakpointId: breakpoint });
        breakpoint = "";
        await client.send("Debugger.resume");
        paused = false;
        record("ORIGINAL_SCRIPT_RESUMED_UNCHANGED");
        revoked.resolve();
        return;
      } else {
        throw new Error("unexpected native debugger boundary");
      }
      await client.send("Debugger.resume");
      paused = false;
    });
  };
  const onRequest = (event: {
    requestId: string;
    request: { url: string; method: string };
    initiator: { stack?: { callFrames: { url: string }[] } };
  }) => {
    const url = new URL(event.request.url);
    if (url.origin !== apiBase || url.pathname !== consequencePath) return;
    if (event.request.method !== "GET") return;
    if (!event.initiator.stack?.callFrames.some((frame) => frame.url.includes(modulePath))) return;
    for (const [key, value] of Object.entries(expected)) {
      if (url.searchParams.get(key) !== String(value)) {
        record("REQUEST_SCOPE_MISMATCH");
        fail();
        return;
      }
    }
    requests.set(event.requestId, { phase });
    record("P2B_NATIVE_REQUEST", { request_id: event.requestId, phase, context: expected });
  };
  const onResponse = (event: { requestId: string; response: { status: number } }) => {
    const request = requests.get(event.requestId);
    if (request) request.status = event.response.status;
  };
  const onFinished = (event: { requestId: string }) => {
    const request = requests.get(event.requestId);
    if (!request) return;
    track(async () => {
      const response = await client.send("Network.getResponseBody", { requestId: event.requestId });
      const body = response.base64Encoded
        ? Buffer.from(response.body, "base64").toString("utf8")
        : response.body;
      const envelope = JSON.parse(body);
      const status = request.status;
      if (request.phase === "recovery") {
        assert.equal(status, 200);
        assert.equal(envelope.code, "OK");
        assert.deepEqual(envelope.data?.record?.context, expected);
        assert.equal(envelope.data?.record?.publication?.status, "PUBLISHED");
        assert.equal(envelope.data?.visibility, "student_safe");
      } else {
        assert.equal(status, 409);
        assert.equal(envelope.code, "W3_OUTPUT_INVALID");
      }
      const safeResponse = {
        request_id: event.requestId,
        status: status!,
        code: envelope.code as string
      };
      record("P2B_NATIVE_RESPONSE", { ...safeResponse, phase: request.phase });
      results[request.phase].resolve(safeResponse);
    });
  };
  const onFailed = (event: { requestId: string; canceled?: boolean }) => {
    if (!requests.has(event.requestId)) return;
    record("P2B_NATIVE_TRANSPORT_END", { request_id: event.requestId, canceled: !!event.canceled });
    if (!event.canceled) fail();
  };
  const onClose = () => {
    if (!disposed) fail();
  };
  client.on("Debugger.scriptParsed", onScript);
  client.on("Debugger.paused", onPaused);
  client.on("Network.requestWillBeSent", onRequest);
  client.on("Network.responseReceived", onResponse);
  client.on("Network.loadingFinished", onFinished);
  client.on("Network.loadingFailed", onFailed);
  client.on("close", onClose);
  try {
    await client.send("Network.enable");
    await client.send("Debugger.enable");
    instrumentation = (
      await client.send("Debugger.setInstrumentationBreakpoint", {
        instrumentation: "beforeScriptExecution"
      })
    ).breakpointId;
    record("OBSERVER_ARMED_BEFORE_TRIGGER");
  } catch {
    await client.detach();
    throw new Error("native fixture preparation failed");
  }

  return {
    proof,
    revoked: revoked.promise,
    initial: results.initial.promise,
    retry: results.retry.promise,
    recovered: results.recovery.promise,
    beginRetry() {
      assert.equal(phase, "initial");
      phase = "retry";
      record("RETRY_OBSERVER_ARMED");
    },
    beginRecovery() {
      assert.equal(phase, "retry");
      phase = "recovery";
      record("NEW_SESSION_RECOVERY_OBSERVER_ARMED");
    },
    async dispose() {
      if (disposed) {
        if (fatal) throw fatal;
        return;
      }
      disposed = true;
      const errors: unknown[] = [];
      const clean = async (operation: () => Promise<unknown>) => {
        try {
          await operation();
        } catch (error) {
          errors.push(error);
        }
      };
      await Promise.all([...jobs]);
      if (instrumentation) {
        await clean(() =>
          client.send("Debugger.removeBreakpoint", { breakpointId: instrumentation })
        );
      }
      if (breakpoint) {
        await clean(() => client.send("Debugger.removeBreakpoint", { breakpointId: breakpoint }));
      }
      if (paused) await clean(() => client.send("Debugger.resume"));
      client.off("Debugger.scriptParsed", onScript);
      client.off("Debugger.paused", onPaused);
      client.off("Network.requestWillBeSent", onRequest);
      client.off("Network.responseReceived", onResponse);
      client.off("Network.loadingFinished", onFinished);
      client.off("Network.loadingFailed", onFailed);
      client.off("close", onClose);
      token = "";
      await clean(() => client.detach());
      record("FIXTURE_CLEANUP", { accepted: errors.length === 0 && !fatal });
      if (errors.length || fatal) throw new Error("native fixture failed or cleanup not accepted");
    }
  };
}
