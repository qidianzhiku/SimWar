import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  EnterpriseCourseFactoryWorkspace,
  enterpriseCourseFactoryCapabilities
} from "../../apps/admin/src/EnterpriseCourseFactoryWorkspace";
import { ADMIN_NAVIGATION_ITEMS } from "../../apps/admin/src/AdminDeliveryTrustWorkspace";

describe("Enterprise Course Factory workspace", () => {
  it("advertises a stable Admin anchor and the eight closed capabilities", () => {
    const markup = renderToStaticMarkup(<EnterpriseCourseFactoryWorkspace scope="tenant" />);

    expect(markup).toContain('id="admin-enterprise-course-factory"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain("企业课程工厂与 Sponsor 投影");
    expect(markup).toContain("企业课程工厂整体状态</dt><dd>状态：关闭（只读、已知限制）");
    expect(enterpriseCourseFactoryCapabilities).toHaveLength(8);
    for (const capability of enterpriseCourseFactoryCapabilities) {
      expect(markup).toContain(capability.title);
      expect(markup).toContain("状态：关闭");
      expect(markup).toContain("当前限制");
      expect(markup).toContain("不受影响");
      expect(markup).toContain("尚未证明");
      expect(markup).toContain("范围");
    }
  });

  it("states the current Admin host and keeps supported anchors truthful", () => {
    const tenantMarkup = renderToStaticMarkup(<EnterpriseCourseFactoryWorkspace scope="tenant" />);
    const platformMarkup = renderToStaticMarkup(
      <EnterpriseCourseFactoryWorkspace scope="platform" />
    );

    expect(tenantMarkup).toContain("租户范围");
    expect(platformMarkup).toContain("平台范围");
    expect(tenantMarkup).toContain("没有独立 Enterprise app、BFF 或权威来源");
    expect(tenantMarkup).toContain("Admin 外层“正式”标识仅表示当前管理员会话");
    expect(tenantMarkup).toContain('href="#admin-assets"');
    expect(tenantMarkup).toContain('href="#admin-runtime-support"');
    expect(tenantMarkup).toContain('href="#admin-audit-receipts"');
    expect(tenantMarkup).toContain("CoursePackageVersion");
    expect(tenantMarkup).toContain("不可变教学与配置快照");
    expect(tenantMarkup).not.toContain("<button");
    expect(tenantMarkup).not.toContain("AllowedActionButton");
    expect(tenantMarkup).not.toMatch(/state_true|replay_hash|score|rank|other_tenant_data/i);
    expect(tenantMarkup).not.toMatch(/fetch\(|\/api\/|\/internal\/v1/);
  });

  it("adds the Enterprise anchor only to advertised Admin navigation", () => {
    expect(ADMIN_NAVIGATION_ITEMS).toContainEqual({
      id: "admin-enterprise-course-factory",
      label: "企业课程工厂与 Sponsor 投影"
    });
  });
});
