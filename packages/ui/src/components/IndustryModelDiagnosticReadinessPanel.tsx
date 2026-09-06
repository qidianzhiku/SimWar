import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiEnvelope, IndustryModelDiagnosticReadinessDto } from "@simwar/shared-contracts";

export interface IndustryModelDiagnosticReadinessPanelProps {
  apiBase: string;
  courseId?: string | null | undefined;
  runId?: string | null | undefined;
  teamId?: string | null | undefined;
  roundId?: string | null | undefined;
  scenarioPackageId?: string | null | undefined;
  parameterSetId?: string | null | undefined;
  qualificationId?: string | null | undefined;
  tenantId: string;
  token: string;
  role: "teacher" | "admin" | "student";
}

type LoadState = "missing-context" | "loading" | "ready" | "error";

type DiagnosticIdentity = {
  diagnosticEvidenceDigest: string;
  interpretationPolicyDigest: string;
};

function nonBlank(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function displayError(error: unknown): string {
  return error instanceof Error ? error.message : "Industry Model 诊断读取失败";
}

export function IndustryModelDiagnosticReadinessPanel(
  props: IndustryModelDiagnosticReadinessPanelProps
) {
  const {
    apiBase,
    courseId,
    runId,
    teamId,
    roundId,
    scenarioPackageId,
    parameterSetId,
    qualificationId,
    tenantId,
    token,
    role
  } = props;
  const [data, setData] = useState<IndustryModelDiagnosticReadinessDto | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("missing-context");
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const lastIdentityRef = useRef<DiagnosticIdentity | null>(null);
  const contextKey = useMemo(
    () =>
      JSON.stringify([
        apiBase,
        courseId,
        runId,
        teamId,
        roundId,
        scenarioPackageId,
        parameterSetId,
        qualificationId,
        tenantId,
        token,
        role
      ]),
    [
      apiBase,
      courseId,
      runId,
      teamId,
      roundId,
      scenarioPackageId,
      parameterSetId,
      qualificationId,
      tenantId,
      token,
      role
    ]
  );
  const hasExactContext = [
    courseId,
    runId,
    teamId,
    roundId,
    scenarioPackageId,
    parameterSetId,
    qualificationId,
    tenantId,
    token
  ].every(nonBlank);

  useEffect(() => {
    if (
      !nonBlank(courseId) ||
      !nonBlank(runId) ||
      !nonBlank(teamId) ||
      !nonBlank(roundId) ||
      !nonBlank(scenarioPackageId) ||
      !nonBlank(parameterSetId) ||
      !nonBlank(qualificationId) ||
      !nonBlank(tenantId) ||
      !nonBlank(token)
    ) {
      setData(null);
      setLoadState("missing-context");
      setErrorMessage("");
      lastIdentityRef.current = null;
      return;
    }
    const controller = new AbortController();
    setLoadState("loading");
    setErrorMessage("");
    const query = new URLSearchParams({
      courseId,
      runId,
      teamId,
      roundId,
      scenarioPackageId,
      parameterSetId,
      qualificationId
    });
    const lastIdentity = lastIdentityRef.current;
    if (lastIdentity) {
      query.set("expectedDiagnosticEvidenceDigest", lastIdentity.diagnosticEvidenceDigest);
      query.set("expectedInterpretationPolicyDigest", lastIdentity.interpretationPolicyDigest);
    }
    void fetch(
      `${apiBase}/api/v1/bff/${role}/model-qualification/diagnostic-readiness?${query.toString()}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-tenant-id": tenantId
        },
        signal: controller.signal
      }
    )
      .then(async (response) => {
        let envelope: ApiEnvelope<IndustryModelDiagnosticReadinessDto>;
        try {
          envelope = (await response.json()) as ApiEnvelope<IndustryModelDiagnosticReadinessDto>;
        } catch {
          throw new Error(`HTTP_${response.status}_NON_JSON`);
        }
        if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
        setData(envelope.data);
        if (
          envelope.data.diagnostic_evidence_digest &&
          envelope.data.interpretation_policy_digest &&
          envelope.data.readiness_status !== "REBASE_REQUIRED"
        ) {
          lastIdentityRef.current = {
            diagnosticEvidenceDigest: envelope.data.diagnostic_evidence_digest,
            interpretationPolicyDigest: envelope.data.interpretation_policy_digest
          };
        }
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setData(null);
        setLoadState("error");
        setErrorMessage(displayError(error));
      });
    return () => controller.abort();
  }, [apiBase, contextKey, hasExactContext, reloadNonce, role]);

  return (
    <section className="sw-ui summary-panel" aria-label="Industry Model diagnostic readiness">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">IM-O1 · exact diagnostic interpretation</p>
          <h3>Industry Model 诊断可解释性</h3>
        </div>
        <strong className="summary-badge">{role.toUpperCase()}</strong>
      </div>
      {loadState === "missing-context" ? (
        <p
          className="lifecycle-status"
          role="status"
          data-testid="industry-diagnostic-missing-context"
        >
          等待完整 Course / Run / Round / Team / Scenario / Parameter / Qualification
          上下文；不会猜测 latest 或 default。
        </p>
      ) : null}
      {loadState === "loading" ? (
        <p className="lifecycle-status" role="status" aria-live="polite">
          正在读取 exact diagnostic producer…
        </p>
      ) : null}
      {loadState === "error" ? (
        <div className="evidence-note" role="alert">
          <p>{errorMessage}</p>
          <button type="button" onClick={() => setReloadNonce((value) => value + 1)}>
            重新读取 exact diagnostic
          </button>
        </div>
      ) : null}
      {loadState === "ready" && data ? (
        <>
          <div className="summary-grid" data-testid="industry-diagnostic-readiness">
            <article>
              <span>Readiness</span>
              <strong>{data.readiness_status}</strong>
            </article>
            <article>
              <span>Evidence boundary</span>
              <strong>
                {role === "student"
                  ? data.student_summary?.evidence_classes.join(" / ") || "NOT_PROVEN"
                  : data.provability?.map((entry) => entry.classification).join(" / ") ||
                    "NOT_PROVEN"}
              </strong>
            </article>
            <article>
              <span>Provider</span>
              <strong>{data.provider}</strong>
            </article>
            <article>
              <span>Official truth write</span>
              <strong>{String(data.official_truth_write)}</strong>
            </article>
          </div>
          {role !== "student" && data.qualification ? (
            <p className="evidence-note">
              ModelVersion={data.model_version_reference?.version ?? "exact"} · qualification=
              {data.qualification.qualification_id} · review={data.qualification.review_status} ·
              binding={data.qualification.binding_status}
            </p>
          ) : null}
          <p className="evidence-note">
            诊断 PASS 不等于业务真值或因果证明；WANT / CAN / REALIZED 只按已证明的 producer 分类。
          </p>
          {role === "student" && data.student_summary ? (
            <p className="evidence-note">
              visibility={data.student_summary.visibility} · advisory-only
            </p>
          ) : null}
          <ul>
            {data.known_limits.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
