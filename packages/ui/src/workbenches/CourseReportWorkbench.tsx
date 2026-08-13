import { useEffect, useRef, useState } from "react";
import { WorkbenchFrame } from "./WorkbenchFrame.js";

export interface CourseReportFilter<TRole extends string = string, TKpi extends string = string> {
  course_id: string;
  run_id?: string;
  team_id?: string;
  role?: TRole;
  round_no?: number;
  kpis?: readonly TKpi[];
}

export interface CourseReportMetric {
  kpi: string;
  value: number | string;
}

export interface CourseReportRow {
  course_id: string;
  run_id: string;
  team_id: string;
  team_name: string;
  round_no: number;
  metrics: readonly CourseReportMetric[];
}

export interface CourseReportData {
  rows: readonly CourseReportRow[];
  known_limits: readonly string[];
}

export interface CourseReportExportData {
  export_format: string;
  file_name: string;
  report: CourseReportData;
}

export type CourseReportErrorState = {
  phase: "BLOCKED" | "STALE" | "ERROR";
  message: string;
};

type ReportPhase =
  | "IDLE"
  | "LOADING"
  | "READY"
  | "EMPTY"
  | "BLOCKED"
  | "STALE"
  | "ERROR"
  | "SUCCESS";
type ReportForm<TRole extends string, TKpi extends string> = {
  course_id: string;
  run_id: string;
  team_id: string;
  role: "" | TRole;
  round_no: string;
  kpis: TKpi[];
};

export interface CourseReportWorkbenchProps<
  TRole extends string = string,
  TKpi extends string = string
> {
  ariaLabel: string;
  eyebrow: string;
  title?: string;
  badge: string;
  boundary: string;
  roles: readonly TRole[];
  kpis: readonly TKpi[];
  initialFilter?: Partial<CourseReportFilter<TRole, TKpi>>;
  sessionKey?: string;
  className?: string;
  headingClassName?: string;
  boundaryClassName?: string;
  actionsClassName?: string;
  previewClassName?: string;
  receiptClassName?: string;
  loadReport: (filter: CourseReportFilter<TRole, TKpi>) => Promise<CourseReportData>;
  exportReport: (
    filter: CourseReportFilter<TRole, TKpi>,
    format: "json" | "csv"
  ) => Promise<CourseReportExportData>;
  mapError: (error: unknown) => CourseReportErrorState;
}

const EMPTY_FORM = {
  course_id: "",
  run_id: "",
  team_id: "",
  role: "",
  round_no: "",
  kpis: []
} as const;

function formFromFilter<TRole extends string, TKpi extends string>(
  filter?: Partial<CourseReportFilter<TRole, TKpi>>
): ReportForm<TRole, TKpi> {
  return {
    ...EMPTY_FORM,
    course_id: filter?.course_id ?? "",
    run_id: filter?.run_id ?? "",
    team_id: filter?.team_id ?? "",
    role: filter?.role ?? "",
    round_no: filter?.round_no ? String(filter.round_no) : "",
    kpis: [...(filter?.kpis ?? [])]
  };
}

function toFilter<TRole extends string, TKpi extends string>(
  form: ReportForm<TRole, TKpi>
): CourseReportFilter<TRole, TKpi> {
  return {
    course_id: form.course_id.trim(),
    ...(form.run_id.trim() ? { run_id: form.run_id.trim() } : {}),
    ...(form.team_id.trim() ? { team_id: form.team_id.trim() } : {}),
    ...(form.role ? { role: form.role as TRole } : {}),
    ...(form.round_no ? { round_no: Number(form.round_no) } : {}),
    ...(form.kpis.length ? { kpis: form.kpis } : {})
  };
}

export function CourseReportWorkbench<TRole extends string = string, TKpi extends string = string>({
  ariaLabel,
  eyebrow,
  title = "Course Report Builder",
  badge,
  boundary,
  roles,
  kpis,
  initialFilter,
  sessionKey,
  className = "course-report-surface",
  headingClassName = "sw-workbench-frame__heading",
  boundaryClassName = "sw-workbench-frame__boundary",
  actionsClassName = "lifecycle-actions",
  previewClassName,
  receiptClassName,
  loadReport,
  exportReport,
  mapError
}: CourseReportWorkbenchProps<TRole, TKpi>) {
  const [form, setForm] = useState<ReportForm<TRole, TKpi>>(() => formFromFilter(initialFilter));
  const [phase, setPhase] = useState<ReportPhase>("IDLE");
  const [message, setMessage] = useState("");
  const [report, setReport] = useState<CourseReportData | null>(null);
  const [receipt, setReceipt] = useState<CourseReportExportData | null>(null);
  const requestEpoch = useRef(0);

  useEffect(() => {
    requestEpoch.current += 1;
    setForm(formFromFilter(initialFilter));
    setPhase("IDLE");
    setMessage("");
    setReport(null);
    setReceipt(null);
  }, [initialFilter, sessionKey]);

  function change(next: Partial<ReportForm<TRole, TKpi>>): void {
    requestEpoch.current += 1;
    setForm((current) => ({ ...current, ...next }));
    setPhase("IDLE");
    setMessage("");
    setReport(null);
    setReceipt(null);
  }

  async function preview(): Promise<void> {
    const filter = toFilter(form);
    if (!filter.course_id) {
      setPhase("ERROR");
      setMessage("A Course is required.");
      return;
    }
    const epoch = ++requestEpoch.current;
    setPhase("LOADING");
    setMessage("");
    setReceipt(null);
    try {
      const next = await loadReport(filter);
      if (epoch !== requestEpoch.current) return;
      setReport(next);
      setPhase(next.rows.length ? "READY" : "EMPTY");
    } catch (error) {
      if (epoch !== requestEpoch.current) return;
      const next = mapError(error);
      setPhase(next.phase);
      setMessage(next.message);
    }
  }

  async function runExport(format: "json" | "csv"): Promise<void> {
    const filter = toFilter(form);
    if (!filter.course_id) {
      setPhase("ERROR");
      setMessage("A Course is required.");
      return;
    }
    const epoch = ++requestEpoch.current;
    setPhase("LOADING");
    setMessage("");
    setReport(null);
    setReceipt(null);
    try {
      const next = await exportReport(filter, format);
      if (epoch !== requestEpoch.current) return;
      setReport(next.report);
      setReceipt(next);
      setPhase("SUCCESS");
    } catch (error) {
      if (epoch !== requestEpoch.current) return;
      const next = mapError(error);
      setPhase(next.phase);
      setMessage(next.message);
    }
  }

  const state = (
    <>
      {phase === "LOADING" ? <p role="status">Loading safe Course Report</p> : null}
      {phase === "EMPTY" ? <p role="status">No safe report rows match this scope.</p> : null}
      {phase === "BLOCKED" || phase === "STALE" || phase === "ERROR" ? (
        <p role="alert">{message}</p>
      ) : null}
    </>
  );

  const filters = (
    <div className="course-report-filters">
      <label>
        Course
        <input
          aria-label="report course"
          value={form.course_id}
          onChange={(event) => change({ course_id: event.target.value })}
        />
      </label>
      <label>
        Run
        <input
          aria-label="report run"
          value={form.run_id}
          onChange={(event) => change({ run_id: event.target.value })}
        />
      </label>
      <label>
        Team
        <input
          aria-label="report team"
          value={form.team_id}
          onChange={(event) => change({ team_id: event.target.value })}
        />
      </label>
      <label>
        Role
        <select
          aria-label="report role"
          value={form.role}
          onChange={(event) => change({ role: event.target.value as "" | TRole })}
        >
          <option value="">All roles</option>
          {roles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </label>
      <label>
        Round
        <input
          aria-label="report round"
          min="1"
          type="number"
          value={form.round_no}
          onChange={(event) => change({ round_no: event.target.value })}
        />
      </label>
      <fieldset>
        <legend>KPI</legend>
        {kpis.map((kpi) => (
          <label key={kpi}>
            <input
              aria-label={`KPI ${kpi}`}
              checked={form.kpis.includes(kpi)}
              type="checkbox"
              onChange={(event) =>
                change({
                  kpis: event.target.checked
                    ? [...form.kpis, kpi]
                    : form.kpis.filter((value) => value !== kpi)
                })
              }
            />
            {kpi}
          </label>
        ))}
      </fieldset>
    </div>
  );

  return (
    <WorkbenchFrame
      ariaLabel={ariaLabel}
      eyebrow={eyebrow}
      title={title}
      badge={badge}
      boundary={boundary}
      state={state}
      stateAfterActions
      beforeActions={filters}
      className={className}
      headingClassName={headingClassName}
      boundaryClassName={boundaryClassName}
      actions={
        <div className={actionsClassName}>
          <button disabled={phase === "LOADING"} onClick={() => void preview()}>
            Preview Course Report
          </button>
          <button disabled={phase === "LOADING"} onClick={() => void runExport("json")}>
            Export report as JSON
          </button>
          <button disabled={phase === "LOADING"} onClick={() => void runExport("csv")}>
            Export report as CSV
          </button>
        </div>
      }
    >
      {report ? (
        <article className={previewClassName} aria-label="Course report preview">
          <h3>Course report preview</h3>
          {report.rows.map((row) => (
            <div className="course-report-row" key={`${row.run_id}-${row.round_no}-${row.team_id}`}>
              <strong>{row.team_name}</strong>
              <span>
                {row.run_id} / round {row.round_no}
              </span>
              <ul>
                {row.metrics.map((metric) => (
                  <li key={metric.kpi}>
                    {metric.kpi}: {metric.value}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <small>Known limits: {report.known_limits.join(", ")}</small>
        </article>
      ) : null}
      {receipt ? (
        <article className={receiptClassName} aria-label="Course report export receipt">
          <h3>Course report export receipt</h3>
          <p>
            {receipt.file_name} ({receipt.export_format}) is ready.
          </p>
        </article>
      ) : null}
    </WorkbenchFrame>
  );
}
