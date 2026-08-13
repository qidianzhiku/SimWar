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
  const sessionKeyRef = useRef(sessionKey ?? "");
  const loadListRef = useRef(loadList);
  loadListRef.current = loadList;
  const mapErrorRef = useRef(mapError);
  mapErrorRef.current = mapError;
  const mapLoadErrorRef = useRef(mapLoadError);
  mapLoadErrorRef.current = mapLoadError;
  const selectedKeys = new Set(selected.map(selectedKey));

  const refresh = useCallback(async () => {
    const epoch = ++requestEpoch.current;
    const requestSessionKey = sessionKeyRef.current;
    setPhase("LOADING");
    setError("");
    try {
      const next = await loadListRef.current();
      if (epoch !== requestEpoch.current || requestSessionKey !== sessionKeyRef.current) return;
      setReports(next.reports);
      setList(next.list);
      setSelected(next.reports.map((report) => report.report_ref));
      setPhase("READY");
    } catch (cause) {
      if (epoch !== requestEpoch.current || requestSessionKey !== sessionKeyRef.current) return;
      setError(mapLoadErrorRef.current(cause));
      setPhase("ERROR");
    }
  }, []);

  useEffect(() => {
    sessionKeyRef.current = sessionKey ?? "";
    requestEpoch.current += 1;
    setBusy(false);
    setError("");
    setReports([]);
    setSelected([]);
    setPreview(null);
    setBundle(null);
    setList(null);
    void refresh();
  }, [refresh, sessionKey]);

  const refreshList = async (isCurrent: () => boolean) => {
    const next = await refreshExports();
    if (isCurrent()) {
      setList(next);
    }
  };

  const run = async (action: (isCurrent: () => boolean) => Promise<void>) => {
    const operationEpoch = requestEpoch.current;
    const operationSessionKey = sessionKeyRef.current;
    const isCurrent = () =>
      operationEpoch === requestEpoch.current && operationSessionKey === sessionKeyRef.current;
    setBusy(true);
    setError("");
    try {
      await action(isCurrent);
    } catch (cause) {
      if (isCurrent()) {
        setError(mapErrorRef.current(cause));
      }
    } finally {
      if (isCurrent()) {
        setBusy(false);
      }
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
      {phase === "LOADING" ? (
        <p aria-live="polite">
          正在加载 D4 精确报告……{" "}
          <span className="technical-compatibility">Loading exact D4 reports...</span>
        </p>
      ) : null}
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
          aria-label="Refresh"
          className="secondary"
          disabled={busy || phase === "LOADING"}
          onClick={() => void refresh()}
        >
          刷新 <span className="technical-compatibility">Refresh</span>
        </button>
      }
    >
      {phase !== "LOADING" ? (
        <div className="d5-export-grid">
          <div>
            <h3>
              精确来源报告 <span className="technical-compatibility">Exact source reports</span>
            </h3>
            {reports.length === 0 ? (
              <p className="d5-export-empty">
                当前没有可用的已确认报告。{" "}
                <span className="technical-compatibility">
                  No eligible confirmed report is available.
                </span>
              </p>
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
                aria-label="Preview"
                disabled={busy || selected.length === 0}
                onClick={() =>
                  void run(async (isCurrent) => {
                    const next = await generate(selected);
                    if (isCurrent()) {
                      setPreview(next);
                    }
                  })
                }
              >
                预览 <span className="technical-compatibility">Preview</span>
              </button>
              <button
                aria-label="Seal immutable bundle"
                disabled={busy || selected.length === 0}
                onClick={() =>
                  void run(async (isCurrent) => {
                    const next = await submit(selected);
                    if (!isCurrent()) return;
                    setBundle(next);
                    await refreshList(isCurrent);
                  })
                }
              >
                封存不可变包 <span className="technical-compatibility">Seal immutable bundle</span>
              </button>
            </div>
          </div>
          <div>
            <h3>
              导出状态 <span className="technical-compatibility">Export state</span>
            </h3>
            {preview ? (
              <div className="d5-export-receipt" aria-live="polite">
                <strong>预览已准备</strong>
                <span className="technical-compatibility">Preview ready</span>
                <span>{preview.statements.length} 条 xAPI 陈述</span>
                <span>{preview.aol_dataset.rows.length} 行 AoL 数据，小样本群体已抑制</span>
              </div>
            ) : null}
            {bundle ? (
              <div className="d5-export-receipt">
                <strong>导出包已封存</strong>
                <span className="technical-compatibility">Bundle sealed</span>
                <code>{bundle.bundle_digest}</code>
                {deliver ? (
                  <button
                    aria-label="Deliver to Mock LRS"
                    disabled={busy}
                    onClick={() =>
                      void run(async (isCurrent) => {
                        await deliver(bundle.bundle_ref);
                        await refreshList(isCurrent);
                      })
                    }
                  >
                    发送至 Mock LRS{" "}
                    <span className="technical-compatibility">Deliver to Mock LRS</span>
                  </button>
                ) : null}
              </div>
            ) : null}
            {list?.jobs.map((job) => (
              <div className="d5-export-job" key={job.job_ref.content_digest}>
                <span>{job.job_ref.resource_id}</span>
                <strong>{job.status}</strong>
                <span>{job.attempt_count} 次尝试</span>
                {retry && ["RETRYABLE", "PARTIAL", "FAILED"].includes(job.status) ? (
                  <button
                    aria-label="Retry"
                    disabled={busy}
                    onClick={() =>
                      void run(async (isCurrent) => {
                        await retry(job.job_ref.resource_id);
                        await refreshList(isCurrent);
                      })
                    }
                  >
                    重试 <span className="technical-compatibility">Retry</span>
                  </button>
                ) : null}
                {cancel && ["QUEUED", "DELIVERING", "RETRYABLE", "PARTIAL"].includes(job.status) ? (
                  <button
                    aria-label="Cancel"
                    disabled={busy}
                    onClick={() =>
                      void run(async (isCurrent) => {
                        await cancel(job.job_ref.resource_id);
                        await refreshList(isCurrent);
                      })
                    }
                  >
                    取消 <span className="technical-compatibility">Cancel</span>
                  </button>
                ) : null}
              </div>
            ))}
            {list?.receipts.map((receipt) => (
              <div className="d5-export-receipt" key={receipt.receipt_ref.content_digest}>
                <strong>回执 · {receipt.outcome}</strong>
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
