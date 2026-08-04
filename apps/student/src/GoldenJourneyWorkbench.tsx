import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApiEnvelope, GoldenJourneyStatusDto } from "@simwar/shared-contracts";

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
      "x-tenant-id": tenantId,
      "x-correlation-id": `ui-r3-student-${Date.now()}`
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
    <section
      className="golden-journey-workbench"
      aria-label="Student Golden Teaching Journey"
      data-testid="student-golden-journey"
    >
      <div className="golden-journey-header">
        <div>
          <p className="eyebrow">Wave 011 · R3</p>
          <h2>My Golden Journey</h2>
          <p className="golden-journey-subtitle">
            A safe view of journey state, public receipts and next actions.
          </p>
        </div>
        <button
          className="secondary"
          type="button"
          onClick={retry}
          aria-label="Refresh student Golden Journey status"
        >
          Refresh
        </button>
      </div>
      {state.phase === "LOADING" ? <p role="status">Loading journey context…</p> : null}
      {state.phase === "ERROR" ? (
        <p className="golden-journey-error" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.phase === "READY" ? (
        <>
          <div className="golden-journey-grid">
            <article className="golden-journey-card">
              <span className="golden-journey-label">Journey</span>
              <strong>{state.data.context.journey_id}</strong>
              <span>Status: {state.data.context.status}</span>
            </article>
            <article className="golden-journey-card">
              <span className="golden-journey-label">Course package</span>
              <code>
                {state.data.context.course_package_ref.resource_id} /{" "}
                {state.data.context.course_package_ref.version}
              </code>
              <span>Exact selection is visible; private evidence is not.</span>
            </article>
            <article className="golden-journey-card">
              <span className="golden-journey-label">Safe actions</span>
              <span>{state.data.allowed_actions.allowed_actions.join(" · ")}</span>
              <span>Teacher-only fields: hidden</span>
            </article>
          </div>
          <div className="golden-journey-receipts" aria-label="Student-safe receipts">
            {state.data.receipt_index.entries.map((entry) => (
              <article className="golden-journey-receipt" key={entry.slice}>
                <strong>{entry.slice}</strong>
                <span>{entry.status}</span>
                <small>{entry.exact_refs.length} public exact refs</small>
              </article>
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
    </section>
  );
}
