import { useEffect, useState } from "react";
import type { StudentLearningReport, StudentLearningReportListDto } from "@simwar/shared-contracts";
import { fetchStudentLearningReports } from "./student-learning-report-client";

type ReportState =
  | { kind: "loading" }
  | { kind: "empty"; data: StudentLearningReportListDto }
  | { kind: "ready"; data: StudentLearningReportListDto }
  | { kind: "error"; message: string };

export function StudentLearningReportPanel({
  token,
  tenantId
}: {
  token: string;
  tenantId: string;
}) {
  const [state, setState] = useState<ReportState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    fetchStudentLearningReports(token, tenantId, controller.signal)
      .then((data) =>
        setState(data.reports.length === 0 ? { kind: "empty", data } : { kind: "ready", data })
      )
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "报告加载失败"
        });
      });
    return () => controller.abort();
  }, [tenantId, token]);

  return (
    <section
      className="panel d4-report-panel"
      aria-label="student learning report"
      aria-busy={state.kind === "loading"}
    >
      <div className="panel-title">
        <div>
          <p className="eyebrow">D4 Student Learning Report</p>
          <h2>我的学习报告</h2>
        </div>
        <span className="d4-state" role="status">
          {labelForState(state.kind)}
        </span>
      </div>
      {state.kind === "loading" ? <p className="muted">正在读取已确认的学习证据…</p> : null}
      {state.kind === "error" ? (
        <p className="d4-error" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.kind === "empty" ? (
        <div className="d4-empty">
          <strong>暂无可用报告</strong>
          <p>教师确认学习证据后，这里会显示对应的安全投影。</p>
        </div>
      ) : null}
      {state.kind === "ready" ? (
        <div className="d4-report-list">
          {state.data.reports.map((report) => (
            <ReportCard key={report.report_ref.resource_id} report={report} />
          ))}
        </div>
      ) : null}
      {state.kind === "ready" || state.kind === "empty" ? (
        <ul className="d4-known-limits" aria-label="D4 known limits">
          {state.data.known_limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ReportCard({ report }: { report: StudentLearningReport }) {
  return (
    <article className="d4-report-card">
      <div className="d4-report-heading">
        <div>
          <span className="eyebrow">{report.status === "AMENDED" ? "已修订" : "已确认"}</span>
          <h3>
            {report.context.course_id} · {report.context.role_key}
          </h3>
        </div>
        <div className="d4-report-identity">
          <span>Report identity</span>
          <strong>{formatRef(report.report_ref)}</strong>
        </div>
        <span className="d4-safe-badge">student-safe</span>
      </div>
      <div className="d4-report-grid">
        <div>
          <span>CoursePackage</span>
          <strong>{formatRef(report.course_package_ref)}</strong>
        </div>
        <div>
          <span>Learning Goal</span>
          <strong>{formatRef(report.learning_goal_ref)}</strong>
        </div>
        <div>
          <span>Rubric</span>
          <strong>{formatRef(report.rubric_ref)}</strong>
        </div>
        <div>
          <span>Evidence</span>
          <strong>{report.evidence_refs.length} 条精确引用</strong>
        </div>
      </div>
      <section className="d4-evidence-section" aria-label="learning evidence">
        <div className="d4-section-heading">
          <h4>Learning Evidence</h4>
          <span>{report.learning_evidence.provenance_chain.length} 条来源链</span>
        </div>
        <ul className="d4-criterion-list">
          {report.learning_evidence.criterion_results.map((criterion) => (
            <li key={criterion.criterion_id}>
              <span>{criterion.criterion_id}</span>
              <strong>Level {criterion.level_ordinal}</strong>
            </li>
          ))}
        </ul>
        {report.learning_evidence.student_visible_feedback.length === 0 ? (
          <p className="muted">当前没有被 D3 明确标记为学生可见的教师反馈。</p>
        ) : (
          <ul>
            {report.learning_evidence.student_visible_feedback.map((feedback) => (
              <li key={feedback.feedback_id}>{feedback.text}</li>
            ))}
          </ul>
        )}
      </section>
      <section className="d4-outcome-section" aria-label="business outcome separation">
        <div className="d4-section-heading">
          <h4>Business Outcome</h4>
          <span>separate safe surface</span>
        </div>
        <p>{report.business_outcome.summary}</p>
      </section>
      <p className="d4-digest">
        Report digest: <code>{report.report_digest}</code>
      </p>
    </article>
  );
}

function formatRef(reference: StudentLearningReport["report_ref"]): string {
  return `${reference.resource_id} · v${reference.version}`;
}

function labelForState(kind: ReportState["kind"]): string {
  return kind === "ready"
    ? "generated"
    : kind === "empty"
      ? "empty"
      : kind === "error"
        ? "failed"
        : "loading";
}
