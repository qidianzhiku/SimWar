import { useEffect, useState } from "react";
import type { ESLResponse } from "@simwar/shared-contracts";

export interface ExecutiveStrategyLabProjectionProps {
  apiBase: string;
  candidateId: string;
  tenantId: string;
  token: string;
}

interface Envelope {
  data?: ESLResponse;
  error?: { message?: string };
}

export function ExecutiveStrategyLabProjection({
  apiBase,
  candidateId,
  tenantId,
  token
}: ExecutiveStrategyLabProjectionProps) {
  const [result, setResult] = useState<ESLResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!candidateId.trim()) return;
    const controller = new AbortController();
    void fetch(`${apiBase}/api/v1/bff/student/esl/candidates/${encodeURIComponent(candidateId)}`, {
      headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId },
      signal: controller.signal
    })
      .then(async (response) => {
        const payload = (await response.json()) as Envelope;
        if (!response.ok || !payload.data)
          throw new Error(payload.error?.message ?? "策略实验室投影加载失败");
        setResult(payload.data);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : "策略实验室投影加载失败");
      });
    return () => controller.abort();
  }, [apiBase, candidateId, tenantId, token]);

  return (
    <section
      className="panel form-panel esl-workspace"
      aria-label="Student Executive Strategy Lab projection"
    >
      <div className="panel-title">
        <div>
          <p className="eyebrow">Student · role-safe strategy reflection</p>
          <h3>策略实验室学习投影</h3>
        </div>
        <span className="technical-compatibility">role-safe · Provider OFF</span>
      </div>
      {!candidateId ? <p className="lifecycle-status">等待教师发布一个策略实验室候选。</p> : null}
      {error ? (
        <p role="alert" className="lifecycle-error">
          {error}
        </p>
      ) : null}
      {result?.student_projection ? (
        <div className="esl-result" data-testid="esl-student-result">
          <p>
            <strong>角色：</strong>
            {result.student_projection.role_key ?? "已授权角色"}
          </p>
          <p>{result.student_projection.official_baseline.summary}</p>
          <div className="esl-path-list">
            {result.student_projection.paths.map((path) => (
              <article key={path.path_id}>
                <h5>{path.label}</h5>
                <p>{path.changed_paths.join("、") || "无可观察路径差异"}</p>
                <p>
                  现金差异：{path.outcome.cash_delta}；容量差异：{path.outcome.capacity_delta}
                </p>
                <p>
                  <strong>资本可行性：</strong>
                  {path.finance_feasibility.feasibility}
                </p>
                <p>{path.finance_feasibility.capital_tradeoff_summary}</p>
                <p>
                  <strong>可用现金余量：</strong>
                  {path.finance_feasibility.liquidity_headroom.status === "KNOWN"
                    ? `${path.finance_feasibility.liquidity_headroom.amount ?? "UNKNOWN"} ${path.finance_feasibility.liquidity_headroom.unit}`
                    : "UNKNOWN（当前资本基础不足）"}
                </p>
                <ul>
                  {path.finance_feasibility.stress_regimes.map((regime) => (
                    <li key={regime.regime_id}>
                      {regime.regime_id}：{regime.feasibility} / {regime.covenant_status}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <p>
            <strong>我的迁移假设：</strong>
            {result.student_projection.transfer.statement}
          </p>
          <details>
            <summary>查看学习边界</summary>
            <ul>
              {result.student_projection.excluded_fields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}
    </section>
  );
}
