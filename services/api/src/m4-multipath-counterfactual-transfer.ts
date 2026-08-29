import { createHash } from "node:crypto";
import type {
  M4CounterfactualPathInput,
  M4MultipathCounterfactualInput,
  M4MultipathCounterfactualResponse,
  M4MultipathSurface,
  M4RoleLineageProjection,
  M4TeacherSafeCounterfactualResponse,
  M4StudentPathProjection,
  M4TeacherPathProjection,
  RoleKey,
  W4CounterfactualEvidence,
  W4CounterfactualInput,
  W4EnterpriseStateData,
  Round,
  W4TeacherCounterfactualEvidence,
  W4ScopeContext,
  W4StateRef
} from "@simwar/shared-contracts";
import {
  createEnterpriseStateStrategicEvolutionService,
  type W4Repository
} from "./w4-enterprise-state.js";
import type {
  RoleWorkflowRepositoryPort,
  RoleWorkflowRepositorySnapshot
} from "./repository-ports.js";

type W4Service = Pick<
  ReturnType<typeof createEnterpriseStateStrategicEvolutionService>,
  "counterfactual"
>;

export class M4MultipathCounterfactualTransferError extends Error {
  constructor(
    readonly code: string,
    message = code
  ) {
    super(message);
    this.name = "M4MultipathCounterfactualTransferError";
  }
}

export interface M4MultipathCounterfactualTransferDependencies {
  w4Repository: W4Repository;
  w4Service: W4Service;
  roleWorkflow: Pick<RoleWorkflowRepositoryPort, "readRoleWorkflow">;
  readRound: (input: {
    tenant_id: string;
    run_id: string;
    round_id: string;
  }) => Promise<Round | undefined>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function exactStateRef(
  left: Pick<
    W4StateRef,
    | "tenant_id"
    | "course_id"
    | "run_id"
    | "team_id"
    | "round_id"
    | "enterprise_state_id"
    | "version"
    | "state_digest"
  > & { parent_state_ref?: W4StateRef | null },
  right: W4StateRef
): boolean {
  return (
    left.tenant_id === right.tenant_id &&
    left.course_id === right.course_id &&
    left.run_id === right.run_id &&
    left.team_id === right.team_id &&
    left.round_id === right.round_id &&
    left.enterprise_state_id === right.enterprise_state_id &&
    left.version === right.version &&
    left.state_digest === right.state_digest &&
    JSON.stringify(left.parent_state_ref ?? null) === JSON.stringify(right.parent_state_ref ?? null)
  );
}

function scoped(
  scope: W4ScopeContext,
  value: { tenant_id: string; course_id: string; run_id: string; team_id: string }
): boolean {
  return (
    scope.tenant_id === value.tenant_id &&
    scope.course_id === value.course_id &&
    scope.run_id === value.run_id &&
    scope.team_id === value.team_id
  );
}

function pathSignature(path: M4CounterfactualPathInput): string {
  return JSON.stringify({ decision_ids: canonicalDecisionIds(path.decision_ids) });
}

function canonicalDecisionIds(decisionIds: readonly string[]): string[] {
  return [...new Set(decisionIds)].sort((left, right) => left.localeCompare(right));
}

function officialDecisionIdsForHorizon(
  current: ReturnType<W4Repository["snapshot"]>,
  scope: W4ScopeContext,
  sourceRoundNo: number,
  horizonRounds: number
): Set<string> {
  return new Set(
    current.outcomes
      .filter(
        (outcome) =>
          scoped(scope, outcome) &&
          outcome.round_no >= sourceRoundNo &&
          outcome.round_no <= sourceRoundNo + horizonRounds
      )
      .flatMap((outcome) => outcome.replay_input_manifest.decision_ids)
  );
}

function buildLineage(
  snapshot: RoleWorkflowRepositorySnapshot,
  sourceRoundId: string,
  surface: M4MultipathSurface
): M4RoleLineageProjection {
  const sourceSections = snapshot.sections.filter((section) => section.round_id === sourceRoundId);
  const sourceMerges = snapshot.merge_commits.filter((merge) => merge.round_id === sourceRoundId);
  const sourceResolutions = snapshot.resolutions.filter(
    (resolution) => resolution.round_id === sourceRoundId
  );
  const sourceAcknowledgements = snapshot.acknowledgements.filter(
    (acknowledgement) => acknowledgement.round_id === sourceRoundId
  );
  const latestMerge = sourceMerges[sourceMerges.length - 1];
  const latestResolution = sourceResolutions[sourceResolutions.length - 1];
  const eventTypes = snapshot.events
    .filter((event) => !event.round_id || event.round_id === sourceRoundId)
    .map((event) => event.event_type)
    .filter((eventType, index, values) => values.indexOf(eventType) === index);
  const dissentRoleKeys = sourceAcknowledgements
    .filter((acknowledgement) => acknowledgement.status === "DISSENT_PRESERVED")
    .map((acknowledgement) => acknowledgement.role_key as RoleKey)
    .filter((roleKey, index, values) => values.indexOf(roleKey) === index);

  return {
    source_round_id: sourceRoundId,
    source_section_ids:
      surface === "teacher" ? sourceSections.map((section) => section.section_id) : [],
    ...(surface === "teacher" && latestMerge
      ? { merge_commit_id: latestMerge.merge_commit_id }
      : {}),
    ...(surface === "teacher" && latestResolution
      ? { resolution_id: latestResolution.resolution_id }
      : {}),
    preserved_dissent_role_keys: dissentRoleKeys,
    resolution_status: latestResolution ? "PROPOSED" : "NOT_PRESENT",
    history_event_types:
      surface === "teacher" ? eventTypes : dissentRoleKeys.length ? ["DISSENT_PRESERVED"] : [],
    historical_decision_reentry_blocked: true
  };
}

function changedPaths(paths: W4CounterfactualEvidence[]): string[] {
  return [
    ...new Set(paths.flatMap((path) => path.rounds.flatMap((round) => round.changed_paths)))
  ].sort();
}

function outcomeDifferential(source: W4EnterpriseStateData, evidence: W4CounterfactualEvidence) {
  const terminal = evidence.rounds[evidence.rounds.length - 1];
  if (!terminal) throw new M4MultipathCounterfactualTransferError("M4_COUNTERFACTUAL_EMPTY");
  return {
    baseline: "OFFICIAL_SOURCE_CLOSING_STATE" as const,
    cash_delta: terminal.closing_state.cash - source.cash,
    capacity_delta: terminal.closing_state.capacity - source.capacity,
    product_line_count_delta:
      terminal.closing_state.product_lines.length - source.product_lines.length,
    operating_unit_count_delta:
      terminal.closing_state.operating_units.length - source.operating_units.length,
    project_count_delta:
      terminal.closing_state.portfolio.projects.length - source.portfolio.projects.length,
    facility_count_delta:
      terminal.closing_state.portfolio.facilities.length - source.portfolio.facilities.length,
    terminal_state_ref: clone(terminal.closing_state_ref),
    terminal_state_digest: terminal.closing_state_ref.state_digest
  };
}

function teacherPath(
  input: M4CounterfactualPathInput,
  evidence: W4TeacherCounterfactualEvidence
): M4TeacherPathProjection {
  const mechanisms = changedPaths([evidence]);
  return {
    path_id: input.path_id,
    label: input.label,
    officiality: "NON_OFFICIAL",
    decision_ids: [...evidence.decision_ids],
    decision_payload_bindings: clone(evidence.decision_payload_bindings),
    capital_actions: clone(evidence.capital_actions),
    path_digest: digest({ path_id: input.path_id, evidence }),
    rounds: clone(evidence.rounds),
    mechanism_differential: {
      changed_paths: mechanisms,
      changed_path_count: mechanisms.length,
      interpretation: "DETERMINISTIC_STATE_TRANSITION_DIFFERENTIAL"
    },
    outcome_differential: outcomeDifferential(evidence.rounds[0]!.opening_state, evidence)
  };
}

function studentPath(path: M4TeacherPathProjection): M4StudentPathProjection {
  return {
    path_id: path.path_id,
    label: path.label,
    officiality: path.officiality,
    decision_ids: [...path.decision_ids],
    path_digest: path.path_digest,
    mechanism_differential: clone(path.mechanism_differential),
    outcome_differential: clone(path.outcome_differential)
  };
}

export class M4MultipathCounterfactualTransferService {
  constructor(private readonly dependencies: M4MultipathCounterfactualTransferDependencies) {}

  async createDefault(
    scope: W4ScopeContext,
    surface: M4MultipathSurface
  ): Promise<M4MultipathCounterfactualResponse> {
    const current = this.dependencies.w4Repository.snapshot();
    const sourceOutcome = current.outcomes.find(
      (candidate) =>
        scoped(scope, candidate) &&
        candidate.round_no === scope.round_no &&
        (!scope.round_id || candidate.round_id === scope.round_id)
    );
    if (!sourceOutcome) {
      throw new M4MultipathCounterfactualTransferError("M4_OFFICIAL_OUTCOME_REQUIRED");
    }
    const sourceState = current.states.find(
      (candidate) =>
        scoped(scope, candidate) && exactStateRef(candidate, sourceOutcome.closing_state_ref)
    );
    if (!sourceState) {
      throw new M4MultipathCounterfactualTransferError("M4_SOURCE_STATE_CONFLICT");
    }
    const officialDecisionIds = officialDecisionIdsForHorizon(
      current,
      scope,
      sourceState.round_no,
      1
    );
    const candidates = current.decisions
      .filter(
        (candidate) =>
          scoped(scope, candidate) &&
          candidate.round_no > sourceState.round_no &&
          !officialDecisionIds.has(candidate.decision_id) &&
          current.commitments.some(
            (commitment) =>
              commitment.decision_id === candidate.decision_id && scoped(scope, commitment)
          )
      )
      .slice()
      .sort(
        (left, right) =>
          left.round_no - right.round_no || left.decision_id.localeCompare(right.decision_id)
      );
    if (candidates.length < 2) {
      throw new M4MultipathCounterfactualTransferError("M4_DEFAULT_PATHS_UNAVAILABLE");
    }
    const manifest = sourceOutcome.replay_input_manifest;
    return this.create(
      scope,
      {
        source_state_ref: clone(sourceOutcome.closing_state_ref),
        source_outcome_id: sourceOutcome.official_outcome_id,
        paths: candidates.slice(0, 3).map((candidate, index) => ({
          path_id: `discovered_path_${index + 1}`,
          label: `替代路径 ${index + 1}`,
          decision_ids: [candidate.decision_id]
        })),
        horizon_rounds: 1,
        scenario_package_id: manifest.scenario_package_id,
        parameter_set_id: manifest.parameter_set_id,
        engine_id: manifest.engine_id,
        plugin_ids: [...manifest.plugin_ids],
        seed: manifest.seed
      },
      surface
    );
  }

  async create(
    scope: W4ScopeContext,
    input: M4MultipathCounterfactualInput,
    surface: M4MultipathSurface
  ): Promise<M4MultipathCounterfactualResponse> {
    const current = this.dependencies.w4Repository.snapshot();
    const sourceState = current.states.find(
      (candidate) => scoped(scope, candidate) && exactStateRef(candidate, input.source_state_ref)
    );
    if (!sourceState) {
      throw new M4MultipathCounterfactualTransferError("M4_SOURCE_STATE_CONFLICT");
    }
    const sourceOutcome = current.outcomes.find(
      (candidate) =>
        scoped(scope, candidate) && candidate.official_outcome_id === input.source_outcome_id
    );
    if (!sourceOutcome || !exactStateRef(sourceState, sourceOutcome.closing_state_ref)) {
      throw new M4MultipathCounterfactualTransferError("M4_SOURCE_OUTCOME_LINEAGE_CONFLICT");
    }
    if (surface === "student") {
      const sourceRound = await this.dependencies.readRound({
        tenant_id: scope.tenant_id,
        run_id: scope.run_id,
        round_id: sourceState.round_id
      });
      if (
        !sourceRound ||
        sourceRound.tenant_id !== scope.tenant_id ||
        sourceRound.run_id !== scope.run_id ||
        sourceRound.round_id !== sourceState.round_id ||
        sourceRound.status !== "published"
      ) {
        throw new M4MultipathCounterfactualTransferError("M4_SOURCE_ROUND_NOT_PUBLISHED");
      }
    }
    const sourceManifest = sourceOutcome.replay_input_manifest;
    if (
      sourceManifest.scenario_package_id !== input.scenario_package_id ||
      sourceManifest.parameter_set_id !== input.parameter_set_id ||
      sourceManifest.engine_id !== input.engine_id ||
      sourceManifest.seed !== input.seed ||
      JSON.stringify(sourceManifest.plugin_ids) !== JSON.stringify(input.plugin_ids)
    ) {
      throw new M4MultipathCounterfactualTransferError("M4_RUNTIME_BINDING_CONFLICT");
    }
    if (
      !Number.isInteger(input.horizon_rounds) ||
      input.horizon_rounds < 1 ||
      input.horizon_rounds > 8
    ) {
      throw new M4MultipathCounterfactualTransferError("M4_HORIZON_INVALID");
    }
    if (!Array.isArray(input.paths) || input.paths.length < 2 || input.paths.length > 3) {
      throw new M4MultipathCounterfactualTransferError("M4_PATH_COUNT_INVALID");
    }

    const roleSnapshot = await this.dependencies.roleWorkflow.readRoleWorkflow({
      tenant_id: scope.tenant_id,
      run_id: scope.run_id,
      team_id: scope.team_id,
      round_id: input.source_state_ref.round_id
    });
    const roleLineage = buildLineage(roleSnapshot, input.source_state_ref.round_id, surface);
    if (
      !roleSnapshot.sections.some((section) => section.round_id === input.source_state_ref.round_id)
    ) {
      throw new M4MultipathCounterfactualTransferError("M4_ROLE_LINEAGE_REQUIRED");
    }

    const officialDecisionIds = officialDecisionIdsForHorizon(
      current,
      scope,
      sourceState.round_no,
      input.horizon_rounds
    );
    const pathSignatures = new Set<string>();
    const pathIds = new Set<string>();
    const normalizedPaths: M4CounterfactualPathInput[] = [];
    for (const path of input.paths) {
      if (!path.path_id.trim() || !path.label.trim() || pathIds.has(path.path_id)) {
        throw new M4MultipathCounterfactualTransferError("M4_PATH_ID_INVALID");
      }
      pathIds.add(path.path_id);
      if (
        !Array.isArray(path.decision_ids) ||
        !path.decision_ids.length ||
        path.decision_ids.some((decisionId) => typeof decisionId !== "string" || !decisionId.trim())
      ) {
        throw new M4MultipathCounterfactualTransferError("M4_PATH_DECISIONS_REQUIRED");
      }
      const normalizedPath = {
        ...path,
        decision_ids: canonicalDecisionIds(path.decision_ids)
      };
      if (normalizedPath.decision_ids.some((decisionId) => officialDecisionIds.has(decisionId))) {
        throw new M4MultipathCounterfactualTransferError("M4_OFFICIAL_DECISION_REENTRY_BLOCKED");
      }
      const signature = pathSignature(normalizedPath);
      if (pathSignatures.has(signature)) {
        throw new M4MultipathCounterfactualTransferError("M4_PATHS_NOT_DISTINCT");
      }
      pathSignatures.add(signature);
      normalizedPaths.push(normalizedPath);
    }

    const evidence = await Promise.all(
      normalizedPaths.map((path) =>
        this.dependencies.w4Service.counterfactual(scope, {
          source_state_ref: clone(input.source_state_ref),
          source_outcome_id: input.source_outcome_id,
          decision_ids: [...path.decision_ids],
          horizon_rounds: input.horizon_rounds,
          scenario_package_id: input.scenario_package_id,
          parameter_set_id: input.parameter_set_id,
          engine_id: input.engine_id,
          plugin_ids: [...input.plugin_ids],
          seed: input.seed
        } satisfies W4CounterfactualInput, "teacher")
      )
    );
    const teacherPaths = normalizedPaths.map((path, index) => {
      const teacherEvidence = evidence[index];
      if (!teacherEvidence || teacherEvidence.surface !== "teacher") {
        throw new M4MultipathCounterfactualTransferError("M4_TEACHER_EVIDENCE_REQUIRED");
      }
      return teacherPath(path, teacherEvidence);
    });
    const pathDigests = teacherPaths.map((path) => path.path_digest);
    if (new Set(pathDigests).size !== pathDigests.length) {
      throw new M4MultipathCounterfactualTransferError("M4_PATHS_NOT_DISTINCT");
    }
    const officialDecisionIdsForProjection = [...sourceManifest.decision_ids];
    const commonChangedPaths = changedPaths(evidence);

    const commonResponse = {
      schema_version: "m4-multipath-counterfactual-transfer.v1" as const,
      runtime_authority: "JSON_INTERNAL_ONLY" as const,
      exact_binding: {
        source_state_ref: clone(input.source_state_ref),
        source_outcome_id: input.source_outcome_id,
        horizon_rounds: input.horizon_rounds,
        scenario_package_id: input.scenario_package_id,
        parameter_set_id: input.parameter_set_id,
        engine_id: input.engine_id,
        plugin_ids: [...input.plugin_ids],
        seed: input.seed
      },
      official_path: {
        officiality: "OFFICIAL",
        unchanged: true,
        outcome_id: sourceOutcome.official_outcome_id,
        opening_state_ref: clone(sourceOutcome.opening_state_ref),
        closing_state_ref: clone(sourceOutcome.closing_state_ref),
        decision_ids: officialDecisionIdsForProjection,
        replay_writes_formal_results: false
      },
      lineage: roleLineage,
      teacher_debrief: {
        available: true,
        learning_points: [
          "正式路径保持不变；以下路径都是 NON_OFFICIAL 复盘证据。",
          `本次比较了 ${teacherPaths.length} 条确定性的替代路径。`,
          `状态转移差异涉及 ${commonChangedPaths.length} 个可观察路径。`,
          "差异用于机制复盘与学习迁移，不构成新的结算、评分或下一轮真值。"
        ],
        apply_to_next_round: false
      },
      student_transfer: {
        role_safe: true,
        visible_path_ids: teacherPaths.map((path) => path.path_id),
        explanation: "你可以比较不同决策路径如何改变可观察机制；正式结果仍以已发布官方路径为准。",
        excluded_fields: [
          "private_dissent_notes",
          "raw_counterfactual_state",
          "official_settlement_write",
          "score_and_rank",
          "next_round_opening_write"
        ]
      },
      transfer: {
        status: "READY",
        apply_to_next_round: false,
        source_official_state_ref: clone(
          sourceState ? input.source_state_ref : sourceOutcome.closing_state_ref
        )
      },
      invariants: {
        official_decision_writes: false,
        official_settlement_writes: false,
        official_state_writes: false,
        apply_to_next_round: false,
        replay_writes_formal_results: false
      },
      known_limits: [
        "Counterfactual paths are deterministic evidence and are not persisted as official W4 state.",
        "Path differentials describe observed state transitions; they do not prove causal attribution.",
        "Role dissent is preserved as bounded lineage; Student receives role keys only, without note content.",
        "The JSON runtime is the only active runtime; PostgreSQL/RLS and external providers remain off."
      ]
    } satisfies Omit<M4TeacherSafeCounterfactualResponse, "visibility" | "paths">;
    return surface === "teacher"
      ? { ...commonResponse, visibility: "teacher_safe", paths: teacherPaths }
      : { ...commonResponse, visibility: "student_safe", paths: teacherPaths.map(studentPath) };
  }
}

export function createM4MultipathCounterfactualTransferService(
  dependencies: M4MultipathCounterfactualTransferDependencies
): M4MultipathCounterfactualTransferService {
  return new M4MultipathCounterfactualTransferService(dependencies);
}
