import { useId, type ReactNode } from "react";

export const stateStatuses = [
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

export type StateStatus = (typeof stateStatuses)[number];

interface StatePanelBaseProps {
  status: StateStatus;
  message?: ReactNode;
}

export type StatePanelProps =
  | (StatePanelBaseProps & {
      recoveryAction?: never;
      onRecover?: never;
    })
  | (StatePanelBaseProps & {
      recoveryAction: ReactNode;
      onRecover: () => void;
    });

const labels: Record<StateStatus, string> = {
  loading: "加载中",
  empty: "暂无数据",
  partial: "部分可用",
  ready: "就绪",
  blocked: "已阻塞",
  stale: "数据陈旧",
  conflict: "存在冲突",
  unknown: "未知状态",
  "permission-denied": "无权限",
  error: "发生错误"
};

export function StatePanel({ status, message, recoveryAction, onRecover }: StatePanelProps) {
  const headingId = `${useId()}-state-heading`;
  return (
    <section className="sw-ui sw-state-panel" data-state={status} aria-labelledby={headingId}>
      <h2 id={headingId}>{labels[status]}</h2>
      {message ? <p>{message}</p> : null}
      {recoveryAction != null && onRecover ? (
        <button className="sw-state-panel__recovery" type="button" onClick={onRecover}>
          {recoveryAction}
        </button>
      ) : null}
    </section>
  );
}
