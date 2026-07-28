import {
  assertFormalCourseAuthorityBinding,
  type FormalCourseAuthorityBinding
} from "./formal-course-authority-binding.js";
import type { SimWarStore } from "./store.js";

export type FormalCourseAuthorityBindingStoreFailureCode = "FORMAL_COURSE_BINDING_ALREADY_EXISTS";

export class FormalCourseAuthorityBindingStoreError extends Error {
  constructor(readonly code: FormalCourseAuthorityBindingStoreFailureCode) {
    super(code);
    this.name = "FormalCourseAuthorityBindingStoreError";
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/**
 * Private append-only JSON persistence for Course-level formal inputs.
 * Public Course records stay ID-only so a legacy course cannot be mistaken
 * for a formal exact-reference configuration.
 */
export class FormalCourseAuthorityBindingStore {
  constructor(private readonly store: SimWarStore) {}

  append(binding: FormalCourseAuthorityBinding): void {
    assertFormalCourseAuthorityBinding(binding);
    const existing = this.store.formalCourseAuthorityBindings.find(
      (candidate) =>
        candidate.tenant_id === binding.tenant_id && candidate.course_id === binding.course_id
    );
    if (existing) {
      throw new FormalCourseAuthorityBindingStoreError("FORMAL_COURSE_BINDING_ALREADY_EXISTS");
    }
    this.store.formalCourseAuthorityBindings.push(deepFreeze(clone(binding)));
  }

  getForCourse(tenantId: string, courseId: string): FormalCourseAuthorityBinding | null {
    const binding = this.store.formalCourseAuthorityBindings.find(
      (candidate) => candidate.tenant_id === tenantId && candidate.course_id === courseId
    );
    if (!binding) return null;
    assertFormalCourseAuthorityBinding(binding);
    return deepFreeze(clone(binding));
  }
}
