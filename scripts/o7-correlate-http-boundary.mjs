import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CLASSIFICATIONS = Object.freeze([
  "NO_SERVER_REQUEST_START",
  "SERVER_REQUEST_STARTED_RESPONSE_FINISHED",
  "SERVER_REQUEST_STARTED_RESPONSE_NOT_FINISHED",
  "SERVER_SOCKET_OR_CLIENT_ERROR",
  "CLIENT_SIDE_RESET_AFTER_SERVER_FINISH",
  "NO_FAILURE_IN_VALID_OBSERVATION",
  "OBSERVATION_INCONCLUSIVE",
  "INFRASTRUCTURE_BLOCKED"
]);

const safeCode = (value) =>
  typeof value === "string" && /^[A-Z0-9_ -]{1,64}$/.test(value) ? value : undefined;

const safeEvent = (input) => {
  if (!input || typeof input !== "object") return null;
  const event = {
    event_type: typeof input.event_type === "string" ? input.event_type : "UNKNOWN",
    sequence: Number.isInteger(input.sequence) ? input.sequence : null,
    request_id: typeof input.request_id === "string" ? input.request_id : null,
    path_template: typeof input.path_template === "string" ? input.path_template : null,
    error_code: safeCode(input.error_code),
    status_code: Number.isInteger(input.status_code) ? input.status_code : null
  };
  return event;
};

const failureCode = (failure) =>
  safeCode(failure && typeof failure === "object" ? failure.error_code : undefined);

const matchesFailure = (event, failure) => {
  if (!failure || typeof failure !== "object") return true;
  if (typeof failure.request_id === "string") return event.request_id === failure.request_id;
  if (typeof failure.path_template === "string")
    return event.path_template === failure.path_template;
  return false;
};

/**
 * Correlate a client-observed failure with exact server/socket evidence.
 * Server response finish is intentionally not treated as client receipt.
 */
export const classifyHttpBoundary = ({ events = [], failure = null } = {}) => {
  const normalized = Array.isArray(events) ? events.map(safeEvent).filter(Boolean) : [];
  if (!failure) {
    return {
      schema_version: "simwar.o7_http_boundary_classification.v1",
      classification: "NO_FAILURE_IN_VALID_OBSERVATION",
      evidence_event_count: normalized.length,
      root_cause: "NOT_PROVEN",
      client_received_response: "NOT_PROVEN",
      causal_claim: "No client failure was supplied; this is not a root-cause claim."
    };
  }

  const correlated = normalized.filter((event) => matchesFailure(event, failure));
  const starts = correlated.filter((event) => event.event_type === "http_request_start");
  const finishes = correlated.filter((event) => event.event_type === "http_response_finish");
  const socketErrors = correlated.filter(
    (event) => event.event_type === "http_socket_error" || event.event_type === "http_request_error"
  );
  const code = failureCode(failure);
  let classification;
  if (starts.length === 0) classification = "NO_SERVER_REQUEST_START";
  else if (socketErrors.length > 0) classification = "SERVER_SOCKET_OR_CLIENT_ERROR";
  else if (finishes.length > 0 && code === "ECONNRESET") {
    classification = "CLIENT_SIDE_RESET_AFTER_SERVER_FINISH";
  } else if (finishes.length > 0) {
    classification = "SERVER_REQUEST_STARTED_RESPONSE_FINISHED";
  } else {
    classification = "SERVER_REQUEST_STARTED_RESPONSE_NOT_FINISHED";
  }

  return {
    schema_version: "simwar.o7_http_boundary_classification.v1",
    classification: CLASSIFICATIONS.includes(classification)
      ? classification
      : "OBSERVATION_INCONCLUSIVE",
    correlated_request_id: correlated.find((event) => event.request_id)?.request_id ?? null,
    correlated_path_template:
      correlated.find((event) => event.path_template)?.path_template ?? null,
    evidence_event_count: correlated.length,
    server_request_started: starts.length > 0,
    server_response_finished: finishes.length > 0,
    server_socket_or_request_error: socketErrors.length > 0,
    client_received_response: "NOT_PROVEN",
    root_cause: "NOT_PROVEN",
    causal_claim:
      finishes.length > 0
        ? "The server-side response lifecycle reached finish; client receipt and downstream fault owner remain unproven."
        : "The available boundary evidence does not identify the downstream fault owner."
  };
};

const parseArgs = (argv) => {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key !== "--events" && key !== "--failure") throw new Error(`unknown option: ${key}`);
    const value = argv[++index];
    if (!value) throw new Error(`missing value for ${key}`);
    values[key.slice(2)] = value;
  }
  if (!values.events || !values.failure) throw new Error("--events and --failure are required");
  return values;
};

const readEvents = (path) =>
  readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const failure = JSON.parse(readFileSync(args.failure, "utf8"));
    process.stdout.write(
      `${JSON.stringify(classifyHttpBoundary({ events: readEvents(args.events), failure }), null, 2)}\n`
    );
  } catch (error) {
    process.stderr.write(
      `O7 HTTP boundary correlator failed: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 2;
  }
}
