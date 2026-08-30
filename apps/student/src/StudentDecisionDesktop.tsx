import type { ReactElement, ReactNode } from "react";
import type {
  Decision,
  DecisionPayload,
  DecisionPayloadFieldPath,
  StudentBffCockpitDTO,
  StudentSafeTeamSettlement
} from "@simwar/shared-contracts";
import { AllowedActionButton, AuthorityBadge, KnownLimitBanner, StatePanel } from "@simwar/ui";

export const studentDecisionDesktopStates = [
  "signed-out",
  "loading",
  "ready",
  "stale",
  "unauthorized",
  "error",
  "published",
  "empty"
] as const;

export type StudentDecisionDesktopState = (typeof studentDecisionDesktopStates)[number];

export type StudentDecisionDesktopWorkspacePhase = "idle" | "loading" | "empty" | "ready" | "error";

export type StudentDecisionDesktopRecoveryState =
  | "NONE"
  | "REAUTH_REQUIRED"
  | "READY"
  | "CONTEXT_UNAUTHORIZED"
  | "CONTEXT_STALE";

export interface StudentDecisionDesktopStateInput {
  hasSession: boolean;
  isStudentSession: boolean;
  workspacePhase: StudentDecisionDesktopWorkspacePhase;
  contextRecoveryState: StudentDecisionDesktopRecoveryState;
  exactContextReady: boolean;
  hasPublishedResult: boolean;
}

export function getStudentDecisionDesktopState(
  input: StudentDecisionDesktopStateInput
): StudentDecisionDesktopState {
  if (!input.hasSession) return "signed-out";
  if (!input.isStudentSession || input.contextRecoveryState === "CONTEXT_UNAUTHORIZED") {
    return "unauthorized";
  }
  if (input.contextRecoveryState === "CONTEXT_STALE" || !input.exactContextReady) {
    return "stale";
  }
  if (input.workspacePhase === "loading") return "loading";
  if (input.workspacePhase === "error") return "error";
  if (input.workspacePhase === "empty") return "empty";
  if (input.hasPublishedResult) return "published";
  return "ready";
}

export interface StudentDecisionDesktopContext {
  tenant_id: string;
  course_id: string;
  course_title?: string;
  run_id: string;
  round_id: string;
  round_no: number;
  team_id: string;
}

export type StudentDecisionDesktopRoleWorkflowAvailability =
  | "checking"
  | "active"
  | "inactive"
  | "error";

export interface StudentDecisionDesktopProps {
  desktopState: StudentDecisionDesktopState;
  context: StudentDecisionDesktopContext | null;
  cockpit: StudentBffCockpitDTO | null;
  decision: DecisionPayload;
  submittedDecision?: Decision;
  publishedResult?: StudentSafeTeamSettlement;
  busy: boolean;
  canSubmit: boolean;
  roundIsOpen?: boolean;
  roleWorkflowActive: boolean;
  roleWorkflowAvailability: StudentDecisionDesktopRoleWorkflowAvailability;
  notice: string;
  onDecisionChange: (
    field: DecisionPayloadFieldPath,
    value: string | number | DecisionPayload["capacity_plan"]
  ) => void;
  onSubmit: () => void;
  onRecover?: () => void;
}

const decisionFields: Array<{
  field: DecisionPayloadFieldPath;
  label: string;
  type: "number" | "text" | "select";
}> = [
  { field: "pricing.base_price", label: "定价", type: "number" },
  { field: "marketing_budget", label: "营销预算", type: "number" },
  { field: "service_quality_budget", label: "服务质量预算", type: "number" },
  { field: "capacity_plan", label: "产能计划", type: "select" },
  { field: "cash_buffer_target", label: "现金缓冲", type: "number" },
  { field: "strategy_statement", label: "策略说明", type: "text" }
];

const spineSteps = [
  ["context", "上下文", "确认服务端 exact refs"],
  ["decision", "决策主线", "编辑当前可用字段"],
  ["workspace", "工作台", "保存为当前学员草稿"],
  ["inspect", "上下文检查", "查看权限与证据边界"],
  ["support", "支持栏", "进入协作与复盘"]
] as const;

function spineStatus(
  state: StudentDecisionDesktopState,
  key: (typeof spineSteps)[number][0]
): "current" | "complete" | "blocked" {
  if (["signed-out", "loading", "unauthorized", "stale", "error", "empty"].includes(state)) {
    return key === "context" ? "current" : "blocked";
  }
  if (state === "published") return "complete";
  if (key === "context") return "complete";
  if (key === "decision" || key === "workspace") return "current";
  return "blocked";
}

function statePanelFor(
  state: StudentDecisionDesktopState,
  notice: string,
  onRecover?: () => void
): ReactElement | null {
  if (state === "ready" || state === "published") return null;
  const panels: Record<
    Exclude<StudentDecisionDesktopState, "ready" | "published">,
    {
      status: "unknown" | "loading" | "stale" | "permission-denied" | "error" | "empty";
      message: string;
    }
  > = {
    "signed-out": {
      status: "unknown",
      message: "请登录后查看当前学员决策桌面。"
    },
    loading: { status: "loading", message: "正在读取服务端 exact context…" },
    stale: {
      status: "stale",
      message: "当前上下文已失效；不会静默切换到最新或默认回合。"
    },
    unauthorized: {
      status: "permission-denied",
      message: "当前身份没有恢复该学员决策桌面的权限。"
    },
    error: { status: "error", message: "学员决策桌面加载失败；不会使用旧上下文或客户端推断。" },
    empty: { status: "empty", message: "服务端尚未提供可继续的课程、运行或回合上下文。" }
  };
  const panel = panels[state];
  const message: ReactNode = (
    <>
      {panel.message}
      {notice ? <span className="sdd-detail"> {notice}</span> : null}
    </>
  );
  const canRecover = (state === "stale" || state === "error") && onRecover;
  return (
    <StatePanel
      status={panel.status}
      message={message}
      {...(canRecover ? { recoveryAction: "重新加载决策桌面", onRecover } : {})}
    />
  );
}

function decisionValue(
  decision: DecisionPayload,
  field: DecisionPayloadFieldPath
): string | number {
  switch (field) {
    case "pricing.base_price":
      return decision.pricing.base_price;
    case "marketing_budget":
      return decision.marketing_budget;
    case "service_quality_budget":
      return decision.service_quality_budget;
    case "capacity_plan":
      return decision.capacity_plan;
    case "cash_buffer_target":
      return decision.cash_buffer_target;
    case "strategy_statement":
      return decision.strategy_statement;
  }
}

function desktopStateCopy(state: StudentDecisionDesktopState): string {
  return {
    "signed-out": "未登录",
    loading: "读取中",
    ready: "可继续",
    stale: "上下文失效",
    unauthorized: "无权访问",
    error: "加载失败",
    published: "结果已发布",
    empty: "暂无上下文"
  }[state];
}

export function StudentDecisionDesktop({
  desktopState,
  context,
  cockpit,
  decision,
  submittedDecision,
  publishedResult,
  busy,
  canSubmit,
  roundIsOpen = true,
  roleWorkflowActive,
  roleWorkflowAvailability,
  notice,
  onDecisionChange,
  onSubmit,
  onRecover
}: StudentDecisionDesktopProps) {
  const allowedActions = cockpit?.decision_form.allowed_actions ?? [];
  const isEditable = (field: DecisionPayloadFieldPath) =>
    roundIsOpen &&
    (desktopState === "ready" || desktopState === "published") &&
    cockpit?.decision_form.editable_fields.includes(field) === true;
  const submitReason = roleWorkflowActive
    ? "角色协作已启用，请完成团队确认后再提交。"
    : roleWorkflowAvailability === "checking"
      ? "正在核验服务端角色协作状态，正式提交暂时关闭。"
      : roleWorkflowAvailability === "error"
        ? "角色协作状态加载失败，正式提交已关闭。"
        : "当前回合尚未授予正式提交权限。";

  return (
    <section
      className="panel sdd"
      data-testid="student-decision-desktop"
      data-desktop-state={desktopState}
      aria-label="受治理的学员决策桌面"
    >
      <div className="sdd-head">
        <div>
          <p className="eyebrow">R1 · Governed Student Executive Decision Desktop</p>
          <h2>决策桌面</h2>
          <p className="sdd-lede">
            从一个服务端 exact context 继续一条完整决策线程，不在多个 panel 之间自行拼接。
          </p>
        </div>
        <div className="sdd-state" role="status">
          <AuthorityBadge authority={desktopState === "published" ? "official" : "draft"} />
          <span>{desktopStateCopy(desktopState)}</span>
          <span className="compatibility-copy">{desktopState}</span>
        </div>
      </div>

      <div className="bff-surface sdd-context" data-testid="desktop-exact-context">
        <div>
          <span>当前正式上下文</span>
          <strong>{context?.course_title ?? "等待服务端课程"}</strong>
        </div>
        <div>
          <span>课程 / Course</span>
          <strong>{context?.course_id ?? "未绑定"}</strong>
        </div>
        <div>
          <span>运行 / Run</span>
          <strong>{context?.run_id ?? "未绑定"}</strong>
        </div>
        <div>
          <span>回合 / Round</span>
          <strong>
            {context?.round_id ?? "未绑定"} · {context?.round_no ?? "—"}
          </strong>
        </div>
        <div>
          <span>队伍 / Team</span>
          <strong>{context?.team_id ?? "未绑定"}</strong>
        </div>
      </div>

      <ol className="board sdd-spine" aria-label="Decision Spine">
        {spineSteps.map(([key, label, description], index) => {
          const status = spineStatus(desktopState, key);
          return (
            <li key={key} data-spine-status={status}>
              <span className="sdd-index">{index + 1}</span>
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="board sdd-layout">
        <main className="sdd-canvas" aria-label="Workspace Canvas">
          {statePanelFor(desktopState, notice, onRecover)}
          {desktopState === "ready" || desktopState === "published" ? (
            <>
              <section
                id="student-submission"
                className="panel student-location sdd-decision"
                aria-label="最终提交"
              >
                <div className="panel-title">
                  <div>
                    <p className="eyebrow">Decision Spine · Workspace Canvas</p>
                    <h3>结构化决策</h3>
                  </div>
                  <span role="status">
                    {notice} {submittedDecision ? `· v${submittedDecision.version}` : "· 草稿"}
                  </span>
                </div>
                <div className="form-panel sdd-form">
                  {decisionFields.map(({ field, label, type }) => {
                    const editable = isEditable(field);
                    const value = decisionValue(decision, field);
                    if (type === "select") {
                      return (
                        <label key={field}>
                          {label}
                          <select
                            value={value}
                            disabled={busy || !editable}
                            onChange={(event) =>
                              onDecisionChange(
                                field,
                                event.target.value as DecisionPayload["capacity_plan"]
                              )
                            }
                          >
                            <option value="contract">收缩</option>
                            <option value="hold">保持</option>
                            <option value="expand">扩张</option>
                          </select>
                        </label>
                      );
                    }
                    if (type === "text") {
                      return (
                        <label key={field} className="sdd-full">
                          {label}
                          <textarea
                            value={value}
                            disabled={busy || !editable}
                            onChange={(event) => onDecisionChange(field, event.target.value)}
                          />
                        </label>
                      );
                    }
                    return (
                      <label key={field}>
                        {label}
                        <input
                          type="number"
                          value={value}
                          disabled={busy || !editable}
                          min={field === "cash_buffer_target" ? 0 : undefined}
                          max={field === "cash_buffer_target" ? 0.6 : undefined}
                          step={field === "cash_buffer_target" ? 0.01 : 1}
                          onChange={(event) => onDecisionChange(field, Number(event.target.value))}
                        />
                      </label>
                    );
                  })}
                </div>
                <AllowedActionButton
                  className="primary"
                  action="decision:submit"
                  allowedActions={allowedActions}
                  disabled={!canSubmit}
                  loading={busy}
                  disabledReason={submitReason}
                  onClick={onSubmit}
                >
                  提交正式决策
                </AllowedActionButton>
                {roleWorkflowActive ? (
                  <p className="evidence-note">
                    当前 Run 已启用角色协作，正式 Decision 仅由团队确认生成。
                  </p>
                ) : null}
              </section>

              <section
                id="student-results"
                className="panel student-location sdd-result"
                aria-label="结果与因果链"
              >
                <div className="panel-title">
                  <div>
                    <p className="eyebrow">Published Result</p>
                    <h3>结果与因果链</h3>
                  </div>
                  <span>{publishedResult ? "结果已发布" : "等待结果"}</span>
                </div>
                {publishedResult ? (
                  <div className="status-grid sdd-results">
                    <div>
                      <span>排名</span>
                      <strong>{publishedResult.state_obs.rank}</strong>
                    </div>
                    <div>
                      <span>分数</span>
                      <strong>{publishedResult.state_obs.score}</strong>
                    </div>
                    <div>
                      <span>利润状态</span>
                      <strong>{publishedResult.state_obs.profit_band}</strong>
                    </div>
                    <p>{publishedResult.state_est.explanation}</p>
                  </div>
                ) : (
                  <p className="muted">正式结果发布后显示服务端可见反馈。</p>
                )}
              </section>
            </>
          ) : null}
        </main>

        <aside className="sdd-inspector" aria-label="Context Inspector">
          <div className="panel sdd-card">
            <p className="eyebrow">Context Inspector</p>
            <h3>上下文检查</h3>
            <dl>
              <div>
                <dt>租户</dt>
                <dd className="compatibility-copy">{context?.tenant_id ?? "未绑定"}</dd>
              </div>
              <div>
                <dt>服务端证据</dt>
                <dd className="compatibility-copy">
                  {cockpit?.student_cockpit.evidence_label ?? "未读取"}
                </dd>
              </div>
              <div>
                <dt>回合状态</dt>
                <dd className="compatibility-copy">
                  {cockpit?.student_cockpit.visible_state.round_status ?? "未知"}
                </dd>
              </div>
              <div>
                <dt>提交动作</dt>
                <dd className="compatibility-copy">
                  {allowedActions.includes("decision:submit") ? "服务端已授权" : "服务端未授权"}
                </dd>
              </div>
            </dl>
          </div>
          <KnownLimitBanner
            limitation="桌面只消费 Student BFF 的角色安全投影。"
            unaffected="正式结算、Replay 与真值写入仍由服务端核心链负责。"
            notProven="未证明跨队伍私有草稿、生产持久化或 AI 支持。"
            scope="范围：当前学员、本租户、本队伍、本回合。"
          />
        </aside>

        <aside className="panel sdd-support" aria-label="Support Rail">
          <p className="eyebrow">Support Rail</p>
          <h3>支持与恢复</h3>
          <ul>
            <li>
              <a href="#student-private-draft">个人角色草稿</a>
              <span>{roleWorkflowActive ? "服务端已开放" : "查看当前状态"}</span>
            </li>
            <li>
              <a href="#student-confirmation">团队确认</a>
              <span>仅服务端确认链</span>
            </li>
            <li>
              <a href="#student-debrief">决策复盘</a>
              <span>学习建议只读</span>
            </li>
            <li>
              <a href="#student-learning-report">学习报告</a>
              <span>advisory-only</span>
            </li>
          </ul>
          <p className="sdd-note">
            当前 Support Rail 只连接既有协作与学习能力；没有新增 Agent UI、AI 真值或第二 BFF。
          </p>
        </aside>
      </div>
    </section>
  );
}
