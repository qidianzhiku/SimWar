import { useEffect, useMemo, useState } from "react";
import type { D5ExactRef, LearningExportBundleVersion } from "@simwar/shared-contracts";
import {
  cancelD5Job,
  createD5Job,
  loadD5Exports,
  loadD5Reports,
  previewD5Export,
  retryD5Job,
  sealD5Export,
  type D5List,
  type D5Preview,
  type D5ReportSummary
} from "./d5-export-client";

type Phase = "IDLE" | "LOADING" | "READY" | "ERROR";

export function D5ExportWorkbench({
  apiBase,
  tenantId,
  token
}: {
  apiBase: string;
  tenantId: string;
  token: string;
}) {
  const [phase, setPhase] = useState<Phase>("IDLE");
  const [reports, setReports] = useState<readonly D5ReportSummary[]>([]);
  const [selected, setSelected] = useState<readonly D5ExactRef[]>([]);
  const [preview, setPreview] = useState<D5Preview | null>(null);
  const [bundle, setBundle] = useState<LearningExportBundleVersion | null>(null);
  const [list, setList] = useState<D5List | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedKeys = useMemo(
    () => new Set(selected.map((ref) => `${ref.resource_id}:${ref.version}:${ref.content_digest}`)),
    [selected]
  );
  const refresh = async () => {
    setPhase("LOADING");
    setError("");
    try {
      const [reportData, exportData] = await Promise.all([
        loadD5Reports(apiBase, token),
        loadD5Exports(apiBase, token)
      ]);
      setReports(reportData.reports);
      setList(exportData);
      setSelected(reportData.reports.map((report) => report.report_ref));
      setPhase("READY");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load D5 export workbench");
      setPhase("ERROR");
    }
  };

  useEffect(() => {
    void refresh();
  }, [apiBase, token, tenantId]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "D5 export operation failed");
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

  return (
    <section
      className="d5-export-workbench candidate-surface"
      aria-label="D5 teacher evidence export workbench"
    >
      <div className="candidate-heading">
        <div>
          <p className="eyebrow">L1+ Program D · D5</p>
          <h2>Evidence Export Workbench</h2>
        </div>
        <button
          className="secondary"
          disabled={busy || phase === "LOADING"}
          onClick={() => void refresh()}
        >
          Refresh
        </button>
      </div>
      <p className="d5-export-boundary">
        Teacher-safe export only. Mock LRS is in-process; no Student route, raw evidence, email,
        score, rank, settlement, or replay data is exported.
      </p>
      {phase === "LOADING" ? <p aria-live="polite">Loading exact D4 reports...</p> : null}
      {phase === "ERROR" ? (
        <p className="d5-export-error" role="alert">
          {error}
        </p>
      ) : null}
      {phase !== "LOADING" ? (
        <div className="d5-export-grid">
          <div>
            <h3>Exact source reports</h3>
            {reports.length === 0 ? (
              <p className="d5-export-empty">No eligible confirmed report is available.</p>
            ) : (
              <ul className="d5-export-report-list">
                {reports.map((report) => {
                  const key = `${report.report_ref.resource_id}:${report.report_ref.version}:${report.report_ref.content_digest}`;
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
                onClick={() =>
                  void run(async () => setPreview(await previewD5Export(apiBase, token, selected)))
                }
              >
                Preview
              </button>
              <button
                disabled={busy || selected.length === 0}
                onClick={() =>
                  void run(async () => {
                    setBundle(await sealD5Export(apiBase, token, selected));
                    setList(await loadD5Exports(apiBase, token));
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
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await createD5Job(apiBase, token, bundle.bundle_ref);
                      setList(await loadD5Exports(apiBase, token));
                    })
                  }
                >
                  Deliver to Mock LRS
                </button>
              </div>
            ) : null}
            {list?.jobs.map((job) => (
              <div className="d5-export-job" key={job.job_ref.content_digest}>
                <span>{job.job_ref.resource_id}</span>
                <strong>{job.status}</strong>
                <span>{job.attempt_count} attempt(s)</span>
                {["RETRYABLE", "PARTIAL", "FAILED"].includes(job.status) ? (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await retryD5Job(apiBase, token, job.job_ref.resource_id);
                        setList(await loadD5Exports(apiBase, token));
                      })
                    }
                  >
                    Retry
                  </button>
                ) : null}
                {["QUEUED", "DELIVERING", "RETRYABLE", "PARTIAL"].includes(job.status) ? (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await cancelD5Job(apiBase, token, job.job_ref.resource_id);
                        setList(await loadD5Exports(apiBase, token));
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
    </section>
  );
}
