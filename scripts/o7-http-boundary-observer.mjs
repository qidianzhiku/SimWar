import { channel } from "node:diagnostics_channel";
import { appendFileSync } from "node:fs";

export const DIAGNOSTICS_CHANNELS = Object.freeze([
  "http.server.request.start",
  "http.server.response.created",
  "http.server.response.finish",
  "http.server.request.error",
  "http.server.request.close",
  "http.server.response.close",
  "net.server.socket",
  "net.socket.error",
  "net.socket.close"
]);

const EVENT_TYPES = new Map([
  ["http.server.request.start", "http_request_start"],
  ["http.server.response.created", "http_response_created"],
  ["http.server.response.finish", "http_response_finish"],
  ["http.server.request.error", "http_request_error"],
  ["http.server.request.close", "http_request_close"],
  ["http.server.response.close", "http_response_close"],
  ["net.server.socket", "http_socket_created"],
  ["net.socket.error", "http_socket_error"],
  ["net.socket.close", "http_socket_close"]
]);

const asObject = (value) => (value !== null && typeof value === "object" ? value : null);

const safeMethod = (value) =>
  typeof value === "string" && /^[A-Z]{3,12}$/.test(value) ? value : undefined;

const safePathTemplate = (value) => {
  if (typeof value !== "string" || value.length === 0) return undefined;
  try {
    const path =
      value.startsWith("http://") || value.startsWith("https://")
        ? new URL(value).pathname
        : value.split(/[?#]/, 1)[0];
    return path.startsWith("/") && path.length <= 512 ? path : undefined;
  } catch {
    return undefined;
  }
};

const safeStatusCode = (value) =>
  Number.isInteger(value) && value >= 100 && value <= 599 ? value : undefined;

const safeErrorCode = (error) => {
  const candidate = asObject(error)?.code;
  return typeof candidate === "string" && /^[A-Z0-9_ -]{1,64}$/.test(candidate)
    ? candidate
    : undefined;
};

const addIfDefined = (target, key, value) => {
  if (value !== undefined) target[key] = value;
};

const MAX_AUTO_EVENT_BYTES = 1024 * 1024;

/**
 * Create a bounded, privacy-safe JSONL sink for the child-process preload.
 * Write failures are surfaced on stderr once and never allowed to throw from
 * a diagnostics-channel callback into the observed HTTP server.
 */
export const createJsonlEventEmitter = (path, { maxBytes = MAX_AUTO_EVENT_BYTES } = {}) => {
  let bytesWritten = 0;
  let truncated = false;
  let failed = false;

  const emit = (event) => {
    if (truncated || failed) return;
    const line = `${JSON.stringify(event)}\n`;
    const bytes = Buffer.byteLength(line, "utf8");
    if (bytesWritten + bytes > maxBytes) {
      truncated = true;
      return;
    }
    try {
      appendFileSync(path, line, { encoding: "utf8", flag: "a" });
      bytesWritten += bytes;
    } catch (error) {
      failed = true;
      const code = safeErrorCode(error) ?? "UNKNOWN";
      process.stderr.write(`O7 HTTP boundary observer write failed: ${code}\n`);
    }
  };

  return Object.freeze({
    emit,
    get bytesWritten() {
      return bytesWritten;
    },
    get truncated() {
      return truncated;
    },
    get failed() {
      return failed;
    }
  });
};

/**
 * Subscribe to the bounded Node HTTP/socket diagnostic-channel allowlist.
 * The observer records only identifiers and allowlisted scalar metadata; it
 * never serializes request, response, socket, error, header, or body objects.
 */
export const createHttpBoundaryObserver = ({ emit = () => {} } = {}) => {
  const requestIds = new WeakMap();
  const responseIds = new WeakMap();
  const socketIds = new WeakMap();
  const subscriptions = [];
  let sequence = 0;
  let nextRequestId = 1;
  let nextResponseId = 1;
  let nextSocketId = 1;
  let started = false;

  const identifier = (registry, value, prefix, next) => {
    const object = asObject(value);
    if (!object) return undefined;
    let id = registry.get(object);
    if (!id) {
      id = `${prefix}-${next()}`;
      registry.set(object, id);
    }
    return id;
  };

  const nextRequest = () => nextRequestId++;
  const nextResponse = () => nextResponseId++;
  const nextSocket = () => nextSocketId++;

  const onDiagnostic = (channelName, message) => {
    const payload = asObject(message) ?? {};
    const request = asObject(payload.request ?? payload.req);
    const response = asObject(payload.response ?? payload.res);
    const socket = asObject(payload.socket);
    const error = asObject(payload.error);
    const event = {
      schema_version: "simwar.o7_http_boundary.v1",
      event_type: EVENT_TYPES.get(channelName),
      channel: channelName,
      sequence: ++sequence,
      wall_time_utc: new Date().toISOString(),
      monotonic_ns: process.hrtime.bigint().toString()
    };

    addIfDefined(event, "request_id", identifier(requestIds, request, "req", nextRequest));
    addIfDefined(event, "response_id", identifier(responseIds, response, "res", nextResponse));
    addIfDefined(event, "socket_id", identifier(socketIds, socket, "sock", nextSocket));
    addIfDefined(event, "method", safeMethod(request?.method));
    addIfDefined(event, "path_template", safePathTemplate(request?.url));
    addIfDefined(event, "status_code", safeStatusCode(response?.statusCode));
    addIfDefined(event, "error_code", safeErrorCode(error));
    emit(event);
  };

  const start = () => {
    if (started) return;
    started = true;
    for (const channelName of DIAGNOSTICS_CHANNELS) {
      const diagnosticChannel = channel(channelName);
      const handler = (message) => onDiagnostic(channelName, message);
      diagnosticChannel.subscribe(handler);
      subscriptions.push({ diagnosticChannel, handler });
    }
  };

  const stop = () => {
    if (!started) return;
    for (const { diagnosticChannel, handler } of subscriptions.splice(0)) {
      diagnosticChannel.unsubscribe(handler);
    }
    started = false;
  };

  return Object.freeze({
    channels: DIAGNOSTICS_CHANNELS,
    feature_probe: Object.fromEntries(
      DIAGNOSTICS_CHANNELS.map((name) => [name, typeof channel(name).subscribe === "function"])
    ),
    start,
    stop
  });
};

const autoEvidencePath = process.env.O7_HTTP_BOUNDARY_EVIDENCE_PATH;
if (typeof autoEvidencePath === "string" && autoEvidencePath.length > 0) {
  const sink = createJsonlEventEmitter(autoEvidencePath);
  const observer = createHttpBoundaryObserver({ emit: sink.emit });
  observer.start();
  process.once("exit", () => observer.stop());
}
