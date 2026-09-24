import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  AuthorityBadge,
  ContextBar,
  KnownLimitBanner,
  ReceiptPanel,
  RoleNavigation,
  StatePanel,
  WorkbenchFrame
} from "./index.js";

const frameMeta = {
  title: "Foundation/WorkbenchFrame",
  component: WorkbenchFrame,
  parameters: { layout: "padded" }
} satisfies Meta<typeof WorkbenchFrame>;

export default frameMeta;

type FrameStory = StoryObj<typeof frameMeta>;

export const Default: FrameStory = {
  args: {
    ariaLabel: "教师课程工作区",
    eyebrow: "当前任务",
    title: "开课准备",
    badge: <AuthorityBadge authority="draft" />,
    boundary: "课程、回合与权限仍由服务端 authority 提供。",
    actions: <button type="button">查看准备状态</button>,
    children: <p>这里是任务内容区域，技术身份与限制按需展开。</p>
  }
};

export const LoadingState: FrameStory = {
  args: {
    ...Default.args,
    state: <StatePanel status="loading" message="正在读取当前 exact context。" />,
    actions: null
  }
};

export const RecoveryState: FrameStory = {
  args: {
    ...Default.args,
    state: (
      <StatePanel
        status="conflict"
        message="当前上下文存在冲突，请先重新读取来源。"
        recoveryAction="重新读取"
        onRecover={() => undefined}
      />
    ),
    actions: <button type="button">查看冲突来源</button>
  }
};

export const AuthorityBadges = () => (
  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
    <AuthorityBadge authority="official" />
    <AuthorityBadge authority="draft" />
    <AuthorityBadge authority="shadow" />
    <AuthorityBadge authority="advisory" />
    <AuthorityBadge authority="unknown" />
  </div>
);

export const Context = () => (
  <ContextBar context={{ tenant: "tenant_demo", role: "Teacher", mode: "DRAFT_ONLY" }} />
);

export const StateGrammar = () => {
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
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {statuses.map((status) => (
        <StatePanel key={status} status={status} message={`状态语义：${status}`} />
      ))}
      <StatePanel
        status="error"
        message="读取失败，请选择一个安全恢复动作。"
        recoveryAction="重新读取"
        onRecover={() => undefined}
      />
    </div>
  );
};

export const KnownLimits = () => (
  <KnownLimitBanner
    limitation="当前页面只消费 approved projection。"
    unaffected="不会改写仿真真值、Course 或 Run authority。"
    notProven="浏览器视觉对齐尚未由本 Storybook 页面证明。"
    scope="isolated shared UI state catalog"
  />
);

export const Receipt = () => (
  <ReceiptPanel
    receipt={{
      command: "READ_CURRENT_CONTEXT",
      actor: "teacher",
      timestamp: "2026-09-22T00:00:00Z",
      correlation_id: "storybook-foundation",
      status: "READ_ONLY",
      reuse_conflict: "NONE",
      exact_ref: "tenant_demo"
    }}
  />
);

export const Navigation = () => {
  const items = [
    { id: "teacher-today", label: "今日工作" },
    { id: "teacher-readiness", label: "开课准备" },
    { id: "teacher-evidence", label: "学习证据确认" }
  ];
  return <RoleNavigation items={items} activeHref="#teacher-readiness" />;
};

export const MobileRecoveryInteraction = () => {
  const [recovered, setRecovered] = useState(false);
  return (
    <div style={{ maxWidth: 390 }}>
      {recovered ? (
        <StatePanel status="ready" message="已恢复到当前 exact context。" />
      ) : (
        <StatePanel
          status="stale"
          message="此来源已过期，不能盲目重试。"
          recoveryAction="重新读取来源"
          onRecover={() => setRecovered(true)}
        />
      )}
    </div>
  );
};
