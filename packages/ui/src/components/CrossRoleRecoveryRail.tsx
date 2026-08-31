import type { ReactNode } from "react";

export const recoveryStatuses = [
  "signed-out",
  "loading",
  "ready",
  "stale",
  "reauth-required",
  "conflict",
  "rollback-available",
  "error"
] as const;

export type RecoveryStatus = (typeof recoveryStatuses)[number];
export type RecoveryRole = "admin" | "teacher" | "student" | "enterprise";

export interface RecoveryContextEntry {
  label: string;
  value: ReactNode;
}

export interface RecoveryStateCopy {
  primary: string;
  technical: RecoveryStatus;
  cue: string;
  detail: string;
}

const stateCopy: Record<RecoveryStatus, RecoveryStateCopy> = {
  "signed-out": {
    primary: "需要登录",
    technical: "signed-out",
    cue: "未连接",
    detail: "登录后才能读取当前正式上下文；此处不会猜测租户、队伍或回合。"
  },
  loading: {
    primary: "正在同步",
    technical: "loading",
    cue: "同步中",
    detail: "正在读取服务端上下文，旧响应不会覆盖新的身份或范围。"
  },
  ready: {
    primary: "上下文已同步",
    technical: "ready",
    cue: "已就绪",
    detail: "当前工作区绑定到已提供的服务端上下文。"
  },
  stale: {
    primary: "上下文已陈旧",
    technical: "stale",
    cue: "需刷新",
    detail: "当前引用可能已经过期；刷新后才会继续当前线程。"
  },
  "reauth-required": {
    primary: "需要重新验证",
    technical: "reauth-required",
    cue: "需验证",
    detail: "身份或业务范围已经改变，请重新验证后再读取或提交。"
  },
  conflict: {
    primary: "存在恢复冲突",
    technical: "conflict",
    cue: "需处理",
    detail: "检测到并发或范围冲突；系统不会覆盖较新的服务端状态。"
  },
  "rollback-available": {
    primary: "可以回滚",
    technical: "rollback-available",
    cue: "可回滚",
    detail: "存在最近的可用快照；回滚仅恢复当前工作区，不改变正式结算真值。"
  },
  error: {
    primary: "恢复失败",
    technical: "error",
    cue: "未完成",
    detail: "恢复没有完成；请重试，或等待服务端提供新的上下文。"
  }
};

const roleLabels: Record<RecoveryRole, string> = {
  admin: "Admin",
  teacher: "Teacher",
  student: "Student",
  enterprise: "Enterprise"
};

const visibleStatusLabels: Record<RecoveryStatus, string> = {
  "signed-out": "未连接",
  loading: "同步中",
  ready: "已就绪",
  stale: "陈旧",
  "reauth-required": "需验证",
  conflict: "冲突",
  "rollback-available": "可回滚",
  error: "失败"
};

export function getRecoveryStateCopy(status: RecoveryStatus): RecoveryStateCopy {
  return stateCopy[status];
}

interface RecoveryAction {
  dataAction: string;
  label: string;
  onClick: (() => void) | undefined;
}

type RecoveryHandlers = {
  onRecover: (() => void) | undefined;
  onReauthenticate: (() => void) | undefined;
  onResolveConflict: (() => void) | undefined;
  onRollback: (() => void) | undefined;
};

function getRecoveryAction(
  status: RecoveryStatus,
  handlers: RecoveryHandlers
): RecoveryAction | undefined {
  switch (status) {
    case "signed-out":
      return handlers.onReauthenticate
        ? {
            dataAction: "recovery:reauthenticate",
            label: "前往登录",
            onClick: handlers.onReauthenticate
          }
        : undefined;
    case "stale":
      return handlers.onRecover
        ? {
            dataAction: "recovery:refresh",
            label: "刷新并恢复当前上下文",
            onClick: handlers.onRecover
          }
        : undefined;
    case "reauth-required":
      return handlers.onReauthenticate
        ? {
            dataAction: "recovery:reauthenticate",
            label: "重新验证身份",
            onClick: handlers.onReauthenticate
          }
        : undefined;
    case "conflict":
      return handlers.onResolveConflict
        ? {
            dataAction: "recovery:resolve-conflict",
            label: "查看冲突并恢复",
            onClick: handlers.onResolveConflict
          }
        : undefined;
    case "rollback-available":
      return handlers.onRollback
        ? {
            dataAction: "recovery:rollback",
            label: "回滚到最近可用快照",
            onClick: handlers.onRollback
          }
        : undefined;
    case "error":
      return handlers.onRecover
        ? {
            dataAction: "recovery:refresh",
            label: "重试恢复",
            onClick: handlers.onRecover
          }
        : undefined;
    case "loading":
      return undefined;
    case "ready":
      return handlers.onRecover
        ? {
            dataAction: "recovery:refresh",
            label: "刷新当前上下文",
            onClick: handlers.onRecover
          }
        : undefined;
  }
}

export interface CrossRoleRecoveryRailProps {
  role: RecoveryRole;
  status: RecoveryStatus;
  contextEntries: readonly RecoveryContextEntry[];
  onRecover?: (() => void) | undefined;
  onReauthenticate?: (() => void) | undefined;
  onResolveConflict?: (() => void) | undefined;
  onRollback?: (() => void) | undefined;
}

export function CrossRoleRecoveryRail({
  role,
  status,
  contextEntries,
  onRecover,
  onReauthenticate,
  onResolveConflict,
  onRollback
}: CrossRoleRecoveryRailProps) {
  const copy = getRecoveryStateCopy(status);
  const action = getRecoveryAction(status, {
    onRecover,
    onReauthenticate,
    onResolveConflict,
    onRollback
  });
  const headingId = `recovery-rail-${role}-heading`;

  return (
    <section
      className="sw-ui sw-state-panel sw-recovery-rail"
      data-state={status}
      data-recovery-status={status}
      data-recovery-role={role}
      aria-labelledby={headingId}
    >
      <div className="sw-recovery-rail__header">
        <div>
          <p className="sw-technical-label">{roleLabels[role]} · Digital Thread</p>
          <h2 id={headingId}>上下文与恢复</h2>
        </div>
        <div className="sw-recovery-rail__status" data-status={status}>
          <span className="sw-technical-label">提示：{copy.cue}</span>
          <strong>{copy.primary}</strong>
          <span className="sw-technical-label">状态：{visibleStatusLabels[status]}</span>
        </div>
      </div>
      <p className="sw-recovery-rail__detail" aria-live="polite">
        {copy.detail}
      </p>
      {contextEntries.length > 0 ? (
        <dl className="sw-context-bar sw-recovery-rail__context" aria-label="当前 exact context">
          {contextEntries.map((entry) => (
            <div className="sw-context-bar__item" key={entry.label}>
              <dt>{entry.label}</dt>
              <dd>{entry.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="sw-recovery-rail__empty">当前没有可展示的 exact context。</p>
      )}
      {action ? (
        <button
          type="button"
          className="sw-state-panel__recovery"
          data-action={action.dataAction}
          onClick={action.onClick}
          disabled={!action.onClick}
          aria-disabled={!action.onClick}
        >
          {action.label}
        </button>
      ) : null}
    </section>
  );
}
