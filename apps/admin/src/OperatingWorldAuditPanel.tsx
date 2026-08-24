import { useEffect, useState } from "react";
import type { ApiEnvelope, OperatingWorldAdminAudit } from "@simwar/shared-contracts";

interface Props {
  apiBase: string;
  courseId?: string;
  draftId: string;
  runId?: string;
  roundNo?: number;
  tenantId: string;
  token: string;
}

export function OperatingWorldAuditPanel({
  apiBase,
  courseId,
  draftId,
  runId,
  roundNo,
  tenantId,
  token
}: Props) {
  const [audit, setAudit] = useState<OperatingWorldAdminAudit | null>(null);
  const [notice, setNotice] = useState("等待 Operating World 审计上下文");
  useEffect(() => {
    if (!courseId || !draftId || !token) return;
    const query = new URLSearchParams({ courseId, draftId });
    if (runId) query.set("runId", runId);
    if (Number.isSafeInteger(roundNo)) query.set("roundNo", String(roundNo));
    void fetch(
      `${apiBase}/api/v1/bff/admin/operating-world/audit?${query.toString()}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-tenant-id": tenantId
        }
      }
    )
      .then(async (response) => {
        const envelope = (await response.json()) as ApiEnvelope<OperatingWorldAdminAudit>;
        if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
        setAudit(envelope.data);
      })
      .catch((error: unknown) =>
        setNotice(error instanceof Error ? error.message : "Admin 审计加载失败")
      );
  }, [apiBase, courseId, draftId, runId, roundNo, tenantId, token]);
  return (
    <section className="operating-world-audit" aria-label="Admin Operating World audit">
      <p className="eyebrow">SH-M3 · read-only audit</p>
      <h2>Operating World 精确绑定审计</h2>
      {audit ? (
        <>
          <div className="status-grid">
            <article>
              <span>Readiness</span>
              <strong>{audit.readiness}</strong>
            </article>
            <article>
              <span>Effect</span>
              <strong>{audit.effect_class}</strong>
            </article>
            <article>
              <span>Stale/Conflict</span>
              <strong>{String(audit.stale_or_conflict)}</strong>
            </article>
          </div>
          <p>Binding: {audit.binding?.binding_digest ?? "未绑定"}</p>
          {audit.binding ? (
            <p>
              ModelVersion={audit.binding.model_version_ref} · ParameterSet=
              {audit.binding.parameter_set_reference.parameter_set_id}@
              {audit.binding.parameter_set_reference.version} · ScenarioPackage=
              {audit.binding.scenario_package_reference.scenario_package_id}@
              {audit.binding.scenario_package_reference.version}
            </p>
          ) : null}
          <p>
            Freshness:{" "}
            {Object.entries(audit.freshness)
              .map(([family, freshness]) => `${family}=${freshness}`)
              .join(" · ")}
          </p>
          <p className="evidence-note">Known Limits: {audit.known_limits.join(" · ")}</p>
          {audit.w4_replay ? (
            <p data-testid="operating-world-w4-replay-audit" className="evidence-note">
              W4 Replay：{audit.w4_replay.status} · Manifest=
              {audit.w4_replay.manifest_id ?? "未确认"} · Outcome=
              {audit.w4_replay.official_outcome_id ?? "未确认"} · Settlement digest=
              {audit.w4_replay.settlement_digest ?? "未确认"}
            </p>
          ) : null}
        </>
      ) : (
        <p className="evidence-note">{notice}</p>
      )}
    </section>
  );
}
