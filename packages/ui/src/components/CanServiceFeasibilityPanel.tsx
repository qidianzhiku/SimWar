import { useEffect, useState } from "react";
import type {
  ApiEnvelope,
  CanServiceFeasibilityResponse,
  CanServiceFeasibilitySurface
} from "@simwar/shared-contracts";

export interface CanServiceFeasibilityPanelProps {
  apiBase: string;
  courseId?: string | null | undefined;
  draftId?: string | null | undefined;
  roundId?: string | null | undefined;
  roundNo?: number | undefined;
  runId?: string | null | undefined;
  surface: CanServiceFeasibilitySurface;
  tenantId: string;
  token: string;
  enabled?: boolean;
}

function statusOf(response: CanServiceFeasibilityResponse): string {
  return (
    response.teacher_projection?.status ??
    response.student_projection?.status ??
    response.admin_projection?.status ??
    response.candidate?.status ??
    "UNKNOWN"
  );
}

async function load(
  props: CanServiceFeasibilityPanelProps
): Promise<CanServiceFeasibilityResponse> {
  const query = new URLSearchParams({
    courseId: props.courseId ?? "",
    draftId: props.draftId ?? "",
    runId: props.runId ?? "",
    roundId: props.roundId ?? "",
    roundNo: String(props.roundNo ?? "")
  });
  const response = await fetch(
    `${props.apiBase}/api/v1/bff/${props.surface}/can/service-feasibility?${query.toString()}`,
    {
      headers: {
        authorization: `Bearer ${props.token}`,
        "content-type": "application/json",
        "x-tenant-id": props.tenantId
      }
    }
  );
  const envelope = (await response.json()) as ApiEnvelope<CanServiceFeasibilityResponse>;
  if (!response.ok) {
    throw Object.assign(new Error(`${envelope.code}: ${envelope.message}`), {
      status: response.status
    });
  }
  return envelope.data;
}

export function isCanServiceFeasibilityNotAvailable(reason: unknown): boolean {
  return reason instanceof Error && "status" in reason && reason.status === 404;
}

function surfaceLabel(surface: CanServiceFeasibilitySurface): string {
  return surface === "teacher"
    ? "教师诊断"
    : surface === "student"
      ? "学员为什么不能"
      : "管理员审计";
}

export function CanServiceFeasibilityPanel(props: CanServiceFeasibilityPanelProps) {
  const [response, setResponse] = useState<CanServiceFeasibilityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const exactContext = Boolean(
    props.apiBase &&
    props.courseId &&
    props.draftId &&
    props.roundId &&
    props.runId &&
    props.token &&
    props.roundNo !== undefined
  );
  const exact = exactContext && props.enabled !== false;

  useEffect(() => {
    let active = true;
    setResponse(null);
    setError(null);
    setUnavailable(false);
    if (!exact) return () => undefined;
    void load(props)
      .then((data) => {
        if (active) setResponse(data);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (isCanServiceFeasibilityNotAvailable(reason)) {
          setUnavailable(true);
          return;
        }
        setError(reason instanceof Error ? reason.message : "CAN 可行性加载失败");
      });
    return () => {
      active = false;
    };
  }, [
    exact,
    props.apiBase,
    props.courseId,
    props.draftId,
    props.roundId,
    props.roundNo,
    props.runId,
    props.surface,
    props.tenantId,
    props.token,
    props.enabled
  ]);

  const constraints =
    response?.teacher_projection?.constraints ?? response?.candidate?.constraints ?? [];
  const whyNot =
    response?.student_projection?.why_not ??
    response?.teacher_projection?.why_not ??
    response?.candidate?.why_not ??
    [];

  return (
    <section
      className="summary-panel can-service-feasibility-panel"
      aria-label={`R1 CAN ${surfaceLabel(props.surface)}`}
      data-testid={`r1-can-${props.surface}`}
    >
      <div className="summary-heading">
        <div>
          <p className="eyebrow">R1 · CAN SERVICE FEASIBILITY</p>
          <h2>{surfaceLabel(props.surface)}</h2>
          <p className="evidence-note">Exact tenant / course / run / round 的候选约束投影</p>
        </div>
        <strong className="summary-badge">
          {props.surface === "student" ? "ROLE-SAFE" : "只读候选"}
        </strong>
      </div>
      {error ? (
        <p className="summary-error" role="alert">
          {error}
        </p>
      ) : null}
      {!exactContext ? (
        <p className="lifecycle-status">需要 exact draft / run / round 上下文</p>
      ) : null}
      {exactContext && !exact ? (
        <p className="lifecycle-status">等待当前 Run 的 W5 exact binding</p>
      ) : null}
      {exact && unavailable ? (
        <p className="lifecycle-status" role="status">
          当前 exact 上下文没有可用的 R1 CAN 候选绑定。
        </p>
      ) : null}
      {exact && !response && !error ? (
        <p className="lifecycle-status" aria-live="polite">
          正在读取 CAN 约束…
        </p>
      ) : null}
      {response ? (
        <>
          <div className="summary-grid">
            <article>
              <span>CAN 状态</span>
              <strong>{statusOf(response)}</strong>
            </article>
            <article>
              <span>候选写入</span>
              <strong>Simulation Core · 只读</strong>
            </article>
            <article>
              <span>官方真值写入</span>
              <strong>0</strong>
            </article>
            <article>
              <span>队列/候补</span>
              <strong>未声明</strong>
            </article>
          </div>
          {props.surface === "student" ? (
            <>
              <p className="lifecycle-boundary">
                学生仅看到本队伍安全的 why-not 摘要；exact binding、参数和来源引用已隐藏。
              </p>
              <ul className="compact-list" aria-label="CAN why-not reasons">
                {whyNot.length ? (
                  whyNot.map((reason) => (
                    <li key={`${reason.code}-${reason.constraint_kind}`}>{reason.summary}</li>
                  ))
                ) : (
                  <li>当前没有阻塞原因。</li>
                )}
              </ul>
            </>
          ) : (
            <>
              <ul className="compact-list" aria-label="CAN constraint evidence">
                {constraints.map((constraint) => (
                  <li key={constraint.constraint_id}>
                    {constraint.kind} · {constraint.status} · {constraint.explanation}
                  </li>
                ))}
              </ul>
              {props.surface === "admin" ? (
                <p className="evidence-note">
                  来源引用 {response.source_refs.length} 项 · exact binding digest 已记录
                </p>
              ) : null}
            </>
          )}
          <details>
            <summary>查看 R1 已知限制</summary>
            <ul className="compact-list">
              {response.known_limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
    </section>
  );
}

export default CanServiceFeasibilityPanel;
