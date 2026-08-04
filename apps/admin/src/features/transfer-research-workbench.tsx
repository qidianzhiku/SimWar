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
const refDigest = (char: string) => char.repeat(64);
function designInput(tenantId: string, title: string): TransferResearchDesignInput {
  return {
    analysis_plan_ref: exact(
      "plan_d6_admin",
      "transfer_analysis_plan_version",
      refDigest("1"),
      tenantId
    ),
    course_package_ref: exact(
      "course_package_exact",
      "course_package_version",
      refDigest("2"),
      tenantId
    ),
    d4_source_ref: exact("d4_report_exact", "student_learning_report", refDigest("3"), tenantId),
    d5_source_ref: exact(
      "d5_bundle_exact",
      "learning_export_bundle_version",
      refDigest("4"),
      tenantId
    ),
    instrument: {
      items: [
        {
          item_id: "opportunity_context",
          prompt: "Describe the work opportunity without private raw payload.",
          response_type: "TEXT"
        }
      ],
      source_type: "SUPERVISOR_OBSERVATION"
    },
    learning_goal_ref: exact("goal_exact", "learning_goal_version", refDigest("5"), tenantId),
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
    rubric_ref: exact("rubric_exact", "rubric_version", refDigest("6"), tenantId),
    title
  };
}

export function TransferResearchWorkbench({
  apiBase,
  tenantId,
  token,
  surface
}: {
  apiBase: string;
  tenantId: string;
  token: string;
  surface: "admin";
}) {
  const [title, setTitle] = useState("Synthetic transfer governance design");
  const [phase, setPhase] = useState<"LOADING" | "EMPTY" | "READY" | "ERROR">("LOADING");
  const [list, setList] = useState<TransferResearchDesignListDto | null>(null);
  const [result, setResult] = useState<TransferResearchDesignBundle | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const currentInput = useMemo(() => designInput(tenantId, title), [tenantId, title]);

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
          <h2>Transfer Research Governance</h2>
        </div>
        <span>synthetic-only</span>
      </div>
      <p className="d6-boundary">
        Admin sees exact design metadata and synthetic previews only. Real records, causal claims,
        HR/talent outputs, Truth, Score, Rank, Settlement, and Student evidence are unavailable.
      </p>
      {phase === "LOADING" ? <p aria-live="polite">Loading frozen research designs...</p> : null}
      {phase === "EMPTY" ? <p className="d6-empty">No frozen D6 design exists yet.</p> : null}
      {phase === "ERROR" ? (
        <p className="d6-error" role="alert">
          {error}
        </p>
      ) : null}
      <label>
        Design title
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <div className="d6-actions">
        <button
          disabled={busy}
          onClick={() =>
            void run(() => previewTransferResearchDesign(apiBase, token, currentInput))
          }
        >
          Preview synthetic
        </button>
        <button
          className="primary"
          disabled={busy}
          onClick={() => void run(() => freezeTransferResearchDesign(apiBase, token, currentInput))}
        >
          Freeze design
        </button>
      </div>
      {result ? (
        <div className="d6-receipt" aria-live="polite">
          <strong>{result.study.lifecycle}</strong>
          <span>
            {result.study.study_ref.resource_id}@{result.study.study_ref.version}
          </span>
          <code>{result.study.content_digest}</code>
          <span>{result.receipt.status} · formal_transfer_claim_write=false</span>
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
