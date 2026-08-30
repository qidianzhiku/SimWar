import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiEnvelope, ModelQualificationTeacherProjection } from "@simwar/shared-contracts";

interface Props {
  apiBase: string;
  courseId?: string | null;
  tenantId: string;
  token: string;
}

async function request<T>(
  apiBase: string,
  tenantId: string,
  token: string,
  path: string,
  method = "GET",
  body?: unknown
): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-tenant-id": tenantId
    },
    method
  });
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
  return envelope.data;
}

export function ModelQualificationWorkbench({ apiBase, courseId, tenantId, token }: Props) {
  const [projection, setProjection] = useState<ModelQualificationTeacherProjection | null>(null);
  const [notice, setNotice] = useState("等待模型资格治理上下文");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!courseId || !token) {
      setProjection(null);
      setNotice("选择课程并登录后加载来源资格治理");
      return;
    }
    try {
      const next = await request<ModelQualificationTeacherProjection>(
        apiBase,
        tenantId,
        token,
        `/api/v1/bff/teacher/model-qualification?courseId=${encodeURIComponent(courseId)}`
      );
      setProjection(next);
      setNotice("来源资格治理工作台已加载");
    } catch (error) {
      setProjection(null);
      setNotice(error instanceof Error ? error.message : "来源资格治理加载失败");
    }
  }, [apiBase, courseId, tenantId, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const source = projection?.source_packages.at(-1);
  const dataset = projection?.calibration_datasets.at(-1);
  const qualification = projection?.qualifications.at(-1);
  const model = useMemo(() => projection?.model_catalog[0], [projection]);

  async function mutate(path: string, body?: unknown) {
    if (!courseId || busy) return;
    setBusy(true);
    try {
      await request(apiBase, tenantId, token, path, "POST", body);
      await refresh();
      setNotice("操作已完成，投影已按服务端状态刷新");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "治理操作失败");
    } finally {
      setBusy(false);
    }
  }

  const digestA = "a".repeat(64);
  const digestB = "b".repeat(64);
  const digestC = "c".repeat(64);

  return (
    <section className="summary-panel" aria-label="source-backed model qualification workbench">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">R2 · offline qualification governance</p>
          <h2>来源证据与模型资格治理</h2>
        </div>
        <strong className="summary-badge">{courseId ?? "未选择课程"}</strong>
      </div>
      <p className="evidence-note">
        先登记可追溯来源，再建立无 holdout
        泄漏的数据集，最后运行确定性资格检查并显式复核；该平面只产生候选治理证据，不写入官方
        REALIZED。
      </p>
      <p className="lifecycle-status" role="status">
        {notice}
      </p>
      {projection ? (
        <>
          <div className="summary-grid">
            <article>
              <span>ModelVersion</span>
              <strong>
                {model?.model_version_reference.model_version_id}@
                {model?.model_version_reference.version}
              </strong>
            </article>
            <article>
              <span>来源包</span>
              <strong>{source?.source_package_id ?? "未登记"}</strong>
            </article>
            <article>
              <span>数据集</span>
              <strong>{dataset?.status ?? "未创建"}</strong>
            </article>
            <article>
              <span>资格</span>
              <strong>{qualification?.decision ?? "未运行"}</strong>
            </article>
          </div>
          <div className="workspace-actions">
            <button
              type="button"
              disabled={busy || Boolean(source)}
              onClick={() =>
                void mutate("/api/v1/bff/teacher/model-qualification/source-packages", {
                  content_digest: digestA,
                  course_id: courseId,
                  evidence_refs: ["fixture:generic-source:1"],
                  feature_schema_digest: digestB,
                  freshness_status: "FRESH",
                  observed_at: "2026-08-30T12:00:00.000Z",
                  quality: { conflict_count: 0, missingness_rate: 0.02, record_count: 4 },
                  rights_status: "VALID",
                  source_ref: "fixture://generic-source",
                  source_version: "1.0.0",
                  title: "Generic source-backed demand fixture"
                })
              }
            >
              {source ? "来源已登记" : "登记来源与证据"}
            </button>
            <button
              type="button"
              disabled={busy || !source || Boolean(dataset)}
              onClick={() =>
                void mutate("/api/v1/bff/teacher/model-qualification/datasets", {
                  calibration_record_ids: ["cal-1", "cal-2"],
                  content_digest: digestC,
                  course_id: courseId,
                  holdout_record_ids: ["holdout-1", "holdout-2"],
                  source_package_id: source?.source_package_id
                })
              }
            >
              {dataset ? "数据集已创建" : "创建 Calibration / Holdout"}
            </button>
            <button
              type="button"
              disabled={busy || !dataset || Boolean(qualification)}
              onClick={() =>
                void mutate("/api/v1/bff/teacher/model-qualification/qualifications", {
                  calibration_dataset_id: dataset?.calibration_dataset_id,
                  course_id: courseId,
                  deterministic_seed: 42,
                  model_version_reference: model?.model_version_reference,
                  source_package_id: source?.source_package_id
                })
              }
            >
              {qualification ? "资格已运行" : "运行确定性资格检查"}
            </button>
            <button
              type="button"
              disabled={
                busy ||
                qualification?.decision !== "APPROVED" ||
                qualification.review.status !== "PENDING"
              }
              onClick={() =>
                void mutate(
                  `/api/v1/bff/teacher/model-qualification/qualifications/${qualification?.qualification_id}/review?courseId=${encodeURIComponent(courseId ?? "")}`,
                  { decision: "APPROVED", note: "Reviewed against the exact offline fixture." }
                )
              }
            >
              {qualification?.review.status === "APPROVED" ? "已复核" : "批准资格候选"}
            </button>
            <button
              type="button"
              disabled={
                busy ||
                qualification?.review.status !== "APPROVED" ||
                qualification.binding.status === "BOUND"
              }
              onClick={() =>
                void mutate(
                  `/api/v1/bff/teacher/model-qualification/qualifications/${qualification?.qualification_id}/bind?courseId=${encodeURIComponent(courseId ?? "")}`
                )
              }
            >
              {qualification?.binding.status === "BOUND" ? "已绑定课程" : "绑定到课程治理"}
            </button>
          </div>
          {qualification ? (
            <details open>
              <summary>资格诊断与限制</summary>
              <p>
                decision={qualification.decision} · review={qualification.review.status} · binding=
                {qualification.binding.status}
              </p>
              <p>
                drift={qualification.diagnostics.drift_score} · OOD=
                {qualification.diagnostics.ood_rate} · sensitivity=
                {qualification.diagnostics.sensitivity_max_delta}
              </p>
              <ul>
                {qualification.reasons.length ? (
                  qualification.reasons.map((reason) => <li key={reason}>{reason}</li>)
                ) : (
                  <li>所有已配置离线资格阈值通过</li>
                )}
              </ul>
              <p className="evidence-note">{qualification.known_limits.join(" · ")}</p>
            </details>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export default ModelQualificationWorkbench;
