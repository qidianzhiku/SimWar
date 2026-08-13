import { useCallback, useEffect, useRef, useState } from "react";
import { WorkbenchFrame } from "./WorkbenchFrame.js";

export interface D5ExactReference {
  readonly content_digest: string;
  readonly discriminator: string;
  readonly resource_id: string;
  readonly resource_type: string;
  readonly tenant_id: string;
  readonly version: string;
}

export interface D5ReportSummary {
  readonly report_ref: D5ExactReference;
  readonly context: {
    readonly course_id: string;
    readonly run_id: string;
    readonly team_id: string;
    readonly role_key: string;
  };
  readonly status: string;
}

export interface D5PreviewData {
  readonly source_report_refs: readonly D5ExactReference[];
  readonly statements: readonly unknown[];
  readonly aol_dataset: {
    readonly rows: readonly {
      readonly group_key: string;
      readonly sample_size: number;
      readonly suppressed: boolean;
    }[];
  };
}

export interface D5BundleData {
  readonly bundle_ref: D5ExactReference;
  readonly bundle_digest: string;
}

export interface D5JobData {
  readonly job_ref: { readonly resource_id: string; readonly content_digest: string };
  readonly status: string;
  readonly attempt_count: number;
}

export interface D5ReceiptData {
  readonly receipt_ref: { readonly content_digest: string };
  readonly outcome: string;
  readonly sealed_payload_digest: string;
}

export interface D5ExportList {
  readonly bundles: readonly unknown[];
  readonly jobs: readonly D5JobData[];
  readonly receipts: readonly D5ReceiptData[];
  readonly known_limits: readonly string[];
}

export interface D5LoadedData {
  readonly reports: readonly D5ReportSummary[];
  readonly list: D5ExportList;
}

export interface D5ExportWorkbenchViewProps {
  ariaLabel: string;
  eyebrow: string;
  title?: string;
  badge: string;
  boundary: string;
  sessionKey?: string;
  className?: string;
  headingClassName?: string;
  boundaryClassName?: string;
  loadList: () => Promise<D5LoadedData>;
  refreshExports: () => Promise<D5ExportList>;
  generate: (selected: readonly D5ExactReference[]) => Promise<D5PreviewData>;
  submit: (selected: readonly D5ExactReference[]) => Promise<D5BundleData>;
  deliver?: (bundleRef: D5ExactReference) => Promise<D5JobData>;
  retry?: (jobId: string) => Promise<D5JobData>;
  cancel?: (jobId: string) => Promise<D5JobData>;
  mapError: (error: unknown) => string;
  mapLoadError?: (error: unknown) => string;
}

type Phase = "IDLE" | "LOADING" | "READY" | "ERROR";

const selectedKey = (ref: D5ExactReference) =>
  `${ref.resource_id}:${ref.version}:${ref.content_digest}`;

export function D5ExportWorkbenchView({
  ariaLabel,
  eyebrow,
  title = "Evidence Export Workbench",
  badge,
  boundary,
  sessionKey,
  className = "d5-export-workbench candidate-surface",
  headingClassName = "sw-workbench-frame__heading",
  boundaryClassName = "d5-export-boundary",
  loadList,
  refreshExports,
  generate,
  submit,
  deliver,
  retry,
  cancel,
  mapError,
  mapLoadError = mapError
}: D5ExportWorkbenchViewProps) {
  const [phase, setPhase] = useState<Phase>("IDLE");
  const [reports, setReports] = useState<readonly D5ReportSummary[]>([]);
  const [selected, setSelected] = useState<readonly D5ExactReference[]>([]);
  const [preview, setPreview] = useState<D5PreviewData | null>(null);
  const [bundle, setBundle] = useState<D5BundleData | null>(null);
  const [list, setList] = useState<D5ExportList | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requestEpoch = useRef(0);
  const loadListRef = useRef(loadList);
  loadListRef.current = loadList;
  const mapErrorRef = useRef(mapError);
  mapErrorRef.current = mapError;
  const mapLoadErrorRef = useRef(mapLoadError);
  mapLoadErrorRef.current = mapLoadError;
  const selectedKeys = new Set(selected.map(selectedKey));

  const refresh = useCallback(async () => {
    const epoch = ++requestEpoch.current;
    setPhase("LOADING");
    setError("");
    try {
      const next = await loadListRef.current();
      if (epoch !== requestEpoch.current) return;
      setReports(next.reports);
      setList(next.list);
      setSelected(next.reports.map((report) => report.report_ref));
      setPhase("READY");
    } catch (cause) {
      if (epoch !== requestEpoch.current) return;
      setError(mapLoadErrorRef.current(cause));
      setPhase("ERROR");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, sessionKey]);

  const refreshList = async () => {
    const next = await refreshExports();
    setList(next);
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(mapErrorRef.current(cause));
    } finally {
      setBusy(false);
    }
  };

  const selectReport = (report: D5ReportSummary, checked: boolean) => {
    setSelected((current) =>
      checked
        ? [...current, report.report_ref]
        : current.filter(
            (ref) =>
              ref.resource_id !== report.report_ref.resource_id ||
              ref.version !== report.report_ref.version
          )
    );
  };

  const state = (
    <>
      {phase === "LOADING" ? <p aria-live="polite">Loading exact D4 reports...</p> : null}
      {phase === "ERROR" ? (
        <p className="d5-export-error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );

  return (
    <WorkbenchFrame
      ariaLabel={ariaLabel}
      eyebrow={eyebrow}
      title={title}
      badge={badge}
      boundary={boundary}
      state={state}
      className={className}
      headingClassName={headingClassName}
      boundaryClassName={boundaryClassName}
      headerActions={
        <button
          className="secondary"
          disabled={busy || phase === "LOADING"}
          onClick={() => void refresh()}
        >
          Refresh
        </button>
      }
    >
      {phase !== "LOADING" ? (
        <div className="d5-export-grid">
          <div>
            <h3>Exact source reports</h3>
            {reports.length === 0 ? (
              <p className="d5-export-empty">No eligible confirmed report is available.</p>
            ) : (
              <ul className="d5-export-report-list">
                {reports.map((report) => {
                  const key = selectedKey(report.report_ref);
                  return (
                    <li key={key}>
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(key)}
                          onChange={(event) => selectReport(report, event.target.checked)}
                        />{" "}
                        <strong>
                          {report.report_ref.resource_id}@{report.report_ref.version}
                        </strong>{" "}
                        <span>
                          {report.context.course_id} · {report.context.team_id} · {report.status}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="d5-export-actions">
              <button
                disabled={busy || selected.length === 0}
                onClick={() => void run(async () => setPreview(await generate(selected)))}
              >
                Preview
              </button>
              <button
                disabled={busy || selected.length === 0}
                onClick={() =>
                  void run(async () => {
                    setBundle(await submit(selected));
                    await refreshList();
                  })
                }
              >
                Seal immutable bundle
              </button>
            </div>
          </div>
          <div>
            <h3>Export state</h3>
            {preview ? (
              <div className="d5-export-receipt" aria-live="polite">
                <strong>Preview ready</strong>
                <span>{preview.statements.length} xAPI statement(s)</span>
                <span>{preview.aol_dataset.rows.length} AoL row(s), suppressed small cohorts</span>
              </div>
            ) : null}
            {bundle ? (
              <div className="d5-export-receipt">
                <strong>Bundle sealed</strong>
                <code>{bundle.bundle_digest}</code>
                {deliver ? (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await deliver(bundle.bundle_ref);
                        await refreshList();
                      })
                    }
                  >
                    Deliver to Mock LRS
                  </button>
                ) : null}
              </div>
            ) : null}
            {list?.jobs.map((job) => (
              <div className="d5-export-job" key={job.job_ref.content_digest}>
                <span>{job.job_ref.resource_id}</span>
                <strong>{job.status}</strong>
                <span>{job.attempt_count} attempt(s)</span>
                {retry && ["RETRYABLE", "PARTIAL", "FAILED"].includes(job.status) ? (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await retry(job.job_ref.resource_id);
                        await refreshList();
                      })
                    }
                  >
                    Retry
                  </button>
                ) : null}
                {cancel && ["QUEUED", "DELIVERING", "RETRYABLE", "PARTIAL"].includes(job.status) ? (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await cancel(job.job_ref.resource_id);
                        await refreshList();
                      })
                    }
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            ))}
            {list?.receipts.map((receipt) => (
              <div className="d5-export-receipt" key={receipt.receipt_ref.content_digest}>
                <strong>Receipt · {receipt.outcome}</strong>
                <code>{receipt.sealed_payload_digest}</code>
              </div>
            ))}
            {error ? (
              <p className="d5-export-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </WorkbenchFrame>
  );
}
