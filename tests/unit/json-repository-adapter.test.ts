import { describe, expect, it, vi } from "vitest";
import type {
  Decision,
  DecisionPayload,
  ReplayDiffReport,
  ReplayInputManifest,
  ReplayReport,
  ReplayRun,
  SettlementResult
} from "@simwar/shared-contracts";
import { createJsonRepositoryPorts } from "../../services/api/src/json-repository-adapter.js";
import type { SimWarStore } from "../../services/api/src/store.js";

const BASE_DECISION_PAYLOAD = {
  pricing: { base_price: 12000 },
  marketing_budget: 250000,
  service_quality_budget: 150000,
  capacity_plan: "expand",
  cash_buffer_target: 0.2,
  strategy_statement: "premium growth plan"
} as const satisfies DecisionPayload;

function createMinimalStore(overrides: Partial<SimWarStore> = {}): SimWarStore {
  return {
    tenants: [],
    users: [],
    sessions: [],
    courses: [],
    teams: [],
    runs: [],
    rounds: [],
    decisions: [],
    settlementResults: [],
    auditLogs: [],
    persist: vi.fn(),
    ...overrides
  } as unknown as SimWarStore;
}

function createDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    tenant_id: "tenant-1",
    decision_id: "decision-1",
    run_id: "run-1",
    round_id: "round-1",
    round_no: 1,
    team_id: "team-1",
    version: 1,
    status: "submitted",
    payload: BASE_DECISION_PAYLOAD,
    validation_report: [],
    submitted_by: "user-1",
    ...overrides
  };
}

type JsonSettlementResult = SettlementResult & {
  metadata?: Record<string, unknown>;
};

function createSettlementResult(
  overrides: Partial<JsonSettlementResult> = {}
): JsonSettlementResult {
  return {
    tenant_id: "tenant-1",
    settlement_result_id: "settlement-1",
    run_id: "run-1",
    round_id: "round-1",
    round_no: 1,
    parameter_set_id: "parameter-set-1",
    scenario_package_id: "scenario-package-1",
    replay_hash: "replay-hash-1",
    team_results: [
      {
        team_id: "team-1",
        state_true: {
          demand: 100,
          served_demand: 95,
          revenue: 1200000,
          cost: 850000,
          profit: 350000,
          cash_flow: 280000,
          score: 88,
          rank: 1,
          settlement_status: "settled"
        },
        state_obs: {
          demand_band: "high",
          served_demand: 95,
          revenue: 1200000,
          profit_band: "healthy",
          score: 88,
          rank: 1
        },
        state_est: {
          next_round_risk: "balanced",
          explanation: "stable execution",
          recommended_focus: "maintain service quality"
        }
      }
    ],
    ...overrides
  };
}

function createReplayInputManifest(
  overrides: Partial<ReplayInputManifest> = {}
): ReplayInputManifest {
  return {
    manifest_id: "manifest-1",
    tenant_id: "tenant-1",
    run_id: "run-1",
    round_id: "round-1",
    source_result_id: "settlement-1",
    input_hash: "input-hash-1",
    manifest_hash: "manifest-hash-1",
    included_sources: ["canonical_decisions", "scenario", "parameter_set"],
    excluded_from_truth_hash: {
      ai_advice: "excluded",
      learning_evidence: "excluded",
      role_drafts: "excluded"
    },
    created_at: "2026-06-08T00:00:00.000Z",
    ...overrides
  };
}

function createReplayRun(overrides: Partial<ReplayRun> = {}): ReplayRun {
  return {
    replay_run_id: "replay-run-1",
    tenant_id: "tenant-1",
    run_id: "run-1",
    round_id: "round-1",
    replay_mode: "official_replay",
    status: "completed",
    manifest_id: "manifest-1",
    started_at: "2026-06-08T00:00:01.000Z",
    completed_at: "2026-06-08T00:00:02.000Z",
    ...overrides
  };
}

function createReplayReport(overrides: Partial<ReplayReport> = {}): ReplayReport {
  return {
    replay_report_id: "replay-report-1",
    replay_run_id: "replay-run-1",
    tenant_id: "tenant-1",
    run_id: "run-1",
    round_id: "round-1",
    status: "matched",
    source_result_id: "settlement-1",
    replay_result_hash: "replay-result-hash-1",
    matched: true,
    created_at: "2026-06-08T00:00:03.000Z",
    ...overrides
  };
}

function createReplayDiffReport(overrides: Partial<ReplayDiffReport> = {}): ReplayDiffReport {
  return {
    diff_report_id: "diff-report-1",
    replay_report_id: "replay-report-1",
    tenant_id: "tenant-1",
    run_id: "run-1",
    round_id: "round-1",
    severity: "none",
    differences: [],
    created_at: "2026-06-08T00:00:04.000Z",
    ...overrides
  };
}

describe("JSON repository adapter", () => {
  it("reads tenant, user, session, and course records from the JSON store", async () => {
    const store = createMinimalStore({
      tenants: [{ tenant_id: "tenant-1", status: "active" }],
      users: [{ tenant_id: "tenant-1", user_id: "user-1", status: "active" }],
      sessions: [
        {
          tenant_id: "tenant-1",
          session_id: "session-1",
          user_id: "user-1",
          expires_at: "2099-01-01T00:00:00.000Z"
        }
      ],
      courses: [{ tenant_id: "tenant-1", course_id: "course-1", status: "active" }]
    } as Partial<SimWarStore>);

    const ports = createJsonRepositoryPorts(store);

    await expect(ports.identity.getTenant("tenant-1")).resolves.toEqual({
      tenant_id: "tenant-1",
      status: "active"
    });

    await expect(ports.identity.getUser("tenant-1", "user-1")).resolves.toEqual({
      tenant_id: "tenant-1",
      user_id: "user-1",
      status: "active"
    });

    await expect(ports.sessions.getSession("tenant-1", "session-1")).resolves.toEqual({
      tenant_id: "tenant-1",
      session_id: "session-1",
      user_id: "user-1",
      expires_at: "2099-01-01T00:00:00.000Z"
    });

    await expect(ports.courses.getCourse("tenant-1", "course-1")).resolves.toEqual({
      tenant_id: "tenant-1",
      course_id: "course-1",
      status: "active"
    });
  });

  it("returns the first submitted canonical decision for a team round instead of the latest version", async () => {
    const firstSubmitted = createDecision({
      decision_id: "decision-first",
      version: 1,
      payload: {
        ...BASE_DECISION_PAYLOAD,
        strategy_statement: "first submitted decision"
      }
    });
    const laterSubmitted = createDecision({
      decision_id: "decision-later",
      version: 2,
      payload: {
        ...BASE_DECISION_PAYLOAD,
        strategy_statement: "later submitted decision"
      }
    });
    const store = createMinimalStore({
      decisions: [firstSubmitted, laterSubmitted]
    });
    const ports = createJsonRepositoryPorts(store);

    await expect(
      ports.decisions.getCanonicalDecisionForTeamRound("tenant-1", "run-1", "round-1", "team-1")
    ).resolves.toBe(firstSubmitted);
  });

  it("ignores non-submitted decisions when resolving canonical team-round decisions", async () => {
    const draftDecision = createDecision({
      decision_id: "decision-draft",
      status: "draft",
      version: 1
    });
    const validatedDecision = createDecision({
      decision_id: "decision-validated",
      status: "validated",
      version: 2
    });
    const rejectedDecision = createDecision({
      decision_id: "decision-rejected",
      status: "rejected",
      version: 3
    });
    const submittedDecision = createDecision({
      decision_id: "decision-submitted",
      version: 4
    });
    const store = createMinimalStore({
      decisions: [draftDecision, validatedDecision, rejectedDecision, submittedDecision]
    });
    const ports = createJsonRepositoryPorts(store);

    await expect(
      ports.decisions.getCanonicalDecisionForTeamRound("tenant-1", "run-1", "round-1", "team-1")
    ).resolves.toBe(submittedDecision);
    await expect(
      ports.decisions.getCanonicalDecisionForTeamRound("tenant-1", "run-1", "round-1", "team-2")
    ).resolves.toBeNull();
  });

  it("keeps canonical lookup dependent on store order for submitted decisions", async () => {
    const versionTwoFirst = createDecision({
      decision_id: "decision-version-two",
      version: 2
    });
    const versionOneSecond = createDecision({
      decision_id: "decision-version-one",
      version: 1
    });
    const store = createMinimalStore({
      decisions: [versionTwoFirst, versionOneSecond]
    });
    const ports = createJsonRepositoryPorts(store);

    await expect(
      ports.decisions.getCanonicalDecisionForTeamRound("tenant-1", "run-1", "round-1", "team-1")
    ).resolves.toBe(versionTwoFirst);
  });

  it("inserts a full Decision object unchanged through saveDecision", async () => {
    const store = createMinimalStore();
    const ports = createJsonRepositoryPorts(store);
    const decision = createDecision({
      decision_id: "decision-insert",
      version: 3,
      payload: {
        pricing: { base_price: 13200 },
        marketing_budget: 210000,
        service_quality_budget: 125000,
        capacity_plan: "hold",
        cash_buffer_target: 0.22,
        strategy_statement: "inserted decision should stay unchanged"
      },
      validation_report: [{ field: "payload", reason: "accepted" }],
      submitted_by: "user-operator",
      canonical_source: "legacy_direct",
      merge_commit_id: "merge-insert",
      team_confirmation_id: "confirmation-insert"
    });

    await ports.decisions.saveDecision(decision);

    expect(store.decisions).toEqual([decision]);
    expect(store.decisions[0]).toBe(decision);
    expect(store.persist).toHaveBeenCalledTimes(1);
  });

  it("preserves the full Decision object when saveDecision persists and upserts by tenant and decision id", async () => {
    const store = createMinimalStore({
      decisions: [
        createDecision({
          decision_id: "decision-1",
          payload: {
            ...BASE_DECISION_PAYLOAD,
            strategy_statement: "old decision for same tenant"
          }
        }),
        createDecision({
          tenant_id: "tenant-2",
          decision_id: "decision-1",
          payload: {
            ...BASE_DECISION_PAYLOAD,
            strategy_statement: "same decision id in another tenant"
          }
        })
      ]
    });
    const ports = createJsonRepositoryPorts(store);
    const replacement = createDecision({
      decision_id: "decision-1",
      version: 5,
      status: "submitted",
      payload: {
        pricing: { base_price: 12800 },
        marketing_budget: 275000,
        service_quality_budget: 175000,
        capacity_plan: "hold",
        cash_buffer_target: 0.3,
        strategy_statement: "replacement decision preserved exactly"
      },
      validation_report: [{ field: "payload", reason: "characterization-warning" }],
      submitted_by: "user-captain",
      canonical_source: "role_merge_commit",
      merge_commit_id: "merge-1",
      team_confirmation_id: "confirmation-1"
    });

    await ports.decisions.saveDecision(replacement);

    expect(store.decisions).toHaveLength(2);
    expect(store.decisions[0]).toBe(replacement);
    expect(store.decisions[1]?.tenant_id).toBe("tenant-2");
    expect(store.persist).toHaveBeenCalledTimes(1);
  });

  it("does not reorder unrelated decisions when saveDecision replaces an existing decision", async () => {
    const unrelatedBefore = createDecision({
      decision_id: "decision-before",
      team_id: "team-before"
    });
    const original = createDecision({
      decision_id: "decision-replace",
      team_id: "team-replace",
      version: 1
    });
    const unrelatedAfter = createDecision({
      decision_id: "decision-after",
      team_id: "team-after"
    });
    const replacement = createDecision({
      decision_id: "decision-replace",
      team_id: "team-replace",
      version: 2,
      payload: {
        ...BASE_DECISION_PAYLOAD,
        strategy_statement: "replacement stays in original slot"
      }
    });
    const store = createMinimalStore({
      decisions: [unrelatedBefore, original, unrelatedAfter]
    });
    const ports = createJsonRepositoryPorts(store);

    await ports.decisions.saveDecision(replacement);

    expect(store.decisions).toEqual([unrelatedBefore, replacement, unrelatedAfter]);
    expect(store.decisions[0]).toBe(unrelatedBefore);
    expect(store.decisions[1]).toBe(replacement);
    expect(store.decisions[2]).toBe(unrelatedAfter);
    expect(store.persist).toHaveBeenCalledTimes(1);
  });

  it("preserves the full canonical Decision object with the same tenant and decision id upsert behavior", async () => {
    const store = createMinimalStore();
    const ports = createJsonRepositoryPorts(store);
    const original = createDecision({
      decision_id: "decision-canonical",
      version: 1,
      canonical_source: "legacy_direct"
    });
    const replacement = createDecision({
      decision_id: "decision-canonical",
      version: 2,
      payload: {
        pricing: { base_price: 11000 },
        marketing_budget: 320000,
        service_quality_budget: 190000,
        capacity_plan: "expand",
        cash_buffer_target: 0.24,
        strategy_statement: "canonical replacement decision"
      },
      validation_report: [{ field: "payload.strategy_statement", reason: "accepted" }],
      submitted_by: "user-ceo",
      canonical_source: "role_merge_commit",
      merge_commit_id: "merge-canonical",
      team_confirmation_id: "confirmation-canonical"
    });

    await ports.decisions.saveCanonicalDecision(original);
    await ports.decisions.saveCanonicalDecision(replacement);

    expect(store.decisions).toHaveLength(1);
    expect(store.decisions[0]).toBe(replacement);
    expect(store.persist).toHaveBeenCalledTimes(2);

    await expect(
      ports.decisions.getCanonicalDecisionForTeamRound("tenant-1", "run-1", "round-1", "team-1")
    ).resolves.toBe(replacement);
  });

  it("keeps saveDecision and saveCanonicalDecision upsert identity scoped to tenant and decision id", async () => {
    const store = createMinimalStore();
    const ports = createJsonRepositoryPorts(store);
    const tenantOneDecision = createDecision({
      tenant_id: "tenant-1",
      decision_id: "decision-shared"
    });
    const tenantTwoDecision = createDecision({
      tenant_id: "tenant-2",
      decision_id: "decision-shared"
    });
    const tenantOneReplacement = createDecision({
      tenant_id: "tenant-1",
      decision_id: "decision-shared",
      version: 2,
      payload: {
        ...BASE_DECISION_PAYLOAD,
        strategy_statement: "tenant one saveDecision replacement"
      }
    });
    const tenantTwoReplacement = createDecision({
      tenant_id: "tenant-2",
      decision_id: "decision-shared",
      version: 2,
      payload: {
        ...BASE_DECISION_PAYLOAD,
        strategy_statement: "tenant two saveCanonicalDecision replacement"
      }
    });

    await ports.decisions.saveDecision(tenantOneDecision);
    await ports.decisions.saveDecision(tenantTwoDecision);
    await ports.decisions.saveDecision(tenantOneReplacement);
    await ports.decisions.saveCanonicalDecision(tenantTwoReplacement);

    expect(store.decisions).toHaveLength(2);
    expect(store.decisions[0]).toBe(tenantOneReplacement);
    expect(store.decisions[1]).toBe(tenantTwoReplacement);
    expect(store.persist).toHaveBeenCalledTimes(4);

    await expect(ports.decisions.getDecisionById("tenant-1", "decision-shared")).resolves.toBe(
      tenantOneReplacement
    );
    await expect(ports.decisions.getDecisionById("tenant-2", "decision-shared")).resolves.toBe(
      tenantTwoReplacement
    );
  });

  it("gets settlement results by tenant and settlement result id without crossing tenants", async () => {
    const target = createSettlementResult();
    const otherTenant = createSettlementResult({
      tenant_id: "tenant-2",
      settlement_result_id: "settlement-1",
      replay_hash: "other-tenant-replay-hash"
    });
    const store = createMinimalStore({
      settlementResults: [otherTenant, target]
    });
    const ports = createJsonRepositoryPorts(store);

    await expect(ports.settlements.getSettlementResult("tenant-1", "settlement-1")).resolves.toBe(
      target
    );
    await expect(
      ports.settlements.getSettlementResult("tenant-3", "settlement-1")
    ).resolves.toBeNull();
    await expect(
      ports.settlements.getSettlementResult("tenant-1", "settlement-missing")
    ).resolves.toBeNull();
  });

  it("lists settlement results for a tenant run round while preserving store order", async () => {
    const first = createSettlementResult({
      settlement_result_id: "settlement-first",
      replay_hash: "replay-hash-first"
    });
    const otherRound = createSettlementResult({
      settlement_result_id: "settlement-other-round",
      round_id: "round-2"
    });
    const second = createSettlementResult({
      settlement_result_id: "settlement-second",
      replay_hash: "replay-hash-second"
    });
    const otherRun = createSettlementResult({
      settlement_result_id: "settlement-other-run",
      run_id: "run-2"
    });
    const otherTenant = createSettlementResult({
      tenant_id: "tenant-2",
      settlement_result_id: "settlement-other-tenant"
    });
    const store = createMinimalStore({
      settlementResults: [first, otherRound, second, otherRun, otherTenant]
    });
    const ports = createJsonRepositoryPorts(store);

    await expect(
      ports.settlements.listSettlementResultsForRound("tenant-1", "run-1", "round-1")
    ).resolves.toEqual([first, second]);
    await expect(
      ports.settlements.listSettlementResultsForRound("tenant-1", "run-missing", "round-1")
    ).resolves.toEqual([]);
  });

  it("inserts a full SettlementResult object unchanged and persists the store", async () => {
    const settlement = createSettlementResult({
      settlement_result_id: "settlement-insert",
      replay_hash: "replay-hash-insert",
      metadata: {
        source: "json-adapter-characterization"
      }
    });
    const store = createMinimalStore();
    const ports = createJsonRepositoryPorts(store);

    await ports.settlements.saveSettlementResult(settlement);

    expect(store.settlementResults).toEqual([settlement]);
    expect(store.settlementResults[0]).toBe(settlement);
    expect(store.settlementResults[0]?.replay_hash).toBe("replay-hash-insert");
    expect(store.settlementResults[0]?.team_results).toBe(settlement.team_results);
    expect((store.settlementResults[0] as JsonSettlementResult | undefined)?.metadata).toEqual({
      source: "json-adapter-characterization"
    });
    expect(store.persist).toHaveBeenCalledTimes(1);
  });

  it("upserts settlement results by tenant and settlement result id without reordering unrelated results", async () => {
    const unrelatedBefore = createSettlementResult({
      settlement_result_id: "settlement-before",
      replay_hash: "replay-before"
    });
    const original = createSettlementResult({
      settlement_result_id: "settlement-shared",
      replay_hash: "replay-original"
    });
    const unrelatedAfter = createSettlementResult({
      settlement_result_id: "settlement-after",
      replay_hash: "replay-after"
    });
    const otherTenant = createSettlementResult({
      tenant_id: "tenant-2",
      settlement_result_id: "settlement-shared",
      replay_hash: "replay-other-tenant"
    });
    const replacement = createSettlementResult({
      settlement_result_id: "settlement-shared",
      replay_hash: "replay-replacement",
      parameter_set_id: "parameter-set-replacement",
      scenario_package_id: "scenario-package-replacement",
      team_results: []
    });
    const store = createMinimalStore({
      settlementResults: [unrelatedBefore, original, unrelatedAfter, otherTenant]
    });
    const ports = createJsonRepositoryPorts(store);

    await ports.settlements.saveSettlementResult(replacement);

    expect(store.settlementResults).toEqual([
      unrelatedBefore,
      replacement,
      unrelatedAfter,
      otherTenant
    ]);
    expect(store.settlementResults[0]).toBe(unrelatedBefore);
    expect(store.settlementResults[1]).toBe(replacement);
    expect(store.settlementResults[2]).toBe(unrelatedAfter);
    expect(store.settlementResults[3]).toBe(otherTenant);
    expect(store.persist).toHaveBeenCalledTimes(1);
  });

  it("marks a round as settled from a persisted settlement result", async () => {
    const store = createMinimalStore({
      rounds: [
        {
          tenant_id: "tenant-1",
          round_id: "round-1",
          run_id: "run-1",
          round_no: 1,
          status: "locked"
        }
      ],
      settlementResults: [
        {
          tenant_id: "tenant-1",
          settlement_result_id: "settlement-1",
          run_id: "run-1",
          round_id: "round-1",
          round_no: 1,
          replay_hash: "replay-hash-1",
          team_results: []
        }
      ]
    } as Partial<SimWarStore>);

    const ports = createJsonRepositoryPorts(store);

    await ports.rounds.markRoundSettled("tenant-1", "round-1", "settlement-1");

    expect(store.rounds[0]?.status).toBe("settled");
    expect(store.rounds[0]?.replay_hash).toBe("replay-hash-1");
    expect(store.persist).toHaveBeenCalledTimes(1);
  });

  it("appends replay input manifests and returns the first tenant-scoped matching manifest", async () => {
    const replayInputManifests: ReplayInputManifest[] = [];
    const first = createReplayInputManifest({
      input_hash: "input-hash-first",
      manifest_hash: "manifest-hash-first"
    });
    const duplicate = createReplayInputManifest({
      input_hash: "input-hash-second",
      manifest_hash: "manifest-hash-second"
    });
    const otherTenant = createReplayInputManifest({
      tenant_id: "tenant-2",
      input_hash: "input-hash-other-tenant",
      manifest_hash: "manifest-hash-other-tenant"
    });
    const fallbackManifest = {
      ...createReplayInputManifest({
        manifest_id: "manifest-canonical",
        input_hash: "input-hash-fallback",
        manifest_hash: "manifest-hash-fallback"
      }),
      replay_input_manifest_id: "manifest-legacy"
    } as ReplayInputManifest & { replay_input_manifest_id: string };
    const store = createMinimalStore();
    const ports = createJsonRepositoryPorts(store, { replayInputManifests });

    await ports.replay.saveReplayInputManifest(first);
    await ports.replay.saveReplayInputManifest(duplicate);
    await ports.replay.saveReplayInputManifest(otherTenant);
    await ports.replay.saveReplayInputManifest(fallbackManifest);

    expect(replayInputManifests).toEqual([first, duplicate, otherTenant, fallbackManifest]);
    expect(replayInputManifests[0]).toBe(first);
    expect(replayInputManifests[1]).toBe(duplicate);
    expect(replayInputManifests[2]).toBe(otherTenant);
    expect(replayInputManifests[3]).toBe(fallbackManifest);
    await expect(ports.replay.getReplayInputManifest("tenant-1", "manifest-1")).resolves.toBe(
      first
    );
    await expect(ports.replay.getReplayInputManifest("tenant-2", "manifest-1")).resolves.toBe(
      otherTenant
    );
    await expect(ports.replay.getReplayInputManifest("tenant-1", "manifest-legacy")).resolves.toBe(
      fallbackManifest
    );
    await expect(ports.replay.getReplayInputManifest("tenant-3", "manifest-1")).resolves.toBeNull();
    await expect(
      ports.replay.getReplayInputManifest("tenant-1", "manifest-missing")
    ).resolves.toBeNull();
    expect(first.input_hash).toBe("input-hash-first");
    expect(first.manifest_hash).toBe("manifest-hash-first");
    expect(store.persist).not.toHaveBeenCalled();
  });

  it("appends replay runs and returns the first tenant-scoped matching run", async () => {
    const replayRuns: ReplayRun[] = [];
    const first = createReplayRun({
      replay_run_id: "replay-run-shared",
      run_id: "run-source-1",
      status: "running"
    });
    const duplicate = createReplayRun({
      replay_run_id: "replay-run-shared",
      run_id: "run-source-2",
      status: "completed"
    });
    const otherTenant = createReplayRun({
      replay_run_id: "replay-run-shared",
      tenant_id: "tenant-2",
      run_id: "run-source-tenant-2",
      status: "failed"
    });
    const fallbackRun = createReplayRun({
      replay_run_id: "replay-run-canonical",
      run_id: "run-legacy-fallback",
      status: "pending"
    });
    const store = createMinimalStore();
    const ports = createJsonRepositoryPorts(store, { replayRuns });

    await ports.replay.saveReplayRun(first);
    await ports.replay.saveReplayRun(duplicate);
    await ports.replay.saveReplayRun(otherTenant);
    await ports.replay.saveReplayRun(fallbackRun);

    expect(replayRuns).toEqual([first, duplicate, otherTenant, fallbackRun]);
    expect(replayRuns[0]).toBe(first);
    expect(replayRuns[1]).toBe(duplicate);
    expect(replayRuns[2]).toBe(otherTenant);
    expect(replayRuns[3]).toBe(fallbackRun);
    await expect(ports.replay.getReplayRun("tenant-1", "replay-run-shared")).resolves.toBe(first);
    await expect(ports.replay.getReplayRun("tenant-2", "replay-run-shared")).resolves.toBe(
      otherTenant
    );
    await expect(ports.replay.getReplayRun("tenant-1", "run-legacy-fallback")).resolves.toBe(
      fallbackRun
    );
    await expect(ports.replay.getReplayRun("tenant-3", "replay-run-shared")).resolves.toBeNull();
    await expect(ports.replay.getReplayRun("tenant-1", "replay-run-missing")).resolves.toBeNull();
    expect(first.status).toBe("running");
    expect(duplicate.status).toBe("completed");
    expect(store.persist).not.toHaveBeenCalled();
  });

  it("appends replay reports and returns the first tenant-scoped matching report", async () => {
    const replayReports: ReplayReport[] = [];
    const first = createReplayReport({
      replay_report_id: "replay-report-shared",
      replay_result_hash: "replay-result-hash-first",
      matched: true
    });
    const duplicate = createReplayReport({
      replay_report_id: "replay-report-shared",
      replay_result_hash: "replay-result-hash-second",
      matched: false,
      status: "mismatched"
    });
    const otherTenant = createReplayReport({
      replay_report_id: "replay-report-shared",
      tenant_id: "tenant-2",
      replay_result_hash: "replay-result-hash-other-tenant"
    });
    const fallbackReport = {
      ...createReplayReport({
        replay_report_id: "replay-report-canonical",
        replay_result_hash: "replay-result-hash-fallback"
      }),
      report_id: "report-legacy"
    } as ReplayReport & { report_id: string };
    const store = createMinimalStore();
    const ports = createJsonRepositoryPorts(store, { replayReports });

    await ports.replay.saveReplayReport(first);
    await ports.replay.saveReplayReport(duplicate);
    await ports.replay.saveReplayReport(otherTenant);
    await ports.replay.saveReplayReport(fallbackReport);

    expect(replayReports).toEqual([first, duplicate, otherTenant, fallbackReport]);
    expect(replayReports[0]).toBe(first);
    expect(replayReports[1]).toBe(duplicate);
    expect(replayReports[2]).toBe(otherTenant);
    expect(replayReports[3]).toBe(fallbackReport);
    await expect(ports.replay.getReplayReport("tenant-1", "replay-report-shared")).resolves.toBe(
      first
    );
    await expect(ports.replay.getReplayReport("tenant-2", "replay-report-shared")).resolves.toBe(
      otherTenant
    );
    await expect(ports.replay.getReplayReport("tenant-1", "report-legacy")).resolves.toBe(
      fallbackReport
    );
    await expect(
      ports.replay.getReplayReport("tenant-3", "replay-report-shared")
    ).resolves.toBeNull();
    await expect(
      ports.replay.getReplayReport("tenant-1", "replay-report-missing")
    ).resolves.toBeNull();
    expect(first.replay_result_hash).toBe("replay-result-hash-first");
    expect(duplicate.replay_result_hash).toBe("replay-result-hash-second");
    expect(store.persist).not.toHaveBeenCalled();
  });

  it("appends replay diff reports and returns the first tenant-scoped matching diff report", async () => {
    const replayDiffReports: ReplayDiffReport[] = [];
    const first = createReplayDiffReport({
      diff_report_id: "diff-report-shared",
      severity: "low",
      differences: [
        {
          field: "team_results.0.score",
          expected: 88,
          actual: 87,
          message: "score drift"
        }
      ]
    });
    const duplicate = createReplayDiffReport({
      diff_report_id: "diff-report-shared",
      severity: "high",
      differences: [
        {
          field: "team_results.0.rank",
          expected: 1,
          actual: 2,
          message: "rank drift"
        }
      ]
    });
    const otherTenant = createReplayDiffReport({
      diff_report_id: "diff-report-shared",
      tenant_id: "tenant-2",
      severity: "medium"
    });
    const replayDiffIdFallback = {
      ...createReplayDiffReport({
        diff_report_id: "diff-report-canonical",
        severity: "none"
      }),
      replay_diff_report_id: "diff-report-legacy"
    } as ReplayDiffReport & { replay_diff_report_id: string };
    const reportIdFallback = {
      ...createReplayDiffReport({
        diff_report_id: "diff-report-canonical-2",
        severity: "none"
      }),
      report_id: "diff-report-alias"
    } as ReplayDiffReport & { report_id: string };
    const store = createMinimalStore();
    const ports = createJsonRepositoryPorts(store, { replayDiffReports });

    await ports.replay.saveReplayDiffReport(first);
    await ports.replay.saveReplayDiffReport(duplicate);
    await ports.replay.saveReplayDiffReport(otherTenant);
    await ports.replay.saveReplayDiffReport(replayDiffIdFallback);
    await ports.replay.saveReplayDiffReport(reportIdFallback);

    expect(replayDiffReports).toEqual([
      first,
      duplicate,
      otherTenant,
      replayDiffIdFallback,
      reportIdFallback
    ]);
    expect(replayDiffReports[0]).toBe(first);
    expect(replayDiffReports[1]).toBe(duplicate);
    expect(replayDiffReports[2]).toBe(otherTenant);
    expect(replayDiffReports[3]).toBe(replayDiffIdFallback);
    expect(replayDiffReports[4]).toBe(reportIdFallback);
    await expect(ports.replay.getReplayDiffReport("tenant-1", "diff-report-shared")).resolves.toBe(
      first
    );
    await expect(ports.replay.getReplayDiffReport("tenant-2", "diff-report-shared")).resolves.toBe(
      otherTenant
    );
    await expect(ports.replay.getReplayDiffReport("tenant-1", "diff-report-legacy")).resolves.toBe(
      replayDiffIdFallback
    );
    await expect(ports.replay.getReplayDiffReport("tenant-1", "diff-report-alias")).resolves.toBe(
      reportIdFallback
    );
    await expect(
      ports.replay.getReplayDiffReport("tenant-3", "diff-report-shared")
    ).resolves.toBeNull();
    await expect(
      ports.replay.getReplayDiffReport("tenant-1", "diff-report-missing")
    ).resolves.toBeNull();
    expect(first.severity).toBe("low");
    expect(first.differences[0]?.message).toBe("score drift");
    expect(store.persist).not.toHaveBeenCalled();
  });

  it("keeps replay saves out of settlement truth-chain state", async () => {
    const replayInputManifests: ReplayInputManifest[] = [];
    const replayRuns: ReplayRun[] = [];
    const replayReports: ReplayReport[] = [];
    const replayDiffReports: ReplayDiffReport[] = [];
    const decision = createDecision();
    const settlement = createSettlementResult();
    const round = {
      tenant_id: "tenant-1",
      round_id: "round-1",
      run_id: "run-1",
      round_no: 1,
      status: "settled",
      replay_hash: "round-replay-hash"
    };
    const store = createMinimalStore({
      decisions: [decision],
      rounds: [round],
      settlementResults: [settlement]
    } as Partial<SimWarStore>);
    const before = structuredClone({
      decisions: store.decisions,
      rounds: store.rounds,
      settlementResults: store.settlementResults
    });
    const ports = createJsonRepositoryPorts(store, {
      replayInputManifests,
      replayRuns,
      replayReports,
      replayDiffReports
    });

    await ports.replay.saveReplayInputManifest(createReplayInputManifest());
    await ports.replay.saveReplayRun(createReplayRun());
    await ports.replay.saveReplayReport(createReplayReport());
    await ports.replay.saveReplayDiffReport(createReplayDiffReport());

    expect({
      decisions: store.decisions,
      rounds: store.rounds,
      settlementResults: store.settlementResults
    }).toEqual(before);
    expect(store.rounds[0]?.replay_hash).toBe("round-replay-hash");
    expect(store.settlementResults[0]?.replay_hash).toBe(settlement.replay_hash);
    expect(store.persist).not.toHaveBeenCalled();
    expect(replayInputManifests[0]?.included_sources).not.toEqual(
      expect.arrayContaining([
        "role_drafts",
        "ai_advice",
        "learning_evidence",
        "prompt_output",
        "analytics"
      ])
    );
    expect(replayInputManifests[0]?.excluded_from_truth_hash).toMatchObject({
      ai_advice: "excluded",
      learning_evidence: "excluded",
      role_drafts: "excluded"
    });
    expect(JSON.stringify({ replayRuns, replayReports, replayDiffReports })).not.toMatch(
      /role_draft|ai_advice|learning_evidence|prompt_output|analytics/i
    );
  });

  it("keeps domain event and state snapshot collections isolated from the store", async () => {
    const store = createMinimalStore();
    const ports = createJsonRepositoryPorts(store);
    const event = {
      tenant_id: "tenant-1",
      aggregate_id: "aggregate-1",
      aggregate_type: "run",
      sequence: 1,
      event_type: "round.settled",
      payload: {}
    } as Parameters<typeof ports.domainEvents.appendDomainEvent>[0];
    const snapshot = {
      tenant_id: "tenant-1",
      aggregate_id: "aggregate-1",
      aggregate_type: "run",
      sequence: 1,
      state: { status: "settled" }
    } as Parameters<typeof ports.stateSnapshots.saveStateSnapshot>[0];

    await ports.domainEvents.appendDomainEvent(event);
    await ports.stateSnapshots.saveStateSnapshot(snapshot);

    await expect(
      ports.domainEvents.listDomainEvents({
        tenant_id: "tenant-1",
        aggregate_id: "aggregate-1",
        aggregate_type: "run"
      })
    ).resolves.toEqual([event]);

    await expect(
      ports.stateSnapshots.getStateSnapshot({
        tenant_id: "tenant-1",
        aggregate_id: "aggregate-1",
        aggregate_type: "run"
      })
    ).resolves.toBe(snapshot);

    expect(store.persist).not.toHaveBeenCalled();
  });
});
