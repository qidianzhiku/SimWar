import type { IncomingMessage, ServerResponse } from "node:http";
import type { CurrentUser, TransferResearchDesignInput } from "@simwar/shared-contracts";
import { TransferResearchDesignCommandService, TransferResearchDesignError } from "../transfer-research-design.js";

interface D6RouteContext { readonly requestId: string; readonly tenantId: string }
interface D6RouteRuntime { readonly transferResearchDesign: TransferResearchDesignCommandService }
interface D6RouteTools {
  readonly readJson: (request: IncomingMessage, options?: { requiredObject?: boolean }) => Promise<Record<string, unknown>>;
  readonly sendJson: (response: ServerResponse, status: number, body: unknown) => void;
  readonly createEnvelope: (context: D6RouteContext, data: unknown, message?: string) => unknown;
  readonly requireTeacher: () => CurrentUser;
  readonly requireAdmin: () => CurrentUser;
}

const exactKeys = (value: Record<string, unknown>, allowed: readonly string[]) => {
  const actual = Object.keys(value);
  return actual.length === allowed.length && actual.every((key) => allowed.includes(key));
};

function parseInput(body: Record<string, unknown>): TransferResearchDesignInput {
  if (!exactKeys(body, ["analysis_plan_ref", "course_package_ref", "d4_source_ref", "d5_source_ref", "instrument", "learning_goal_ref", "observation_windows", "outcome_measures", "provenance_source_policy", "rubric_ref", "title"]) || typeof body.instrument !== "object" || body.instrument === null || Array.isArray(body.instrument)) throw new TransferResearchDesignError("D6_RESEARCH_INPUT_INVALID");
  const instrument = body.instrument as Record<string, unknown>;
  if (!exactKeys(instrument, ["items", "source_type"])) throw new TransferResearchDesignError("D6_RESEARCH_INPUT_INVALID");
  return body as unknown as TransferResearchDesignInput;
}

function statusFor(code: string): number {
  if (code === "D6_STUDY_NOT_FOUND") return 404;
  if (code === "D6_TENANT_SCOPE_VIOLATION") return 403;
  if (code === "D6_DUPLICATE_CONFLICT") return 409;
  return 422;
}

export function isTransferResearchDesignRoute(method: string | undefined, url: URL): boolean {
  return (method === "GET" || method === "POST") && /^\/api\/v1\/bff\/(?:teacher|admin)\/transfer-research-designs(?:\/[^/]+\/synthetic-preview|\/preview|\/freeze)?$/.test(url.pathname);
}

export async function handleTransferResearchDesignRoute(runtime: D6RouteRuntime, request: IncomingMessage, response: ServerResponse, url: URL, context: D6RouteContext, tools: D6RouteTools): Promise<boolean> {
  if (!isTransferResearchDesignRoute(request.method, url)) return false;
  const isTeacher = url.pathname.startsWith("/api/v1/bff/teacher/");
  const actor = isTeacher ? tools.requireTeacher() : tools.requireAdmin();
  try {
    const prefix = isTeacher ? "/api/v1/bff/teacher/transfer-research-designs" : "/api/v1/bff/admin/transfer-research-designs";
    if (request.method === "GET" && url.pathname === prefix) {
      tools.sendJson(response, 200, tools.createEnvelope(context, await runtime.transferResearchDesign.list(context.tenantId)));
      return true;
    }
    if (request.method === "POST" && (url.pathname === `${prefix}/preview` || url.pathname === `${prefix}/freeze`)) {
      const input = parseInput(await tools.readJson(request, { requiredObject: true }));
      if (url.pathname.endsWith("/preview")) {
        tools.sendJson(response, 200, tools.createEnvelope(context, await runtime.transferResearchDesign.preview(context.tenantId, input)));
      } else {
        const result = await runtime.transferResearchDesign.freeze({ actor_id: actor.user_id, tenant_id: context.tenantId }, input);
        tools.sendJson(response, 201, tools.createEnvelope(context, result.bundle, result.status));
      }
      return true;
    }
    const match = new RegExp(`^${prefix.replaceAll("/", "\\/")}\\/([^/]+)\\/synthetic-preview$`).exec(url.pathname);
    if (request.method === "GET" && match?.[1]) {
      tools.sendJson(response, 200, tools.createEnvelope(context, await runtime.transferResearchDesign.syntheticPreview({ actor_id: actor.user_id, tenant_id: context.tenantId }, match[1])));
      return true;
    }
    return false;
  } catch (error) {
    if (!(error instanceof TransferResearchDesignError)) throw error;
    tools.sendJson(response, statusFor(error.code), { request_id: context.requestId, code: error.code, message: "D6 transfer research operation rejected", details: [] });
    return true;
  }
}
