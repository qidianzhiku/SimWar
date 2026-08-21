import { useCallback, useEffect, useState } from "react";
import type { AdminMarketWorldBindingsProjection } from "@simwar/shared-contracts";
import { getAdminSummaryErrorMessage, loadAdminMarketWorldBindings } from "./admin-bff";

interface MarketWorldAuditPanelProps {
  apiBase: string;
  tenantId: string;
  token: string;
}

export function MarketWorldAuditPanel({ apiBase, tenantId, token }: MarketWorldAuditPanelProps) {
  const [projection, setProjection] = useState<AdminMarketWorldBindingsProjection | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const next = await loadAdminMarketWorldBindings(token, (path, init) =>
        fetch(`${apiBase}${path}`, {
          ...init,
          headers: { ...init?.headers, "x-tenant-id": tenantId }
        })
      );
      setProjection(next);
      setStatus("ready");
    } catch (nextError) {
      setProjection(null);
      setError(getAdminSummaryErrorMessage(nextError));
      setStatus("error");
    }
  }, [apiBase, tenantId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="summary-panel" aria-label="Market World audit readiness">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">M2 · bounded audit projection</p>
          <h2>Market World 绑定与就绪度</h2>
        </div>
        {projection ? (
          <strong className="summary-badge">{projection.courses.length} 门课程</strong>
        ) : null}
      </div>
      {status === "loading" ? <p role="status">正在读取租户范围投影…</p> : null}
      {status === "error" ? (
        <div className="summary-error" role="alert">
          {error}
          <button type="button" className="secondary" onClick={() => void load()}>
            重试
          </button>
        </div>
      ) : null}
      {projection ? (
        <div className="summary-grid">
          {projection.courses.map((course) => (
            <article key={course.course_id} data-market-world-course={course.course_id}>
              <span>{course.course_id}</span>
              <strong>{course.binding_state}</strong>
              <small>{course.readiness.status}</small>
              <small>限制 {course.known_limits.length} 项</small>
            </article>
          ))}
        </div>
      ) : null}
      <p className="evidence-note">
        仅供租户范围审计与 readiness 判断；不展示 raw source、私有系数、其他队伍数据、score、rank 或
        settlement result。
      </p>
    </section>
  );
}
