import { useEffect, useState } from "react";
import type {
  W3ExactRef,
  W3OfficialConsequenceContext,
  W3OfficialConsequenceResponse
} from "@simwar/shared-contracts";

type Props = {
  apiBase: string;
  token: string;
  tenantId: string;
  context?: W3OfficialConsequenceContext | undefined;
};
type Phase = "idle" | "loading" | "ready" | "error";

function contextQuery(context: W3OfficialConsequenceContext): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(context)) query.set(key, String(value));
  return query.toString();
}

function message(value: unknown): string {
  return value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
    ? value.message
    : "W3 请求失败";
}

export function W3OfficialConsequenceLearningWorkbench(props: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [response, setResponse] = useState<W3OfficialConsequenceResponse | null>(null);
  const [notice, setNotice] = useState("等待 exact round context");
  const [changedField, setChangedField] = useState("marketing_budget");
  const [changedValue, setChangedValue] = useState("120");
  const [evidenceJson, setEvidenceJson] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    if (!props.context || !props.token || !props.tenantId) {
      setPhase("idle");
      return () => controller.abort();
    }
    setPhase("loading");
    fetch(`${props.apiBase}/api/v1/bff/teacher/w3/consequence?${contextQuery(props.context)}`, {
      headers: { authorization: `Bearer ${props.token}`, "x-tenant-id": props.tenantId },
      signal: controller.signal
    })
      .then(async (result) => {
        const envelope = (await result.json()) as {
          data?: W3OfficialConsequenceResponse;
          message?: string;
        };
        if (!result.ok || !envelope.data) throw new Error(envelope.message ?? "W3 request failed");
        setResponse(envelope.data);
        setPhase("ready");
        setNotice("已读取 teacher-safe official consequence");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPhase("error");
        setNotice(message(error));
      });
    return () => controller.abort();
  }, [props.apiBase, props.context, props.tenantId, props.token]);

  async function post(path: string, body: Record<string, unknown>): Promise<void> {
    setPhase("loading");
    try {
      const result = await fetch(`${props.apiBase}${path}`, {
        body: JSON.stringify(body),
        headers: {
          authorization: `Bearer ${props.token}`,
          "content-type": "application/json",
          "x-tenant-id": props.tenantId
        },
        method: "POST"
      });
      const envelope = (await result.json()) as {
        data?: W3OfficialConsequenceResponse;
        message?: string;
      };
      if (!result.ok || !envelope.data) throw new Error(envelope.message ?? "W3 command rejected");
      setResponse(envelope.data);
      setPhase("ready");
      setNotice("操作已记录，官方 settlement 未被覆盖");
    } catch (error: unknown) {
      setPhase("error");
      setNotice(message(error));
    }
  }

  async function createCounterfactual(): Promise<void> {
    if (!props.context || !response) return;
    const numeric = Number(changedValue);
    const value =
      changedField === "capacity_plan"
        ? changedValue
        : Number.isFinite(numeric)
          ? numeric
          : changedValue;
    await post("/api/v1/bff/teacher/w3/counterfactual", {
      changed_field: changedField,
      changed_value: value,
      context: props.context,
      idempotency_key: `w3-counterfactual-${response.record.record_id}-${changedField}-${changedValue}`
    });
  }

  async function selectEvidence(): Promise<void> {
    if (!props.context || !response) return;
    try {
      const refs = JSON.parse(evidenceJson) as W3ExactRef[];
      await post("/api/v1/bff/teacher/w3/evidence-selection", {
        context: props.context,
        evidence_refs: refs,
        idempotency_key: `w3-evidence-${response.record.record_id}-${evidenceJson}`
      });
    } catch (error: unknown) {
      setPhase("error");
      setNotice(
        error instanceof Error
          ? `Evidence Ref JSON 无效：${error.message}`
          : "Evidence Ref JSON 无效"
      );
    }
  }

  async function prepareHypothesis(): Promise<void> {
    if (!props.context) return;
    await post("/api/v1/bff/teacher/w3/next-round-hypothesis", { context: props.context });
  }

  const record = response?.record;
  return (
    <section
      className="panel w3-consequence-workbench"
      aria-label="W3 官方后果与决策学习工作台"
      aria-busy={phase === "loading"}
    >
      <div className="panel-title">
        <div>
          <p className="eyebrow">W3 Official Consequence</p>
          <h2>官方后果与决策学习工作台</h2>
        </div>
        <span role="status">{notice}</span>
      </div>
      {!props.context ? (
        <p className="muted">选择 exact Course / Run / Round / Team 后读取。</p>
      ) : null}
      {phase === "error" ? <p role="alert">{notice}</p> : null}
      {record ? (
        <>
          <div className="status-grid">
            <div>
              <span>结算/发布</span>
              <strong>{record.publication.status}</strong>
            </div>
            <div>
              <span>安全结果</span>
              <strong>{record.official_result.outcome_label}</strong>
            </div>
            <div>
              <span>学习确认</span>
              <strong>{record.learning.teacher_confirmation_status}</strong>
            </div>
            <div>
              <span>下一轮假设</span>
              <strong>{record.learning.next_round_hypothesis_status}</strong>
            </div>
          </div>
          <article className="candidate-preview" aria-label="teacher decision story">
            <strong>Decision Story</strong>
            <p>{record.decision_story.decision_summary}</p>
            <p>{record.decision_story.consequence_summary}</p>
            <small>
              因果标签：{record.causal_debrief.label}；只表达模型条件关联，不构成因果证明。
            </small>
          </article>
          <div className="evidence-note">
            <strong>Exact source refs</strong>
            <small>
              {record.source.canonical_decision_ref.resource_id} /{" "}
              {record.source.round_ref.resource_id} / {record.source.settlement_ref.resource_id}
            </small>
          </div>
          {record.publication.status === "PUBLISHED" ? (
            <div className="workspace">
              <article className="candidate-surface" aria-label="bounded counterfactual">
                <h3>一次单变量 Counterfactual</h3>
                <label className="field-label">
                  <span>改变字段</span>
                  <select
                    value={changedField}
                    onChange={(event) => setChangedField(event.target.value)}
                  >
                    <option value="capacity_plan">capacity_plan</option>
                    <option value="cash_buffer_target">cash_buffer_target</option>
                    <option value="marketing_budget">marketing_budget</option>
                    <option value="pricing.base_price">pricing.base_price</option>
                    <option value="service_quality_budget">service_quality_budget</option>
                  </select>
                </label>
                <label className="field-label">
                  <span>新值</span>
                  <input
                    value={changedValue}
                    onChange={(event) => setChangedValue(event.target.value)}
                  />
                </label>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => void createCounterfactual()}
                >
                  运行隔离预览
                </button>
                {record.counterfactual ? (
                  <p role="status">
                    已生成非官方比较：score Δ {record.counterfactual.comparison.score_delta} / rank
                    Δ {record.counterfactual.comparison.rank_delta}
                  </p>
                ) : null}
              </article>
              <article className="candidate-surface" aria-label="teacher evidence selection">
                <h3>选择 EvidenceArtifact</h3>
                <label className="field-label">
                  <span>Exact Ref JSON 数组</span>
                  <textarea
                    value={evidenceJson}
                    onChange={(event) => setEvidenceJson(event.target.value)}
                    placeholder='[{"resource_id":"...","resource_type":"evidence_artifact",...}]'
                  />
                </label>
                <button
                  className="secondary"
                  type="button"
                  disabled={!evidenceJson.trim()}
                  onClick={() => void selectEvidence()}
                >
                  记录证据选择
                </button>
                <p role="status">
                  {record.learning.evidence_selection_status === "SELECTED"
                    ? "已选择证据"
                    : "尚未选择证据"}
                </p>
              </article>
              <article className="candidate-surface" aria-label="next round hypothesis">
                <h3>下一轮假设</h3>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => void prepareHypothesis()}
                >
                  准备假设状态
                </button>
                <p role="status">
                  {record.next_round_hypothesis?.hypothesis ?? "等待反思、证据选择与教师确认"}
                </p>
              </article>
            </div>
          ) : (
            <p className="muted">
              Round 已结算但未发布，Teacher 仅可预览，Counterfactual 与学习入口保持受控。
            </p>
          )}
          <ul className="known-limits-disclosure" aria-label="W3 teacher known limits">
            {record.known_limits.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
