import { createHash } from "node:crypto";
import { settleEnterpriseState } from "@simwar/simulation-core";
import type {
  W4CanonicalStrategicDecision,
  W4Commitment,
  W4DecisionAdmission,
  W4DecisionPayloadBinding,
  W4EnterpriseState,
  W4EnterpriseStateData,
  W4OfficialOutcome,
  W4PolicySeam,
  W4PolicySeamKind,
  W4PolicySeamStatus,
  W4ReplayEvidence,
  W4ReplayInputManifest,
  W4RoundContext,
  W4ScopeContext,
  W4StateRef,
  W4StrategicEffect,
  W4StrategicInitiative,
  W4StrategicDecisionKind,
  W4ProjectLifecycleStatus,
  W4ProjectPortfolioEntry,
  W4ProjectTransaction,
  W4ProjectTransactionKind,
  W4ProjectTransactionPhase,
  W4CapitalAction,
  W4CapitalActionPayload,
  W4CapitalActionStatus,
  W4CapitalObligation,
  W4StoreState,
  W4ProjectionBase,
  W4MatchedProjectArena,
  W4MatchedArenaTeamPath,
  W4CounterfactualEvidence,
  W4CounterfactualInput,
  W4CounterfactualRoundEvidence,
  W4StrategicPortfolioAllocation,
  W4StrategicPortfolioMember,
  W4StrategicPortfolioProjection,
  Decision
} from "@simwar/shared-contracts";
import type { SimWarStore } from "./store.js";

export class W4EnterpriseStateError extends Error {
  constructor(
    readonly code: string,
    message = code
  ) {
    super(message);
    this.name = "W4EnterpriseStateError";
  }
}

export interface W4Repository {
  snapshot(): W4StoreState;
  replace(snapshot: W4StoreState): void;
  commit(snapshot: W4StoreState): Promise<void>;
}

type LegacyDecisionAdmission = Omit<W4DecisionAdmission, "decision_payload_digest"> & {
  decision_payload_digest?: string;
};
type LegacyCommitment = Omit<W4Commitment, "decision_payload_digest"> & {
  decision_payload_digest?: string;
};
type LegacyEffect = Omit<W4StrategicEffect, "decision_payload_digest"> & {
  decision_payload_digest?: string;
};
type LegacyReplayInputManifest = Omit<W4ReplayInputManifest, "decision_payload_bindings"> & {
  decision_payload_bindings?: W4DecisionPayloadBinding[];
};
type LegacyReplayEvidence = Omit<W4ReplayEvidence, "decision_payload_bindings"> & {
  decision_payload_bindings?: W4DecisionPayloadBinding[];
};

function normalizeW4StoreState(input: W4StoreState): W4StoreState {
  const next = clone(input);
  const legacy = next as W4StoreState & {
    projectPortfolio?: W4ProjectPortfolioEntry[];
    projectTransactions?: W4ProjectTransaction[];
    capitalActions?: W4CapitalAction[];
  };
  // Legacy state bytes are immutable evidence. Do not inject newly optional
  // fields into them here: doing so would change the bytes without changing
  // the stored state_digest and would invalidate historical state references.
  // The settlement engine applies default capital semantics at read time; new
  // initial states are normalized and re-digested below.
  next.projectPortfolio = clone(legacy.projectPortfolio ?? []);
  next.projectTransactions = clone(legacy.projectTransactions ?? []);
  next.capitalActions = clone(legacy.capitalActions ?? []);
  const decisionDigests = new Map<string, string>();
  next.decisions = next.decisions.map((decision) => {
    const legacyAdmission = decision.admission as LegacyDecisionAdmission;
    const decisionPayloadDigest =
      legacyAdmission.decision_payload_digest ??
      createW4DecisionPayloadDigest(decision.kind, decision.payload);
    decisionDigests.set(decision.decision_id, decisionPayloadDigest);
    return {
      ...decision,
      admission: {
        ...legacyAdmission,
        decision_payload_digest: decisionPayloadDigest
      }
    };
  });

  const commitmentDigests = new Map<string, string>();
  next.commitments = next.commitments.map((commitment) => {
    const legacyCommitment = commitment as LegacyCommitment;
    const decisionPayloadDigest =
      legacyCommitment.decision_payload_digest ?? decisionDigests.get(commitment.decision_id) ?? "";
    commitmentDigests.set(commitment.commitment_id, decisionPayloadDigest);
    return { ...legacyCommitment, decision_payload_digest: decisionPayloadDigest };
  });

  next.effects = next.effects.map((effect) => {
    const legacyEffect = effect as LegacyEffect;
    const decisionPayloadDigest =
      legacyEffect.decision_payload_digest ?? commitmentDigests.get(effect.commitment_id) ?? "";
    return { ...legacyEffect, decision_payload_digest: decisionPayloadDigest };
  });

  const normalizeManifest = (
    inputManifest: W4ReplayInputManifest | LegacyReplayInputManifest
  ): W4ReplayInputManifest => {
    const manifest = inputManifest as LegacyReplayInputManifest;
    const existingBindings = manifest.decision_payload_bindings ?? [];
    return {
      ...manifest,
      decision_payload_bindings: manifest.decision_ids.map((decisionId) => {
        const existing = existingBindings.find((binding) => binding.decision_id === decisionId);
        return (
          existing ?? {
            decision_id: decisionId,
            decision_payload_digest: decisionDigests.get(decisionId) ?? ""
          }
        );
      })
    };
  };

  next.outcomes = next.outcomes.map((outcome) => ({
    ...outcome,
    replay_input_manifest: normalizeManifest(outcome.replay_input_manifest)
  }));
  next.replayEvidence = next.replayEvidence.map((evidence) => {
    const legacyEvidence = evidence as LegacyReplayEvidence;
    const existingBindings = legacyEvidence.decision_payload_bindings ?? [];
    return {
      ...legacyEvidence,
      decision_payload_bindings: legacyEvidence.decision_ids.map((decisionId) => {
        const existing = existingBindings.find((binding) => binding.decision_id === decisionId);
        return (
          existing ?? {
            decision_id: decisionId,
            decision_payload_digest: decisionDigests.get(decisionId) ?? ""
          }
        );
      })
    };
  });
  return next;
}

export function createJsonW4Repository(store: SimWarStore): W4Repository {
  const normalized = normalizeW4StoreState(store.w4);
  if (JSON.stringify(normalized) !== JSON.stringify(store.w4)) {
    const previous = clone(store.w4);
    store.w4 = normalized;
    try {
      store.persist();
    } catch (error) {
      store.w4 = previous;
      throw error;
    }
  }
  return {
    snapshot: () => clone(store.w4),
    replace: (next) => {
      store.w4 = clone(next);
    },
    async commit(next) {
      const previous = clone(store.w4);
      store.w4 = clone(next);
      try {
        store.persist();
      } catch (error) {
        store.w4 = previous;
        throw error;
      }
    }
  };
}

export interface W4SettlementInput {
  opening_state_ref: W4StateRef;
  decision_id: string | null;
  replay_input_manifest: W4ReplayInputManifest;
}

export interface W4CompiledStrategicDecision {
  decision: W4CanonicalStrategicDecision;
  commitment: W4Commitment;
  effect: W4StrategicEffect;
  initiative: W4StrategicInitiative;
  capital_action?: W4CapitalAction;
}

export interface W4SettlementResult {
  outcome_id: string;
  closing_state_ref: W4StateRef;
  persistent_effect_ids: string[];
  reexecuted_decision_ids: string[];
}

export interface W4ProjectPortfolioInput {
  project_entry_id: string;
  initiative_id: string;
  project_profile_reference: W4ProjectPortfolioEntry["project_profile_reference"];
  source_assignment_id: string;
  project_name: string;
  dependency_project_entry_ids?: string[];
}

export interface W4ProjectTransactionInput {
  transaction_id: string;
  kind: Exclude<W4ProjectTransactionKind, "project_add">;
  initiative_id: string;
  project_entry_id: string;
  target_project_profile_reference?: W4ProjectPortfolioEntry["project_profile_reference"];
  target_source_assignment_id?: string;
  target_project_name?: string;
}

export interface W4ProjectTransactionConfirmationInput {
  buyer_confirmation_id?: string;
  seller_confirmation_id?: string;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function emptyCapitalPosition(): NonNullable<W4EnterpriseStateData["capital"]> {
  return {
    debt_principal: 0,
    equity_proceeds: 0,
    working_capital_available: 0,
    interest_paid: 0,
    fees_paid: 0,
    covenant_min_cash: 0,
    covenant_breach_action_ids: [],
    active_capital_action_ids: []
  };
}

function normalizeStateData(state: W4EnterpriseStateData): W4EnterpriseStateData {
  return {
    ...clone(state),
    capital: {
      ...emptyCapitalPosition(),
      ...(state.capital ? clone(state.capital) : {})
    }
  };
}

async function commitW4Mutation(
  repository: W4Repository,
  before: W4StoreState,
  next: W4StoreState
): Promise<void> {
  try {
    await repository.commit(next);
  } catch (error) {
    repository.replace(before);
    if (error instanceof W4EnterpriseStateError) throw error;
    throw new W4EnterpriseStateError("W4_ATOMIC_COMMIT_FAILED");
  }
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * Builds the M3 product projection from existing W4 records. This function is
 * deliberately pure: the W4 Enterprise State service remains the only writer
 * and Simulation Core remains the only official state/settlement authority.
 */
export function buildW4StrategicPortfolioProjection(
  scope: W4ScopeContext,
  input: {
    latest_state: Pick<W4EnterpriseState, "state"> | null;
    opening_state_ref: W4StateRef | null;
    closing_state_ref: W4StateRef | null;
    next_opening_state_ref: W4StateRef | null;
    members: W4StrategicPortfolioMember[];
    allocations: W4StrategicPortfolioAllocation[];
  }
): W4StrategicPortfolioProjection {
  const exactScope = {
    tenant_id: scope.tenant_id,
    course_id: scope.course_id,
    run_id: scope.run_id,
    team_id: scope.team_id,
    round_no: scope.round_no
  };
  const members = input.members
    .map((member) => ({
      ...clone(member),
      dependency_project_entry_ids: [...member.dependency_project_entry_ids].sort()
    }))
    .sort((left, right) => left.project_entry_id.localeCompare(right.project_entry_id));
  const allocations = input.allocations
    .map((allocation) => ({
      ...clone(allocation),
      capital_action_ids: [...allocation.capital_action_ids].sort()
    }))
    .sort((left, right) => left.project_entry_id.localeCompare(right.project_entry_id));
  const totalProjectCost = allocations.reduce((sum, item) => sum + item.project_cost, 0);
  const allocatedCapitalPrincipal = allocations.reduce(
    (sum, item) => sum + item.allocated_capital_principal,
    0
  );
  const unfundedProjectCost = allocations.reduce((sum, item) => sum + item.unfunded_project_cost, 0);
  const cashAvailable = input.latest_state?.state.cash ?? null;
  const covenantMinCash = input.latest_state?.state.capital?.covenant_min_cash ?? 0;
  const constraintStatus =
    cashAvailable !== null && cashAvailable < covenantMinCash
      ? "BREACHED"
      : unfundedProjectCost > 0
        ? "UNFUNDED"
        : "WITHIN_LIMIT";
  const dependencyProjectEntryIds = [
    ...new Set(members.flatMap((member) => member.dependency_project_entry_ids))
  ].sort();
  const constraints = {
    status: constraintStatus,
    cash_available: cashAvailable,
    covenant_min_cash: covenantMinCash,
    total_project_cost: totalProjectCost,
    allocated_capital_principal: allocatedCapitalPrincipal,
    unfunded_project_cost: unfundedProjectCost,
    dependency_project_entry_ids: dependencyProjectEntryIds
  } as const;
  const persistence = {
    official_state_authority: "W4_ENTERPRISE_STATE_SERVICE" as const,
    opening_state_ref: clone(input.opening_state_ref),
    closing_state_ref: clone(input.closing_state_ref),
    next_opening_state_ref: clone(input.next_opening_state_ref),
    historical_decision_reentry: false as const
  };
  const portfolioId = `portfolio:${scope.tenant_id}:${scope.course_id}:${scope.run_id}:${scope.team_id}`;
  const portfolioDigest = digest({
    schema_version: "w4-strategic-portfolio.v1",
    exact_scope: exactScope,
    members,
    allocations,
    constraints,
    persistence
  });
  return {
    schema_version: "w4-strategic-portfolio.v1",
    candidate_status: "DERIVED",
    portfolio_id: portfolioId,
    portfolio_ref: { ...exactScope, portfolio_digest: portfolioDigest },
    exact_scope: exactScope,
    members,
    allocations,
    constraints,
    persistence,
    writer_authority: "SOLE_W4_ENTERPRISE_STATE_SERVICE",
    known_limits: [
      "Portfolio is a deterministic read projection; it does not create a second enterprise state.",
      "Official realized outcomes and Closing-to-Opening persistence remain owned by W4 Enterprise State and Simulation Core.",
      "Capital allocation is recognized only from scoped, non-blocked W4 capital actions; no implicit funding is inferred.",
      "Project ramp is surfaced from the governed initiative as bounded metadata; no unprovided ramp economics are inferred by this projection."
    ]
  };
}

function normalizeDecisionPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeDecisionPayload);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nested]) => nested !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalizeDecisionPayload(nested)])
    );
  }
  return value;
}

export function createW4DecisionPayloadDigest(
  kind: W4StrategicDecisionKind,
  payload: unknown
): string {
  return digest({ kind, payload: normalizeDecisionPayload(payload) });
}

/**
 * Formal W4 actions are projections of the already admitted RoleWorkflow
 * Decision. The W4 route may persist its own typed action record for the W4
 * state machine, but it must never reinterpret a client payload as the
 * canonical team Decision. The canonical Decision therefore carries an
 * explicit, versioned W4 action envelope and this comparison is the only
 * accepted bridge between the two authorities.
 */
export function assertFormalW4DecisionMatchesCanonical(
  submitted: Pick<W4CanonicalStrategicDecision, "kind" | "version" | "payload">,
  canonical: Pick<Decision, "version" | "payload">
): void {
  const canonicalPayload = canonical.payload;
  const envelope =
    canonicalPayload && typeof canonicalPayload === "object"
      ? (canonicalPayload as unknown as Record<string, unknown>).w4_strategic_action
      : undefined;
  if (!envelope || typeof envelope !== "object") {
    throw new W4EnterpriseStateError("W4_DECISION_PAYLOAD_BINDING_CONFLICT");
  }

  const action = envelope as {
    kind?: unknown;
    version?: unknown;
    payload?: unknown;
  };
  if (
    action.kind !== submitted.kind ||
    action.version !== submitted.version ||
    canonical.version !== submitted.version ||
    createW4DecisionPayloadDigest(submitted.kind, action.payload) !==
      createW4DecisionPayloadDigest(submitted.kind, submitted.payload)
  ) {
    throw new W4EnterpriseStateError("W4_DECISION_PAYLOAD_BINDING_CONFLICT");
  }
}

function changedPaths(before: unknown, after: unknown, prefix = ""): string[] {
  if (
    before === null ||
    after === null ||
    typeof before !== "object" ||
    typeof after !== "object" ||
    Array.isArray(before) ||
    Array.isArray(after)
  ) {
    return JSON.stringify(before) === JSON.stringify(after) ? [] : [prefix || "state"];
  }
  const keys = new Set([
    ...Object.keys(before as Record<string, unknown>),
    ...Object.keys(after as Record<string, unknown>)
  ]);
  return [...keys]
    .sort()
    .flatMap((key) =>
      changedPaths(
        (before as Record<string, unknown>)[key],
        (after as Record<string, unknown>)[key],
        prefix ? `${prefix}.${key}` : key
      )
    );
}

function decisionIntentDigest(
  decisions: W4CanonicalStrategicDecision[],
  decisionIds: readonly string[]
): string | null {
  const selected = decisions
    .filter((decision) => decisionIds.includes(decision.decision_id))
    .map((decision) => ({ kind: decision.kind, payload: decision.payload }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return selected.length ? digest(selected) : null;
}

function stateRef(state: W4EnterpriseState, parent?: W4StateRef | null): W4StateRef {
  return {
    tenant_id: state.tenant_id,
    course_id: state.course_id,
    run_id: state.run_id,
    team_id: state.team_id,
    round_id: state.round_id,
    enterprise_state_id: state.enterprise_state_id,
    version: state.version,
    state_digest: state.state_digest,
    ...(parent === undefined ? {} : { parent_state_ref: parent })
  };
}

function scopeMatches(
  scope: W4ScopeContext,
  value: Pick<W4ScopeContext, "tenant_id" | "course_id" | "run_id" | "team_id">
): boolean {
  return (
    scope.tenant_id === value.tenant_id &&
    scope.course_id === value.course_id &&
    scope.run_id === value.run_id &&
    scope.team_id === value.team_id
  );
}

function runScopeMatches(
  scope: W4ScopeContext,
  value: Pick<W4ScopeContext, "tenant_id" | "course_id" | "run_id">
): boolean {
  return (
    scope.tenant_id === value.tenant_id &&
    scope.course_id === value.course_id &&
    scope.run_id === value.run_id
  );
}

function projectProfileReferencesEqual(
  left: W4ProjectPortfolioEntry["project_profile_reference"],
  right: W4ProjectPortfolioEntry["project_profile_reference"]
): boolean {
  return (
    left.tenant_id === right.tenant_id &&
    left.project_profile_id === right.project_profile_id &&
    left.version === right.version &&
    left.content_digest === right.content_digest
  );
}

function counterfactualCapitalActionSnapshot(
  action: W4CapitalAction,
  sourceRoundNo: number
): W4CapitalAction {
  if (action.blocked_reason === "W4_CAPITAL_POLICY_REQUIRED") return clone(action);
  const snapshot = clone(action);
  delete snapshot.blocked_reason;
  snapshot.status = action.effective_round_no <= sourceRoundNo ? "active" : "pending";
  return snapshot;
}

function assertProjectProfileReference(
  scope: W4ScopeContext,
  reference: W4ProjectPortfolioEntry["project_profile_reference"]
): void {
  if (
    !reference ||
    reference.tenant_id !== scope.tenant_id ||
    !reference.project_profile_id.trim() ||
    !reference.version.trim() ||
    !/^[a-f0-9]{64}$/.test(reference.content_digest)
  ) {
    throw new W4EnterpriseStateError("W4_PROJECT_PROFILE_REFERENCE_INVALID");
  }
}

function stateMatchesExactRef(state: W4EnterpriseState, reference: W4StateRef): boolean {
  return (
    state.enterprise_state_id === reference.enterprise_state_id &&
    state.tenant_id === reference.tenant_id &&
    state.course_id === reference.course_id &&
    state.run_id === reference.run_id &&
    state.team_id === reference.team_id &&
    state.round_id === reference.round_id &&
    state.version === reference.version &&
    state.state_digest === reference.state_digest &&
    (reference.parent_state_ref === undefined
      ? state.parent_state_ref === null
      : JSON.stringify(state.parent_state_ref) === JSON.stringify(reference.parent_state_ref))
  );
}

function assertOpeningStateLineage(
  snapshot: W4StoreState,
  scope: W4ScopeContext,
  opening: W4EnterpriseState,
  openingRef: W4StateRef
): void {
  if (scope.round_no === 1) {
    if (opening.round_no !== 1 || opening.parent_state_ref !== null) {
      throw new W4EnterpriseStateError("W4_OPENING_STATE_LINEAGE_CONFLICT");
    }
    return;
  }
  const predecessor = snapshot.outcomes.find(
    (outcome) =>
      scopeMatches(scope, outcome) && outcome.round_no === scope.round_no - 1
  );
  if (
    !predecessor ||
    opening.round_no !== scope.round_no - 1 ||
    !stateMatchesExactRef(opening, predecessor.closing_state_ref) ||
    JSON.stringify(openingRef) !== JSON.stringify(predecessor.closing_state_ref)
  ) {
    throw new W4EnterpriseStateError("W4_OPENING_STATE_LINEAGE_CONFLICT");
  }
}

function assertScope(scope: W4ScopeContext, value: W4CanonicalStrategicDecision): void {
  if (
    scope.tenant_id !== value.tenant_id ||
    scope.course_id !== value.course_id ||
    scope.run_id !== value.run_id ||
    scope.round_id !== value.round_id ||
    scope.round_no !== value.round_no ||
    scope.team_id !== value.team_id
  ) {
    throw new W4EnterpriseStateError("W4_SCOPE_CONFLICT");
  }
}

function assertDecisionAdmission(decision: W4CanonicalStrategicDecision): void {
  const admission = decision.admission;
  if (!admission || typeof admission !== "object") {
    throw new W4EnterpriseStateError("W4_DECISION_ADMISSION_REQUIRED");
  }
  if (admission.policy === "ROLE_WORKFLOW_REQUIRED") {
    if (
      admission.authority !== "formal_run_runtime_binding" ||
      !admission.canonical_decision_id ||
      !admission.merge_commit_id ||
      !admission.team_confirmation_id
    ) {
      throw new W4EnterpriseStateError("W4_DECISION_ADMISSION_REQUIRED");
    }
  } else if (
    admission.policy !== "LEGACY_DIRECT_EXPLICIT" ||
    admission.authority !== "synthetic_run_creation_marker" ||
    admission.canonical_decision_id !== null ||
    admission.merge_commit_id !== null ||
    admission.team_confirmation_id !== null
  ) {
    throw new W4EnterpriseStateError("W4_DECISION_ADMISSION_REQUIRED");
  }
  if (
    !/^[a-f0-9]{64}$/.test(admission.decision_payload_digest) ||
    admission.decision_payload_digest !==
      createW4DecisionPayloadDigest(decision.kind, decision.payload)
  ) {
    throw new W4EnterpriseStateError("W4_DECISION_PAYLOAD_BINDING_CONFLICT");
  }
}

function assertReplayInputManifest(
  scope: W4ScopeContext,
  openingStateRef: W4StateRef,
  manifest: W4ReplayInputManifest
): void {
  if (
    !manifest ||
    typeof manifest !== "object" ||
    manifest.tenant_id !== scope.tenant_id ||
    manifest.course_id !== scope.course_id ||
    manifest.run_id !== scope.run_id ||
    manifest.team_id !== scope.team_id ||
    manifest.round_id !== scope.round_id ||
    JSON.stringify(manifest.opening_state_ref) !== JSON.stringify(openingStateRef) ||
    !manifest.scenario_package_id ||
    !manifest.parameter_set_id ||
    !manifest.engine_id ||
    !Number.isInteger(manifest.seed) ||
    manifest.seed < 0 ||
    !Array.isArray(manifest.plugin_ids) ||
    manifest.plugin_ids.some((pluginId) => !pluginId.trim()) ||
    !Array.isArray(manifest.decision_ids) ||
    !Array.isArray(manifest.decision_payload_bindings) ||
    manifest.decision_ids.length !== manifest.decision_payload_bindings.length ||
    manifest.decision_ids.some(
      (decisionId, index) => manifest.decision_payload_bindings[index]?.decision_id !== decisionId
    ) ||
    manifest.decision_payload_bindings.some(
      (binding) =>
        !binding ||
        typeof binding.decision_id !== "string" ||
        !/^[a-f0-9]{64}$/.test(binding.decision_payload_digest)
    ) ||
    (manifest.project_portfolio_digest !== undefined &&
      !/^[a-f0-9]{64}$/.test(manifest.project_portfolio_digest)) ||
    (manifest.project_portfolio_entry_ids !== undefined &&
      (!Array.isArray(manifest.project_portfolio_entry_ids) ||
        manifest.project_portfolio_entry_ids.some((entryId) => typeof entryId !== "string"))) ||
    (manifest.project_portfolio_snapshot !== undefined &&
      !Array.isArray(manifest.project_portfolio_snapshot)) ||
    (manifest.project_initiative_snapshot !== undefined &&
      !Array.isArray(manifest.project_initiative_snapshot)) ||
    (manifest.capital_action_digest !== undefined &&
      !/^[a-f0-9]{64}$/.test(manifest.capital_action_digest)) ||
    (manifest.capital_action_ids !== undefined &&
      (!Array.isArray(manifest.capital_action_ids) ||
        manifest.capital_action_ids.some((actionId) => typeof actionId !== "string"))) ||
    (manifest.capital_action_snapshot !== undefined &&
      !Array.isArray(manifest.capital_action_snapshot))
  ) {
    throw new W4EnterpriseStateError("W4_REPLAY_MANIFEST_INVALID");
  }
}

function assertDecisionPayloadBindings(
  scope: W4ScopeContext,
  manifest: W4ReplayInputManifest,
  decisions: W4CanonicalStrategicDecision[]
): W4DecisionPayloadBinding[] {
  const selected = manifest.decision_payload_bindings.map((binding) => {
    const decision = decisions.find(
      (candidate) =>
        candidate.decision_id === binding.decision_id &&
        candidate.tenant_id === scope.tenant_id &&
        candidate.course_id === scope.course_id &&
        candidate.run_id === scope.run_id &&
        candidate.team_id === scope.team_id &&
        candidate.round_id === scope.round_id &&
        candidate.round_no === scope.round_no &&
        candidate.status === "canonical"
    );
    if (
      !decision ||
      decision.admission.decision_payload_digest !== binding.decision_payload_digest ||
      createW4DecisionPayloadDigest(decision.kind, decision.payload) !==
        binding.decision_payload_digest
    ) {
      throw new W4EnterpriseStateError("W4_REPLAY_DECISION_BINDING_CONFLICT");
    }
    return { ...binding };
  });
  return selected;
}

function projectPayload(decision: W4CanonicalStrategicDecision): W4EnterpriseStateData {
  const payload = decision.payload;
  if (decision.kind === "new_project") {
    const project = payload as {
      project_name: string;
      beds: number;
      area: number;
    };
    return {
      cash: 0,
      capacity: project.beds,
      capital: emptyCapitalPosition(),
      product_lines: [],
      positioning: "",
      organization: {},
      operating_units: [],
      portfolio: { projects: [project.project_name], facilities: [] }
    };
  }
  return {
    cash: 0,
    capacity: 0,
    capital: emptyCapitalPosition(),
    product_lines: [],
    positioning: "",
    organization: {},
    operating_units: [],
    portfolio: { projects: [], facilities: [] }
  };
}

function strategicActionProjection(
  decision: W4CanonicalStrategicDecision
): NonNullable<W4ProjectionBase["latest_strategic_action"]> {
  const payload = decision.payload as unknown as Record<string, unknown>;
  const hasActionMetadata =
    typeof payload.reversible === "boolean" &&
    Array.isArray(payload.dependencies) &&
    typeof payload.kpi_hypothesis === "string";
  return {
    decision_id: decision.decision_id,
    kind: decision.kind,
    version: decision.version,
    admission: {
      policy: decision.admission.policy,
      authority: decision.admission.authority,
      canonical_decision_id: decision.admission.canonical_decision_id,
      merge_commit_id: decision.admission.merge_commit_id,
      team_confirmation_id: decision.admission.team_confirmation_id
    },
    cost:
      typeof payload.cost === "number"
        ? payload.cost
        : typeof payload.fees === "number"
          ? payload.fees
          : 0,
    lead_time_rounds: typeof payload.lead_time_rounds === "number" ? payload.lead_time_rounds : 0,
    reversible: hasActionMetadata ? Boolean(payload.reversible) : false,
    dependencies: hasActionMetadata
      ? (payload.dependencies as string[]).map((dependency) => String(dependency))
      : [],
    kpi_hypothesis: hasActionMetadata ? String(payload.kpi_hypothesis) : "未提供 KPI 假设",
    known_limits: hasActionMetadata
      ? []
      : [
          "当前 New Project 历史兼容 payload 未包含 reversible/dependencies/kpi_hypothesis；默认值不代表业务确认。"
        ]
  };
}

function validateStrategicDecision(decision: W4CanonicalStrategicDecision): void {
  if (decision.kind !== "new_project") {
    if (decision.kind === "capital_action") {
      validateCapitalActionPayload(decision.payload);
      return;
    }
    validateTypedAdjustmentPayload(decision.kind, decision.payload);
    return;
  }
  const payload = decision.payload as {
    project_name?: unknown;
    cost?: unknown;
    cycle_rounds?: unknown;
    area?: unknown;
    beds?: unknown;
    bed_mix?: unknown;
    ramp?: unknown;
    lead_time_rounds?: unknown;
  };
  const expectedKeys = [
    "area",
    "bed_mix",
    "beds",
    "cost",
    "cycle_rounds",
    "lead_time_rounds",
    "project_name",
    "ramp"
  ];
  if (
    Object.keys(payload).length !== expectedKeys.length ||
    Object.keys(payload).some((key) => !expectedKeys.includes(key))
  ) {
    throw new W4EnterpriseStateError("W4_NEW_PROJECT_INVALID");
  }
  const numericFields = [
    "cost",
    "cycle_rounds",
    "area",
    "beds",
    "ramp",
    "lead_time_rounds"
  ] as const;
  if (
    typeof payload.project_name !== "string" ||
    payload.project_name.trim() === "" ||
    numericFields.some(
      (field) => typeof payload[field] !== "number" || !Number.isFinite(payload[field])
    ) ||
    Number(payload.cost) < 0 ||
    Number(payload.cycle_rounds) < 1 ||
    Number(payload.area) <= 0 ||
    Number(payload.beds) <= 0 ||
    Number(payload.ramp) < 0 ||
    Number(payload.ramp) > 1 ||
    Number(payload.lead_time_rounds) < 0 ||
    !Number.isInteger(Number(payload.lead_time_rounds)) ||
    !payload.bed_mix ||
    typeof payload.bed_mix !== "object"
  ) {
    throw new W4EnterpriseStateError("W4_NEW_PROJECT_INVALID");
  }
  const bedMixTotal = Object.values(payload.bed_mix as Record<string, unknown>).reduce<number>(
    (sum, value) => sum + (typeof value === "number" ? value : Number.NaN),
    0
  );
  if (
    bedMixTotal !== Number(payload.beds) ||
    Object.values(payload.bed_mix).some((value) => Number(value) < 0)
  ) {
    throw new W4EnterpriseStateError("W4_NEW_PROJECT_BED_MIX_INVALID");
  }
}

function validateCapitalActionPayload(input: unknown): asserts input is W4CapitalActionPayload {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new W4EnterpriseStateError("W4_CAPITAL_ACTION_INVALID");
  }
  const payload = input as Record<string, unknown>;
  const requiredKeys = [
    "capital_action_kind",
    "covenant_min_cash",
    "cost_source",
    "dependencies",
    "fees",
    "kpi_hypothesis",
    "lead_time_rounds",
    "obligation",
    "principal",
    "rate_or_cost_bps",
    "rationale",
    "reversible",
    "term_rounds"
  ];
  const optionalKeys = ["initiative_id", "policy_seam_id", "project_entry_id"];
  const actualKeys = Object.keys(payload).sort();
  const allowedKeys = [...requiredKeys, ...optionalKeys].sort();
  if (
    requiredKeys.some((key) => !(key in payload)) ||
    actualKeys.some((key) => !allowedKeys.includes(key))
  ) {
    throw new W4EnterpriseStateError("W4_CAPITAL_ACTION_INVALID");
  }
  if (
    typeof payload.capital_action_kind !== "string" ||
    ![
      "debt",
      "project_finance",
      "working_capital",
      "asset_backed_securitization",
      "initial_public_offering"
    ].includes(payload.capital_action_kind) ||
    typeof payload.principal !== "number" ||
    !Number.isFinite(payload.principal) ||
    payload.principal <= 0 ||
    !Number.isInteger(payload.term_rounds) ||
    Number(payload.term_rounds) < 1 ||
    typeof payload.rate_or_cost_bps !== "number" ||
    !Number.isFinite(payload.rate_or_cost_bps) ||
    payload.rate_or_cost_bps < 0 ||
    typeof payload.cost_source !== "string" ||
    payload.cost_source.trim() === "" ||
    typeof payload.covenant_min_cash !== "number" ||
    !Number.isFinite(payload.covenant_min_cash) ||
    payload.covenant_min_cash < 0 ||
    typeof payload.fees !== "number" ||
    !Number.isFinite(payload.fees) ||
    payload.fees < 0 ||
    typeof payload.obligation !== "string" ||
    ![
      "term_debt",
      "project_finance",
      "working_capital_revolver",
      "securitized_receivable",
      "equity"
    ].includes(payload.obligation) ||
    typeof payload.rationale !== "string" ||
    payload.rationale.trim() === "" ||
    typeof payload.reversible !== "boolean" ||
    !Number.isInteger(payload.lead_time_rounds) ||
    Number(payload.lead_time_rounds) < 0 ||
    typeof payload.kpi_hypothesis !== "string" ||
    payload.kpi_hypothesis.trim() === "" ||
    !Array.isArray(payload.dependencies) ||
    payload.dependencies.some((item) => typeof item !== "string" || item.trim() === "")
  ) {
    throw new W4EnterpriseStateError("W4_CAPITAL_ACTION_INVALID");
  }
  const expectedObligation: Record<string, W4CapitalObligation> = {
    debt: "term_debt",
    project_finance: "project_finance",
    working_capital: "working_capital_revolver",
    asset_backed_securitization: "securitized_receivable",
    initial_public_offering: "equity"
  };
  if (payload.obligation !== expectedObligation[payload.capital_action_kind]) {
    throw new W4EnterpriseStateError("W4_CAPITAL_ACTION_INVALID");
  }
  for (const key of optionalKeys) {
    if (payload[key] !== undefined && (typeof payload[key] !== "string" || !payload[key].trim())) {
      throw new W4EnterpriseStateError("W4_CAPITAL_ACTION_INVALID");
    }
  }
  if (payload.capital_action_kind === "project_finance") {
    if (!payload.project_entry_id || !payload.initiative_id) {
      throw new W4EnterpriseStateError("W4_CAPITAL_PROJECT_REQUIRED");
    }
  }
}

function validateTypedAdjustmentPayload(
  kind: Exclude<W4StrategicDecisionKind, "new_project" | "capital_action">,
  input: unknown
): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new W4EnterpriseStateError("W4_STRATEGIC_ACTION_INVALID");
  }
  const payload = input as Record<string, unknown>;
  const commonKeys = [
    "dependencies",
    "kpi_hypothesis",
    "lead_time_rounds",
    "rationale",
    "reversible"
  ];
  const kindKeys: Record<typeof kind, string[]> = {
    product_line_adjustment: ["operation", "product_line_id", "target_value"],
    positioning_adjustment: ["positioning"],
    organization_adjustment: ["headcount_delta", "unit_name"]
  };
  const expectedKeys = [...commonKeys, ...(kindKeys[kind] ?? [])].sort();
  const actualKeys = Object.keys(payload).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new W4EnterpriseStateError("W4_STRATEGIC_ACTION_INVALID");
  }
  if (
    typeof payload.rationale !== "string" ||
    payload.rationale.trim() === "" ||
    typeof payload.kpi_hypothesis !== "string" ||
    payload.kpi_hypothesis.trim() === "" ||
    typeof payload.reversible !== "boolean" ||
    !Number.isInteger(payload.lead_time_rounds) ||
    Number(payload.lead_time_rounds) < 0 ||
    !Array.isArray(payload.dependencies) ||
    payload.dependencies.some((item) => typeof item !== "string" || item.trim() === "")
  ) {
    throw new W4EnterpriseStateError("W4_STRATEGIC_ACTION_INVALID");
  }
  if (kind === "product_line_adjustment") {
    if (
      typeof payload.product_line_id !== "string" ||
      payload.product_line_id.trim() === "" ||
      !["add", "update", "remove"].includes(String(payload.operation)) ||
      typeof payload.target_value !== "string" ||
      payload.target_value.trim() === ""
    ) {
      throw new W4EnterpriseStateError("W4_STRATEGIC_ACTION_INVALID");
    }
  } else if (kind === "positioning_adjustment") {
    if (typeof payload.positioning !== "string" || payload.positioning.trim() === "") {
      throw new W4EnterpriseStateError("W4_STRATEGIC_ACTION_INVALID");
    }
  } else if (
    typeof payload.unit_name !== "string" ||
    payload.unit_name.trim() === "" ||
    !Number.isInteger(payload.headcount_delta) ||
    Number(payload.headcount_delta) === 0
  ) {
    throw new W4EnterpriseStateError("W4_STRATEGIC_ACTION_INVALID");
  }
}

export function createInMemoryW4Repository(initial?: Partial<W4StoreState>): W4Repository & {
  failNextCommit: boolean;
  snapshot(): W4StoreState;
} {
  let current: W4StoreState = {
    states: clone(initial?.states ?? []),
    decisions: clone(initial?.decisions ?? []),
    commitments: clone(initial?.commitments ?? []),
    effects: clone(initial?.effects ?? []),
    initiatives: clone(initial?.initiatives ?? []),
    projectPortfolio: clone(initial?.projectPortfolio ?? []),
    projectTransactions: clone(initial?.projectTransactions ?? []),
    capitalActions: clone(initial?.capitalActions ?? []),
    policySeams: clone(initial?.policySeams ?? []),
    outcomes: clone(initial?.outcomes ?? []),
    replayEvidence: clone(initial?.replayEvidence ?? [])
  };
  const repository: W4Repository & { failNextCommit: boolean } = {
    failNextCommit: false,
    snapshot: () => clone(current),
    replace: (next) => {
      current = clone(next);
    },
    commit: async (next) => {
      current = clone(next);
      if (repository.failNextCommit) {
        repository.failNextCommit = false;
        throw new W4EnterpriseStateError("W4_ATOMIC_COMMIT_FAILED");
      }
    }
  };
  return repository;
}

export function createEnterpriseStateStrategicEvolutionService(repository: W4Repository) {
  return {
    async createInitialState(
      scope: W4ScopeContext,
      input: W4EnterpriseState
    ): Promise<{ state: W4EnterpriseState; state_ref: W4StateRef; state_digest: string }> {
      const current = repository.snapshot();
      if (
        current.states.some(
          (state) =>
            state.tenant_id === scope.tenant_id &&
            state.run_id === scope.run_id &&
            state.team_id === scope.team_id &&
            state.round_no === 1
        )
      ) {
        throw new W4EnterpriseStateError("W4_INITIAL_STATE_EXISTS");
      }
      if (
        scope.tenant_id !== input.tenant_id ||
        scope.course_id !== input.course_id ||
        scope.run_id !== input.run_id ||
        scope.team_id !== input.team_id
      ) {
        throw new W4EnterpriseStateError("W4_SCOPE_CONFLICT");
      }
      const normalizedStateData = normalizeStateData(input.state);
      const normalized: W4EnterpriseState = {
        ...clone(input),
        state_digest: digest(normalizedStateData),
        state: normalizedStateData,
        parent_state_ref: null
      };
      current.states.push(normalized);
      await repository.commit(current);
      return {
        state: clone(normalized),
        state_ref: stateRef(normalized),
        state_digest: normalized.state_digest
      };
    },

    async commitStrategicDecision(
      scope: W4ScopeContext,
      decision: W4CanonicalStrategicDecision
    ): Promise<W4CompiledStrategicDecision> {
      assertScope(scope, decision);
      assertDecisionAdmission(decision);
      const current = repository.snapshot();
      if (current.decisions.some((item) => item.decision_id === decision.decision_id)) {
        throw new W4EnterpriseStateError("W4_DUPLICATE_COMMAND");
      }
      if (decision.status !== "canonical") {
        throw new W4EnterpriseStateError("W4_DECISION_NOT_CANONICAL");
      }
      validateStrategicDecision(decision);
      const leadTime = Number(
        (decision.payload as { lead_time_rounds?: number }).lead_time_rounds ?? 0
      );
      const capitalPayload =
        decision.kind === "capital_action"
          ? (decision.payload as unknown as W4CapitalActionPayload)
          : undefined;
      let capitalAction: W4CapitalAction | undefined;
      if (capitalPayload) {
        if (capitalPayload.capital_action_kind === "project_finance") {
          const projectEntry = current.projectPortfolio.find(
            (entry) =>
              entry.project_entry_id === capitalPayload.project_entry_id &&
              entry.initiative_id === capitalPayload.initiative_id &&
              scopeMatches(scope, entry) &&
              entry.ownership_status === "owned"
          );
          if (!projectEntry) throw new W4EnterpriseStateError("W4_CAPITAL_PROJECT_REQUIRED");
        }
        const policyRequired = ["asset_backed_securitization", "initial_public_offering"].includes(
          capitalPayload.capital_action_kind
        );
        const policySeam = capitalPayload.policy_seam_id
          ? current.policySeams.find(
              (seam) =>
                seam.policy_seam_id === capitalPayload.policy_seam_id && scopeMatches(scope, seam)
            )
          : undefined;
        const blockedReason =
          policyRequired &&
          (!policySeam ||
            policySeam.kind !== capitalPayload.capital_action_kind ||
            policySeam.status !== "approved")
            ? "W4_CAPITAL_POLICY_REQUIRED"
            : undefined;
        const capitalActionStatus: W4CapitalActionStatus = blockedReason
          ? "blocked"
          : leadTime > 0
            ? "pending"
            : "active";
        capitalAction = {
          capital_action_id: `capital_action_${decision.decision_id}`,
          decision_id: decision.decision_id,
          decision_payload_digest: decision.admission.decision_payload_digest,
          tenant_id: decision.tenant_id,
          course_id: decision.course_id,
          run_id: decision.run_id,
          team_id: decision.team_id,
          kind: capitalPayload.capital_action_kind,
          status: capitalActionStatus,
          ...(blockedReason ? { blocked_reason: blockedReason } : {}),
          principal: capitalPayload.principal,
          term_rounds: capitalPayload.term_rounds,
          rate_or_cost_bps: capitalPayload.rate_or_cost_bps,
          cost_source: capitalPayload.cost_source,
          covenant_min_cash: capitalPayload.covenant_min_cash,
          fees: capitalPayload.fees,
          obligation: capitalPayload.obligation,
          project_entry_id: capitalPayload.project_entry_id ?? null,
          initiative_id: capitalPayload.initiative_id ?? null,
          policy_seam_id: capitalPayload.policy_seam_id ?? null,
          created_round_no: decision.round_no,
          effective_round_no: decision.round_no + leadTime,
          maturity_round_no: decision.round_no + leadTime + capitalPayload.term_rounds
        };
      }
      const commitment: W4Commitment = {
        commitment_id: `commitment_${decision.decision_id}`,
        decision_id: decision.decision_id,
        decision_payload_digest: decision.admission.decision_payload_digest,
        tenant_id: decision.tenant_id,
        course_id: decision.course_id,
        run_id: decision.run_id,
        team_id: decision.team_id,
        kind: decision.kind,
        status: "active",
        cost:
          decision.kind === "new_project"
            ? Number((decision.payload as { cost?: number }).cost ?? 0)
            : capitalAction?.status === "blocked"
              ? 0
              : (capitalPayload?.fees ?? 0),
        created_round_no: decision.round_no
      };
      const project =
        decision.kind === "new_project"
          ? clone(
              decision.payload as W4CanonicalStrategicDecision["payload"] & Record<string, unknown>
            )
          : null;
      const effect: W4StrategicEffect = {
        effect_id: `effect_${decision.decision_id}`,
        commitment_id: commitment.commitment_id,
        decision_payload_digest: decision.admission.decision_payload_digest,
        tenant_id: decision.tenant_id,
        course_id: decision.course_id,
        run_id: decision.run_id,
        team_id: decision.team_id,
        status:
          capitalAction?.status === "blocked" ? "expired" : leadTime > 0 ? "pending" : "active",
        effective_round_no: decision.round_no + leadTime,
        effect: projectPayload(decision) as unknown as Record<string, unknown>
      };
      const initiative: W4StrategicInitiative = {
        initiative_id: `initiative_${decision.decision_id}`,
        commitment_id: commitment.commitment_id,
        tenant_id: decision.tenant_id,
        course_id: decision.course_id,
        run_id: decision.run_id,
        team_id: decision.team_id,
        kind: decision.kind,
        status:
          capitalAction?.status === "blocked" ? "blocked" : leadTime > 0 ? "in_progress" : "active",
        current_milestone:
          capitalAction?.status === "blocked"
            ? "policy_blocked"
            : leadTime > 0
              ? "construction"
              : "activated",
        milestones:
          capitalAction?.status === "blocked"
            ? ["approved", "policy_blocked"]
            : leadTime > 0
              ? ["approved", "construction", "activated"]
              : ["approved", "activated"],
        remaining_lead_time_rounds: leadTime,
        activation_round_no: decision.round_no + leadTime,
        created_round_no: decision.round_no,
        ...(decision.kind === "new_project"
          ? { project_lifecycle_status: leadTime > 0 ? "Feasibility" : "Operating" }
          : {}),
        project: project as W4StrategicInitiative["project"]
      };
      current.decisions.push(clone(decision));
      current.commitments.push(commitment);
      current.effects.push(effect);
      current.initiatives.push(initiative);
      if (capitalAction) current.capitalActions.push(capitalAction);
      await repository.commit(current);
      return {
        decision: clone(decision),
        commitment,
        effect,
        initiative,
        ...(capitalAction ? { capital_action: clone(capitalAction) } : {})
      };
    },

    async advanceInitiative(
      scope: W4ScopeContext,
      initiativeId: string,
      target: W4StrategicInitiative["status"]
    ): Promise<W4StrategicInitiative> {
      const current = repository.snapshot();
      const initiative = current.initiatives.find((item) => item.initiative_id === initiativeId);
      if (!initiative || !scopeMatches(scope, initiative)) {
        throw new W4EnterpriseStateError("W4_INITIATIVE_NOT_FOUND");
      }
      const allowed: Record<W4StrategicInitiative["status"], string[]> = {
        draft: ["in_progress", "cancelled"],
        in_progress: ["blocked", "active", "failed", "cancelled"],
        blocked: ["in_progress", "failed", "cancelled"],
        active: ["completed", "failed"],
        completed: [],
        failed: [],
        cancelled: []
      };
      if (!allowed[initiative.status].includes(target)) {
        throw new W4EnterpriseStateError("W4_INVALID_INITIATIVE_TRANSITION");
      }
      initiative.status = target;
      if (target === "active") initiative.current_milestone = "activated";
      if (target === "completed") initiative.current_milestone = "completed";
      await repository.commit(current);
      return clone(initiative);
    },

    async addProjectToPortfolio(
      scope: W4ScopeContext,
      input: W4ProjectPortfolioInput
    ): Promise<W4ProjectPortfolioEntry> {
      const current = repository.snapshot();
      const before = clone(current);
      if (
        !input.project_entry_id.trim() ||
        !input.initiative_id.trim() ||
        !input.source_assignment_id.trim() ||
        !input.project_name.trim()
      ) {
        throw new W4EnterpriseStateError("W4_PROJECT_PORTFOLIO_INPUT_INVALID");
      }
      const dependencyProjectEntryIds = [...new Set(input.dependency_project_entry_ids ?? [])];
      if (
        dependencyProjectEntryIds.some(
          (dependencyId) => typeof dependencyId !== "string" || !dependencyId.trim()
        ) || dependencyProjectEntryIds.includes(input.project_entry_id)
      ) {
        throw new W4EnterpriseStateError("W4_PROJECT_PORTFOLIO_INPUT_INVALID");
      }
      if (
        current.projectPortfolio.some((entry) => entry.project_entry_id === input.project_entry_id)
      ) {
        throw new W4EnterpriseStateError("W4_DUPLICATE_COMMAND");
      }
      if (
        current.projectPortfolio.some(
          (entry) =>
            entry.source_assignment_id === input.source_assignment_id && scopeMatches(scope, entry)
        )
      ) {
        throw new W4EnterpriseStateError("W4_PROJECT_ASSIGNMENT_ALREADY_BOUND");
      }
      const initiative = current.initiatives.find(
        (item) =>
          item.initiative_id === input.initiative_id &&
          scopeMatches(scope, item) &&
          item.kind === "new_project" &&
          item.project !== null
      );
      if (!initiative) throw new W4EnterpriseStateError("W4_PROJECT_INITIATIVE_REQUIRED");
      if (
        (initiative.source_assignment_id &&
          initiative.source_assignment_id !== input.source_assignment_id) ||
        (initiative.project_profile_reference &&
          !projectProfileReferencesEqual(
            initiative.project_profile_reference,
            input.project_profile_reference
          ))
      ) {
        throw new W4EnterpriseStateError("W4_PROJECT_ASSIGNMENT_SCOPE_CONFLICT");
      }
      if (
        dependencyProjectEntryIds.some(
          (dependencyId) =>
            !current.projectPortfolio.some(
              (entry) =>
                entry.project_entry_id === dependencyId && scopeMatches(scope, entry)
            )
        )
      ) {
        throw new W4EnterpriseStateError("W4_PROJECT_DEPENDENCY_SCOPE_CONFLICT");
      }
      assertProjectProfileReference(scope, input.project_profile_reference);
      initiative.source_assignment_id = input.source_assignment_id;
      initiative.project_profile_reference = clone(input.project_profile_reference);
      initiative.project_lifecycle_status = "Opportunity";
      const entry: W4ProjectPortfolioEntry = {
        project_entry_id: input.project_entry_id,
        initiative_id: input.initiative_id,
        source_assignment_id: input.source_assignment_id,
        project_profile_reference: clone(input.project_profile_reference),
        project_name: input.project_name,
        tenant_id: scope.tenant_id,
        course_id: scope.course_id,
        run_id: scope.run_id,
        team_id: scope.team_id,
        lifecycle_status: "Opportunity",
        ownership_status: "owned",
        operating_unit_id: null,
        successor_of_entry_id: null,
        dependency_project_entry_ids: dependencyProjectEntryIds,
        created_round_no: scope.round_no,
        updated_round_no: scope.round_no
      };
      const transaction: W4ProjectTransaction = {
        transaction_id: `transaction_${input.project_entry_id}`,
        kind: "project_add",
        phase: "Closed",
        initiative_id: input.initiative_id,
        project_entry_id: input.project_entry_id,
        tenant_id: scope.tenant_id,
        course_id: scope.course_id,
        run_id: scope.run_id,
        team_id: scope.team_id,
        created_round_no: scope.round_no,
        updated_round_no: scope.round_no
      };
      current.projectPortfolio.push(entry);
      current.projectTransactions.push(transaction);
      await commitW4Mutation(repository, before, current);
      return clone(entry);
    },

    async createProjectTransaction(
      scope: W4ScopeContext,
      input: W4ProjectTransactionInput
    ): Promise<W4ProjectTransaction> {
      const current = repository.snapshot();
      const before = clone(current);
      if (
        current.projectTransactions.some((item) => item.transaction_id === input.transaction_id)
      ) {
        throw new W4EnterpriseStateError("W4_DUPLICATE_COMMAND");
      }
      const initiative = current.initiatives.find(
        (item) => item.initiative_id === input.initiative_id && scopeMatches(scope, item)
      );
      const entry = current.projectPortfolio.find(
        (item) => item.project_entry_id === input.project_entry_id && scopeMatches(scope, item)
      );
      if (!initiative || !entry || entry.initiative_id !== input.initiative_id) {
        throw new W4EnterpriseStateError("W4_PROJECT_TRANSACTION_SCOPE_CONFLICT");
      }
      if (entry.ownership_status !== "owned") {
        throw new W4EnterpriseStateError("W4_PROJECT_NOT_OWNED");
      }
      if (input.kind === "merger_acquisition") {
        if (
          !input.target_project_profile_reference ||
          !input.target_source_assignment_id?.trim() ||
          !input.target_project_name?.trim()
        ) {
          throw new W4EnterpriseStateError("W4_M_AND_A_SUCCESSOR_REQUIRED");
        }
        assertProjectProfileReference(scope, input.target_project_profile_reference);
        if (
          current.projectPortfolio.some(
            (entry) =>
              scopeMatches(scope, entry) &&
              entry.source_assignment_id === input.target_source_assignment_id
          )
        ) {
          throw new W4EnterpriseStateError("W4_PROJECT_ASSIGNMENT_ALREADY_BOUND");
        }
      }
      const transaction: W4ProjectTransaction = {
        transaction_id: input.transaction_id,
        kind: input.kind,
        phase: "Listing",
        initiative_id: input.initiative_id,
        project_entry_id: input.project_entry_id,
        ...(input.target_project_profile_reference
          ? { target_project_profile_reference: clone(input.target_project_profile_reference) }
          : {}),
        ...(input.target_source_assignment_id
          ? { target_source_assignment_id: input.target_source_assignment_id }
          : {}),
        ...(input.target_project_name ? { target_project_name: input.target_project_name } : {}),
        tenant_id: scope.tenant_id,
        course_id: scope.course_id,
        run_id: scope.run_id,
        team_id: scope.team_id,
        created_round_no: scope.round_no,
        updated_round_no: scope.round_no
      };
      current.projectTransactions.push(transaction);
      await commitW4Mutation(repository, before, current);
      return clone(transaction);
    },

    async advanceProjectTransaction(
      scope: W4ScopeContext,
      transactionId: string,
      target: W4ProjectTransactionPhase,
      confirmations: W4ProjectTransactionConfirmationInput = {}
    ): Promise<W4ProjectTransaction> {
      const current = repository.snapshot();
      const before = clone(current);
      const transaction = current.projectTransactions.find(
        (item) => item.transaction_id === transactionId && scopeMatches(scope, item)
      );
      if (!transaction || transaction.kind === "project_add") {
        throw new W4EnterpriseStateError("W4_PROJECT_TRANSACTION_NOT_FOUND");
      }
      const allowed: Record<
        Exclude<W4ProjectTransactionKind, "project_add">,
        Record<W4ProjectTransactionPhase, W4ProjectTransactionPhase[]>
      > = {
        project_sale: {
          Listing: ["Bid", "Cancelled"],
          Bid: ["DueDiligence", "Cancelled"],
          DueDiligence: ["Negotiation", "Cancelled"],
          Negotiation: ["TermSheet", "Cancelled"],
          TermSheet: ["Closing", "Cancelled"],
          Closing: ["Closed", "Cancelled"],
          Closed: [],
          Cancelled: []
        },
        project_closure: {
          Listing: ["Closing", "Cancelled"],
          Bid: [],
          DueDiligence: [],
          Negotiation: [],
          TermSheet: [],
          Closing: ["Closed", "Cancelled"],
          Closed: [],
          Cancelled: []
        },
        merger_acquisition: {
          Listing: ["Bid", "Cancelled"],
          Bid: ["DueDiligence", "Cancelled"],
          DueDiligence: ["Negotiation", "Cancelled"],
          Negotiation: ["TermSheet", "Cancelled"],
          TermSheet: ["Closing", "Cancelled"],
          Closing: ["Closed", "Cancelled"],
          Closed: [],
          Cancelled: []
        }
      };
      if (!allowed[transaction.kind][transaction.phase].includes(target)) {
        throw new W4EnterpriseStateError("W4_INVALID_PROJECT_TRANSACTION_TRANSITION");
      }
      if (target === "Closing") {
        const buyer = confirmations.buyer_confirmation_id ?? transaction.buyer_confirmation_id;
        const seller = confirmations.seller_confirmation_id ?? transaction.seller_confirmation_id;
        if (transaction.kind === "merger_acquisition" && (!buyer || !seller)) {
          throw new W4EnterpriseStateError("W4_M_AND_A_DUAL_CONFIRMATION_REQUIRED");
        }
        if (buyer) transaction.buyer_confirmation_id = buyer;
        if (seller) transaction.seller_confirmation_id = seller;
      }
      if (target === "Closed") {
        if (transaction.phase !== "Closing") {
          throw new W4EnterpriseStateError("W4_INVALID_PROJECT_TRANSACTION_TRANSITION");
        }
        if (
          transaction.kind === "merger_acquisition" &&
          (!transaction.buyer_confirmation_id || !transaction.seller_confirmation_id)
        ) {
          throw new W4EnterpriseStateError("W4_M_AND_A_DUAL_CONFIRMATION_REQUIRED");
        }
        const entry = current.projectPortfolio.find(
          (item) => item.project_entry_id === transaction.project_entry_id
        );
        if (!entry) throw new W4EnterpriseStateError("W4_PROJECT_TRANSACTION_SCOPE_CONFLICT");
        entry.updated_round_no = scope.round_no;
        entry.operating_unit_id = null;
        entry.lifecycle_status = "Closed";
        entry.ownership_status = transaction.kind === "project_closure" ? "closed" : "sold";
        if (transaction.kind === "merger_acquisition") {
          const sourceInitiative = current.initiatives.find(
            (initiative) => initiative.initiative_id === transaction.initiative_id
          );
          if (!sourceInitiative?.project) {
            throw new W4EnterpriseStateError("W4_PROJECT_TRANSACTION_SCOPE_CONFLICT");
          }
          const successorInitiativeId = `${transaction.transaction_id}:successor`;
          current.initiatives.push({
            ...clone(sourceInitiative),
            initiative_id: successorInitiativeId,
            commitment_id: `${transaction.transaction_id}:successor-commitment`,
            status: "in_progress",
            current_milestone: "approved",
            milestones: ["approved", "activated"],
            remaining_lead_time_rounds: 0,
            activation_round_no: scope.round_no,
            created_round_no: scope.round_no,
            ...(transaction.target_source_assignment_id
              ? { source_assignment_id: transaction.target_source_assignment_id }
              : {}),
            ...(transaction.target_project_profile_reference
              ? {
                  project_profile_reference: clone(transaction.target_project_profile_reference)
                }
              : {}),
            project_lifecycle_status: "Opportunity",
            project: {
              ...clone(sourceInitiative.project),
              project_name: transaction.target_project_name ?? sourceInitiative.project.project_name
            }
          });
          const successor: W4ProjectPortfolioEntry = {
            ...clone(entry),
            project_entry_id: `${transaction.transaction_id}:successor`,
            initiative_id: successorInitiativeId,
            project_profile_reference: clone(
              transaction.target_project_profile_reference ?? entry.project_profile_reference
            ),
            ...(transaction.target_source_assignment_id
              ? { source_assignment_id: transaction.target_source_assignment_id }
              : {}),
            project_name: transaction.target_project_name ?? entry.project_name,
            lifecycle_status: "Opportunity",
            ownership_status: "owned",
            operating_unit_id: null,
            successor_of_entry_id: entry.project_entry_id,
            created_round_no: scope.round_no,
            updated_round_no: scope.round_no
          };
          entry.successor_of_entry_id = successor.project_entry_id;
          current.projectPortfolio.push(successor);
        }
      }
      transaction.phase = target;
      transaction.updated_round_no = scope.round_no;
      await commitW4Mutation(repository, before, current);
      return clone(transaction);
    },

    async advanceProjectLifecycle(
      scope: W4ScopeContext,
      initiativeId: string,
      target: W4ProjectLifecycleStatus
    ): Promise<W4StrategicInitiative> {
      const current = repository.snapshot();
      const before = clone(current);
      const initiative = current.initiatives.find(
        (item) =>
          item.initiative_id === initiativeId && scopeMatches(scope, item) && item.project !== null
      );
      if (!initiative || !initiative.project_lifecycle_status) {
        throw new W4EnterpriseStateError("W4_PROJECT_LIFECYCLE_NOT_FOUND");
      }
      const portfolioEntry = current.projectPortfolio.find(
        (entry) => entry.initiative_id === initiative.initiative_id && scopeMatches(scope, entry)
      );
      const currentLifecycle =
        portfolioEntry?.lifecycle_status ?? initiative.project_lifecycle_status;
      const allowed: Record<W4ProjectLifecycleStatus, W4ProjectLifecycleStatus[]> = {
        Opportunity: ["Feasibility", "Cancelled"],
        Feasibility: ["DueDiligence", "Cancelled"],
        DueDiligence: ["Negotiation", "Cancelled"],
        Negotiation: ["TermSheet", "Cancelled"],
        TermSheet: ["Operating", "Cancelled"],
        Operating: ["Closed"],
        Closed: [],
        Cancelled: []
      };
      if (!allowed[currentLifecycle].includes(target)) {
        throw new W4EnterpriseStateError("W4_INVALID_PROJECT_LIFECYCLE_TRANSITION");
      }
      if (target === "Operating" && scope.round_no < initiative.activation_round_no) {
        throw new W4EnterpriseStateError("W4_PROJECT_LIFECYCLE_LEAD_TIME_CONFLICT");
      }
      initiative.project_lifecycle_status = target;
      if (portfolioEntry) {
        if (
          target === "Closed" &&
          !current.projectTransactions.some(
            (transaction) =>
              transaction.project_entry_id === portfolioEntry.project_entry_id &&
              transaction.kind === "project_closure" &&
              transaction.phase === "Closed"
          )
        ) {
          throw new W4EnterpriseStateError("W4_PROJECT_TRANSACTION_REQUIRED");
        }
        portfolioEntry.lifecycle_status = target;
        portfolioEntry.updated_round_no = scope.round_no;
        if (target === "Operating") {
          portfolioEntry.operating_unit_id = `operating-unit-${portfolioEntry.project_entry_id}`;
        }
        if (target === "Cancelled" || target === "Closed") {
          portfolioEntry.operating_unit_id = null;
          if (target === "Cancelled") portfolioEntry.ownership_status = "closed";
        }
      }
      await commitW4Mutation(repository, before, current);
      return clone(initiative);
    },

    async createPolicySeam(
      scope: W4ScopeContext,
      input: {
        policy_seam_id: string;
        kind: W4PolicySeamKind;
        payload: Record<string, unknown>;
      }
    ): Promise<W4PolicySeam> {
      const current = repository.snapshot();
      if (current.policySeams.some((item) => item.policy_seam_id === input.policy_seam_id)) {
        throw new W4EnterpriseStateError("W4_DUPLICATE_COMMAND");
      }
      const seam: W4PolicySeam = {
        policy_seam_id: input.policy_seam_id,
        kind: input.kind,
        tenant_id: scope.tenant_id,
        course_id: scope.course_id,
        run_id: scope.run_id,
        team_id: scope.team_id,
        round_no: scope.round_no,
        status: "proposed",
        payload: clone(input.payload),
        requires_policy_approval: true,
        may_write_enterprise_state: false,
        may_write_official_outcome: false
      };
      current.policySeams.push(seam);
      await repository.commit(current);
      return clone(seam);
    },

    async advancePolicySeam(
      scope: W4ScopeContext,
      policySeamId: string,
      target: W4PolicySeamStatus
    ): Promise<W4PolicySeam> {
      const current = repository.snapshot();
      const seam = current.policySeams.find(
        (item) => item.policy_seam_id === policySeamId && scopeMatches(scope, item)
      );
      if (!seam) throw new W4EnterpriseStateError("W4_POLICY_SEAM_NOT_FOUND");
      const allowed: Record<W4PolicySeamStatus, W4PolicySeamStatus[]> = {
        proposed: ["under_review", "rejected"],
        under_review: ["approved", "rejected"],
        approved: ["closed"],
        rejected: ["closed"],
        closed: []
      };
      if (!allowed[seam.status].includes(target)) {
        throw new W4EnterpriseStateError("W4_INVALID_POLICY_SEAM_TRANSITION");
      }
      seam.status = target;
      await repository.commit(current);
      return clone(seam);
    },

    async createNextRoundOpening(context: W4RoundContext): Promise<{
      state_ref: W4StateRef;
      source_closing_state_ref: W4StateRef;
    }> {
      if (!context.opening_state_ref) throw new W4EnterpriseStateError("W4_OPENING_STATE_REQUIRED");
      const current = repository.snapshot();
      const source = current.states.find(
        (state) =>
          context.opening_state_ref !== null &&
          stateMatchesExactRef(state, context.opening_state_ref) &&
          scopeMatches(context, state)
      );
      if (!source) throw new W4EnterpriseStateError("W4_STATE_REF_CONFLICT");
      if (context.round_no !== source.round_no + 1) {
        throw new W4EnterpriseStateError("W4_ROUND_SCOPE_CONFLICT");
      }
      return {
        state_ref: clone(context.opening_state_ref),
        source_closing_state_ref: clone(context.opening_state_ref)
      };
    },

    async settleRound(
      scope: W4ScopeContext,
      input: W4SettlementInput
    ): Promise<W4SettlementResult> {
      const before = repository.snapshot();
      const opening = before.states.find(
        (state) =>
          stateMatchesExactRef(state, input.opening_state_ref) && scopeMatches(scope, state)
      );
      if (!opening) throw new W4EnterpriseStateError("W4_STATE_REF_CONFLICT");
      assertOpeningStateLineage(before, scope, opening, input.opening_state_ref);
      assertReplayInputManifest(scope, input.opening_state_ref, input.replay_input_manifest);
      const selectedDecisionPayloadBindings = assertDecisionPayloadBindings(
        scope,
        input.replay_input_manifest,
        before.decisions
      );
      if (
        input.decision_id &&
        !selectedDecisionPayloadBindings.some((item) => item.decision_id === input.decision_id)
      ) {
        throw new W4EnterpriseStateError("W4_REPLAY_DECISION_BINDING_CONFLICT");
      }
      const priorOutcome = before.outcomes.find(
        (outcome) =>
          outcome.tenant_id === scope.tenant_id &&
          outcome.course_id === scope.course_id &&
          outcome.run_id === scope.run_id &&
          outcome.team_id === scope.team_id &&
          outcome.round_id === scope.round_id
      );
      if (priorOutcome)
        return {
          outcome_id: priorOutcome.official_outcome_id,
          closing_state_ref: clone(priorOutcome.closing_state_ref),
          persistent_effect_ids: [...priorOutcome.persistent_effect_ids],
          reexecuted_decision_ids: []
        };

      const activeCommitments = before.commitments.filter(
        (commitment) =>
          commitment.tenant_id === scope.tenant_id &&
          commitment.course_id === scope.course_id &&
          commitment.run_id === scope.run_id &&
          commitment.team_id === scope.team_id &&
          commitment.status === "active"
      );
      const persistentEffects = before.effects.filter(
        (effect) =>
          effect.tenant_id === scope.tenant_id &&
          effect.course_id === scope.course_id &&
          effect.run_id === scope.run_id &&
          effect.team_id === scope.team_id &&
          effect.status !== "expired"
      );
      const projectPortfolioSnapshot = before.projectPortfolio
        .filter((entry) => scopeMatches(scope, entry))
        .sort((left, right) => left.project_entry_id.localeCompare(right.project_entry_id));
      const projectPortfolioDigest = digest(projectPortfolioSnapshot);
      const projectInitiativeSnapshot = before.initiatives
        .filter((initiative) => scopeMatches(scope, initiative))
        .sort((left, right) => left.initiative_id.localeCompare(right.initiative_id));
      const capitalActionSnapshot = before.capitalActions
        .filter((action) => scopeMatches(scope, action))
        .sort((left, right) => left.capital_action_id.localeCompare(right.capital_action_id));
      const capitalActionDigest = digest(capitalActionSnapshot);
      const stateTransition = settleEnterpriseState({
        opening: opening.state,
        roundNo: scope.round_no,
        commitments: activeCommitments,
        effects: persistentEffects,
        initiatives: before.initiatives.filter((initiative) => scopeMatches(scope, initiative)),
        project_portfolio: before.projectPortfolio.filter((entry) => scopeMatches(scope, entry)),
        capital_actions: capitalActionSnapshot
      });
      const sourceData = stateTransition.closing;
      const closing: W4EnterpriseState = {
        enterprise_state_id: `state_${scope.run_id}_${scope.team_id}_${scope.round_no}`,
        tenant_id: scope.tenant_id,
        course_id: scope.course_id,
        run_id: scope.run_id,
        team_id: scope.team_id,
        round_id: scope.round_id,
        round_no: scope.round_no,
        version: opening.version + 1,
        parent_state_ref: clone(input.opening_state_ref),
        state_digest: digest(sourceData),
        state: sourceData
      };
      const closingRef = stateRef(closing, clone(input.opening_state_ref));
      const consumedDecisionIds = activeCommitments.map((commitment) => commitment.decision_id);
      const consumedDecisionPayloadBindings = consumedDecisionIds.map((decisionId) => {
        const decision = before.decisions.find((item) => item.decision_id === decisionId);
        if (!decision) throw new W4EnterpriseStateError("W4_REPLAY_DECISION_BINDING_CONFLICT");
        return {
          decision_id: decisionId,
          decision_payload_digest: decision.admission.decision_payload_digest
        };
      });
      const replayInputManifest: W4ReplayInputManifest = {
        ...input.replay_input_manifest,
        decision_ids: consumedDecisionIds,
        decision_payload_bindings: consumedDecisionPayloadBindings,
        project_portfolio_digest: projectPortfolioDigest,
        project_portfolio_entry_ids: projectPortfolioSnapshot.map(
          (entry) => entry.project_entry_id
        ),
        project_portfolio_snapshot: clone(projectPortfolioSnapshot),
        project_initiative_snapshot: clone(projectInitiativeSnapshot),
        capital_action_digest: capitalActionDigest,
        capital_action_ids: capitalActionSnapshot.map((action) => action.capital_action_id),
        capital_action_snapshot: clone(capitalActionSnapshot)
      };
      const outcome: W4OfficialOutcome = {
        official_outcome_id: `outcome_${scope.run_id}_${scope.team_id}_${scope.round_no}`,
        tenant_id: scope.tenant_id,
        course_id: scope.course_id,
        run_id: scope.run_id,
        team_id: scope.team_id,
        round_id: scope.round_id,
        round_no: scope.round_no,
        opening_state_ref: clone(input.opening_state_ref),
        closing_state_ref: closingRef,
        commitment_ids: activeCommitments.map((commitment) => commitment.commitment_id),
        persistent_effect_ids: stateTransition.persistent_effect_ids,
        reexecuted_decision_ids: [],
        replay_input_manifest: replayInputManifest,
        settlement_digest: digest({
          opening: input.opening_state_ref,
          closing: closing.state_digest,
          project_portfolio_digest: projectPortfolioDigest,
          capital_action_digest: capitalActionDigest
        }),
        status: "official"
      };
      const next = clone(before);
      for (const initiative of next.initiatives) {
        if (
          !scopeMatches(scope, initiative) ||
          initiative.status === "completed" ||
          initiative.status === "failed" ||
          initiative.status === "cancelled"
        )
          continue;
        const remaining = Math.max(0, initiative.activation_round_no - scope.round_no);
        initiative.remaining_lead_time_rounds = remaining;
        if (remaining === 0 && initiative.status === "in_progress") {
          initiative.status = "active";
          initiative.current_milestone = "activated";
        }
      }
      for (const effect of next.effects) {
        if (
          scopeMatches(scope, effect) &&
          effect.status === "pending" &&
          effect.effective_round_no <= scope.round_no
        ) {
          effect.status = "active";
        }
      }
      for (const action of next.capitalActions) {
        if (!scopeMatches(scope, action)) continue;
        if (stateTransition.blocked_capital_action_ids.includes(action.capital_action_id)) {
          action.status = "blocked";
          action.blocked_reason = "W4_CAPITAL_COVENANT_CONFLICT";
          continue;
        }
        if (scope.round_no >= action.maturity_round_no && action.status !== "blocked") {
          action.status = "completed";
        } else if (
          stateTransition.applied_capital_action_ids.includes(action.capital_action_id) &&
          action.status === "pending"
        ) {
          action.status = "active";
        }
      }
      next.states.push(closing);
      next.outcomes.push(outcome);
      try {
        await repository.commit(next);
      } catch (error) {
        repository.replace(before);
        if (error instanceof W4EnterpriseStateError) throw error;
        throw new W4EnterpriseStateError("W4_ATOMIC_COMMIT_FAILED");
      }
      return {
        outcome_id: outcome.official_outcome_id,
        closing_state_ref: clone(closingRef),
        persistent_effect_ids: [...outcome.persistent_effect_ids],
        reexecuted_decision_ids: []
      };
    },

    async shadowReplay(
      scope: W4ScopeContext,
      outcomeId: string
    ): Promise<{ applied: false; evidence: W4ReplayEvidence }> {
      const current = repository.snapshot();
      const outcome = current.outcomes.find(
        (item) =>
          item.official_outcome_id === outcomeId &&
          scopeMatches(scope, item) &&
          item.round_id === scope.round_id &&
          item.round_no === scope.round_no
      );
      if (!outcome) throw new W4EnterpriseStateError("W4_OUTCOME_NOT_FOUND");
      const evidence: W4ReplayEvidence = {
        replay_id: `shadow_${outcome.official_outcome_id}`,
        tenant_id: outcome.tenant_id,
        course_id: outcome.course_id,
        run_id: outcome.run_id,
        team_id: outcome.team_id,
        round_id: outcome.round_id,
        source_outcome_id: outcome.official_outcome_id,
        opening_state_ref: clone(outcome.opening_state_ref),
        closing_state_ref: clone(outcome.closing_state_ref),
        decision_ids: [...outcome.replay_input_manifest.decision_ids],
        decision_payload_bindings: clone(outcome.replay_input_manifest.decision_payload_bindings),
        persistent_effect_ids: [...outcome.persistent_effect_ids],
        path_digest: digest(outcome),
        ...(outcome.replay_input_manifest.project_portfolio_digest
          ? { project_portfolio_digest: outcome.replay_input_manifest.project_portfolio_digest }
          : {}),
        ...(outcome.replay_input_manifest.capital_action_digest
          ? { capital_action_digest: outcome.replay_input_manifest.capital_action_digest }
          : {}),
        replay_writes_formal_results: false
      };
      return { applied: false, evidence };
    },

    async replay(scope: W4ScopeContext, outcomeId: string): Promise<W4ReplayEvidence> {
      const current = repository.snapshot();
      const outcome = current.outcomes.find(
        (item) =>
          item.official_outcome_id === outcomeId &&
          scopeMatches(scope, item) &&
          item.round_id === scope.round_id &&
          item.round_no === scope.round_no
      );
      if (!outcome) throw new W4EnterpriseStateError("W4_OUTCOME_NOT_FOUND");
      const evidence: W4ReplayEvidence = {
        replay_id: `replay_${outcome.official_outcome_id}`,
        tenant_id: outcome.tenant_id,
        course_id: outcome.course_id,
        run_id: outcome.run_id,
        team_id: outcome.team_id,
        round_id: outcome.round_id,
        source_outcome_id: outcome.official_outcome_id,
        opening_state_ref: clone(outcome.opening_state_ref),
        closing_state_ref: clone(outcome.closing_state_ref),
        decision_ids: [...outcome.replay_input_manifest.decision_ids],
        decision_payload_bindings: clone(outcome.replay_input_manifest.decision_payload_bindings),
        persistent_effect_ids: [...outcome.persistent_effect_ids],
        path_digest: digest({
          opening_state_ref: outcome.opening_state_ref,
          closing_state_ref: outcome.closing_state_ref,
          commitment_ids: outcome.commitment_ids,
          effect_ids: outcome.persistent_effect_ids,
          decision_payload_bindings: outcome.replay_input_manifest.decision_payload_bindings,
          project_portfolio_snapshot: outcome.replay_input_manifest.project_portfolio_snapshot,
          project_initiative_snapshot:
            outcome.replay_input_manifest.project_initiative_snapshot,
          capital_action_snapshot: outcome.replay_input_manifest.capital_action_snapshot
        }),
        ...(outcome.replay_input_manifest.project_portfolio_digest
          ? { project_portfolio_digest: outcome.replay_input_manifest.project_portfolio_digest }
          : {}),
        ...(outcome.replay_input_manifest.capital_action_digest
          ? { capital_action_digest: outcome.replay_input_manifest.capital_action_digest }
          : {}),
        replay_writes_formal_results: false
      };
      if (!current.replayEvidence.some((item) => item.replay_id === evidence.replay_id)) {
        current.replayEvidence.push(evidence);
        await repository.commit(current);
      }
      return clone(evidence);
    },

    async getMatchedArena(
      scope: W4ScopeContext,
      projectProfileReference: W4ProjectPortfolioEntry["project_profile_reference"],
      requestedTeamIds: string[] = []
    ): Promise<W4MatchedProjectArena> {
      assertProjectProfileReference(scope, projectProfileReference);
      const current = repository.snapshot();
      const matchingEntries = current.projectPortfolio.filter(
        (entry) =>
          runScopeMatches(scope, entry) &&
          projectProfileReferencesEqual(entry.project_profile_reference, projectProfileReference)
      );
      const availableTeamIds = [...new Set(matchingEntries.map((entry) => entry.team_id))].sort();
      if (requestedTeamIds.some((teamId) => !availableTeamIds.includes(teamId))) {
        throw new W4EnterpriseStateError("W4_MATCHED_ARENA_TEAM_CONFLICT");
      }
      const teamIds = (requestedTeamIds.length ? requestedTeamIds : availableTeamIds)
        .filter((teamId, index, values) => teamId.trim() && values.indexOf(teamId) === index)
        .sort();
      const teams: W4MatchedArenaTeamPath[] = teamIds.map((teamId) => {
        const entries = matchingEntries
          .filter((entry) => entry.team_id === teamId)
          .sort((left, right) => left.project_entry_id.localeCompare(right.project_entry_id));
        const states = current.states
          .filter((state) => runScopeMatches(scope, state) && state.team_id === teamId)
          .sort((left, right) => left.round_no - right.round_no);
        const outcomes = current.outcomes
          .filter((outcome) => runScopeMatches(scope, outcome) && outcome.team_id === teamId)
          .sort((left, right) => left.round_no - right.round_no);
        const refs = states.map((state) =>
          stateRef(
            state,
            state.parent_state_ref === null ? undefined : state.parent_state_ref
          )
        );
        const pathDigest = digest({
          state_history: states.map((state) => ({
            round_no: state.round_no,
            state_digest: state.state_digest,
            parent_state_digest: state.parent_state_ref?.state_digest ?? null
          })),
          settlement_digests: outcomes.map((outcome) => outcome.settlement_digest)
        });
        return {
          team_id: teamId,
          project_portfolio_entry_ids: entries.map((entry) => entry.project_entry_id),
          state_refs: refs,
          opening_state_ref: refs[0] ?? null,
          closing_state_ref: refs.at(-1) ?? null,
          path_digest: pathDigest,
          path_evidence: null
        };
      });
      const uniquePathDigests = new Set(teams.map((team) => team.path_digest));
      const arenaId = `matched_arena_${digest({
        project_profile_reference: projectProfileReference,
        team_ids: teams.map((team) => team.team_id)
      }).slice(0, 24)}`;
      return {
        arena_id: arenaId,
        project_profile_reference: clone(projectProfileReference),
        team_ids: teams.map((team) => team.team_id),
        teams,
        state_isolation_proven: true,
        different_history_observed: teams.length > 1 && uniquePathDigests.size > 1,
        known_limits: [
          "Matched Arena compares only teams that carry the exact ProjectProfileRef.",
          "Path digests prove stored lineage differences; they do not infer causal attribution."
        ]
      };
    },

    async counterfactual(
      scope: W4ScopeContext,
      input: W4CounterfactualInput,
      surface: "student" | "teacher" = "teacher"
    ): Promise<W4CounterfactualEvidence> {
      const current = repository.snapshot();
      const sourceState = current.states.find(
        (state) =>
          scopeMatches(scope, state) && stateMatchesExactRef(state, input.source_state_ref)
      );
      if (!sourceState) throw new W4EnterpriseStateError("W4_STATE_REF_CONFLICT");
      const sourceOutcome = current.outcomes.find(
        (outcome) =>
          scopeMatches(scope, outcome) && outcome.official_outcome_id === input.source_outcome_id
      );
      if (!sourceOutcome) throw new W4EnterpriseStateError("W4_OUTCOME_NOT_FOUND");
      if (!stateMatchesExactRef(sourceState, sourceOutcome.closing_state_ref)) {
        throw new W4EnterpriseStateError("W4_COUNTERFACTUAL_SOURCE_LINEAGE_CONFLICT");
      }
      const sourceManifest = sourceOutcome.replay_input_manifest;
      if (
        sourceManifest.scenario_package_id !== input.scenario_package_id ||
        sourceManifest.parameter_set_id !== input.parameter_set_id ||
        sourceManifest.engine_id !== input.engine_id ||
        sourceManifest.seed !== input.seed ||
        JSON.stringify(sourceManifest.plugin_ids) !== JSON.stringify(input.plugin_ids)
      ) {
        throw new W4EnterpriseStateError("W4_COUNTERFACTUAL_RUNTIME_BINDING_CONFLICT");
      }
      if (
        !Number.isInteger(input.horizon_rounds) ||
        input.horizon_rounds < 1 ||
        input.horizon_rounds > 8
      ) {
        throw new W4EnterpriseStateError("W4_COUNTERFACTUAL_HORIZON_INVALID");
      }
      const decisionIds = [...new Set(input.decision_ids)];
      if (!decisionIds.length || decisionIds.some((decisionId) => !decisionId.trim())) {
        throw new W4EnterpriseStateError("W4_COUNTERFACTUAL_DECISIONS_REQUIRED");
      }
      const selectedDecisions = decisionIds.map((decisionId) => {
        const decision = current.decisions.find(
          (item) => item.decision_id === decisionId && scopeMatches(scope, item)
        );
        if (!decision || decision.round_no <= sourceState.round_no) {
          throw new W4EnterpriseStateError("W4_COUNTERFACTUAL_DECISION_SCOPE_CONFLICT");
        }
        if (decision.round_no > sourceState.round_no + input.horizon_rounds) {
          throw new W4EnterpriseStateError("W4_COUNTERFACTUAL_DECISION_HORIZON_CONFLICT");
        }
        return decision;
      });
      const selectedDecisionIds = selectedDecisions.map((decision) => decision.decision_id);
      const selectedCommitments = current.commitments.filter(
        (commitment) =>
          scopeMatches(scope, commitment) && selectedDecisionIds.includes(commitment.decision_id)
      );
      if (selectedCommitments.length !== selectedDecisionIds.length) {
        throw new W4EnterpriseStateError("W4_COUNTERFACTUAL_COMMITMENT_MISSING");
      }
      const selectedCommitmentIds = new Set(
        selectedCommitments.map((commitment) => commitment.commitment_id)
      );
      const selectedEffects = current.effects.filter(
        (effect) => scopeMatches(scope, effect) && selectedCommitmentIds.has(effect.commitment_id)
      );
      const selectedInitiativeIds = new Set(
        current.initiatives
          .filter(
            (initiative) =>
              scopeMatches(scope, initiative) &&
              selectedCommitmentIds.has(initiative.commitment_id)
          )
          .map((initiative) => initiative.initiative_id)
      );
      const selectedInitiatives = current.initiatives.filter((initiative) =>
        selectedInitiativeIds.has(initiative.initiative_id)
      );
      const selectedPortfolio = current.projectPortfolio.filter(
        (entry) => scopeMatches(scope, entry) && selectedInitiativeIds.has(entry.initiative_id)
      );
      const sourceCapitalActionSnapshot = new Map(
        (sourceManifest.capital_action_snapshot ?? []).map((action) => [
          action.capital_action_id,
          action
        ])
      );
      const selectedCapitalActions = current.capitalActions
        .filter(
          (action) => scopeMatches(scope, action) && selectedDecisionIds.includes(action.decision_id)
        )
        .map((action) => {
          const sourceSnapshot = sourceCapitalActionSnapshot.get(action.capital_action_id);
          return sourceSnapshot
            ? clone(sourceSnapshot)
            : counterfactualCapitalActionSnapshot(action, sourceState.round_no);
        });
      const rounds: W4CounterfactualRoundEvidence[] = [];
      let openingStateData = clone(sourceState.state);
      let openingRef = clone(input.source_state_ref);
      for (let offset = 1; offset <= input.horizon_rounds; offset += 1) {
        const roundNo = sourceState.round_no + offset;
        const transition = settleEnterpriseState({
          opening: openingStateData,
          roundNo,
          commitments: selectedCommitments.filter(
            (commitment) => commitment.created_round_no <= roundNo
          ),
          effects: selectedEffects.filter((effect) => effect.effective_round_no <= roundNo),
          initiatives: selectedInitiatives,
          project_portfolio: selectedPortfolio,
          capital_actions: selectedCapitalActions
        });
        const closingState = transition.closing;
        const closingRef: W4StateRef = {
          tenant_id: scope.tenant_id,
          course_id: scope.course_id,
          run_id: scope.run_id,
          team_id: scope.team_id,
          round_id: `counterfactual_${input.source_outcome_id}_${roundNo}`,
          enterprise_state_id: `counterfactual_state_${input.source_outcome_id}_${roundNo}`,
          version: sourceState.version + offset,
          state_digest: digest(closingState),
          parent_state_ref: clone(openingRef)
        };
        rounds.push({
          round_no: roundNo,
          opening_state_ref: clone(openingRef),
          closing_state_ref: clone(closingRef),
          opening_state: clone(openingStateData),
          closing_state: clone(closingState),
          opening_digest: openingRef.state_digest,
          closing_digest: closingRef.state_digest,
          changed_paths: changedPaths(openingStateData, closingState)
        });
        openingStateData = closingState;
        openingRef = closingRef;
      }
      const evidence: W4CounterfactualEvidence = {
        surface,
        counterfactual_id: `counterfactual_${digest({
          source_state_ref: input.source_state_ref,
          source_outcome_id: input.source_outcome_id,
          decision_ids: selectedDecisionIds,
          horizon_rounds: input.horizon_rounds,
          scenario_package_id: input.scenario_package_id,
          parameter_set_id: input.parameter_set_id,
          engine_id: input.engine_id,
          plugin_ids: input.plugin_ids,
          seed: input.seed
        }).slice(0, 24)}`,
        source_outcome_id: input.source_outcome_id,
        source_state_ref: clone(input.source_state_ref),
        decision_ids: selectedDecisionIds,
        decision_payload_bindings: selectedDecisions.map((decision) => ({
          decision_id: decision.decision_id,
          decision_payload_digest: decision.admission.decision_payload_digest
        })),
        scenario_package_id: input.scenario_package_id,
        parameter_set_id: input.parameter_set_id,
        engine_id: input.engine_id,
        plugin_ids: [...input.plugin_ids],
        seed: input.seed,
        horizon_rounds: input.horizon_rounds,
        capital_actions: clone(selectedCapitalActions),
        rounds,
        official_decision_writes: false,
        official_settlement_writes: false,
        official_state_writes: false,
        apply_to_next_round: false,
        replay_writes_formal_results: false,
        known_limits: [
          "Counterfactual rounds are deterministic evidence only and are never persisted as W4 state.",
          "Runtime identity is accepted only when it exactly matches the source Official Outcome manifest.",
          "No score, rank, or publication projection is calculated by this evidence path."
        ]
      };
      return evidence;
    },

    async getProjection(scope: W4ScopeContext, options: { allowEmptyRound?: boolean } = {}) {
      const current = repository.snapshot();
      const scopedStates = current.states.filter((state) => scopeMatches(scope, state));
      const scopedOutcomes = current.outcomes.filter((outcome) => scopeMatches(scope, outcome));
      const highestRound = Math.max(
        ...scopedStates.map((state) => state.round_no),
        ...scopedOutcomes.map((outcome) => outcome.round_no),
        0
      );
      const isKnownOrNextRound =
        scope.round_no >= 1 &&
        (scope.round_no <= highestRound + 1 || (highestRound === 0 && scope.round_no === 1));
      if (!isKnownOrNextRound && !(options.allowEmptyRound && scope.round_no >= 1)) {
        throw new W4EnterpriseStateError("W4_ROUND_SCOPE_CONFLICT");
      }
      const outcomes = current.outcomes.filter((item) => scopeMatches(scope, item));
      const currentOutcome = outcomes.find((item) => item.round_id === scope.round_id);
      const latestOutcome = outcomes
        .filter((item) => item.round_no <= scope.round_no)
        .slice()
        .sort((left, right) => right.round_no - left.round_no)[0];
      const latestState = current.states
        .filter(
          (state) =>
            state.tenant_id === scope.tenant_id &&
            state.course_id === scope.course_id &&
            state.run_id === scope.run_id &&
            state.team_id === scope.team_id &&
            state.round_no <= scope.round_no
        )
        .slice()
        .sort((left, right) => right.round_no - left.round_no)[0];
      const initiativeSource =
        currentOutcome?.replay_input_manifest.project_initiative_snapshot ?? current.initiatives;
      const scopedInitiatives = initiativeSource.filter(
        (item) =>
          scopeMatches(scope, item) &&
          (item.created_round_no === undefined || item.created_round_no <= scope.round_no)
      );
      const portfolioSource =
        currentOutcome?.replay_input_manifest.project_portfolio_snapshot ?? current.projectPortfolio;
      const scopedProjectPortfolio = portfolioSource.filter((item) =>
        scopeMatches(scope, item) && item.created_round_no <= scope.round_no
      );
      const scopedProjectTransactions = current.projectTransactions.filter((item) =>
        scopeMatches(scope, item) && item.created_round_no <= scope.round_no
      );
      const capitalActionSource =
        currentOutcome?.replay_input_manifest.capital_action_snapshot ?? current.capitalActions;
      const scopedCapitalActions = capitalActionSource.filter((item) =>
        scopeMatches(scope, item) && item.created_round_no <= scope.round_no
      );
      const latestStrategicDecision = current.decisions
        .filter((item) => scopeMatches(scope, item) && item.round_no <= scope.round_no)
        .sort(
          (left, right) =>
            left.round_no - right.round_no || left.decision_id.localeCompare(right.decision_id)
        )
        .at(-1);
      const scopedCommitments = current.commitments
        .filter((item) => scopeMatches(scope, item) && item.created_round_no <= scope.round_no)
        .map(({ commitment_id, kind, status, cost }) => ({ commitment_id, kind, status, cost }));
      const scopedEffects = current.effects
        .filter((item) => scopeMatches(scope, item) && item.effective_round_no <= scope.round_no)
        .map(({ effect_id, status, effective_round_no }) => ({
          effect_id,
          status,
          effective_round_no
        }));
      const currentOpeningState = currentOutcome
        ? current.states.find((state) =>
            stateMatchesExactRef(state, currentOutcome.opening_state_ref)
          )
        : undefined;
      const currentClosingState = currentOutcome
        ? current.states.find((state) =>
            stateMatchesExactRef(state, currentOutcome.closing_state_ref)
          )
        : undefined;
      const scopedEvidence = current.replayEvidence.filter((item) => scopeMatches(scope, item));
      const currentDecisionIds = currentOutcome?.replay_input_manifest.decision_ids ?? [];
      const currentIntentDigest = decisionIntentDigest(current.decisions, currentDecisionIds);
      const canCompareAcrossTeams =
        scope.role_key === "teacher" ||
        scope.role_key === "admin" ||
        scope.role_key === "tenant_admin" ||
        scope.role_key === "platform_admin";
      const alternativeHistoryCount =
        canCompareAcrossTeams && currentIntentDigest
          ? current.outcomes.filter((outcome) => {
              if (
                outcome === currentOutcome ||
                outcome.tenant_id !== scope.tenant_id ||
                outcome.course_id !== scope.course_id ||
                outcome.run_id !== scope.run_id ||
                outcome.opening_state_ref.state_digest ===
                  currentOutcome?.opening_state_ref.state_digest
              ) {
                return false;
              }
              return (
                decisionIntentDigest(
                  current.decisions,
                  outcome.replay_input_manifest.decision_ids
                ) === currentIntentDigest
              );
            }).length
          : 0;
      const openingVsClosing =
        currentOutcome && currentOpeningState && currentClosingState
          ? {
              opening_state_ref: clone(currentOutcome.opening_state_ref),
              closing_state_ref: clone(currentOutcome.closing_state_ref),
              parent_state_ref: clone(currentClosingState.parent_state_ref),
              opening_digest: currentOpeningState.state_digest,
              closing_digest: currentClosingState.state_digest,
              changed_paths: changedPaths(currentOpeningState.state, currentClosingState.state)
            }
          : null;
      const officialOutcome = currentOutcome ?? latestOutcome;
      const pathEvidence = {
        opening_vs_closing: openingVsClosing,
        initiative_timeline: scopedInitiatives.map((initiative) => ({
          initiative_id: initiative.initiative_id,
          status: initiative.status,
          current_milestone: initiative.current_milestone,
          milestones: [...initiative.milestones],
          remaining_lead_time_rounds: initiative.remaining_lead_time_rounds,
          activation_round_no: initiative.activation_round_no
        })),
        persistent_effect_ids: scopedEffects
          .filter((effect) => effect.status !== "expired")
          .map((effect) => effect.effect_id),
        portfolio_hierarchy: {
          group_tenant_id: scope.tenant_id,
          portfolio_projects: [...(latestState?.state.portfolio.projects ?? [])],
          portfolio_facilities: [...(latestState?.state.portfolio.facilities ?? [])],
          operating_unit_ids: (latestState?.state.operating_units ?? []).map(
            (unit) => unit.operating_unit_id
          )
        },
        official_replay_path: {
          official_outcome_id: officialOutcome?.official_outcome_id ?? null,
          replay_ids: scopedEvidence
            .filter(
              (evidence) => evidence.source_outcome_id === officialOutcome?.official_outcome_id
            )
            .map((evidence) => evidence.replay_id),
          path_digests: [
            ...(officialOutcome ? [officialOutcome.settlement_digest] : []),
            ...scopedEvidence
              .filter(
                (evidence) => evidence.source_outcome_id === officialOutcome?.official_outcome_id
              )
              .map((evidence) => evidence.path_digest)
          ],
          replay_writes_formal_results: false as const
        },
        same_current_decision_different_history: {
          status: alternativeHistoryCount > 0 ? ("proven" as const) : ("not_observed" as const),
          current_decision_ids: [...currentDecisionIds],
          comparison_count: alternativeHistoryCount
        }
      };
      const strategicPortfolioMembers: W4StrategicPortfolioMember[] = scopedProjectPortfolio.map(
        (entry) => {
          const initiative = scopedInitiatives.find(
            (candidate) => candidate.initiative_id === entry.initiative_id
          );
          return {
            project_entry_id: entry.project_entry_id,
            initiative_id: entry.initiative_id,
            project_profile_reference: clone(entry.project_profile_reference),
            project_name: entry.project_name,
            source_assignment_id: entry.source_assignment_id,
            lifecycle_status: entry.lifecycle_status,
            ownership_status: entry.ownership_status,
            ramp: initiative?.project?.ramp ?? null,
            activation_round_no: initiative?.activation_round_no ?? null,
            dependency_project_entry_ids: [...(entry.dependency_project_entry_ids ?? [])]
          };
        }
      );
      const strategicPortfolioAllocations: W4StrategicPortfolioAllocation[] =
        scopedProjectPortfolio.map((entry) => {
          const initiative = scopedInitiatives.find(
            (candidate) => candidate.initiative_id === entry.initiative_id
          );
          const projectActions = scopedCapitalActions.filter(
            (action) =>
              action.project_entry_id === entry.project_entry_id && action.status !== "blocked"
          );
          const projectCost = initiative?.project?.cost ?? 0;
          const allocatedCapitalPrincipal = projectActions.reduce(
            (sum, action) => sum + action.principal,
            0
          );
          return {
            project_entry_id: entry.project_entry_id,
            project_cost: projectCost,
            allocated_capital_principal: allocatedCapitalPrincipal,
            unfunded_project_cost: Math.max(0, projectCost - allocatedCapitalPrincipal),
            capital_action_ids: projectActions.map((action) => action.capital_action_id)
          };
        });
      const strategicPortfolio = buildW4StrategicPortfolioProjection(scope, {
        latest_state: (currentClosingState ?? latestState) ?? null,
        opening_state_ref:
          currentOutcome?.opening_state_ref ?? latestOutcome?.closing_state_ref ?? null,
        closing_state_ref: currentOutcome?.closing_state_ref ?? null,
        next_opening_state_ref:
          currentOutcome?.closing_state_ref ?? latestOutcome?.closing_state_ref ?? null,
        members: strategicPortfolioMembers,
        allocations: strategicPortfolioAllocations
      });
      return {
        scope: {
          tenant_id: scope.tenant_id,
          course_id: scope.course_id,
          run_id: scope.run_id,
          team_id: scope.team_id
        },
        opening_state_ref:
          currentOutcome?.opening_state_ref ?? latestOutcome?.closing_state_ref ?? null,
        closing_state_ref: currentOutcome?.closing_state_ref ?? null,
        state: currentOutcome
          ? currentClosingState
            ? clone(currentClosingState.state)
            : null
          : latestState
            ? clone(latestState.state)
            : null,
        initiatives: clone(scopedInitiatives),
        project_portfolio: clone(scopedProjectPortfolio),
        project_transactions: clone(scopedProjectTransactions),
        capital_actions: clone(scopedCapitalActions),
        strategic_portfolio: strategicPortfolio,
        commitments: clone(scopedCommitments),
        effects: clone(scopedEffects),
        latest_strategic_action: latestStrategicDecision
          ? strategicActionProjection(latestStrategicDecision)
          : null,
        evidence: clone(scopedEvidence),
        path_evidence: clone(pathEvidence)
      };
    }
  };
}
