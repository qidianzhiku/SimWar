import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ApiEnvelope,
  OperatingWorldPreviewReceipt,
  OperatingWorldTeacherProjection
} from "@simwar/shared-contracts";
import { createDefaultOperatingWorldFamilies } from "@simwar/shared-contracts";

interface Props {
  apiBase: string;
  courseId?: string | null | undefined;
  roundNo?: number | undefined;
  runId?: string | null | undefined;
  tenantId: string;
  token: string;
}

async function request<T>(
  apiBase: string,
  path: string,
  token: string,
  tenantId: string,
  method = "GET",
  body?: unknown
): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-tenant-id": tenantId
    },
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
  return envelope.data;
}

export function OperatingWorldStudio({
  apiBase,
  courseId,
  roundNo,
  runId,
  tenantId,
  token
}: Props) {
  const [projection, setProjection] = useState<OperatingWorldTeacherProjection | null>(null);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [preview, setPreview] = useState<OperatingWorldPreviewReceipt | null>(null);
  const [notice, setNotice] = useState("等待 Operating World 上下文");
  const [busy, setBusy] = useState(false);
  const draft = useMemo(
    () => projection?.drafts.find((item) => item.draft_id === selectedDraftId) ?? null,
    [projection, selectedDraftId]
  );

  const refresh = useCallback(async () => {
    if (!courseId || !token) return;
    try {
      const next = await request<OperatingWorldTeacherProjection>(
        apiBase,
        `/api/v1/bff/teacher/operating-world/studio?courseId=${encodeURIComponent(courseId)}`,
        token,
        tenantId
      );
      setProjection(next);
      setSelectedDraftId((current) =>
        current && next.drafts.some((item) => item.draft_id === current)
          ? current
          : (next.drafts.at(-1)?.draft_id ?? null)
      );
      setNotice(next.drafts.length ? "Operating World Studio 已加载" : "尚未创建 SH-16~19 草稿");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Operating World 加载失败");
    }
  }, [apiBase, courseId, tenantId, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function act(action: "create" | "validate" | "preview" | "freeze" | "bind") {
    if (!courseId) return;
    setBusy(true);
    try {
      if (action === "create") {
        const created = await request<{ draft: { draft_id: string } }>(
          apiBase,
          "/api/v1/bff/teacher/operating-world/drafts",
          token,
          tenantId,
          "POST",
          {
            course_id: courseId,
            families: createDefaultOperatingWorldFamilies(),
            title: "上海 SH-16~19 Operating World"
          }
        );
        setSelectedDraftId(created.draft.draft_id);
      } else if (draft) {
        const query = `?courseId=${encodeURIComponent(courseId)}`;
        const body =
          action === "preview"
            ? { variant: "BASE" }
            : action === "bind"
              ? { run_id: runId, round_no: roundNo }
              : undefined;
        const result = await request<{ receipt?: OperatingWorldPreviewReceipt }>(
          apiBase,
          `/api/v1/bff/teacher/operating-world/drafts/${draft.draft_id}/${action}${query}`,
          token,
          tenantId,
          "POST",
          body
        );
        if (result.receipt) setPreview(result.receipt);
      }
      setNotice(`${action} 已完成`);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Operating World 操作失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="operating-world-studio" aria-label="SH-M3 Operating World Studio">
      <header className="w5-studio-header">
        <div>
          <p className="eyebrow">SH-M3 · Operating World</p>
          <h2>上海运营世界：SH-16~19</h2>
          <p className="evidence-note">
            Teacher 配置、验证、预览、冻结与精确绑定；Preview 永不写正式真值。
          </p>
        </div>
        <span className="w5-status-tag">{notice}</span>
      </header>
      <div className="w5-studio-actions">
        <button disabled={busy || !courseId} onClick={() => void act("create")}>
          创建 Operating World 草稿
        </button>
        <button
          disabled={busy || !draft || draft.status !== "DRAFT"}
          onClick={() => void act("validate")}
        >
          Validate
        </button>
        <button
          disabled={busy || !draft || draft.status !== "VALIDATED"}
          onClick={() => void act("preview")}
        >
          BASE Preview
        </button>
        <button
          disabled={busy || !draft || draft.status !== "VALIDATED"}
          onClick={() => void act("freeze")}
        >
          Freeze
        </button>
        <button
          disabled={busy || !draft || draft.status !== "FROZEN" || !runId || roundNo === undefined}
          onClick={() => void act("bind")}
        >
          精确 Bind
        </button>
      </div>
      <div className="w5-studio-meta">
        <span>Draft: {draft?.draft_id ?? "未选择"}</span>
        <span>Status: {draft?.status ?? "IDLE"}</span>
        <span>
          Run/Round: {runId ?? "-"}/{roundNo ?? "-"}
        </span>
      </div>
      {draft ? (
        <div className="w5-parameter-grid" aria-label="Operating World provenance">
          {Object.entries(draft.families).map(([family, value]) => (
            <article className="w5-parameter-card" key={family}>
              <strong>{family}</strong>
              <span>
                {value.info.source_category} · freshness={value.info.freshness} · confidence=
                {value.info.confidence}
              </span>
              <small>Known Limits: {value.info.known_limits.join(" · ")}</small>
            </article>
          ))}
        </div>
      ) : null}
      {projection ? (
        <label className="w5-draft-select">
          当前草稿
          <select
            value={selectedDraftId ?? ""}
            onChange={(event) => setSelectedDraftId(event.target.value || null)}
          >
            <option value="">请选择</option>
            {projection.drafts.map((item) => (
              <option key={item.draft_id} value={item.draft_id}>
                {item.title} · {item.status}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {preview ? (
        <article className="w5-convergence-panel" aria-label="Operating World Preview Receipt">
          <h3>PreviewReceipt · {preview.scenario_variant}</h3>
          <p>
            effect={preview.effect_class} · no_official_write={String(preview.no_official_write)}
          </p>
          <p>digest={preview.preview_digest}</p>
          <p>Known Limits: {preview.known_limits.join(" · ")}</p>
        </article>
      ) : null}
    </section>
  );
}
