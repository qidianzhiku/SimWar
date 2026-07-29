import { createHash } from "node:crypto";
import type { CourseBlueprintReference } from "@simwar/shared-contracts";

export interface CourseBlueprintBinding {
  binding_digest: string;
  binding_schema_version: "course-blueprint-binding.v1";
  course_blueprint_reference: CourseBlueprintReference;
  course_id: string;
  tenant_id: string;
}

export function createCourseBlueprintBinding(input: Omit<CourseBlueprintBinding, "binding_digest">): CourseBlueprintBinding {
  if (input.tenant_id !== input.course_blueprint_reference.tenant_id || !input.course_id.trim()) {
    throw new Error("course_blueprint_binding_invalid");
  }
  const canonical = JSON.stringify({
    binding_schema_version: input.binding_schema_version,
    course_blueprint_reference: input.course_blueprint_reference,
    course_id: input.course_id,
    tenant_id: input.tenant_id
  });
  return Object.freeze({
    ...input,
    binding_digest: createHash("sha256").update(canonical, "utf8").digest("hex")
  });
}
