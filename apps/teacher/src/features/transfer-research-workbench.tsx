import { useEffect, useMemo, useState } from "react";
import type {
  TransferResearchDesignBundle,
  TransferResearchDesignInput,
  TransferResearchDesignListDto
} from "@simwar/shared-contracts";
import {
  freezeTransferResearchDesign,
  loadTransferResearchDesigns,
  previewTransferResearchDesign
} from "./transfer-research-client";

const digest = (char: string) => char.repeat(64);
type D6FormValues = {
  courseId: string;
  courseDigest: string;
  d4Id: string;
  d4Digest: string;
  d5Id: string;
  d5Digest: string;
  goalId: string;
  goalDigest: string;
  rubricId: string;
  rubricDigest: string;
  title: string;
};
const exact = (
  resource_id: string,
  resource_type: string,
  content_digest: string,
  tenant_id: string
) => ({
  content_digest,
  discriminator: "exact_ref" as const,
  resource_id,
  resource_type,
  tenant_id,
  version: "1.0.0"
});

function input(tenantId: string, values: D6FormValues): TransferResearchDesignInput {
  return {
    analysis_plan_ref: exact(
      "plan_d6_teacher",
      "transfer_analysis_plan_version",
      digest("1"),
      tenantId
    ),
    course_package_ref: exact(
      values.courseId,
      "course_package_version",
      values.courseDigest,
      tenantId
    ),
    d4_source_ref: exact(values.d4Id, "student_learning_report", values.d4Digest, tenantId),
    d5_source_ref: exact(values.d5Id, "learning_export_bundle_version", values.d5Digest, tenantId),
    instrument: {
      items: [
        {
          item_id: "opportunity_context",
          prompt: "Describe the work opportunity without private raw payload.",
          response_type: "TEXT"
        }
      ],
      source_type: "LEARNER_SELF_REPORT"
    },
    learning_goal_ref: exact(values.goalId, "learning_goal_version", values.goalDigest, tenantId),
    observation_windows: [
      { code: "W0_BASELINE", offset_days: 0, tolerance_days: 7 },
      { code: "W2_30D", offset_days: 30, tolerance_days: 7 }
    ],
    outcome_measures: [
      {
        code: "APPLICATION_STATE",
        allowed_states: [
          "NOT_ASSESSED",
          "OPPORTUNITY_NOT_AVAILABLE",
          "ATTEMPTED_APPLICATION",
          "OBSERVED_APPLICATION",
          "INSUFFICIENT_EVIDENCE"
        ],
        missing_is_not_negative: true,
        role: "PRIMARY"
      }
    ],
    provenance_source_policy: {
      allowed_source_types: ["LEARNER_SELF_REPORT", "SUPERVISOR_OBSERVATION"],
      minimum_source_types: 2,
      required_provenance_complete: true,
      small_cohort_minimum: 5,
      retention_days: 90,
      deletion_mode: "DELETE_ON_EXPIRY"
    },
    rubric_ref: exact(values.rubricId, "rubric_version", values.rubricDigest, tenantId),
    title: values.title
  };
}

const initial = (_tenantId: string): D6FormValues => ({
  courseId: "course_package_exact",
  courseDigest: digest("2"),
  d4Id: "d4_report_exact",
  d4Digest: digest("3"),
  d5Id: "d5_bundle_exact",
  d5Digest: digest("4"),
  goalId: "goal_exact",
  goalDigest: digest("5"),
  rubricId: "rubric_exact",
  rubricDigest: digest("6"),
  title: "Synthetic transfer research design"
});

export function TransferResearchWorkbench({
  apiBase,
  tenantId,
  token,
  surface
}: {
  apiBase: string;
  tenantId: string;
  token: string;
  surface: "teacher" | "admin";
}) {
  const [values, setValues] = useState(() => initial(tenantId));
  const [phase, setPhase] = useState<"LOADING" | "EMPTY" | "READY" | "ERROR">("LOADING");
  const [list, setList] = useState<TransferResearchDesignListDto | null>(null);
  const [result, setResult] = useState<TransferResearchDesignBundle | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const currentInput = useMemo(() => input(tenantId, values), [tenantId, values]);

  useEffect(() => {
    const controller = new AbortController();
    setPhase("LOADING");
    void loadTransferResearchDesigns(apiBase, token, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        setList(next);
        setPhase(next.studies.length ? "READY" : "EMPTY");
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "D6 list failed");
        setPhase("ERROR");
      });
    return () => controller.abort();
  }, [apiBase, token, tenantId]);

  const run = async (action: () => Promise<TransferResearchDesignBundle>) => {
    setBusy(true);
    setError("");
    try {
      setResult(await action());
      setPhase("READY");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "D6 operation failed");
      setPhase("ERROR");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="candidate-surface d6-transfer-workbench"
      aria-label={`${surface} D6 transfer research design workbench`}
    >
      <div className="panel-title">
        <div>
          <p className="eyebrow">L1+ Program D · D6</p>
          <h2>Transfer Research Design</h2>
        </div>
        <span>synthetic-only</span>
      </div>
      <p className="d6-boundary">
        Exact D1-D5 references, descriptive evidence design, and provenance preview. Real
        participant data, causal claims, HR outputs, Score, Rank, Settlement, Truth, and Student
        routes are unavailable.
      </p>
      {phase === "LOADING" ? <p aria-live="polite">Loading frozen research designs...</p> : null}
      {phase === "EMPTY" ? (
        <p className="d6-empty">No frozen D6 design exists yet. Create a synthetic preview.</p>
      ) : null}
      {phase === "ERROR" ? (
        <p className="d6-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="d6-form-grid">
        {(["courseId", "d4Id", "d5Id", "goalId", "rubricId"] as const).map((field) => (
          <label key={field}>
            {field}
            <input
              value={values[field]}
              onChange={(event) =>
                setValues((current) => ({ ...current, [field]: event.target.value }))
              }
            />
          </label>
        ))}
        <label>
          Title
          <input
            value={values.title}
            onChange={(event) =>
              setValues((current) => ({ ...current, title: event.target.value }))
            }
          />
        </label>
      </div>
      <div className="d6-actions">
        <button
          disabled={busy}
          onClick={() =>
            void run(() => previewTransferResearchDesign(apiBase, token, currentInput))
          }
        >
          Preview
        </button>
        <button
          className="primary"
          disabled={busy}
          onClick={() => void run(() => freezeTransferResearchDesign(apiBase, token, currentInput))}
        >
          Freeze synthetic design
        </button>
      </div>
      {result ? (
        <div className="d6-receipt" aria-live="polite">
          <strong>{result.study.lifecycle === "FROZEN" ? "Frozen" : "Preview ready"}</strong>
          <span>
            Study exact ref: {result.study.study_ref.resource_id}@{result.study.study_ref.version}
          </span>
          <code>{result.study.content_digest}</code>
          <span>Receipt: {result.receipt.status} · formal_transfer_claim_write=false</span>
          <span>
            Candidate: {result.synthetic_preview.runtime_status} ·{" "}
            {result.synthetic_preview.transfer_state}
          </span>
        </div>
      ) : null}
      {list?.studies.map((study) => (
        <div className="d6-study" key={study.study_ref.content_digest}>
          <strong>{study.title}</strong>
          <span>{study.lifecycle}</span>
          <code>
            {study.study_ref.resource_id}@{study.study_ref.version}
          </code>
        </div>
      ))}
      <p className="d6-limits">
        Known Limits: synthetic-only · causal disabled · JSON_INTERNAL_ONLY · Human Validation not
        performed · Issue #111 open
      </p>
    </section>
  );
}
