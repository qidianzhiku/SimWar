import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  EnterpriseCourseFactoryWorkspace,
  enterpriseCourseFactoryCapabilities
} from "../../apps/admin/src/EnterpriseCourseFactoryWorkspace";
import { ADMIN_NAVIGATION_ITEMS } from "../../apps/admin/src/AdminDeliveryTrustWorkspace";

describe("Enterprise Course Factory workspace", () => {
  it("advertises a stable Admin anchor and the eight governed capability boundaries", () => {
    const markup = renderToStaticMarkup(<EnterpriseCourseFactoryWorkspace scope="tenant" />);

    expect(markup).toContain('id="admin-enterprise-course-factory"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain("企业课程工厂与 Sponsor 投影");
    expect(markup).toContain("课程工厂状态</dt><dd>已接入现有 authority");
    expect(enterpriseCourseFactoryCapabilities).toHaveLength(8);
    for (const capability of enterpriseCourseFactoryCapabilities) {
      expect(markup).toContain(capability.title);
      expect(markup).toContain("证据状态：受现有 authority 约束");
      expect(markup).toContain(capability.limitation);
      expect(markup).toContain(capability.unaffected);
      expect(markup).toContain(capability.notProven);
      expect(markup).toContain(capability.scope);
    }
  });

  it("states the current Admin host and keeps supported anchors truthful", () => {
    const tenantMarkup = renderToStaticMarkup(<EnterpriseCourseFactoryWorkspace scope="tenant" />);
    const platformMarkup = renderToStaticMarkup(
      <EnterpriseCourseFactoryWorkspace scope="platform" />
    );

    expect(tenantMarkup).toContain("租户范围");
    expect(platformMarkup).toContain("平台范围");
    expect(tenantMarkup).toContain("当前预览未提供管理员会话");
    expect(tenantMarkup).toContain("CoursePackage authority");
    expect(tenantMarkup).toContain("Sponsor-safe delivery");
    expect(tenantMarkup).not.toContain("<button");
    expect(tenantMarkup).not.toContain("AllowedActionButton");
    expect(tenantMarkup).not.toMatch(/state_true|replay_hash|other_tenant_data/i);
    expect(tenantMarkup).not.toMatch(/fetch\(|\/api\/|\/internal\/v1/);
  });

  it("adds the Enterprise anchor only to advertised Admin navigation", () => {
    expect(ADMIN_NAVIGATION_ITEMS).toContainEqual({
      id: "admin-enterprise-course-factory",
      label: "企业课程工厂与 Sponsor 投影"
    });
  });
});
