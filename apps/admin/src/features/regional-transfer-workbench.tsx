import { useState } from "react";
import { WorkbenchFrame } from "@simwar/ui";
import type { RegionalTransferAdminProjection } from "@simwar/shared-contracts";
import { loadRegionalTransferAdminProjection } from "./regional-transfer-client";

export function RegionalTransferAdminWorkbench({
  apiBase,
  tenantId,
  token
}: {
  apiBase: string;
  tenantId: string;
  token: string;
}) {
  const [candidateId, setCandidateId] = useState("");
  const [projection, setProjection] = useState<RegionalTransferAdminProjection | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    setError("");
    try {
      setProjection(await loadRegionalTransferAdminProjection(apiBase, token, candidateId.trim()));
    } catch (cause) {
      setProjection(null);
      setError(cause instanceof Error ? cause.message : "regional transfer audit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <WorkbenchFrame
      className="candidate-surface regional-transfer-admin-workbench"
      ariaLabel="Admin regional transfer audit"
      eyebrow="MAIN · RT-O1"
      title="区域迁移治理审计"
      badge="tenant-safe"
      boundary="仅读取本租户已发布或冻结的 RT-O1 candidate；显示精确 provenance、生命周期、rollback dry-run 与已知限制，不执行 rollback、merge、发布或 truth 写入。"
      headingClassName="panel-title"
    >
      <label>
        Candidate ID
        <input value={candidateId} onChange={(event) => setCandidateId(event.target.value)} />
      </label>
      <button disabled={busy || !candidateId.trim()} onClick={() => void load()}>
        读取审计投影
      </button>
      {error ? (
        <p className="d6-error" role="alert">
          {error}
        </p>
      ) : null}
      {projection ? (
        <div className="d6-receipt" aria-live="polite">
          <strong>{projection.candidate.lifecycle}</strong>
          <span>
            {projection.audit.candidate_id} · {projection.audit.lifecycle.join(" → ")}
          </span>
          <span>
            tenant={tenantId} · rollback={projection.rollback.resolution}
          </span>
          <code>{projection.candidate.candidate_ref.content_digest}</code>
          <strong>模型迁移资格：{projection.candidate.requalification.status}</strong>
          <span>
            ModelVersion：{projection.candidate.requalification.model_version_comparison.status} ·{" "}
            {projection.candidate.requalification.model_version_comparison.target_model_version_ref}
          </span>
          <span>
            baseline {projection.candidate.requalification.baseline.region} ·{" "}
            {projection.candidate.requalification.baseline.source.evidence_status} ·{" "}
            {projection.candidate.requalification.baseline.source.freshness_status}
          </span>
          <span>
            target {projection.candidate.requalification.target.region} ·{" "}
            {projection.candidate.requalification.target.source.evidence_status} ·{" "}
            {projection.candidate.requalification.target.source.rights_status}
          </span>
          <span>Reality Gap/OOD：NOT_PROVEN · transfer=CANDIDATE_ONLY</span>
          <span>reasons={projection.candidate.requalification.reason_codes.join("|")}</span>
          {projection.candidate.known_limits.map((limit) => (
            <span key={limit}>{limit}</span>
          ))}
        </div>
      ) : null}
    </WorkbenchFrame>
  );
}
