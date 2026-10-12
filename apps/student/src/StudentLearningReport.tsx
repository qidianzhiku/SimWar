import { useEffect, useState } from "react";
import type {
  StudentLearningReportPublic,
  StudentLearningReportPublicListDto,
  W3OfficialConsequenceContext
} from "@simwar/shared-contracts";
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

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
  published = true,
  context,
  requestIdentity = "",
  requireExactSourceAdmission = false
}: {
  token: string;
  tenantId: string;
  published?: boolean;
  context?: W3OfficialConsequenceContext | undefined;
  requestIdentity?: string;
  requireExactSourceAdmission?: boolean;
}) {
  const identity = JSON.stringify([
    token,
    tenantId,
    published,
    context,
    requestIdentity,
    requireExactSourceAdmission
  ]);
  const [readAttempt, setReadAttempt] = useState(0);
  const [result, setResult] = useState<{ identity: string; state: ReportState }>({
    identity,
    state: { kind: published ? "loading" : "blocked" }
  });
  const state: ReportState =
    result.identity === identity ? result.state : { kind: published ? "loading" : "blocked" };

  useEffect(() => {
    const controller = new AbortController();
    const setState = (state: ReportState) => setResult({ identity, state });
    if (!published) {
      setState({ kind: "blocked" });
      return () => controller.abort();
    }
    setState({ kind: "loading" });
    let admittedReportId: string | undefined;
    const loadReport = async () => {
      const options = {
        headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId },
        signal: controller.signal
      };
      if (requireExactSourceAdmission) {
        if (!context || context.tenant_id !== tenantId) throw new Error("Report unavailable");
        const { isStudentW3ResponseForContext } =
          await import("./W3OfficialConsequenceLearningPanel");
        if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
        const query = new URLSearchParams(
          Object.entries(context).map(([key, value]) => [key, String(value)])
        );
        const response = await fetch(
          `${API_BASE}/api/v1/bff/student/w3/consequence?${query}`,
          options
        );
        const envelope = (await response.json()) as {
          code?: string;
          error?: unknown;
          data?: { visibility?: string; record?: unknown };
        };
        if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
        if (
          !response.ok ||
          envelope.error !== undefined ||
          (envelope.code !== undefined && envelope.code !== "OK") ||
          !isStudentW3ResponseForContext(envelope.data, context)
        )
          throw new Error("Report unavailable");
        const record = envelope.data.record;
        const ref = record.learning.student_learning_report_ref;
        if (
          !Object.entries(context).every(
            ([key, value]) => record.context[key as keyof W3OfficialConsequenceContext] === value
          ) ||
          record.publication.status !== "PUBLISHED" ||
          !ref ||
          ref.resource_type !== "student_learning_report" ||
          ref.tenant_id !== tenantId
        )
          throw new Error("Report unavailable");
        admittedReportId = ref.resource_id;
      }
      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
      return fetch(
        `${API_BASE}/api/v1/bff/student/learning-reports${admittedReportId ? `/${encodeURIComponent(admittedReportId)}` : ""}`,
        options
      );
    };
    loadReport()
      .then(async (response) => {
        const envelope = (await response.json()) as {
          code?: string;
          error?: unknown;
          data?: StudentLearningReportPublicListDto;
        };
        if (
          !response.ok ||
          envelope.error !== undefined ||
          (envelope.code !== undefined && envelope.code !== "OK") ||
          !envelope.data
        )
          throw new Error("Report unavailable");
        return envelope.data;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (
          data?.report_schema_version !== "student-learning-report.public.v1" ||
          data.scope !== "student_team" ||
          !Array.isArray(data.reports) ||
          !Array.isArray(data.known_limits)
        )
          throw new Error("Report unavailable");
        if (
          !data.known_limits.every((x) => typeof x === "string") ||
          !data.reports.every(isPublicReport)
        )
          throw new Error("Report unavailable");
        const scoped = context
          ? {
              ...data,
              reports: data.reports.filter(
                (report) =>
                  (!admittedReportId || report.report_id === admittedReportId) &&
                  report?.context &&
                  (
                    ["course_id", "run_id", "team_id", "round_id", "round_no", "role_key"] as const
                  ).every((key) => report.context[key] === context[key])
              )
            }
          : data;
        setState(
          scoped.reports.length === 0
            ? { kind: "empty", data: scoped }
            : { kind: "ready", data: scoped }
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          kind: "error",
          message: "报告加载失败"
        });
      });
    return () => controller.abort();
  }, [identity, published, tenantId, token, context, readAttempt, requireExactSourceAdmission]);

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
          <button type="button" onClick={() => setReadAttempt((attempt) => attempt + 1)}>
            重新读取学习报告
          </button>
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

function isPublicReport(value: unknown): value is StudentLearningReportPublic {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as StudentLearningReportPublic;
  const keys = ["report_id", "context", "status", "learning_evidence", "business_outcome"];
  if (Object.keys(r).some((key) => !keys.includes(key))) return false;
  const c = r.context;
  const contextKeys = [
    "course_id",
    "run_id",
    "team_id",
    "round_id",
    "round_no",
    "role_key"
  ] as const;
  return (
    typeof r.report_id === "string" &&
    r.report_id.length > 0 &&
    (r.status === "CONFIRMED" || r.status === "AMENDED") &&
    Boolean(c && typeof c === "object" && !Array.isArray(c)) &&
    Object.keys(c).length === contextKeys.length &&
    contextKeys.every((key) =>
      key === "round_no"
        ? Number.isSafeInteger(c[key]) && c[key] > 0
        : typeof c[key] === "string" && c[key].length > 0
    ) &&
    Boolean(r.learning_evidence && typeof r.learning_evidence === "object") &&
    Object.keys(r.learning_evidence).every((key) =>
      ["criterion_results", "student_visible_feedback"].includes(key)
    ) &&
    Array.isArray(r.learning_evidence.criterion_results) &&
    r.learning_evidence.criterion_results.every(
      (item) =>
        item && typeof item.criterion_id === "string" && Number.isInteger(item.level_ordinal)
    ) &&
    Array.isArray(r.learning_evidence.student_visible_feedback) &&
    r.learning_evidence.student_visible_feedback.every(
      (item) => item && typeof item.feedback_id === "string" && typeof item.text === "string"
    ) &&
    r.business_outcome?.status === "SEPARATE_SAFE_OUTCOME" &&
    typeof r.business_outcome.summary === "string"
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
