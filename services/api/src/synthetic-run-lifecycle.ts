import type {
  AuditLog,
  CurrentUser,
  Round,
  Run,
  SyntheticRunLifecycleControlDTO,
  SyntheticRunLifecycleOperation,
  SyntheticRunLifecycleOperationResultDTO,
  SyntheticRunLifecycleState
} from "@simwar/shared-contracts";
import { actorHasPermission } from "@simwar/shared-contracts";
import type { RepositoryProvider, RepositoryProviderMode } from "./repository-provider.js";
import type { RuntimeEnvironment } from "./runtime-security-config.js";
export const SYNTHETIC_JSON_INTERNAL_MARKER = "synthetic_json_internal.v1";
export const SYNTHETIC_LIFECYCLE_ALLOWLIST_VERSION = "synthetic-presettlement.v1";
const LIFECYCLE_RESOURCE_TYPE = "synthetic_run_lifecycle";
const LIFECYCLE_ACTION_PREFIX = "run.lifecycle.";
const AUDIT_STATE: Record<string, SyntheticRunLifecycleState> = {
  "run.lifecycle.abort": "ABORTED",
  "run.lifecycle.cleanup": "CLEANED",
  "run.lifecycle.reset": "RESET_READY"
};
const INTERNAL_ENVIRONMENTS = new Set<RuntimeEnvironment>(["development", "test"]);
const RESET_EPHEMERAL_ALLOWLIST = ["round_lock_control"] as const;
const TARGET_STATE: Record<SyntheticRunLifecycleOperation, SyntheticRunLifecycleState> = {
  abort: "ABORTED",
  cleanup: "CLEANED",
  reset: "RESET_READY"
};
const SOURCE_STATES: Record<SyntheticRunLifecycleOperation, SyntheticRunLifecycleState[]> = {
  abort: ["ACTIVE", "RESET_READY"],
  cleanup: ["ABORTED", "RESET_READY"],
  reset: ["ABORTED"]
};
const ALLOWED_BY_STATE: Record<SyntheticRunLifecycleState, SyntheticRunLifecycleOperation[]> = {
  ABORTED: ["reset", "cleanup"],
  ACTIVE: ["abort"],
  CLEANED: [],
  RESET_READY: ["abort", "cleanup"]
};
const PRESERVED_STATE = [
  "tenant_course_run_identity",
  "decision_evidence",
  "audit_and_security_history",
  "settlement_and_official_result",
  "score_and_rank",
  "truth_hashes",
  "replay_evidence_and_references",
  "scenario_and_parameter_set_identity"
] as const;
const EXPLICIT_NON_PROOFS = [
  "abort_is_not_rollback",
  "reset_is_not_restore_or_recovery",
  "cleanup_is_not_purge_or_durable_cleanup",
  "json_runtime_is_not_postgresql_parity",
  "idempotency_is_not_durable_transaction_proof"
] as const;

interface LifecycleSnapshot {
  evidenceFrozen: boolean;
  latestLifecycleAudit: AuditLog | null;
  prePublication: boolean;
  preSettlement: boolean;
  rounds: Round[];
  run: Run;
  state: SyntheticRunLifecycleState;
  synthetic: boolean;
}

export class SyntheticRunLifecycleError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "SyntheticRunLifecycleError";
  }
}
function reject(statusCode: number, code: string, message: string): never {
  throw new SyntheticRunLifecycleError(statusCode, code, message);
}
export function isSyntheticJsonInternalRuntime(
  mode: RepositoryProviderMode,
  environment: RuntimeEnvironment
): boolean {
  return mode === "json" && INTERNAL_ENVIRONMENTS.has(environment);
}
export function createSyntheticRunCreationAuditMarker(
  mode: RepositoryProviderMode,
  environment: RuntimeEnvironment
): Record<string, unknown> {
  return isSyntheticJsonInternalRuntime(mode, environment)
    ? {
        lifecycle_state: "ACTIVE",
        synthetic_runtime_classification: SYNTHETIC_JSON_INTERNAL_MARKER
      }
    : {};
}
function lifecycleStateFromAudit(audit: AuditLog): SyntheticRunLifecycleState | null {
  return audit.resource_type === LIFECYCLE_RESOURCE_TYPE
    ? (AUDIT_STATE[audit.action] ?? null)
    : null;
}
function latestLifecycleAudit(audits: AuditLog[]): AuditLog | null {
  return audits.filter((audit) => lifecycleStateFromAudit(audit) !== null).at(-1) ?? null;
}
function hasSyntheticCreationMarker(audits: AuditLog[]): boolean {
  return audits.some(
    (audit) =>
      audit.action === "run.create" &&
      audit.resource_type === "run" &&
      audit.after?.synthetic_runtime_classification === SYNTHETIC_JSON_INTERNAL_MARKER
  );
}
async function readRunAudits(
  provider: RepositoryProvider,
  tenantId: string,
  runId: string
): Promise<AuditLog[]> {
  return provider.facade.auditLogs.listAuditLogs({
    resource_id: runId,
    scope: "tenant",
    tenant_id: tenantId
  });
}
async function readLifecycleSnapshot(
  provider: RepositoryProvider,
  environment: RuntimeEnvironment,
  tenantId: string,
  courseId: string,
  runId: string
): Promise<LifecycleSnapshot> {
  const run = await provider.facade.runs.getRun(tenantId, runId);
  if (!run || run.course_id !== courseId) {
    throw new SyntheticRunLifecycleError(404, "RUN-404-001", "run not found");
  }
  const [rounds, audits] = await Promise.all([
    provider.facade.rounds.listRoundsForRun(tenantId, runId),
    readRunAudits(provider, tenantId, runId)
  ]);
  const settlementResultCount = (
    await Promise.all(
      rounds.map((round) =>
        provider.facade.settlements.listSettlementResultsForRound(tenantId, runId, round.round_id)
      )
    )
  ).flat().length;
  const latestAudit = latestLifecycleAudit(audits);
  const state = latestAudit ? lifecycleStateFromAudit(latestAudit) : "ACTIVE";
  if (!state) {
    reject(409, "LIFECYCLE-409-007", "run lifecycle state is unavailable");
  }
  const hasSettledRound = rounds.some(
    (round) => round.status === "settled" || round.status === "published"
  );
  const hasPublishedRound = rounds.some((round) => round.status === "published");
  const hasReplayReference = rounds.some((round) => Boolean(round.replay_hash));
  return {
    evidenceFrozen: latestAudit?.after?.evidence_frozen === true,
    latestLifecycleAudit: latestAudit,
    prePublication: !hasPublishedRound,
    preSettlement: settlementResultCount === 0 && !hasSettledRound && !hasReplayReference,
    rounds,
    run,
    state,
    synthetic:
      isSyntheticJsonInternalRuntime(provider.mode, environment) &&
      hasSyntheticCreationMarker(audits)
  };
}
function blockedReasons(snapshot: LifecycleSnapshot): string[] {
  const reasons: string[] = [];
  if (!snapshot.synthetic) reasons.push("not_synthetic_json_internal");
  if (snapshot.run.status !== "active") reasons.push("run_not_active");
  if (!snapshot.preSettlement) reasons.push("settlement_or_replay_state_present");
  if (!snapshot.prePublication) reasons.push("published_state_present");
  if (snapshot.state === "CLEANED") reasons.push("run_cleaned");
  return reasons;
}
function allowedOperations(snapshot: LifecycleSnapshot): SyntheticRunLifecycleOperation[] {
  if (blockedReasons(snapshot).length > 0) {
    return [];
  }
  return ALLOWED_BY_STATE[snapshot.state].filter(
    (operation) => operation !== "cleanup" || snapshot.evidenceFrozen
  );
}
function toControlDto(snapshot: LifecycleSnapshot): SyntheticRunLifecycleControlDTO {
  return {
    allowed_operations: allowedOperations(snapshot),
    audit_reference: snapshot.latestLifecycleAudit?.audit_id ?? null,
    blocked_reasons: blockedReasons(snapshot),
    course_id: snapshot.run.course_id,
    evidence_frozen: snapshot.evidenceFrozen,
    ephemeral_artifact_allowlist: [...RESET_EPHEMERAL_ALLOWLIST],
    explicit_non_proofs: [...EXPLICIT_NON_PROOFS],
    lifecycle_state: snapshot.state,
    pre_publication: snapshot.prePublication,
    pre_settlement: snapshot.preSettlement,
    preserved_state: [...PRESERVED_STATE],
    run_id: snapshot.run.run_id,
    runtime_boundary: "JSON_INTERNAL_ONLY",
    synthetic_marker: snapshot.synthetic,
    tenant_id: snapshot.run.tenant_id
  };
}
function assertOperatorAuthority(actor: CurrentUser, tenantId: string): void {
  if (
    actor.tenant_id !== tenantId ||
    !actor.roles.includes("tenant_admin") ||
    !actorHasPermission(actor, "run:lifecycle")
  ) {
    reject(403, "AUTHZ-403-001", "run lifecycle controls require tenant admin authority");
  }
}
function assertRuntime(provider: RepositoryProvider, environment: RuntimeEnvironment): void {
  if (!isSyntheticJsonInternalRuntime(provider.mode, environment)) {
    reject(409, "LIFECYCLE-409-001", "run lifecycle controls require the internal JSON runtime");
  }
}
function assertCommonOperationBoundary(snapshot: LifecycleSnapshot): void {
  if (!snapshot.synthetic) {
    reject(409, "LIFECYCLE-409-002", "run is not eligible for synthetic lifecycle controls");
  }
  if (snapshot.run.status !== "active" || !snapshot.preSettlement || !snapshot.prePublication) {
    reject(409, "LIFECYCLE-409-003", "run lifecycle controls require an active pre-settlement run");
  }
}
async function appendLifecycleAudit(
  provider: RepositoryProvider,
  input: {
    actor: CurrentUser;
    afterState: SyntheticRunLifecycleState;
    beforeState: SyntheticRunLifecycleState;
    changedArtifacts: string[];
    operation: SyntheticRunLifecycleOperation;
    requestId: string;
    snapshot: LifecycleSnapshot;
  }
): Promise<void> {
  const audit: AuditLog = {
    action: `${LIFECYCLE_ACTION_PREFIX}${input.operation}`,
    actor_id: input.actor.user_id,
    actor_role: "tenant_admin",
    after: {
      allowlist_version: SYNTHETIC_LIFECYCLE_ALLOWLIST_VERSION,
      ephemeral_artifacts_changed: input.changedArtifacts,
      evidence_frozen: true,
      lifecycle_state: input.afterState,
      synthetic_runtime_classification: SYNTHETIC_JSON_INTERNAL_MARKER
    },
    audit_id: provider.idGenerator.createAuditLogId(),
    before: {
      lifecycle_state: input.beforeState
    },
    created_at: new Date().toISOString(),
    request_id: input.requestId,
    resource_id: input.snapshot.run.run_id,
    resource_type: LIFECYCLE_RESOURCE_TYPE,
    tenant_id: input.snapshot.run.tenant_id
  };
  await provider.facade.auditLogs.appendAuditLog(audit);
}
export async function listSyntheticRunLifecycleControls(input: {
  actor: CurrentUser;
  environment: RuntimeEnvironment;
  provider: RepositoryProvider;
  tenantId: string;
}): Promise<SyntheticRunLifecycleControlDTO[]> {
  assertOperatorAuthority(input.actor, input.tenantId);
  assertRuntime(input.provider, input.environment);
  const courses = await input.provider.facade.courses.listCoursesForTenant(input.tenantId);
  const runs = (
    await Promise.all(
      courses.map((course) =>
        input.provider.facade.runs.listRunsForCourse(input.tenantId, course.course_id)
      )
    )
  ).flat();
  return Promise.all(
    runs.map(async (run) =>
      toControlDto(
        await readLifecycleSnapshot(
          input.provider,
          input.environment,
          input.tenantId,
          run.course_id,
          run.run_id
        )
      )
    )
  );
}
export async function executeSyntheticRunLifecycleOperation(input: {
  actor: CurrentUser;
  courseId: string;
  environment: RuntimeEnvironment;
  operation: SyntheticRunLifecycleOperation;
  provider: RepositoryProvider;
  requestId: string;
  runId: string;
  tenantId: string;
}): Promise<SyntheticRunLifecycleOperationResultDTO> {
  assertOperatorAuthority(input.actor, input.tenantId);
  assertRuntime(input.provider, input.environment);
  const snapshot = await readLifecycleSnapshot(
    input.provider,
    input.environment,
    input.tenantId,
    input.courseId,
    input.runId
  );
  assertCommonOperationBoundary(snapshot);
  if (snapshot.state === TARGET_STATE[input.operation]) {
    return {
      control: toControlDto(snapshot),
      ephemeral_artifacts_changed: [],
      idempotent: true,
      operation: input.operation
    };
  }
  if (!SOURCE_STATES[input.operation].includes(snapshot.state)) {
    reject(
      409,
      "LIFECYCLE-409-004",
      "run lifecycle operation is not allowed from the current state"
    );
  }
  if (input.operation === "cleanup" && !snapshot.evidenceFrozen) {
    reject(409, "LIFECYCLE-409-005", "cleanup requires frozen evidence");
  }
  const changedArtifacts: string[] = [];
  if (input.operation === "reset") {
    for (const round of snapshot.rounds) {
      if (round.status !== "locked") continue;
      const preservedRound = { ...round };
      delete preservedRound.decision_batch_id;
      await input.provider.facade.rounds.saveRound({ ...preservedRound, status: "open" });
      if (!changedArtifacts.includes("round_lock_control")) {
        changedArtifacts.push("round_lock_control");
      }
    }
  }
  const afterState = TARGET_STATE[input.operation];
  await appendLifecycleAudit(input.provider, {
    actor: input.actor,
    afterState,
    beforeState: snapshot.state,
    changedArtifacts,
    operation: input.operation,
    requestId: input.requestId,
    snapshot
  });
  const after = await readLifecycleSnapshot(
    input.provider,
    input.environment,
    input.tenantId,
    input.courseId,
    input.runId
  );
  return {
    control: toControlDto(after),
    ephemeral_artifacts_changed: changedArtifacts,
    idempotent: false,
    operation: input.operation
  };
}
export async function assertRunLifecycleAllowsProgress(input: {
  provider: RepositoryProvider;
  runId: string;
  tenantId: string;
}): Promise<void> {
  const audits = await readRunAudits(input.provider, input.tenantId, input.runId);
  const latestAudit = latestLifecycleAudit(audits);
  const state = latestAudit ? lifecycleStateFromAudit(latestAudit) : "ACTIVE";
  if (state === "ABORTED" || state === "CLEANED") {
    reject(409, "LIFECYCLE-409-006", "run lifecycle does not allow this operation");
  }
}
