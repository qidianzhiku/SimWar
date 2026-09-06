import { useState, type FormEvent } from "react";

interface StrategicPortfolioDivergencePanelProps {
  apiBase: string;
  tenantId: string;
  token: string;
  initialCandidateId?: string;
}

interface DivergenceProjection {
  candidate_id: string;
  surface: "admin";
  exact_binding: {
    tenant_id: string;
    course_id: string;
    run_id: string;
    team_id: string;
    round_id: string;
    round_no: number;
  };
  envelope: {
    envelope_id: string;
    envelope_digest: string;
    exact_portfolio: {
      portfolio_id: string;
      portfolio_digest: string;
      tenant_id: string;
      course_id: string;
      run_id: string;
      team_id: string;
      round_no: number;
    };
    official_baseline: {
      portfolio_digest: string;
      member_count: number;
      allocated_capital_principal: number;
      total_project_cost: number;
    };
    non_official_paths: Array<{
      path_id: string;
      label: string;
      path_digest: string;
      changed_paths: string[];
      outcome_differential: {
        cash_delta: number;
        capacity_delta: number;
        project_count_delta: number;
      };
    }>;
    dimension_evidence: Array<{
      dimension: string;
      status: "PROVEN" | "NOT_PROVEN";
      reason: string;
    }>;
    known_limits: string[];
  };
  transfer: {
    status: "REFLECTION_ONLY" | "REBASE_REQUIRED" | "BLOCKED";
    selected_path_id: null;
    known_limits: string[];
  };
  authority: {
    derived: true;
    query_only: true;
    provider: "OFF";
    official_truth_write: false;
    settlement_write: false;
    score_write: false;
    rank_write: false;
  };
  known_limits: string[];
}

interface Envelope<T> {
  data?: T;
  error?: { message?: string };
}

type LoadState = "idle" | "loading" | "ready" | "error";

function endpoint(apiBase: string, candidateId: string): string {
  return `${apiBase.replace(/\/$/u, "")}/api/v1/bff/admin/sp-o3/strategic-portfolio/divergence/${encodeURIComponent(candidateId)}`;
}

export function StrategicPortfolioDivergencePanel({
  apiBase,
  tenantId,
  token,
  initialCandidateId = ""
}: StrategicPortfolioDivergencePanelProps) {
  const [candidateId, setCandidateId] = useState(initialCandidateId);
  const [projection, setProjection] = useState<DivergenceProjection | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [message, setMessage] = useState("");

  async function loadProjection(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const id = candidateId.trim();
    if (!id) {
      setProjection(null);
      setState("error");
      setMessage("请输入 exact divergence candidate ID。");
      return;
    }
    setState("loading");
    setMessage("");
    try {
      const response = await fetch(endpoint(apiBase, id), {
        headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId }
      });
      const payload = (await response.json()) as Envelope<DivergenceProjection>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? `SP_O3_ADMIN_HTTP_${response.status}`);
      }
      setProjection(payload.data);
      setState("ready");
    } catch (error) {
      setProjection(null);
      setState("error");
      setMessage(error instanceof Error ? error.message : "战略组合反事实投影读取失败，请重试。");
    }
  }

  return (
    <section
      id="admin-strategic-portfolio-divergence"
      className="panel form-panel"
      aria-labelledby="admin-strategic-portfolio-divergence-heading"
    >
      <div className="panel-title">
        <div>
          <p className="eyebrow">SP-O3 · governed comparison</p>
          <h2 id="admin-strategic-portfolio-divergence-heading">战略组合差异检查</h2>
        </div>
        <span className="technical-compatibility">derived · query-only · Provider OFF</span>
      </div>
      <p className="lifecycle-boundary">
        管理员可读取 exact 课程、运行、团队和回合范围内的官方 W4 baseline 与 M4 非官方路径对照。
        此检查不选择最佳路径、不写入正式真值，也不改变下一回合。
      </p>
      <form onSubmit={loadProjection}>
        <label>
          Divergence candidate ID
          <input
            aria-label="SP-O3 divergence candidate ID"
            value={candidateId}
            onChange={(event) => setCandidateId(event.target.value)}
            placeholder="sp_o3_candidate_…"
          />
        </label>
        <button type="submit" disabled={state === "loading"}>
          {state === "loading" ? "正在读取…" : "读取差异检查"}
        </button>
      </form>
      {state === "error" ? (
        <div className="lifecycle-error" role="alert">
          <p>{message}</p>
          <button type="button" onClick={() => void loadProjection()}>
            重试读取
          </button>
        </div>
      ) : null}
      {state === "ready" && projection ? (
        <article
          className="candidate-preview"
          aria-label="Strategic portfolio divergence projection"
        >
          <h3>Exact comparison evidence</h3>
          <dl>
            <div>
              <dt>scope</dt>
              <dd>
                {projection.exact_binding.course_id} · {projection.exact_binding.run_id} ·{" "}
                {projection.exact_binding.team_id} · Round {projection.exact_binding.round_no}
              </dd>
            </div>
            <div>
              <dt>portfolio digest</dt>
              <dd>
                <code>{projection.envelope.exact_portfolio.portfolio_digest}</code>
              </dd>
            </div>
            <div>
              <dt>transfer status</dt>
              <dd>{projection.transfer.status} · selected_path_id=null</dd>
            </div>
            <div>
              <dt>authority</dt>
              <dd>
                derived={String(projection.authority.derived)} · query_only=
                {String(projection.authority.query_only)} · provider={projection.authority.provider}
              </dd>
            </div>
          </dl>
          <section aria-label="Official baseline">
            <h4>官方 W4 baseline</h4>
            <p>
              成员 {projection.envelope.official_baseline.member_count} · 可用现金约束资本{" "}
              {projection.envelope.official_baseline.allocated_capital_principal} · 项目成本{" "}
              {projection.envelope.official_baseline.total_project_cost}
            </p>
          </section>
          <section aria-label="Non-official paths">
            <h4>非官方 M4 paths（仅对照）</h4>
            <ul>
              {projection.envelope.non_official_paths.map((path) => (
                <li key={path.path_id}>
                  <strong>{path.label}</strong> · cash {path.outcome_differential.cash_delta} ·
                  capacity {path.outcome_differential.capacity_delta} · projects{" "}
                  {path.outcome_differential.project_count_delta}
                </li>
              ))}
            </ul>
          </section>
          <section aria-label="Dimension evidence">
            <h4>可证明维度与限制</h4>
            <ul>
              {projection.envelope.dimension_evidence.map((item) => (
                <li key={item.dimension}>
                  {item.dimension}: {item.status} · {item.reason}
                </li>
              ))}
              {[
                ...projection.envelope.known_limits,
                ...projection.transfer.known_limits,
                ...projection.known_limits
              ].map((limit, index) => (
                <li key={`${limit}-${index}`}>{limit}</li>
              ))}
            </ul>
          </section>
          <p className="lifecycle-boundary" role="note">
            此处只呈现比较证据；不执行 apply、baseline 替换、正式决策、结算、评分或排名。
          </p>
        </article>
      ) : null}
    </section>
  );
}
