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
  W4StoreState
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
}

export interface W4SettlementResult {
  outcome_id: string;
  closing_state_ref: W4StateRef;
  persistent_effect_ids: string[];
  reexecuted_decision_ids: string[];
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
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
    )
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
    product_lines: [],
    positioning: "",
    organization: {},
    operating_units: [],
    portfolio: { projects: [], facilities: [] }
  };
}

function validateStrategicDecision(decision: W4CanonicalStrategicDecision): void {
  if (decision.kind !== "new_project") return;
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
      const normalized: W4EnterpriseState = {
        ...clone(input),
        state_digest: digest(input.state),
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
            : 0,
        created_round_no: decision.round_no
      };
      const project =
        decision.kind === "new_project"
          ? clone(
              decision.payload as W4CanonicalStrategicDecision["payload"] & Record<string, unknown>
            )
          : null;
      const leadTime =
        decision.kind === "new_project"
          ? Number((decision.payload as { lead_time_rounds?: number }).lead_time_rounds ?? 0)
          : 0;
      const effect: W4StrategicEffect = {
        effect_id: `effect_${decision.decision_id}`,
        commitment_id: commitment.commitment_id,
        decision_payload_digest: decision.admission.decision_payload_digest,
        tenant_id: decision.tenant_id,
        course_id: decision.course_id,
        run_id: decision.run_id,
        team_id: decision.team_id,
        status: leadTime > 0 ? "pending" : "active",
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
        status: leadTime > 0 ? "in_progress" : "active",
        current_milestone: leadTime > 0 ? "construction" : "activated",
        milestones:
          leadTime > 0 ? ["approved", "construction", "activated"] : ["approved", "activated"],
        remaining_lead_time_rounds: leadTime,
        activation_round_no: decision.round_no + leadTime,
        project: project as W4StrategicInitiative["project"]
      };
      current.decisions.push(clone(decision));
      current.commitments.push(commitment);
      current.effects.push(effect);
      current.initiatives.push(initiative);
      await repository.commit(current);
      return { decision: clone(decision), commitment, effect, initiative };
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
      const stateTransition = settleEnterpriseState({
        opening: opening.state,
        roundNo: scope.round_no,
        commitments: activeCommitments,
        effects: persistentEffects,
        initiatives: before.initiatives.filter((initiative) => scopeMatches(scope, initiative))
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
        decision_payload_bindings: consumedDecisionPayloadBindings
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
          closing: closing.state_digest
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
          decision_payload_bindings: outcome.replay_input_manifest.decision_payload_bindings
        }),
        replay_writes_formal_results: false
      };
      if (!current.replayEvidence.some((item) => item.replay_id === evidence.replay_id)) {
        current.replayEvidence.push(evidence);
        await repository.commit(current);
      }
      return clone(evidence);
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
        .slice()
        .sort((left, right) => right.round_no - left.round_no)[0];
      const latestState = current.states
        .filter(
          (state) =>
            state.tenant_id === scope.tenant_id &&
            state.course_id === scope.course_id &&
            state.run_id === scope.run_id &&
            state.team_id === scope.team_id
        )
        .slice()
        .sort((left, right) => right.round_no - left.round_no)[0];
      const scopedInitiatives = current.initiatives.filter((item) => scopeMatches(scope, item));
      const scopedCommitments = current.commitments
        .filter((item) => scopeMatches(scope, item))
        .map(({ commitment_id, kind, status, cost }) => ({ commitment_id, kind, status, cost }));
      const scopedEffects = current.effects
        .filter((item) => scopeMatches(scope, item))
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
          official_outcome_id: currentOutcome?.official_outcome_id ?? null,
          replay_ids: scopedEvidence
            .filter(
              (evidence) => evidence.source_outcome_id === currentOutcome?.official_outcome_id
            )
            .map((evidence) => evidence.replay_id),
          path_digests: [
            ...(currentOutcome ? [currentOutcome.settlement_digest] : []),
            ...scopedEvidence
              .filter(
                (evidence) => evidence.source_outcome_id === currentOutcome?.official_outcome_id
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
        state: latestState ? clone(latestState.state) : null,
        initiatives: clone(scopedInitiatives),
        commitments: clone(scopedCommitments),
        effects: clone(scopedEffects),
        evidence: clone(scopedEvidence),
        path_evidence: clone(pathEvidence)
      };
    }
  };
}
