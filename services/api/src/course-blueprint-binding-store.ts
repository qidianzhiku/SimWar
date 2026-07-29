import type { CourseBlueprintBinding } from "./course-blueprint-binding.js";
import type { SimWarStore } from "./store.js";

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function freeze<T>(value: T): T { Object.freeze(value); return value; }

/** Private append-only recorder. It deliberately never writes Course or B5 bindings. */
export class CourseBlueprintBindingStore {
  constructor(private readonly store: SimWarStore) {}

  append(binding: CourseBlueprintBinding): void {
    if (this.store.courseBlueprintBindings.some((item) => item.tenant_id === binding.tenant_id && item.course_id === binding.course_id)) {
      throw new Error("course_blueprint_binding_already_exists");
    }
    this.store.courseBlueprintBindings.push(freeze(clone(binding)));
  }

  getForCourse(tenantId: string, courseId: string): CourseBlueprintBinding | null {
    const item = this.store.courseBlueprintBindings.find((candidate) => candidate.tenant_id === tenantId && candidate.course_id === courseId);
    return item ? freeze(clone(item)) : null;
  }

  /** Only compensation for an uncommitted failed Course creation; never used for history mutation. */
  removeUncommitted(tenantId: string, courseId: string): void {
    const index = this.store.courseBlueprintBindings.findIndex((item) => item.tenant_id === tenantId && item.course_id === courseId);
    if (index >= 0) this.store.courseBlueprintBindings.splice(index, 1);
  }
}
