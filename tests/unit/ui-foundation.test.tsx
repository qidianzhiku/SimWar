import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  AllowedActionButton,
  AppShell,
  AuthorityBadge,
  ContextBar,
  KnownLimitBanner,
  ReceiptPanel,
  StatePanel
} from "../../packages/ui/src/index";

const contextBarSource = readFileSync(resolve("packages/ui/src/components/ContextBar.tsx"), "utf8");
const receiptPanelSource = readFileSync(
  resolve("packages/ui/src/components/ReceiptPanel.tsx"),
  "utf8"
);
const tokenSource = readFileSync(resolve("packages/ui/src/tokens.css"), "utf8");
const styleSource = readFileSync(resolve("packages/ui/src/styles.css"), "utf8");

describe("@simwar/ui foundation components", () => {
  it("does not invent omitted server context values", () => {
    const markup = renderToStaticMarkup(
      <ContextBar context={{ tenant: "华东试点", role: "教师" }} />
    );

    expect(markup).toContain("华东试点");
    expect(markup).toContain("教师");
    expect(markup).not.toContain("默认租户");
    expect(markup).not.toContain("demo");
    expect(markup).not.toContain("session-001");
    expect(markup).not.toContain("run-001");
    expect(markup).not.toContain("round-1");
    expect(markup).not.toContain("team-001");
    expect(markup).not.toContain("student");
  });

  it("removes the unknown-fill prop from ContextBar instead of offering a client-side unknown policy", () => {
    const markup = renderToStaticMarkup(
      <ContextBar
        context={{ tenant: "华东试点", role: "教师" }}
        {...({ showUnknown: true } as Record<string, unknown>)}
      />
    );

    expect(markup).not.toContain("未知");
    expect(contextBarSource).not.toMatch(/\bshowUnknown\b/);
  });

  it("keeps ContextBar props limited to server context fields", () => {
    type ContextBarPropKeys = keyof React.ComponentProps<typeof ContextBar>;
    expectTypeOf<ContextBarPropKeys>().toEqualTypeOf<"context">();
  });

  it("renders visible Simplified Chinese authority semantics for every authority kind", () => {
    const expectedLabels = {
      official: "正式",
      draft: "草稿",
      shadow: "影子",
      advisory: "建议",
      "system-result": "系统结果",
      "ai-explanation": "AI 解释",
      "teacher-comment": "教师点评",
      unknown: "未知"
    } as const;

    for (const [authority, label] of Object.entries(expectedLabels)) {
      const markup = renderToStaticMarkup(
        <AuthorityBadge authority={authority as keyof typeof expectedLabels} />
      );
      expect(markup).toContain(label);
      expect(markup).toContain(`data-authority="${authority}"`);
    }
  });

  it("keeps an action button disabled with a human-readable reason when the server omits the action", () => {
    const markup = renderToStaticMarkup(
      <AllowedActionButton
        action="publish"
        allowedActions={["save-draft"]}
        disabledReason="当前回合尚未完成校验"
      >
        发布回合
      </AllowedActionButton>
    );

    expect(markup).toContain("<button");
    expect(markup).toContain("disabled");
    expect(markup).toContain("当前回合尚未完成校验");
  });

  it("enables an allowed action only when no explicit disabled or loading state applies", () => {
    const enabled = renderToStaticMarkup(
      <AllowedActionButton action="save-draft" allowedActions={["save-draft"]}>
        保存草稿
      </AllowedActionButton>
    );
    const explicitlyDisabled = renderToStaticMarkup(
      <AllowedActionButton
        action="save-draft"
        allowedActions={["save-draft"]}
        disabled
        disabledReason="表单尚未完成"
      >
        保存草稿
      </AllowedActionButton>
    );
    const loading = renderToStaticMarkup(
      <AllowedActionButton action="save-draft" allowedActions={["save-draft"]} loading>
        保存草稿
      </AllowedActionButton>
    );

    expect(enabled).not.toContain("disabled");
    expect(explicitlyDisabled).toContain("disabled");
    expect(explicitlyDisabled).toContain("表单尚未完成");
    expect(loading).toContain("disabled");
  });

  it("renders the complete command receipt and supplied reuse or conflict evidence", () => {
    const markup = renderToStaticMarkup(
      <ReceiptPanel
        receipt={{
          command: "round.publish",
          actor: "teacher-007",
          timestamp: "2026-08-13T09:30:00Z",
          correlation_id: "corr-42",
          status: "reused",
          reuse_conflict: "与既有回执一致，未重复写入",
          exact_ref: "receipt://corr-42"
        }}
      />
    );

    for (const value of [
      "round.publish",
      "teacher-007",
      "2026-08-13T09:30:00Z",
      "corr-42",
      "reused",
      "与既有回执一致，未重复写入",
      "receipt://corr-42"
    ]) {
      expect(markup).toContain(value);
    }

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
  });

  it("requires the canonical receipt fields without compatibility aliases", () => {
    expect(receiptPanelSource).not.toMatch(
      /correlationId|reuseConflict|exactRef|\bevidence\??\s*:|\bconflict\??\s*:/
    );
  });

  it("separates the four known-limit facts instead of using a generic coming-soon message", () => {
    const markup = renderToStaticMarkup(
      <KnownLimitBanner
        limitation="当前仅提供租户范围内的课程工厂入口"
        unaffected="现有课程发布与回合运行不受影响"
        notProven="尚未证明跨租户赞助聚合能力"
        scope="范围：Admin 企业课程工厂"
      />
    );

    for (const value of [
      "当前仅提供租户范围内的课程工厂入口",
      "现有课程发布与回合运行不受影响",
      "尚未证明跨租户赞助聚合能力",
      "范围：Admin 企业课程工厂"
    ]) {
      expect(markup).toContain(value);
    }
    expect(markup).not.toContain("coming soon");
  });

  it("covers every state with an explicit status label and optional recovery action", () => {
    const statuses = [
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
    ] as const;

    for (const status of statuses) {
      const markup = renderToStaticMarkup(
        <StatePanel
          status={status}
          message={`状态：${status}`}
          recoveryAction="重新加载"
          onRecover={() => undefined}
        />
      );

      expect(markup).toContain(`状态：${status}`);
      expect(markup).toContain("重新加载");
      expect(markup).toContain(`data-state="${status}"`);
    }
  });

  it("does not render an inert recovery button when a handler is absent", () => {
    const markup = renderToStaticMarkup(
      <StatePanel
        {...({
          status: "error",
          message: "需要安全恢复",
          recoveryAction: "重新加载"
        } as unknown as React.ComponentProps<typeof StatePanel>)}
      />
    );

    expect(markup).not.toContain("sw-state-panel__recovery");
    expect(markup).not.toContain("重新加载");
  });

  it("provides the shell skip link, landmarks, and workspace title", () => {
    const markup = renderToStaticMarkup(
      <AppShell workspaceTitle="回合控制台" navigation={<a href="#today">今日</a>}>
        <p>当前工作区</p>
      </AppShell>
    );

    expect(markup).toContain("跳转到主要内容");
    expect(markup).toContain("<nav");
    expect(markup).toContain("<header");
    expect(markup).toContain("<main");
    expect(markup).toContain("回合控制台");
    expect(markup).toContain("当前工作区");
  });

  it("keeps every ARIA reference paired to an instance-unique semantic id", () => {
    const markup = renderToStaticMarkup(
      <div>
        <AllowedActionButton action="save-draft" allowedActions={[]}>
          保存草稿 1
        </AllowedActionButton>
        <AllowedActionButton action="save-draft" allowedActions={[]}>
          保存草稿 2
        </AllowedActionButton>
        <ReceiptPanel
          receipt={{
            command: "round.publish",
            actor: "teacher-007",
            timestamp: "2026-08-13T09:30:00Z",
            correlation_id: "corr-1",
            status: "reused",
            reuse_conflict: "复用",
            exact_ref: "receipt://corr-1"
          }}
        />
        <ReceiptPanel
          receipt={{
            command: "round.publish",
            actor: "teacher-008",
            timestamp: "2026-08-13T09:31:00Z",
            correlation_id: "corr-2",
            status: "conflict",
            reuse_conflict: "冲突",
            exact_ref: "receipt://corr-2"
          }}
        />
        <KnownLimitBanner
          limitation="限制 1"
          unaffected="不受影响 1"
          notProven="未证明 1"
          scope="范围 1"
        />
        <KnownLimitBanner
          limitation="限制 2"
          unaffected="不受影响 2"
          notProven="未证明 2"
          scope="范围 2"
        />
        <StatePanel status="ready" message="就绪 1" recoveryAction="重新加载" />
        <StatePanel status="ready" message="就绪 2" recoveryAction="重新加载" />
        <AppShell workspaceTitle="工作区 1" navigation={<a href="#today">今日</a>}>
          <p>内容 1</p>
        </AppShell>
        <AppShell workspaceTitle="工作区 2" navigation={<a href="#today">今日</a>}>
          <p>内容 2</p>
        </AppShell>
      </div>
    );

    const describedByIds = [...markup.matchAll(/aria-describedby="([^"]+)"/g)].map(([, id]) => id);
    const reasonIds = [...markup.matchAll(/class="sw-action-reason" id="([^"]+)"/g)].map(
      ([, id]) => id
    );
    const labelledByIds = [...markup.matchAll(/aria-labelledby="([^"]+)"/g)].map(([, id]) => id);
    const headingIds = [...markup.matchAll(/<h2 id="([^"]+)"/g)].map(([, id]) => id);
    const skipTargets = [...markup.matchAll(/class="sw-skip-link" href="#([^"]+)"/g)].map(
      ([, id]) => id
    );
    const mainIds = [...markup.matchAll(/class="sw-app-shell__main" id="([^"]+)"/g)].map(
      ([, id]) => id
    );

    expect(new Set(describedByIds).size).toBe(describedByIds.length);
    expect(new Set(reasonIds).size).toBe(reasonIds.length);
    expect(describedByIds).toEqual(expect.arrayContaining(reasonIds));
    expect(new Set(labelledByIds).size).toBe(labelledByIds.length);
    expect(new Set(headingIds).size).toBe(headingIds.length);
    expect(labelledByIds).toEqual(expect.arrayContaining(headingIds));
    expect(new Set(skipTargets).size).toBe(skipTargets.length);
    expect(new Set(mainIds).size).toBe(mainIds.length);
    expect(skipTargets).toEqual(mainIds);
  });

  it("freezes canonical Figma WEB token names and removes compatibility aliases", () => {
    const requiredTokens = [
      "--sw-color-bg-canvas",
      "--sw-color-bg-surface",
      "--sw-color-bg-authority-subtle",
      "--sw-color-bg-learning-subtle",
      "--sw-color-bg-decision-subtle",
      "--sw-color-bg-risk-subtle",
      "--sw-color-bg-brand-subtle",
      "--sw-color-text-primary",
      "--sw-color-text-secondary",
      "--sw-color-text-inverse",
      "--sw-color-text-brand",
      "--sw-color-text-authority",
      "--sw-color-text-learning",
      "--sw-color-text-decision",
      "--sw-color-text-risk",
      "--sw-color-action-primary",
      "--sw-color-action-brand",
      "--sw-color-action-risk",
      "--sw-color-border-default",
      "--sw-color-border-strong",
      "--sw-color-border-focus",
      "--sw-color-brand-editorial-crimson",
      "--sw-color-authority-navy",
      "--sw-color-learning-teal",
      "--sw-color-decision-gold",
      "--sw-color-official-risk",
      "--sw-color-bg-disabled",
      "--sw-space-4",
      "--sw-space-8",
      "--sw-space-12",
      "--sw-space-16",
      "--sw-space-24",
      "--sw-space-32",
      "--sw-space-48",
      "--sw-radius-4",
      "--sw-radius-8",
      "--sw-radius-12",
      "--sw-motion-120",
      "--sw-motion-180",
      "--sw-motion-240",
      "--sw-type-size-h3",
      "--sw-type-size-body-small",
      "--sw-type-line-height-normal",
      "--sw-type-weight-semibold"
    ];
    for (const token of requiredTokens) expect(tokenSource).toContain(token);

    for (const alias of [
      "--sw-color-editorial-crimson",
      "--sw-color-official-risk-red",
      "--sw-color-ink",
      "--sw-color-secondary-gray",
      "--sw-color-warm-paper",
      "--sw-color-surface",
      "--sw-space-1",
      "--sw-space-2",
      "--sw-space-3",
      "--sw-space-4-legacy",
      "--sw-space-6",
      "--sw-space-8-legacy",
      "--sw-space-12-legacy",
      "--sw-radius-sm",
      "--sw-radius-md",
      "--sw-radius-lg",
      "--sw-motion-fast",
      "--sw-motion-standard",
      "--sw-motion-slow"
    ]) {
      expect(tokenSource).not.toMatch(new RegExp(`${alias}(?![a-z0-9-])`));
    }

    expect(styleSource).toContain("var(--sw-color-bg-disabled)");
    expect(styleSource).toContain("var(--sw-radius-12)");
    expect(styleSource).not.toContain("border-radius: 999px");
    expect(styleSource).toContain(":where(.sw-ui:focus-visible)");
    expect(styleSource).toContain(":where(.sw-ui) :focus-visible");
    expect(styleSource).toContain("min-height: 44px");
    expect(styleSource).toContain("var(--sw-type-size-h3)");
    expect(styleSource).toContain("var(--sw-type-size-body-small)");
    expect(styleSource).toContain("var(--sw-type-line-height-normal)");
    expect(styleSource).toContain("var(--sw-type-weight-semibold)");
    expect(styleSource).not.toContain("padding: 2px");
    expect(styleSource).toContain("padding: var(--sw-space-4) var(--sw-space-8)");
  });

  it("loads the built package entry point through Node ESM and exposes the seven components", async () => {
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        "const ui = await import('./packages/ui/dist/index.js'); console.log(JSON.stringify(Object.keys(ui)));"
      ],
      { cwd: resolve(".") }
    ).toString();

    expect(JSON.parse(output.trim()) as string[]).toEqual(
      expect.arrayContaining([
        "AllowedActionButton",
        "AppShell",
        "AuthorityBadge",
        "ContextBar",
        "KnownLimitBanner",
        "ReceiptPanel",
        "StatePanel"
      ])
    );
  });
});
