import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ApiEnvelope,
  W5ConvergenceProjection,
  W5GovernedModelTeacherProjection,
  W5ScenarioDraft
} from "@simwar/shared-contracts";

interface Props {
  apiBase: string;
  courseId?: string | null | undefined;
  roundNo?: number | undefined;
  runId?: string | null | undefined;
  tenantId: string;
  token: string;
}

interface ApiOptions {
  body?: unknown;
  method?: "GET" | "POST";
}

async function request<TData>(
  apiBase: string,
  tenantId: string,
  token: string,
  path: string,
  options: ApiOptions = {}
): Promise<TData> {
  const response = await fetch(`${apiBase}${path}`, {
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-tenant-id": tenantId
    },
    method: options.method ?? "GET"
  });
  const envelope = (await response.json()) as ApiEnvelope<TData>;
  if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
  return envelope.data;
}

function statusLabel(status: W5ScenarioDraft["status"] | "idle"): string {
  return {
    BOUND: "已精确绑定",
    DRAFT: "草稿",
    FROZEN: "已冻结",
    IDLE: "未创建",
    VALIDATED: "已验证"
  }[status === "idle" ? "IDLE" : status];
}

function convergenceRows(convergence: W5ConvergenceProjection | null): Array<[string, string]> {
  if (!convergence) return [];
  return [
    ["WANT 候选", `${convergence.want.candidate_value} · 非正式`],
    ["CAN 约束", `${convergence.can.eligible ? "eligible" : "blocked"} · 非正式`],
    [
      "REALIZED 权威",
      `${convergence.realized.authority} · formal=${convergence.realized.official}`
    ],
    ["Replay identity", convergence.replay.exact_identity],
    ["Fallback", convergence.fallback.applied ? "PLANE_OFF · core continues" : "PLANE_ON"],
    [
      "Shadow",
      `${convergence.shadow.plane} · overwrite=${convergence.shadow.overwrites_official_result}`
    ],
    [
      "Demand candidate",
      `${convergence.demand_realization.candidate.status} · ${convergence.demand_realization.candidate.market_count} market`
    ]
  ];
}

const breakableTextStyle = {
  display: "block" as const,
  maxWidth: "100%",
  minWidth: 0,
  overflowWrap: "anywhere" as const,
  wordBreak: "break-word" as const
};

export function W5GovernedModelStudio({
  apiBase,
  courseId,
  roundNo,
  runId,
  tenantId,
  token
}: Props) {
  const [projection, setProjection] = useState<W5GovernedModelTeacherProjection | null>(null);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [convergence, setConvergence] = useState<W5ConvergenceProjection | null>(null);
  const [notice, setNotice] = useState("等待课程上下文");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!courseId || !token) {
      setProjection(null);
      setSelectedDraftId(null);
      setNotice("需要课程和教师登录上下文");
      return;
    }
    try {
      const data = await request<W5GovernedModelTeacherProjection>(
        apiBase,
        tenantId,
        token,
        `/api/v1/bff/teacher/w5/governed-model?courseId=${encodeURIComponent(courseId)}`
      );
      setProjection(data);
      setSelectedDraftId((current) =>
        current && data.drafts.some((draft) => draft.draft_id === current)
          ? current
          : (data.drafts.at(-1)?.draft_id ?? null)
      );
      setNotice(data.drafts.length ? "Studio 已加载" : "尚未创建 W5 草稿");
    } catch (error) {
      setProjection(null);
      setNotice(error instanceof Error ? error.message : "W5 Studio 加载失败");
    }
  }, [apiBase, courseId, tenantId, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setConvergence(null);
  }, [courseId, roundNo, runId, selectedDraftId]);

  const draft = useMemo(
    () => projection?.drafts.find((candidate) => candidate.draft_id === selectedDraftId) ?? null,
    [projection, selectedDraftId]
  );

  async function act(action: "create" | "validate" | "freeze" | "bind" | "evaluate") {
    if (!courseId) return;
    setBusy(true);
    try {
      if (action === "create") {
        const data = await request<{ draft: W5ScenarioDraft }>(
          apiBase,
          tenantId,
          token,
          "/api/v1/bff/teacher/w5/scenario-studio/drafts",
          { body: { course_id: courseId, title: "上海受控模型 Studio" }, method: "POST" }
        );
        setSelectedDraftId(data.draft.draft_id);
        setNotice("草稿已创建");
      } else {
        if (!draft) return;
        if ((action === "bind" || action === "evaluate") && (!runId || roundNo === undefined)) {
          setNotice("需要显式 runId 与 roundNo 才能精确绑定或评估");
          return;
        }
        const body =
          action === "bind"
            ? { round_no: roundNo, run_id: runId }
            : action === "evaluate"
              ? { experience_profile: "STANDARD", round_no: roundNo, run_id: runId }
              : undefined;
        const data = await request<
          { draft: W5ScenarioDraft } | { convergence: W5ConvergenceProjection }
        >(
          apiBase,
          tenantId,
          token,
          `/api/v1/bff/teacher/w5/scenario-studio/drafts/${draft.draft_id}/${action}`,
          { ...(body === undefined ? {} : { body }), method: "POST" }
        );
        if ("convergence" in data) setConvergence(data.convergence);
        setNotice(`${action} 已完成`);
      }
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "W5 Studio 操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function evaluate(profile: "STANDARD" | "ADVANCED", modelPlane: "ON" | "OFF" = "ON") {
    if (!draft || !runId || roundNo === undefined) {
      setNotice("需要冻结草稿、runId 和 roundNo 才能评估");
      return;
    }
    setBusy(true);
    try {
      const data = await request<{ convergence: W5ConvergenceProjection }>(
        apiBase,
        tenantId,
        token,
        `/api/v1/bff/teacher/w5/scenario-studio/drafts/${draft.draft_id}/evaluate`,
        {
          body: {
            experience_profile: profile,
            model_plane: modelPlane,
            round_no: roundNo,
            run_id: runId
          },
          method: "POST"
        }
      );
      setConvergence(data.convergence);
      setNotice(`${profile} / ${modelPlane} 已评估；REALIZED 仍由 Simulation Core 产生`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "W5 评估失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="w5-governed-model-studio" aria-label="W5 Governed Model Studio">
      <header className="w5-studio-header">
        <div>
          <p className="eyebrow">W5 · Shanghai governed model</p>
          <h2>受控模型 Scenario Studio</h2>
          <p className="evidence-note">
            Teacher-only governance plane：WANT/CAN 为非正式候选，REALIZED 只能来自 Simulation
            Core。
          </p>
        </div>
        <span className="w5-status-tag">{notice}</span>
      </header>

      <div className="w5-studio-actions">
        <button disabled={busy || !courseId} onClick={() => void act("create")}>
          创建草稿
        </button>
        <button
          disabled={busy || !draft || draft.status !== "DRAFT"}
          onClick={() => void act("validate")}
        >
          验证草稿
        </button>
        <button
          disabled={busy || !draft || draft.status !== "VALIDATED"}
          onClick={() => void act("freeze")}
        >
          冻结草稿
        </button>
        <button
          disabled={busy || !draft || draft.status !== "FROZEN" || !runId || roundNo === undefined}
          onClick={() => void act("bind")}
        >
          精确绑定当前 Run
        </button>
      </div>

      {projection ? (
        <>
          <div className="w5-studio-meta">
            <span style={breakableTextStyle}>
              ModelVersion: {projection.model_version.model_version_ref}
            </span>
            <span style={breakableTextStyle}>
              Draft: {draft ? `${draft.draft_id} · ${statusLabel(draft.status)}` : "未选择"}
            </span>
            <span style={breakableTextStyle}>
              Run: {runId ?? "未选择"} / Round: {roundNo ?? "未选择"}
            </span>
          </div>
          <section className="w5-model-readiness" aria-label="W5 model readiness">
            <h3>模型家族 readiness</h3>
            <div className="w5-parameter-grid">
              {projection.model_version.model_family_readiness.map((family) => (
                <article key={family.family} className="w5-parameter-card">
                  <strong style={breakableTextStyle}>{family.family}</strong>
                  <span style={breakableTextStyle}>
                    {family.activation_claim} · {family.classification} · invocation=
                    {family.invocation_proven ? "proven" : "not proven"}
                  </span>
                  <small style={breakableTextStyle}>{family.known_limit}</small>
                </article>
              ))}
            </div>
          </section>
          <label className="w5-draft-select">
            当前草稿
            <select
              value={selectedDraftId ?? ""}
              onChange={(event) => setSelectedDraftId(event.target.value || null)}
            >
              <option value="">请选择</option>
              {projection.drafts.map((candidate) => (
                <option key={candidate.draft_id} value={candidate.draft_id}>
                  {candidate.title} · {candidate.status}
                </option>
              ))}
            </select>
          </label>
          <div className="w5-parameter-grid">
            {projection.parameter_descriptors.map((parameter) => (
              <article key={parameter.key} className="w5-parameter-card">
                <strong style={breakableTextStyle}>{parameter.label}</strong>
                <span style={breakableTextStyle}>
                  {parameter.key} · {parameter.unit}
                </span>
                <small style={breakableTextStyle}>
                  {parameter.mapping_readiness} · {parameter.consumer}
                </small>
              </article>
            ))}
          </div>
        </>
      ) : null}

      <div className="w5-studio-actions">
        <button
          disabled={busy || !draft || draft.status !== "BOUND"}
          onClick={() => void evaluate("STANDARD")}
        >
          Standard 评估
        </button>
        <button
          disabled={busy || !draft || draft.status !== "BOUND"}
          onClick={() => void evaluate("ADVANCED")}
        >
          Advanced 评估
        </button>
        <button
          disabled={busy || !draft || draft.status !== "BOUND"}
          onClick={() => void evaluate("STANDARD", "OFF")}
        >
          Plane OFF fallback
        </button>
      </div>

      {convergence ? (
        <div className="w5-convergence-panel" aria-label="W5 convergence projection">
          <h3>WANT → CAN → REALIZED</h3>
          <div className="w5-convergence-grid">
            {convergenceRows(convergence).map(([label, value]) => (
              <article key={label} className="w5-convergence-card">
                <span style={breakableTextStyle}>{label}</span>
                <strong style={breakableTextStyle}>{value}</strong>
              </article>
            ))}
          </div>
          <p className="evidence-note" style={breakableTextStyle}>
            REALIZED digest: {convergence.realized.replay_relevant_digest}
          </p>
          <section
            className="w5-demand-realization-explanation"
            aria-label="W5 demand realization explanation"
          >
            <strong style={breakableTextStyle}>
              Demand readiness: {convergence.demand_realization.readiness} · exact round{" "}
              {convergence.demand_realization.lineage.round_no}
            </strong>
            <ul>
              {convergence.demand_realization.explanation.map((item) => (
                <li key={item.stage} style={breakableTextStyle}>
                  {item.stage}: {item.summary} · official={item.official ? "true" : "false"}
                </li>
              ))}
            </ul>
            <div className="w5-demand-candidate" aria-label="O3 governed demand candidate">
              <strong style={breakableTextStyle}>
                O3 candidate · {convergence.demand_realization.candidate.source_plane} · digest=
                {convergence.demand_realization.candidate.candidate_digest}
              </strong>
              {convergence.demand_realization.candidate.markets.map((market) => (
                <div key={market.market_id}>
                  <span style={breakableTextStyle}>
                    Market {market.market_id} · outside option=
                    {market.outside_option_share.toFixed(4)}
                  </span>
                  <ul>
                    {market.products.map((product) => (
                      <li key={product.product_id} style={breakableTextStyle}>
                        {product.product_id}: candidate share={product.candidate_share.toFixed(4)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
          <p className="evidence-note" style={breakableTextStyle}>
            Known limits: {convergence.known_limits.join(" · ")}
          </p>
        </div>
      ) : null}
    </section>
  );
}
