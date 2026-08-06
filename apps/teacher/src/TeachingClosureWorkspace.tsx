import { useMemo, useState } from "react";
import type {
  CoursePackageVersionTeacherDto,
  TeachingClosureContext,
  TeachingClosureDto
} from "@simwar/shared-contracts";
import { CourseReportBuilder } from "./CourseReportBuilder";
import { D5ExportWorkbench } from "./D5ExportWorkbench";
import { EvidenceWorkbench } from "./EvidenceWorkbench";
import { TeacherConfirmationWorkbench } from "./TeacherConfirmationWorkbench";
import { loadTeachingClosure, TeachingClosureRequestError } from "./teaching-closure-client";

type Surface = "QUEUE" | "EVIDENCE" | "CONFIRMATION" | "OUTCOME" | "REPORT" | "EXPORT";

const EMPTY_CONTEXT: TeachingClosureContext = {
  activity_id: "",
  course_id: "",
  role_key: "",
  run_id: "",
  team_id: ""
};

function statusLabel(snapshot: TeachingClosureDto | null): string {
  if (!snapshot) return "not loaded";
  if (snapshot.queue_item.outcome_status === "CONFIRMED") return "confirmed";
  if (snapshot.queue_item.confirmation_status === "REJECTED") return "revise required";
  if (snapshot.queue_item.missing.length > 0) return "evidence pending";
  return "ready for confirmation";
}

function contextComplete(context: TeachingClosureContext): boolean {
  return Object.values(context).every((value) => value.trim().length > 0);
}

function downloadText(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function closureMarkdown(snapshot: TeachingClosureDto): string {
  const { context, queue_item, student_safe_preview } = snapshot;
  return [
    "# Teaching Closure",
    "",
    `- Course: ${context.course_id}`,
    `- Run: ${context.run_id}`,
    `- Team: ${context.team_id}`,
    `- Role: ${context.role_key}`,
    `- Activity: ${context.activity_id}`,
    `- Confirmation: ${queue_item.confirmation_status}`,
    `- Claim: ${queue_item.claim_status}`,
    `- Evidence artifacts: ${queue_item.evidence_count}`,
    `- Eligible events: ${queue_item.eligible_event_count}`,
    `- Student-safe outcome: ${student_safe_preview.status}`,
    "",
    "## Known Limits",
    ...snapshot.known_limits.map((limit) => `- ${limit}`),
    "",
    "This is a derived teacher-safe projection. It excludes private evidence, Truth, canonical Decision, settlement, score, rank and replay internals."
  ].join("\n");
}

export function TeachingClosureWorkspace({
  apiBase,
  availablePackages,
  courseId,
  runId,
  tenantId,
  token
}: {
  apiBase: string;
  availablePackages: readonly CoursePackageVersionTeacherDto[];
  courseId?: string | null;
  runId?: string | null;
  tenantId: string;
  token: string;
}) {
  const [context, setContext] = useState<TeachingClosureContext>(() => ({
    ...EMPTY_CONTEXT,
    course_id: courseId ?? "",
    run_id: runId ?? ""
  }));
  const [snapshot, setSnapshot] = useState<TeachingClosureDto | null>(null);
  const [surface, setSurface] = useState<Surface>("QUEUE");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const initialScope = useMemo(() => ({ ...context }), [context]);
  const initialReportFilter = useMemo(
    () => ({
      course_id: context.course_id,
      run_id: context.run_id,
      team_id: context.team_id
    }),
    [context]
  );

  function update(field: keyof TeachingClosureContext, value: string): void {
    setContext((current) => ({ ...current, [field]: value }));
    setSnapshot(null);
    setSurface("QUEUE");
    setMessage("");
  }

  async function loadQueue(): Promise<void> {
    if (!contextComplete(context)) {
      setMessage("Complete the exact Course, Run, Team, Role and Activity context first.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      setSnapshot(await loadTeachingClosure(context, { tenantId, token }));
    } catch (error) {
      if (error instanceof TeachingClosureRequestError && error.status === 403) {
        setMessage("This teacher scope is forbidden.");
      } else {
        setMessage(error instanceof Error ? error.message : "Teaching closure queue failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className="candidate-surface w019-teaching-closure"
      aria-label="W019 Teaching Closure Workspace"
    >
      <div className="candidate-heading">
        <div>
          <p className="eyebrow">W019 · Unified Teaching Closure</p>
          <h2>Teaching Closure Workspace</h2>
        </div>
        <span className="d2-status" role="status">
          {statusLabel(snapshot)}
        </span>
      </div>
      <p className="evidence-note">
        One exact teaching context connects eligible evidence, the teacher claim lifecycle, the
        student-safe outcome, the course report and deterministic exports. Existing D2/D3/D4/C5
        authorities remain the only writers and projections.
      </p>

      <div className="w019-context-grid">
        {(["course_id", "run_id", "team_id", "role_key", "activity_id"] as const).map((field) => (
          <label className="field-label" key={field}>
            <span>Exact {field.replaceAll("_", " ")}</span>
            <input
              aria-label={`W019 ${field}`}
              value={context[field]}
              onChange={(event) => update(field, event.target.value)}
            />
          </label>
        ))}
      </div>
      <div className="d2-actions">
        <button className="primary" disabled={loading} onClick={() => void loadQueue()}>
          {loading ? "Loading teaching queue" : "Load teaching queue"}
        </button>
      </div>
      {message ? (
        <p className="d2-state d2-state-error" role="alert">
          {message}
        </p>
      ) : null}

      {snapshot ? (
        <>
          <article className="w019-queue-card" aria-label="W019 context-bound work queue">
            <div>
              <strong>Queue item: {snapshot.queue_item.confirmation_status}</strong>
              <span>
                {snapshot.queue_item.eligible_event_count} eligible event(s) ·{" "}
                {snapshot.queue_item.evidence_count} evidence artifact(s)
              </span>
            </div>
            <div>
              <span>Claim: {snapshot.queue_item.claim_status}</span>
              <span>Owner: {snapshot.queue_item.claim_owner ?? "unclaimed"}</span>
              <span>Expiry: {snapshot.queue_item.claim_expires_at ?? "not claimed"}</span>
              <span>Missing: {snapshot.queue_item.missing.join(", ") || "none"}</span>
            </div>
          </article>
          <nav className="w019-surface-nav" aria-label="Teaching closure stages">
            {(
              [
                ["QUEUE", "Queue"],
                ["EVIDENCE", "Evidence"],
                ["CONFIRMATION", "Claim / confirm"],
                ["OUTCOME", "Student-safe preview"],
                ["REPORT", "Course Report"],
                ["EXPORT", "Closure exports"]
              ] as const
            ).map(([value, label]) => (
              <button
                className={surface === value ? "primary" : "secondary"}
                key={value}
                onClick={() => setSurface(value)}
              >
                {label}
              </button>
            ))}
          </nav>
          {surface === "QUEUE" ? (
            <div className="w019-status-grid" aria-label="W019 queue readiness">
              <span>
                Evidence readiness: {snapshot.queue_item.evidence_count > 0 ? "ready" : "missing"}
              </span>
              <span>Confirmation: {snapshot.queue_item.confirmation_status}</span>
              <span>Student outcome: {snapshot.student_safe_preview.status}</span>
              <span>
                Course report: {snapshot.course_report_available ? "available" : "pending"}
              </span>
            </div>
          ) : null}
          {surface === "EVIDENCE" ? (
            <EvidenceWorkbench
              availablePackages={availablePackages}
              initialScope={initialScope}
              tenantId={tenantId}
              token={token}
            />
          ) : null}
          {surface === "CONFIRMATION" ? (
            <TeacherConfirmationWorkbench
              initialScope={initialScope}
              tenantId={tenantId}
              token={token}
            />
          ) : null}
          {surface === "OUTCOME" ? (
            <article className="w019-safe-preview" aria-label="W019 student safe preview">
              <span className="d2-status">{snapshot.student_safe_preview.status}</span>
              <h3>Student-safe learning outcome</h3>
              <p>Visibility: {snapshot.student_safe_preview.visibility}</p>
              <p>Criteria: {snapshot.student_safe_preview.criterion_count}</p>
              <p>
                Evidence summary: {snapshot.student_safe_preview.evidence_count} exact reference(s)
              </p>
              <p>Next focus: {snapshot.student_safe_preview.next_focus}</p>
              <small>
                Teacher-private, internal evidence, Truth and cross-team fields are excluded.
              </small>
            </article>
          ) : null}
          {surface === "REPORT" ? (
            <CourseReportBuilder
              initialFilter={initialReportFilter}
              sessionKey={`${tenantId}:${token}`}
              tenantId={tenantId}
              token={token}
            />
          ) : null}
          {surface === "EXPORT" ? (
            <>
              <article className="w019-safe-preview" aria-label="W019 closure exports">
                <h3>Exact-context closure exports</h3>
                <p>
                  These files are deterministic teacher-safe projections of the loaded W019
                  context. They do not create an authority record or export private evidence.
                </p>
                <div className="d2-actions">
                  <button
                    onClick={() =>
                      downloadText(
                        `teaching-closure-${context.course_id}-${context.run_id}.json`,
                        JSON.stringify(snapshot, null, 2),
                        "application/json"
                      )
                    }
                  >
                    Download closure JSON
                  </button>
                  <button
                    onClick={() =>
                      downloadText(
                        `teaching-closure-${context.course_id}-${context.run_id}.md`,
                        closureMarkdown(snapshot),
                        "text/markdown"
                      )
                    }
                  >
                    Download derived Markdown
                  </button>
                </div>
              </article>
              <D5ExportWorkbench apiBase={apiBase} tenantId={tenantId} token={token} />
            </>
          ) : null}
        </>
      ) : null}
      {snapshot ? (
        <ul className="d2-known-limits" aria-label="W019 known limits">
          {snapshot.known_limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
