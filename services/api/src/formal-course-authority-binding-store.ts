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

export interface FormalCourseAuthorityBindingPendingOptions {
  /**
   * Retain the private pending token after commit so the same command can
   * compensate a later adjacent-write failure before it returns success.
   */
  readonly retain_for_compensation?: boolean;
}

export interface FormalCourseAuthorityBindingPort {
  append(binding: FormalCourseAuthorityBinding): void | Promise<void>;
  appendPending(
    binding: FormalCourseAuthorityBinding,
    options?: FormalCourseAuthorityBindingPendingOptions
  ): PendingFormalCourseAuthorityBinding | Promise<PendingFormalCourseAuthorityBinding>;
  commitPending(pending: PendingFormalCourseAuthorityBinding): void | Promise<void>;
  /** Complete a retained same-command transaction after every adjacent write succeeds. */
  finalizePending(pending: PendingFormalCourseAuthorityBinding): void | Promise<void>;
  /**
   * Compensate only a retained binding created by this exact in-process command.
   * This is not a historical binding mutation API.
   */
  rollbackPending(pending: PendingFormalCourseAuthorityBinding): void | Promise<void>;
  removeUncommitted(pending: PendingFormalCourseAuthorityBinding): void | Promise<void>;
  getForCourse(
    tenantId: string,
    courseId: string
  ): FormalCourseAuthorityBinding | null | Promise<FormalCourseAuthorityBinding | null>;
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
export class FormalCourseAuthorityBindingStore implements FormalCourseAuthorityBindingPort {
  private readonly pending = new Map<
    symbol,
    {
      course_id: string;
      tenant_id: string;
      retain_for_compensation: boolean;
      status: "pending" | "committed";
    }
  >();

  constructor(private readonly store: SimWarStore) {}

  append(binding: FormalCourseAuthorityBinding): void {
    this.appendInternal(binding);
  }

  appendPending(
    binding: FormalCourseAuthorityBinding,
    options: FormalCourseAuthorityBindingPendingOptions = {}
  ): PendingFormalCourseAuthorityBinding {
    this.appendInternal(binding);
    const token = Symbol("formal-course-authority-binding-pending");
    this.pending.set(token, {
      course_id: binding.course_id,
      tenant_id: binding.tenant_id,
      retain_for_compensation: options.retain_for_compensation === true,
      status: "pending"
    });
    return Object.freeze({ course_id: binding.course_id, tenant_id: binding.tenant_id, token });
  }

  commitPending(pending: PendingFormalCourseAuthorityBinding): void {
    const current = this.requirePending(pending, "pending");
    if (current.retain_for_compensation) {
      current.status = "committed";
      return;
    }
    this.pending.delete(pending.token);
  }

  finalizePending(pending: PendingFormalCourseAuthorityBinding): void {
    const current = this.requirePending(pending, "committed");
    if (!current.retain_for_compensation)
      throw new Error("formal_course_authority_binding_pending_finalize_invalid");
    this.pending.delete(pending.token);
  }

  rollbackPending(pending: PendingFormalCourseAuthorityBinding): void {
    const current = this.requirePending(pending);
    if (!current.retain_for_compensation)
      throw new Error("formal_course_authority_binding_pending_rollback_invalid");
    this.removeBinding(pending);
    this.pending.delete(pending.token);
  }

  removeUncommitted(pending: PendingFormalCourseAuthorityBinding): void {
    this.requirePending(pending, "pending");
    this.removeBinding(pending);
    this.pending.delete(pending.token);
  }

  private removeBinding(pending: PendingFormalCourseAuthorityBinding): void {
    const index = this.store.formalCourseAuthorityBindings.findIndex(
      (candidate) =>
        candidate.tenant_id === pending.tenant_id && candidate.course_id === pending.course_id
    );
    if (index < 0) {
      throw new Error("formal_course_authority_binding_pending_missing");
    }
    this.store.formalCourseAuthorityBindings.splice(index, 1);
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

  private requirePending(
    pending: PendingFormalCourseAuthorityBinding,
    expectedStatus?: "pending" | "committed"
  ): {
    course_id: string;
    tenant_id: string;
    retain_for_compensation: boolean;
    status: "pending" | "committed";
  } {
    const current = this.pending.get(pending.token);
    if (
      !current ||
      current.course_id !== pending.course_id ||
      current.tenant_id !== pending.tenant_id ||
      (expectedStatus !== undefined && current.status !== expectedStatus)
    ) {
      throw new Error("formal_course_authority_binding_pending_invalid");
    }
    return current;
  }
}
