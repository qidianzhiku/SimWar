import { useEffect, useState } from "react";
import type { W4PathEvidence } from "@simwar/shared-contracts";

void import("@simwar/ui/w4-commercial.css");

interface Props {
  token: string;
  tenantId: string;
  courseId?: string | undefined;
  runId?: string | undefined;
  roundNo?: number | undefined;
  teamId?: string | undefined;
}

type Portfolio = {
  group: { tenant_id: string; portfolio_count: number };
  portfolios: Array<{
    course_id: string;
    run_id: string;
    enterprise_state_count: number;
    latest_state_ref: {
      enterprise_state_id: string;
      round_no: number;
      state_digest: string;
    } | null;
    portfolio: { projects: string[]; facilities: string[] };
    project_portfolio: Array<{
      project_entry_id: string;
      project_name: string;
      lifecycle_status: string;
      project_profile_reference: { project_profile_id: string; version: string };
    }>;
    project_transactions: Array<{
      transaction_id: string;
      kind: string;
      phase: string;
      project_entry_id: string;
    }>;
    capital_actions: Array<{
      capital_action_id: string;
      kind: string;
      status: string;
      principal: number;
      effective_round_no: number;
    }>;
    operating_units: Array<{ operating_unit_id: string; name: string; status: string }>;
    process_information: { status: string; activity_id: string };
    outcome_information: { status: string; opening_state_ref: unknown; closing_state_ref: unknown };
    team_paths: Array<{
      team_id: string;
      path_evidence: W4PathEvidence;
      process_information: { status: string; activity_id: string };
      outcome_information: {
        status: string;
        opening_state_ref: unknown;
        closing_state_ref: unknown;
      };
    }>;
    initiatives: Array<{
      initiative_id: string;
      kind: string;
      status: string;
      project_name: string | null;
    }>;
    writer_authority?: string;
  }>;
  writer_authority?: string;
};

type PanelStatus =
  | "loading"
  | "empty"
  | "partial"
  | "ready"
  | "blocked"
  | "permission"
  | "stale"
  | "conflict"
  | "dependency-missing"
  | "error"
  | "retry";

function statusLabel(status: PanelStatus): string {
  return {
    loading: "加载中",
    empty: "空状态",
    partial: "部分可用",
    ready: "就绪",
    blocked: "存在阻塞",
    permission: "权限受限",
    stale: "上下文过期",
    conflict: "上下文冲突",
    "dependency-missing": "依赖缺失",
    error: "加载失败",
    retry: "可重试"
  }[status];
}

function failureStatus(code: string): PanelStatus {
  if (code.includes("403") || code.includes("PERMISSION")) return "permission";
  if (code.includes("409") || code.includes("CONFLICT")) return "conflict";
  if (code.includes("NOT_FOUND")) return "dependency-missing";
  return "retry";
}

function stateValueLabel(value: string | undefined, fallback = "等待中"): string {
  if (!value) return fallback;
  return (
    (
      {
        ready: "已就绪",
        active: "进行中",
        in_progress: "进行中",
        draft: "待开始",
        pending: "待处理",
        blocked: "存在阻塞",
        completed: "已完成",
        failed: "处理失败",
        cancelled: "已取消",
        available: "可查看",
        empty: "暂无记录",
        official: "正式结果",
        proven: "已验证",
        not_observed: "尚未观察",
        approved: "已批准",
        construction: "建设中",
        activated: "已启用"
      } as Record<string, string>
    )[value.toLowerCase()] ?? value
  );
}

export function W4EnterprisePortfolioPanel({
  token,
  tenantId,
  courseId = "course_demo",
  runId,
  roundNo,
  teamId
}: Props) {
  const [projection, setProjection] = useState<Portfolio | null>(null);
  const [status, setStatus] = useState<PanelStatus>("dependency-missing");
  const [reloadVersion, setReloadVersion] = useState(0);
  useEffect(() => {
    if (!token) {
      setStatus("permission");
      setProjection(null);
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    fetch(
      `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"}/api/v1/bff/admin/w4/portfolio`,
      {
        headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId },
        signal: controller.signal
      }
    )
      .then(async (response) => {
        const envelope = (await response.json()) as { data?: Portfolio; code?: string };
        if (!response.ok) {
          const code = envelope.code ?? "W4-ADMIN-ERROR";
          setStatus(failureStatus(code));
          throw new Error(code);
        }
        setProjection(envelope.data ?? null);
        setStatus(envelope.data?.group.portfolio_count ? "ready" : "empty");
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setStatus((current) => (current === "loading" ? "error" : current));
      });
    return () => controller.abort();
  }, [courseId, reloadVersion, runId, roundNo, teamId, tenantId, token]);

  const portfolios = projection?.portfolios ?? [];
  const projectCount = portfolios.reduce((sum, item) => sum + item.portfolio.projects.length, 0);
  const operatingUnitCount = portfolios.reduce((sum, item) => sum + item.operating_units.length, 0);
  const initiativeCount = portfolios.reduce((sum, item) => sum + item.initiatives.length, 0);
  const capitalActionCount = portfolios.reduce((sum, item) => sum + item.capital_actions.length, 0);
  const transactionCount = portfolios.reduce(
    (sum, item) => sum + item.project_transactions.length,
    0
  );

  return (
    <section className="sw-w4-panel sw-w4-panel--admin" aria-label="项目组合审计">
      <div className="sw-w4-panel__header">
        <div>
          <p className="sw-w4-panel__eyebrow">管理员 · 只读审计</p>
          <h2 className="sw-w4-panel__title">项目组合总览</h2>
        </div>
        <strong className="sw-w4-panel__status" data-status={status}>
          {statusLabel(status)}
        </strong>
      </div>
      <p className="sw-w4-panel__description">
        按租户查看项目、运营单元与官方回放证据，默认不提供第二条写入路径。
      </p>
      <div className="sw-w4-metric-grid">
        <div className="sw-w4-metric">
          <span className="sw-w4-metric__label">租户范围</span>
          <strong className="sw-w4-metric__value">{projection?.group.tenant_id ?? tenantId}</strong>
        </div>
        <div className="sw-w4-metric">
          <span className="sw-w4-metric__label">项目组合</span>
          <strong className="sw-w4-metric__value">{projection?.group.portfolio_count ?? 0}</strong>
        </div>
        <div className="sw-w4-metric">
          <span className="sw-w4-metric__label">项目</span>
          <strong className="sw-w4-metric__value">{projectCount}</strong>
        </div>
        <div className="sw-w4-metric">
          <span className="sw-w4-metric__label">运营单元</span>
          <strong className="sw-w4-metric__value">{operatingUnitCount}</strong>
        </div>
        <div className="sw-w4-metric">
          <span className="sw-w4-metric__label">行动计划</span>
          <strong className="sw-w4-metric__value">{initiativeCount}</strong>
        </div>
        <div className="sw-w4-metric">
          <span className="sw-w4-metric__label">资本动作</span>
          <strong className="sw-w4-metric__value">{capitalActionCount}</strong>
        </div>
        <div className="sw-w4-metric">
          <span className="sw-w4-metric__label">项目交易</span>
          <strong className="sw-w4-metric__value">{transactionCount}</strong>
        </div>
        <div className="sw-w4-metric">
          <span className="sw-w4-metric__label">处理状态</span>
          <strong className="sw-w4-metric__value">
            {stateValueLabel(portfolios[0]?.process_information.status)}
          </strong>
        </div>
        <div className="sw-w4-metric">
          <span className="sw-w4-metric__label">结果状态</span>
          <strong className="sw-w4-metric__value">
            {stateValueLabel(portfolios[0]?.outcome_information.status)}
          </strong>
        </div>
      </div>
      <ul className="sw-w4-list" aria-label="项目组合列表">
        {portfolios.map((portfolio) => (
          <li key={`${portfolio.course_id}:${portfolio.run_id}`}>
            <strong>{portfolio.run_id}</strong> · 最新状态{" "}
            {portfolio.latest_state_ref?.enterprise_state_id ?? "待建立"} · 运营单元{" "}
            {portfolio.operating_units.map((unit) => unit.name).join("、") || "—"} · 项目{" "}
            {portfolio.portfolio.projects.join("、") || "—"} · 设施{" "}
            {portfolio.portfolio.facilities.join("、") || "—"}
          </li>
        ))}
      </ul>
      <ul className="sw-w4-list" aria-label="团队回放证据">
        {portfolios.flatMap((portfolio) =>
          portfolio.team_paths.map((path) => (
            <li key={`${portfolio.run_id}:${path.team_id}`}>
              {portfolio.run_id} / {path.team_id} · 起始与结束差异：
              {path.path_evidence.opening_vs_closing?.changed_paths.join("、") || "等待官方结算"} ·
              官方回放 {path.path_evidence.official_replay_path.replay_ids.length} 条 ·
              同一决策的历史差异：
              {stateValueLabel(
                path.path_evidence.same_current_decision_different_history.status,
                "未观察"
              )}
            </li>
          ))
        )}
      </ul>
      <ul className="sw-w4-list" aria-label="资本管线">
        {portfolios.flatMap((portfolio) =>
          portfolio.capital_actions.map((action) => (
            <li key={portfolio.run_id + ":" + action.capital_action_id}>
              {portfolio.run_id} · {action.kind} · {stateValueLabel(action.status)} · 生效回合{" "}
              {action.effective_round_no} · 本金 {action.principal}
            </li>
          ))
        )}
        {capitalActionCount === 0 ? <li>暂无资本动作记录</li> : null}
      </ul>
      <ul className="sw-w4-list" aria-label="项目交易审计">
        {portfolios.flatMap((portfolio) =>
          portfolio.project_transactions.map((transaction) => (
            <li key={portfolio.run_id + ":" + transaction.transaction_id}>
              {portfolio.run_id} · {transaction.kind} · {transaction.phase} ·{" "}
              {transaction.project_entry_id}
            </li>
          ))
        )}
        {transactionCount === 0 ? <li>暂无项目交易记录</li> : null}
      </ul>
      <p className="sw-w4-panel__note">
        写入 authority：{projection?.writer_authority ?? "SOLE_W4_ENTERPRISE_STATE_SERVICE"} · 管理员侧仅审计，
        不提供第二条真值写入路径。
      </p>
      {status === "retry" ||
      status === "dependency-missing" ||
      status === "error" ||
      status === "conflict" ? (
        <button
          className="sw-w4-panel__action"
          type="button"
          onClick={() => setReloadVersion((value) => value + 1)}
        >
          重新加载项目组合
        </button>
      ) : null}
      <p className="sw-w4-panel__note">
        本页面只读取已授权的项目组合与官方回放证据，不提供第二条写入路径。
      </p>
    </section>
  );
}
