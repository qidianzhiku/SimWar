import {
  assertValidCourseBlueprintBinding,
  type CourseBlueprintBinding
} from "./course-blueprint-binding.js";
import type { SimWarStore } from "./store.js";

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((child) => freeze(child));
    Object.freeze(value);
  }
  return value;
}

export interface PendingCourseBlueprintBinding {
  readonly course_id: string;
  readonly tenant_id: string;
  readonly token: symbol;
}

/** Private append-only recorder. It deliberately never writes Course or B5 bindings. */
export class CourseBlueprintBindingStore {
  private readonly pending = new Map<symbol, { course_id: string; tenant_id: string }>();
  constructor(private readonly store: SimWarStore) {}

  append(binding: CourseBlueprintBinding): void {
    this.appendInternal(binding);
  }

  appendPending(binding: CourseBlueprintBinding): PendingCourseBlueprintBinding {
    this.appendInternal(binding);
    const token = Symbol("course-blueprint-binding-pending");
    this.pending.set(token, { course_id: binding.course_id, tenant_id: binding.tenant_id });
    return Object.freeze({ course_id: binding.course_id, tenant_id: binding.tenant_id, token });
  }

  commitPending(pending: PendingCourseBlueprintBinding): void {
    this.requirePending(pending);
    this.pending.delete(pending.token);
  }

  private appendInternal(binding: CourseBlueprintBinding): void {
    assertValidCourseBlueprintBinding(binding);
    if (this.store.courseBlueprintBindings.some((item) => item.tenant_id === binding.tenant_id && item.course_id === binding.course_id)) {
      throw new Error("course_blueprint_binding_already_exists");
    }
    this.store.courseBlueprintBindings.push(freeze(clone(binding)));
    try {
      this.store.persist();
    } catch (error) {
      this.store.courseBlueprintBindings.pop();
      throw error;
    }
  }

  getForCourse(tenantId: string, courseId: string): CourseBlueprintBinding | null {
    const item = this.store.courseBlueprintBindings.find((candidate) => candidate.tenant_id === tenantId && candidate.course_id === courseId);
    return item ? freeze(clone(item)) : null;
  }

  /** Only compensation for this process's uncommitted Course creation; never a history mutation API. */
  removeUncommitted(pending: PendingCourseBlueprintBinding): void {
    this.requirePending(pending);
    const index = this.store.courseBlueprintBindings.findIndex((item) =>
      item.tenant_id === pending.tenant_id && item.course_id === pending.course_id
    );
    if (index < 0) throw new Error("course_blueprint_binding_pending_missing");
    const [removed] = this.store.courseBlueprintBindings.splice(index, 1);
    try {
      this.store.persist();
      this.pending.delete(pending.token);
    } catch (error) {
      this.store.courseBlueprintBindings.splice(index, 0, removed!);
      throw error;
    }
  }

  private requirePending(pending: PendingCourseBlueprintBinding): void {
    const current = this.pending.get(pending.token);
    if (!current || current.course_id !== pending.course_id || current.tenant_id !== pending.tenant_id) {
      throw new Error("course_blueprint_binding_pending_invalid");
    }
  }
}
