import { useState, type ReactNode } from "react";
import { AllowedActionButton } from "./components/AllowedActionButton.js";
import { AppShell } from "./components/AppShell.js";
import { AuthorityBadge, type AuthorityKind } from "./components/AuthorityBadge.js";
import { ContextBar } from "./components/ContextBar.js";
import { KnownLimitBanner } from "./components/KnownLimitBanner.js";
import { ReceiptPanel } from "./components/ReceiptPanel.js";
import { StatePanel, type StateStatus } from "./components/StatePanel.js";

const authorityExamples: AuthorityKind[] = [
  "official",
  "draft",
  "shadow",
  "advisory",
  "system-result",
  "ai-explanation",
  "teacher-comment",
  "unknown"
];

const stateExamples: Array<{ status: StateStatus; message: string }> = [
  { status: "loading", message: "正在读取开发示例" },
  { status: "empty", message: "当前没有可展示的示例数据" },
  { status: "partial", message: "部分示例已经准备好" },
  { status: "ready", message: "示例已经就绪" },
  { status: "blocked", message: "示例被安全门禁阻塞" },
  { status: "stale", message: "示例数据需要重新读取" },
  { status: "conflict", message: "示例存在版本冲突" },
  { status: "unknown", message: "示例状态尚未确认" },
  { status: "permission-denied", message: "示例动作没有服务端授权" },
  { status: "error", message: "示例读取发生错误" }
];

const colorTokens = [
  ["品牌章节强调", "--sw-color-brand-editorial-crimson"],
  ["系统权威上下文", "--sw-color-authority-navy"],
  ["学习证据", "--sw-color-learning-teal"],
  ["决策注意", "--sw-color-decision-gold"],
  ["正式结果与风险", "--sw-color-official-risk"]
] as const;

const typographyTokens = [
  ["标题 1", "--sw-type-size-h1"],
  ["标题 2", "--sw-type-size-h2"],
  ["正文", "--sw-type-size-body"],
  ["正文小号", "--sw-type-size-body-small"],
  ["正常行高", "--sw-type-line-height-normal"],
  ["半粗字重", "--sw-type-weight-semibold"]
] as const;

const spacingTokens = [
  "--sw-space-4",
  "--sw-space-8",
  "--sw-space-12",
  "--sw-space-16",
  "--sw-space-24",
  "--sw-space-32",
  "--sw-space-48"
] as const;

const radiusTokens = ["--sw-radius-4", "--sw-radius-8", "--sw-radius-12"] as const;
const motionTokens = ["--sw-motion-120", "--sw-motion-180", "--sw-motion-240"] as const;

function TokenList({ tokens }: { tokens: readonly string[] }) {
  return (
    <ul className="sw-lab-token-list">
      {tokens.map((token) => (
        <li key={token}>
          <code>{token}</code>
        </li>
      ))}
    </ul>
  );
}

function TokenRoleList({ tokens }: { tokens: readonly (readonly [string, string])[] }) {
  return (
    <dl className="sw-lab-token-role-list">
      {tokens.map(([label, token]) => (
        <div className="sw-lab-token-role" key={token}>
          <dt>{label}</dt>
          <dd>
            <code>{token}</code>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function GallerySection({
  id,
  title,
  children
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="sw-lab-section" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function LabNavigation() {
  return (
    <div className="sw-lab-navigation">
      <h2>组件画廊导航</h2>
      <ul>
        <li>
          <a href="#sw-lab-tokens">Token 基础</a>
        </li>
        <li>
          <a href="#sw-lab-authority">权威与上下文</a>
        </li>
        <li>
          <a href="#sw-lab-actions">动作与回执</a>
        </li>
        <li>
          <a href="#sw-lab-states">状态与恢复</a>
        </li>
      </ul>
    </div>
  );
}

function RecoveryStateExample({ initialMessage }: { initialMessage: string }) {
  const [message, setMessage] = useState(initialMessage);

  return (
    <StatePanel
      status="error"
      message={message}
      recoveryAction="重新加载"
      onRecover={() => setMessage("示例已重新加载")}
    />
  );
}

export function DesignSystemLab() {
  return (
    <AppShell
      workspaceTitle="SimWar 设计系统实验室"
      navigation={<LabNavigation />}
      banner={<span className="sw-lab-notice">仅用于开发与视觉验证</span>}
    >
      <div className="sw-lab-content">
        <header className="sw-lab-intro">
          <p className="sw-lab-kicker">PR1 · 开发态设计系统实验室</p>
          <h2>组件画廊</h2>
          <p>这里集中展示共享组件的真实语义、状态和服务器权威边界。</p>
        </header>

        <GallerySection id="sw-lab-tokens" title="Token 基础">
          <div className="sw-lab-token-grid">
            <article className="sw-lab-token-card">
              <h3>颜色角色</h3>
              <TokenRoleList tokens={colorTokens} />
            </article>
            <article className="sw-lab-token-card">
              <h3>字体排印</h3>
              <TokenRoleList tokens={typographyTokens} />
            </article>
            <article className="sw-lab-token-card">
              <h3>间距</h3>
              <TokenList tokens={spacingTokens} />
            </article>
            <article className="sw-lab-token-card">
              <h3>圆角</h3>
              <TokenList tokens={radiusTokens} />
            </article>
            <article className="sw-lab-token-card">
              <h3>动效</h3>
              <TokenList tokens={motionTokens} />
            </article>
          </div>
        </GallerySection>

        <GallerySection id="sw-lab-authority" title="权威与上下文">
          <div className="sw-lab-example-block">
            <h3>AuthorityBadge</h3>
            <div className="sw-lab-badge-list">
              {authorityExamples.map((authority) => (
                <AuthorityBadge authority={authority} key={authority} />
              ))}
            </div>
          </div>
          <div className="sw-lab-example-block">
            <h3>ContextBar</h3>
            <ContextBar context={{ tenant: "开发租户", course: "课程准备", role: "教师" }} />
          </div>
        </GallerySection>

        <GallerySection id="sw-lab-actions" title="动作与回执">
          <div className="sw-lab-component-grid">
            <article className="sw-lab-example-block">
              <h3>AllowedActionButton</h3>
              <div className="sw-lab-action-list">
                <AllowedActionButton action="save-draft" allowedActions={["save-draft"]}>
                  允许保存
                </AllowedActionButton>
                <AllowedActionButton
                  action="unavailable"
                  allowedActions={[]}
                  disabledReason="服务端未提供该动作"
                >
                  未授权动作
                </AllowedActionButton>
                <AllowedActionButton action="loading" allowedActions={["loading"]} loading>
                  提交中
                </AllowedActionButton>
                <AllowedActionButton action="publish" allowedActions={["publish"]} variant="risk">
                  风险动作
                </AllowedActionButton>
              </div>
            </article>
            <ReceiptPanel
              receipt={{
                command: "round.publish",
                actor: "teacher.dev",
                timestamp: "2026-08-13T00:00:00Z",
                correlation_id: "corr-lab-001",
                status: "reused",
                reuse_conflict: "复用既有服务端回执",
                exact_ref: "receipt://lab-001"
              }}
            />
          </div>
          <div className="sw-lab-example-block">
            <h3>KnownLimitBanner</h3>
            <KnownLimitBanner
              limitation="实验室只展示当前共享组件能力"
              unaffected="正式业务路由与结算链不受影响"
              notProven="本页面不证明人工验证或生产可用性"
              scope="范围：开发与视觉验证"
            />
          </div>
        </GallerySection>

        <GallerySection id="sw-lab-states" title="状态与恢复">
          <div className="sw-lab-state-grid">
            {stateExamples.map(({ status, message }) =>
              status === "error" ? (
                <RecoveryStateExample key={status} initialMessage={message} />
              ) : (
                <StatePanel key={status} status={status} message={message} />
              )
            )}
          </div>
        </GallerySection>
      </div>
    </AppShell>
  );
}
