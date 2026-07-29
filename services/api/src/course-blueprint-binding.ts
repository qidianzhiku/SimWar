import { createHash } from "node:crypto";
import type { CourseBlueprintReference } from "@simwar/shared-contracts";

export interface CourseBlueprintBinding {
  binding_digest: string;
  binding_schema_version: "course-blueprint-binding.v1";
  course_blueprint_reference: CourseBlueprintReference;
  course_id: string;
  tenant_id: string;
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

export function calculateCourseBlueprintBindingDigest(
  input: Omit<CourseBlueprintBinding, "binding_digest">
): string {
  const canonical = JSON.stringify({
    binding_schema_version: input.binding_schema_version,
    course_blueprint_reference: {
      content_digest: input.course_blueprint_reference.content_digest,
      course_blueprint_id: input.course_blueprint_reference.course_blueprint_id,
      tenant_id: input.course_blueprint_reference.tenant_id,
      version: input.course_blueprint_reference.version
    },
    course_id: input.course_id,
    tenant_id: input.tenant_id
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function createCourseBlueprintBinding(input: Omit<CourseBlueprintBinding, "binding_digest">): CourseBlueprintBinding {
  if (input.tenant_id !== input.course_blueprint_reference.tenant_id || !input.course_id.trim()) {
    throw new Error("course_blueprint_binding_invalid");
  }
  return deepFreeze({
    ...clone(input),
    binding_digest: calculateCourseBlueprintBindingDigest(input)
  });
}

export function assertValidCourseBlueprintBinding(binding: CourseBlueprintBinding): void {
  const { binding_digest, ...input } = binding;
  if (
    binding.binding_schema_version !== "course-blueprint-binding.v1" ||
    !/^[a-f0-9]{64}$/.test(binding_digest) ||
    calculateCourseBlueprintBindingDigest(input) !== binding_digest
  ) {
    throw new Error("course_blueprint_binding_invalid");
  }
}
