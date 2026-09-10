import { channel } from "node:diagnostics_channel";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

describe("O7 HTTP boundary observer", () => {
  const loadObserver = () =>
    import(pathToFileURL(resolve("scripts/o7-http-boundary-observer.mjs")).href);

  it("captures allowlisted request and response lifecycle metadata without query values", async () => {
    const { createHttpBoundaryObserver } = await loadObserver();
    const events: Array<Record<string, unknown>> = [];
    const observer = createHttpBoundaryObserver({
      emit: (event: Record<string, unknown>) => events.push(event)
    });
    const request = { method: "GET", url: "/api/v1/bff/teacher/model-qualification?token=secret" };
    const response = { statusCode: 200 };

    observer.start();
    channel("http.server.request.start").publish({ request });
    channel("http.server.response.created").publish({ request, response });
    channel("http.server.response.finish").publish({ request, response });
    observer.stop();

    expect(events.map((event) => event.event_type)).toEqual([
      "http_request_start",
      "http_response_created",
      "http_response_finish"
    ]);
    expect(events[0]).toEqual(
      expect.objectContaining({
        method: "GET",
        path_template: "/api/v1/bff/teacher/model-qualification"
      })
    );
    expect(JSON.stringify(events)).not.toContain("token");
    expect(JSON.stringify(events)).not.toContain("secret");
    expect(events[2]).toEqual(expect.objectContaining({ status_code: 200 }));
  });

  it("records safe socket/error lifecycle classes without retaining messages or packets", async () => {
    const { createHttpBoundaryObserver } = await loadObserver();
    const events: Array<Record<string, unknown>> = [];
    const observer = createHttpBoundaryObserver({
      emit: (event: Record<string, unknown>) => events.push(event)
    });
    const request = { method: "GET", url: "/healthz" };
    const socket = {};

    observer.start();
    channel("http.server.request.start").publish({ request });
    channel("http.server.request.error").publish({
      request,
      error: { code: "ECONNRESET", message: "Authorization: Bearer secret" }
    });
    channel("net.socket.error").publish({
      socket,
      error: { code: "ECONNRESET", message: "packet secret" }
    });
    observer.stop();

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event_type: "http_request_error", error_code: "ECONNRESET" }),
        expect.objectContaining({ event_type: "http_socket_error", error_code: "ECONNRESET" })
      ])
    );
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("Authorization");
    expect(serialized).not.toContain("Bearer");
    expect(serialized).not.toContain("packet");
    expect(serialized).not.toContain("secret");
  });

  it("subscribes only to the bounded HTTP/socket diagnostic channel allowlist", async () => {
    const { DIAGNOSTICS_CHANNELS, createHttpBoundaryObserver } = await loadObserver();
    const observer = createHttpBoundaryObserver();
    expect(DIAGNOSTICS_CHANNELS).toEqual(
      expect.arrayContaining([
        "http.server.request.start",
        "http.server.response.created",
        "http.server.response.finish",
        "http.server.request.error",
        "net.server.socket"
      ])
    );
    observer.start();
    observer.stop();
  });

  it("writes bounded JSONL through an explicit external evidence sink", async () => {
    const { createJsonlEventEmitter } = await loadObserver();
    const directory = mkdtempSync(join(tmpdir(), "o7-http-boundary-"));
    const path = join(directory, "events.jsonl");
    try {
      const sink = createJsonlEventEmitter(path, { maxBytes: 512 });
      sink.emit({ schema_version: "simwar.o7_http_boundary.v1", event_type: "test" });
      expect(readFileSync(path, "utf8")).toContain('"event_type":"test"');
      expect(sink.failed).toBe(false);
      expect(sink.bytesWritten).toBeGreaterThan(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
