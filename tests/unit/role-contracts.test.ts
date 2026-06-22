import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES,
  DEFAULT_STUDENT_ROLE_TEMPLATES,
  isRoleContext,
  isRoleId,
  isRolePermissionPolicy,
  isRoleTemplate,
  isStudentRoleAssignment
} from "../../packages/shared-contracts/src";

const fixture = <T>(name: string): T =>
  JSON.parse(readFileSync(resolve("contracts/fixtures", name), "utf8")) as T;

const schema = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(resolve("contracts/schemas", name), "utf8")) as Record<string, unknown>;

function roleEnum(name: string): string[] {
  const document = schema(name);
  const properties = document.properties as Record<string, Record<string, unknown>>;
  const roleProperty = properties.role_key;

  if (!Array.isArray(roleProperty.enum)) {
    throw new Error(`${name} does not define role_key enum`);
  }

  return roleProperty.enum as string[];
}

describe("student role context and assignment contracts", () => {
  it("defines RoleId as the four approved P2-002 MVP roles", () => {
    expect(["CEO", "CFO", "CMO", "COO"].every((roleId) => isRoleId(roleId))).toBe(true);
    expect(isRoleId("risk")).toBe(false);
  });

  it("defines default role templates and action policies for the four approved MVP roles", () => {
    const roleKeys = DEFAULT_STUDENT_ROLE_TEMPLATES.map((template) => template.role_key);

    expect(roleKeys).toEqual(["CEO", "CFO", "CMO", "COO"]);
    expect(Object.keys(DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES).sort()).toEqual([
      "CEO",
      "CFO",
      "CMO",
      "COO"
    ]);

    expect(DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES.CEO.can_create_merge_commit).toBe(true);
    expect(DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES.CEO.can_submit_canonical_decision).toBe(true);
    expect(DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES.CFO.can_save_section).toBe(true);
    expect(DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES.CFO.can_create_merge_commit).toBe(false);
    expect(DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES.CFO.can_submit_canonical_decision).toBe(false);
    expect(DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES.CMO.can_save_section).toBe(true);
    expect(DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES.CMO.can_submit_canonical_decision).toBe(false);
    expect(DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES.COO.can_save_section).toBe(true);
    expect(DEFAULT_STUDENT_ROLE_PERMISSION_POLICIES.COO.can_submit_canonical_decision).toBe(false);
  });

  it("accepts valid role contract fixtures through type guards", () => {
    expect(isStudentRoleAssignment(fixture("student-role-assignment.valid.json"))).toBe(true);
    expect(isRoleContext(fixture("role-context.valid.json"))).toBe(true);
    expect(isRolePermissionPolicy(fixture("role-permission-policy.valid.json"))).toBe(true);
    expect(isRoleTemplate(fixture("role-template.valid.json"))).toBe(true);
  });

  it("rejects role context contracts that attempt to grant truth-field edit access", () => {
    const context = fixture<Record<string, unknown>>("role-context.valid.json");
    const permissions = context.permissions as Record<string, unknown>;

    expect(
      isRoleContext({
        ...context,
        permissions: {
          ...permissions,
          editable_fields: ["state_true"]
        }
      })
    ).toBe(false);
  });

  it("keeps role contract schemas strict and versioned", () => {
    for (const name of [
      "student-role-assignment.v1.json",
      "role-context.v1.json",
      "role-permission-policy.v1.json",
      "role-template.v1.json"
    ]) {
      expect(schema(name)).toMatchObject({
        type: "object",
        additionalProperties: false
      });
    }
  });

  it("keeps risk outside the P2-002 assignable role schemas", () => {
    for (const name of [
      "student-role-assignment.v1.json",
      "role-context.v1.json",
      "role-permission-policy.v1.json",
      "role-template.v1.json"
    ]) {
      expect(roleEnum(name)).toEqual(["CEO", "CFO", "CMO", "COO"]);
      expect(roleEnum(name)).not.toContain("risk");
    }
  });
});
