/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DesignSystemLab } from "../../packages/ui/src/index";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const labSource = readFileSync(resolve("packages/ui/src/DesignSystemLab.tsx"), "utf8");
const styleSource = readFileSync(resolve("packages/ui/src/styles.css"), "utf8");

describe("Development Design System Lab", () => {
  it("renders a deterministic Chinese gallery using the real shared components", () => {
    const markup = renderToStaticMarkup(<DesignSystemLab />);

    expect(markup).toContain("SimWar 设计系统实验室");
    expect(markup).toContain("仅用于开发与视觉验证");
    expect(markup).toContain("组件画廊导航");
    expect(markup).toContain("颜色角色");
    expect(markup).toContain("字体排印");
    expect(markup).toContain("间距");
    expect(markup).toContain("圆角");
    expect(markup).toContain("动效");

    for (const label of [
      "正式",
      "草稿",
      "影子",
      "建议",
      "系统结果",
      "AI 解释",
      "教师点评",
      "未知"
    ]) {
      expect(markup).toContain(label);
    }

    expect(markup).toContain("开发租户");
    expect(markup).toContain("课程准备");
    expect(markup).toContain("教师");
    expect(markup).not.toContain("默认租户");
    expect(markup).not.toContain("session-001");

    expect(markup).toContain('data-action="save-draft"');
    expect(markup).toContain('data-action="unavailable"');
    expect(markup).toContain('data-action="loading"');
    expect(markup).toContain('data-action="publish"');
    expect(markup).toContain('data-variant="risk"');
    expect(markup).toContain("正在处理中");

    for (const field of [
      "command",
      "actor",
      "timestamp",
      "correlation_id",
      "status",
      "reuse_conflict",
      "exact_ref"
    ]) {
      expect(markup).toContain(`data-receipt-field="${field}"`);
    }

    for (const fact of ["当前限制", "不受影响", "尚未证明", "范围"]) {
      expect(markup).toContain(fact);
    }

    for (const status of [
      "loading",
      "empty",
      "partial",
      "ready",
      "blocked",
      "stale",
      "conflict",
      "unknown",
      "permission-denied",
      "error"
    ]) {
      expect(markup).toContain(`data-state="${status}"`);
    }
    expect(markup).toContain("重新加载");

    expect(markup).toContain("跳转到主要内容");
    expect(markup).toContain("<nav");
    expect(markup).toContain("<main");
    expect(markup).toContain("组件画廊");
  });

  it("keeps the gallery presentation-only and deterministic across server renders", () => {
    const first = renderToStaticMarkup(<DesignSystemLab />);
    const second = renderToStaticMarkup(<DesignSystemLab />);

    expect(first).toBe(second);
    expect(first).not.toMatch(/fetch\(|localStorage|setTimeout|Math\.random/);
    expect(first).not.toContain("WCAG");
    expect(first).not.toContain("人工验证已完成");
  });

  it("uses a Simplified Chinese kicker for the development gallery", () => {
    const markup = renderToStaticMarkup(<DesignSystemLab />);

    expect(markup).toContain("PR1 · 开发态设计系统实验室");
    expect(markup).not.toContain("PR1 · Development Design System Lab");
    expect(labSource).toContain("PR1 · 开发态设计系统实验室");
    expect(labSource).not.toContain("PR1 · Development Design System Lab");
  });

  it("keeps gallery navigation links visible and keyboard-sized with semantic tokens", () => {
    const navigationLinkRule =
      styleSource.match(/:where\(\.sw-lab-navigation a\)\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    const navigationHeadingRule =
      styleSource.match(/:where\(\.sw-lab-navigation h2\)\s*\{([\s\S]*?)\}/)?.[1] ?? "";

    expect(navigationLinkRule).toContain("display: inline-flex;");
    expect(navigationLinkRule).toContain("align-items: center;");
    expect(navigationLinkRule).toContain("min-height: var(--sw-space-48);");
    expect(navigationLinkRule).toContain("color: var(--sw-color-text-authority);");
    expect(navigationHeadingRule).toContain("color: var(--sw-color-text-authority);");
    expect(styleSource).not.toContain("18rem");
  });

  it("makes the lab recovery example perform a real in-memory reload", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<DesignSystemLab />);
    });

    const reloadButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "重新加载"
    );
    expect(reloadButton).toBeTruthy();

    act(() => {
      reloadButton?.click();
    });

    expect(container.textContent).toContain("示例已重新加载");
    root.unmount();
    container.remove();
  });
});
