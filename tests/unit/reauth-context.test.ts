import { describe, expect, it } from "vitest";
import {
  isSameReauthBusinessContext,
  isSameReauthPrincipal,
  parseReauthContext,
  validateReauthIdentity,
  type ReauthContext
} from "../../packages/shared-contracts/src/reauth-context";

const context: ReauthContext = {
  schema_version: 1,
  tenant_id: "tenant_demo",
  user_id: "teacher",
  role: "teacher",
  course_id: "course_demo",
  run_id: "run_001",
  team_id: "team_role_workflow_browser_0",
  round_id: "round_001",
  round_no: 1,
  route: "/",
  view: "role-workflow-monitor"
};

describe("reauth exact-context contract", () => {
  it("parses only the safe non-secret context payload", () => {
    expect(parseReauthContext(JSON.stringify(context))).toEqual(context);
    expect(parseReauthContext(JSON.stringify({ ...context, access_token: "secret" }))).toBeNull();
    expect(parseReauthContext("not-json")).toBeNull();
  });

  it("allows the same tenant, user and role to restore exact context", () => {
    expect(
      validateReauthIdentity(context, {
        tenant_id: "tenant_demo",
        user_id: "teacher",
        roles: ["teacher"]
      })
    ).toEqual({ status: "RESTORE_ALLOWED" });
  });

  it("distinguishes explicit same-tenant identity switches from reauth recovery", () => {
    expect(
      isSameReauthPrincipal(context, {
        tenant_id: "tenant_demo",
        user_id: "teacher",
        roles: ["teacher"]
      })
    ).toBe(true);
    expect(
      isSameReauthPrincipal(context, {
        tenant_id: "tenant_demo",
        user_id: "another-user",
        roles: ["learner"]
      })
    ).toBe(false);
    expect(
      isSameReauthPrincipal(context, {
        tenant_id: "tenant_other",
        user_id: "teacher",
        roles: ["teacher"]
      })
    ).toBe(false);
  });

  it("blocks cross-tenant and cross-role restoration", () => {
    expect(
      validateReauthIdentity(context, {
        tenant_id: "tenant_other",
        user_id: "teacher",
        roles: ["teacher"]
      })
    ).toEqual({ status: "CONTEXT_UNAUTHORIZED", reason: "TENANT_MISMATCH" });
    expect(
      validateReauthIdentity(context, {
        tenant_id: "tenant_demo",
        user_id: "role_ceo_browser_0",
        roles: ["learner", "student"]
      })
    ).toEqual({ status: "CONTEXT_UNAUTHORIZED", reason: "USER_OR_ROLE_MISMATCH" });

    const roleSlotIdentity = {
      tenant_id: "tenant_demo",
      user_id: "student_ceo",
      roles: ["learner"],
      role_slots: ["CFO"]
    } as Parameters<typeof validateReauthIdentity>[1];
    expect(
      validateReauthIdentity({ ...context, user_id: "student_ceo", role: "CEO" }, roleSlotIdentity)
    ).toEqual({ status: "CONTEXT_UNAUTHORIZED", reason: "USER_OR_ROLE_MISMATCH" });
  });

  it("requires every business context component to match", () => {
    expect(
      isSameReauthBusinessContext(context, {
        course_id: "course_demo",
        run_id: "run_001",
        team_id: "team_role_workflow_browser_0",
        round_id: "round_001",
        round_no: 1
      })
    ).toBe(true);
    expect(
      isSameReauthBusinessContext(context, {
        course_id: "course_demo",
        run_id: "run_001",
        team_id: "team_alpha",
        round_id: "round_001",
        round_no: 1
      })
    ).toBe(false);
    expect(
      isSameReauthBusinessContext(context, {
        course_id: "course_other",
        run_id: "run_001",
        team_id: "team_role_workflow_browser_0",
        round_id: "round_001",
        round_no: 1
      })
    ).toBe(false);
    expect(
      isSameReauthBusinessContext(context, {
        course_id: "course_demo",
        run_id: "run_001",
        team_id: "team_role_workflow_browser_0",
        round_id: "round_other",
        round_no: 1
      })
    ).toBe(false);
  });
});
