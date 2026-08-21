import type {
  Course,
  MarketWorldBindingReceipt,
  MarketWorldReadiness,
  MarketWorldRef
} from "@simwar/shared-contracts";
import { createMarketWorldReference } from "@simwar/shared-contracts";
import {
  assertMarketWorldProductIntegrity,
  getShanghaiMarketWorldReference,
  MARKET_WORLD_PRODUCT_PROJECTION
} from "./market-world-product.js";
import type { CourseRepositoryPort } from "./repository-ports.js";

export type MarketWorldBindingErrorCode =
  | "MARKET_WORLD_REFERENCE_INVALID"
  | "MARKET_WORLD_UNKNOWN_REFERENCE"
  | "MARKET_WORLD_STALE_REFERENCE"
  | "MARKET_WORLD_COURSE_NOT_FOUND"
  | "MARKET_WORLD_TENANT_SCOPE_VIOLATION"
  | "MARKET_WORLD_BINDING_CONFLICT"
  | "MARKET_WORLD_BINDING_READ_FAILED"
  | "MARKET_WORLD_BINDING_RECOVERY_REQUIRED";

export class MarketWorldBindingError extends Error {
  constructor(
    readonly code: MarketWorldBindingErrorCode,
    options?: { cause?: unknown }
  ) {
    super(code, options);
    this.name = "MarketWorldBindingError";
  }
}

export interface MarketWorldBindingAuditInput {
  action: "market_world.bind";
  course_id: string;
  tenant_id: string;
  market_world_reference: MarketWorldRef;
  readiness: Pick<MarketWorldReadiness, "status" | "freshness">;
  idempotent: boolean;
}

export interface BindMarketWorldToCourseInput {
  courses: Pick<CourseRepositoryPort, "getCourse" | "saveCourse">;
  tenantId: string;
  courseId: string;
  reference: MarketWorldRef;
  appendAudit?: (input: MarketWorldBindingAuditInput) => Promise<void>;
}

function sameReference(left: MarketWorldRef, right: MarketWorldRef): boolean {
  return (
    left.market_world_id === right.market_world_id &&
    left.version === right.version &&
    left.digest === right.digest
  );
}

function validateExactProductReference(reference: MarketWorldRef): MarketWorldRef {
  let normalized: MarketWorldRef;
  try {
    normalized = createMarketWorldReference(reference);
  } catch (error) {
    throw new MarketWorldBindingError("MARKET_WORLD_REFERENCE_INVALID", { cause: error });
  }

  assertMarketWorldProductIntegrity();
  const expected = getShanghaiMarketWorldReference();
  if (normalized.market_world_id !== expected.market_world_id) {
    throw new MarketWorldBindingError("MARKET_WORLD_UNKNOWN_REFERENCE");
  }
  if (!sameReference(normalized, expected)) {
    throw new MarketWorldBindingError("MARKET_WORLD_STALE_REFERENCE");
  }
  return normalized;
}

async function readCourseWithOneTransientRetry(
  courses: Pick<CourseRepositoryPort, "getCourse">,
  tenantId: string,
  courseId: string
): Promise<Course | null> {
  try {
    return await courses.getCourse(tenantId, courseId);
  } catch (firstError) {
    try {
      return await courses.getCourse(tenantId, courseId);
    } catch (secondError) {
      throw new MarketWorldBindingError("MARKET_WORLD_BINDING_READ_FAILED", {
        cause: secondError ?? firstError
      });
    }
  }
}

function receipt(input: {
  course: Course;
  reference: MarketWorldRef;
  idempotent: boolean;
}): MarketWorldBindingReceipt {
  const readiness = structuredClone(MARKET_WORLD_PRODUCT_PROJECTION.readiness);
  return {
    binding_state: "BOUND",
    course_id: input.course.course_id,
    idempotent: input.idempotent,
    known_limits: [...readiness.known_limits],
    market_world_reference: structuredClone(input.reference),
    operation_id: "TEACHER_MARKET_WORLD_BINDING_POST_V1",
    readiness,
    schema_version: "market-world-binding-receipt.v1",
    tenant_id: input.course.tenant_id
  };
}

export async function bindMarketWorldToCourse(
  input: BindMarketWorldToCourseInput
): Promise<MarketWorldBindingReceipt> {
  const reference = validateExactProductReference(input.reference);
  const course = await readCourseWithOneTransientRetry(
    input.courses,
    input.tenantId,
    input.courseId
  );

  if (!course) {
    throw new MarketWorldBindingError("MARKET_WORLD_COURSE_NOT_FOUND");
  }
  if (course.tenant_id !== input.tenantId) {
    throw new MarketWorldBindingError("MARKET_WORLD_TENANT_SCOPE_VIOLATION");
  }

  if (course.market_world_reference) {
    if (sameReference(course.market_world_reference, reference)) {
      return receipt({ course, idempotent: true, reference });
    }
    throw new MarketWorldBindingError("MARKET_WORLD_BINDING_CONFLICT");
  }

  const originalCourse = structuredClone(course);
  const boundCourse: Course = {
    ...course,
    market_world_reference: structuredClone(reference)
  };
  await input.courses.saveCourse(boundCourse);

  try {
    await input.appendAudit?.({
      action: "market_world.bind",
      course_id: course.course_id,
      idempotent: false,
      market_world_reference: structuredClone(reference),
      readiness: {
        freshness: structuredClone(MARKET_WORLD_PRODUCT_PROJECTION.readiness.freshness),
        status: MARKET_WORLD_PRODUCT_PROJECTION.readiness.status
      },
      tenant_id: course.tenant_id
    });
  } catch (auditError) {
    try {
      await input.courses.saveCourse(originalCourse);
    } catch (compensationError) {
      throw new MarketWorldBindingError("MARKET_WORLD_BINDING_RECOVERY_REQUIRED", {
        cause: compensationError
      });
    }
    throw new MarketWorldBindingError("MARKET_WORLD_BINDING_RECOVERY_REQUIRED", {
      cause: auditError
    });
  }

  return receipt({ course: boundCourse, idempotent: false, reference });
}
