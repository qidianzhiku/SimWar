import { useEffect, useState } from "react";

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
    initiatives: Array<{
      initiative_id: string;
      kind: string;
      status: string;
      project_name: string | null;
    }>;
  }>;
};

export function W4EnterprisePortfolioPanel({
  token,
  tenantId,
  courseId = "course_demo",
  runId,
  roundNo,
  teamId
}: Props) {
  const [projection, setProjection] = useState<Portfolio | null>(null);
  const [status, setStatus] = useState("等待上下文");
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setStatus("加载中");
    fetch(
      `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"}/api/v1/bff/admin/w4/portfolio`,
      {
        headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId },
        signal: controller.signal
      }
    )
      .then(async (response) => {
        const envelope = (await response.json()) as { data?: Portfolio; code?: string };
        if (!response.ok) throw new Error(envelope.code ?? "W4-ADMIN-ERROR");
        setProjection(envelope.data ?? null);
        setStatus(envelope.data?.group.portfolio_count ? "就绪" : "空状态");
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setStatus(error instanceof Error ? error.message : "加载失败");
      });
    return () => controller.abort();
  }, [courseId, runId, roundNo, teamId, tenantId, token]);

  return (
    <section className="summary-panel" aria-label="W4 Enterprise portfolio">
      <div className="summary-heading">
        <h2>Enterprise Portfolio 投影</h2>
        <strong className="summary-badge">{status}</strong>
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
      <p className="evidence-note">
        Group / Portfolio / Project / Facility 仅由 W4 Role BFF 投影读取；Admin
        不具备第二个写入路径。
      </p>
    </section>
  );
}
