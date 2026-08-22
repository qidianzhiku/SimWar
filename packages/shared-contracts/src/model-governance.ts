export const MODEL_GOVERNANCE_SCHEMA_VERSION = "model-governance-plane.v1" as const;
export const MODEL_GOVERNANCE_AUTHORITY_ID = "SIMWAR-MODEL-GOVERNANCE-PLANE" as const;
export const MODEL_GOVERNANCE_SOLE_WRITER = "MAIN_MODEL_GOVERNANCE" as const;

export const MODEL_GOVERNANCE_FORBIDDEN_WRITERS = [
  "AGT",
  "SH",
  "FE",
  "TEACHER",
  "STUDENT",
  "MODEL_PROVIDER",
  "SIMULATION_CORE",
  "PARAMETER_SET",
  "FRONTEND"
] as const;

export const MODEL_VERSION_STATUSES = [
  "DRAFT",
  "VALIDATED",
  "FROZEN",
  "APPROVED",
  "ACTIVE",
  "RETIRED"
] as const;

export type ModelVersionStatus = (typeof MODEL_VERSION_STATUSES)[number];
export type ModelGovernanceWriter =
  | typeof MODEL_GOVERNANCE_SOLE_WRITER
  | (typeof MODEL_GOVERNANCE_FORBIDDEN_WRITERS)[number];

export type ModelGovernanceFailureCode =
  | "MODEL_VERSION_REFERENCE_INVALID"
  | "MODEL_VERSION_INVALID_TRANSITION"
  | "MODEL_GOVERNANCE_WRITER_FORBIDDEN";

export interface ModelVersionReference {
  content_digest: string;
  model_version_id: string;
  version: string;
}

export interface ModelVersionReferenceInput {
  content_digest: string;
  model_version_id: string;
  version: string;
}

export interface ModelSpecReference {
  content_digest: string;
  model_spec_id: string;
  version: string;
}

export interface ModelArtifactReference {
  artifact_id: string;
  content_digest: string;
  format: string;
  source_ref: string;
}

export interface ModelCompatibility {
  feature_mapper_version: string;
  parameter_model_families: readonly string[];
  parameter_schema_versions: readonly string[];
  solver_version: string;
}

export interface ModelSpec {
  content_digest: string;
  created_at: string;
  created_by: string;
  feature_mapper_version: string;
  model_family: "toy_logit" | "blp" | "rcnl" | "w5_governed" | "custom";
  model_spec_id: string;
  parameter_schema_versions: readonly string[];
  solver_version: string;
  status: "DRAFT" | "VALIDATED" | "FROZEN" | "APPROVED" | "RETIRED";
  version: string;
}

export interface ModelVersion {
  artifact: ModelArtifactReference;
  compatibility: ModelCompatibility;
  content_digest: string;
  created_at: string;
  created_by: string;
  model_family: ModelSpec["model_family"];
  model_spec_reference: ModelSpecReference;
  model_version_id: string;
  no_implicit_latest: true;
  status: ModelVersionStatus;
  supersedes?: ModelVersionReference;
  version: string;
}

export interface ModelExperiment {
  created_at: string;
  created_by: string;
  experiment_id: string;
  input_digest: string;
  model_version_reference: ModelVersionReference;
  output_digest?: string;
  status: "DRAFT" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
}

export interface CalibrationRun {
  calibration_run_id: string;
  completed_at?: string;
  failure_reason?: string;
  input_digest: string;
  model_version_reference: ModelVersionReference;
  output_digest?: string;
  started_at: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
}

export interface ModelApproval {
  approval_id: string;
  approved_at: string;
  approved_by: string;
  correlation_id: string;
  decision: "APPROVED" | "REJECTED";
  evidence_refs: readonly string[];
  model_version_reference: ModelVersionReference;
}

export interface ModelActivation {
  activation_id: string;
  environment: "OFFLINE" | "SHADOW" | "INTERNAL";
  evidence_refs: readonly string[];
  model_version_reference: ModelVersionReference;
  requested_at: string;
  requested_by: string;
  runtime_activation: false;
  status: "PROPOSED" | "APPROVED" | "CANCELLED" | "ROLLED_BACK";
}

export interface ModelRetirement {
  model_version_reference: ModelVersionReference;
  reason: string;
  retirement_id: string;
  retired_at: string;
  retired_by: string;
  status: "PROPOSED" | "RETIRED";
}

export interface ModelRollback {
  executed_at?: string;
  from_model_version_reference: ModelVersionReference;
  reason: string;
  requested_at: string;
  requested_by: string;
  rollback_id: string;
  runtime_activation: false;
  status: "PROPOSED" | "APPROVED" | "EXECUTED" | "REJECTED";
  to_model_version_reference: ModelVersionReference;
}

export interface ModelGovernanceAuthority {
  activation_policy: "NOT_AUTHORIZED";
  authority_id: typeof MODEL_GOVERNANCE_AUTHORITY_ID;
  no_implicit_latest: true;
  official_truth_writer: false;
  provider_calls: 0;
  runtime_authority: "JSON_INTERNAL_ONLY";
  sole_writer: typeof MODEL_GOVERNANCE_SOLE_WRITER;
}

export interface ModelGovernancePlane {
  activations: readonly ModelActivation[];
  approvals: readonly ModelApproval[];
  authority: ModelGovernanceAuthority;
  calibration_runs: readonly CalibrationRun[];
  experiments: readonly ModelExperiment[];
  model_specs: readonly ModelSpec[];
  model_versions: readonly ModelVersion[];
  retirements: readonly ModelRetirement[];
  rollbacks: readonly ModelRollback[];
  schema_version: typeof MODEL_GOVERNANCE_SCHEMA_VERSION;
}

export class ModelGovernanceError extends Error {
  readonly code: ModelGovernanceFailureCode;

  constructor(code: ModelGovernanceFailureCode) {
    super(code);
    this.code = code;
    this.name = "ModelGovernanceError";
  }
}

function isNonBlankString(value: string): boolean {
  return value.trim().length > 0;
}

function isExactSemver(value: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value);
}

function isDigest(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

export function createModelVersionReference(
  input: ModelVersionReferenceInput
): ModelVersionReference {
  if (
    !isNonBlankString(input.model_version_id) ||
    !isExactSemver(input.version) ||
    !isDigest(input.content_digest)
  ) {
    throw new ModelGovernanceError("MODEL_VERSION_REFERENCE_INVALID");
  }

  return Object.freeze({
    content_digest: input.content_digest,
    model_version_id: input.model_version_id,
    version: input.version
  });
}

const MODEL_VERSION_TRANSITIONS: Readonly<
  Record<ModelVersionStatus, readonly ModelVersionStatus[]>
> = {
  ACTIVE: ["RETIRED"],
  APPROVED: ["ACTIVE", "RETIRED"],
  DRAFT: ["VALIDATED"],
  FROZEN: ["APPROVED"],
  RETIRED: [],
  VALIDATED: ["FROZEN"]
};

export function canTransitionModelVersionStatus(
  current: ModelVersionStatus,
  next: ModelVersionStatus
): boolean {
  return MODEL_VERSION_TRANSITIONS[current].includes(next);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }

  return value;
}

export function transitionModelVersionStatus(
  version: ModelVersion,
  next: ModelVersionStatus
): ModelVersion {
  if (!canTransitionModelVersionStatus(version.status, next)) {
    throw new ModelGovernanceError("MODEL_VERSION_INVALID_TRANSITION");
  }

  const transitioned = JSON.parse(JSON.stringify(version)) as ModelVersion;
  transitioned.status = next;
  return deepFreeze(transitioned);
}

export function assertModelGovernanceWriter(
  writer: string
): asserts writer is ModelGovernanceWriter {
  if (writer !== MODEL_GOVERNANCE_SOLE_WRITER) {
    throw new ModelGovernanceError("MODEL_GOVERNANCE_WRITER_FORBIDDEN");
  }
}
