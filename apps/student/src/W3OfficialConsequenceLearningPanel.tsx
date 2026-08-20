import { useEffect, useState } from "react";
import type {
  W3OfficialConsequenceContext,
  W3OfficialConsequenceResponse
} from "@simwar/shared-contracts";

type Props = {
  apiBase: string;
  token: string;
  tenantId: string;
  context?: W3OfficialConsequenceContext | undefined;
};

type PanelState =
  | { phase: "idle" | "loading" }
  | { phase: "ready"; response: W3OfficialConsequenceResponse }
  | { phase: "empty"; message: string }
  | { phase: "error"; message: string };

function contextQuery(context: W3OfficialConsequenceContext): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(context)) query.set(key, String(value));
  return query.toString();
}

function errorMessage(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
  ) {
    return value.message;
  }
  return "W3 官方结果暂不可用";
}

export function W3OfficialConsequenceLearningPanel(props: Props) {
  const [state, setState] = useState<PanelState>({ phase: "idle" });
  const [reflection, setReflection] = useState("");
  const [reflectionMessage, setReflectionMessage] = useState("");
  const [reflectionBusy, setReflectionBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    if (!props.context || !props.token || !props.tenantId) {
      setState({ phase: "idle" });
      return () => controller.abort();
    }

    setState({ phase: "loading" });
    fetch(`${props.apiBase}/api/v1/bff/student/w3/consequence?${contextQuery(props.context)}`, {
      headers: { authorization: `Bearer ${props.token}`, "x-tenant-id": props.tenantId },
      signal: controller.signal
    })
      .then(async (response) => {
        const envelope = (await response.json()) as {
          data?: W3OfficialConsequenceResponse;
          message?: string;
        };
        if (response.status === 404) {
          setState({ phase: "empty", message: envelope.message ?? "等待官方发布" });
          return;
        }
        if (!response.ok || !envelope.data)
          throw new Error(envelope.message ?? "W3 request failed");
        setState({ phase: "ready", response: envelope.data });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ phase: "error", message: errorMessage(error) });
      });

    return () => controller.abort();
  }, [props.apiBase, props.context, props.tenantId, props.token]);

  async function submitReflection(): Promise<void> {
    if (state.phase !== "ready" || !props.context || !reflection.trim()) return;
    setReflectionBusy(true);
    setReflectionMessage("正在保存 AI-off 反思");
    try {
      const response = await fetch(`${props.apiBase}/api/v1/bff/student/w3/reflection`, {
        body: JSON.stringify({
          context: props.context,
          idempotency_key: `w3-reflection-${state.response.record.record_id}`,
          prompt_id: "w3-reflection-off-v1",
          response: reflection.trim()
        }),
        headers: {
          authorization: `Bearer ${props.token}`,
          "content-type": "application/json",
          "x-tenant-id": props.tenantId
        },
        method: "POST"
      });
      const envelope = (await response.json()) as {
        data?: W3OfficialConsequenceResponse;
        message?: string;
      };
      if (!response.ok || !envelope.data)
        throw new Error(envelope.message ?? "reflection rejected");
      setState({ phase: "ready", response: envelope.data });
      setReflectionMessage("反思已记录，等待教师确认学习证据");
    } catch (error: unknown) {
      setReflectionMessage(errorMessage(error));
    } finally {
      setReflectionBusy(false);
    }
  }

  const record = state.phase === "ready" ? state.response.record : undefined;
  return (
    <section
      className="panel w3-consequence-panel"
      aria-label="W3 官方结果与决策学习"
      aria-busy={state.phase === "loading"}
    >
      <div className="panel-title">
        <div>
          <p className="eyebrow">W3 Official Consequence</p>
          <h2>官方结果与决策学习</h2>
        </div>
        <span role="status">
          {state.phase === "loading"
            ? "读取中"
            : state.phase === "ready"
              ? "已读取"
              : state.phase === "empty"
                ? "等待发布"
                : "待开始"}
        </span>
      </div>
      {!props.context ? (
        <p className="muted">等待 exact Course / Run / Round / Team 上下文。</p>
      ) : null}
      {state.phase === "loading" ? <p className="muted">正在读取真实 BFF 官方结果…</p> : null}
      {state.phase === "empty" ? (
        <p className="muted">{state.message}。结算但未发布时，学员结果保持不可见。</p>
      ) : null}
      {state.phase === "error" ? <p role="alert">{state.message}</p> : null}
      {record ? (
        <>
          <div className="status-grid">
            <div>
              <span>发布状态</span>
              <strong>{record.publication.status}</strong>
            </div>
            <div>
              <span>官方结果</span>
              <strong>{record.official_result.outcome_label}</strong>
            </div>
            <div>
              <span>分数</span>
              <strong>{record.official_result.score}</strong>
            </div>
            <div>
              <span>排名</span>
              <strong>{record.official_result.rank}</strong>
            </div>
          </div>
          <article className="candidate-preview" aria-label="W3 decision story">
            <strong>Decision Story</strong>
            <p>{record.decision_story.decision_summary}</p>
            <p>{record.decision_story.consequence_summary}</p>
            <span>因果标签：{record.causal_debrief.label}</span>
          </article>
          <div className="evidence-note">
            <strong>Exact source</strong>
            <small>
              Decision {record.source.canonical_decision_ref.resource_id} · Round{" "}
              {record.source.round_ref.resource_id} · Settlement{" "}
              {record.source.settlement_ref.resource_id}
            </small>
          </div>
          {record.publication.status === "PUBLISHED" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitReflection();
              }}
            >
              <label className="field-label" htmlFor="w3-student-reflection">
                <span>我的反思（AI-off）</span>
                <textarea
                  id="w3-student-reflection"
                  value={reflection}
                  maxLength={2000}
                  onChange={(event) => setReflection(event.target.value)}
                  placeholder="记录一个观察到的决策与结果联系"
                />
              </label>
              <button
                className="primary"
                type="submit"
                disabled={reflectionBusy || !reflection.trim()}
              >
                {reflectionBusy ? "保存中" : record.reflection ? "更新反思" : "提交反思"}
              </button>
              <p role="status">
                {reflectionMessage || (record.reflection ? "已提交反思" : "尚未提交反思")}
              </p>
            </form>
          ) : (
            <p className="muted">官方结果尚未发布，反思入口保持关闭。</p>
          )}
          <ul className="known-limits-disclosure" aria-label="W3 known limits">
            {record.known_limits.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
