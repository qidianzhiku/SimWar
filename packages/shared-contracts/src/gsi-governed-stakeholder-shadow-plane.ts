export const GSI_STAKEHOLDER_SHADOW_SCHEMA_VERSION = "gsi.governed.stakeholder.shadow.v1" as const;
export const GSI_RESOLVER_VERSION = "gsi-deterministic-resolver-v1" as const;
export const GSI_PROVIDER = "OFF" as const;

export const GSI_STAKEHOLDER_TYPES = [
  "customer",
  "regulator",
  "bank",
  "employee",
  "media"
] as const;
export type GSIStakeholderType = (typeof GSI_STAKEHOLDER_TYPES)[number];

export const GSI_INTENTS = [
  "protect_demand",
  "reduce_regulatory_risk",
  "preserve_liquidity",
  "retain_workforce",
  "protect_reputation"
] as const;
export type GSIIntent = (typeof GSI_INTENTS)[number];

export type GSIPlaneMode = "OFF" | "SHADOW";
export type GSIPublicationStatus = "DRAFT" | "PUBLISHED";
export type GSIRequestStatus = "generated" | "reused";

export interface GSIExactBinding {
  tenant_id: string;
  course_id: string;
  run_id: string;
  round_id: string;
  team_id: string;
  scenario_package_id: string;
  scenario_version: string;
  parameter_set_id: string;
  parameter_set_version: string;
  model_version_id: string;
  model_version: string;
  model_artifact_id: string;
  model_artifact_version: string;
}

export interface GSIProposal {
  proposal_id: string;
  stakeholder_type: GSIStakeholderType;
  intent: GSIIntent;
  priority: number;
  influence: number;
  summary: string;
}

export interface GSIRequest {
  discriminator: "gsi_stakeholder_shadow_request";
  binding: GSIExactBinding;
  plane_mode: GSIPlaneMode;
  publication_status: GSIPublicationStatus;
  proposals: GSIProposal[];
  idempotency_key: string;
}

export interface GSISignal {
  signal_id: string;
  stakeholder_type: GSIStakeholderType;
  intent: GSIIntent;
  bounded_value: number;
  source_proposal_count: number;
}

export interface GSIAbstention {
  proposal_id: string;
  reason: "non_finite" | "out_of_bounds" | "duplicate";
}

export interface GSIResolverResult {
  resolver_version: typeof GSI_RESOLVER_VERSION;
  accepted_proposal_ids: string[];
  signals: GSISignal[];
  abstentions: GSIAbstention[];
  outside_option: number;
  candidate_value: number;
  resolver_digest: string;
  signal_digest: string;
  candidate_digest: string;
}

export interface GSITeacherProjection {
  surface: "teacher";
  summary: string;
  advisory_text: string;
  known_limits: string[];
}

import type { RoleId } from "./index.js";

export interface GSIStudentProjection {
  surface: "student";
  role_key?: RoleId;
  summary: string;
  signals: Pick<GSISignal, "stakeholder_type" | "intent" | "bounded_value">[];
  abstentions: Pick<GSIAbstention, "reason">[];
  known_limits: string[];
}

export interface GSIAdminProjection {
  surface: "admin";
  tenant_id: string;
  binding: GSIExactBinding;
  plane_mode: GSIPlaneMode;
  provider: typeof GSI_PROVIDER;
  resolver_digest: string;
  signal_digest: string;
  candidate_digest: string;
  writes_official_truth: false;
  known_limits: string[];
}

export interface GSIReceipt {
  discriminator: "gsi_stakeholder_shadow_receipt";
  status: GSIRequestStatus;
  request_id: string;
  candidate_id: string;
  request_digest: string;
  binding: GSIExactBinding;
  plane_mode: GSIPlaneMode;
  publication_status: GSIPublicationStatus;
  resolver: GSIResolverResult;
  teacher_projection: GSITeacherProjection;
  formal_truth_write: false;
  writes_official_truth: false;
  provider: typeof GSI_PROVIDER;
  known_limits: string[];
}

export interface GSIRecord {
  discriminator: "gsi_stakeholder_shadow_record";
  tenant_id: string;
  candidate_id: string;
  actor_id_hash: string;
  idempotency_key: string;
  request_digest: string;
  request: GSIRequest;
  resolver: GSIResolverResult;
  teacher_projection: GSITeacherProjection;
  student_projection: GSIStudentProjection;
  admin_projection: GSIAdminProjection;
  created_at: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function isExactReference(value: unknown): value is string {
  return isString(value) && !["latest", "default"].includes(value.toLowerCase());
}

function isBinding(value: unknown): value is GSIExactBinding {
  if (!isRecord(value)) return false;
  const keys = [
    "tenant_id",
    "course_id",
    "run_id",
    "round_id",
    "team_id",
    "scenario_package_id",
    "scenario_version",
    "parameter_set_id",
    "parameter_set_version",
    "model_version_id",
    "model_version",
    "model_artifact_id",
    "model_artifact_version"
  ];
  return (
    Object.keys(value).sort().join("|") === keys.slice().sort().join("|") &&
    keys.every((key) => isExactReference(value[key]))
  );
}

function isProposal(value: unknown): value is GSIProposal {
  if (!isRecord(value)) return false;
  const keys = ["proposal_id", "stakeholder_type", "intent", "priority", "influence", "summary"];
  return (
    Object.keys(value).sort().join("|") === keys.sort().join("|") &&
    isString(value.proposal_id) &&
    GSI_STAKEHOLDER_TYPES.includes(value.stakeholder_type as GSIStakeholderType) &&
    GSI_INTENTS.includes(value.intent as GSIIntent) &&
    typeof value.priority === "number" &&
    Number.isFinite(value.priority) &&
    value.priority >= 0 &&
    value.priority <= 1 &&
    typeof value.influence === "number" &&
    Number.isFinite(value.influence) &&
    value.influence >= -1 &&
    value.influence <= 1 &&
    isString(value.summary) &&
    value.summary.length <= 240
  );
}

export function isGSIRequest(value: unknown): value is GSIRequest {
  if (!isRecord(value)) return false;
  const keys = [
    "discriminator",
    "binding",
    "plane_mode",
    "publication_status",
    "proposals",
    "idempotency_key"
  ];
  return (
    Object.keys(value).sort().join("|") === keys.slice().sort().join("|") &&
    value.discriminator === "gsi_stakeholder_shadow_request" &&
    isBinding(value.binding) &&
    (value.plane_mode === "OFF" || value.plane_mode === "SHADOW") &&
    (value.publication_status === "DRAFT" || value.publication_status === "PUBLISHED") &&
    Array.isArray(value.proposals) &&
    value.proposals.length >= 1 &&
    value.proposals.length <= 5 &&
    value.proposals.every(isProposal) &&
    isString(value.idempotency_key)
  );
}

export function isGSIReceipt(value: unknown): value is GSIReceipt {
  if (!isRecord(value)) return false;
  return (
    value.discriminator === "gsi_stakeholder_shadow_receipt" &&
    (value.status === "generated" || value.status === "reused") &&
    isString(value.request_id) &&
    isString(value.candidate_id) &&
    /^[a-f0-9]{64}$/.test(String(value.request_digest)) &&
    isBinding(value.binding) &&
    (value.plane_mode === "OFF" || value.plane_mode === "SHADOW") &&
    (value.publication_status === "DRAFT" || value.publication_status === "PUBLISHED") &&
    isRecord(value.resolver) &&
    isRecord(value.teacher_projection) &&
    value.formal_truth_write === false &&
    value.writes_official_truth === false &&
    value.provider === "OFF" &&
    Array.isArray(value.known_limits)
  );
}
