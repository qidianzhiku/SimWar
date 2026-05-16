export type ActorRole = "student" | "teacher" | "admin" | "service";

export type HealthStatus = "ok" | "degraded";

export interface HealthPayload {
  service: string;
  status: HealthStatus;
  version: string;
  timestamp: string;
  truthBoundary: "structured-core-only";
}

export interface AgentRequest<TPayload = Record<string, unknown>> {
  agentType: "MarketStrategy" | "Operations" | "Coach" | "Diagnostic";
  version: string;
  actor: {
    role: ActorRole;
    teamId?: string;
    tenantId?: string;
  };
  scenarioId: string;
  round: number;
  payload: TPayload;
}

export interface AgentResponse<TData = Record<string, unknown>> {
  code: number;
  message: string;
  data: TData & {
    advisoryOnly: true;
    confidence?: number;
  };
}

export const TRUTH_PROTECTED_FIELDS = [
  "marketShare",
  "demand",
  "cashFlow",
  "profit",
  "inventory",
  "capacity",
  "score",
  "rank",
  "settlementStatus"
] as const;

export function createHealthPayload(service: string, version = "0.1.0"): HealthPayload {
  return {
    service,
    status: "ok",
    version,
    timestamp: new Date().toISOString(),
    truthBoundary: "structured-core-only"
  };
}
