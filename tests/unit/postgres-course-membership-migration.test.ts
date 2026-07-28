import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

describe("course membership migration", () => {
  it("adds a forward-only tenant-scoped membership read model", async () => {
    const name = "0003_add_course_memberships.sql";
    const sql = await readFile(join("db/migrations", name), "utf8");
    const normalized = normalizeSql(sql);

    expect(
      name.localeCompare("0002_add_settlement_business_identity_constraint.sql")
    ).toBeGreaterThan(0);
    expect(normalized).toContain("CREATE TABLE course_memberships");
    expect(normalized).toContain("PRIMARY KEY (tenant_id, course_id, user_id)");
    expect(normalized).toContain(
      "FOREIGN KEY (tenant_id, course_id) REFERENCES courses (tenant_id, course_id)"
    );
    expect(normalized).toContain(
      "FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, user_id)"
    );
    expect(normalized).toContain("course_memberships_tenant_user_course_idx");
    expect(normalized).not.toMatch(/\bDELETE\b/i);
    expect(normalized).not.toMatch(/\bUPDATE\b/i);
    expect(normalized).not.toMatch(/\bCREATE\s+TRIGGER\b/i);
  });
});
