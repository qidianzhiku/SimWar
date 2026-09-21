import { useEffect, useState } from "react";
import type {
  StudentLearningReportPublic,
  StudentLearningReportPublicListDto
} from "@simwar/shared-contracts";
import { fetchStudentLearningReports } from "./student-learning-report-client";

/** Stable Chinese primary copy for the student report surface. */
export const learningReportCopy = {
  eyebrow: "学习报告",
  eyebrowCompatibility: "D4 Student Learning Report",
  reportIdentity: "报告身份",
  reportIdentityCompatibility: "Report identity",
  safeBadge: "学员安全视图",
  safeBadgeCompatibility: "student-safe",
  coursePackage: "课程包",
  coursePackageCompatibility: "CoursePackage",
  learningGoal: "学习目标",
  learningGoalCompatibility: "Learning Goal",
  rubric: "评价量规",
  rubricCompatibility: "Rubric",
  evidence: "证据",
  evidenceCompatibility: "Evidence",
  learningEvidence: "学习证据",
  learningEvidenceCompatibility: "Learning Evidence",
  businessOutcome: "业务结果",
  businessOutcomeCompatibility: "Business Outcome",
  separateSafeSurface: "独立安全结果面",
  separateSafeSurfaceCompatibility: "separate safe surface",
  digest: "报告摘要",
  digestCompatibility: "Report digest"
} as const;

type ReportState =
  | { kind: "blocked" }
  | { kind: "loading" }
  | { kind: "empty"; data: StudentLearningReportPublicListDto }
  | { kind: "ready"; data: StudentLearningReportPublicListDto }
  | { kind: "error"; message: string };

export function StudentLearningReportPanel({
  token,
  tenantId,
  published = true
}: {
  token: string;
  tenantId: string;
  published?: boolean;
}) {
  const [state, setState] = useState<ReportState>({ kind: published ? "loading" : "blocked" });

  useEffect(() => {
    const controller = new AbortController();
    if (!published) {
      setState({ kind: "blocked" });
      return () => controller.abort();
    }
    setState({ kind: "loading" });
    fetchStudentLearningReports(token, tenantId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setState(data.reports.length === 0 ? { kind: "empty", data } : { kind: "ready", data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "报告加载失败"
        });
      });
    return () => controller.abort();
  }, [published, tenantId, token]);

  return (
    <section
      className="panel d4-report-panel"
      aria-label="student learning report"
      aria-busy={state.kind === "loading"}
    >
      <div className="panel-title">
        <div>
          <p className="eyebrow">
            {learningReportCopy.eyebrow}{" "}
            <span className="compatibility-copy">{learningReportCopy.eyebrowCompatibility}</span>
          </p>
          <h2>我的学习报告</h2>
        </div>
        <span className="d4-state" role="status">
          {labelForState(state.kind).primary}{" "}
          <span className="compatibility-copy">{labelForState(state.kind).compatibility}</span>
        </span>
      </div>
      {state.kind === "loading" ? <p className="muted">正在读取已确认的学习证据…</p> : null}
      {state.kind === "blocked" ? (
        <div className="d4-empty d4-empty--blocked" data-testid="student-learning-report-blocked">
          <strong>正式结果发布后，学习报告才会开放</strong>
          <p>当前页面不会读取、预取或缓存未发布的正式结果与学习证据。</p>
        </div>
      ) : null}
      {state.kind === "error" ? (
        <p className="d4-error" role="alert">
          <span>学习报告暂不可用。</span>{" "}
          <span className="compatibility-copy">{state.message}</span>
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
            <ReportCard key={report.report_id} report={report} />
          ))}
        </div>
      ) : null}
      {state.kind === "ready" || state.kind === "empty" ? (
        <ul className="d4-known-limits" aria-label="学习报告已知限制">
          {state.data.known_limits.map((limit) => (
            <li key={limit}>
              <span>服务端限制：</span>
              <span className="compatibility-copy">{limit}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ReportCard({ report }: { report: StudentLearningReportPublic }) {
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
          <span>
            {learningReportCopy.reportIdentity}{" "}
            <span className="compatibility-copy">
              {learningReportCopy.reportIdentityCompatibility}
            </span>
          </span>
          <strong>
            {report.context.round_id} · {report.context.round_no}
          </strong>
        </div>
        <span className="d4-safe-badge">
          {learningReportCopy.safeBadge}{" "}
          <span className="compatibility-copy">{learningReportCopy.safeBadgeCompatibility}</span>
        </span>
      </div>
      <div className="d4-report-grid">
        <div>
          <span>
            {learningReportCopy.coursePackage}{" "}
            <span className="compatibility-copy">
              {learningReportCopy.coursePackageCompatibility}
            </span>
          </span>
          <strong>{report.context.course_id}</strong>
        </div>
        <div>
          <span>
            {learningReportCopy.learningGoal}{" "}
            <span className="compatibility-copy">
              {learningReportCopy.learningGoalCompatibility}
            </span>
          </span>
          <strong>已确认的学习目标</strong>
        </div>
        <div>
          <span>
            {learningReportCopy.rubric}{" "}
            <span className="compatibility-copy">{learningReportCopy.rubricCompatibility}</span>
          </span>
          <strong>已确认的评价量规</strong>
        </div>
        <div>
          <span>
            {learningReportCopy.evidence}{" "}
            <span className="compatibility-copy">{learningReportCopy.evidenceCompatibility}</span>
          </span>
          <strong>{report.learning_evidence.criterion_results.length} 项学习证据</strong>
        </div>
      </div>
      <section className="d4-evidence-section" aria-label="learning evidence">
        <div className="d4-section-heading">
          <h4>
            {learningReportCopy.learningEvidence}{" "}
            <span className="compatibility-copy">
              {learningReportCopy.learningEvidenceCompatibility}
            </span>
          </h4>
        </div>
        <ul className="d4-criterion-list">
          {report.learning_evidence.criterion_results.map((criterion) => (
            <li key={criterion.criterion_id}>
              <span>{criterion.criterion_id}</span>
              <strong>
                能力等级 {criterion.level_ordinal}{" "}
                <span className="compatibility-copy">Level {criterion.level_ordinal}</span>
              </strong>
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
          <h4>
            {learningReportCopy.businessOutcome}{" "}
            <span className="compatibility-copy">
              {learningReportCopy.businessOutcomeCompatibility}
            </span>
          </h4>
          <span>
            {learningReportCopy.separateSafeSurface}{" "}
            <span className="compatibility-copy">
              {learningReportCopy.separateSafeSurfaceCompatibility}
            </span>
          </span>
        </div>
        <p>
          <span>服务端业务结果安全投影：</span>{" "}
          <span className="compatibility-copy">{report.business_outcome.summary}</span>
        </p>
      </section>
    </article>
  );
}

function labelForState(kind: ReportState["kind"]): {
  primary: string;
  compatibility: string;
} {
  return kind === "blocked"
    ? { primary: "等待发布", compatibility: "blocked" }
    : kind === "ready"
      ? { primary: "已生成", compatibility: "generated" }
      : kind === "empty"
        ? { primary: "暂无报告", compatibility: "empty" }
        : kind === "error"
          ? { primary: "加载失败", compatibility: "failed" }
          : { primary: "加载中", compatibility: "loading" };
}
