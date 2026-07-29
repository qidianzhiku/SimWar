import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCourseBlueprintReference } from "../../packages/shared-contracts/src";
import {
  calculateCourseBlueprintBindingDigest,
  createCourseBlueprintBinding
} from "../../services/api/src/course-blueprint-binding";
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

  it("fails closed when persisted bindings are corrupt or duplicated", () => {
    const valid = createCourseBlueprintBinding({
      binding_schema_version: "course-blueprint-binding.v1",
      course_blueprint_reference: createCourseBlueprintReference({
        content_digest: "b".repeat(64),
        course_blueprint_id: "blueprint_corrupt",
        tenant_id: "tenant_demo",
        version: "1.0.0"
      }),
      course_id: "course_corrupt",
      tenant_id: "tenant_demo"
    });
    const corrupted = {
      ...valid,
      binding_digest: "f".repeat(64)
    };

    const directory = mkdtempSync(join(tmpdir(), "simwar-course-blueprint-binding-"));
    const snapshotPath = join(directory, "store.json");
    try {
      createP1Store({ persistenceFile: snapshotPath });
      const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as Record<string, unknown>;
      snapshot.courseBlueprintBindings = [corrupted];
      writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
      expect(() => createP1Store({ persistenceFile: snapshotPath })).toThrow("store_snapshot_corrupted");

      const crossTenantInput = {
        binding_schema_version: valid.binding_schema_version,
        course_blueprint_reference: {
          ...valid.course_blueprint_reference,
          tenant_id: "tenant_other"
        },
        course_id: valid.course_id,
        tenant_id: valid.tenant_id
      };
      snapshot.courseBlueprintBindings = [{
        ...crossTenantInput,
        binding_digest: calculateCourseBlueprintBindingDigest(crossTenantInput)
      }];
      writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
      expect(() => createP1Store({ persistenceFile: snapshotPath })).toThrow("store_snapshot_corrupted");

      snapshot.courseBlueprintBindings = [valid, structuredClone(valid)];
      writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
      expect(() => createP1Store({ persistenceFile: snapshotPath })).toThrow("store_snapshot_corrupted");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
