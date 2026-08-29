import { useEffect, useState, type FormEvent } from "react";
import type { ESLExactBinding, ESLPathRequest, ESLResponse } from "@simwar/shared-contracts";

export interface ExecutiveStrategyLabWorkspaceProps {
  apiBase: string;
  binding: ESLExactBinding;
  tenantId: string;
  token: string;
}

interface Envelope {
  data?: ESLResponse;
  error?: { message?: string };
}

interface M4PathEnvelope {
  data?: { paths?: ESLPathRequest[] };
  error?: { message?: string; code?: string };
}

export function ExecutiveStrategyLabWorkspace({
  apiBase,
  binding,
  tenantId,
  token
}: ExecutiveStrategyLabWorkspaceProps) {
  const [hypothesis, setHypothesis] = useState("下一轮先验证服务质量与现金缓冲的平衡。 ".trim());
  const [result, setResult] = useState<ESLResponse | null>(null);
  const [availablePaths, setAvailablePaths] = useState<ESLPathRequest[] | null>(null);
  const [pathsBusy, setPathsBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAvailablePaths(null);
    setResult(null);
    setError(null);
  }, [
    apiBase,
    binding.course_id,
    binding.run_id,
    binding.team_id,
    binding.round_id,
    binding.round_no,
    tenantId,
    token
  ]);

  async function discoverAvailablePaths(): Promise<ESLPathRequest[]> {
    const query = new URLSearchParams({
      course_id: binding.course_id,
      team_id: binding.team_id,
      round_id: binding.round_id,
      round_no: String(binding.round_no)
    });
    const response = await fetch(
      `${apiBase}/api/v1/bff/teacher/w4/runs/${encodeURIComponent(binding.run_id)}/multipath-counterfactual-transfer?${query.toString()}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          "x-tenant-id": tenantId
        }
      }
    );
    const payload = (await response.json()) as M4PathEnvelope;
    if (!response.ok || !payload.data?.paths || payload.data.paths.length < 2) {
      throw new Error(payload.error?.message ?? "当前 exact run 没有足够的真实替代决策路径");
    }
    return payload.data.paths.slice(0, 3);
  }

  async function createLab(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let paths = availablePaths;
    if (!paths) {
      setPathsBusy(true);
      setError(null);
      try {
        paths = await discoverAvailablePaths();
        setAvailablePaths(paths);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "真实替代决策路径加载失败");
        return;
      } finally {
        setPathsBusy(false);
      }
    }
    if (paths.length < 2) return;
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
          paths,
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
        <span className="technical-compatibility">
          {pathsBusy ? "discovering exact alternatives" : "official baseline + bounded alternatives"}
        </span>
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
          将比较：{availablePaths?.map((path) => path.label).join("、") ?? "点击按钮后发现当前 run 的真实路径"}。
        </p>
        <button
          type="submit"
          disabled={busy || pathsBusy || !hypothesis.trim()}
        >
          {pathsBusy
            ? "正在发现真实替代路径…"
            : busy
              ? "正在组合策略实验室…"
              : "打开 Executive Strategy Lab"}
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
