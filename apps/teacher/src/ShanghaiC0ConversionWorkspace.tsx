import { useState } from "react";
import {
  SHANGHAI_C0_MACRO_DEFINITIONS,
  type ApiEnvelope,
  type ShanghaiC0Experiment,
  type ShanghaiC0MacroId,
  type ShanghaiC0TeacherProjection
} from "@simwar/shared-contracts";

interface Props {
  apiBase: string;
  courseId?: string | null;
  macroId: ShanghaiC0MacroId;
  modelVersionId?: string;
  parameterSetId?: string | null;
  parameterSetVersion?: string;
  roundId?: string | null;
  roundNo?: number;
  runId?: string | null;
  scenarioPackageId?: string | null;
  scenarioPackageVersion?: string;
  teamId?: string | null;
  tenantId: string;
  token: string;
}

function experimentFor(macroId: ShanghaiC0MacroId): ShanghaiC0Experiment {
  return {
    action:
      macroId === "M13"
        ? "refinance"
        : macroId === "M14"
          ? "positioning"
          : macroId === "M15"
            ? "service_shock"
            : macroId === "M16"
              ? "qualification"
              : macroId === "M17"
                ? "episode"
                : "rollback_dry_run",
    option_id: `teacher-${macroId.toLowerCase()}-option`,
    region: "shanghai",
    cohort: "community-eldercare",
    service_bundle: "integrated-care",
    positioning: "trusted-care",
    ...(macroId === "M15"
      ? { staffing_shock: -0.1, capacity_shock: -0.1, quality_shock: -0.05, horizon_rounds: 2 }
      : {}),
    ...(macroId === "M17" ? { episode_no: 1 } : {}),
    ...(macroId === "M18" ? { target_version: "2.0.0" } : {})
  };
}

export function ShanghaiC0ConversionWorkspace({
  apiBase,
  courseId,
  macroId,
  modelVersionId = "model-shanghai-c0-bound",
  parameterSetId,
  parameterSetVersion = "1.0.0",
  roundId,
  roundNo,
  runId,
  scenarioPackageId,
  scenarioPackageVersion = "1.0.0",
  teamId,
  tenantId,
  token
}: Props) {
  const [projection, setProjection] = useState<ShanghaiC0TeacherProjection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const exact = Boolean(
    courseId &&
    parameterSetId &&
    roundId &&
    roundNo !== undefined &&
    runId &&
    scenarioPackageId &&
    teamId &&
    token
  );
  const definition = SHANGHAI_C0_MACRO_DEFINITIONS[macroId];

  async function consume(): Promise<void> {
    if (!exact) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/api/v1/bff/teacher/shanghai-c0/conversions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-tenant-id": tenantId
        },
        body: JSON.stringify({
          discriminator: "shanghai_c0_conversion_request",
          macro_id: macroId,
          exact_binding: {
            exact_binding: true,
            tenant_id: tenantId,
            course_id: courseId,
            run_id: runId,
            team_id: teamId,
            round_id: roundId,
            round_no: roundNo,
            scenario_package_id: scenarioPackageId,
            scenario_package_version: scenarioPackageVersion,
            parameter_set_id: parameterSetId,
            parameter_set_version: parameterSetVersion,
            model_version_id: modelVersionId,
            model_version: "1.0.0",
            engine_id: "toy_logit_wellness_v1",
            seed: 42
          },
          experience_profile: "STANDARD",
          experiment: experimentFor(macroId),
          idempotency_key: `teacher-shanghai-c0-${macroId.toLowerCase()}-${runId}-${roundNo}`
        })
      });
      const envelope = (await response.json()) as ApiEnvelope<ShanghaiC0TeacherProjection>;
      if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
      setProjection(envelope.data);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Shanghai C0 消费失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="summary-panel" aria-label="Shanghai C0 conversion Teacher workspace">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">SH-M13-M18 · C0 · Teacher</p>
          <h2>{definition.title}</h2>
          <p className="evidence-note">
            当前产品消费者：{definition.current_surface_refs.join("、")}
          </p>
        </div>
        <strong className="summary-badge">C0</strong>
      </div>
      {!exact ? (
        <p className="lifecycle-status">
          需要 exact course/run/round/team/scenario/parameter 上下文
        </p>
      ) : null}
      {exact ? (
        <button className="primary" disabled={busy} onClick={() => void consume()}>
          {busy ? "读取中…" : "加载当前 C0 消费证据"}
        </button>
      ) : null}
      {error ? (
        <p className="summary-error" role="alert">
          {error}
        </p>
      ) : null}
      {projection ? (
        <>
          <div className="summary-grid">
            <article>
              <span>消费状态</span>
              <strong>{projection.receipt.consumer_status}</strong>
            </article>
            <article>
              <span>State A → B</span>
              <strong>
                {projection.receipt.state_a} → {projection.receipt.state_b}
              </strong>
            </article>
            <article>
              <span>精确绑定</span>
              <strong>{projection.receipt.exact_binding_digest.slice(0, 12)}</strong>
            </article>
            <article>
              <span>官方写入</span>
              <strong>{projection.receipt.official_truth_write ? "禁止" : "未写入"}</strong>
            </article>
          </div>
          <p className="lifecycle-boundary">
            {definition.teacher_action} 当前输出消费候选支持，不改变正式真值。
          </p>
          <details open>
            <summary>证据与资格状态</summary>
            <ul>
              {projection.evidence.map((item) => (
                <li key={item.evidence_id}>
                  {item.label} · {item.status} · {item.confidence}
                </li>
              ))}
            </ul>
          </details>
          <details>
            <summary>已知限制</summary>
            <ul>
              {projection.known_limits.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
    </section>
  );
}

export default ShanghaiC0ConversionWorkspace;
