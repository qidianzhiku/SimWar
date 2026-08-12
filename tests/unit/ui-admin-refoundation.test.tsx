import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  AdminDeliveryTrustWorkspace,
  AdminEnvironmentRecoveryLimit,
  AdminLifecycleOperationButton,
  formatLifecycleBlockedReasons
} from "../../apps/admin/src/AdminDeliveryTrustWorkspace";

describe("Admin Delivery & Trust workspace", () => {
  it("exposes every required task location with accessible Simplified Chinese names", () => {
    const markup = renderToStaticMarkup(
      <AdminDeliveryTrustWorkspace
        context={{ tenant: "tenant_demo", role: "租户管理员" }}
        authority="official"
        activeHash="#admin-delivery-overview"
      >
        <section id="admin-delivery-overview">
          <h2>交付总览</h2>
        </section>
      </AdminDeliveryTrustWorkspace>
    );

    const expectedNavigation = [
      ["admin-delivery-overview", "交付总览"],
      ["admin-tenants-entitlements", "租户与权益"],
      ["admin-users-roles", "用户、角色与范围"],
      ["admin-assets", "课程、场景与模型资产"],
      ["admin-security-projection", "权限与安全投影"],
      ["admin-audit-receipts", "审计与回执"],
      ["admin-runtime-support", "运行与支持"],
      ["admin-known-limits", "已知限制与信任边界"],
      ["admin-environment-recovery", "环境启动与恢复"]
    ] as const;

    for (const [id, label] of expectedNavigation) {
      expect(markup).toContain(`href="#${id}"`);
      expect(markup).toContain(label);
    }
    expect(markup).toContain('aria-label="角色导航"');
    expect(markup).toContain('aria-current="page"');
  });

  it("renders only supplied server context without inventing tenant or run values", () => {
    const markup = renderToStaticMarkup(
      <AdminDeliveryTrustWorkspace context={{ tenant: "华东试点", role: "平台管理员" }}>
        <p>当前工作区</p>
      </AdminDeliveryTrustWorkspace>
    );

    expect(markup).toContain("华东试点");
    expect(markup).toContain("平台管理员");
    expect(markup).not.toContain("默认租户");
    expect(markup).not.toContain("tenant_demo");
    expect(markup).not.toContain("session-001");
    expect(markup).not.toContain("run-001");
    expect(markup).not.toContain("round-1");
    expect(markup).not.toContain("team-001");
  });

  it("keeps lifecycle operations absent from allowed_operations disabled with a visible Chinese reason", () => {
    const markup = renderToStaticMarkup(
      <AdminLifecycleOperationButton
        action="abort"
        allowedActions={[]}
        disabledReason="服务端未授权此操作"
        onClick={vi.fn()}
      >
        中止运行
      </AdminLifecycleOperationButton>
    );

    expect(markup).toContain('data-action="abort"');
    expect(markup).toContain("disabled");
    expect(markup).toContain("服务端未授权此操作");
    expect(markup).toContain("中止运行");
  });

  it("uses the shared loading reason for an authorized lifecycle action", () => {
    const markup = renderToStaticMarkup(
      <AdminLifecycleOperationButton
        action="abort"
        allowedActions={["abort"]}
        loading
        disabledReason="服务端未授权此操作"
        onClick={vi.fn()}
      >
        中止运行
      </AdminLifecycleOperationButton>
    );

    expect(markup).toContain("处理中…");
    expect(markup).toContain("正在处理中");
    expect(markup).not.toContain("服务端未授权此操作");
  });

  it("renders W025 environment recovery as a closed Known Limit without a W025 request surface", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const markup = renderToStaticMarkup(<AdminEnvironmentRecoveryLimit />);

    expect(markup).toContain("W025");
    expect(markup).toContain("已知限制");
    expect(markup).toContain("环境启动与恢复");
    expect(markup).not.toMatch(/href="[^"]*W025/i);
    expect(markup).not.toContain("启动环境");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("gives navigation and primary actions keyboard-sized, named targets", () => {
    const markup = renderToStaticMarkup(
      <AdminDeliveryTrustWorkspace
        context={{ tenant: "tenant_demo", role: "租户管理员" }}
        primaryAction={<button type="button">重新加载</button>}
      >
        <button type="button">保存</button>
      </AdminDeliveryTrustWorkspace>
    );

    expect(markup).toContain("重新加载");
    expect(markup).toContain("保存");
    expect(markup).toContain("跳转到主要内容");
    const namedTargets = [...markup.matchAll(/<a href="(#[^"]+)"[^>]*>([^<]+)<\/a>/g)];
    expect(namedTargets).toHaveLength(9);
    for (const [, href, name] of namedTargets) {
      expect(href).toMatch(/^#admin-[a-z-]+$/);
      expect(name.trim()).not.toBe("");
    }
  });

  it("maps every current lifecycle block code to a deterministic Chinese explanation", () => {
    const expected: Record<string, string> = {
      not_synthetic_json_internal: "运行不是受支持的内部 JSON synthetic 运行",
      run_not_active: "运行当前不处于活动状态",
      settlement_or_replay_state_present: "运行已有结算或回放状态",
      published_state_present: "运行已有已发布结果",
      run_cleaned: "运行已完成清理"
    };

    expect(formatLifecycleBlockedReasons(Object.keys(expected))).toBe(
      Object.values(expected).join("；")
    );
    expect(formatLifecycleBlockedReasons(["unknown_server_reason"])).toBe(
      "服务端提供了未识别的限制原因"
    );
    expect(formatLifecycleBlockedReasons(["unknown_server_reason"])).not.toContain(
      "unknown_server_reason"
    );
  });
});
