import { describe, expect, it } from "vitest";
import type { Course } from "../../packages/shared-contracts/src";
import { MARKET_WORLD_STUDENT_FORBIDDEN_FIELDS } from "../../packages/shared-contracts/src";
import {
  bindMarketWorldToCourse,
  MarketWorldBindingError
} from "../../services/api/src/market-world-binding-service";
import {
  createAdminMarketWorldAuditProjection,
  createStudentMarketWorldBriefProjection,
  createTeacherMarketWorldProjection,
  getShanghaiMarketWorldReference
} from "../../services/api/src/market-world-product";

const reference = getShanghaiMarketWorldReference();
const course: Course = {
  course_id: "course_market_world_security",
  created_by: "usr_teacher",
  parameter_set_id: "param_demo",
  scenario_package_id: "scenario_demo",
  status: "published",
  tenant_id: "tenant_demo",
  title: "Market World security course"
};

function assertNoForbiddenKeys(value: unknown): void {
  if (Array.isArray(value)) {
    for (const entry of value) assertNoForbiddenKeys(entry);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    expect(MARKET_WORLD_STUDENT_FORBIDDEN_FIELDS).not.toContain(key);
    assertNoForbiddenKeys(nested);
  }
}

describe("Market World security boundary", () => {
  it("keeps all role projections free of private truth and result fields", () => {
    const boundCourse = { ...course, market_world_reference: reference };
    const projections = [
      createTeacherMarketWorldProjection({ course: boundCourse }),
      createStudentMarketWorldBriefProjection({ course: boundCourse }),
      createAdminMarketWorldAuditProjection({ course: boundCourse })
    ];

    for (const projection of projections) assertNoForbiddenKeys(projection);
  });

  it("does not expose the Student brief before exact visibility and rejects stale refs", () => {
    expect(
      createStudentMarketWorldBriefProjection({
        course: { ...course, market_world_reference: reference, status: "draft" }
      })
    ).toBeNull();
    expect(
      createStudentMarketWorldBriefProjection({
        course: {
          ...course,
          market_world_reference: { ...reference, digest: "a".repeat(64) }
        }
      })
    ).toBeNull();
  });

  it("fails closed for unknown, stale, and cross-tenant binding requests", async () => {
    const repository = {
      async getCourse() {
        return course;
      },
      async saveCourse() {
        return undefined;
      }
    };

    await expect(
      bindMarketWorldToCourse({
        courseId: course.course_id,
        courses: repository,
        reference: { ...reference, market_world_id: "unknown-world" },
        tenantId: course.tenant_id
      })
    ).rejects.toMatchObject({ code: "MARKET_WORLD_UNKNOWN_REFERENCE" });

    await expect(
      bindMarketWorldToCourse({
        courseId: course.course_id,
        courses: repository,
        reference: { ...reference, version: "2026-08-20.m2.0" },
        tenantId: course.tenant_id
      })
    ).rejects.toMatchObject({ code: "MARKET_WORLD_STALE_REFERENCE" });

    await expect(
      bindMarketWorldToCourse({
        courseId: course.course_id,
        courses: repository,
        reference,
        tenantId: "tenant_other"
      })
    ).rejects.toBeInstanceOf(MarketWorldBindingError);
    await expect(
      bindMarketWorldToCourse({
        courseId: course.course_id,
        courses: repository,
        reference,
        tenantId: "tenant_other"
      })
    ).rejects.toMatchObject({ code: "MARKET_WORLD_TENANT_SCOPE_VIOLATION" });
  });
});
