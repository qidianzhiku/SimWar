import { useMemo, useState } from "react";
import type {
  CoursePackageVersionTeacherDto,
  D2EvidenceArtifactVersion,
  LearningDesignListDto,
  TeacherConfirmationCommandInput,
  TeacherConfirmationExactRef,
  TeacherConfirmationRejectInput,
  TeacherConfirmationVersion,
  TeacherConfirmationWorkClaim
} from "@simwar/shared-contracts";
import {
  claimTeacherConfirmationWork,
  confirmTeacherConfirmation,
  getTeacherConfirmationWorkClaim,
  loadTeacherConfirmationReferences,
  loadTeacherConfirmations,
  loadTeacherEvidence,
  releaseTeacherConfirmationWork,
  rejectTeacherConfirmation,
  reviseTeacherConfirmation,
  saveTeacherConfirmationDraft,
  type TeacherConfirmationError
} from "./teacher-confirmation-client";

type SurfaceState =
  | "LOADING"
  | "EMPTY"
  | "READY"
  | "CLAIMED"
  | "DRAFT"
  | "CONFIRMED"
  | "REJECTED"
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
  if (failure.code === "D3_WORK_CLAIM_CONFLICT" || failure.code === "D3_WORK_CLAIM_EXPIRED")
    return "STALE";
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

function confirmationKey(confirmation: TeacherConfirmationVersion): string {
  return `${confirmation.confirmation_ref.resource_id}:${confirmation.confirmation_ref.version}`;
}

function mergeConfirmation(
  current: readonly TeacherConfirmationVersion[],
  next: TeacherConfirmationVersion
): readonly TeacherConfirmationVersion[] {
  return [...current.filter((item) => confirmationKey(item) !== confirmationKey(next)), next].sort(
    (left, right) =>
      left.confirmation_ref.resource_id.localeCompare(right.confirmation_ref.resource_id) ||
      left.confirmation_ref.version.localeCompare(right.confirmation_ref.version)
  );
}

async function evidenceSetDigest(artifacts: readonly D2EvidenceArtifactVersion[]): Promise<string> {
  const refs = artifacts
    .map((artifact) => artifact.artifact_ref)
    .map((ref) => ({
      content_digest: ref.content_digest,
      resource_id: ref.resource_id,
      resource_type: ref.resource_type,
      tenant_id: ref.tenant_id,
      version: ref.version
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const bytes = new TextEncoder().encode(JSON.stringify(refs));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export type TeacherConfirmationWorkbenchProps = { tenantId: string; token: string };

export function TeacherConfirmationWorkbench({
  tenantId,
  token
}: TeacherConfirmationWorkbenchProps) {
  const [state, setState] = useState<SurfaceState>("EMPTY");
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
  const [claim, setClaim] = useState<TeacherConfirmationWorkClaim | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const selectedPackageData = packages.find(
    (item) =>
      `${item.course_package_reference.course_package_id}:${item.course_package_reference.version}:${item.course_package_reference.content_digest}` ===
      selectedPackage
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
    levelOrdinal &&
    claim?.status === "CLAIMED"
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
      setClaim(null);
      setSelectedEvidence("");
      setState(result.artifacts.length ? "READY" : "EMPTY");
    } catch (error) {
      setState(errorState(error));
      setErrorMessage(error instanceof Error ? error.message : "Evidence references failed");
    }
  }

  function updateScope(field: keyof Scope, value: string) {
    setScope((current) => ({ ...current, [field]: value }));
    setClaim(null);
    setSelectedEvidence("");
    setState("STALE");
  }

  function buildInput(): TeacherConfirmationCommandInput | null {
    if (
      !formReady ||
      !selectedPackageData ||
      !selectedGoalData ||
      !selectedRubricData ||
      !selectedEvidenceData ||
      claim?.status !== "CLAIMED"
    )
      return null;
    return {
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
      claim_id: claim.claim_id,
      context: {
        course_id: scope.course_id,
        run_id: scope.run_id,
        team_id: scope.team_id,
        role_key: scope.role_key
      },
      criterion_decisions: [{ criterion_id: criterionId, level_ordinal: Number(levelOrdinal) }],
      teacher_feedback: feedback,
      idempotency_key: idempotencyKey
    };
  }

  async function claimWork() {
    if (!scopeReady || !selectedEvidenceData) return;
    setState("LOADING");
    setErrorMessage("");
    try {
      const digest = await evidenceSetDigest([selectedEvidenceData]);
      const result = await claimTeacherConfirmationWork(
        {
          course_id: scope.course_id,
          run_id: scope.run_id,
          team_id: scope.team_id,
          role_key: scope.role_key
        },
        digest,
        token,
        tenantId
      );
      setClaim(result.claim);
      setState("CLAIMED");
    } catch (error) {
      setState(errorState(error));
      setErrorMessage(error instanceof Error ? error.message : "Work claim failed");
    }
  }

  async function releaseWork() {
    if (!claim) return;
    setState("LOADING");
    try {
      const result = await releaseTeacherConfirmationWork(claim.claim_id, token, tenantId);
      setClaim(result.claim);
      setState("READY");
    } catch (error) {
      setState(errorState(error));
      setErrorMessage(error instanceof Error ? error.message : "Work claim release failed");
    }
  }

  async function saveDraft() {
    const input = buildInput();
    if (!input) return;
    setState("LOADING");
    setErrorMessage("");
    try {
      const result = await saveTeacherConfirmationDraft(input, token, tenantId);
      setReceipt(result.data.confirmation);
      setState(result.data.status === "reused" ? "DUPLICATE" : "DRAFT");
      setConfirmations((current) => mergeConfirmation(current, result.data.confirmation));
    } catch (error) {
      setState(errorState(error));
      setErrorMessage(error instanceof Error ? error.message : "Draft save failed");
    }
  }

  async function confirmDraft() {
    if (!receipt || !claim || claim.status !== "CLAIMED") return;
    setState("LOADING");
    try {
      const result = await confirmTeacherConfirmation(
        receipt.confirmation_ref.resource_id,
        claim?.claim_id ?? "",
        token,
        tenantId
      );
      setReceipt(result.data.confirmation);
      setConfirmations((current) => mergeConfirmation(current, result.data.confirmation));
      setState("CONFIRMED");
    } catch (error) {
      setState(errorState(error));
      setErrorMessage(error instanceof Error ? error.message : "Confirmation failed");
    }
  }

  async function rejectDraft() {
    if (
      !receipt ||
      !claim ||
      claim.status !== "CLAIMED" ||
      receipt.status !== "DRAFT" ||
      rejectionReason.trim().length === 0
    )
      return;
    const input: TeacherConfirmationRejectInput = {
      claim_id: claim.claim_id,
      rejection_reason: rejectionReason
    };
    setState("LOADING");
    try {
      const result = await rejectTeacherConfirmation(
        receipt.confirmation_ref.resource_id,
        claim?.claim_id ?? "",
        input,
        token,
        tenantId
      );
      setReceipt(result.data.confirmation);
      setConfirmations((current) => mergeConfirmation(current, result.data.confirmation));
      setState("REJECTED");
    } catch (error) {
      setState(errorState(error));
      setErrorMessage(error instanceof Error ? error.message : "Rejection failed");
    }
  }

  async function reviseRecord() {
    if (!receipt || (receipt.status !== "CONFIRMED" && receipt.status !== "REJECTED")) return;
    const input = buildInput();
    if (!input) return;
    setState("LOADING");
    try {
      const result = await reviseTeacherConfirmation(
        receipt.confirmation_ref.resource_id,
        input,
        token,
        tenantId
      );
      setReceipt(result.data.confirmation);
      setConfirmations((current) => mergeConfirmation(current, result.data.confirmation));
      setState("DRAFT");
    } catch (error) {
      setState(errorState(error));
      setErrorMessage(error instanceof Error ? error.message : "Revision failed");
    }
  }

  async function refreshClaim() {
    if (!claim) return;
    setState("LOADING");
    setErrorMessage("");
    try {
      const result = await getTeacherConfirmationWorkClaim(claim.claim_id, token, tenantId);
      setClaim(result.claim);
      setState(result.claim.status === "CLAIMED" ? "CLAIMED" : "STALE");
      if (result.claim.status === "EXPIRED") setErrorMessage("Work claim expired; claim it again.");
    } catch (error) {
      setState(errorState(error));
      setErrorMessage(error instanceof Error ? error.message : "Work claim status failed");
    }
  }

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
                key={`${item.course_package_reference.course_package_id}:${item.course_package_reference.version}:${item.course_package_reference.content_digest}`}
                value={`${item.course_package_reference.course_package_id}:${item.course_package_reference.version}:${item.course_package_reference.content_digest}`}
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
        <label className="field-label d3-feedback">
          <span>Bounded rejection reason</span>
          <textarea
            aria-label="D3 rejection reason"
            value={rejectionReason}
            maxLength={500}
            onChange={(event) => setRejectionReason(event.target.value)}
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
          className="secondary"
          onClick={() => void claimWork()}
          disabled={
            state === "LOADING" ||
            !scopeReady ||
            evidence.length === 0 ||
            !selectedEvidenceData ||
            claim?.status === "CLAIMED"
          }
        >
          Claim work item
        </button>
        <button
          className="secondary"
          onClick={() => void releaseWork()}
          disabled={state === "LOADING" || claim?.status !== "CLAIMED"}
        >
          Release work claim
        </button>
        <button
          className="secondary"
          onClick={() => void refreshClaim()}
          disabled={state === "LOADING" || !claim}
        >
          Check work claim
        </button>
        <button
          className="primary"
          onClick={() => void saveDraft()}
          disabled={state === "LOADING" || !formReady || claim?.status !== "CLAIMED"}
        >
          Save immutable draft
        </button>
        <button
          className="secondary"
          onClick={() => void confirmDraft()}
          disabled={
            state === "LOADING" ||
            !receipt ||
            receipt.status !== "DRAFT" ||
            claim?.status !== "CLAIMED"
          }
        >
          Confirm version
        </button>
        <button
          className="secondary"
          onClick={() => void rejectDraft()}
          disabled={
            state === "LOADING" ||
            receipt?.status !== "DRAFT" ||
            rejectionReason.trim().length === 0 ||
            claim?.status !== "CLAIMED"
          }
        >
          Reject version
        </button>
        <button
          className="secondary"
          onClick={() => void reviseRecord()}
          disabled={
            state === "LOADING" ||
            !receipt ||
            (receipt.status !== "CONFIRMED" && receipt.status !== "REJECTED") ||
            !formReady ||
            claim?.status !== "CLAIMED"
          }
        >
          Revise as new draft
        </button>
      </div>

      {claim ? (
        <article className="d2-receipt" aria-label="D3 work claim receipt">
          <strong>Work claim: {claim.status}</strong>
          <code>
            {claim.claim_id} / {claim.evidence_set_digest}
          </code>
          <small>
            expires_at: {claim.expires_at} · claimed_by: {claim.claimed_by}
          </small>
        </article>
      ) : null}

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
      {state === "CLAIMED" ? (
        <p className="d2-state" role="status">
          Work item claimed. A draft can be saved only for this exact scoped evidence set.
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
      {state === "DRAFT" && receipt ? (
        <p className="d2-state" role="status">
          Draft saved. Confirm or reject it explicitly; no final assessment was created.
        </p>
      ) : null}
      {state === "CONFIRMED" && receipt ? (
        <p className="d2-state" role="status">
          Confirmed version appended. The previous version remains immutable.
        </p>
      ) : null}
      {state === "REJECTED" && receipt ? (
        <p className="d2-state d2-state-warning" role="status">
          Rejected version appended. Revise creates a new draft version.
        </p>
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
                    rejection_reason: item.rejection_reason ?? null,
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
