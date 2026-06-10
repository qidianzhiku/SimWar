import { describe, expect, it, vi } from "vitest";
import type { Decision, DecisionPayload } from "@simwar/shared-contracts";
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
