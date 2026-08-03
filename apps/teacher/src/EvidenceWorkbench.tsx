import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ApiEnvelope,
  CoursePackageVersionTeacherDto,
  D2CaptureReceipt,
  D2EvidenceArtifactVersion,
  D2EvidenceListDto,
  D2EvidenceQuery,
  D2ExactRef,
  LearningDesignListDto
} from "@simwar/shared-contracts";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

type EvidenceSurfaceState = "IDLE" | "LOADING" | "EMPTY" | "READY" | "STALE" | "FORBIDDEN" | "ERROR";
type CaptureSurfaceState = "IDLE" | "LOADING" | "GENERATED" | "REUSED" | "DUPLICATE" | "FORBIDDEN" | "ERROR";

type EvidenceScope = D2EvidenceQuery;

type EvidenceWorkbenchProps = {
  courseId?: string | null;
  runId?: string | null;
  tenantId: string;
  token: string;
};

type RequestFailure = Error & { code?: string; status?: number };

const EMPTY_DESIGN: LearningDesignListDto = {
  explicit_non_proofs: [],
  learning_goals: [],
  rubrics: [],
  runtime_authority: "JSON_INTERNAL_ONLY"
};

function exactRef(
  resourceType: D2ExactRef["resource_type"],
  resourceId: string,
  reference: { content_digest: string; tenant_id: string; version: string }
): D2ExactRef {
  return {
    content_digest: reference.content_digest,
    discriminator: "exact_ref",
    resource_id: resourceId,
    resource_type: resourceType,
    tenant_id: reference.tenant_id,
    version: reference.version
  };
}

function refLabel(reference: D2ExactRef): string {
  return `${reference.resource_id} / ${reference.version} / ${reference.content_digest}`;
}

function authHeaders(token: string, tenantId: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-tenant-id": tenantId
  };
}

async function readEnvelope<T>(response: Response): Promise<T> {
  const envelope = (await response.json()) as ApiEnvelope<T> & { code?: string; message?: string };
  if (!response.ok) {
    const error = new Error(envelope.message ?? "D2 request failed") as RequestFailure;
    error.code = envelope.code;
    error.status = response.status;
    throw error;
  }
  return envelope.data;
}

function captureErrorState(error: unknown): CaptureSurfaceState {
  const failure = error as RequestFailure;
  if (failure.status === 403 || failure.code?.includes("FORBIDDEN")) return "FORBIDDEN";
  if (failure.status === 409 || failure.code?.includes("DUPLICATE")) return "DUPLICATE";
  return "ERROR";
}

function evidenceErrorState(error: unknown): EvidenceSurfaceState {
  const failure = error as RequestFailure;
  return failure.status === 403 || failure.code?.includes("FORBIDDEN") ? "FORBIDDEN" : "ERROR";
}

function statusLabel(state: EvidenceSurfaceState): string {
  switch (state) {
    case "IDLE":
      return "Select a complete scope";
    case "LOADING":
      return "Loading eligible events";
    case "EMPTY":
      return "No eligible events or evidence in this scope";
    case "READY":
      return "Evidence scope ready";
    case "STALE":
      return "Scope changed; reload before capture";
    case "FORBIDDEN":
      return "Teacher permission or scope denied";
    case "ERROR":
      return "Evidence read failed";
  }
}

function artifactSummary(artifact: D2EvidenceArtifactVersion): string {
  return `${artifact.artifact_ref.resource_id} / ${artifact.artifact_ref.version}`;
}

export function EvidenceWorkbench({ courseId, runId, tenantId, token }: EvidenceWorkbenchProps) {
  const [scope, setScope] = useState<EvidenceScope>({
    activity_id: "",
    course_id: courseId ?? "",
    role_key: "",
    run_id: runId ?? "",
    team_id: ""
  });
  const [packages, setPackages] = useState<readonly CoursePackageVersionTeacherDto[]>([]);
  const [design, setDesign] = useState<LearningDesignListDto>(EMPTY_DESIGN);
  const [referenceState, setReferenceState] = useState<"LOADING" | "READY" | "ERROR">("LOADING");
  const [surfaceState, setSurfaceState] = useState<EvidenceSurfaceState>("IDLE");
  const [captureState, setCaptureState] = useState<CaptureSurfaceState>("IDLE");
  const [evidence, setEvidence] = useState<D2EvidenceListDto | null>(null);
  const [receipt, setReceipt] = useState<D2CaptureReceipt | null>(null);
  const [selectedPackageKey, setSelectedPackageKey] = useState("");
  const [selectedGoalKey, setSelectedGoalKey] = useState("");
  const [selectedRubricKey, setSelectedRubricKey] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setScope((current) => ({
      ...current,
      course_id: courseId ?? current.course_id,
      run_id: runId ?? current.run_id
    }));
  }, [courseId, runId]);

  useEffect(() => {
    const controller = new AbortController();
    setReferenceState("LOADING");
    void Promise.all([
      fetch(`${API_BASE}/api/v1/bff/teacher/course-package-versions`, {
        headers: authHeaders(token, tenantId),
        signal: controller.signal
      }).then((response) => readEnvelope<{ course_package_versions: CoursePackageVersionTeacherDto[] }>(response)),
      fetch(`${API_BASE}/api/v1/bff/teacher/learning-designs`, {
        headers: authHeaders(token, tenantId),
        signal: controller.signal
      }).then((response) => readEnvelope<LearningDesignListDto>(response))
    ])
      .then(([packageData, designData]) => {
        setPackages(packageData.course_package_versions);
        setDesign(designData);
        setReferenceState("READY");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setReferenceState("ERROR");
        setErrorMessage(error instanceof Error ? error.message : "Exact reference read failed");
      });
    return () => controller.abort();
  }, [tenantId, token]);

  const selectedPackage = useMemo(
    () =>
      packages.find(
        (candidate) =>
          `${candidate.course_package_reference.course_package_id}:${candidate.course_package_reference.version}` ===
          selectedPackageKey
      ),
    [packages, selectedPackageKey]
  );
  const selectedGoal = useMemo(
    () =>
      design.learning_goals.find(
        (candidate) => `${candidate.goal_id}:${candidate.version}` === selectedGoalKey
      ),
    [design.learning_goals, selectedGoalKey]
  );
  const selectedRubric = useMemo(
    () =>
      design.rubrics.find(
        (candidate) => `${candidate.rubric_id}:${candidate.version}` === selectedRubricKey
      ),
    [design.rubrics, selectedRubricKey]
  );
  const selectedEvent = evidence?.eligible_events.find((event) => event.event_id === selectedEventId);
  const scopeComplete = Object.values(scope).every((value) => value.trim().length > 0);
  const refsComplete = Boolean(selectedPackage && selectedGoal && selectedRubric);
  const canCapture = surfaceState === "READY" && scopeComplete && refsComplete && Boolean(selectedEvent);

  const updateScope = useCallback(
    (key: keyof EvidenceScope, value: string) => {
      setScope((current) => ({ ...current, [key]: value }));
      setSelectedEventId("");
      setReceipt(null);
      setCaptureState("IDLE");
      if (evidence) setSurfaceState("STALE");
    },
    [evidence]
  );

  const loadEvidence = useCallback(async () => {
    if (!scopeComplete) {
      setSurfaceState("IDLE");
      setErrorMessage("Complete course, run, team, role and activity before loading events.");
      return;
    }
    setSurfaceState("LOADING");
    setErrorMessage("");
    const query = new URLSearchParams(Object.entries(scope));
    try {
      const response = await fetch(`${API_BASE}/api/v1/bff/teacher/evidence?${query.toString()}`, {
        headers: authHeaders(token, tenantId)
      });
      const data = await readEnvelope<D2EvidenceListDto>(response);
      setEvidence(data);
      setSurfaceState(data.eligible_events.length === 0 && data.artifacts.length === 0 ? "EMPTY" : "READY");
    } catch (error) {
      setSurfaceState(evidenceErrorState(error));
      setErrorMessage(error instanceof Error ? error.message : "Evidence read failed");
    }
  }, [scope, scopeComplete, tenantId, token]);

  async function captureEvidence() {
    if (!canCapture || !selectedPackage || !selectedGoal || !selectedRubric || !selectedEvent) return;
    setCaptureState("LOADING");
    setErrorMessage("");
    const body = {
      ...scope,
      course_package_ref: exactRef("course_package_version", selectedPackage.course_package_reference.course_package_id, selectedPackage.course_package_reference),
      learning_goal_ref: exactRef("learning_goal_version", selectedGoal.goal_id, selectedGoal),
      role_key: scope.role_key,
      rubric_ref: exactRef("rubric_version", selectedRubric.rubric_id, selectedRubric),
      source_event_id: selectedEvent.event_id
    };
    try {
      const response = await fetch(`${API_BASE}/api/v1/bff/teacher/evidence-artifacts/capture`, {
        body: JSON.stringify(body),
        headers: authHeaders(token, tenantId),
        method: "POST"
      });
      const data = await readEnvelope<D2CaptureReceipt>(response);
      setReceipt(data);
      setCaptureState(data.data.status === "generated" ? "GENERATED" : "REUSED");
      await loadEvidence();
    } catch (error) {
      setCaptureState(captureErrorState(error));
      setErrorMessage(error instanceof Error ? error.message : "Evidence capture failed");
    }
  }

  return (
    <section className="candidate-surface d2-evidence-workbench" aria-label="Teacher D2 Evidence Workbench">
      <div className="candidate-heading">
        <div>
          <p className="eyebrow">L1+ Program D · D2</p>
          <h2>Evidence &amp; Provenance Workbench</h2>
        </div>
        <span className="d2-status" role="status">{statusLabel(surfaceState)}</span>
      </div>
      <p className="evidence-note">
        Capture only eligible role/activity events into immutable teacher-only evidence. Exact
        package, goal and rubric references are required; raw event payloads never appear here.
      </p>

      <div className="d2-scope-grid">
        {(["course_id", "run_id", "team_id", "role_key", "activity_id"] as const).map((field) => (
          <label className="field-label" key={field}>
            <span>{field.replaceAll("_", " ")}</span>
            <input
              aria-label={`D2 ${field}`}
              value={scope[field]}
              onChange={(event) => updateScope(field, event.target.value)}
            />
          </label>
        ))}
      </div>

      <div className="d2-reference-grid">
        <label className="field-label">
          <span>Exact CoursePackageVersion</span>
          <select
            aria-label="D2 exact course package"
            value={selectedPackageKey}
            onChange={(event) => {
              setSelectedPackageKey(event.target.value);
              if (evidence) setSurfaceState("STALE");
            }}
          >
            <option value="">Select exact package</option>
            {packages.map((candidate) => (
              <option
                key={`${candidate.course_package_reference.course_package_id}:${candidate.course_package_reference.version}`}
                value={`${candidate.course_package_reference.course_package_id}:${candidate.course_package_reference.version}`}
              >
                {candidate.course_package_reference.course_package_id} / {candidate.course_package_reference.version}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          <span>Exact LearningGoalVersion</span>
          <select
            aria-label="D2 exact learning goal"
            value={selectedGoalKey}
            onChange={(event) => {
              setSelectedGoalKey(event.target.value);
              if (evidence) setSurfaceState("STALE");
            }}
          >
            <option value="">Select exact goal</option>
            {design.learning_goals.map((goal) => (
              <option key={`${goal.goal_id}:${goal.version}`} value={`${goal.goal_id}:${goal.version}`}>
                {goal.goal_id} / {goal.version} ({goal.status})
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          <span>Exact RubricVersion</span>
          <select
            aria-label="D2 exact rubric"
            value={selectedRubricKey}
            onChange={(event) => {
              setSelectedRubricKey(event.target.value);
              if (evidence) setSurfaceState("STALE");
            }}
          >
            <option value="">Select exact rubric</option>
            {design.rubrics.map((rubric) => (
              <option key={`${rubric.rubric_id}:${rubric.version}`} value={`${rubric.rubric_id}:${rubric.version}`}>
                {rubric.rubric_id} / {rubric.version} ({rubric.status})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="d2-actions">
        <button className="secondary" disabled={!scopeComplete || surfaceState === "LOADING"} onClick={() => void loadEvidence()}>
          Load eligible events
        </button>
        <button className="primary" disabled={!canCapture || captureState === "LOADING"} onClick={() => void captureEvidence()}>
          Generate Evidence
        </button>
        {referenceState === "LOADING" ? <span className="muted">Loading exact references...</span> : null}
        {referenceState === "ERROR" ? <span className="readiness-message">{errorMessage}</span> : null}
      </div>

      {surfaceState === "STALE" ? <p className="d2-state d2-state-stale" role="status">Scope or exact reference changed. Reload before capture.</p> : null}
      {surfaceState === "FORBIDDEN" ? <p className="d2-state d2-state-error" role="alert">This teacher scope is forbidden.</p> : null}
      {surfaceState === "ERROR" ? <p className="d2-state d2-state-error" role="alert">{errorMessage || "Evidence read failed."}</p> : null}
      {surfaceState === "EMPTY" ? <p className="d2-state" role="status">No eligible events or generated evidence in this exact scope.</p> : null}
      {captureState === "DUPLICATE" ? <p className="d2-state d2-state-warning" role="alert">Deterministic duplicate/conflict: no second authority record was created.</p> : null}
      {captureState === "FORBIDDEN" ? <p className="d2-state d2-state-error" role="alert">Evidence capture is forbidden for this actor or scope.</p> : null}
      {captureState === "ERROR" ? <p className="d2-state d2-state-error" role="alert">{errorMessage || "Evidence capture failed."}</p> : null}
      {captureState === "GENERATED" || captureState === "REUSED" ? (
        <article className="d2-receipt" aria-label="D2 evidence capture receipt">
          <strong>{captureState === "GENERATED" ? "Evidence generated" : "Existing evidence reused"}</strong>
          <span>formal_truth_write: false</span>
          {receipt ? <code>{artifactSummary(receipt.data.artifact)} / {receipt.data.artifact.artifact_digest}</code> : null}
        </article>
      ) : null}

      {evidence?.eligible_events.length ? (
        <label className="field-label d2-event-select">
          <span>Eligible source event</span>
          <select aria-label="D2 eligible source event" value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)}>
            <option value="">Select eligible event</option>
            {evidence.eligible_events.map((event) => (
              <option key={event.event_id} value={event.event_id}>
                {event.event_type} / {event.event_id} / {event.created_at}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {selectedEvent ? (
        <article className="d2-source-card">
          <span>Eligible source event</span>
          <strong>{selectedEvent.event_type} / {selectedEvent.event_id}</strong>
          <code>{refLabel(selectedEvent.source_event_ref)}</code>
          <small>Scope: {selectedEvent.scope.course_id} / {selectedEvent.scope.run_id} / {selectedEvent.scope.team_id} / {selectedEvent.scope.role_key}</small>
        </article>
      ) : null}

      {evidence?.artifacts.length ? (
        <div className="d2-artifact-list">
          {evidence.artifacts.map((artifact) => (
            <article className="d2-artifact-card" key={artifact.artifact_digest}>
              <div className="candidate-heading">
                <strong>{artifactSummary(artifact)}</strong>
                <span>{artifact.visibility}</span>
              </div>
              <code>digest: {artifact.artifact_digest}</code>
              <small>Source event: {refLabel(artifact.source_event_ref)}</small>
              <small>Goal: {refLabel(artifact.learning_goal_ref)}</small>
              <small>Rubric: {refLabel(artifact.rubric_ref)}</small>
              <small>Captured by: {artifact.captured_by} / {artifact.captured_at}</small>
              <details>
                <summary>Inspect provenance edges</summary>
                {(evidence.provenance_edges.filter((edge) => edge.target_ref.content_digest === artifact.artifact_digest)).map((edge) => (
                  <code key={`${edge.relation}-${edge.source_ref.content_digest}`} className="d2-edge">
                    {edge.relation}: {refLabel(edge.source_ref)}
                  </code>
                ))}
              </details>
            </article>
          ))}
        </div>
      ) : null}

      <div className="known-limits d2-known-limits">
        <strong>Known Limits</strong>
        <ul>
          {(evidence?.known_limits.length ? evidence.known_limits : [
            "JSON_INTERNAL_ONLY is the active runtime authority.",
            "D2 does not write Truth, SettlementResult, Score, Rank, or Replay authority.",
            "D2 evidence is teacher-only; Student evidence routes are not implemented.",
            "RoleWorkflowEvent has no native activity_id; activity scope is request-bounded."
          ]).map((limit) => <li key={limit}>{limit}</li>)}
        </ul>
      </div>
    </section>
  );
}
