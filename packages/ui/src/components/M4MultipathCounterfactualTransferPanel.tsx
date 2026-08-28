import { useEffect, useState } from "react";
import type {
  ApiEnvelope,
  M4MultipathCounterfactualResponse,
  M4StudentPathProjection,
  M4TeacherPathProjection
} from "@simwar/shared-contracts";

export interface M4MultipathCounterfactualTransferPanelProps {
  apiBase: string;
  courseId: string;
  runId: string;
  roundNo?: number;
  surface: "student" | "teacher";
  teamId?: string;
  tenantId: string;
  token: string;
}

interface M4SourceResult {
  run_id: string;
  round_no: number;
  status: string;
}

interface M4DemoState {
  latest_result?: M4SourceResult;
}

export function resolveM4SourceRoundNo(
  result: M4SourceResult | undefined,
  runId: string
): number | undefined {
  return result?.run_id === runId && result.status === "published" ? result.round_no : undefined;
}

function requestHeaders(props: M4MultipathCounterfactualTransferPanelProps): HeadersInit {
  return {
    authorization: `Bearer ${props.token}`,
    "content-type": "application/json",
    "x-tenant-id": props.tenantId
  };
}

async function loadSourceRoundNo(
  props: M4MultipathCounterfactualTransferPanelProps
): Promise<number> {
  const response = await fetch(`${props.apiBase}/api/v1/demo-state`, {
    headers: requestHeaders(props)
  });
  const envelope = (await response.json()) as ApiEnvelope<M4DemoState>;
  if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
  const sourceRoundNo = resolveM4SourceRoundNo(envelope.data.latest_result, props.runId);
  if (sourceRoundNo === undefined) throw new Error("M4_OFFICIAL_OUTCOME_REQUIRED");
  return sourceRoundNo;
}

function loadPath(props: M4MultipathCounterfactualTransferPanelProps, roundNo: number): string {
  const query = new URLSearchParams({
    course_id: props.courseId,
    ...(props.teamId ? { team_id: props.teamId } : {}),
    round_no: String(roundNo)
  });
  return `/api/v1/bff/${props.surface}/w4/runs/${encodeURIComponent(props.runId)}/multipath-counterfactual-transfer?${query.toString()}`;
}

async function loadCandidate(
  props: M4MultipathCounterfactualTransferPanelProps
): Promise<M4MultipathCounterfactualResponse> {
  const sourceRoundNo = await loadSourceRoundNo(props);
  const response = await fetch(`${props.apiBase}${loadPath(props, sourceRoundNo)}`, {
    headers: requestHeaders(props)
  });
  const envelope = (await response.json()) as ApiEnvelope<M4MultipathCounterfactualResponse>;
  if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
  return envelope.data;
}

function isTeacherPath(
  path: M4TeacherPathProjection | M4StudentPathProjection
): path is M4TeacherPathProjection {
  return "rounds" in path;
}

export function M4MultipathCounterfactualTransferPanel(
  props: M4MultipathCounterfactualTransferPanelProps
) {
  const [requested, setRequested] = useState(false);
  const [response, setResponse] = useState<M4MultipathCounterfactualResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setResponse(null);
    setError(null);
    if (!requested || !props.token || !props.courseId || !props.runId) return () => undefined;
    void loadCandidate(props)
      .then((data) => {
        if (active) setResponse(data);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "M4 候选加载失败");
      });
    return () => {
      active = false;
    };
  }, [
    props.apiBase,
    props.courseId,
    props.runId,
    props.roundNo,
    props.surface,
    props.teamId,
    props.tenantId,
    props.token,
    requested
  ]);

  return (
    <section
      className="summary-panel m4-multipath-counterfactual-transfer"
      aria-label={props.surface === "teacher" ? "M4 多路径教师复盘" : "M4 多路径学员迁移"}
    >
      <div className="summary-heading">
        <div>
          <p className="eyebrow">M4 · MULTI-PATH COUNTERFACTUAL TRANSFER</p>
          <h2>{props.surface === "teacher" ? "多路径机制复盘" : "多路径学习迁移"}</h2>
        </div>
        <strong className="summary-badge">
          {props.surface === "teacher" ? "教师 · 只读" : "学员 · role-safe"}
        </strong>
      </div>
      {!requested ? (
        <>
          <p className="evidence-note">
            从当前官方 Closing 读取 2–3
            条可复现替代路径；官方路径保持不变，替代路径不进入结算或下一轮状态。
          </p>
          <button
            className="secondary"
            type="button"
            data-testid={`m4-${props.surface}-load`}
            onClick={() => setRequested(true)}
          >
            读取 M4 复盘候选
          </button>
        </>
      ) : null}
      {error ? (
        <p className="summary-error" role="alert" data-testid={`m4-${props.surface}-error`}>
          {error}
        </p>
      ) : null}
      {response ? (
        <>
          <div className="summary-grid" data-testid={`m4-${props.surface}-summary`}>
            <article>
              <span>官方路径</span>
              <strong>{response.official_path.unchanged ? "保持不变" : "异常"}</strong>
            </article>
            <article>
              <span>替代路径</span>
              <strong>{response.paths.length} 条 NON_OFFICIAL</strong>
            </article>
            <article>
              <span>迁移状态</span>
              <strong>{response.transfer.status}</strong>
            </article>
            <article>
              <span>真值写入</span>
              <strong>0 · 只读</strong>
            </article>
          </div>
          <ul className="compact-list">
            {response.paths.map((path) => (
              <li key={path.path_id}>
                {path.label} · cash Δ {path.outcome_differential.cash_delta} · capacity Δ{" "}
                {path.outcome_differential.capacity_delta}
                {isTeacherPath(path) ? ` · ${path.rounds.length} round(s)` : " · 已隐藏原始 rounds"}
              </li>
            ))}
          </ul>
          <p className="lifecycle-boundary">{response.student_transfer.explanation}</p>
          <details>
            <summary>查看 M4 已知限制</summary>
            <ul className="compact-list">
              {response.known_limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </details>
        </>
      ) : requested && !error ? (
        <p className="lifecycle-status" aria-live="polite">
          正在读取 exact official path 与替代路径…
        </p>
      ) : null}
    </section>
  );
}

export default M4MultipathCounterfactualTransferPanel;
