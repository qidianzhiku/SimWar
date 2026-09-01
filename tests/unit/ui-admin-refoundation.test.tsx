/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { App } from "../../apps/admin/src/App";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
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
      ["admin-environment-recovery", "环境启动与恢复"],
      ["admin-enterprise-course-factory", "企业课程工厂与 Sponsor 投影"]
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

  it("keeps platform-admin recovery actionable through the existing CoursePackageVersion path", async () => {
    const session = {
      access_token: "platform-token",
      session_id: "session-platform",
      user: {
        display_name: "Platform Admin",
        roles: ["platform_admin"],
        tenant_id: "platform",
        user_id: "platform-admin"
      }
    };
    const platformAuthority = {
      actor_role: "platform_admin",
      platform_authority: true,
      required_scope: "platform",
      visible_state: { tenant_count: 0, tenant_ids: [] }
    };
    const response = (ok: boolean, data: unknown): Response =>
      ({
        ok,
        status: ok ? 200 : 403,
        json: async () => (ok ? { data } : { code: "ADMIN_REQUEST_FORBIDDEN", message: "failed" })
      }) as Response;
    let coursePackageRequests = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/login")) return response(true, session);
      if (url.includes("/api/v1/bff/admin/platform-authority")) {
        return response(true, platformAuthority);
      }
      if (url.includes("/api/v1/admin/course-package-versions")) {
        coursePackageRequests += 1;
        return response(true, { course_package_versions: [] });
      }
      return response(false, null);
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<App />));

    const setInputValue = (label: string, value: string) => {
      const input = [...container.querySelectorAll("input")].find(
        (candidate) => candidate.getAttribute("aria-label") === label
      );
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(input, value);
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    };
    await act(async () => {
      setInputValue("tenant", "platform");
      setInputValue("username", "platform-admin");
      setInputValue("password", "password-a");
    });
    const loginButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("管理员登录")
    );
    expect(loginButton).toBeDefined();
    await act(async () => {
      loginButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await act(async () => {
      await vi.waitFor(() => expect(coursePackageRequests).toBeGreaterThan(0));
    });

    const initialCoursePackageRequests = coursePackageRequests;
    const recoveryButton = container.querySelector<HTMLButtonElement>(
      '[data-recovery-role="admin"] [data-action="recovery:refresh"]'
    );
    expect(recoveryButton).not.toBeNull();
    await act(async () => {
      recoveryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await act(async () => {
      await vi.waitFor(() => expect(coursePackageRequests).toBeGreaterThan(initialCoursePackageRequests));
    });

    act(() => root.unmount());
    container.remove();
    fetchMock.mockRestore();
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

  it("rejects delayed Admin responses when tenant, session, or login epoch changes", async () => {
    const { isAdminRequestCurrent } = await import("../../apps/admin/src/App");
    const current = {
      accessToken: "token-new",
      epoch: 2,
      sessionId: "admin-new",
      tenantId: "tenant-new",
      username: "admin-new"
    };

    expect(
      isAdminRequestCurrent(
        {
          accessToken: "token-old",
          epoch: 1,
          sessionId: "admin-old",
          tenantId: "tenant-old",
          username: "admin-old"
        },
        current
      )
    ).toBe(false);
    expect(isAdminRequestCurrent(current, current)).toBe(true);
    for (const key of ["epoch", "sessionId", "tenantId", "username", "accessToken"] as const) {
      expect(
        isAdminRequestCurrent(current, {
          ...current,
          [key]: key === "epoch" ? current.epoch + 1 : `${current[key]}-changed`
        })
      ).toBe(false);
    }
  });

  it("requires an explicit course before rendering the W5 tenant audit surface", async () => {
    const { getW5AuditCourseId } = await import("../../apps/admin/src/App");

    expect(getW5AuditCourseId("")).toBeNull();
    expect(getW5AuditCourseId("   ")).toBeNull();
    expect(getW5AuditCourseId("course_demo")).toBe("course_demo");
  });

  it("maps Admin identity and CoursePackage failures to Chinese primary copy", async () => {
    const { coursePackageStatusLabel, getAdminVisibleErrorMessage } =
      await import("../../apps/admin/src/App");

    expect(coursePackageStatusLabel("DIGEST_MISMATCH", "import")).toBe("导入失败：摘要不匹配");
    expect(coursePackageStatusLabel("PERMISSION_DENIED", "export")).toBe("当前会话无权执行此操作");
    expect(getAdminVisibleErrorMessage(new Error("AUTH_INVALID_CREDENTIALS: bad password"))).toBe(
      "登录失败，请检查租户、用户名和密码。"
    );
    expect(getAdminVisibleErrorMessage(new Error("raw upstream English failure"))).toBe(
      "请求暂时无法完成，请稍后重试。"
    );
  });

  it("renders the Admin D5 adapter with Chinese boundary and safe upstream-error mapping", async () => {
    const { D5ExportWorkbench, getAdminD5ErrorMessage } =
      await import("../../apps/admin/src/D5ExportWorkbench");
    const markup = renderToStaticMarkup(
      <D5ExportWorkbench apiBase="http://api.test" tenantId="tenant_demo" token="token_demo" />
    );
    expect(markup).toContain("仅限租户范围的导出");
    expect(markup).not.toContain("Tenant-safe export only");
    expect(getAdminD5ErrorMessage(new Error("AUTH-403: English upstream failure"), "load")).toBe(
      "当前会话无权加载 D5 导出数据。"
    );
    expect(
      getAdminD5ErrorMessage(new Error("AUTH-403: English upstream failure"), "operation")
    ).toBe("当前会话无权执行 D5 导出操作。");
    expect(
      getAdminD5ErrorMessage(new Error("English upstream failure"), "operation")
    ).not.toContain("English upstream failure");
  });
});
