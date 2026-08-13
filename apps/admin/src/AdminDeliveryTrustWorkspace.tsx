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
  type RoleNavigationItem,
  type ServerContext,
  type StateStatus
} from "@simwar/ui";

export const ADMIN_NAVIGATION_ITEMS = [
  { id: "admin-delivery-overview", label: "交付总览" },
  { id: "admin-tenants-entitlements", label: "租户与权益" },
  { id: "admin-users-roles", label: "用户、角色与范围" },
  { id: "admin-assets", label: "课程、场景与模型资产" },
  { id: "admin-security-projection", label: "权限与安全投影" },
  { id: "admin-audit-receipts", label: "审计与回执" },
  { id: "admin-runtime-support", label: "运行与支持" },
  { id: "admin-known-limits", label: "已知限制与信任边界" },
  { id: "admin-environment-recovery", label: "环境启动与恢复" }
] as const;

export type AdminLifecycleAction = "abort" | "reset" | "cleanup";

export const LIFECYCLE_BLOCKED_REASON_LABELS: Readonly<Record<string, string>> = {
  not_synthetic_json_internal: "运行不是受支持的内部 JSON synthetic 运行",
  run_not_active: "运行当前不处于活动状态",
  settlement_or_replay_state_present: "运行已有结算或回放状态",
  published_state_present: "运行已有已发布结果",
  run_cleaned: "运行已完成清理"
};

export function formatLifecycleBlockedReasons(reasons: readonly string[]): string {
  if (reasons.length === 0) return "服务端未授权此操作";
  return reasons
    .map((reason) => LIFECYCLE_BLOCKED_REASON_LABELS[reason] ?? "服务端提供了未识别的限制原因")
    .join("；");
}

interface AdminLifecycleOperationButtonProps {
  action: AdminLifecycleAction;
  allowedActions: readonly string[];
  disabled?: boolean;
  loading?: boolean;
  disabledReason?: string;
  onClick: () => void;
  children: ReactNode;
}

export function AdminLifecycleOperationButton({
  action,
  allowedActions,
  disabled,
  loading,
  disabledReason,
  onClick,
  children
}: AdminLifecycleOperationButtonProps) {
  const isAuthorized = allowedActions.includes(action);
  const disabledReasonProps = isAuthorized
    ? {}
    : { disabledReason: disabledReason ?? "当前操作未获服务端授权" };

  return (
    <AllowedActionButton
      action={action}
      allowedActions={allowedActions}
      disabled={disabled ?? false}
      loading={loading ?? false}
      {...disabledReasonProps}
      onClick={onClick}
      variant={action === "abort" ? "risk" : "default"}
      aria-label={action.toUpperCase()}
    >
      {children}
    </AllowedActionButton>
  );
}

export function AdminEnvironmentRecoveryLimit() {
  return (
    <KnownLimitBanner
      limitation="W025 环境启动与恢复尚未获授权；本工作区不发起环境启动请求。"
      unaffected="现有登录、租户范围、课程交付、运行控制、审计与回执能力不受影响。"
      notProven="尚未证明跨环境启动、恢复或生产环境运维能力。"
      scope="Admin 运行与支持；W025 仅作为关闭的已知限制展示。"
    />
  );
}

export interface AdminDeliveryTrustWorkspaceProps {
  context: ServerContext;
  authority?: AuthorityKind;
  activeHash?: string;
  navigationEnabled?: boolean;
  navigationItems?: readonly RoleNavigationItem[];
  primaryAction?: ReactNode;
  stateStatus?: StateStatus;
  stateMessage?: ReactNode;
  knownLimits?: ReactNode;
  environmentRecovery?: ReactNode;
  children: ReactNode;
}

export function AdminDeliveryTrustWorkspace({
  context,
  authority = "unknown",
  activeHash,
  navigationEnabled = true,
  navigationItems = ADMIN_NAVIGATION_ITEMS,
  primaryAction,
  stateStatus = "ready",
  stateMessage = "仅展示服务端提供的上下文，不在前端计算正式结果。",
  knownLimits,
  environmentRecovery,
  children
}: AdminDeliveryTrustWorkspaceProps) {
  const defaultHash = `#${ADMIN_NAVIGATION_ITEMS[0].id}`;
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

    const handleHashChange = () => {
      setCurrentHash(window.location.hash || defaultHash);
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [activeHash, defaultHash]);

  return (
    <AppShell
      workspaceTitle="SimWar 管理交付与信任"
      navigation={
        navigationEnabled ? (
          <RoleNavigation items={navigationItems} activeHref={currentHash} />
        ) : (
          <p className="admin-nav-denied">当前角色无管理导航</p>
        )
      }
      primaryAction={
        <span className="admin-shell-authority" aria-label="当前权限边界">
          <AuthorityBadge authority={authority} />
          {primaryAction}
        </span>
      }
    >
      <ContextBar context={context} />
      <StatePanel status={stateStatus} message={stateMessage} />
      {children}
      {knownLimits ? (
        <section
          id="admin-known-limits"
          aria-label="known limits product disclosure"
          aria-labelledby="admin-known-limits-heading"
        >
          <h2 id="admin-known-limits-heading">已知限制与内部使用说明</h2>
          {knownLimits}
        </section>
      ) : null}
      {environmentRecovery ? (
        <section
          id="admin-environment-recovery"
          aria-labelledby="admin-environment-recovery-heading"
        >
          <h2 id="admin-environment-recovery-heading">环境启动与恢复</h2>
          {environmentRecovery}
        </section>
      ) : null}
    </AppShell>
  );
}
