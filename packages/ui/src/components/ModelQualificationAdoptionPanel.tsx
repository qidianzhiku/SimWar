import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AdoptionDriftAssessment,
  AdoptionRollbackDryRun,
  EvidenceAdoptionDisposition,
  GovernedRollbackRequestReceipt,
  ModelQualificationAdoptionOperationsAdminProjection,
  ModelQualificationAdoptionOperationsTeacherProjection,
  ModelQualificationRunAdmissionSelection,
  ModelQualificationTeacherProjection,
  ModelQualificationRollbackOutcomeResolution
} from "@simwar/shared-contracts";

export interface ModelQualificationAdoptionPanelProps {
  apiBase: string;
  courseId: string;
  onRunAdmissionSelectionChange?: (
    selection: ModelQualificationRunAdmissionSelection | null
  ) => void;
  tenantId: string;
  token: string;
  role: "teacher" | "admin";
}

type PendingCommand = { action: string; body: Record<string, unknown> };
type ProjectionLoadResult = {
  operationsAvailable: boolean;
  retryRequired: boolean;
  notice?: string;
};
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** One role-bound consumer of the existing Model Qualification authority. */
export function ModelQualificationAdoptionPanel(props: ModelQualificationAdoptionPanelProps) {
  const { apiBase, courseId, onRunAdmissionSelectionChange, tenantId, token, role } = props;
  const context = JSON.stringify([apiBase, tenantId, courseId, token, role]);
  const epoch = useRef(0);
  const inFlight = useRef(false);
  const [loaded, setLoaded] = useState<{
    context: string;
    data: ModelQualificationTeacherProjection;
  } | null>(null);
  const [operations, setOperations] = useState<{
    context: string;
    data:
      | ModelQualificationAdoptionOperationsTeacherProjection
      | ModelQualificationAdoptionOperationsAdminProjection;
  } | null>(null);
  const [assessment, setAssessment] = useState<AdoptionDriftAssessment | null>(null);
  const [rollbackDryRun, setRollbackDryRun] = useState<AdoptionRollbackDryRun | null>(null);
  const [rollbackRequestReceipt, setRollbackRequestReceipt] =
    useState<GovernedRollbackRequestReceipt | null>(null);
  const [rollbackOutcomes, setRollbackOutcomes] = useState<{
    context: string;
    data: readonly ModelQualificationRollbackOutcomeResolution[];
  } | null>(null);
  const [rollbackOutcomeError, setRollbackOutcomeError] = useState<string | null>(null);
  const [qualificationId, setQualificationId] = useState("");
  const [proposalId, setProposalId] = useState("");
  const [note, setNote] = useState("");
  const [expiry, setExpiry] = useState("");
  const [notice, setNotice] = useState("读取 exact adoption 状态");
  const [reauthenticationRequired, setReauthenticationRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingCommand | null>(null);
  const [runId, setRunId] = useState("");
  const [launchId, setLaunchId] = useState("");
  const [history, setHistory] = useState<{
    context: string;
    runId: string;
    launchId: string;
    receipt: unknown;
  } | null>(null);
  const base = `${apiBase}/api/v1/bff/${role}/model-qualification`;
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-tenant-id": tenantId
  };
  const projection = loaded?.context === context ? loaded.data : null;
  const operationsProjection = operations?.context === context ? operations.data : null;
  const rollbackOutcomeData = rollbackOutcomes?.context === context ? rollbackOutcomes.data : [];
  const state = projection?.evidence_adoption;
  const qualifications = projection?.qualifications ?? [];
  const selected = qualifications.filter((q) => q.qualification_id === qualificationId);
  const qualification = selected.length === 1 ? selected[0] : undefined;
  const historicalTargets = qualification
    ? (state?.records ?? []).filter(
        (item) =>
          item.epoch.qualification_id === qualification.qualification_id &&
          item.disposition === "ADOPTED_FOR_FUTURE_ADMISSION"
      )
    : [];
  const genericHistoricalBypass = historicalTargets.length > 0;
  const pointers = qualification
    ? (state?.selections ?? []).filter(
        (item) =>
          equal(item.model_version_reference, qualification.model_version_reference) &&
          equal(item.model_artifact_reference, qualification.artifact)
      )
    : [];
  const expected =
    pointers.length === 1
      ? { adoption_id: pointers[0]!.adoption_id, adoption_digest: pointers[0]!.adoption_digest }
      : null;
  const selectedPointer = pointers.length === 1 ? pointers[0] : undefined;
  const runAdmissionSelection = useMemo<ModelQualificationRunAdmissionSelection | null>(() => {
    if (!qualification || !selectedPointer) return null;
    return {
      adoption: {
        adoption_digest: selectedPointer.adoption_digest,
        adoption_id: selectedPointer.adoption_id
      },
      calibration_dataset_id: qualification.calibration_dataset_id,
      model_artifact_reference: qualification.artifact,
      model_version_reference: qualification.model_version_reference,
      qualification_id: qualification.qualification_id,
      source_package_id: qualification.source_package_id
    };
  }, [qualification, selectedPointer?.adoption_digest, selectedPointer?.adoption_id]);
  const proposals = state?.proposals ?? [];
  const selectedProposals = proposals.filter((item) => item.proposal_id === proposalId);
  const proposal = selectedProposals.length === 1 ? selectedProposals[0] : undefined;
  const reviewed =
    proposal && (state?.reviews ?? []).some((item) => item.proposal_id === proposal.proposal_id);
  const disposed =
    proposal && (state?.records ?? []).some((item) => item.proposal_id === proposal.proposal_id);

  async function load(generation: number): Promise<ProjectionLoadResult> {
    const clearOperations = () => {
      if (generation !== epoch.current) return;
      setOperations(null);
      setAssessment(null);
      setRollbackDryRun(null);
      setRollbackRequestReceipt(null);
      setRollbackOutcomes(null);
    };
    const operationsUnavailable = (notice: string): ProjectionLoadResult => {
      clearOperations();
      setRollbackOutcomeError(null);
      if (generation === epoch.current) setReauthenticationRequired(true);
      return { operationsAvailable: false, retryRequired: true, notice };
    };
    const outcomesUnavailable = (notice: string): ProjectionLoadResult => {
      if (generation === epoch.current) {
        setRollbackOutcomes(null);
        setRollbackOutcomeError(notice);
      }
      return { operationsAvailable: true, retryRequired: true, notice };
    };
    if (generation === epoch.current) {
      setLoaded(null);
      clearOperations();
      setRollbackOutcomeError(null);
    }
    const query = `courseId=${encodeURIComponent(courseId)}`;
    let projectionData: ModelQualificationTeacherProjection;
    try {
      const projectionResponse = await fetch(`${base}?${query}`, { headers });
      const projectionResult = await projectionResponse.json();
      if (!projectionResponse.ok)
        throw new Error(
          `${projectionResult.code ?? projectionResponse.status}: ${projectionResult.message ?? "读取失败"}`
        );
      projectionData = projectionResult.data as ModelQualificationTeacherProjection;
      if (generation === epoch.current) {
        setLoaded({ context, data: projectionData });
        setReauthenticationRequired(false);
      }
    } catch (error) {
      if (generation === epoch.current) setReauthenticationRequired(true);
      throw error;
    }
    if (generation !== epoch.current || !projectionData.evidence_adoption) {
      clearOperations();
      return { operationsAvailable: false, retryRequired: false };
    }
    let operationsResponse: Response;
    try {
      operationsResponse = await fetch(`${base}/adoption-operations?${query}`, { headers });
    } catch (error) {
      return operationsUnavailable(
        error instanceof Error ? error.message : "O6 operations 读取失败"
      );
    }
    let operationsResult: {
      code?: string;
      data?:
        | ModelQualificationAdoptionOperationsTeacherProjection
        | ModelQualificationAdoptionOperationsAdminProjection;
      message?: string;
    };
    try {
      operationsResult = await operationsResponse.json();
    } catch {
      return operationsUnavailable("O6 operations 返回了非 JSON 响应");
    }
    if (!operationsResponse.ok) {
      return operationsUnavailable(
        `${operationsResult.code ?? operationsResponse.status}: ${operationsResult.message ?? "O6 operations 读取失败"}`
      );
    }
    if (!operationsResult.data) {
      return operationsUnavailable("O6 operations 响应缺少数据");
    }
    if (generation === epoch.current) {
      setOperations({
        context,
        data: operationsResult.data
      });
      setAssessment(operationsResult.data.current_assessment ?? null);
      setRollbackDryRun(null);
      setReauthenticationRequired(false);
    }
    const rollbackRequests = projectionData.governed_rollback_requests ?? [];
    let outcomeResults: ModelQualificationRollbackOutcomeResolution[];
    try {
      outcomeResults = await Promise.all(
        rollbackRequests.map(async (request) => {
          const response = await fetch(
            `${base}/evidence-adoptions/rollback-requests/${encodeURIComponent(request.rollback_request_id)}/outcome?${query}`,
            { headers }
          );
          let result: { data?: ModelQualificationRollbackOutcomeResolution };
          try {
            result = (await response.json()) as {
              data?: ModelQualificationRollbackOutcomeResolution;
            };
          } catch {
            throw new Error("回退请求 outcome 返回了非 JSON 响应");
          }
          if (!response.ok || !result.data) {
            throw new Error(`${response.status}: 回退请求 outcome 读取失败`);
          }
          return result.data;
        })
      );
    } catch (error) {
      return outcomesUnavailable(
        error instanceof Error ? error.message : "回退请求 outcome 读取失败"
      );
    }
    if (generation === epoch.current) {
      setRollbackOutcomes({ context, data: outcomeResults });
      setRollbackOutcomeError(null);
    }
    return { operationsAvailable: true, retryRequired: false };
  }

  async function reloadProjection() {
    if (inFlight.current) return;
    inFlight.current = true;
    const generation = epoch.current;
    setBusy(true);
    try {
      const result = await load(generation);
      if (generation === epoch.current)
        setNotice(
          result.notice ??
            (result.operationsAvailable
              ? "显式选择资格与采用候选；复核不会自动采用"
              : "O6 operations unavailable；既有采用投影保持只读可见")
        );
    } catch (error) {
      if (generation === epoch.current)
        setNotice(error instanceof Error ? error.message : "读取失败");
    } finally {
      if (generation === epoch.current) {
        setBusy(false);
        inFlight.current = false;
      }
    }
  }

  useEffect(() => {
    const generation = ++epoch.current;
    setLoaded(null);
    setOperations(null);
    setAssessment(null);
    setRollbackDryRun(null);
    setRollbackRequestReceipt(null);
    setRollbackOutcomes(null);
    setRollbackOutcomeError(null);
    setReauthenticationRequired(false);
    setQualificationId("");
    setProposalId("");
    setPending(null);
    setHistory(null);
    setRunId("");
    setLaunchId("");
    setNote("");
    setExpiry("");
    setBusy(false);
    inFlight.current = false;
    setNotice("读取 exact adoption 状态");
    if (courseId && token)
      void load(generation)
        .then((result) => {
          if (generation === epoch.current)
            setNotice(
              result.notice ??
                (result.operationsAvailable
                  ? "显式选择资格与采用候选；复核不会自动采用"
                  : "O6 operations unavailable；既有采用投影保持只读可见")
            );
        })
        .catch((error: unknown) => {
          if (generation === epoch.current)
            setNotice(error instanceof Error ? error.message : "读取失败");
        });
    return () => {
      epoch.current += 1;
    };
    // Context binds every request input and invalidates all late responses.
  }, [context]);

  useEffect(() => {
    onRunAdmissionSelectionChange?.(runAdmissionSelection);
  }, [onRunAdmissionSelectionChange, runAdmissionSelection]);

  async function execute(command: PendingCommand) {
    if (inFlight.current || !projection) return;
    inFlight.current = true;
    const generation = epoch.current;
    setBusy(true);
    setPending(command);
    try {
      const response = await fetch(`${base}/evidence-adoptions/${command.action}`, {
        method: "POST",
        headers,
        body: JSON.stringify(command.body)
      });
      const result = await response.json();
      if (generation !== epoch.current) return;
      if (!response.ok) {
        if (response.status < 500) setPending(null);
        throw new Error(`${result.code ?? response.status}: ${result.message ?? "采用命令失败"}`);
      }
      // The mutation result is known. A projection refresh failure must use
      // exact-context reload, never replay the already-successful mutation.
      setPending(null);
      if (result.data?.proposal?.proposal_id) setProposalId(result.data.proposal.proposal_id);
      const refreshed = await load(generation);
      if (
        generation === epoch.current &&
        command.action === "rollback-requests" &&
        refreshed.operationsAvailable &&
        result.data?.request &&
        result.data?.proposal
      ) {
        setRollbackRequestReceipt(result.data as GovernedRollbackRequestReceipt);
      }
      if (generation === epoch.current)
        setNotice(
          refreshed.operationsAvailable
            ? result.data?.reused
              ? "REUSED：返回原命令回执，未重复采用"
              : "命令已完成；请检查 exact 回执与未来准入指针"
            : (refreshed.notice ?? "命令已完成；请重新读取 exact adoption 状态")
        );
    } catch (error) {
      if (generation === epoch.current)
        setNotice(error instanceof Error ? error.message : "传输结果未知；仅可重试同一命令");
    } finally {
      if (generation === epoch.current) {
        setBusy(false);
        inFlight.current = false;
      }
    }
  }

  function command(action: string, body: Record<string, unknown>) {
    if (pending || busy) return;
    void execute({
      action,
      body: { ...body, course_id: courseId, command_id: crypto.randomUUID() }
    });
  }

  async function inspectHistory() {
    if (inFlight.current || !projection) return;
    inFlight.current = true;
    const generation = epoch.current;
    setHistory(null);
    setBusy(true);
    try {
      const query = new URLSearchParams({ courseId, ...(launchId ? { launchId } : {}) });
      const response = await fetch(`${base}/run-admissions/${encodeURIComponent(runId)}?${query}`, {
        headers
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(`${result.code ?? response.status}: ${result.message ?? "历史证据不可用"}`);
      if (generation === epoch.current)
        setHistory({ context, runId, launchId, receipt: result.data });
    } catch (error) {
      if (generation === epoch.current)
        setNotice(error instanceof Error ? error.message : "HISTORICAL_REFERENCE_UNAVAILABLE");
    } finally {
      if (generation === epoch.current) {
        setBusy(false);
        inFlight.current = false;
      }
    }
  }

  async function runOperations(action: "drift-assessments" | "rollback-dry-runs") {
    if (inFlight.current || !operationsProjection?.current_adoption) return;
    const currentRecord = (state?.records ?? []).filter(
      (item) =>
        item.adoption_id === operationsProjection.current_adoption?.adoption_id &&
        item.adoption_digest === operationsProjection.current_adoption?.adoption_digest
    );
    if (currentRecord.length !== 1) {
      setNotice("当前 exact adoption 无唯一记录，必须重新绑定后再评估");
      return;
    }
    const predecessor = currentRecord[0]!.predecessor;
    if (action === "rollback-dry-runs" && !predecessor) {
      setNotice("NO_PREDECESSOR：没有可显式预演的历史采用前任");
      return;
    }
    inFlight.current = true;
    const generation = epoch.current;
    setBusy(true);
    try {
      const response = await fetch(`${base}/adoption-operations/${action}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          course_id: courseId,
          expected_adoption_state_digest: operationsProjection.adoption_state_digest,
          expected_operations_policy_digest: operationsProjection.operations_policy_digest,
          assessed_at: new Date().toISOString(),
          ...(action === "drift-assessments"
            ? { expected_adoption: operationsProjection.current_adoption }
            : {
                current_adoption: operationsProjection.current_adoption,
                predecessor_adoption: predecessor
              })
        })
      });
      const result = await response.json();
      if (generation !== epoch.current) return;
      if (!response.ok)
        throw new Error(`${result.code ?? response.status}: ${result.message ?? "预演失败"}`);
      if (action === "drift-assessments") setAssessment(result.data as AdoptionDriftAssessment);
      else setRollbackDryRun(result.data as AdoptionRollbackDryRun);
      setRollbackRequestReceipt(null);
      setNotice(
        action === "drift-assessments"
          ? "健康评估完成；仅影响未来准入判断，不写入采用状态"
          : "回退影响预演完成；rollback_applied=false"
      );
    } catch (error) {
      if (generation === epoch.current)
        setNotice(error instanceof Error ? error.message : "预演结果未知，请重新读取 exact 状态");
    } finally {
      if (generation === epoch.current) {
        setBusy(false);
        inFlight.current = false;
      }
    }
  }

  const disabled = busy || Boolean(pending) || !projection;
  return (
    <section aria-label="governed multi-epoch evidence adoption" className="summary-panel">
      <h3>多证据 Epoch 采用与历史解析</h3>
      <p>
        {tenantId} / {courseId} / {role} · Provider OFF · ADOPTION ≠ OFFICIAL TRUTH / Score / Rank
      </p>
      <section aria-label="adoption drift operations and rollback dry run">
        <h4>采用漂移运营与回退影响预演</h4>
        <p>Dry-run only · Provider OFF · Advice ≠ Decision / Settlement / Truth · 不执行自动回退</p>
        <div className="workspace-actions">
          <button
            type="button"
            data-testid="assess-adoption-drift"
            disabled={disabled || !operationsProjection?.current_adoption}
            onClick={() => void runOperations("drift-assessments")}
          >
            评估当前采用健康
          </button>
          <button
            type="button"
            data-testid="preview-adoption-rollback"
            disabled={disabled || !operationsProjection?.current_adoption}
            onClick={() => void runOperations("rollback-dry-runs")}
          >
            预演 exact 前任回退影响
          </button>
        </div>
        <p data-testid="adoption-operations-health">
          health=
          {assessment?.status ?? operationsProjection?.current_assessment?.status ?? "UNAVAILABLE"}
          {" · "}future_admission=
          {assessment?.future_admission_impact ??
            operationsProjection?.current_assessment?.future_admission_impact ??
            "UNKNOWN"}
        </p>
        {assessment && (
          <details>
            <summary>漂移、到期、权利、资格与重新资格影响</summary>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {JSON.stringify(assessment, null, 2)}
            </pre>
          </details>
        )}
        {rollbackDryRun && (
          <details open>
            <summary>exact predecessor rollback dry-run receipt</summary>
            <p>
              status={rollbackDryRun.status} · rollback_applied=
              {String(rollbackDryRun.rollback_applied)} · adoption_mutation=
              {String(rollbackDryRun.adoption_mutation)}
            </p>
            <pre
              style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
              data-testid="rollback-dry-run-receipt"
            >
              {JSON.stringify(rollbackDryRun, null, 2)}
            </pre>
          </details>
        )}
        <button
          type="button"
          data-testid="create-governed-rollback-request"
          disabled={
            disabled ||
            rollbackDryRun?.status !== "READY_WITH_LIMITS" ||
            rollbackDryRun.predecessor_currently_eligible !== true ||
            !note.trim()
          }
          onClick={() =>
            rollbackDryRun &&
            command("rollback-requests", {
              dry_run: rollbackDryRun,
              reason: note
            })
          }
        >
          创建受治理回退请求
        </button>
        <p>请求 != 应用 · selection 保持 current · rollback_applied=false</p>
        {rollbackRequestReceipt && (
          <details open data-testid="governed-rollback-request-receipt">
            <summary>Governed rollback request + linked O5 proposal</summary>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {JSON.stringify(rollbackRequestReceipt, null, 2)}
            </pre>
          </details>
        )}
        {(projection?.governed_rollback_requests?.length ?? 0) > 0 && (
          <details>
            <summary>受治理回退请求历史（只读）</summary>
            <pre
              data-testid="governed-rollback-request-history"
              style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
            >
              {JSON.stringify(projection?.governed_rollback_requests ?? [], null, 2)}
            </pre>
          </details>
        )}
        {rollbackOutcomeError && (
          <>
            <p role="status" data-testid="rollback-outcome-read-error">
              O8 outcome 读取失败：{rollbackOutcomeError}；O6 既有控制仍保持可用，请重新读取 exact
              状态。
            </p>
            <button
              type="button"
              data-testid="reload-rollback-outcomes"
              disabled={busy}
              onClick={() => void reloadProjection()}
            >
              重新读取回退请求结果
            </button>
          </>
        )}
        {rollbackOutcomeData.length > 0 && (
          <section
            aria-label="rollback request outcome timeline"
            data-testid="rollback-outcome-timeline"
          >
            <h5>回退请求结果与历史一致性（只读）</h5>
            {rollbackOutcomeData.map((outcome) => (
              <details key={outcome.resolution_id} open>
                <summary>
                  {outcome.rollback_request_id} · {outcome.outcome_status}
                </summary>
                <p>
                  historical_outcome={outcome.historical_outcome.status} · current_effect=
                  {outcome.current_effect} · qualification_consistency=
                  {outcome.qualification_consistency} · historical_consistency=
                  {outcome.historical_consistency}
                </p>
                <p>
                  request != application · rollback_applied={String(outcome.rollback_applied)} ·
                  Provider={outcome.provider}
                </p>
                <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {JSON.stringify(
                    {
                      request: outcome.request,
                      linked_proposal: outcome.linked_proposal,
                      review: outcome.review,
                      disposition: outcome.disposition,
                      resulting_adoption: outcome.resulting_adoption,
                      known_limits: outcome.known_limits
                    },
                    null,
                    2
                  )}
                </pre>
              </details>
            ))}
          </section>
        )}
      </section>
      <p role="status" aria-live="polite">
        {notice}
      </p>
      {reauthenticationRequired && (
        <button
          type="button"
          data-testid="reload-adoption-projection"
          disabled={busy}
          onClick={() => void reloadProjection()}
        >
          重新读取 exact adoption 状态
        </button>
      )}
      <p>
        {(state?.selections.length ?? 0) === 0
          ? "尚无明确采用记录；未来 O5 准入不可使用默认证据"
          : "未来准入仅接受以下显式 adoption id + digest"}
      </p>
      <pre
        style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
        data-testid="future-admission-selection"
      >
        {JSON.stringify(state?.selections ?? [], null, 2)}
      </pre>
      <label>
        待采用的 exact Qualification
        <select
          aria-label="待采用的 exact Qualification"
          value={qualificationId}
          onChange={(event) => setQualificationId(event.target.value)}
          disabled={disabled}
        >
          <option value="">请选择，不使用 latest/default</option>
          {qualifications.map((q) => (
            <option key={q.qualification_id} value={q.qualification_id}>
              {q.qualification_id} · {q.source_package_id} · {q.review.status}/{q.binding.status}
            </option>
          ))}
        </select>
      </label>
      {qualification && (
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {JSON.stringify(
            {
              qualification_id: qualification.qualification_id,
              source_package_id: qualification.source_package_id,
              calibration_dataset_id: qualification.calibration_dataset_id,
              model_version: qualification.model_version_reference,
              expected_adoption: expected
            },
            null,
            2
          )}
        </pre>
      )}
      {genericHistoricalBypass && (
        <p role="alert">
          EVIDENCE_ADOPTION_ROLLBACK_REQUEST_REQUIRED：历史 adopted lineage 只能从 exact O6 dry-run
          创建受治理回退请求。
        </p>
      )}
      <button
        data-testid="request-evidence-adoption"
        type="button"
        disabled={
          disabled ||
          !qualification ||
          genericHistoricalBypass ||
          pointers.length > 1 ||
          qualification.review.status !== "APPROVED" ||
          qualification.binding.status !== "BOUND"
        }
        onClick={() =>
          command("request", { qualification_id: qualificationId, expected_adoption: expected })
        }
      >
        提出 exact Epoch 采用候选
      </button>
      <label>
        采用候选
        <select
          aria-label="采用候选"
          value={proposalId}
          onChange={(event) => setProposalId(event.target.value)}
          disabled={disabled}
        >
          <option value="">显式选择候选</option>
          {proposals.map((item) => (
            <option key={item.proposal_id} value={item.proposal_id}>
              {item.proposal_id} · {item.epoch.qualification_id}
            </option>
          ))}
        </select>
      </label>
      {proposal && (
        <pre
          style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          data-testid="adoption-proposal-inspector"
        >
          {JSON.stringify(proposal, null, 2)}
        </pre>
      )}
      <label>
        采用决策理由
        <textarea
          aria-label="采用决策理由"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={disabled}
        />
      </label>
      <label>
        延期截止时间（UTC ISO，延期必填）
        <input
          aria-label="延期截止时间"
          value={expiry}
          onChange={(event) => setExpiry(event.target.value)}
          disabled={disabled}
          placeholder="YYYY-MM-DDTHH:mm:ss.sssZ"
        />
      </label>
      <button
        type="button"
        disabled={disabled || !proposal || reviewed || !note.trim()}
        onClick={() =>
          proposal &&
          command("review", {
            proposal_id: proposal.proposal_id,
            proposal_digest: proposal.proposal_digest,
            decision: "APPROVED",
            note
          })
        }
      >
        批准候选复核（不采用）
      </button>
      <div className="workspace-actions">
        {(
          [
            ["ADOPTED_FOR_FUTURE_ADMISSION", "明确采用到未来准入"],
            ["DEFERRED_WITH_EXPIRY", "延期且保留原采用"],
            ["REJECTED_CANDIDATE", "拒绝候选"],
            ["REBASE_REQUIRED", "记录需要重新绑定"]
          ] as const
        ).map(([disposition, label]) => (
          <button
            key={disposition}
            type="button"
            disabled={
              disabled ||
              !proposal ||
              !reviewed ||
              disposed ||
              !note.trim() ||
              (disposition === "DEFERRED_WITH_EXPIRY" && !expiry)
            }
            onClick={() =>
              proposal &&
              command("disposition", {
                proposal_id: proposal.proposal_id,
                proposal_digest: proposal.proposal_digest,
                disposition: disposition as EvidenceAdoptionDisposition,
                expires_at: expiry || null,
                note
              })
            }
          >
            {label}
          </button>
        ))}
      </div>
      {pending && (
        <button type="button" disabled={busy} onClick={() => void execute(pending)}>
          重试同一 exact 命令
        </button>
      )}
      <details>
        <summary>采用与拒绝历史（不覆盖旧记录）</summary>
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {JSON.stringify(state?.records ?? [], null, 2)}
        </pre>
      </details>
      <h4>历史 Run 原始准入回执</h4>
      <label>
        历史 Run ID
        <input
          aria-label="历史 Run ID"
          value={runId}
          onChange={(event) => setRunId(event.target.value)}
          disabled={busy}
        />
      </label>
      <label>
        原 W025 Launch ID（仅 v1 回执需要）
        <input
          aria-label="原 W025 Launch ID"
          value={launchId}
          onChange={(event) => setLaunchId(event.target.value)}
          disabled={busy}
        />
      </label>
      <button type="button" disabled={busy || !runId.trim()} onClick={() => void inspectHistory()}>
        读取该 Run 原始证据
      </button>
      {history?.context === context && history.runId === runId && history.launchId === launchId && (
        <pre
          data-testid="historical-admission-receipt"
          style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
        >
          {JSON.stringify(history.receipt, null, 2)}
        </pre>
      )}
      <p>
        新 Epoch 不回写历史
        Run；无法解析时明确失败，不回退到当前或最新证据。Provider、发布与正式真值写入均未启用。
      </p>
    </section>
  );
}
