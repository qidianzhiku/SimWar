import { useState, type FormEvent } from "react";
import type { ESLExactBinding, ESLResponse } from "@simwar/shared-contracts";

export interface ExecutiveStrategyLabWorkspaceProps {
  apiBase: string;
  binding: ESLExactBinding;
  tenantId: string;
  token: string;
}

const DEFAULT_PATHS = [
  {
    path_id: "path_priority_investment",
    label: "优先投资路径",
    decision_ids: ["decision_priority_investment"]
  },
  {
    path_id: "path_cash_protection",
    label: "现金保护路径",
    decision_ids: ["decision_cash_protection"]
  }
] as const;

interface Envelope {
  data?: ESLResponse;
  error?: { message?: string };
}

export function ExecutiveStrategyLabWorkspace({
  apiBase,
  binding,
  tenantId,
  token
}: ExecutiveStrategyLabWorkspaceProps) {
  const [hypothesis, setHypothesis] = useState("下一轮先验证服务质量与现金缓冲的平衡。 ".trim());
  const [result, setResult] = useState<ESLResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createLab(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/api/v1/bff/teacher/esl/strategy-lab`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-tenant-id": tenantId
        },
        body: JSON.stringify({
          discriminator: "esl_strategy_lab_request",
          exact_binding: binding,
          paths: DEFAULT_PATHS,
          transfer_hypothesis: hypothesis.trim(),
          idempotency_key: `esl-ui:${binding.run_id}:${binding.round_id}:${binding.team_id}`
        })
      });
      const payload = (await response.json()) as Envelope;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Executive Strategy Lab 创建失败");
      }
      setResult(payload.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Executive Strategy Lab 创建失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel form-panel esl-workspace" aria-label="Executive Strategy Lab">
      <div className="panel-title">
        <div>
          <p className="eyebrow">ESL · governed executive strategy</p>
          <h3>Executive Strategy Lab</h3>
        </div>
        <span className="technical-compatibility">official baseline + bounded alternatives</span>
      </div>
      <p className="lifecycle-boundary">
        在同一个精确运行上下文中，把官方 W4 基线、2 条受界定的 NON_OFFICIAL
        路径、机制差异和迁移假设放入同一工作台。 该工作台只生成候选与复盘投影，不改写正式结算真值。
      </p>
      <details>
        <summary>查看 exact context</summary>
        <dl className="esl-binding-list">
          {Object.entries(binding).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{Array.isArray(value) ? value.join(", ") : String(value)}</dd>
            </div>
          ))}
        </dl>
      </details>
      <form onSubmit={createLab} className="esl-form">
        <label>
          迁移假设
          <textarea
            value={hypothesis}
            onChange={(event) => setHypothesis(event.target.value)}
            maxLength={500}
            rows={3}
          />
        </label>
        <p className="lifecycle-status">
          将比较：{DEFAULT_PATHS.map((path) => path.label).join("、")}。
        </p>
        <button type="submit" disabled={busy || !hypothesis.trim()}>
          {busy ? "正在组合策略实验室…" : "打开 Executive Strategy Lab"}
        </button>
      </form>
      {error ? (
        <p role="alert" className="lifecycle-error">
          {error}
        </p>
      ) : null}
      {result?.teacher_projection ? (
        <div className="esl-result" data-testid="esl-teacher-result">
          <div className="esl-result-header">
            <h4>策略实验室候选已生成</h4>
            <code>{result.candidate_id}</code>
          </div>
          <div className="esl-card-grid">
            <article>
              <h5>官方基线</h5>
              <p>{result.teacher_projection.official_baseline.summary}</p>
              <span className="esl-badge">OFFICIAL</span>
            </article>
            <article>
              <h5>替代路径</h5>
              <p>{result.paths.length} 条 bounded NON_OFFICIAL 路径</p>
              <span className="esl-badge">NO WRITE</span>
            </article>
            <article>
              <h5>迁移假设</h5>
              <p>{result.teacher_projection.transfer.statement}</p>
              <span className="esl-badge">下一轮不自动应用</span>
            </article>
          </div>
          <div className="esl-path-list" aria-label="strategy alternative paths">
            {result.teacher_projection.paths.map((path) => (
              <article key={path.path_id}>
                <h5>{path.label}</h5>
                <p>{path.changed_paths.join("、") || "无可观察路径差异"}</p>
                <p>
                  现金差异：{path.outcome.cash_delta}；容量差异：{path.outcome.capacity_delta}
                </p>
              </article>
            ))}
          </div>
          <details>
            <summary>查看机制与已知限制</summary>
            <ul>
              {result.teacher_projection.mechanisms.map((mechanism) => (
                <li key={mechanism.mechanism_id}>
                  {mechanism.label}：{mechanism.explanation}
                </li>
              ))}
              {result.known_limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}
    </section>
  );
}
