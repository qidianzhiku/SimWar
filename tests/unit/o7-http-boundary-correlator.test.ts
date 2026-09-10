import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const event = (event_type: string, extra: Record<string, unknown> = {}) => ({
  schema_version: "simwar.o7_http_boundary.v1",
  event_type,
  sequence: Object.keys(extra).length + 1,
  request_id: "req-1",
  path_template: "/api/v1/bff/teacher/model-qualification",
  ...extra
});

describe("O7 HTTP boundary correlator", () => {
  const loadCorrelator = () =>
    import(pathToFileURL(resolve("scripts/o7-correlate-http-boundary.mjs")).href);

  it("classifies a reset after server response finish without claiming client receipt", async () => {
    const { classifyHttpBoundary } = await loadCorrelator();
    const result = classifyHttpBoundary({
      events: [event("http_request_start"), event("http_response_finish", { status_code: 200 })],
      failure: { request_id: "req-1", error_code: "ECONNRESET" }
    });
    expect(result.classification).toBe("CLIENT_SIDE_RESET_AFTER_SERVER_FINISH");
    expect(result.client_received_response).toBe("NOT_PROVEN");
    expect(result.root_cause).toBe("NOT_PROVEN");
  });

  it("distinguishes started requests without a finished response", async () => {
    const { classifyHttpBoundary } = await loadCorrelator();
    const result = classifyHttpBoundary({
      events: [event("http_request_start")],
      failure: { request_id: "req-1", error_code: "ECONNRESET" }
    });
    expect(result.classification).toBe("SERVER_REQUEST_STARTED_RESPONSE_NOT_FINISHED");
  });

  it("classifies missing server request starts and socket errors fail-closed", async () => {
    const { classifyHttpBoundary } = await loadCorrelator();
    expect(
      classifyHttpBoundary({
        events: [],
        failure: { request_id: "req-1", error_code: "ECONNRESET" }
      }).classification
    ).toBe("NO_SERVER_REQUEST_START");
    expect(
      classifyHttpBoundary({
        events: [
          event("http_request_start"),
          event("http_socket_error", { error_code: "ECONNRESET" })
        ],
        failure: { request_id: "req-1", error_code: "ECONNRESET" }
      }).classification
    ).toBe("SERVER_SOCKET_OR_CLIENT_ERROR");
  });

  it("does not treat a missing failure as a successful boundary observation", async () => {
    const { classifyHttpBoundary } = await loadCorrelator();
    expect(
      classifyHttpBoundary({
        events: [event("http_request_start"), event("http_response_finish")],
        failure: null
      }).classification
    ).toBe("NO_FAILURE_IN_VALID_OBSERVATION");
  });

  it("does not echo untrusted error messages or query values", async () => {
    const { classifyHttpBoundary } = await loadCorrelator();
    const result = classifyHttpBoundary({
      events: [event("http_request_start", { path_template: "/api/v1/resource" })],
      failure: { request_id: "req-1", error_code: "ECONNRESET", message: "Cookie: secret" }
    });
    expect(JSON.stringify(result)).not.toContain("Cookie");
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});
