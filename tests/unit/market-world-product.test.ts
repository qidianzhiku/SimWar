import { describe, expect, it } from "vitest";
import type { Course } from "../../packages/shared-contracts/src";
import {
  assertMarketWorldProductIntegrity,
  createAdminMarketWorldAuditProjection,
  createStudentMarketWorldBriefProjection,
  createTeacherMarketWorldProjection,
  getShanghaiMarketWorldReference,
  MARKET_WORLD_PRODUCT_PROJECTION
} from "../../services/api/src/market-world-product";

const baseCourse: Course = {
  course_id: "course_market_world_unit",
  created_by: "usr_teacher",
  parameter_set_id: "param_demo",
  scenario_package_id: "scenario_demo",
  status: "published",
  tenant_id: "tenant_demo",
  title: "Market World unit course"
};

describe("Market World product-safe projection", () => {
  it("projects an unbound Course as selectable and a bound Course as exact and ready-with-limits", () => {
    const unbound = createTeacherMarketWorldProjection({ course: baseCourse });
    expect(unbound.binding_state).toBe("UNBOUND");
    expect(unbound.available_market_worlds).toHaveLength(1);

    const bound = createTeacherMarketWorldProjection({
      course: { ...baseCourse, market_world_reference: getShanghaiMarketWorldReference() }
    });
    expect(bound.binding_state).toBe("BOUND");
    expect(bound.market_world_reference).toEqual(getShanghaiMarketWorldReference());
    expect(bound.readiness.status).toBe("READY_WITH_LIMITS");
    expect(bound.known_limits.length).toBeGreaterThan(0);
    expect(bound.archetypes.limited).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "INSURANCE_CAPITAL", status: "DRAFT_NON_BINDABLE" }),
        expect.objectContaining({ type: "AI_NATIVE_OPERATOR", status: "DRAFT_NON_BINDABLE" })
      ])
    );
  });

  it("does not expose the brief before Course visibility and emits only role-safe content after it", () => {
    const hidden = createStudentMarketWorldBriefProjection({
      course: {
        ...baseCourse,
        market_world_reference: getShanghaiMarketWorldReference(),
        status: "draft"
      }
    });
    expect(hidden).toBeNull();

    const visible = createStudentMarketWorldBriefProjection({
      course: { ...baseCourse, market_world_reference: getShanghaiMarketWorldReference() }
    });
    expect(visible?.brief_kind).toBe("SHANGHAI_MARKET_BRIEF");
    expect(visible).toHaveProperty("market_structure");
    expect(JSON.stringify(visible)).not.toMatch(
      /state_true|raw_source_path|private_coefficient|other_team_data|unpublished_result|contactPhone|providerName/i
    );
  });

  it("keeps Admin projection bounded and explicitly marks limited archetypes", () => {
    const projection = createAdminMarketWorldAuditProjection({
      course: { ...baseCourse, market_world_reference: getShanghaiMarketWorldReference() }
    });
    expect(projection.binding_state).toBe("BOUND");
    expect(projection.source_categories.length).toBeGreaterThan(0);
    expect(JSON.stringify(projection)).not.toMatch(
      /raw_source_path|private_coefficient|state_true/i
    );
    expect(projection.limited_archetypes).toEqual(
      expect.arrayContaining(["INSURANCE_CAPITAL", "AI_NATIVE_OPERATOR"])
    );
  });

  it("fails closed when the materialized safe asset is corrupt", () => {
    const corrupt = {
      ...MARKET_WORLD_PRODUCT_PROJECTION,
      readiness: {
        ...MARKET_WORLD_PRODUCT_PROJECTION.readiness,
        known_limits: [...MARKET_WORLD_PRODUCT_PROJECTION.readiness.known_limits, "tampered"]
      }
    };
    expect(() => assertMarketWorldProductIntegrity(corrupt)).toThrow(
      "MARKET_WORLD_PRODUCT_ASSET_CORRUPT"
    );
  });
});
