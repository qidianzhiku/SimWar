import { describe, expect, it } from "vitest";
import type { Course } from "../../packages/shared-contracts/src";
import {
  bindMarketWorldToCourse,
  MarketWorldBindingError
} from "../../services/api/src/market-world-binding-service";
import { getShanghaiMarketWorldReference } from "../../services/api/src/market-world-product";

const reference = getShanghaiMarketWorldReference();
const course: Course = {
  course_id: "course_market_world_binding",
  created_by: "usr_teacher",
  parameter_set_id: "param_demo",
  scenario_package_id: "scenario_demo",
  status: "published",
  tenant_id: "tenant_demo",
  title: "Market World binding course"
};

function repository(initial: Course | null = course) {
  let current = initial;
  let readCount = 0;
  return {
    get current() {
      return current;
    },
    get readCount() {
      return readCount;
    },
    async getCourse() {
      readCount += 1;
      return current;
    },
    async saveCourse(next: Course) {
      current = structuredClone(next);
    }
  };
}

describe("authoritative Market World Course binding", () => {
  it("writes through the existing Course port and returns an exact receipt", async () => {
    const port = repository();
    const result = await bindMarketWorldToCourse({
      appendAudit: async () => undefined,
      courseId: course.course_id,
      courses: port,
      reference,
      tenantId: course.tenant_id
    });

    expect(result.binding_state).toBe("BOUND");
    expect(result.idempotent).toBe(false);
    expect(result.market_world_reference).toEqual(reference);
    expect(port.current?.market_world_reference).toEqual(reference);
  });

  it("is idempotent for the same exact reference and conflicts on another exact reference", async () => {
    const port = repository({ ...course, market_world_reference: reference });
    const same = await bindMarketWorldToCourse({
      appendAudit: async () => undefined,
      courseId: course.course_id,
      courses: port,
      reference,
      tenantId: course.tenant_id
    });
    expect(same.idempotent).toBe(true);

    const conflictPort = repository({
      ...course,
      market_world_reference: { ...reference, market_world_id: "historical-world" }
    });
    await expect(
      bindMarketWorldToCourse({
        appendAudit: async () => undefined,
        courseId: course.course_id,
        courses: conflictPort,
        reference,
        tenantId: course.tenant_id
      })
    ).rejects.toMatchObject({ code: "MARKET_WORLD_BINDING_CONFLICT" });
  });

  it("fails closed for unknown refs, missing courses, and tenant mismatches", async () => {
    const port = repository();
    await expect(
      bindMarketWorldToCourse({
        appendAudit: async () => undefined,
        courseId: course.course_id,
        courses: port,
        reference: { ...reference, market_world_id: "unknown-world" },
        tenantId: course.tenant_id
      })
    ).rejects.toMatchObject({ code: "MARKET_WORLD_UNKNOWN_REFERENCE" });

    await expect(
      bindMarketWorldToCourse({
        appendAudit: async () => undefined,
        courseId: "missing-course",
        courses: repository(null),
        reference,
        tenantId: course.tenant_id
      })
    ).rejects.toMatchObject({ code: "MARKET_WORLD_COURSE_NOT_FOUND" });

    await expect(
      bindMarketWorldToCourse({
        appendAudit: async () => undefined,
        courseId: course.course_id,
        courses: port,
        reference,
        tenantId: "tenant_other"
      })
    ).rejects.toBeInstanceOf(MarketWorldBindingError);
  });

  it("compensates a partial write and retries one transient read", async () => {
    const port = repository();
    let failFirstRead = true;
    const flaky = {
      getCourse: async () => {
        if (failFirstRead) {
          failFirstRead = false;
          throw new Error("transient read");
        }
        return port.current;
      },
      saveCourse: port.saveCourse
    };
    await expect(
      bindMarketWorldToCourse({
        appendAudit: async () => {
          throw new Error("audit unavailable");
        },
        courseId: course.course_id,
        courses: flaky,
        reference,
        tenantId: course.tenant_id
      })
    ).rejects.toMatchObject({ code: "MARKET_WORLD_BINDING_RECOVERY_REQUIRED" });
    expect(port.current?.market_world_reference).toBeUndefined();
    expect(port.readCount).toBe(0);
  });
});
