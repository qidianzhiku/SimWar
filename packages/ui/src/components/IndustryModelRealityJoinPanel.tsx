import { useEffect, useRef, useState } from "react";
import type { ApiEnvelope, IndustryModelRealityJoinDto } from "@simwar/shared-contracts";

export interface IndustryModelRealityJoinPanelProps {
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

function nonBlank(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function IndustryModelRealityJoinPanel({
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
}: IndustryModelRealityJoinPanelProps) {
  const [data, setData] = useState<IndustryModelRealityJoinDto | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("missing-context");
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const lastDigestRef = useRef<string | null>(null);

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
      lastDigestRef.current = null;
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
    if (lastDigestRef.current) query.set("expectedRealityJoinDigest", lastDigestRef.current);
    void fetch(
      apiBase + "/api/v1/bff/" + role + "/model-qualification/reality-join?" + query.toString(),
      {
        headers: {
          authorization: "Bearer " + token,
          "content-type": "application/json",
          "x-tenant-id": tenantId
        },
        signal: controller.signal
      }
    )
      .then(async (response) => {
        let envelope: ApiEnvelope<IndustryModelRealityJoinDto>;
        try {
          envelope = (await response.json()) as ApiEnvelope<IndustryModelRealityJoinDto>;
        } catch {
          throw new Error("HTTP_" + response.status + "_NON_JSON");
        }
        if (!response.ok) throw new Error(envelope.code + ": " + envelope.message);
        setData(envelope.data);
        lastDigestRef.current =
          envelope.data.readiness_status === "REBASE_REQUIRED"
            ? null
            : envelope.data.readiness_digest;
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setData(null);
        setLoadState("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Industry Model Reality Join 读取失败"
        );
      });
    return () => controller.abort();
  }, [
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
    role,
    reloadNonce
  ]);

  return (
    <section
      className="sw-ui summary-panel"
      aria-label="Industry Model portability and reality join"
    >
      <div className="summary-heading">
        <div>
          <p className="eyebrow">IM-O2 · portability / holdout / Shanghai join</p>
          <h3>Industry Model 现实性联结</h3>
        </div>
        <strong className="summary-badge">{role.toUpperCase()}</strong>
      </div>
      {loadState === "missing-context" ? (
        <p className="lifecycle-status" role="status" data-testid="industry-reality-join-missing">
          等待完整 Course / Run / Round / Team / Scenario / Parameter / Qualification
          上下文；不会猜测 latest 或 default。
        </p>
      ) : null}
      {loadState === "loading" ? (
        <p className="lifecycle-status" role="status" aria-live="polite">
          正在读取 exact Reality Join…
        </p>
      ) : null}
      {loadState === "error" ? (
        <div className="evidence-note" role="alert">
          <p>{errorMessage}</p>
          <button type="button" onClick={() => setReloadNonce((value) => value + 1)}>
            重新读取 exact Reality Join
          </button>
        </div>
      ) : null}
      {loadState === "ready" && data ? (
        <>
          <div className="summary-grid" data-testid="industry-reality-join">
            <article>
              <span>Readiness</span>
              <strong>{data.readiness_status}</strong>
            </article>
            <article>
              <span>Portability</span>
              <strong>
                {data.role === "student"
                  ? data.portability_status
                  : data.support_evidence.portability.status}
              </strong>
            </article>
            <article>
              <span>Holdout</span>
              <strong>
                {data.role === "student"
                  ? data.holdout_status
                  : data.support_evidence.holdout.status}
              </strong>
            </article>
            <article>
              <span>Shanghai</span>
              <strong>
                {data.role === "student"
                  ? data.shanghai_status
                  : data.support_evidence.shanghai.consumption_status}
              </strong>
            </article>
          </div>
          {data.role !== "student" ? (
            <p className="evidence-note">
              ModelVersion={data.model_version_reference.version} · qualification=
              {data.qualification.qualification_id} · diagnostic=
              {data.diagnostic_evidence_digest.slice(0, 12)}… · support=
              {data.support_evidence.portability.package_identity}
            </p>
          ) : (
            <p className="evidence-note">
              role-safe evidence classes={data.evidence_classes.join(" / ")} · advisory
              interpretation only · Provider=OFF
            </p>
          )}
          <p className="evidence-note">
            Portability compatibility ≠ external validity · holdout eligibility remains NOT_ELIGIBLE
            · diagnostic PASS ≠ Business Truth ≠ Causal Proof.
          </p>
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
