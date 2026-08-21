import type {
  AuditLog,
  Course,
  Decision,
  DomainEvent,
  ParameterSet,
  ReplayDiffReport,
  ReplayInputManifest,
  ReplayReport,
  ReplayRun,
  Round,
  Run,
  ScenarioPackage,
  SettlementResult,
  StateSnapshot,
  Team
} from "@simwar/shared-contracts";
import type {
  RepositoryCourseReadModel,
  RepositoryEventQuery,
  RepositorySessionReadModel,
  RepositorySnapshotQuery,
  RepositoryTenantReadModel,
  RepositoryUserReadModel,
  RoleWorkflowCommitCommand,
  EvidenceProvenanceCaptureCommand,
  EvidenceProvenanceRepositoryPort,
  RoleWorkflowRepositoryPort,
  SettlementOutcomeCommitResult,
  SettlementOutcomePersistencePort,
  SimWarRepositoryPorts,
  TeacherConfirmationAppendCommand,
  TeacherConfirmationRepositoryPort,
  GovernedAdvisoryRepositoryPort,
  W027DecisionExperienceCommitCommand,
  W027DecisionExperienceRepositoryPort
} from "./repository-ports.js";
import type { ValidationSessionRepositoryPort } from "./repository-ports.js";
import {
  assertValidationSessionRecord,
  type ValidationSessionRecord
} from "@simwar/shared-contracts";
import {
  InMemoryJsonParameterSetRegistry,
  type InMemoryJsonParameterSetRegistryOptions,
  type ParameterSetRegistryPort
} from "./parameter-set-authority.js";
import {
  InMemoryJsonScenarioPackageRegistry,
  type InMemoryJsonScenarioPackageRegistryOptions,
  type ScenarioPackageRegistryPort
} from "./scenario-package-authority.js";
import {
  InMemoryJsonPluginReleaseRegistry,
  type InMemoryJsonPluginReleaseRegistryOptions,
  type PluginReleaseRegistryPort
} from "./plugin-release-authority.js";
import {
  InMemoryJsonCourseBlueprintRegistry,
  type InMemoryJsonCourseBlueprintRegistryOptions,
  type CourseBlueprintRegistryPort
} from "./course-blueprint-authority.js";
import type { SimWarStore } from "./store.js";
import type { W5GovernedModelPersistence } from "./w5-governed-model-service.js";
import type { W5ScenarioDraft } from "@simwar/shared-contracts";
import {
  createSettlementBusinessKey,
  createSettlementFingerprint
} from "./settlement-idempotency.js";

/**
 * JSON-backed repository adapter for the current SimWar API store.
 *
 * This adapter is intentionally thin:
 * - It wraps the existing SimWarStore arrays.
 * - It does not change routes, settlement, replay hashing, or DB behavior.
 * - It does not introduce Postgres, migrations, package dependencies, or runtime wiring.
 * - It keeps canonical Decision and SettlementResult persistence separate from
 *   advisory, learning, or role-draft evidence.
 */

interface JsonRepositoryAdapterCollections {
  domainEvents: DomainEvent[];
  stateSnapshots: StateSnapshot[];
  replayInputManifests: ReplayInputManifest[];
  replayRuns: ReplayRun[];
  replayReports: ReplayReport[];
  replayDiffReports: ReplayDiffReport[];
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** JSON adapter boundary for D3; it is not a Truth, Settlement, or Student authority. */
export function createJsonTeacherConfirmationRepositoryPort(
  store: SimWarStore
): TeacherConfirmationRepositoryPort {
  return {
    async list(tenantId) {
      return clone(
        store.teacherConfirmationVersions.filter(
          (confirmation) => confirmation.confirmation_ref.tenant_id === tenantId
        )
      );
    },

    async append(command: TeacherConfirmationAppendCommand) {
      const previousConfirmations = clone(store.teacherConfirmationVersions);
      const previousAudits = clone(store.auditLogs);
      store.teacherConfirmationVersions.push(clone(command.confirmation));
      store.auditLogs.push(clone(command.audit_log));
      try {
        store.persist();
      } catch (error) {
        store.teacherConfirmationVersions.splice(
          0,
          store.teacherConfirmationVersions.length,
          ...previousConfirmations
        );
        store.auditLogs.splice(0, store.auditLogs.length, ...previousAudits);
        throw error;
      }
    }
  };
}

export function createJsonGovernedAdvisoryRepositoryPort(
  store: SimWarStore
): GovernedAdvisoryRepositoryPort {
  return {
    async list(tenantId) {
      return clone(
        (store.governedAdvisoryRecords ?? []).filter((record) => record.tenant_id === tenantId)
      );
    },
    async append(record) {
      const records = store.governedAdvisoryRecords ?? (store.governedAdvisoryRecords = []);
      const previous = clone(records);
      records.push(clone(record));
      try {
        store.persist();
      } catch (error) {
        records.splice(0, records.length, ...previous);
        throw error;
      }
    }
  };
}

/** JSON persistence for W5 governance-plane drafts plus their audit entries. */
export function createJsonW5GovernedModelPersistence(
  store: SimWarStore
): W5GovernedModelPersistence {
  const drafts = store.w5GovernedModelDrafts ?? (store.w5GovernedModelDrafts = []);
  return {
    listDrafts() {
      return clone(drafts);
    },
    commitDraft(draft: W5ScenarioDraft, auditLog) {
      const previousDrafts = clone(drafts);
      const previousAuditLogs = clone(store.auditLogs);
      const index = drafts.findIndex(
        (candidate) =>
          candidate.tenant_id === draft.tenant_id && candidate.draft_id === draft.draft_id
      );
      if (index >= 0) drafts[index] = clone(draft);
      else drafts.push(clone(draft));
      store.auditLogs.push(clone(auditLog));
      try {
        store.persist();
      } catch (error) {
        drafts.splice(0, drafts.length, ...previousDrafts);
        store.auditLogs.splice(0, store.auditLogs.length, ...previousAuditLogs);
        throw error;
      }
    }
  };
}

/**
 * Single JSON canonical Decision write primitive.
 *
 * Role Workflow uses it inside a larger compensating transaction, while the
 * public Decision repository port uses it for standalone canonical writes.
 */
function saveCanonicalDecisionToJsonStore(store: SimWarStore, decision: Decision): void {
  const index = store.decisions.findIndex(
    (candidate) =>
      candidate.tenant_id === decision.tenant_id && candidate.decision_id === decision.decision_id
  );

  if (index >= 0) {
    store.decisions[index] = decision;
  } else {
    store.decisions.push(decision);
  }
}

export function createJsonRoleWorkflowRepositoryPort(
  store: SimWarStore
): RoleWorkflowRepositoryPort {
  return {
    async readRoleWorkflow(query) {
      const run =
        store.runs.find(
          (candidate) =>
            candidate.tenant_id === query.tenant_id && candidate.run_id === query.run_id
        ) ?? null;
      const team =
        store.teams.find(
          (candidate) =>
            candidate.tenant_id === query.tenant_id && candidate.team_id === query.team_id
        ) ?? null;
      const round = query.round_id
        ? (store.rounds.find(
            (candidate) =>
              candidate.tenant_id === query.tenant_id &&
              candidate.run_id === query.run_id &&
              candidate.round_id === query.round_id
          ) ?? null)
        : null;
      const course = run
        ? (store.courses.find(
            (candidate) =>
              candidate.tenant_id === query.tenant_id && candidate.course_id === run.course_id
          ) ?? null)
        : null;
      const inWorkflow = (candidate: {
        tenant_id: string;
        run_id: string;
        team_id: string;
        round_id?: string;
      }) =>
        candidate.tenant_id === query.tenant_id &&
        candidate.run_id === query.run_id &&
        candidate.team_id === query.team_id &&
        (!query.round_id || !candidate.round_id || candidate.round_id === query.round_id);

      return clone({
        assignments: store.studentRoleAssignments.filter((candidate) => inWorkflow(candidate)),
        confirmations: store.teamConfirmations.filter((candidate) => inWorkflow(candidate)),
        course,
        decisions: store.decisions.filter((candidate) => inWorkflow(candidate)),
        events: store.roleWorkflowEvents.filter((candidate) => inWorkflow(candidate)),
        merge_commits: store.decisionMergeCommits.filter((candidate) => inWorkflow(candidate)),
        resolutions: store.teamResolutions.filter((candidate) => inWorkflow(candidate)),
        acknowledgements: store.resolutionAcknowledgements.filter((candidate) =>
          inWorkflow(candidate)
        ),
        round,
        run,
        sections: store.roleDecisionSections.filter((candidate) => inWorkflow(candidate)),
        team
      });
    },

    async commitRoleWorkflow(command: RoleWorkflowCommitCommand): Promise<void> {
      const previous = {
        assignments: clone(store.studentRoleAssignments),
        confirmations: clone(store.teamConfirmations),
        decisions: clone(store.decisions),
        events: clone(store.roleWorkflowEvents),
        mergeCommits: clone(store.decisionMergeCommits),
        sections: clone(store.roleDecisionSections),
        resolutions: clone(store.teamResolutions),
        acknowledgements: clone(store.resolutionAcknowledgements)
      };
      try {
        switch (command.kind) {
          case "append_assignment":
            store.studentRoleAssignments.push(clone(command.assignment));
            break;
          case "append_section":
            store.roleDecisionSections.push(clone(command.section));
            break;
          case "append_merge":
            store.decisionMergeCommits.push(clone(command.merge_commit));
            break;
          case "append_confirmation":
            store.teamConfirmations.push(clone(command.confirmation));
            saveCanonicalDecisionToJsonStore(store, clone(command.decision));
            break;
          case "append_resolution":
            store.teamResolutions.push(clone(command.resolution));
            break;
          case "append_acknowledgement":
            store.resolutionAcknowledgements.push(clone(command.acknowledgement));
            break;
          case "reset":
            for (const assignment of store.studentRoleAssignments) {
              if (command.assignment_ids.includes(assignment.assignment_id)) {
                assignment.status = "inactive";
              }
            }
            break;
        }
        store.roleWorkflowEvents.push(clone(command.event));
        store.persist();
      } catch (error) {
        store.studentRoleAssignments = previous.assignments;
        store.teamConfirmations = previous.confirmations;
        store.decisions = previous.decisions;
        store.roleWorkflowEvents = previous.events;
        store.decisionMergeCommits = previous.mergeCommits;
        store.roleDecisionSections = previous.sections;
        store.teamResolutions = previous.resolutions;
        store.resolutionAcknowledgements = previous.acknowledgements;
        throw error;
      }
    }
  };
}

export function createJsonW027DecisionExperienceRepositoryPort(
  store: SimWarStore
): W027DecisionExperienceRepositoryPort {
  const matches = (
    query: {
      tenant_id: string;
      run_id: string;
      round_id: string;
      team_id: string;
      course_id: string;
    },
    candidate: {
      tenant_id: string;
      run_id: string;
      round_id: string;
      team_id: string;
      course_id: string;
    }
  ) =>
    candidate.tenant_id === query.tenant_id &&
    candidate.course_id === query.course_id &&
    candidate.run_id === query.run_id &&
    candidate.round_id === query.round_id &&
    candidate.team_id === query.team_id;

  return {
    async readW027DecisionExperience(query) {
      return clone({
        acknowledgements: store.w027ResolutionAcknowledgements.filter((candidate) =>
          matches(query, candidate)
        ),
        private_judgments: store.w027PrivateJudgments.filter((candidate) =>
          matches(query, candidate)
        ),
        resolutions: store.w027Resolutions.filter((candidate) => matches(query, candidate)),
        role_positions: store.w027RolePositions.filter((candidate) => matches(query, candidate)),
        rosters: store.w027RoleRosters.filter(
          (candidate) =>
            candidate.tenant_id === query.tenant_id &&
            candidate.course_id === query.course_id &&
            candidate.run_id === query.run_id &&
            candidate.team_id === query.team_id
        )
      });
    },
    async commitW027DecisionExperience(command: W027DecisionExperienceCommitCommand) {
      const previous = {
        acknowledgements: clone(store.w027ResolutionAcknowledgements),
        judgments: clone(store.w027PrivateJudgments),
        positions: clone(store.w027RolePositions),
        resolutions: clone(store.w027Resolutions),
        rosters: clone(store.w027RoleRosters)
      };
      try {
        switch (command.kind) {
          case "upsert_roster": {
            const index = store.w027RoleRosters.findIndex(
              (candidate) =>
                candidate.tenant_id === command.roster.tenant_id &&
                candidate.course_id === command.roster.course_id &&
                candidate.run_id === command.roster.run_id &&
                candidate.team_id === command.roster.team_id
            );
            if (index >= 0) store.w027RoleRosters[index] = clone(command.roster);
            else store.w027RoleRosters.push(clone(command.roster));
            break;
          }
          case "append_private_judgment":
            store.w027PrivateJudgments.push(clone(command.judgment));
            break;
          case "append_role_position":
            store.w027RolePositions.push(clone(command.position));
            break;
          case "append_resolution":
            store.w027Resolutions.push(clone(command.resolution));
            break;
          case "append_acknowledgement":
            store.w027ResolutionAcknowledgements.push(clone(command.acknowledgement));
            break;
        }
        store.persist();
      } catch (error) {
        store.w027ResolutionAcknowledgements = previous.acknowledgements;
        store.w027PrivateJudgments = previous.judgments;
        store.w027RolePositions = previous.positions;
        store.w027Resolutions = previous.resolutions;
        store.w027RoleRosters = previous.rosters;
        throw error;
      }
    }
  };
}

export function createJsonEvidenceProvenanceRepositoryPort(
  store: SimWarStore
): EvidenceProvenanceRepositoryPort {
  return {
    async listEvidenceArtifacts(tenantId) {
      return clone(
        store.evidenceArtifacts.filter((artifact) => artifact.artifact_ref.tenant_id === tenantId)
      );
    },

    async listProvenanceEdges(tenantId) {
      return clone(
        store.evidenceProvenanceEdges.filter((edge) => edge.source_ref.tenant_id === tenantId)
      );
    },

    async appendEvidenceCapture(command: EvidenceProvenanceCaptureCommand) {
      const previousArtifacts = clone(store.evidenceArtifacts);
      const previousEdges = clone(store.evidenceProvenanceEdges);
      const previousAuditLogs = clone(store.auditLogs);
      store.evidenceArtifacts.push(clone(command.artifact));
      store.evidenceProvenanceEdges.push(...clone(command.provenance_edges));
      store.auditLogs.push(clone(command.audit_log));
      try {
        store.persist();
      } catch (error) {
        store.evidenceArtifacts.splice(0, store.evidenceArtifacts.length, ...previousArtifacts);
        store.evidenceProvenanceEdges.splice(
          0,
          store.evidenceProvenanceEdges.length,
          ...previousEdges
        );
        store.auditLogs.splice(0, store.auditLogs.length, ...previousAuditLogs);
        throw error;
      }
    }
  };
}

/**
 * JSON persistence seam for formal ScenarioPackage, ParameterSet, and PluginRelease authority
 * registries. It is deliberately separate from API route composition.
 */
export interface JsonFormalScenarioAuthorityPersistence {
  createCourseBlueprintRegistry(): CourseBlueprintRegistryPort;
  createParameterSetRegistry(): ParameterSetRegistryPort;
  createPluginReleaseRegistry(): PluginReleaseRegistryPort;
  createScenarioPackageRegistry(): ScenarioPackageRegistryPort;
  removeTenantBaselineMaterialization(
    materialization: JsonTenantBaselineMaterialization
  ): void | Promise<void>;
}

/**
 * The exact identities produced by one tenant-baseline materialization. This
 * private compensation input deliberately carries neither a public writer nor
 * a broad store snapshot, so rollback cannot erase unrelated authority writes.
 */
export interface JsonTenantBaselineMaterialization {
  readonly idempotencyKeyDigest: string;
  readonly parameterSet: {
    readonly approvalId: string;
    readonly parameterSetId: string;
  };
  readonly provisioningRequestDigest: string;
  readonly scenarioPackage: {
    readonly approvalId: string;
    readonly scenarioPackageId: string;
  };
  readonly tenantId: string;
}

function removeMatchingEntries<T>(
  entries: T[],
  predicate: (entry: T) => boolean
): Array<{ readonly entry: T; readonly index: number }> {
  const removed: Array<{ readonly entry: T; readonly index: number }> = [];
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry !== undefined && predicate(entry)) {
      removed.push({ entry, index });
      entries.splice(index, 1);
    }
  }
  return removed.reverse();
}

function restoreRemovedEntries<T>(
  entries: T[],
  removed: readonly { readonly entry: T; readonly index: number }[]
): void {
  for (const { entry, index } of removed) {
    entries.splice(Math.min(index, entries.length), 0, entry);
  }
}

export function createJsonFormalScenarioAuthorityPersistence(
  store: SimWarStore
): JsonFormalScenarioAuthorityPersistence {
  const parameterSetOptions: InMemoryJsonParameterSetRegistryOptions = {
    approvals: store.formalParameterSetApprovalRecords,
    onAppend: store.persist,
    snapshots: store.formalParameterSetLifecycleSnapshots
  };
  const courseBlueprintOptions: InMemoryJsonCourseBlueprintRegistryOptions = {
    approvals: store.formalCourseBlueprintApprovalRecords,
    onAppend: store.persist,
    snapshots: store.formalCourseBlueprintLifecycleSnapshots
  };
  const scenarioPackageOptions: InMemoryJsonScenarioPackageRegistryOptions = {
    approvals: store.formalScenarioPackageApprovalRecords,
    onAppend: store.persist,
    snapshots: store.formalScenarioPackageLifecycleSnapshots
  };
  const pluginReleaseOptions: InMemoryJsonPluginReleaseRegistryOptions = {
    approvals: store.formalPluginReleaseApprovalRecords,
    availability: store.formalPluginReleaseAvailabilityRecords,
    onAppend: store.persist,
    snapshots: store.formalPluginReleaseLifecycleSnapshots
  };

  const removeTenantBaselineMaterialization = (
    materialization: JsonTenantBaselineMaterialization
  ): void => {
    const matchesProvenance = (baseline: {
      baseline_provenance?: { idempotency_key_digest: string; provisioning_request_digest: string };
    }) =>
      baseline.baseline_provenance?.idempotency_key_digest ===
        materialization.idempotencyKeyDigest &&
      baseline.baseline_provenance?.provisioning_request_digest ===
        materialization.provisioningRequestDigest;
    const parameterReferenceKeys = new Set<string>();
    const scenarioReferenceKeys = new Set<string>();
    const removedParameterSnapshots = removeMatchingEntries(
      store.formalParameterSetLifecycleSnapshots,
      (version) => {
        const matches =
          version.tenant_id === materialization.tenantId &&
          version.parameter_set_id === materialization.parameterSet.parameterSetId &&
          matchesProvenance(version);
        if (matches && version.status === "APPROVED") {
          parameterReferenceKeys.add(
            `${version.reference.parameter_set_id}:${version.reference.version}:${version.reference.content_digest}`
          );
        }
        return matches;
      }
    );
    const removedScenarioSnapshots = removeMatchingEntries(
      store.formalScenarioPackageLifecycleSnapshots,
      (version) => {
        const matches =
          version.tenant_id === materialization.tenantId &&
          version.scenario_package_id === materialization.scenarioPackage.scenarioPackageId &&
          matchesProvenance(version);
        if (matches && version.status === "APPROVED") {
          scenarioReferenceKeys.add(
            `${version.reference.scenario_package_id}:${version.reference.version}:${version.reference.content_digest}`
          );
        }
        return matches;
      }
    );
    const removedParameterApprovals = removeMatchingEntries(
      store.formalParameterSetApprovalRecords,
      (record) =>
        record.tenant_id === materialization.tenantId &&
        record.approval_id === materialization.parameterSet.approvalId &&
        parameterReferenceKeys.has(
          `${record.parameter_set_reference.parameter_set_id}:${record.parameter_set_reference.version}:${record.parameter_set_reference.content_digest}`
        )
    );
    const removedScenarioApprovals = removeMatchingEntries(
      store.formalScenarioPackageApprovalRecords,
      (record) =>
        record.tenant_id === materialization.tenantId &&
        record.approval_id === materialization.scenarioPackage.approvalId &&
        scenarioReferenceKeys.has(
          `${record.scenario_package_reference.scenario_package_id}:${record.scenario_package_reference.version}:${record.scenario_package_reference.content_digest}`
        )
    );
    try {
      store.persist();
    } catch (error) {
      restoreRemovedEntries(store.formalParameterSetLifecycleSnapshots, removedParameterSnapshots);
      restoreRemovedEntries(
        store.formalScenarioPackageLifecycleSnapshots,
        removedScenarioSnapshots
      );
      restoreRemovedEntries(store.formalParameterSetApprovalRecords, removedParameterApprovals);
      restoreRemovedEntries(store.formalScenarioPackageApprovalRecords, removedScenarioApprovals);
      throw error;
    }
  };

  return Object.freeze({
    createCourseBlueprintRegistry: () =>
      new InMemoryJsonCourseBlueprintRegistry(courseBlueprintOptions),
    createParameterSetRegistry: () => new InMemoryJsonParameterSetRegistry(parameterSetOptions),
    createPluginReleaseRegistry: () => new InMemoryJsonPluginReleaseRegistry(pluginReleaseOptions),
    createScenarioPackageRegistry: () =>
      new InMemoryJsonScenarioPackageRegistry(scenarioPackageOptions),
    removeTenantBaselineMaterialization
  });
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function getString(value: unknown, key: string): string | undefined {
  const candidate = getRecord(value)[key];
  return typeof candidate === "string" ? candidate : undefined;
}

function getNumber(value: unknown, key: string): number | undefined {
  const candidate = getRecord(value)[key];
  return typeof candidate === "number" ? candidate : undefined;
}

function tenantMatches(value: unknown, tenantId: string): boolean {
  return getString(value, "tenant_id") === tenantId;
}

function idMatches(value: unknown, keys: string[], id: string): boolean {
  return keys.some((key) => getString(value, key) === id);
}

function eventMatchesQuery(event: DomainEvent, query: RepositoryEventQuery): boolean {
  if (!tenantMatches(event, query.tenant_id)) {
    return false;
  }

  if (query.aggregate_id && getString(event, "aggregate_id") !== query.aggregate_id) {
    return false;
  }

  if (query.aggregate_type && getString(event, "aggregate_type") !== query.aggregate_type) {
    return false;
  }

  const sequence = getNumber(event, "sequence");

  if (
    query.from_sequence !== undefined &&
    sequence !== undefined &&
    sequence < query.from_sequence
  ) {
    return false;
  }

  return true;
}

function snapshotMatchesQuery(snapshot: StateSnapshot, query: RepositorySnapshotQuery): boolean {
  if (!tenantMatches(snapshot, query.tenant_id)) {
    return false;
  }

  if (getString(snapshot, "aggregate_id") !== query.aggregate_id) {
    return false;
  }

  if (getString(snapshot, "aggregate_type") !== query.aggregate_type) {
    return false;
  }

  const sequence = getNumber(snapshot, "sequence");

  if (query.at_sequence !== undefined && sequence !== undefined && sequence > query.at_sequence) {
    return false;
  }

  return true;
}

function applyLimit<T>(items: T[], limit?: number): T[] {
  if (!limit || limit <= 0) {
    return items;
  }

  return items.slice(0, limit);
}

function toCourseReadModel(course: Course): RepositoryCourseReadModel {
  return {
    course_id: course.course_id,
    tenant_id: course.tenant_id,
    title: course.title,
    status: course.status,
    scenario_package_id: course.scenario_package_id,
    parameter_set_id: course.parameter_set_id,
    created_by: course.created_by,
    ...(course.market_world_reference
      ? { market_world_reference: { ...course.market_world_reference } }
      : {})
  };
}

function hasOwnReplayHash(round: Round): boolean {
  return Object.prototype.hasOwnProperty.call(round, "replay_hash");
}

const settlementLocks = new WeakMap<SimWarStore, Map<string, Promise<void>>>();

async function acquireSettlementLock(store: SimWarStore, key: string): Promise<() => void> {
  const locks = settlementLocks.get(store) ?? new Map<string, Promise<void>>();
  settlementLocks.set(store, locks);

  const previous = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.catch(() => undefined).then(() => current);
  locks.set(key, queued);

  await previous.catch(() => undefined);

  return () => {
    release();
    if (locks.get(key) === queued) {
      locks.delete(key);
    }
  };
}

export function createJsonSettlementOutcomePersistencePort(
  store: SimWarStore
): SettlementOutcomePersistencePort {
  return {
    async commitSettlementOutcome(command): Promise<SettlementOutcomeCommitResult> {
      const result = command.settlement_result;

      if (command.tenant_id !== result.tenant_id) {
        throw new Error("settlement_outcome_tenant_mismatch");
      }

      if (command.round_id !== result.round_id) {
        throw new Error("settlement_outcome_round_mismatch");
      }

      const round = store.rounds.find(
        (candidate) =>
          candidate.tenant_id === command.tenant_id && candidate.round_id === command.round_id
      );

      if (!round) {
        throw new Error("settlement_outcome_round_missing");
      }

      if (round.run_id !== result.run_id || round.round_no !== result.round_no) {
        throw new Error("settlement_outcome_business_identity_mismatch");
      }

      const releaseSettlementLock = await acquireSettlementLock(
        store,
        createSettlementBusinessKey(result)
      );

      try {
        const matchingResultId = store.settlementResults.find(
          (candidate) =>
            candidate.tenant_id === result.tenant_id &&
            candidate.settlement_result_id === result.settlement_result_id
        );

        if (
          matchingResultId &&
          (matchingResultId.run_id !== result.run_id ||
            matchingResultId.round_no !== result.round_no)
        ) {
          throw new Error("settlement_outcome_result_id_conflict");
        }

        const existingBusinessResult = store.settlementResults.find(
          (candidate) =>
            candidate.tenant_id === result.tenant_id &&
            candidate.run_id === result.run_id &&
            candidate.round_no === result.round_no
        );

        if (existingBusinessResult) {
          if (
            createSettlementFingerprint(existingBusinessResult) ===
            createSettlementFingerprint(result)
          ) {
            return {
              settlement_result: existingBusinessResult,
              status: "reused"
            };
          }

          return {
            reason: "replay_hash_mismatch",
            settlement_result: existingBusinessResult,
            status: "conflict"
          };
        }

        const settlementLength = store.settlementResults.length;
        const auditLength = store.auditLogs.length;
        const roundSnapshot = {
          status: round.status,
          hadReplayHash: hasOwnReplayHash(round),
          replayHash: round.replay_hash
        };

        try {
          store.settlementResults.push(result);

          round.status = "settled";
          round.replay_hash = result.replay_hash;

          if (command.success_audit) {
            if (command.success_audit.tenant_id !== result.tenant_id) {
              throw new Error("settlement_outcome_audit_tenant_mismatch");
            }
            store.auditLogs.push(structuredClone(command.success_audit));
          }

          store.persist();
        } catch (error) {
          store.settlementResults.length = settlementLength;
          store.auditLogs.length = auditLength;

          round.status = roundSnapshot.status;

          if (roundSnapshot.hadReplayHash) {
            Object.defineProperty(round, "replay_hash", {
              configurable: true,
              enumerable: true,
              value: roundSnapshot.replayHash,
              writable: true
            });
          } else {
            delete round.replay_hash;
          }

          throw error;
        }

        return {
          settlement_result: result,
          status: "committed"
        };
      } finally {
        releaseSettlementLock();
      }
    }
  };
}

export function createJsonRepositoryPorts(
  store: SimWarStore,
  collections: Partial<JsonRepositoryAdapterCollections> = {}
): SimWarRepositoryPorts {
  const domainEvents = collections.domainEvents ?? [];
  const stateSnapshots = collections.stateSnapshots ?? [];
  const replayInputManifests = collections.replayInputManifests ?? [];
  const replayRuns = collections.replayRuns ?? [];
  const replayReports = collections.replayReports ?? [];
  const replayDiffReports = collections.replayDiffReports ?? [];

  return {
    identity: {
      async getTenant(tenantId): Promise<RepositoryTenantReadModel | null> {
        const tenant = store.tenants.find((candidate) => candidate.tenant_id === tenantId);

        if (!tenant) {
          return null;
        }

        return {
          tenant_id: tenant.tenant_id,
          status: tenant.status
        };
      },

      async getUser(tenantId, userId): Promise<RepositoryUserReadModel | null> {
        const user = store.users.find(
          (candidate) => candidate.tenant_id === tenantId && candidate.user_id === userId
        );

        if (!user) {
          return null;
        }

        return {
          tenant_id: user.tenant_id,
          user_id: user.user_id,
          status: user.status
        };
      }
    },

    sessions: {
      async getSession(tenantId, sessionId): Promise<RepositorySessionReadModel | null> {
        const session = store.sessions.find(
          (candidate) => candidate.tenant_id === tenantId && candidate.session_id === sessionId
        );

        if (!session) {
          return null;
        }

        return {
          tenant_id: session.tenant_id,
          session_id: session.session_id,
          user_id: session.user_id,
          expires_at: session.expires_at
        };
      },

      async listActiveSessionsByUser(tenantId, userId): Promise<RepositorySessionReadModel[]> {
        const now = Date.now();

        return store.sessions
          .filter(
            (session) =>
              session.tenant_id === tenantId &&
              session.user_id === userId &&
              (!session.expires_at || Date.parse(session.expires_at) > now)
          )
          .map((session) => ({
            tenant_id: session.tenant_id,
            session_id: session.session_id,
            user_id: session.user_id,
            expires_at: session.expires_at
          }));
      }
    },

    courses: {
      async getCourse(tenantId, courseId): Promise<RepositoryCourseReadModel | null> {
        const course = store.courses.find(
          (candidate) => candidate.tenant_id === tenantId && candidate.course_id === courseId
        );

        if (!course) {
          return null;
        }

        return toCourseReadModel(course);
      },

      async listCoursesForTenant(tenantId): Promise<RepositoryCourseReadModel[]> {
        return store.courses
          .filter((course) => course.tenant_id === tenantId)
          .map((course) => toCourseReadModel(course));
      },

      async listCoursesForUser(tenantId, userId): Promise<RepositoryCourseReadModel[]> {
        const user = store.users.find(
          (candidate) => candidate.tenant_id === tenantId && candidate.user_id === userId
        );

        if (!user) {
          return [];
        }

        const visibleCourseIds = new Set(
          store.teams
            .filter(
              (team) =>
                team.tenant_id === tenantId &&
                (team.captain_user_id === user.user_id ||
                  team.members.some((member) => member.user_id === user.user_id))
            )
            .map((team) => team.course_id)
        );

        return store.courses
          .filter(
            (course) => course.tenant_id === tenantId && visibleCourseIds.has(course.course_id)
          )
          .map(toCourseReadModel);
      },

      async saveCourse(course): Promise<void> {
        const index = store.courses.findIndex(
          (candidate) =>
            candidate.tenant_id === course.tenant_id && candidate.course_id === course.course_id
        );

        const previous = index >= 0 ? store.courses[index] : undefined;
        try {
          if (index >= 0) {
            store.courses[index] = course;
          } else {
            store.courses.push(course);
          }
          store.persist();
        } catch (error) {
          if (index >= 0) {
            store.courses[index] = previous!;
          } else {
            store.courses.pop();
          }
          throw error;
        }
      },

      async deleteCourse(tenantId, courseId): Promise<void> {
        const index = store.courses.findIndex(
          (candidate) => candidate.tenant_id === tenantId && candidate.course_id === courseId
        );
        if (index >= 0) {
          const [removed] = store.courses.splice(index, 1);
          try {
            store.persist();
          } catch (error) {
            store.courses.splice(index, 0, removed!);
            throw error;
          }
        }
      }
    },

    teams: {
      async getTeam(tenantId, teamId): Promise<Team | null> {
        return (
          store.teams.find(
            (candidate) => candidate.tenant_id === tenantId && candidate.team_id === teamId
          ) ?? null
        );
      },

      async listTeamsForRun(tenantId, runId): Promise<Team[]> {
        const run = store.runs.find(
          (candidate) => candidate.tenant_id === tenantId && candidate.run_id === runId
        );

        if (!run) {
          return [];
        }

        return store.teams.filter(
          (team) => team.tenant_id === tenantId && team.course_id === run.course_id
        );
      },

      async getTeamForUser(tenantId, runId, userId): Promise<Team | null> {
        const run = store.runs.find(
          (candidate) => candidate.tenant_id === tenantId && candidate.run_id === runId
        );

        if (!run) {
          return null;
        }

        return (
          store.teams.find(
            (team) =>
              team.tenant_id === tenantId &&
              team.course_id === run.course_id &&
              (team.captain_user_id === userId ||
                team.members.some((member) => member.user_id === userId))
          ) ?? null
        );
      },

      async createTeamWithCaptain(team): Promise<void> {
        const captain = store.users.find(
          (candidate) =>
            candidate.tenant_id === team.tenant_id && candidate.user_id === team.captain_user_id
        );

        if (!captain) {
          throw new Error("team_captain_not_found");
        }

        const index = store.teams.findIndex(
          (candidate) =>
            candidate.tenant_id === team.tenant_id && candidate.team_id === team.team_id
        );

        if (index >= 0) {
          store.teams[index] = team;
        } else {
          store.teams.push(team);
        }

        captain.team_id = team.team_id;
        store.persist();
      },

      async addMemberToTeam(tenantId, teamId, member): Promise<Team> {
        const team = store.teams.find(
          (candidate) => candidate.tenant_id === tenantId && candidate.team_id === teamId
        );
        if (!team) throw new Error("team_not_found");
        const user = store.users.find(
          (candidate) => candidate.tenant_id === tenantId && candidate.user_id === member.user_id
        );
        if (!user) throw new Error("team_member_not_found");
        if (team.members.some((candidate) => candidate.user_id === member.user_id)) {
          throw new Error("team_member_duplicate");
        }
        if (
          store.teams.some(
            (candidate) =>
              candidate.tenant_id === tenantId &&
              candidate.team_id !== teamId &&
              candidate.members.some((candidate) => candidate.user_id === member.user_id)
          )
        ) {
          throw new Error("team_member_already_enrolled");
        }
        if (team.members.some((candidate) => candidate.role_slot === member.role_slot)) {
          throw new Error("team_role_slot_duplicate");
        }
        const previousTeamMembers = [...team.members];
        const previousUserTeamId = user.team_id;
        team.members = [...team.members, clone(member)];
        user.team_id = teamId;
        try {
          store.persist();
        } catch (error) {
          team.members = previousTeamMembers;
          if (previousUserTeamId === undefined) {
            delete user.team_id;
          } else {
            user.team_id = previousUserTeamId;
          }
          throw error;
        }
        return clone(team);
      }
    },

    runs: {
      async getRun(tenantId, runId): Promise<Run | null> {
        return (
          store.runs.find(
            (candidate) => candidate.tenant_id === tenantId && candidate.run_id === runId
          ) ?? null
        );
      },

      async listRunsForCourse(tenantId, courseId): Promise<Run[]> {
        return store.runs.filter((run) => run.tenant_id === tenantId && run.course_id === courseId);
      },

      async saveRun(run): Promise<void> {
        const index = store.runs.findIndex(
          (candidate) => candidate.tenant_id === run.tenant_id && candidate.run_id === run.run_id
        );
        if (index >= 0) {
          store.runs[index] = run;
        } else {
          store.runs.push(run);
        }
        store.persist();
      },

      async deleteRun(tenantId, runId): Promise<void> {
        const index = store.runs.findIndex(
          (candidate) => candidate.tenant_id === tenantId && candidate.run_id === runId
        );
        if (index >= 0) {
          store.runs.splice(index, 1);
          store.persist();
        }
      }
    },

    scenarios: {
      async getScenarioPackage(tenantId, scenarioPackageId): Promise<ScenarioPackage | null> {
        return (
          store.scenarios.find(
            (candidate) =>
              candidate.tenant_id === tenantId &&
              candidate.scenario_package_id === scenarioPackageId
          ) ?? null
        );
      },

      async listScenarioPackagesForTenant(tenantId): Promise<ScenarioPackage[]> {
        return store.scenarios
          .filter((candidate) => candidate.tenant_id === tenantId)
          .sort((left, right) => {
            if (left.scenario_package_id < right.scenario_package_id) {
              return -1;
            }

            return left.scenario_package_id > right.scenario_package_id ? 1 : 0;
          });
      }
    },

    parameterSets: {
      async getParameterSet(tenantId, parameterSetId): Promise<ParameterSet | null> {
        return (
          store.parameterSets.find(
            (candidate) =>
              candidate.tenant_id === tenantId && candidate.parameter_set_id === parameterSetId
          ) ?? null
        );
      }
    },

    rounds: {
      async getRound(tenantId, roundId): Promise<Round | null> {
        return (
          store.rounds.find(
            (candidate) => candidate.tenant_id === tenantId && candidate.round_id === roundId
          ) ?? null
        );
      },

      async listRoundsForRun(tenantId, runId): Promise<Round[]> {
        return store.rounds.filter(
          (round) => round.tenant_id === tenantId && round.run_id === runId
        );
      },

      async saveRound(round): Promise<void> {
        const index = store.rounds.findIndex(
          (candidate) =>
            candidate.tenant_id === round.tenant_id && candidate.round_id === round.round_id
        );

        if (index >= 0) {
          store.rounds[index] = round;
        } else {
          store.rounds.push(round);
        }

        store.persist();
      },

      async deleteRound(tenantId, roundId): Promise<void> {
        const index = store.rounds.findIndex(
          (candidate) => candidate.tenant_id === tenantId && candidate.round_id === roundId
        );
        if (index >= 0) {
          store.rounds.splice(index, 1);
          store.persist();
        }
      },

      async markRoundSettled(tenantId, roundId, settlementResultId): Promise<void> {
        const round = store.rounds.find(
          (candidate) => candidate.tenant_id === tenantId && candidate.round_id === roundId
        );

        if (!round) {
          return;
        }

        round.status = "settled";

        const settlement = store.settlementResults.find(
          (candidate) =>
            candidate.tenant_id === tenantId &&
            candidate.settlement_result_id === settlementResultId
        );

        if (settlement) {
          round.replay_hash = settlement.replay_hash;
        }

        store.persist();
      }
    },

    decisions: {
      async getDecisionById(tenantId, decisionId): Promise<Decision | null> {
        return (
          store.decisions.find(
            (candidate) => candidate.tenant_id === tenantId && candidate.decision_id === decisionId
          ) ?? null
        );
      },

      async getCanonicalDecisionForTeamRound(
        tenantId,
        runId,
        roundId,
        teamId
      ): Promise<Decision | null> {
        return (
          store.decisions.find(
            (decision) =>
              decision.tenant_id === tenantId &&
              decision.run_id === runId &&
              decision.round_id === roundId &&
              decision.team_id === teamId &&
              decision.status === "submitted"
          ) ?? null
        );
      },

      async listDecisionsForRound(tenantId, runId, roundId): Promise<Decision[]> {
        return store.decisions.filter(
          (decision) =>
            decision.tenant_id === tenantId &&
            decision.run_id === runId &&
            decision.round_id === roundId
        );
      },

      async saveCanonicalDecision(decision): Promise<void> {
        saveCanonicalDecisionToJsonStore(store, decision);
        store.persist();
      },

      async saveDecision(decision): Promise<void> {
        saveCanonicalDecisionToJsonStore(store, decision);
        store.persist();
      }
    },

    settlements: {
      async getSettlementResult(tenantId, settlementResultId): Promise<SettlementResult | null> {
        return (
          store.settlementResults.find(
            (candidate) =>
              candidate.tenant_id === tenantId &&
              candidate.settlement_result_id === settlementResultId
          ) ?? null
        );
      },

      async listSettlementResultsForRound(tenantId, runId, roundId): Promise<SettlementResult[]> {
        return store.settlementResults.filter(
          (result) =>
            result.tenant_id === tenantId && result.run_id === runId && result.round_id === roundId
        );
      },

      async saveSettlementResult(result): Promise<void> {
        const index = store.settlementResults.findIndex(
          (candidate) =>
            candidate.tenant_id === result.tenant_id &&
            candidate.settlement_result_id === result.settlement_result_id
        );

        if (index >= 0) {
          store.settlementResults[index] = result;
        } else {
          store.settlementResults.push(result);
        }

        store.persist();
      }
    },

    settlementOutcome: createJsonSettlementOutcomePersistencePort(store),

    domainEvents: {
      async appendDomainEvent(event): Promise<void> {
        domainEvents.push(event);
      },

      async listDomainEvents(query): Promise<DomainEvent[]> {
        return applyLimit(
          domainEvents.filter((event) => eventMatchesQuery(event, query)),
          query.limit
        );
      }
    },

    stateSnapshots: {
      async getStateSnapshot(query): Promise<StateSnapshot | null> {
        const snapshots = stateSnapshots.filter((snapshot) =>
          snapshotMatchesQuery(snapshot, query)
        );

        if (snapshots.length === 0) {
          return null;
        }

        return snapshots[snapshots.length - 1] ?? null;
      },

      async saveStateSnapshot(snapshot): Promise<void> {
        stateSnapshots.push(snapshot);
      }
    },

    auditLogs: {
      async appendAuditLog(auditLog): Promise<void> {
        store.auditLogs.push(auditLog);
        try {
          store.persist();
        } catch (error) {
          store.auditLogs.pop();
          throw error;
        }
      },

      async listAuditLogs(query): Promise<AuditLog[]> {
        return applyLimit(
          store.auditLogs.filter((auditLog) => {
            if (query.scope === "tenant" && auditLog.tenant_id !== query.tenant_id) {
              return false;
            }

            if (
              query.scope === "platform" &&
              query.tenant_id &&
              auditLog.tenant_id !== query.tenant_id
            ) {
              return false;
            }

            if (query.actor_id && auditLog.actor_id !== query.actor_id) {
              return false;
            }

            if (query.action && auditLog.action !== query.action) {
              return false;
            }

            if (query.resource_id && auditLog.resource_id !== query.resource_id) {
              return false;
            }

            if (query.resource_type && auditLog.resource_type !== query.resource_type) {
              return false;
            }

            return true;
          }),
          query.limit
        );
      }
    },

    replay: {
      async saveReplayInputManifest(manifest): Promise<void> {
        replayInputManifests.push(manifest);
      },

      async getReplayInputManifest(tenantId, manifestId): Promise<ReplayInputManifest | null> {
        return (
          replayInputManifests.find(
            (manifest) =>
              tenantMatches(manifest, tenantId) &&
              idMatches(manifest, ["replay_input_manifest_id", "manifest_id"], manifestId)
          ) ?? null
        );
      },

      async saveReplayRun(run): Promise<void> {
        replayRuns.push(run);
      },

      async getReplayRun(tenantId, replayRunId): Promise<ReplayRun | null> {
        return (
          replayRuns.find(
            (run) =>
              tenantMatches(run, tenantId) &&
              idMatches(run, ["replay_run_id", "run_id"], replayRunId)
          ) ?? null
        );
      },

      async saveReplayReport(report): Promise<void> {
        replayReports.push(report);
      },

      async getReplayReport(tenantId, replayReportId): Promise<ReplayReport | null> {
        return (
          replayReports.find(
            (report) =>
              tenantMatches(report, tenantId) &&
              idMatches(report, ["replay_report_id", "report_id"], replayReportId)
          ) ?? null
        );
      },

      async saveReplayDiffReport(report): Promise<void> {
        replayDiffReports.push(report);
      },

      async getReplayDiffReport(tenantId, replayDiffReportId): Promise<ReplayDiffReport | null> {
        return (
          replayDiffReports.find(
            (report) =>
              tenantMatches(report, tenantId) &&
              idMatches(
                report,
                ["replay_diff_report_id", "diff_report_id", "report_id"],
                replayDiffReportId
              )
          ) ?? null
        );
      }
    },

    roleWorkflow: createJsonRoleWorkflowRepositoryPort(store),
    decisionExperience: createJsonW027DecisionExperienceRepositoryPort(store),
    evidenceProvenance: createJsonEvidenceProvenanceRepositoryPort(store),
    teacherConfirmations: createJsonTeacherConfirmationRepositoryPort(store),
    governedAdvisories: createJsonGovernedAdvisoryRepositoryPort(store),
    validationSessions: createJsonValidationSessionRepositoryPort(store)
  };
}

export function createJsonValidationSessionRepositoryPort(
  store: SimWarStore
): ValidationSessionRepositoryPort {
  return {
    async list(tenantId) {
      return clone(store.validationSessions.filter((session) => session.tenant_id === tenantId));
    },
    async get(tenantId, sessionId) {
      const session = store.validationSessions.find(
        (candidate) => candidate.tenant_id === tenantId && candidate.session_id === sessionId
      );
      return session ? clone(session) : null;
    },
    async save(session: ValidationSessionRecord) {
      assertValidationSessionRecord(session);
      const index = store.validationSessions.findIndex(
        (candidate) =>
          candidate.tenant_id === session.tenant_id && candidate.session_id === session.session_id
      );
      const previous = index >= 0 ? store.validationSessions[index] : undefined;
      if (index >= 0) store.validationSessions[index] = clone(session);
      else store.validationSessions.push(clone(session));
      try {
        store.persist();
      } catch (error) {
        if (index >= 0) store.validationSessions[index] = previous!;
        else store.validationSessions.pop();
        throw error;
      }
    }
  };
}
