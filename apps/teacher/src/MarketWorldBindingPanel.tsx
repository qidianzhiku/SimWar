import { useCallback, useEffect, useState } from "react";
import type {
  ApiEnvelope,
  MarketWorldBindingReceipt,
  TeacherMarketWorldProjection
} from "@simwar/shared-contracts";

interface MarketWorldBindingPanelProps {
  apiBase: string;
  courseId: string | null | undefined;
  tenantId: string;
  token: string;
}

type PanelState =
  | { phase: "idle" | "loading" }
  | { phase: "ready"; projection: TeacherMarketWorldProjection }
  | { phase: "error"; message: string };

async function readEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) {
    throw new Error(`${String(envelope.code)}: ${envelope.message}`);
  }
  return envelope;
}

export function MarketWorldBindingPanel({
  apiBase,
  courseId,
  tenantId,
  token
}: MarketWorldBindingPanelProps) {
  const [state, setState] = useState<PanelState>({ phase: "idle" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!courseId || !token) {
      setState({ phase: "idle" });
      return;
    }
    setState({ phase: "loading" });
    try {
      const response = await fetch(
        `${apiBase}/api/v1/bff/teacher/courses/${encodeURIComponent(courseId)}/market-world`,
        {
          headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId }
        }
      );
      const envelope = await readEnvelope<TeacherMarketWorldProjection>(response);
      setState({ phase: "ready", projection: envelope.data });
    } catch (error) {
      setState({
        phase: "error",
        message: error instanceof Error ? error.message : "Market World 暂不可用"
      });
    }
  }, [apiBase, courseId, tenantId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function bind() {
    if (state.phase !== "ready" || !courseId || busy) return;
    const candidate = state.projection.available_market_worlds[0];
    if (!candidate) return;
    setBusy(true);
    try {
      const response = await fetch(
        `${apiBase}/api/v1/bff/teacher/courses/${encodeURIComponent(courseId)}/market-world-binding`,
        {
          body: JSON.stringify({ market_world_reference: candidate.market_world_reference }),
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            "x-tenant-id": tenantId
          },
          method: "POST"
        }
      );
      await readEnvelope<MarketWorldBindingReceipt>(response);
      await load();
    } catch (error) {
      setState({
        phase: "error",
        message: error instanceof Error ? error.message : "绑定失败"
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="summary-panel" aria-label="Shanghai Market World binding">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">M2 · Product Join</p>
          <h2>上海养老 Market World</h2>
        </div>
        {state.phase === "ready" ? (
          <strong className="summary-badge">{state.projection.binding_state}</strong>
        ) : null}
      </div>
      {state.phase === "idle" ? <p className="muted">选择课程后加载 Market World。</p> : null}
      {state.phase === "loading" ? <p role="status">正在读取精确 MarketWorldRef…</p> : null}
      {state.phase === "error" ? (
        <div className="summary-error" role="alert">
          <strong>Market World 读取失败</strong>
          <span>{state.message}</span>
          <button type="button" className="secondary" onClick={() => void load()}>
            重试
          </button>
        </div>
      ) : null}
      {state.phase === "ready" ? (
        <>
          <div className="summary-grid">
            <article>
              <span>版本</span>
              <strong>
                {state.projection.available_market_worlds[0]?.market_world_reference.version}
              </strong>
            </article>
            <article>
              <span>准备度</span>
              <strong>{state.projection.readiness.status}</strong>
            </article>
            <article>
              <span>覆盖区</span>
              <strong>{state.projection.geo_market.node_count}</strong>
            </article>
            <article>
              <span>绑定课程</span>
              <strong>{state.projection.course_id}</strong>
            </article>
          </div>
          <p>{state.projection.market_structure}</p>
          <p className="evidence-note">
            仅展示产品化、角色安全的摘要；raw
            source、私有校准、结算真值与其他队伍数据均不进入此面板。
          </p>
          <details>
            <summary>查看已知限制</summary>
            <ul>
              {state.projection.known_limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </details>
          <button
            type="button"
            disabled={busy || state.projection.binding_state === "BOUND"}
            onClick={() => void bind()}
          >
            {busy
              ? "正在绑定…"
              : state.projection.binding_state === "BOUND"
                ? "已绑定精确版本"
                : "绑定到当前 Course"}
          </button>
        </>
      ) : null}
    </section>
  );
}
