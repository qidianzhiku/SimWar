import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { getApiHealthPayload } from "./health.js";

const DEFAULT_PORT = 3000;

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function handleRequest(request: IncomingMessage, response: ServerResponse): void {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (request.method === "GET" && (url.pathname === "/healthz" || url.pathname === "/api/v1/health")) {
    sendJson(response, 200, getApiHealthPayload());
    return;
  }

  sendJson(response, 404, {
    code: 404,
    message: "not found"
  });
}

export function createApiServer() {
  return createServer(handleRequest);
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const port = Number.parseInt(process.env.API_PORT ?? "", 10) || DEFAULT_PORT;
  const server = createApiServer();

  server.listen(port, () => {
    console.log(`SimWar API listening on http://localhost:${port}`);
  });
}
