import {
  COURSE_REPORT_KPIS,
  COURSE_REPORT_ROLE_SLOTS,
  type CourseReportFilterInput
} from "@simwar/shared-contracts";
import { CourseReportWorkbench } from "@simwar/ui";
import {
  CourseReportRequestError,
  exportTeacherCourseReport,
  loadTeacherCourseReport
} from "./course-report-client";

function messageFor(error: unknown): {
  phase: "BLOCKED" | "STALE" | "ERROR";
  message: string;
} {
  if (error instanceof CourseReportRequestError) {
    if (error.status === 401 || error.status === 403)
      return { phase: "BLOCKED", message: "当前会话无权访问课程报告。" };
    if (error.status === 404) return { phase: "STALE", message: "所选报告范围已不可用。" };
    if (error.code === "COURSE_REPORT_INPUT_INVALID")
      return { phase: "ERROR", message: "报告筛选条件无效。" };
    if (error.code === "COURSE_REPORT_EXPORT_FORMAT_UNSUPPORTED")
      return { phase: "ERROR", message: "请求的导出格式不可用。" };
  }
  return { phase: "ERROR", message: "课程报告请求未完成。" };
}

export function CourseReportBuilder(props: {
  initialFilter?: Partial<CourseReportFilterInput>;
  sessionKey: string;
  tenantId: string;
  token: string;
}) {
  return (
    <CourseReportWorkbench
      ariaLabel="Teacher Course Report Builder"
      eyebrow="教师安全投影"
      title="Course Report Builder"
      badge="教师 BFF"
      boundary={
        "报告仅为只读服务端投影，不暴露学员私有字段、内部摘要、真值、规范决策或 Replay 内部数据。"
      }
      roles={COURSE_REPORT_ROLE_SLOTS}
      kpis={COURSE_REPORT_KPIS}
      {...(props.initialFilter ? { initialFilter: props.initialFilter } : {})}
      sessionKey={props.sessionKey}
      headingClassName="candidate-heading"
      boundaryClassName="evidence-note"
      actionsClassName="candidate-actions"
      previewClassName="candidate-preview"
      receiptClassName="candidate-preview"
      loadReport={(filter) =>
        loadTeacherCourseReport(filter as CourseReportFilterInput, {
          tenantId: props.tenantId,
          token: props.token
        })
      }
      exportReport={(filter, format) =>
        exportTeacherCourseReport(filter as CourseReportFilterInput, format, {
          tenantId: props.tenantId,
          token: props.token
        })
      }
      mapError={messageFor}
    />
  );
}
