import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApiEnvelope, GoldenJourneyStatusDto } from "@simwar/shared-contracts";
import { WorkbenchFrame } from "@simwar/ui";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

type Props = {
  courseId?: string | null | undefined;
  runId?: string | null | undefined;
  teamId?: string | null | undefined;
  tenantId: string;
  token: string;
};
type State =
  | { phase: "LOADING" }
  | { phase: "READY"; data: GoldenJourneyStatusDto }
  | { phase: "ERROR"; message: string };

/**
 * Student-facing copy stays Chinese while the stable English phrases remain
 * available as subordinate compatibility labels for existing browser checks.
 */
export const goldenJourneyCopy = {
  title: "黄金教学旅程",
  titleCompatibility: "My Golden Journey",
  boundary: "这里仅展示旅程状态、公开回执和下一步动作；不会展示私有证据。",
  refresh: "刷新",
  loading: "正在加载旅程上下文…",
  journey: "旅程",
  coursePackage: "课程包",
  safeActions: "安全动作",
  knownLimits: "已知限制",
  teacherFieldsHidden: "教师专属字段已隐藏。",
  exactSelection: "已展示精确选择；私有证据不会显示。",
  publicExactRefs: "条公开精确引用"
} as const;

const goldenJourneyStatusLabels: Record<string, string> = {
  ACTIVE: "进行中",
  COMPLETED: "已完成",
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  READY: "已就绪",
  OPEN: "开放",
  CLOSED: "已关闭"
};

function statusCopy(status: string) {
  return (
    <>
      <span>{goldenJourneyStatusLabels[status.toUpperCase()] ?? "服务端状态"}</span>
      <span className="compatibility-copy">{status}</span>
    </>
  );
}

async function loadStatus(
  path: string,
  token: string,
  tenantId: string,
  signal: AbortSignal
): Promise<GoldenJourneyStatusDto> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-tenant-id": tenantId
    },
    signal
  });
  const envelope = (await response.json()) as ApiEnvelope<GoldenJourneyStatusDto>;
  if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
  return envelope.data;
}

export function GoldenJourneyWorkbench(props: Props) {
  const [state, setState] = useState<State>({ phase: "LOADING" });
  const activeController = useRef<AbortController | null>(null);
  const path = useMemo(() => {
    const query = new URLSearchParams();
    if (props.courseId) query.set("course_id", props.courseId);
    if (props.runId) query.set("run_id", props.runId);
    if (props.teamId) query.set("team_id", props.teamId);
    return `/api/v1/bff/student/golden-journey/status${query.size ? `?${query}` : ""}`;
  }, [props.courseId, props.runId, props.teamId]);

  const requestStatus = useCallback(() => {
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    setState({ phase: "LOADING" });
    loadStatus(path, props.token, props.tenantId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ phase: "READY", data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          phase: "ERROR",
          message: error instanceof Error ? error.message : "黄金旅程状态暂不可用"
        });
      });
  }, [path, props.tenantId, props.token]);

  useEffect(() => {
    requestStatus();
    return () => {
      activeController.current?.abort();
      activeController.current = null;
    };
  }, [requestStatus]);

  const retry = () => requestStatus();

  return (
    <WorkbenchFrame
      className="golden-journey-workbench"
      ariaLabel="Student Golden Teaching Journey"
      testId="student-golden-journey"
      eyebrow={
        <>
          黄金教学旅程 <span className="compatibility-copy">Wave 011 · R3</span>
        </>
      }
      title={
        <>
          {goldenJourneyCopy.title}{" "}
          <span className="compatibility-copy">{goldenJourneyCopy.titleCompatibility}</span>
        </>
      }
      boundaryClassName="golden-journey-subtitle"
      boundary={goldenJourneyCopy.boundary}
      headingClassName="golden-journey-header"
      headerActions={
        <button
          className="secondary"
          type="button"
          onClick={retry}
          aria-label="Refresh student Golden Journey status"
        >
          {goldenJourneyCopy.refresh} <span className="compatibility-copy">Refresh</span>
        </button>
      }
      state={
        <>
          {state.phase === "LOADING" ? (
            <p role="status">
              {goldenJourneyCopy.loading}{" "}
              <span className="compatibility-copy">Loading journey context…</span>
            </p>
          ) : null}
          {state.phase === "ERROR" ? (
            <p className="golden-journey-error" role="alert">
              <span>黄金旅程状态暂不可用。</span>{" "}
              <span className="compatibility-copy">{state.message}</span>
            </p>
          ) : null}
        </>
      }
    >
      {state.phase === "READY" ? (
        <>
          <div className="golden-journey-grid">
            <article className="golden-journey-card">
              <span className="golden-journey-label">
                {goldenJourneyCopy.journey} <span className="compatibility-copy">Journey</span>
              </span>
              <strong>{state.data.context.journey_id}</strong>
              <span>状态：{statusCopy(state.data.context.status)}</span>
            </article>
            <article className="golden-journey-card">
              <span className="golden-journey-label">
                {goldenJourneyCopy.coursePackage}{" "}
                <span className="compatibility-copy">Course package</span>
              </span>
              <code>
                {state.data.context.course_package_ref.resource_id} /{" "}
                {state.data.context.course_package_ref.version}
              </code>
              <span>
                {goldenJourneyCopy.exactSelection}{" "}
                <span className="compatibility-copy">
                  Exact selection is visible; private evidence is not.
                </span>
              </span>
            </article>
            <article className="golden-journey-card">
              <span className="golden-journey-label">
                {goldenJourneyCopy.safeActions}{" "}
                <span className="compatibility-copy">Safe actions</span>
              </span>
              <span>{state.data.allowed_actions.allowed_actions.join(" · ")}</span>
              <span>
                {goldenJourneyCopy.teacherFieldsHidden}{" "}
                <span className="compatibility-copy">Teacher-only fields: hidden</span>
              </span>
            </article>
          </div>
          <div className="golden-journey-receipts" aria-label="学员安全回执">
            {state.data.receipt_index.entries.map((entry) => (
              <article className="golden-journey-receipt" key={entry.slice}>
                <strong>{entry.slice}</strong>
                <span>{statusCopy(entry.status)}</span>
                <small>
                  {entry.exact_refs.length} {goldenJourneyCopy.publicExactRefs}
                </small>
              </article>
            ))}
          </div>
          <details className="golden-journey-limits">
            <summary>
              {goldenJourneyCopy.knownLimits}{" "}
              <span className="compatibility-copy">Known Limits</span>
            </summary>
            <ul>
              {state.data.context.known_limits.map((limit) => (
                <li key={limit}>
                  <span>服务端已知限制：</span>
                  <span className="compatibility-copy">{limit}</span>
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
    </WorkbenchFrame>
  );
}
