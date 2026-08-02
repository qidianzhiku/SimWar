import { useEffect, useRef, useState } from "react";
import {
  COURSE_REPORT_KPIS,
  COURSE_REPORT_ROLE_SLOTS,
  type CourseReportDto,
  type CourseReportExportDto,
  type CourseReportFilterInput,
  type CourseReportKpi,
  type CourseReportRoleSlot
} from "@simwar/shared-contracts";
import {
  CourseReportRequestError,
  exportTeacherCourseReport,
  loadTeacherCourseReport
} from "./course-report-client";

type ReportPhase = "IDLE" | "LOADING" | "READY" | "EMPTY" | "BLOCKED" | "STALE" | "ERROR" | "SUCCESS";
type ReportForm = { course_id: string; run_id: string; team_id: string; role: string; round_no: string; kpis: CourseReportKpi[] };

const EMPTY_FORM: ReportForm = { course_id: "", run_id: "", team_id: "", role: "", round_no: "", kpis: [] };

function messageFor(error: unknown): { phase: Extract<ReportPhase, "BLOCKED" | "STALE" | "ERROR">; message: string } {
  if (error instanceof CourseReportRequestError) {
    if (error.status === 401 || error.status === 403) return { phase: "BLOCKED", message: "Report access is not available for this session." };
    if (error.status === 404) return { phase: "STALE", message: "The selected report scope is no longer available." };
    if (error.code === "COURSE_REPORT_INPUT_INVALID") return { phase: "ERROR", message: "Report filters are invalid." };
    if (error.code === "COURSE_REPORT_EXPORT_FORMAT_UNSUPPORTED") return { phase: "ERROR", message: "The requested export format is unavailable." };
  }
  return { phase: "ERROR", message: "Report request could not be completed." };
}

function toFilter(form: ReportForm): CourseReportFilterInput {
  return {
    course_id: form.course_id.trim(),
    ...(form.run_id.trim() ? { run_id: form.run_id.trim() } : {}),
    ...(form.team_id.trim() ? { team_id: form.team_id.trim() } : {}),
    ...(form.role ? { role: form.role as CourseReportRoleSlot } : {}),
    ...(form.round_no ? { round_no: Number(form.round_no) } : {}),
    ...(form.kpis.length ? { kpis: form.kpis } : {})
  };
}

export function CourseReportBuilder(props: { sessionKey: string; token: string }) {
  const [form, setForm] = useState<ReportForm>(EMPTY_FORM);
  const [phase, setPhase] = useState<ReportPhase>("IDLE");
  const [message, setMessage] = useState("");
  const [report, setReport] = useState<CourseReportDto | null>(null);
  const [receipt, setReceipt] = useState<CourseReportExportDto | null>(null);
  const requestEpoch = useRef(0);

  useEffect(() => {
    requestEpoch.current += 1;
    setForm(EMPTY_FORM);
    setPhase("IDLE");
    setMessage("");
    setReport(null);
    setReceipt(null);
  }, [props.sessionKey]);

  function change(next: Partial<ReportForm>): void {
    requestEpoch.current += 1;
    setForm((current) => ({ ...current, ...next }));
    setPhase("IDLE");
    setMessage("");
    setReport(null);
    setReceipt(null);
  }

  async function preview(): Promise<void> {
    const filter = toFilter(form);
    if (!filter.course_id) { setPhase("ERROR"); setMessage("A Course is required."); return; }
    const epoch = ++requestEpoch.current;
    setPhase("LOADING"); setMessage(""); setReceipt(null);
    try {
      const next = await loadTeacherCourseReport(filter, props.token);
      if (epoch !== requestEpoch.current) return;
      setReport(next); setPhase(next.rows.length ? "READY" : "EMPTY");
    } catch (error) {
      if (epoch !== requestEpoch.current) return;
      const next = messageFor(error); setPhase(next.phase); setMessage(next.message);
    }
  }

  async function exportReport(format: "json" | "csv"): Promise<void> {
    const filter = toFilter(form);
    if (!filter.course_id) { setPhase("ERROR"); setMessage("A Course is required."); return; }
    const epoch = ++requestEpoch.current;
    setPhase("LOADING"); setMessage("");
    try {
      const next = await exportTeacherCourseReport(filter, format, props.token);
      if (epoch !== requestEpoch.current) return;
      setReport(next.report); setReceipt(next); setPhase("SUCCESS");
    } catch (error) {
      if (epoch !== requestEpoch.current) return;
      const next = messageFor(error); setPhase(next.phase); setMessage(next.message);
    }
  }

  return (
    <section className="course-report-surface" aria-label="Teacher Course Report Builder">
      <div className="candidate-heading"><div><p className="eyebrow">Teacher-safe projection</p><h2>Course Report Builder</h2></div><span>Teacher BFF</span></div>
      <p className="evidence-note">Reports are read-only server projections. They never expose Student-private fields, internal digests, Truth, Settlement, Score, Rank, or Replay internals.</p>
      <div className="course-report-filters">
        <label>Course<input aria-label="report course" value={form.course_id} onChange={(event) => change({ course_id: event.target.value })} /></label>
        <label>Run<input aria-label="report run" value={form.run_id} onChange={(event) => change({ run_id: event.target.value })} /></label>
        <label>Team<input aria-label="report team" value={form.team_id} onChange={(event) => change({ team_id: event.target.value })} /></label>
        <label>Role<select aria-label="report role" value={form.role} onChange={(event) => change({ role: event.target.value })}><option value="">All roles</option>{COURSE_REPORT_ROLE_SLOTS.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
        <label>Round<input aria-label="report round" min="1" type="number" value={form.round_no} onChange={(event) => change({ round_no: event.target.value })} /></label>
        <fieldset><legend>KPI</legend>{COURSE_REPORT_KPIS.map((kpi) => <label key={kpi}><input aria-label={`KPI ${kpi}`} checked={form.kpis.includes(kpi)} type="checkbox" onChange={(event) => change({ kpis: event.target.checked ? [...form.kpis, kpi] : form.kpis.filter((value) => value !== kpi) })} />{kpi}</label>)}</fieldset>
      </div>
      <div className="candidate-actions"><button disabled={phase === "LOADING"} onClick={() => void preview()}>Preview Course Report</button><button disabled={phase === "LOADING"} onClick={() => void exportReport("json")}>Export report as JSON</button><button disabled={phase === "LOADING"} onClick={() => void exportReport("csv")}>Export report as CSV</button></div>
      {phase === "LOADING" ? <p role="status">Loading safe Course Report</p> : null}
      {phase === "EMPTY" ? <p role="status">No safe report rows match this scope.</p> : null}
      {phase === "BLOCKED" || phase === "STALE" || phase === "ERROR" ? <p role="alert">{message}</p> : null}
      {report ? <article className="candidate-preview" aria-label="Course report preview"><h3>Course report preview</h3>{report.rows.map((row) => <div className="course-report-row" key={`${row.run_id}-${row.round_no}-${row.team_id}`}><strong>{row.team_name}</strong><span>{row.run_id} / round {row.round_no}</span><ul>{row.metrics.map((metric) => <li key={metric.kpi}>{metric.kpi}: {metric.value}</li>)}</ul></div>)}<small>Known limits: {report.known_limits.join(", ")}</small></article> : null}
      {receipt ? <article className="candidate-preview" aria-label="Course report export receipt"><h3>Course report export receipt</h3><p>{receipt.file_name} ({receipt.export_format}) is ready.</p></article> : null}
    </section>
  );
}
