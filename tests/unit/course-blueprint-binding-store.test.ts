import { describe, expect, it } from "vitest";
import { createCourseBlueprintReference } from "../../packages/shared-contracts/src";
import { createCourseBlueprintBinding } from "../../services/api/src/course-blueprint-binding";
import { CourseBlueprintBindingStore } from "../../services/api/src/course-blueprint-binding-store";
import { createP1Store } from "../../services/api/src/store";

describe("CourseBlueprintBindingStore", () => {
  it("records an exact immutable reference without changing the Course or B5 binding collections", () => {
    const store = createP1Store();
    const bindings = new CourseBlueprintBindingStore(store);
    const reference = createCourseBlueprintReference({
      content_digest: "a".repeat(64),
      course_blueprint_id: "blueprint_001",
      tenant_id: "tenant_demo",
      version: "1.0.0"
    });
    const binding = createCourseBlueprintBinding({
      binding_schema_version: "course-blueprint-binding.v1",
      course_blueprint_reference: reference,
      course_id: "course_001",
      tenant_id: "tenant_demo"
    });
    bindings.append(binding);
    expect(bindings.getForCourse("tenant_demo", "course_001")).toEqual(binding);
    expect(store.formalCourseAuthorityBindings).toEqual([]);
    expect(store.courses).toHaveLength(1);
    expect(() => bindings.append(binding)).toThrow("course_blueprint_binding_already_exists");
  });
});
