import { useEffect, useState } from "react";
import type {
  RegionalTransferCandidate,
  RegionalTransferCandidateInput,
  RegionalTransferTeacherProjection
} from "@simwar/shared-contracts";
import { WorkbenchFrame } from "@simwar/ui";
import {
  bindRegionalTransfer,
  freezeRegionalTransfer,
  loadRegionalTransferSelection,
  previewRegionalTransfer,
  validateRegionalTransfer
} from "./regional-transfer-client";

type ProductResult = RegionalTransferTeacherProjection | RegionalTransferCandidate;

export function RegionalTransferWorkbench({
  apiBase,
  courseId,
  roundNo,
  runId,
  tenantId,
  token
}: {
  apiBase: string;
  courseId: string | null | undefined;
  roundNo: number | undefined;
  runId: string | null | undefined;
  tenantId: string;
  token: string;
}) {
  const [input, setInput] = useState<RegionalTransferCandidateInput | null>(null);
  const [result, setResult] = useState<ProductResult | null>(null);
  const [phase, setPhase] = useState("IDLE");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setInput(null);
    setResult(null);
    setError("");
    setPhase(
      courseId && runId && roundNo !== undefined ? "READY_TO_LOAD" : "WAITING_FOR_EXACT_RUN"
    );
  }, [apiBase, courseId, roundNo, runId, tenantId, token]);

  const loadExactSources = async () => {
    if (!courseId || !runId || roundNo === undefined) return;
    setBusy(true);
    setError("");
    setPhase("LOADING_EXACT_SOURCES");
    try {
      setInput(await loadRegionalTransferSelection(apiBase, token, courseId, runId, roundNo));
      setPhase("READY");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "exact regional sources unavailable");
      setPhase("SOURCE_BLOCKED");
    } finally {
      setBusy(false);
    }
  };

  const run = async (action: () => Promise<ProductResult>, nextPhase: string) => {
    setBusy(true);
    setError("");
    try {
      setResult(await action());
      setPhase(nextPhase);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "regional transfer operation failed");
      setPhase("BLOCKED");
    } finally {
      setBusy(false);
    }
  };

  const candidateId = result?.candidate_ref.candidate_id;
  return (
    <WorkbenchFrame
      className="candidate-surface regional-transfer-workbench"
      ariaLabel="Teacher governed regional transfer workbench"
      eyebrow="MAIN · RT-O1"
      title="区域迁移与场景演化"
      badge="candidate-only"
      boundary="仅使用当前 Course/Run/Round、CourseBlueprint、ParameterSet、ScenarioPackage 与 M4 区域包的精确引用；不写 REALIZED、Settlement、Score、Rank，不启用 Provider/PostgreSQL，也不宣称真实校准或完整无障碍通过。"
      headingClassName="panel-title"
      state={
        <>
          <p aria-live="polite">状态：{phase}</p>
          {error ? (
            <p className="d6-error" role="alert">
              {error}
            </p>
          ) : null}
        </>
      }
    >
      {input ? (
        <div className="evidence-note" aria-label="exact regional transfer source binding">
          <strong>
            {input.baseline_region} → {input.target_region}
          </strong>
          <span>
            Course {input.course_id} · Run {input.run_id} · Round {input.round_no}
          </span>
          <span>
            Scenario {input.scenario_package_reference.scenario_package_id}@
            {input.scenario_package_reference.version}
          </span>
          <span>
            Parameter {input.parameter_set_reference.parameter_set_id}@
            {input.parameter_set_reference.version}
          </span>
        </div>
      ) : null}
      <div className="d6-actions">
        <button
          disabled={busy || !courseId || !runId || roundNo === undefined}
          onClick={() => void loadExactSources()}
        >
          读取精确来源
        </button>
        <button
          disabled={busy || input === null}
          onClick={() =>
            input && void run(() => previewRegionalTransfer(apiBase, token, input), "PREVIEWED")
          }
        >
          预览候选
        </button>
        <button
          disabled={busy || input === null}
          onClick={() =>
            input && void run(() => validateRegionalTransfer(apiBase, token, input), "VALIDATED")
          }
        >
          校验候选
        </button>
        <button
          className="primary"
          disabled={busy || input === null}
          onClick={() =>
            input && void run(() => freezeRegionalTransfer(apiBase, token, input), "FROZEN")
          }
        >
          冻结候选
        </button>
        <button
          disabled={busy || !candidateId || result?.lifecycle !== "FROZEN"}
          onClick={() =>
            candidateId &&
            void run(() => bindRegionalTransfer(apiBase, token, candidateId), "ACTIVATED")
          }
        >
          发布给 Student
        </button>
      </div>
      {result ? (
        <div className="d6-receipt" aria-live="polite">
          <strong>{result.lifecycle}</strong>
          <span>
            {result.candidate_ref.candidate_id}@{result.candidate_ref.version}
          </span>
          <code>{result.candidate_ref.content_digest}</code>
          <span>
            shared governed scenario · {result.consumer_scope.team_ids.length} teams · minimum{" "}
            {result.consumer_scope.minimum_team_count}
          </span>
          <span>formal_writer_mutations=0 · provider=OFF · settlement_write=false</span>
          <span>
            Student URL 参数：regionalTransferCandidateId={result.candidate_ref.candidate_id}
          </span>
        </div>
      ) : null}
      {result?.known_limits.map((limit) => (
        <p className="evidence-note" key={limit}>
          {limit}
        </p>
      ))}
    </WorkbenchFrame>
  );
}
