import { describe, expect, it } from "vitest";
import type {
  W4CanonicalStrategicDecision,
  W4ScopeContext
} from "../../packages/shared-contracts/src";
import {
  createW4DecisionPayloadDigest,
  createEnterpriseStateStrategicEvolutionService,
  createInMemoryW4Repository
} from "../../services/api/src/w4-enterprise-state";
import {
  defaultFamilies,
  OperatingWorldService
} from "../../services/api/src/operating-world-service";
import { assertOperatingWorldConsumerForDecision } from "../../services/api/src/routes/w4-enterprise-state-routes";

const operatingActor = { actor_id: "teacher", role: "teacher" as const, tenant_id: "tenant_demo" };
const operatingScope = { activity_id: "sh-m3-operating-world", course_id: "course_demo" };

describe("Operating World W4 sole-writer bridge", () => {
  it("maps a bound SH-17 input into the existing canonical W4 capital consumer", async () => {
    const operatingWorld = new OperatingWorldService({ now: () => "2026-08-23T00:00:00.000Z" });
    const draft = operatingWorld.createDraft(operatingActor, operatingScope, {
      families: defaultFamilies()
    }).draft;
    operatingWorld.validateDraft(operatingActor, operatingScope, draft.draft_id);
    operatingWorld.freezeDraft(operatingActor, operatingScope, draft.draft_id);
    operatingWorld.bindDraft(
      operatingActor,
      { ...operatingScope, run_id: "run_demo", round_no: 1 },
      draft.draft_id,
      {
        model_version_ref: "eldercare_w5_governed_v1@1.0.0",
        parameter_set_reference: {
          content_digest: "a".repeat(64),
          parameter_set_id: "param_demo",
          version: "1.0.0"
        },
        round_no: 1,
        run_id: "run_demo",
        scenario_package_reference: {
          content_digest: "b".repeat(64),
          scenario_package_id: "scenario_demo",
          tenant_id: "tenant_demo",
          version: "1.0.0"
        },
        seed: 42
      }
    );
    const consumer = operatingWorld.getOfficialConsumerInput(
      operatingActor,
      { ...operatingScope, run_id: "run_demo", round_no: 1 },
      draft.draft_id
    );
    expect(consumer.effect_class).toBe("OFFICIAL_CONSUMER_ELIGIBLE");

    const scope: W4ScopeContext = {
      actor_id: "teacher",
      tenant_id: "tenant_demo",
      course_id: "course_demo",
      run_id: "run_demo",
      team_id: "team_demo",
      round_id: "round_demo_1",
      round_no: 1,
      role_key: "teacher",
      activity_id: "w4-enterprise-state-strategic-evolution"
    };
    const payload = {
      rationale: "use governed capital environment",
      lead_time_rounds: consumer.construction_cycle,
      reversible: false,
      dependencies: ["canonical-admission"],
      kpi_hypothesis: "preserve project liquidity",
      capital_action_kind: "debt" as const,
      principal: 500,
      term_rounds: 2,
      rate_or_cost_bps: Math.round(consumer.capital_cost * 10000),
      cost_source: `operating-world:${consumer.source_binding_digest}`,
      covenant_min_cash: 500,
      fees: 10,
      obligation: "term_debt" as const
    };
    const base: W4CanonicalStrategicDecision = {
      decision_id: "decision-operating-world",
      tenant_id: scope.tenant_id,
      course_id: scope.course_id,
      run_id: scope.run_id,
      round_id: scope.round_id,
      round_no: scope.round_no,
      team_id: scope.team_id,
      kind: "capital_action",
      version: 1,
      status: "canonical",
      payload,
      admission: {
        policy: "LEGACY_DIRECT_EXPLICIT",
        authority: "synthetic_run_creation_marker",
        canonical_decision_id: null,
        merge_commit_id: null,
        team_confirmation_id: null,
        decision_payload_digest: createW4DecisionPayloadDigest("capital_action", payload)
      }
    };
    const validated = assertOperatingWorldConsumerForDecision(base, consumer);
    expect(validated).toBe(base);
    expect(() =>
      assertOperatingWorldConsumerForDecision(
        { ...base, payload: { ...base.payload, rate_or_cost_bps: 100 } },
        consumer
      )
    ).toThrowError("W4_DECISION_ADMISSION_REQUIRED");
    const committed = await createEnterpriseStateStrategicEvolutionService(
      createInMemoryW4Repository()
    ).commitStrategicDecision(scope, {
      ...validated,
      admission: {
        ...validated.admission,
        decision_payload_digest: createW4DecisionPayloadDigest("capital_action", validated.payload)
      }
    });
    expect(committed.capital_action?.rate_or_cost_bps).toBe(550);
    expect(committed.capital_action?.effective_round_no).toBe(4);
    expect(committed.capital_action?.cost_source).toContain("operating-world:");
  });
});
