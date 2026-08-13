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
      return { phase: "BLOCKED", message: "Report access is not available for this session." };
    if (error.status === 404)
      return { phase: "STALE", message: "The selected report scope is no longer available." };
    if (error.code === "COURSE_REPORT_INPUT_INVALID")
      return { phase: "ERROR", message: "Report filters are invalid." };
    if (error.code === "COURSE_REPORT_EXPORT_FORMAT_UNSUPPORTED")
      return { phase: "ERROR", message: "The requested export format is unavailable." };
  }
  return { phase: "ERROR", message: "Report request could not be completed." };
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
      eyebrow="Teacher-safe projection"
      title="Course Report Builder"
      badge="Teacher BFF"
      boundary={
        "Reports are read-only server projections. They never expose Student-private fields, internal digests, Truth, canonical Decision, or Replay internals."
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
