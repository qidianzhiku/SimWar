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

export interface PendingFormalCourseAuthorityBinding {
  readonly course_id: string;
  readonly tenant_id: string;
  readonly token: symbol;
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
  private readonly pending = new Map<symbol, { course_id: string; tenant_id: string }>();

  constructor(private readonly store: SimWarStore) {}

  append(binding: FormalCourseAuthorityBinding): void {
    this.appendInternal(binding);
  }

  appendPending(binding: FormalCourseAuthorityBinding): PendingFormalCourseAuthorityBinding {
    this.appendInternal(binding);
    const token = Symbol("formal-course-authority-binding-pending");
    this.pending.set(token, { course_id: binding.course_id, tenant_id: binding.tenant_id });
    return Object.freeze({ course_id: binding.course_id, tenant_id: binding.tenant_id, token });
  }

  commitPending(pending: PendingFormalCourseAuthorityBinding): void {
    this.requirePending(pending);
    this.pending.delete(pending.token);
  }

  removeUncommitted(pending: PendingFormalCourseAuthorityBinding): void {
    this.requirePending(pending);
    const index = this.store.formalCourseAuthorityBindings.findIndex(
      (candidate) =>
        candidate.tenant_id === pending.tenant_id && candidate.course_id === pending.course_id
    );
    if (index < 0) {
      throw new Error("formal_course_authority_binding_pending_missing");
    }
    this.store.formalCourseAuthorityBindings.splice(index, 1);
    this.pending.delete(pending.token);
  }

  private appendInternal(binding: FormalCourseAuthorityBinding): void {
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

  private requirePending(pending: PendingFormalCourseAuthorityBinding): void {
    const current = this.pending.get(pending.token);
    if (
      !current ||
      current.course_id !== pending.course_id ||
      current.tenant_id !== pending.tenant_id
    ) {
      throw new Error("formal_course_authority_binding_pending_invalid");
    }
  }
}
