import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  CrossRoleRecoveryRail,
  getRecoveryStateCopy,
  type RecoveryStatus
} from "@simwar/ui/cross-role-recovery-rail";

describe("R3 cross-role recovery rail", () => {
  it.each([
    ["signed-out", "需要登录", "signed-out"],
    ["loading", "正在同步", "loading"],
    ["ready", "上下文已同步", "ready"],
    ["stale", "上下文已陈旧", "stale"],
    ["reauth-required", "需要重新验证", "reauth-required"],
    ["conflict", "存在恢复冲突", "conflict"],
    ["rollback-available", "可以回滚", "rollback-available"],
    ["error", "恢复失败", "error"]
  ] as const)("maps %s to a visible non-color state cue", (status, label, technical) => {
    const copy = getRecoveryStateCopy(status as RecoveryStatus);

    expect(copy.primary).toBe(label);
    expect(copy.technical).toBe(technical);
    expect(copy.cue).toBeTruthy();
  });

  it("renders exact supplied context and recovery affordances with semantic state", () => {
    const onRecover = vi.fn();
    const markup = renderToStaticMarkup(
      <CrossRoleRecoveryRail
        role="teacher"
        status="stale"
        contextEntries={[
          { label: "租户", value: "tenant_demo" },
          { label: "课程", value: "course_demo" },
          { label: "回合", value: "round-2" }
        ]}
        onRecover={onRecover}
      />
    );

    expect(markup).toContain('data-recovery-status="stale"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("上下文已陈旧");
    expect(markup).toContain("状态：陈旧");
    expect(markup).toContain("tenant_demo");
    expect(markup).toContain("course_demo");
    expect(markup).toContain("round-2");
    expect(markup).toContain('data-action="recovery:refresh"');
    expect(markup).toContain("刷新并恢复当前上下文");
    expect(markup).not.toContain("仅靠颜色");
  });

  it("uses distinct recovery actions for reauthentication, conflict, and rollback", () => {
    const cases: Array<[RecoveryStatus, string, string]> = [
      ["reauth-required", "recovery:reauthenticate", "重新验证身份"],
      ["conflict", "recovery:resolve-conflict", "查看冲突并恢复"],
      ["rollback-available", "recovery:rollback", "回滚到最近可用快照"]
    ];

    for (const [status, action, label] of cases) {
      const markup = renderToStaticMarkup(
        <CrossRoleRecoveryRail
          role="student"
          status={status}
          contextEntries={[{ label: "租户", value: "tenant_demo" }]}
          onReauthenticate={vi.fn()}
          onResolveConflict={vi.fn()}
          onRollback={vi.fn()}
        />
      );

      expect(markup).toContain(`data-action="${action}"`);
      expect(markup).toContain(label);
    }
  });
});
