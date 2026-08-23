import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  OperatingWorldDraftInput,
  OperatingWorldServiceActor,
  OperatingWorldServiceScope
} from "../../services/api/src/operating-world-service";
import {
  OperatingWorldError,
  OperatingWorldService
} from "../../services/api/src/operating-world-service";
import { createJsonOperatingWorldPersistence } from "../../services/api/src/json-repository-adapter";
import { createP1Store } from "../../services/api/src/store";

const actor: OperatingWorldServiceActor = {
  actor_id: "usr_teacher",
  role: "teacher",
  tenant_id: "tenant_demo"
};

const scope: OperatingWorldServiceScope = {
  activity_id: "sh-m3-operating-world",
  course_id: "course_demo"
};

const validInput = (): OperatingWorldDraftInput => ({
  title: "上海养老 Operating World",
  seed: 20260823,
  families: {
    "SH-16": {
      workforce_supply: 120,
      wage_pressure: 0.08,
      staffing_floor: 80,
      service_capacity: 100,
      quality_target: 0.9,
      recruitment_pressure: 0.2,
      turnover_pressure: 0.12,
      recovery_lag: 2,
      info: {
        demand_signal: 0.72,
        source_category: "LOCAL_DATA",
        source_ref: "local://shanghai/workforce-2026",
        freshness: "CURRENT",
        confidence: "MEDIUM",
        known_limits: ["机构口径不齐"]
      }
    },
    "SH-17": {
      capital_cost: 0.055,
      credit_availability: 0.7,
      covenant_tightness: 0.3,
      financing_availability: 0.68,
      construction_cost: 120000,
      construction_cycle: 3,
      approved_capacity_min: 60,
      approved_capacity_max: 240,
      info: {
        demand_signal: 0.7,
        source_category: "SYNTHETIC",
        source_ref: "scenario://shanghai/capital-v1",
        freshness: "CURRENT",
        confidence: "HIGH",
        known_limits: ["非授信承诺"]
      }
    },
    "SH-18": {
      policy_pack_ref: "sh-policy-2026-v1",
      economic_cycle: "slow-growth",
      shock_ref: "none",
      effective_time: "2026-Q3",
      priority: "normal",
      visibility: "STUDENT_SAFE",
      info: {
        demand_signal: 0.5,
        source_category: "TEACHER_INPUT",
        source_ref: "teacher://scenario/sh-policy-2026-v1",
        freshness: "CURRENT",
        confidence: "MEDIUM",
        known_limits: ["教学注入"]
      }
    },
    "SH-19": {
      portfolio_constraints: ["single-campus-cap"],
      project_option_compatibility: ["community-care-v2"],
      market_node_ref: "sh-pudong-node-01",
      project_slot_ref: "sh-slot-01",
      info: {
        demand_signal: 0.61,
        source_category: "ASSUMPTION",
        source_ref: "scenario://shanghai/portfolio-v1",
        freshness: "CURRENT",
        confidence: "LOW",
        known_limits: ["需教师复核"]
      }
    }
  }
});

function bindInput() {
  return {
    run_id: "run_demo",
    round_no: 1,
    seed: 42,
    parameter_set_reference: {
      content_digest: "a".repeat(64),
      parameter_set_id: "param_demo",
      version: "1.0.0"
    },
    scenario_package_reference: {
      content_digest: "b".repeat(64),
      scenario_package_id: "scenario_demo",
      tenant_id: "tenant_demo",
      version: "1.0.0"
    },
    model_version_ref: "eldercare_w5_governed_v1@1.0.0"
  } as const;
}

describe("OperatingWorldService", () => {
  it("implements DRAFT -> VALIDATED -> FROZEN -> BOUND with an exact immutable binding", () => {
    const service = new OperatingWorldService({ now: () => "2026-08-23T00:00:00.000Z" });
    const created = service.createDraft(actor, scope, validInput());
    expect(created.draft.status).toBe("DRAFT");

    const validated = service.validateDraft(actor, scope, created.draft.draft_id);
    expect(validated.draft.status).toBe("VALIDATED");
    const frozen = service.freezeDraft(actor, scope, created.draft.draft_id);
    expect(frozen.draft.status).toBe("FROZEN");

    const bound = service.bindDraft(
      actor,
      { ...scope, run_id: "run_demo", round_no: 1 },
      frozen.draft.draft_id,
      bindInput()
    );
    expect(bound.draft.status).toBe("BOUND");
    expect(bound.draft.binding?.no_implicit_latest).toBe(true);

    const repeated = service.bindDraft(
      actor,
      { ...scope, run_id: "run_demo", round_no: 1 },
      frozen.draft.draft_id,
      bindInput()
    );
    expect(repeated.draft.binding?.binding_digest).toBe(bound.draft.binding?.binding_digest);
    expect(() =>
      service.bindDraft(
        actor,
        { ...scope, run_id: "run_other", round_no: 1 },
        frozen.draft.draft_id,
        bindInput()
      )
    ).toThrow(new OperatingWorldError("OW_BINDING_CONFLICT"));
  });

  it("produces deterministic LOW/BASE/HIGH preview receipts without an official write or PREVIEWED state", () => {
    const service = new OperatingWorldService({ now: () => "2026-08-23T00:00:00.000Z" });
    const created = service.createDraft(actor, scope, validInput());
    const validated = service.validateDraft(actor, scope, created.draft.draft_id);
    const first = service.previewDraft(actor, scope, validated.draft.draft_id, "BASE");
    const second = service.previewDraft(actor, scope, validated.draft.draft_id, "BASE");
    expect(first.receipt.preview_digest).toBe(second.receipt.preview_digest);
    expect(first.receipt.no_official_write).toBe(true);
    expect(first.receipt.effect_class).toBe("OFFICIAL_CONSUMER_ELIGIBLE");
    expect(first.receipt.parameter_delta).toEqual(
      expect.objectContaining({ construction_cost: expect.any(Number) })
    );
    expect(service.getDraft(actor, scope, created.draft.draft_id).status).toBe("VALIDATED");
    expect(first.receipt.known_limits.length).toBeGreaterThan(0);
  });

  it("rejects invalid bounds/provenance and never exposes forbidden fields in the student projection", () => {
    const service = new OperatingWorldService();
    const invalid = validInput();
    invalid.families["SH-17"].construction_cost = -1;
    expect(() => service.createDraft(actor, scope, invalid)).toThrow(
      new OperatingWorldError("OW_INVALID_VALUE")
    );

    const missingProvenance = validInput();
    missingProvenance.families["SH-16"].info.source_ref = "";
    expect(() => service.createDraft(actor, scope, missingProvenance)).toThrow(
      new OperatingWorldError("OW_SOURCE_PROVENANCE_REQUIRED")
    );

    const created = service.createDraft(actor, scope, validInput());
    service.validateDraft(actor, scope, created.draft.draft_id);
    service.freezeDraft(actor, scope, created.draft.draft_id);
    service.bindDraft(
      actor,
      { ...scope, run_id: "run_demo", round_no: 1 },
      created.draft.draft_id,
      bindInput()
    );
    const projection = service.projectStudent(
      { ...actor, role: "student", actor_id: "usr_student" },
      { ...scope, run_id: "run_demo", round_no: 1 },
      created.draft.draft_id
    );
    const serialized = JSON.stringify(projection);
    expect(projection.visibility).toBe("ROLE_SAFE_STUDENT");
    expect(serialized).not.toContain("source_ref");
    expect(serialized).not.toContain("state_true");
    expect(serialized).not.toContain("private");
    expect(serialized).toContain("wage_pressure");
    expect(() =>
      service.projectStudent(
        { ...actor, role: "student", actor_id: "usr_student" },
        { ...scope, run_id: "run_other", round_no: 1 },
        created.draft.draft_id
      )
    ).toThrow(new OperatingWorldError("OW_EXACT_BINDING_REQUIRED"));
  });

  it("rejects missing or malformed family payloads instead of supplying defaults or throwing TypeError", () => {
    const service = new OperatingWorldService();
    expect(() =>
      service.createDraft(actor, scope, {
        families: undefined as unknown as OperatingWorldDraftInput["families"]
      })
    ).toThrow(new OperatingWorldError("OW_INVALID_VALUE"));
    expect(() =>
      service.createDraft(actor, scope, {
        families: {
          "SH-16": {},
          "SH-17": {},
          "SH-18": {},
          "SH-19": {}
        } as OperatingWorldDraftInput["families"]
      })
    ).toThrow(new OperatingWorldError("OW_INVALID_VALUE"));
    const outOfRange = validInput();
    outOfRange.families["SH-17"].capital_cost = 5;
    expect(() => service.createDraft(actor, scope, outOfRange)).toThrow(
      new OperatingWorldError("OW_INVALID_VALUE")
    );
  });

  it("persists the governance draft and exact binding across a JSON store restart", () => {
    const directory = mkdtempSync(join(process.env.TEMP ?? process.env.TMP ?? ".", "simwar-ow-"));
    const snapshotPath = join(directory, "store.json");
    try {
      const firstStore = createP1Store({ persistenceFile: snapshotPath });
      const firstService = new OperatingWorldService(
        { now: () => "2026-08-23T00:00:00.000Z" },
        createJsonOperatingWorldPersistence(firstStore)
      );
      const created = firstService.createDraft(actor, scope, validInput());
      firstService.validateDraft(actor, scope, created.draft.draft_id);
      firstService.freezeDraft(actor, scope, created.draft.draft_id);
      firstService.bindDraft(
        actor,
        { ...scope, run_id: "run_demo", round_no: 1 },
        created.draft.draft_id,
        bindInput()
      );

      const restartedStore = createP1Store({ persistenceFile: snapshotPath });
      const restartedService = new OperatingWorldService(
        { now: () => "2026-08-23T00:00:00.000Z" },
        createJsonOperatingWorldPersistence(restartedStore)
      );
      const projection = restartedService.getTeacherProjection(actor, scope);
      expect(projection.drafts[0]?.status).toBe("BOUND");
      expect(
        restartedService.getOfficialConsumerInput(
          actor,
          { ...scope, run_id: "run_demo", round_no: 1 },
          created.draft.draft_id
        ).source_binding_digest
      ).toBe(projection.drafts[0]?.binding?.binding_digest);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
