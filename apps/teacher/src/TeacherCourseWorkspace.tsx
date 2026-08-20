import { useEffect, useState, type ReactNode } from "react";
import {
  AllowedActionButton,
  AppShell,
  AuthorityBadge,
  ContextBar,
  KnownLimitBanner,
  RoleNavigation,
  StatePanel,
  type AuthorityKind,
  type ServerContext,
  type StateStatus
} from "@simwar/ui";
import type { PermissionKey, RoundStatus } from "@simwar/shared-contracts";

export const TEACHER_NAVIGATION_ITEMS = [
  { id: "teacher-today", label: "今日工作" },
  { id: "teacher-blockers", label: "即将阻断" },
  { id: "teacher-courses", label: "课程与班级" },
  { id: "teacher-readiness", label: "开课准备" },
  { id: "teacher-w5-governed-model", label: "W5 受控模型" },
  { id: "teacher-teams-roles", label: "团队与角色" },
  { id: "teacher-round-control", label: "轮次控制" },
  { id: "teacher-results", label: "结果发布" },
  { id: "teacher-debrief", label: "复盘工作室" },
  { id: "teacher-evidence", label: "学习证据确认" },
  { id: "teacher-reports", label: "报告生成" },
  { id: "teacher-validation", label: "验证会话" },
  { id: "teacher-close-cleanup", label: "收尾与清理" }
] as const;

export type TeacherNavigationId = (typeof TEACHER_NAVIGATION_ITEMS)[number]["id"];

export type TeacherWorkspaceLoadState = "idle" | "loading" | "ready" | "error";

export const TEACHER_WORKSPACE_LOADING_REASON = "正在加载服务端回合权限，请稍候再试";
export const TEACHER_WORKSPACE_ERROR_REASON = "服务端回合权限加载失败，正式操作已关闭";

const TEACHER_NOTICE_LABELS: Record<string, string> = {
  ready: "就绪",
  "signed in": "已登录",
  "not signed in": "尚未登录",
  "context changed": "上下文已切换",
  "login failed": "登录失败",
  "load failed": "加载失败",
  "formal Course binding preview ready": "正式课程绑定预览已就绪",
  "an approved CourseBlueprint and exact binding readiness are required":
    "需要已批准的课程蓝图和精确绑定就绪条件",
  "formal Course created": "正式课程已创建",
  "LOCAL_SELECTION_ONLY - no Course write yet": "仅本地选择，尚未写入课程",
  "exact Blueprint and B5 readiness confirmed": "已确认精确蓝图与 B5 就绪",
  "Blueprint Studio edit ready": "蓝图工作台编辑已就绪",
  "immutable Blueprint draft saved": "不可变蓝图草稿已保存",
  "Blueprint draft submitted for validation": "蓝图草稿已提交验证",
  "a formal Course is required before publication": "发布前需要正式课程",
  "formal Course published": "正式课程已发布",
  "formal Course publication failed": "正式课程发布失败",
  "an explicit non-negative Run seed is required": "需要非负的显式运行批次种子",
  "formal Run created": "正式运行批次已创建",
  "formal Run creation failed": "正式运行批次创建失败",
  "please sign in first": "请先登录",
  "run created": "运行批次已创建",
  "latest Run must be published first": "请先发布最新运行批次",
  "run creation failed": "运行批次创建失败",
  "round opened": "回合已开启",
  "waiting for learner decision": "等待学员提交决策",
  "round locked": "回合已锁定",
  "settlement completed": "结算已完成",
  "result published": "正式结果已发布",
  "round continued": "下一回合已创建并切换到新回合",
  "action failed": "操作失败",
  "run selection failed": "运行批次选择失败"
};

export function getTeacherNoticeLabel(notice: string): string {
  if (TEACHER_NOTICE_LABELS[notice]) {
    return TEACHER_NOTICE_LABELS[notice];
  }
  return /[\u3400-\u9fff]/u.test(notice) ? notice : "服务端返回未本地化状态，请查看技术详情";
}

export interface TeacherWorkspaceStateInput {
  hasSession: boolean;
  hasState: boolean;
  hasRun: boolean;
  hasRound: boolean;
  hasWorkspace: boolean;
  workspaceLoadState: TeacherWorkspaceLoadState;
}

export interface TeacherWorkspaceStateProjection {
  status: StateStatus;
  message: string;
}

export function getTeacherWorkspaceState({
  hasSession,
  hasState,
  hasRun,
  hasRound,
  hasWorkspace,
  workspaceLoadState
}: TeacherWorkspaceStateInput): TeacherWorkspaceStateProjection {
  if (!hasSession) {
    return { status: "empty", message: "请先登录教师会话" };
  }
  if (!hasState) {
    return { status: "loading", message: "正在加载教师课程状态" };
  }
  if (!hasRun) {
    return { status: "empty", message: "当前会话暂无可用 Run" };
  }
  if (!hasRound) {
    return { status: "partial", message: "当前 Run 尚未提供回合上下文" };
  }
  if (workspaceLoadState === "error") {
    return { status: "error", message: TEACHER_WORKSPACE_ERROR_REASON };
  }
  if (workspaceLoadState === "ready" && hasWorkspace) {
    return {
      status: "ready",
      message: "仅展示服务端提供的课程、回合和权限上下文，不在前端计算正式结果。"
    };
  }
  return { status: "loading", message: TEACHER_WORKSPACE_LOADING_REASON };
}

const teacherNavigationLabels: Record<TeacherNavigationId, string> = Object.fromEntries(
  TEACHER_NAVIGATION_ITEMS.map((item) => [item.id, item.label])
) as Record<TeacherNavigationId, string>;

export interface TeacherLocationProps {
  id: TeacherNavigationId;
  children: ReactNode;
  className?: string;
}

export function TeacherLocation({ id, children, className }: TeacherLocationProps) {
  return (
    <section
      className={className ? `teacher-location-target ${className}` : "teacher-location-target"}
      id={id}
      aria-labelledby={`${id}-heading`}
    >
      <div className="teacher-location-heading">
        <p className="eyebrow">教师课程工作区</p>
        <h2 id={`${id}-heading`}>{teacherNavigationLabels[id]}</h2>
      </div>
      {children}
    </section>
  );
}

export type TeacherRoundAction =
  | "round:start"
  | "round:lock"
  | "settlement:settle"
  | "round:publish"
  | "round:continue";

export function getTeacherRoundAction(
  status: RoundStatus | null | undefined
): TeacherRoundAction | null {
  if (status === "draft") return "round:start";
  if (status === "open") return "round:lock";
  if (status === "locked") return "settlement:settle";
  if (status === "settled") return "round:publish";
  if (status === "published") return "round:continue";
  return null;
}

export function isTeacherRoundActionAllowed(
  status: RoundStatus | null | undefined,
  allowedActions: readonly string[] | null | undefined
): boolean {
  const requiredAction = getTeacherRoundAction(status);
  return requiredAction !== null && (allowedActions?.includes(requiredAction) ?? false);
}

export interface TeacherNextStepButtonProps {
  roundStatus: RoundStatus;
  allowedActions: readonly PermissionKey[] | readonly string[];
  children: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  loading?: boolean;
  onClick: () => void;
}

export function TeacherNextStepButton({
  roundStatus,
  allowedActions,
  children,
  disabled = false,
  disabledReason,
  loading = false,
  onClick
}: TeacherNextStepButtonProps) {
  const action = getTeacherRoundAction(roundStatus);
  if (!action) {
    return (
      <span className="sw-allowed-action-wrap">
        <button
          className="primary"
          type="button"
          disabled
          aria-label="已发布"
          aria-describedby="teacher-published-reason"
        >
          {children}
        </button>
        <span className="sw-action-reason" id="teacher-published-reason" role="status">
          回合已发布，等待服务端创建下一回合
        </span>
      </span>
    );
  }

  const authorized = allowedActions.includes(action);
  const reason = loading
    ? undefined
    : !authorized
      ? (disabledReason ?? "服务端未授权此操作")
      : disabled
        ? (disabledReason ?? "当前操作暂不可用")
        : undefined;
  return (
    <AllowedActionButton
      action={action}
      allowedActions={allowedActions}
      disabled={disabled}
      loading={loading}
      {...(reason ? { disabledReason: reason } : {})}
      onClick={onClick}
      className="teacher-primary-action"
      aria-label={String(children)}
    >
      {children}
    </AllowedActionButton>
  );
}

export interface TeacherPermissionDeniedProps {
  role?: ReactNode;
  children?: ReactNode;
}

export function TeacherPermissionDenied({ role, children }: TeacherPermissionDeniedProps) {
  return (
    <main className="teacher-access-denied" aria-labelledby="teacher-access-denied-heading">
      <p className="eyebrow">教师工作区权限验证</p>
      <h1 id="teacher-access-denied-heading">当前会话没有教师工作区权限</h1>
      <section role="alert" aria-label="教师工作区权限">
        <h2>无法打开教师课程工作区</h2>
        <p>当前角色：{role ?? "未识别"}。请使用已获服务端授权的教师会话。</p>
        {children}
      </section>
    </main>
  );
}

export interface TeacherCourseWorkspaceProps {
  context: ServerContext;
  authority?: AuthorityKind;
  activeHash?: string;
  navigationEnabled?: boolean;
  primaryAction?: ReactNode;
  stateStatus?: StateStatus;
  stateMessage?: ReactNode;
  knownLimits?: ReactNode;
  children: ReactNode;
}

export function TeacherCourseWorkspace({
  context,
  authority = "unknown",
  activeHash,
  navigationEnabled = true,
  primaryAction,
  stateStatus = "ready",
  stateMessage = "仅展示服务端提供的课程、回合和权限上下文，不在前端计算正式结果。",
  knownLimits,
  children
}: TeacherCourseWorkspaceProps) {
  const defaultHash = `#${TEACHER_NAVIGATION_ITEMS[0].id}`;
  const [currentHash, setCurrentHash] = useState(() => {
    if (activeHash !== undefined) return activeHash;
    if (typeof window !== "undefined" && window.location.hash) return window.location.hash;
    return defaultHash;
  });

  useEffect(() => {
    if (activeHash !== undefined) {
      setCurrentHash(activeHash);
      return;
    }
    const handleHashChange = () => setCurrentHash(window.location.hash || defaultHash);
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [activeHash, defaultHash]);

  return (
    <AppShell
      workspaceTitle="SimWar 教师课程工作区"
      navigation={
        navigationEnabled ? (
          <RoleNavigation items={TEACHER_NAVIGATION_ITEMS} activeHref={currentHash} />
        ) : (
          <p className="teacher-nav-denied">当前角色无教师导航</p>
        )
      }
      primaryAction={
        <span className="teacher-shell-authority" aria-label="当前权限边界">
          <AuthorityBadge authority={authority} />
          {primaryAction}
        </span>
      }
    >
      <ContextBar context={context} />
      <StatePanel status={stateStatus} message={stateMessage} />
      {children}
      <KnownLimitBanner
        limitation="教师工作区不计算、不写入正式结算或 Replay 真值。"
        unaffected="现有教师 API、BFF、回合路由和回执链路保持不变。"
        notProven="跨进程持久化、生产运维和真实 AI 能力不在本工作区证明范围内。"
        scope="Teacher Course OS；仅展示已加载会话与服务端投影。"
      />
      {knownLimits ? <div className="teacher-known-limits-slot">{knownLimits}</div> : null}
    </AppShell>
  );
}
