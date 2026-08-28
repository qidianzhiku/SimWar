import { useEffect, useRef, useState } from "react";
import type { ApiEnvelope, ShanghaiFullVerticalTeacherProjection } from "@simwar/shared-contracts";

interface Props {
  apiBase: string;
  courseId?: string | null | undefined;
  draftId?: string | null | undefined;
  roundNo?: number | undefined;
  runId?: string | null | undefined;
  tenantId: string;
  token: string;
}

async function load(
  apiBase: string,
  tenantId: string,
  token: string,
  query: string
): Promise<ShanghaiFullVerticalTeacherProjection> {
  const response = await fetch(`${apiBase}/api/v1/bff/teacher/shanghai/full-vertical?${query}`, {
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-tenant-id": tenantId
    }
  });
  const envelope = (await response.json()) as ApiEnvelope<ShanghaiFullVerticalTeacherProjection>;
  if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
  return envelope.data;
}

function readConfiguredDraftId(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("shanghaiDraftId")?.trim();
  return value ? value : null;
}

export function ShanghaiFullVerticalTeacherPanel({
  apiBase,
  courseId,
  draftId,
  roundNo,
  runId,
  tenantId,
  token
}: Props) {
  const [projection, setProjection] = useState<ShanghaiFullVerticalTeacherProjection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(
    () => draftId ?? readConfiguredDraftId()
  );
  const contextRef = useRef<{
    courseId: string | null;
    roundNo: number | null;
    runId: string | null;
    initialized: boolean;
  }>({
    courseId: null,
    roundNo: null,
    runId: null,
    initialized: false
  });

  useEffect(() => {
    if (draftId !== undefined) setSelectedDraftId(draftId);
  }, [draftId]);

  useEffect(() => {
    let active = true;
    if (!courseId || !token) {
      setProjection(null);
      setError(null);
      return () => {
        active = false;
      };
    }
    const previousContext = contextRef.current;
    const contextChanged =
      previousContext.initialized &&
      (previousContext.courseId !== courseId ||
        previousContext.runId !== (runId ?? null) ||
        previousContext.roundNo !== (roundNo ?? null));
    contextRef.current = {
      courseId,
      initialized: true,
      roundNo: roundNo ?? null,
      runId: runId ?? null
    };
    if (contextChanged) {
      setSelectedDraftId(null);
      setProjection(null);
      setError(null);
      return () => {
        active = false;
      };
    }
    const exact = Boolean(selectedDraftId && runId && roundNo !== undefined);
    const params = new URLSearchParams({ courseId });
    if (exact) {
      params.set("draftId", selectedDraftId!);
      params.set("runId", runId!);
      params.set("roundNo", String(roundNo));
    }
    setError(null);
    void load(apiBase, tenantId, token, params.toString())
      .then((data) => {
        if (active) {
          setProjection(data);
          if (!selectedDraftId && runId && roundNo !== undefined) {
            const boundDraft = data.teacher_projection.drafts.find(
              (candidate) =>
                candidate.exact_runtime_binding?.run_id === runId &&
                candidate.exact_runtime_binding?.round_no === roundNo
            );
            if (boundDraft) setSelectedDraftId(boundDraft.draft_id);
          }
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setProjection(null);
          setError(reason instanceof Error ? reason.message : "Teacher projection 加载失败");
        }
      });
    return () => {
      active = false;
    };
  }, [apiBase, courseId, roundNo, runId, selectedDraftId, tenantId, token]);

  return (
    <section className="summary-panel" aria-label="Shanghai full vertical Teacher projection">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">MAIN-SH-FV-O1 · Teacher</p>
          <h2>上海全链路产品旅程</h2>
          <p className="evidence-note">Teacher scenario configuration and preview</p>
        </div>
        <strong className="summary-badge">O1</strong>
      </div>
      {error ? (
        <p className="summary-error" role="alert">
          {error}
        </p>
      ) : null}
      {!projection && !error ? <p className="lifecycle-status">等待 Teacher projection</p> : null}
      {projection ? (
        <>
          <div className="summary-grid">
            <article>
              <span>状态</span>
              <strong>{projection.status}</strong>
            </article>
            <article>
              <span>Exact binding</span>
              <strong>{projection.journey.exact_binding ? "READY" : "BLOCKED"}</strong>
            </article>
            <article>
              <span>Teacher preview</span>
              <strong>{projection.journey.teacher_preview}</strong>
            </article>
            <article>
              <span>Course / Run</span>
              <strong>
                {projection.exact_context.course_id} / {projection.exact_context.run_id ?? "未选择"}
              </strong>
            </article>
          </div>
          {projection.teacher_projection.drafts.length ? (
            <label className="field-label">
              选择已绑定 Scenario draft
              <select
                value={selectedDraftId ?? ""}
                onChange={(event) => setSelectedDraftId(event.target.value || null)}
              >
                <option value="">尚未选择</option>
                {projection.teacher_projection.drafts.map((draft) => (
                  <option key={draft.draft_id} value={draft.draft_id}>
                    {draft.draft_id} · {draft.status}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <p className="lifecycle-boundary">
            当前使用既有 W5 Scenario Studio；WANT/CAN 是候选与约束，REALIZED 仍由 Simulation Core
            负责。
          </p>
          {projection.preview ? (
            <details open>
              <summary>查看受控预览</summary>
              <p className="evidence-note">
                Demand={projection.preview.demand_realization.candidate.status} · CAN=
                {projection.preview.can.eligible ? "eligible" : "blocked"} · REALIZED=
                {projection.preview.realized.authority}
              </p>
            </details>
          ) : null}
          <details>
            <summary>查看已知限制</summary>
            <ul>
              {projection.known_limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
    </section>
  );
}

export default ShanghaiFullVerticalTeacherPanel;
