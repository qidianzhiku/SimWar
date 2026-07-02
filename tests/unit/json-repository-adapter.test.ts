import { describe, expect, it, vi } from "vitest";
import type {
  AuditLog,
  Decision,
  DecisionPayload,
  ReplayDiffReport,
  ReplayInputManifest,
  ReplayReport,
  ReplayRun,
  Round,
  SettlementResult,
  StateSnapshot
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

function createRound(overrides: Partial<Round> = {}): Round {
  return {
    tenant_id: "tenant-1",
    round_id: "round-1",
    run_id: "run-1",
    round_no: 1,
    status: "open",
    ...overrides
  };
}

type JsonSettlementResult = SettlementResult & {
  metadata?: Record<string, unknown>;
};

type JsonStateSnapshot = StateSnapshot & {
  aggregate_id: string;
  aggregate_type: string;
  sequence?: number;
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

function createStateSnapshot(overrides: Partial<JsonStateSnapshot> = {}): JsonStateSnapshot {
  return {
    snapshot_id: "snapshot-1",
    tenant_id: "tenant-1",
    run_id: "run-1",
    round_id: "round-1",
    snapshot_type: "round",
    captured_at: "2026-06-08T00:00:00.000Z",
    aggregate_id: "aggregate-1",
    aggregate_type: "run",
    sequence: 1,
    state: {
      history: [{ cash: 1000, round_no: 1 }],
      metrics: {
        cash: 1000,
        inventory: [12, 13]
      },
      status: "settled"
    },
    ...overrides
  };
}

function createAuditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    audit_id: "audit-1",
    tenant_id: "tenant-1",
    actor_id: "actor-1",
    actor_role: "tenant_admin",
    action: "auth.login",
    resource_type: "user",
    resource_id: "actor-1",
    request_id: "request-1",
    created_at: "2026-06-08T00:00:00.000Z",
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
  it("exposes the standalone atomic settlement outcome port on the repository aggregate", () => {
    const ports = createJsonRepositoryPorts(createMinimalStore());

    expect(ports.settlementOutcome).toBeDefined();
    expect(ports.settlementOutcome.commitSettlementOutcome).toEqual(expect.any(Function));
    expect(ports.settlements).not.toHaveProperty("commitSettlementOutcome");
  });

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
      courses: [
        {
          tenant_id: "tenant-1",
          course_id: "course-1",
          title: "Course 1",
          status: "active",
          scenario_package_id: "scenario-1",
          parameter_set_id: "parameter-1",
          created_by: "user-1"
        }
      ]
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
      title: "Course 1",
      status: "active",
      scenario_package_id: "scenario-1",
      parameter_set_id: "parameter-1",
      created_by: "user-1"
    });
  });

  it("lists courses by tenant without requiring user existence", async () => {
    const tenantCourse = {
      tenant_id: "tenant-1",
      course_id: "course-1",
      title: "Course 1",
      status: "published",
      scenario_package_id: "scenario-1",
      parameter_set_id: "parameter-1",
      created_by: "user-1"
    };
    const otherTenantCourse = {
      ...tenantCourse,
      tenant_id: "tenant-2",
      course_id: "course-2",
      title: "Course 2"
    };
    const store = createMinimalStore({
      courses: [tenantCourse, otherTenantCourse],
      users: []
    } as Partial<SimWarStore>);
    const ports = createJsonRepositoryPorts(store);

    await expect(ports.courses.listCoursesForTenant("tenant-1")).resolves.toEqual([
      tenantCourse
    ]);
    await expect(ports.courses.listCoursesForUser("tenant-1", "missing-user")).resolves.toEqual(
      []
    );
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

  it("JSON round saves append a previously missing round", async () => {
    const store = createMinimalStore();
    const ports = createJsonRepositoryPorts(store);
    const round = createRound({
      round_id: "round-new",
      status: "locked",
      decision_batch_id: "decision-batch-new",
      replay_hash: "replay-hash-new"
    });
    const before = structuredClone(round);

    await ports.rounds.saveRound(round);

    expect(store.rounds).toEqual([round]);
    expect(store.rounds[0]).toBe(round);
    expect(round).toEqual(before);
    expect(store.persist).toHaveBeenCalledTimes(1);
  });

  it("JSON round saves replace the same tenant round in place", async () => {
    const unrelatedBefore = createRound({
      round_id: "round-before",
      round_no: 0
    });
    const original = createRound({
      round_id: "round-shared",
      status: "open",
      decision_batch_id: "decision-batch-original",
      replay_hash: "replay-hash-original"
    });
    const unrelatedAfter = createRound({
      round_id: "round-after",
      round_no: 2
    });
    const replacement = createRound({
      round_id: "round-shared",
      status: "locked"
    });
    const store = createMinimalStore({
      rounds: [unrelatedBefore, original, unrelatedAfter]
    });
    const ports = createJsonRepositoryPorts(store);

    await ports.rounds.saveRound(replacement);

    expect(store.rounds).toEqual([unrelatedBefore, replacement, unrelatedAfter]);
    expect(store.rounds).toHaveLength(3);
    expect(store.rounds[0]).toBe(unrelatedBefore);
    expect(store.rounds[1]).toBe(replacement);
    expect(store.rounds[2]).toBe(unrelatedAfter);
    expect(store.rounds).not.toContain(original);
    expect("decision_batch_id" in store.rounds[1]!).toBe(false);
    expect("replay_hash" in store.rounds[1]!).toBe(false);
    expect(store.persist).toHaveBeenCalledTimes(1);
  });

  it("JSON round saves isolate identical round IDs by tenant", async () => {
    const store = createMinimalStore();
    const ports = createJsonRepositoryPorts(store);
    const tenantOneRound = createRound({
      tenant_id: "tenant-1",
      round_id: "round-shared",
      status: "open"
    });
    const tenantTwoRound = createRound({
      tenant_id: "tenant-2",
      round_id: "round-shared",
      status: "locked"
    });
    const tenantOneReplacement = createRound({
      tenant_id: "tenant-1",
      round_id: "round-shared",
      status: "settled",
      replay_hash: "replay-hash-tenant-one"
    });

    await ports.rounds.saveRound(tenantOneRound);
    await ports.rounds.saveRound(tenantTwoRound);
    await ports.rounds.saveRound(tenantOneReplacement);

    expect(store.rounds).toHaveLength(2);
    expect(store.rounds[0]).toBe(tenantOneReplacement);
    expect(store.rounds[1]).toBe(tenantTwoRound);
    await expect(ports.rounds.getRound("tenant-1", "round-shared")).resolves.toBe(
      tenantOneReplacement
    );
    await expect(ports.rounds.getRound("tenant-2", "round-shared")).resolves.toBe(tenantTwoRound);
    expect(store.persist).toHaveBeenCalledTimes(3);
  });

  it("JSON round saves persist after insert and replacement", async () => {
    const store = createMinimalStore();
    const ports = createJsonRepositoryPorts(store);
    const original = createRound({
      round_id: "round-persist",
      status: "open"
    });
    const replacement = createRound({
      round_id: "round-persist",
      status: "locked"
    });

    await ports.rounds.saveRound(original);
    await ports.rounds.saveRound(replacement);

    expect(store.rounds).toEqual([replacement]);
    expect(store.persist).toHaveBeenCalledTimes(2);
  });

  it("JSON markRoundSettled is a no-op when the round is missing", async () => {
    const existingRound = createRound({
      round_id: "round-existing",
      status: "open"
    });
    const settlement = createSettlementResult({
      settlement_result_id: "settlement-existing",
      replay_hash: "replay-hash-existing"
    });
    const store = createMinimalStore({
      rounds: [existingRound],
      settlementResults: [settlement]
    });
    const ports = createJsonRepositoryPorts(store);

    await expect(
      ports.rounds.markRoundSettled("tenant-1", "round-missing", "settlement-existing")
    ).resolves.toBeUndefined();

    expect(store.rounds).toEqual([existingRound]);
    expect(store.rounds[0]).toBe(existingRound);
    expect(store.persist).not.toHaveBeenCalled();
  });

  it("JSON markRoundSettled is tenant isolated", async () => {
    const tenantOneRound = createRound({
      tenant_id: "tenant-1",
      round_id: "round-shared",
      status: "locked"
    });
    const tenantTwoRound = createRound({
      tenant_id: "tenant-2",
      round_id: "round-shared",
      status: "open",
      replay_hash: "replay-hash-tenant-two"
    });
    const settlement = createSettlementResult({
      tenant_id: "tenant-1",
      settlement_result_id: "settlement-1",
      replay_hash: "replay-hash-tenant-one"
    });
    const store = createMinimalStore({
      rounds: [tenantOneRound, tenantTwoRound],
      settlementResults: [settlement]
    });
    const ports = createJsonRepositoryPorts(store);

    await ports.rounds.markRoundSettled("tenant-1", "round-shared", "settlement-1");

    expect(tenantOneRound.status).toBe("settled");
    expect(tenantOneRound.replay_hash).toBe("replay-hash-tenant-one");
    expect(tenantTwoRound.status).toBe("open");
    expect(tenantTwoRound.replay_hash).toBe("replay-hash-tenant-two");
    expect(store.persist).toHaveBeenCalledTimes(1);
  });

  it("JSON markRoundSettled resolves settlement results within the requested tenant", async () => {
    const round = createRound({
      tenant_id: "tenant-1",
      round_id: "round-shared",
      status: "open",
      decision_batch_id: "decision-batch-1",
      replay_hash: "replay-hash-before"
    });
    const wrongTenantSettlement = createSettlementResult({
      tenant_id: "tenant-2",
      settlement_result_id: "settlement-shared",
      replay_hash: "wrong-tenant-replay-hash"
    });
    const correctTenantSettlement = createSettlementResult({
      tenant_id: "tenant-1",
      settlement_result_id: "settlement-shared",
      replay_hash: "correct-tenant-replay-hash"
    });
    const store = createMinimalStore({
      rounds: [round],
      settlementResults: [wrongTenantSettlement, correctTenantSettlement]
    });
    const ports = createJsonRepositoryPorts(store);

    await ports.rounds.markRoundSettled("tenant-1", "round-shared", "settlement-shared");

    expect(store.rounds).toEqual([round]);
    expect(store.rounds[0]).toBe(round);
    expect(round.status).toBe("settled");
    expect(round.replay_hash).toBe("correct-tenant-replay-hash");
    expect(round.replay_hash).not.toBe("wrong-tenant-replay-hash");
    expect(round.decision_batch_id).toBe("decision-batch-1");
    expect(wrongTenantSettlement.replay_hash).toBe("wrong-tenant-replay-hash");
    expect(correctTenantSettlement.replay_hash).toBe("correct-tenant-replay-hash");
    expect(store.persist).toHaveBeenCalledTimes(1);
  });

  it("JSON markRoundSettled copies the matching settlement replay hash", async () => {
    const round = createRound({
      status: "locked",
      decision_batch_id: "decision-batch-1",
      replay_hash: "replay-hash-before"
    });
    const settlement = createSettlementResult({
      settlement_result_id: "settlement-1",
      replay_hash: "replay-hash-from-settlement"
    });
    const store = createMinimalStore({
      rounds: [round],
      settlementResults: [settlement]
    });
    const ports = createJsonRepositoryPorts(store);

    await ports.rounds.markRoundSettled("tenant-1", "round-1", "settlement-1");

    expect(round.status).toBe("settled");
    expect(round.replay_hash).toBe("replay-hash-from-settlement");
    expect(round.decision_batch_id).toBe("decision-batch-1");
    expect(round.tenant_id).toBe("tenant-1");
    expect(round.run_id).toBe("run-1");
    expect(round.round_no).toBe(1);
    expect(store.auditLogs).toEqual([]);
    expect(store.persist).toHaveBeenCalledTimes(1);
  });

  it("JSON markRoundSettled settles the round without changing its replay hash when the settlement result is missing", async () => {
    const round = createRound({
      status: "locked",
      decision_batch_id: "decision-batch-1",
      replay_hash: "replay-hash-before"
    });
    const store = createMinimalStore({
      rounds: [round],
      settlementResults: []
    });
    const ports = createJsonRepositoryPorts(store);

    await ports.rounds.markRoundSettled("tenant-1", "round-1", "settlement-missing");

    expect(round.status).toBe("settled");
    expect(round.replay_hash).toBe("replay-hash-before");
    expect(round.decision_batch_id).toBe("decision-batch-1");
    expect(store.persist).toHaveBeenCalledTimes(1);
  });

  it("JSON markRoundSettled remains stable for repeated calls with the same settlement result", async () => {
    const round = createRound({
      status: "locked",
      decision_batch_id: "decision-batch-1"
    });
    const settlement = createSettlementResult({
      settlement_result_id: "settlement-1",
      replay_hash: "replay-hash-repeat"
    });
    const store = createMinimalStore({
      rounds: [round],
      settlementResults: [settlement]
    });
    const ports = createJsonRepositoryPorts(store);

    await ports.rounds.markRoundSettled("tenant-1", "round-1", "settlement-1");
    await ports.rounds.markRoundSettled("tenant-1", "round-1", "settlement-1");

    expect(store.rounds).toEqual([round]);
    expect(round.status).toBe("settled");
    expect(round.replay_hash).toBe("replay-hash-repeat");
    expect(round.decision_batch_id).toBe("decision-batch-1");
    expect(store.persist).toHaveBeenCalledTimes(2);
  });

  it("JSON markRoundSettled replaces the replay hash when a different matching settlement result is applied", async () => {
    const round = createRound({
      status: "locked",
      decision_batch_id: "decision-batch-1"
    });
    const firstSettlement = createSettlementResult({
      settlement_result_id: "settlement-1",
      replay_hash: "replay-hash-first"
    });
    const secondSettlement = createSettlementResult({
      settlement_result_id: "settlement-2",
      replay_hash: "replay-hash-second"
    });
    const store = createMinimalStore({
      rounds: [round],
      settlementResults: [firstSettlement, secondSettlement]
    });
    const ports = createJsonRepositoryPorts(store);

    await ports.rounds.markRoundSettled("tenant-1", "round-1", "settlement-1");
    await ports.rounds.markRoundSettled("tenant-1", "round-1", "settlement-2");

    expect(store.rounds).toEqual([round]);
    expect(round.status).toBe("settled");
    expect(round.replay_hash).toBe("replay-hash-second");
    expect(round.decision_batch_id).toBe("decision-batch-1");
    expect(store.persist).toHaveBeenCalledTimes(2);
  });

  it("JSON markRoundSettled preserves current round reference semantics", async () => {
    const round = createRound({
      status: "locked"
    });
    const settlement = createSettlementResult({
      settlement_result_id: "settlement-1",
      replay_hash: "replay-hash-reference"
    });
    const store = createMinimalStore({
      rounds: [round],
      settlementResults: [settlement]
    });
    const ports = createJsonRepositoryPorts(store);

    await ports.rounds.markRoundSettled("tenant-1", "round-1", "settlement-1");

    expect(store.rounds[0]).toBe(round);
    expect(round.status).toBe("settled");
    expect(round.replay_hash).toBe("replay-hash-reference");
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

  it("JSON audit log reads support platform scope while preserving append order", async () => {
    const first = createAuditLog({
      audit_id: "audit-1",
      tenant_id: "tenant-1",
      actor_id: "actor-1",
      action: "auth.login",
      resource_id: "actor-1",
      request_id: "request-1"
    });
    const second = createAuditLog({
      audit_id: "audit-2",
      tenant_id: "tenant-2",
      actor_id: "actor-2",
      action: "user.create",
      resource_id: "resource-2",
      request_id: "request-2"
    });
    const third = createAuditLog({
      audit_id: "audit-3",
      tenant_id: "tenant-1",
      actor_id: "actor-3",
      action: "tenant.create",
      resource_type: "tenant",
      resource_id: "tenant-1",
      request_id: "request-3"
    });
    const ports = createJsonRepositoryPorts(
      createMinimalStore({ auditLogs: [first, second, third] })
    );

    await expect(ports.auditLogs.listAuditLogs({ scope: "platform" })).resolves.toEqual([
      first,
      second,
      third
    ]);
    await expect(
      ports.auditLogs.listAuditLogs({
        scope: "platform",
        action: "user.create",
        actor_id: "actor-2",
        resource_id: "resource-2",
        resource_type: "user",
        limit: 1
      })
    ).resolves.toEqual([second]);
  });

  it("JSON audit log reads keep tenant scope isolated with the same filter contract", async () => {
    const tenantOneUser = createAuditLog({
      audit_id: "audit-1",
      tenant_id: "tenant-1",
      actor_id: "actor-1",
      action: "user.create",
      resource_type: "user",
      resource_id: "user-1"
    });
    const tenantTwoUser = createAuditLog({
      audit_id: "audit-2",
      tenant_id: "tenant-2",
      actor_id: "actor-2",
      action: "user.create",
      resource_type: "user",
      resource_id: "user-2"
    });
    const tenantOneTenant = createAuditLog({
      audit_id: "audit-3",
      tenant_id: "tenant-1",
      actor_id: "actor-1",
      action: "tenant.create",
      resource_type: "tenant",
      resource_id: "tenant-1"
    });
    const ports = createJsonRepositoryPorts(
      createMinimalStore({ auditLogs: [tenantOneUser, tenantTwoUser, tenantOneTenant] })
    );

    await expect(
      ports.auditLogs.listAuditLogs({
        scope: "tenant",
        tenant_id: "tenant-1"
      })
    ).resolves.toEqual([tenantOneUser, tenantOneTenant]);
    await expect(
      ports.auditLogs.listAuditLogs({
        scope: "tenant",
        tenant_id: "tenant-1",
        resource_type: "tenant"
      })
    ).resolves.toEqual([tenantOneTenant]);
  });

  it("JSON state snapshots retain duplicate snapshot_id appends", async () => {
    const stateSnapshots: JsonStateSnapshot[] = [];
    const store = createMinimalStore();
    const ports = createJsonRepositoryPorts(store, { stateSnapshots });
    const first = createStateSnapshot({
      snapshot_id: "snapshot-shared",
      state: { marker: "first" }
    });
    const second = createStateSnapshot({
      snapshot_id: "snapshot-shared",
      state: { marker: "second" }
    });

    await expect(ports.stateSnapshots.saveStateSnapshot(first)).resolves.toBeUndefined();
    await expect(ports.stateSnapshots.saveStateSnapshot(second)).resolves.toBeUndefined();

    expect(stateSnapshots).toEqual([first, second]);
    expect(stateSnapshots[0]).toBe(first);
    expect(stateSnapshots[1]).toBe(second);
  });

  it("JSON state snapshots retain duplicate aggregate sequence appends", async () => {
    const stateSnapshots: JsonStateSnapshot[] = [];
    const ports = createJsonRepositoryPorts(createMinimalStore(), { stateSnapshots });
    const first = createStateSnapshot({
      sequence: 7,
      snapshot_id: "snapshot-sequence-1",
      state: { marker: "first" }
    });
    const second = createStateSnapshot({
      sequence: 7,
      snapshot_id: "snapshot-sequence-2",
      state: { marker: "second" }
    });

    await ports.stateSnapshots.saveStateSnapshot(first);
    await ports.stateSnapshots.saveStateSnapshot(second);

    expect(stateSnapshots).toEqual([first, second]);
    expect(stateSnapshots[0]).toBe(first);
    expect(stateSnapshots[1]).toBe(second);
  });

  it("JSON state snapshot reads return the last matching append", async () => {
    const first = createStateSnapshot({
      sequence: 1,
      snapshot_id: "snapshot-b",
      state: { marker: "first" }
    });
    const second = createStateSnapshot({
      sequence: 2,
      snapshot_id: "snapshot-a",
      state: { marker: "second" }
    });
    const third = createStateSnapshot({
      sequence: 1,
      snapshot_id: "snapshot-c",
      state: { marker: "third" }
    });
    const ports = createJsonRepositoryPorts(createMinimalStore(), {
      stateSnapshots: [first, second, third]
    });

    await expect(
      ports.stateSnapshots.getStateSnapshot({
        aggregate_id: "aggregate-1",
        aggregate_type: "run",
        tenant_id: "tenant-1"
      })
    ).resolves.toBe(third);
  });

  it("JSON state snapshot reads honor at_sequence before selecting the last match", async () => {
    const sequenceOne = createStateSnapshot({
      sequence: 1,
      snapshot_id: "snapshot-1",
      state: { marker: "sequence-1" }
    });
    const sequenceTwo = createStateSnapshot({
      sequence: 2,
      snapshot_id: "snapshot-2",
      state: { marker: "sequence-2" }
    });
    const sequenceThree = createStateSnapshot({
      sequence: 3,
      snapshot_id: "snapshot-3",
      state: { marker: "sequence-3" }
    });
    const ports = createJsonRepositoryPorts(createMinimalStore(), {
      stateSnapshots: [sequenceOne, sequenceTwo, sequenceThree]
    });

    await expect(
      ports.stateSnapshots.getStateSnapshot({
        aggregate_id: "aggregate-1",
        aggregate_type: "run",
        at_sequence: 2,
        tenant_id: "tenant-1"
      })
    ).resolves.toBe(sequenceTwo);
  });

  it("JSON state snapshot reads keep snapshots without sequence eligible for at_sequence", async () => {
    const eligibleSequenced = createStateSnapshot({
      sequence: 1,
      snapshot_id: "snapshot-eligible-sequenced",
      state: { marker: "eligible-sequenced" }
    });
    const aboveBound = createStateSnapshot({
      sequence: 3,
      snapshot_id: "snapshot-above-bound",
      state: { marker: "above-bound" }
    });
    const { sequence: _removedSequence, ...withoutSequence } = createStateSnapshot({
      snapshot_id: "snapshot-without-sequence",
      state: { marker: "without-sequence" }
    });
    const ports = createJsonRepositoryPorts(createMinimalStore(), {
      stateSnapshots: [eligibleSequenced, aboveBound, withoutSequence]
    });

    expect(_removedSequence).toBe(1);
    expect("sequence" in withoutSequence).toBe(false);

    const result = await ports.stateSnapshots.getStateSnapshot({
      aggregate_id: "aggregate-1",
      aggregate_type: "run",
      at_sequence: 1,
      tenant_id: "tenant-1"
    });

    expect(result).toBe(withoutSequence);
    expect(result).not.toBe(aboveBound);
    expect(result).toEqual(withoutSequence);
  });

  it("JSON state snapshot reads use last append for duplicate eligible sequence", async () => {
    const first = createStateSnapshot({
      sequence: 2,
      snapshot_id: "snapshot-duplicate-1",
      state: { marker: "first" }
    });
    const second = createStateSnapshot({
      sequence: 2,
      snapshot_id: "snapshot-duplicate-2",
      state: { marker: "second" }
    });
    const ports = createJsonRepositoryPorts(createMinimalStore(), {
      stateSnapshots: [first, second]
    });

    await expect(
      ports.stateSnapshots.getStateSnapshot({
        aggregate_id: "aggregate-1",
        aggregate_type: "run",
        at_sequence: 2,
        tenant_id: "tenant-1"
      })
    ).resolves.toBe(second);
  });

  it("JSON state snapshot reads are tenant isolated", async () => {
    const tenantOne = createStateSnapshot({
      snapshot_id: "snapshot-shared",
      state: { marker: "tenant-1" },
      tenant_id: "tenant-1"
    });
    const tenantTwo = createStateSnapshot({
      snapshot_id: "snapshot-shared",
      state: { marker: "tenant-2" },
      tenant_id: "tenant-2"
    });
    const ports = createJsonRepositoryPorts(createMinimalStore(), {
      stateSnapshots: [tenantOne, tenantTwo]
    });

    await expect(
      ports.stateSnapshots.getStateSnapshot({
        aggregate_id: "aggregate-1",
        aggregate_type: "run",
        tenant_id: "tenant-1"
      })
    ).resolves.toBe(tenantOne);
    await expect(
      ports.stateSnapshots.getStateSnapshot({
        aggregate_id: "aggregate-1",
        aggregate_type: "run",
        tenant_id: "tenant-2"
      })
    ).resolves.toBe(tenantTwo);
  });

  it("JSON state snapshot reads filter by aggregate type", async () => {
    const runSnapshot = createStateSnapshot({
      aggregate_type: "run",
      state: { marker: "run" }
    });
    const roundSnapshot = createStateSnapshot({
      aggregate_type: "round",
      snapshot_id: "snapshot-round",
      state: { marker: "round" }
    });
    const ports = createJsonRepositoryPorts(createMinimalStore(), {
      stateSnapshots: [runSnapshot, roundSnapshot]
    });

    await expect(
      ports.stateSnapshots.getStateSnapshot({
        aggregate_id: "aggregate-1",
        aggregate_type: "run",
        tenant_id: "tenant-1"
      })
    ).resolves.toBe(runSnapshot);
  });

  it("JSON state snapshot reads filter by aggregate identity", async () => {
    const aggregateOne = createStateSnapshot({
      aggregate_id: "aggregate-1",
      state: { marker: "aggregate-1" }
    });
    const aggregateTwo = createStateSnapshot({
      aggregate_id: "aggregate-2",
      snapshot_id: "snapshot-aggregate-2",
      state: { marker: "aggregate-2" }
    });
    const ports = createJsonRepositoryPorts(createMinimalStore(), {
      stateSnapshots: [aggregateOne, aggregateTwo]
    });

    await expect(
      ports.stateSnapshots.getStateSnapshot({
        aggregate_id: "aggregate-1",
        aggregate_type: "run",
        tenant_id: "tenant-1"
      })
    ).resolves.toBe(aggregateOne);
  });

  it.each([
    {
      label: "empty collection",
      query: {
        aggregate_id: "aggregate-1",
        aggregate_type: "run",
        tenant_id: "tenant-1"
      },
      snapshots: []
    },
    {
      label: "tenant mismatch",
      query: {
        aggregate_id: "aggregate-1",
        aggregate_type: "run",
        tenant_id: "tenant-2"
      },
      snapshots: [createStateSnapshot()]
    },
    {
      label: "aggregate mismatch",
      query: {
        aggregate_id: "aggregate-missing",
        aggregate_type: "run",
        tenant_id: "tenant-1"
      },
      snapshots: [createStateSnapshot()]
    },
    {
      label: "at_sequence below candidates",
      query: {
        aggregate_id: "aggregate-1",
        aggregate_type: "run",
        at_sequence: 0,
        tenant_id: "tenant-1"
      },
      snapshots: [createStateSnapshot({ sequence: 1 })]
    }
  ])(
    "JSON state snapshot reads return null when no snapshot matches: $label",
    async ({ query, snapshots }) => {
      const ports = createJsonRepositoryPorts(createMinimalStore(), { stateSnapshots: snapshots });

      await expect(ports.stateSnapshots.getStateSnapshot(query)).resolves.toBeNull();
    }
  );

  it("JSON state snapshot saves do not persist the store", async () => {
    const store = createMinimalStore();
    const ports = createJsonRepositoryPorts(store, { stateSnapshots: [] });

    await ports.stateSnapshots.saveStateSnapshot(createStateSnapshot());

    expect(store.persist).not.toHaveBeenCalled();
  });

  it("JSON state snapshot saves do not mutate the input object", async () => {
    const snapshot = createStateSnapshot();
    const before = structuredClone(snapshot);
    const ports = createJsonRepositoryPorts(createMinimalStore(), { stateSnapshots: [] });

    await ports.stateSnapshots.saveStateSnapshot(snapshot);

    expect(snapshot).toEqual(before);
  });

  it("JSON state snapshots preserve the complete saved object", async () => {
    const stateSnapshots: JsonStateSnapshot[] = [];
    const snapshot = createStateSnapshot({
      state: {
        nested: {
          bands: ["low", "medium", "high"],
          cash: 1200
        },
        teams: [
          {
            score: 88,
            team_id: "team-1"
          }
        ]
      }
    });
    const ports = createJsonRepositoryPorts(createMinimalStore(), { stateSnapshots });

    await ports.stateSnapshots.saveStateSnapshot(snapshot);

    expect(stateSnapshots[0]).toBe(snapshot);
    expect(stateSnapshots[0]).toEqual(snapshot);
    await expect(
      ports.stateSnapshots.getStateSnapshot({
        aggregate_id: "aggregate-1",
        aggregate_type: "run",
        tenant_id: "tenant-1"
      })
    ).resolves.toBe(snapshot);
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
