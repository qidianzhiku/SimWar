import { useEffect, useState } from "react";
import type { ApiEnvelope, Team, ValidationSessionRecord } from "@simwar/shared-contracts";

type Props = {
  apiBase: string;
  courseId?: string | null;
  runId?: string | null;
  tenantId: string;
  token: string;
  teacherUserId: string;
  teams: Team[];
};

async function request<T>(
  apiBase: string,
  path: string,
  token: string,
  tenantId: string,
  method = "GET",
  body?: unknown
): Promise<T> {
  const init: RequestInit = {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "x-tenant-id": tenantId,
      "content-type": "application/json"
    }
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const response = await fetch(`${apiBase}${path}`, init);
  const envelope = (await response.json()) as ApiEnvelope<T> & { message: string; code: string };
  if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
  return envelope.data;
}

export function ValidationSessionWorkbench({
  apiBase,
  courseId,
  runId,
  tenantId,
  token,
  teacherUserId,
  teams
}: Props) {
  const [session, setSession] = useState<ValidationSessionRecord | null>(null);
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");
  const [admissionReference, setAdmissionReference] = useState("w022-machine-admission");
  const [admissionDigest, setAdmissionDigest] = useState("");
  const [narrative, setNarrative] = useState("");

  useEffect(() => {
    setSession(null);
    setMessage("");
    setPhase(courseId && runId ? "ready" : "idle");
  }, [courseId, runId]);

  async function run(action: () => Promise<ValidationSessionRecord>): Promise<void> {
    setPhase("loading");
    setMessage("");
    try {
      setSession(await action());
      setPhase("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "session operation failed");
      setPhase("error");
    }
  }

  function create(): void {
    if (!courseId || !runId) return;
    void run(() =>
      request(apiBase, "/api/v1/bff/teacher/validation-sessions", token, tenantId, "POST", {
        course_id: courseId,
        run_id: runId,
        source_product_merge_sha: "31b8c5f5cd3ab0426bb02bc75495b8552e497c48",
        machine_admission_reference: admissionReference,
        machine_admission_digest: admissionDigest,
        idempotency_key: `w023-${courseId}-${runId}`
      })
    );
  }

  function roster(): void {
    if (!session) return;
    const learnerParticipants = teams.flatMap((team) =>
      team.members
        .filter((member) => member.role_slot !== "risk")
        .map((member) => ({
          participant_id: `learner-${team.team_id}-${member.user_id}`,
          session_duty: "LEARNER" as const,
          participant_kind: "SYNTHETIC" as const,
          product_user_id: member.user_id,
          team_id: team.team_id,
          role_key: member.role_slot
        }))
    );
    void run(() =>
      request(
        apiBase,
        `/api/v1/bff/teacher/validation-sessions/${session.session_id}/roster`,
        token,
        tenantId,
        "POST",
        {
          participants: [
            {
              participant_id: "teacher-synthetic",
              session_duty: "TEACHER",
              participant_kind: "SYNTHETIC",
              product_user_id: teacherUserId
            },
            ...learnerParticipants,
            {
              participant_id: "moderator-synthetic",
              session_duty: "MODERATOR",
              participant_kind: "SYNTHETIC"
            },
            {
              participant_id: "observer-synthetic",
              session_duty: "OBSERVER",
              participant_kind: "SYNTHETIC"
            },
            {
              participant_id: "recorder-synthetic",
              session_duty: "RECORDER",
              participant_kind: "SYNTHETIC"
            }
          ]
        }
      )
    );
  }

  const action = (suffix: string) => {
    if (!session) return;
    void run(() =>
      request(
        apiBase,
        `/api/v1/bff/teacher/validation-sessions/${session.session_id}/${suffix}`,
        token,
        tenantId,
        "POST"
      )
    );
  };

  function addObservation(): void {
    if (!session || !narrative.trim()) return;
    void run(() =>
      request(
        apiBase,
        `/api/v1/bff/teacher/validation-sessions/${session.session_id}/observations`,
        token,
        tenantId,
        "POST",
        {
          participant_id: "observer-synthetic",
          session_duty: "OBSERVER",
          phase: "LIVE",
          category: "operator",
          narrative,
          evidence_refs: []
        }
      )
    );
    setNarrative("");
  }

  return (
    <section
      className="candidate-surface w023-session-workbench"
      aria-label="W023 Validation Session Control Plane"
    >
      <div className="candidate-heading">
        <div>
          <p className="eyebrow">W023 · Human Validation Session Control Plane</p>
          <h2>Session Operations</h2>
        </div>
        <span role="status">{session?.status ?? phase}</span>
      </div>
      <p className="evidence-note">
        Synthetic rehearsal only. Human Validation, teaching effectiveness and real-human
        attestation remain NOT_PERFORMED / NOT_PROVEN.
      </p>
      {!session ? (
        <div className="w023-session-grid">
          <label>
            Machine admission reference
            <input
              value={admissionReference}
              onChange={(event) => setAdmissionReference(event.target.value)}
            />
          </label>
          <label>
            Machine admission digest
            <input
              value={admissionDigest}
              onChange={(event) => setAdmissionDigest(event.target.value)}
              placeholder="64-character SHA-256 digest"
            />
          </label>
          <button
            className="primary"
            disabled={
              !courseId || !runId || phase === "loading" || !/^[a-f0-9]{64}$/.test(admissionDigest)
            }
            onClick={create}
          >
            Create synthetic session
          </button>
        </div>
      ) : (
        <>
          <div className="w023-session-context">
            <strong>
              {session.course_id} / {session.run_id}
            </strong>
            <span>{session.session_id}</span>
            <span>Mode: {session.execution_mode}</span>
          </div>
          <div className="w023-session-actions">
            <button
              className="secondary"
              disabled={session.status !== "DRAFT" && session.status !== "PREFLIGHT_READY"}
              onClick={roster}
            >
              Set synthetic roster
            </button>
            <button
              className="secondary"
              disabled={
                session.status === "LIVE" ||
                session.status === "CLOSED" ||
                session.status === "ABORTED"
              }
              onClick={() => action("preflight")}
            >
              Run preflight
            </button>
            <button
              className="primary"
              disabled={session.status !== "PREFLIGHT_READY"}
              onClick={() => action("start")}
            >
              Start LIVE
            </button>
            <button
              className="secondary"
              disabled={session.status !== "LIVE"}
              onClick={addObservation}
            >
              Capture observation
            </button>
            <button
              className="secondary"
              disabled={session.status !== "LIVE"}
              onClick={() => action("close")}
            >
              Close and export evidence
            </button>
            <button
              className="secondary"
              disabled={session.status === "CLOSED" || session.status === "ABORTED"}
              onClick={() => action("abort")}
            >
              Abort session
            </button>
            <button
              className="secondary"
              disabled={
                session.status !== "ABORTED" || session.cleanup_receipt?.status === "COMPLETED"
              }
              onClick={() => action("cleanup")}
            >
              Complete cleanup
            </button>
          </div>
          {session.status === "LIVE" ? (
            <label>
              Bounded observation narrative
              <input
                value={narrative}
                onChange={(event) => setNarrative(event.target.value)}
                placeholder="bounded synthetic observation"
              />
            </label>
          ) : null}
          {session.preflight ? (
            <p className="w023-preflight" role="status">
              Preflight: {session.preflight.status} {session.preflight.reasons.join(", ")}
            </p>
          ) : null}
          {session.evidence_bundle ? (
            <article className="w023-evidence-receipt">
              <strong>Canonical evidence sealed</strong>
              <code>{session.evidence_bundle.evidence_digest}</code>
              <pre>{session.evidence_bundle.markdown_report}</pre>
            </article>
          ) : null}
        </>
      )}
      {message ? (
        <p className="readiness-message" role="alert">
          {message}
        </p>
      ) : null}
      <ul className="tag-list">
        <li>JSON_INTERNAL_ONLY</li>
        <li>HUMAN_VALIDATION_NOT_PERFORMED</li>
        <li>SESSION_DUTY_IS_NOT_PLATFORM_RBAC</li>
        <li>W024 NOT_STARTED</li>
      </ul>
    </section>
  );
}
