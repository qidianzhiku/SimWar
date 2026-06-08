import { describe, expect, it, vi } from "vitest";
import { createJsonRepositoryPorts } from "../../services/api/src/json-repository-adapter.js";
import type { SimWarStore } from "../../services/api/src/store.js";

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

  it("persists canonical decisions without changing the payload", async () => {
    const store = createMinimalStore();
    const ports = createJsonRepositoryPorts(store);
    const decision = {
      tenant_id: "tenant-1",
      decision_id: "decision-1",
      run_id: "run-1",
      round_id: "round-1",
      team_id: "team-1",
      version: 1,
      status: "submitted",
      payload: {
        pricing: { base_price: 12000 },
        marketing_budget: 250000,
        service_quality_budget: 150000,
        strategy_statement: "premium growth plan"
      }
    } as Parameters<typeof ports.decisions.saveCanonicalDecision>[0];

    await ports.decisions.saveCanonicalDecision(decision);

    expect(store.decisions).toHaveLength(1);
    expect(store.decisions[0]).toBe(decision);
    expect(store.persist).toHaveBeenCalledTimes(1);

    await expect(
      ports.decisions.getCanonicalDecisionForTeamRound("tenant-1", "run-1", "round-1", "team-1")
    ).resolves.toBe(decision);
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
