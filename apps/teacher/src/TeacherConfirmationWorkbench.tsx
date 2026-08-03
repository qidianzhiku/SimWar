import { useEffect, useMemo, useState } from "react";
import type {
  CoursePackageVersionTeacherDto,
  D2EvidenceArtifactVersion,
  LearningDesignListDto,
  TeacherConfirmationCommandInput,
  TeacherConfirmationExactRef,
  TeacherConfirmationVersion
} from "@simwar/shared-contracts";
import {
  confirmTeacherConfirmation,
  loadTeacherConfirmationReferences,
  loadTeacherConfirmations,
  loadTeacherEvidence,
  saveTeacherConfirmationDraft,
  type TeacherConfirmationError
} from "./teacher-confirmation-client";

type SurfaceState =
  | "LOADING"
  | "EMPTY"
  | "READY"
  | "GENERATED"
  | "DUPLICATE"
  | "FORBIDDEN"
  | "STALE"
  | "ERROR";
type Scope = {
  course_id: string;
  run_id: string;
  team_id: string;
  role_key: string;
  activity_id: string;
};
type RefFields = { resource_id: string; version: string; content_digest: string };

const EMPTY_DESIGN: LearningDesignListDto = {
  explicit_non_proofs: [],
  learning_goals: [],
  rubrics: [],
  runtime_authority: "JSON_INTERNAL_ONLY"
};

const EMPTY_SCOPE: Scope = {
  activity_id: "",
  course_id: "",
  role_key: "",
  run_id: "",
  team_id: ""
};

function exactRef(
  resource_type: TeacherConfirmationExactRef["resource_type"],
  fields: RefFields,
  tenant_id: string
): TeacherConfirmationExactRef {
  return { ...fields, discriminator: "exact_ref", resource_type, tenant_id };
}

function errorState(error: unknown): SurfaceState {
  const failure = error as TeacherConfirmationError;
  if (failure.status === 403 || failure.code === "D3_FORBIDDEN") return "FORBIDDEN";
  if (failure.status === 409 || failure.code === "D3_DUPLICATE_CONFLICT") return "DUPLICATE";
  return "ERROR";
}

function refLabel(ref: { resource_id: string; version: string; content_digest: string }): string {
  return `${ref.resource_id} / ${ref.version} / ${ref.content_digest}`;
}

function artifactRef(artifact: D2EvidenceArtifactVersion): RefFields {
  return {
    content_digest: artifact.artifact_ref.content_digest,
    resource_id: artifact.artifact_ref.resource_id,
    version: artifact.artifact_ref.version
  };
}

function packageRef(candidate: CoursePackageVersionTeacherDto): RefFields {
  return {
    content_digest: candidate.course_package_reference.content_digest,
    resource_id: candidate.course_package_reference.course_package_id,
    version: candidate.course_package_reference.version
  };
}

export type TeacherConfirmationWorkbenchProps = { tenantId: string; token: string };

export function TeacherConfirmationWorkbench({
  tenantId,
  token
}: TeacherConfirmationWorkbenchProps) {
  const [state, setState] = useState<SurfaceState>("LOADING");
  const [scope, setScope] = useState<Scope>(EMPTY_SCOPE);
  const [packages, setPackages] = useState<readonly CoursePackageVersionTeacherDto[]>([]);
  const [design, setDesign] = useState<LearningDesignListDto>(EMPTY_DESIGN);
  const [evidence, setEvidence] = useState<readonly D2EvidenceArtifactVersion[]>([]);
  const [confirmations, setConfirmations] = useState<readonly TeacherConfirmationVersion[]>([]);
  const [selectedPackage, setSelectedPackage] = useState("");
  const [selectedGoal, setSelectedGoal] = useState("");
  const [selectedRubric, setSelectedRubric] = useState("");
  const [selectedEvidence, setSelectedEvidence] = useState("");
  const [confirmationId, setConfirmationId] = useState("teacher-confirmation-001");
  const [idempotencyKey, setIdempotencyKey] = useState("teacher-confirmation-request-001");
  const [criterionId, setCriterionId] = useState("");
  const [levelOrdinal, setLevelOrdinal] = useState("1");
  const [feedback, setFeedback] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [receipt, setReceipt] = useState<TeacherConfirmationVersion | null>(null);

  const selectedPackageData = packages.find(
    (item) => item.course_package_reference.course_package_id === selectedPackage
  );
  const selectedGoalData = design.learning_goals.find(
    (item) => `${item.goal_id}:${item.version}` === selectedGoal
  );
  const selectedRubricData = design.rubrics.find(
    (item) => `${item.rubric_id}:${item.version}` === selectedRubric
  );
  const selectedEvidenceData = evidence.find(
    (item) => refLabel(item.artifact_ref) === selectedEvidence
  );
  const selectedRubricCriterion = useMemo(
    () => selectedRubricData?.criteria.find((criterion) => criterion.criterion_id === criterionId),
    [criterionId, selectedRubricData]
  );
  const scopeReady = Object.values(scope).every((value) => value.trim().length > 0);
  const formReady = Boolean(
    selectedPackageData &&
    selectedGoalData &&
    selectedRubricData &&
    selectedEvidenceData &&
    criterionId &&
    levelOrdinal
  );

  async function loadReferences() {
    setState("LOADING");
    setErrorMessage("");
    try {
      const [referenceData, confirmationData] = await Promise.all([
        loadTeacherConfirmationReferences(token, tenantId),
        loadTeacherConfirmations(token, tenantId)
      ]);
      setPackages(referenceData.packages);
      setDesign(referenceData.design);
      setConfirmations(confirmationData.confirmations);
      setState(confirmationData.confirmations.length ? "READY" : "EMPTY");
    } catch (error) {
      setState(errorState(error));
      setErrorMessage(
        error instanceof Error ? error.message : "Teacher confirmation references failed"
      );
    }
  }

  async function loadEvidenceArtifacts() {
    if (!scopeReady) {
      setErrorMessage("Complete course, run, team, role and activity before loading evidence.");
      setState("ERROR");
      return;
    }
    setState("LOADING");
    try {
      const result = await loadTeacherEvidence(token, tenantId, scope);
      setEvidence(result.artifacts);
      setState(result.artifacts.length ? "READY" : "EMPTY");
    } catch (error) {
      setState(errorState(error));
      setErrorMessage(error instanceof Error ? error.message : "Evidence references failed");
    }
  }

  function updateScope(field: keyof Scope, value: string) {
    setScope((current) => ({ ...current, [field]: value }));
    setState("STALE");
  }

  async function saveDraft() {
    if (
      !formReady ||
      !selectedPackageData ||
      !selectedGoalData ||
      !selectedRubricData ||
      !selectedEvidenceData
    )
      return;
    setState("LOADING");
    setErrorMessage("");
    const input: TeacherConfirmationCommandInput = {
      confirmation_id: confirmationId,
      course_package_ref: exactRef(
        "course_package_version",
        packageRef(selectedPackageData),
        tenantId
      ),
      learning_goal_ref: exactRef(
        "learning_goal_version",
        {
          content_digest: selectedGoalData.content_digest,
          resource_id: selectedGoalData.goal_id,
          version: selectedGoalData.version
        },
        tenantId
      ),
      rubric_ref: exactRef(
        "rubric_version",
        {
          content_digest: selectedRubricData.content_digest,
          resource_id: selectedRubricData.rubric_id,
          version: selectedRubricData.version
        },
        tenantId
      ),
      evidence_refs: [exactRef("evidence_artifact", artifactRef(selectedEvidenceData), tenantId)],
      context: { ...scope },
      criterion_decisions: [{ criterion_id: criterionId, level_ordinal: Number(levelOrdinal) }],
      teacher_feedback: feedback,
      idempotency_key: idempotencyKey
    };
    try {
      const result = await saveTeacherConfirmationDraft(input, token, tenantId);
      setReceipt(result.data.confirmation);
      setState(result.data.status === "reused" ? "DUPLICATE" : "GENERATED");
      setConfirmations((current) => [
        ...current.filter(
          (item) =>
            item.confirmation_ref.resource_id !==
            result.data.confirmation.confirmation_ref.resource_id
        ),
        result.data.confirmation
      ]);
    } catch (error) {
      setState(errorState(error));
      setErrorMessage(error instanceof Error ? error.message : "Draft save failed");
    }
  }

  async function confirmDraft() {
    if (!receipt) return;
    setState("LOADING");
    try {
      const result = await confirmTeacherConfirmation(
        receipt.confirmation_ref.resource_id,
        token,
        tenantId
      );
      setReceipt(result.data.confirmation);
      setState("GENERATED");
    } catch (error) {
      setState(errorState(error));
      setErrorMessage(error instanceof Error ? error.message : "Confirmation failed");
    }
  }

  useEffect(() => {
    void loadReferences();
  }, [tenantId, token]);

  return (
    <section
      className="candidate-surface d3-confirmation-workbench"
      aria-label="Teacher D3 Confirmation Workbench"
    >
      <div className="candidate-heading">
        <div>
          <p className="eyebrow">L1+ Program D · D3</p>
          <h2>Teacher Confirmation Workbench</h2>
        </div>
        <span className="d2-status" role="status">
          {state}
        </span>
      </div>
      <p className="evidence-note">
        Confirm teacher-only evidence against explicit CoursePackage, LearningGoal, Rubric and
        EvidenceArtifact exact references. This does not grade students or write formal truth.
      </p>

      <div className="d3-scope-grid">
        {(["course_id", "run_id", "team_id", "role_key", "activity_id"] as const).map((field) => (
          <label className="field-label" key={field}>
            <span>{field.replaceAll("_", " ")}</span>
            <input
              aria-label={`D3 ${field}`}
              value={scope[field]}
              onChange={(event) => updateScope(field, event.target.value)}
            />
          </label>
        ))}
        <label className="field-label">
          <span>confirmation id</span>
          <input
            aria-label="D3 confirmation id"
            value={confirmationId}
            onChange={(event) => setConfirmationId(event.target.value)}
          />
        </label>
        <label className="field-label">
          <span>idempotency key</span>
          <input
            aria-label="D3 idempotency key"
            value={idempotencyKey}
            onChange={(event) => setIdempotencyKey(event.target.value)}
          />
        </label>
      </div>

      <div className="d3-reference-grid">
        <label className="field-label">
          <span>Exact CoursePackageVersion</span>
          <select
            aria-label="D3 exact course package"
            value={selectedPackage}
            onChange={(event) => {
              setSelectedPackage(event.target.value);
              setState("STALE");
            }}
          >
            <option value="">Select exact package</option>
            {packages.map((item) => (
              <option
                key={`${item.course_package_reference.course_package_id}:${item.course_package_reference.version}`}
                value={item.course_package_reference.course_package_id}
              >
                {item.course_package_reference.course_package_id} /{" "}
                {item.course_package_reference.version} /{" "}
                {item.course_package_reference.content_digest}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          <span>Exact LearningGoalVersion</span>
          <select
            aria-label="D3 exact learning goal"
            value={selectedGoal}
            onChange={(event) => {
              setSelectedGoal(event.target.value);
              setState("STALE");
            }}
          >
            <option value="">Select exact goal</option>
            {design.learning_goals.map((item) => (
              <option
                key={`${item.goal_id}:${item.version}`}
                value={`${item.goal_id}:${item.version}`}
              >
                {item.goal_id} / {item.version} / {item.content_digest}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          <span>Exact RubricVersion</span>
          <select
            aria-label="D3 exact rubric"
            value={selectedRubric}
            onChange={(event) => {
              setSelectedRubric(event.target.value);
              setState("STALE");
            }}
          >
            <option value="">Select exact rubric</option>
            {design.rubrics.map((item) => (
              <option
                key={`${item.rubric_id}:${item.version}`}
                value={`${item.rubric_id}:${item.version}`}
              >
                {item.rubric_id} / {item.version} / {item.content_digest}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          <span>EvidenceArtifact exact ref</span>
          <select
            aria-label="D3 exact evidence"
            value={selectedEvidence}
            onChange={(event) => {
              setSelectedEvidence(event.target.value);
              setState("STALE");
            }}
          >
            <option value="">Load scoped evidence first</option>
            {evidence.map((item) => (
              <option key={refLabel(item.artifact_ref)} value={refLabel(item.artifact_ref)}>
                {refLabel(item.artifact_ref)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="d3-decision-grid">
        <label className="field-label">
          <span>Rubric criterion</span>
          <select
            aria-label="D3 rubric criterion"
            value={criterionId}
            onChange={(event) => setCriterionId(event.target.value)}
          >
            <option value="">Select criterion</option>
            {selectedRubricData?.criteria.map((criterion) => (
              <option key={criterion.criterion_id} value={criterion.criterion_id}>
                {criterion.criterion_id}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          <span>Level</span>
          <select
            aria-label="D3 rubric level"
            value={levelOrdinal}
            onChange={(event) => setLevelOrdinal(event.target.value)}
          >
            <option value="">Select level</option>
            {selectedRubricCriterion?.levels.map((level) => (
              <option key={level.ordinal} value={String(level.ordinal)}>
                {level.ordinal} / {level.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label d3-feedback">
          <span>Teacher feedback</span>
          <textarea
            aria-label="D3 teacher feedback"
            value={feedback}
            maxLength={2000}
            onChange={(event) => setFeedback(event.target.value)}
          />
        </label>
      </div>

      <div className="d2-actions">
        <button
          className="secondary"
          onClick={() => void loadReferences()}
          disabled={state === "LOADING"}
        >
          Refresh exact references
        </button>
        <button
          className="secondary"
          onClick={() => void loadEvidenceArtifacts()}
          disabled={state === "LOADING" || !scopeReady}
        >
          Load scoped evidence
        </button>
        <button
          className="primary"
          onClick={() => void saveDraft()}
          disabled={state === "LOADING" || !formReady}
        >
          Save immutable draft
        </button>
        <button
          className="secondary"
          onClick={() => void confirmDraft()}
          disabled={state === "LOADING" || !receipt || receipt.status !== "DRAFT"}
        >
          Confirm version
        </button>
      </div>

      {state === "EMPTY" ? (
        <p className="d2-state" role="status">
          No teacher confirmations or scoped EvidenceArtifact versions are available yet.
        </p>
      ) : null}
      {state === "STALE" ? (
        <p className="d2-state d2-state-stale" role="status">
          Selection changed. Reload scoped evidence before saving.
        </p>
      ) : null}
      {state === "FORBIDDEN" ? (
        <p className="d2-state d2-state-error" role="alert">
          Teacher confirmation is forbidden for this actor or tenant scope.
        </p>
      ) : null}
      {state === "DUPLICATE" ? (
        <p className="d2-state d2-state-warning" role="alert">
          Existing deterministic draft reused; no second authority record was created.
        </p>
      ) : null}
      {state === "ERROR" ? (
        <p className="d2-state d2-state-error" role="alert">
          {errorMessage || "Teacher confirmation request failed."}
        </p>
      ) : null}
      {state === "GENERATED" && receipt ? (
        <article className="d2-receipt" aria-label="D3 confirmation receipt">
          <strong>
            {receipt.status === "CONFIRMED"
              ? "Teacher confirmation confirmed"
              : "Immutable teacher draft saved"}
          </strong>
          <span>
            formal_truth_write: false · runtime_authority:{" "}
            {receipt.audit_receipt.action === "teacher_confirmation.confirm"
              ? "JSON_INTERNAL_ONLY"
              : "JSON_INTERNAL_ONLY"}
          </span>
          <code>
            {refLabel(receipt.confirmation_ref)} / {receipt.content_digest}
          </code>
          <small>{receipt.known_limits.join(" ")}</small>
        </article>
      ) : null}

      {confirmations.length ? (
        <div className="d3-confirmation-list">
          <h3>Teacher-safe confirmation history</h3>
          {confirmations.map((item) => (
            <article
              className="d2-artifact-card"
              key={`${item.confirmation_ref.resource_id}:${item.confirmation_ref.version}`}
            >
              <strong>
                {item.status} · {item.confirmation_ref.resource_id} /{" "}
                {item.confirmation_ref.version}
              </strong>
              <code>{item.content_digest}</code>
              <span>
                {item.course_package_ref.resource_type} · {item.learning_goal_ref.resource_id} ·{" "}
                {item.rubric_ref.resource_id}
              </span>
              <details>
                <summary>Provenance and exact refs</summary>
                <code>
                  {JSON.stringify({
                    confirmation_ref: item.confirmation_ref,
                    evidence_refs: item.evidence_refs,
                    supersedes_ref: item.supersedes_ref ?? null
                  })}
                </code>
              </details>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
