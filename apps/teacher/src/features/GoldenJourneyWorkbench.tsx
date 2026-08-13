import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApiEnvelope, GoldenJourneyStatusDto } from "@simwar/shared-contracts";
import { WorkbenchFrame } from "@simwar/ui";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

type Props = {
  courseId?: string | null;
  runId?: string | null;
  teamId?: string | null;
  tenantId: string;
  token: string;
};

type State =
  | { phase: "LOADING" }
  | { phase: "READY"; data: GoldenJourneyStatusDto }
  | { phase: "EMPTY"; message: string }
  | { phase: "ERROR"; message: string };

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
  const envelope = (await response.json()) as ApiEnvelope<GoldenJourneyStatusDto> & {
    message?: string;
  };
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
    return `/api/v1/bff/teacher/golden-journey/status${query.size ? `?${query}` : ""}`;
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
          message: error instanceof Error ? error.message : "R3 status unavailable"
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
      ariaLabel="R3 Golden Teaching Journey"
      testId="teacher-golden-journey"
      eyebrow="Wave 011 · R3"
      title="Golden Teaching Journey"
      boundaryClassName="golden-journey-subtitle"
      boundary="Exact references, receipts and allowed actions across the teaching chain."
      headingClassName="golden-journey-header"
      headerActions={
        <button
          className="secondary"
          type="button"
          onClick={retry}
          aria-label="Refresh Golden Journey status"
        >
          Refresh
        </button>
      }
      state={
        <>
          {state.phase === "LOADING" ? <p role="status">Loading journey context…</p> : null}
          {state.phase === "ERROR" ? (
            <p className="golden-journey-error" role="alert">
              {state.message}
            </p>
          ) : null}
          {state.phase === "EMPTY" ? <p className="golden-journey-empty">{state.message}</p> : null}
        </>
      }
    >
      {state.phase === "READY" ? (
        <>
          <nav className="golden-journey-nav" aria-label="Golden Journey slices">
            {state.data.receipt_index.entries.map((entry) => (
              <a href={`#r3-${entry.slice.toLowerCase()}`} key={entry.slice}>
                {entry.slice}
              </a>
            ))}
          </nav>
          <div className="golden-journey-grid">
            <article className="golden-journey-card">
              <span className="golden-journey-label">Journey</span>
              <strong>{state.data.context.journey_id}</strong>
              <span>Status: {state.data.context.status}</span>
              <span>Runtime: {state.data.runtime_authority}</span>
            </article>
            <article className="golden-journey-card">
              <span className="golden-journey-label">Exact CoursePackage</span>
              <code>
                {state.data.context.course_package_ref.resource_id} /{" "}
                {state.data.context.course_package_ref.version}
              </code>
              <code>{state.data.context.course_package_ref.content_digest}</code>
            </article>
            <article className="golden-journey-card">
              <span className="golden-journey-label">Request Chain</span>
              <code>{state.data.context.request_id}</code>
              <code>{state.data.context.correlation_id}</code>
              <span>{state.data.correlation_chain.steps.length} linked steps</span>
            </article>
          </div>
          <div className="golden-journey-receipts" aria-label="Cross-slice receipts">
            {state.data.receipt_index.entries.map((entry) => (
              <article
                className="golden-journey-receipt"
                id={`r3-${entry.slice.toLowerCase()}`}
                key={entry.slice}
              >
                <strong>{entry.slice}</strong>
                <span>{entry.status}</span>
                <small>{entry.exact_refs.length} exact refs</small>
              </article>
            ))}
          </div>
          <div className="golden-journey-actions" aria-label="Allowed actions">
            {state.data.allowed_actions.allowed_actions.map((action) => (
              <span className="golden-journey-action" key={action}>
                {action}
              </span>
            ))}
          </div>
          <details className="golden-journey-limits">
            <summary>Known Limits</summary>
            <ul>
              {state.data.context.known_limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
    </WorkbenchFrame>
  );
}
