import { useEffect, useState } from "react";
import type { W4PathEvidence } from "@simwar/shared-contracts";

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
  }>;
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

  return (
    <section className="summary-panel" aria-label="W4 Enterprise portfolio">
      <div className="summary-heading">
        <h2>Enterprise Portfolio 投影</h2>
        <strong className="summary-badge">{statusLabel(status)}</strong>
      </div>
      <div className="summary-grid">
        <div>
          <span>Group</span>
          <strong>{projection?.group.tenant_id ?? tenantId}</strong>
        </div>
        <div>
          <span>Portfolio</span>
          <strong>{projection?.group.portfolio_count ?? 0}</strong>
        </div>
        <div>
          <span>Projects</span>
          <strong>
            {projection?.portfolios.reduce(
              (sum, item) => sum + item.portfolio.projects.length,
              0
            ) ?? 0}
          </strong>
        </div>
        <div>
          <span>OperatingUnit</span>
          <strong>
            {projection?.portfolios.reduce((sum, item) => sum + item.operating_units.length, 0) ??
              0}
          </strong>
        </div>
        <div>
          <span>Initiatives</span>
          <strong>
            {projection?.portfolios.reduce((sum, item) => sum + item.initiatives.length, 0) ?? 0}
          </strong>
        </div>
        <div>
          <span>Process Information</span>
          <strong>{projection?.portfolios[0]?.process_information.status ?? "等待中"}</strong>
        </div>
        <div>
          <span>Outcome Information</span>
          <strong>{projection?.portfolios[0]?.outcome_information.status ?? "等待中"}</strong>
        </div>
      </div>
      <ul className="compact-list">
        {(projection?.portfolios ?? []).map((portfolio) => (
          <li key={`${portfolio.course_id}:${portfolio.run_id}`}>
            {portfolio.run_id} · State {portfolio.latest_state_ref?.enterprise_state_id ?? "—"} ·
            OperatingUnit {portfolio.operating_units.map((unit) => unit.name).join(", ") || "—"} ·
            Project {portfolio.portfolio.projects.join(", ") || "—"} · Facility{" "}
            {portfolio.portfolio.facilities.join(", ") || "—"}
          </li>
        ))}
      </ul>
      <ul className="compact-list">
        {(projection?.portfolios ?? []).flatMap((portfolio) =>
          portfolio.team_paths.map((path) => (
            <li key={`${portfolio.run_id}:${path.team_id}`}>
              {portfolio.run_id} / {path.team_id} · Opening/Closing diff{" "}
              {path.path_evidence.opening_vs_closing?.changed_paths.join(", ") || "等待官方结算"} ·
              Replay {path.path_evidence.official_replay_path.replay_ids.length} · 同一决策不同历史{" "}
              {path.path_evidence.same_current_decision_different_history.status}
            </li>
          ))
        )}
      </ul>
      {status === "retry" ||
      status === "dependency-missing" ||
      status === "error" ||
      status === "conflict" ? (
        <button type="button" onClick={() => setReloadVersion((value) => value + 1)}>
          重新加载 Enterprise Portfolio
        </button>
      ) : null}
      <p className="evidence-note">
        Group / Portfolio / Project / Facility 仅由 W4 Role BFF 投影读取；Admin
        不具备第二个写入路径。
      </p>
    </section>
  );
}
