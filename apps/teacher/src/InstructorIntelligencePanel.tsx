import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ApiEnvelope,
  InstructorAssetDTO,
  InstructorDebriefArtifactDTO,
  InstructorIntelligenceKitDTO
} from "@simwar/shared-contracts";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

function safeInstructorDebriefFilenamePart(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || "unknown";
}

interface InstructorIntelligencePanelProps {
  courseId: string | undefined;
  createButtonLabel?: string | undefined;
  disabled: boolean;
  roundNo: number | undefined;
  runId: string | undefined;
  tenantId: string;
  token: string | undefined;
}

async function request<T>(
  path: string,
  props: Pick<InstructorIntelligencePanelProps, "tenantId" | "token">,
  options: { body?: unknown; method?: "GET" | "POST"; signal?: AbortSignal } = {}
): Promise<T> {
  const init: RequestInit = {
    headers: {
      "content-type": "application/json",
      "x-tenant-id": props.tenantId,
      ...(props.token ? { authorization: `Bearer ${props.token}` } : {})
    },
    method: options.method ?? "GET"
  };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  const response = await fetch(
    `${API_BASE}${path}`,
    options.signal ? { ...init, signal: options.signal } : init
  );
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
  return envelope.data;
}

export function isCurrentInstructorAssetRequest(
  requestCourseId: string,
  requestSequence: number,
  currentCourseId: string | undefined,
  latestRequestSequence: number
): boolean {
  return requestCourseId === currentCourseId && requestSequence === latestRequestSequence;
}

interface InstructorIntelligenceScope {
  readonly assetId: string;
  readonly courseId: string | undefined;
  readonly roundNo: number | undefined;
  readonly runId: string | undefined;
}

export function isCurrentInstructorScopeRequest(
  requestScope: InstructorIntelligenceScope,
  requestSequence: number,
  currentScope: InstructorIntelligenceScope,
  latestRequestSequence: number
): boolean {
  return (
    requestSequence === latestRequestSequence &&
    requestScope.assetId === currentScope.assetId &&
    requestScope.courseId === currentScope.courseId &&
    requestScope.roundNo === currentScope.roundNo &&
    requestScope.runId === currentScope.runId
  );
}

export function isCurrentInstructorActionRequest(
  requestScope: InstructorIntelligenceScope,
  requestSequence: number,
  currentScope: InstructorIntelligenceScope,
  latestRequestSequence: number
): boolean {
  return isCurrentInstructorScopeRequest(
    requestScope,
    requestSequence,
    currentScope,
    latestRequestSequence
  );
}

export function InstructorIntelligencePanel(props: InstructorIntelligencePanelProps) {
  const [assets, setAssets] = useState<InstructorAssetDTO[]>([]);
  const [assetId, setAssetId] = useState("");
  const [artifact, setArtifact] = useState<InstructorDebriefArtifactDTO | null>(null);
  const [kit, setKit] = useState<InstructorIntelligenceKitDTO | null>(null);
  const [notice, setNotice] = useState("等待课程与 Run");
  const [title, setTitle] = useState("本回合教学复盘");
  const [busy, setBusy] = useState(false);
  const actionRequestSequence = useRef(0);
  const assetRequestSequence = useRef(0);
  const kitRequestSequence = useRef(0);
  const kitRequestController = useRef<AbortController | null>(null);
  const currentCourseId = useRef(props.courseId);
  currentCourseId.current = props.courseId;
  const currentScope = useRef<InstructorIntelligenceScope>({
    assetId,
    courseId: props.courseId,
    roundNo: props.roundNo,
    runId: props.runId
  });
  currentScope.current = {
    assetId,
    courseId: props.courseId,
    roundNo: props.roundNo,
    runId: props.runId
  };
  const scopeReady = Boolean(props.courseId && props.runId && props.roundNo && props.token);
  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.asset_id === assetId) ?? null,
    [assetId, assets]
  );

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!props.token || !props.courseId) {
        assetRequestSequence.current += 1;
        setAssets([]);
        setAssetId("");
        return;
      }
      const requestCourseId = props.courseId;
      const requestSequence = assetRequestSequence.current + 1;
      assetRequestSequence.current = requestSequence;
      const next = await request<InstructorAssetDTO[]>(
        `/api/v1/bff/teacher/instructor-assets?${new URLSearchParams({ course_id: props.courseId })}`,
        props,
        signal ? { signal } : {}
      );
      if (
        signal?.aborted ||
        !isCurrentInstructorAssetRequest(
          requestCourseId,
          requestSequence,
          currentCourseId.current,
          assetRequestSequence.current
        )
      ) {
        return;
      }
      setAssets(next);
      setAssetId((current) =>
        next.some((asset) => asset.asset_id === current) ? current : (next.at(-1)?.asset_id ?? "")
      );
    },
    [props.courseId, props.tenantId, props.token]
  );

  useEffect(() => {
    const controller = new AbortController();
    setAssets([]);
    setAssetId("");
    void refresh(controller.signal).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setNotice(error instanceof Error ? error.message : "无法读取教学复盘资产");
    });
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    actionRequestSequence.current += 1;
    kitRequestSequence.current += 1;
    kitRequestController.current?.abort();
    kitRequestController.current = null;
    setArtifact(null);
    setKit(null);
  }, [assetId, props.courseId, props.runId, props.roundNo]);

  async function createDraft(): Promise<void> {
    if (!props.courseId) return;
    const requestScope = currentScope.current;
    const requestSequence = actionRequestSequence.current;
    setBusy(true);
    try {
      const created = await request<InstructorAssetDTO>(
        "/api/v1/bff/teacher/instructor-assets/drafts",
        props,
        {
          body: { course_id: props.courseId, title },
          method: "POST"
        }
      );
      if (
        !isCurrentInstructorActionRequest(
          requestScope,
          requestSequence,
          currentScope.current,
          actionRequestSequence.current
        )
      ) {
        return;
      }
      setAssets((current) => [...current, created]);
      setAssetId(created.asset_id);
      setNotice("草稿已创建；需显式发布后才能用于教学复盘");
    } catch (error) {
      if (
        isCurrentInstructorActionRequest(
          requestScope,
          requestSequence,
          currentScope.current,
          actionRequestSequence.current
        )
      ) {
        setNotice(error instanceof Error ? error.message : "创建草稿失败");
      }
    } finally {
      setBusy(false);
    }
  }

  async function publish(): Promise<void> {
    if (!selectedAsset) return;
    const requestScope = currentScope.current;
    const requestSequence = actionRequestSequence.current;
    setBusy(true);
    try {
      const published = await request<InstructorAssetDTO>(
        `/api/v1/bff/teacher/instructor-assets/${encodeURIComponent(selectedAsset.asset_id)}/publish`,
        props,
        { body: {}, method: "POST" }
      );
      if (
        !isCurrentInstructorActionRequest(
          requestScope,
          requestSequence,
          currentScope.current,
          actionRequestSequence.current
        )
      ) {
        return;
      }
      setAssets((current) =>
        current.map((asset) => (asset.asset_id === published.asset_id ? published : asset))
      );
      setNotice("教学复盘资产已发布");
    } catch (error) {
      if (
        isCurrentInstructorActionRequest(
          requestScope,
          requestSequence,
          currentScope.current,
          actionRequestSequence.current
        )
      ) {
        setNotice(error instanceof Error ? error.message : "发布失败");
      }
    } finally {
      setBusy(false);
    }
  }

  async function reject(): Promise<void> {
    if (!selectedAsset) return;
    const requestScope = currentScope.current;
    const requestSequence = actionRequestSequence.current;
    setBusy(true);
    try {
      const rejected = await request<InstructorAssetDTO>(
        `/api/v1/bff/teacher/instructor-assets/${encodeURIComponent(selectedAsset.asset_id)}/reject`,
        props,
        { body: {}, method: "POST" }
      );
      if (
        !isCurrentInstructorActionRequest(
          requestScope,
          requestSequence,
          currentScope.current,
          actionRequestSequence.current
        )
      ) {
        return;
      }
      setAssets((current) =>
        current.map((asset) => (asset.asset_id === rejected.asset_id ? rejected : asset))
      );
      setNotice("教学复盘草稿已拒绝；终态不可原地修改");
    } catch (error) {
      if (
        isCurrentInstructorActionRequest(
          requestScope,
          requestSequence,
          currentScope.current,
          actionRequestSequence.current
        )
      ) {
        setNotice(error instanceof Error ? error.message : "拒绝失败");
      }
    } finally {
      setBusy(false);
    }
  }

  async function createRevision(): Promise<void> {
    if (!selectedAsset) return;
    const requestScope = currentScope.current;
    const requestSequence = actionRequestSequence.current;
    setBusy(true);
    try {
      const revision = await request<InstructorAssetDTO>(
        `/api/v1/bff/teacher/instructor-assets/${encodeURIComponent(selectedAsset.asset_id)}/revisions`,
        props,
        { body: { title }, method: "POST" }
      );
      if (
        !isCurrentInstructorActionRequest(
          requestScope,
          requestSequence,
          currentScope.current,
          actionRequestSequence.current
        )
      ) {
        return;
      }
      setAssets((current) => [...current, revision]);
      setAssetId(revision.asset_id);
      setNotice("已创建独立修订草稿");
    } catch (error) {
      if (
        isCurrentInstructorActionRequest(
          requestScope,
          requestSequence,
          currentScope.current,
          actionRequestSequence.current
        )
      ) {
        setNotice(error instanceof Error ? error.message : "创建修订失败");
      }
    } finally {
      setBusy(false);
    }
  }

  async function loadKit(): Promise<void> {
    if (!selectedAsset || !props.runId || !props.roundNo) return;
    kitRequestController.current?.abort();
    const controller = new AbortController();
    const requestScope = currentScope.current;
    const requestSequence = kitRequestSequence.current + 1;
    kitRequestSequence.current = requestSequence;
    kitRequestController.current = controller;
    setBusy(true);
    try {
      const query = new URLSearchParams({
        asset_id: selectedAsset.asset_id,
        round_no: String(props.roundNo),
        run_id: props.runId
      });
      const nextArtifact = await request<InstructorDebriefArtifactDTO>(
        `/api/v1/bff/teacher/instructor-debrief-artifact?${query}`,
        props,
        { signal: controller.signal }
      );
      if (
        controller.signal.aborted ||
        !isCurrentInstructorScopeRequest(
          requestScope,
          requestSequence,
          currentScope.current,
          kitRequestSequence.current
        )
      ) {
        return;
      }
      setArtifact(nextArtifact);
      setKit(nextArtifact.kit);
      setNotice("已生成确定性教学复盘 artifact；未调用 AI");
    } catch (error) {
      if (
        !controller.signal.aborted &&
        isCurrentInstructorScopeRequest(
          requestScope,
          requestSequence,
          currentScope.current,
          kitRequestSequence.current
        )
      ) {
        setNotice(error instanceof Error ? error.message : "教学复盘包不可用");
      }
    } finally {
      if (
        isCurrentInstructorScopeRequest(
          requestScope,
          requestSequence,
          currentScope.current,
          kitRequestSequence.current
        )
      ) {
        setBusy(false);
      }
    }
  }

  async function downloadArtifact(format: "json" | "markdown"): Promise<void> {
    if (!selectedAsset || !props.runId || !props.roundNo) return;
    const requestScope = currentScope.current;
    const requestSequence = kitRequestSequence.current;
    setBusy(true);
    try {
      const query = new URLSearchParams({
        asset_id: selectedAsset.asset_id,
        format,
        round_no: String(props.roundNo),
        run_id: props.runId
      });
      const response = await fetch(
        `${API_BASE}/api/v1/bff/teacher/instructor-debrief-artifact/export?${query}`,
        {
          headers: {
            "x-tenant-id": props.tenantId,
            ...(props.token ? { authorization: `Bearer ${props.token}` } : {})
          }
        }
      );
      if (!response.ok) throw new Error(`INSTRUCTOR_DEBRIEF_EXPORT_${response.status}`);
      const blob = await response.blob();
      if (
        !isCurrentInstructorScopeRequest(
          requestScope,
          requestSequence,
          currentScope.current,
          kitRequestSequence.current
        )
      ) {
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        "simwar-instructor-debrief-" +
          safeInstructorDebriefFilenamePart(props.runId) +
          "-r" +
          props.roundNo +
          "-" +
          (artifact?.artifact_digest.slice(0, 8) ?? "unknown") +
          (format === "json" ? ".json" : ".md");
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice(`${format === "json" ? "JSON" : "Markdown"} artifact 已下载`);
    } catch (error) {
      if (
        isCurrentInstructorScopeRequest(
          requestScope,
          requestSequence,
          currentScope.current,
          kitRequestSequence.current
        )
      ) {
        setNotice(error instanceof Error ? error.message : "artifact 下载失败");
      }
    } finally {
      if (
        isCurrentInstructorScopeRequest(
          requestScope,
          requestSequence,
          currentScope.current,
          kitRequestSequence.current
        )
      ) {
        setBusy(false);
      }
    }
  }

  return (
    <section className="candidate-surface studio-surface" aria-label="Instructor intelligence">
      <div className="candidate-heading">
        <div>
          <p className="eyebrow">C4 Instructor Intelligence</p>
          <h2>教师教学复盘包</h2>
        </div>
        <span>{notice}</span>
      </div>
      {!scopeReady ? (
        <p className="muted">选择已绑定 Course 的 Run 后，可创建并发布教学复盘资产。</p>
      ) : (
        <>
          <div className="studio-form">
            <label className="field-label">
              <span>复盘标题</span>
              <input
                aria-label="教学复盘标题"
                disabled={busy || props.disabled}
                onChange={(event) => setTitle(event.target.value)}
                value={title}
              />
            </label>
            <div className="studio-actions">
              <button
                disabled={busy || props.disabled || !title.trim()}
                onClick={() => void createDraft()}
              >
                {props.createButtonLabel ?? "创建草稿"}
              </button>
            </div>
          </div>
          <label className="field-label">
            <span>教学资产</span>
            <select
              aria-label="教学复盘资产"
              disabled={busy || props.disabled || assets.length === 0}
              onChange={(event) => setAssetId(event.target.value)}
              value={assetId}
            >
              {assets.map((asset) => (
                <option key={asset.asset_id} value={asset.asset_id}>
                  {asset.title} · {asset.status}
                </option>
              ))}
            </select>
          </label>
          <div className="studio-actions">
            <button
              disabled={busy || props.disabled || selectedAsset?.status !== "draft"}
              onClick={() => void publish()}
            >
              发布教学资产
            </button>
            <button
              className="secondary"
              disabled={busy || props.disabled || selectedAsset?.status !== "draft"}
              onClick={() => void reject()}
            >
              拒绝草稿
            </button>
            <button
              className="secondary"
              disabled={
                busy ||
                props.disabled ||
                !selectedAsset ||
                selectedAsset.status === "draft" ||
                !title.trim()
              }
              onClick={() => void createRevision()}
            >
              创建修订草稿
            </button>
            <button
              className="secondary"
              disabled={busy || props.disabled || selectedAsset?.status !== "teacher_published"}
              onClick={() => void loadKit()}
            >
              读取复盘包
            </button>
          </div>
          {kit ? (
            <div className="studio-receipt" aria-label="确定性教学复盘包">
              {artifact ? (
                <>
                  <strong>Artifact digest: {artifact.artifact_digest}</strong>
                  <span>
                    官方结果：{artifact.source_binding.settlement_result_id} · Replay：
                    {artifact.source_binding.replay_hash}
                  </span>
                  <span>
                    基线：
                    {artifact.source_binding.baseline.status === "available"
                      ? artifact.source_binding.baseline.settlement_result_id
                      : artifact.source_binding.baseline.reason}
                  </span>
                  <div className="studio-actions">
                    <button
                      className="secondary"
                      disabled={busy || props.disabled}
                      onClick={() => void downloadArtifact("json")}
                    >
                      下载 JSON
                    </button>
                    <button
                      className="secondary"
                      disabled={busy || props.disabled}
                      onClick={() => void downloadArtifact("markdown")}
                    >
                      下载 Markdown
                    </button>
                  </div>
                </>
              ) : null}
              <strong>
                AI: {kit.ai_status} · 异常状态: {kit.anomaly_status}
              </strong>
              <span>讨论要点：{kit.discussion_points.join("；")}</span>
              <span>
                差异：
                {kit.result_delta.baseline_round_no
                  ? `相对第 ${kit.result_delta.baseline_round_no} 回合，平均评分变化 ${kit.result_delta.average_score_delta ?? 0}，名次变化 ${kit.result_delta.rank_change_count ?? 0} 队`
                  : "暂无可比较的已发布前序结果"}
              </span>
              <span>追问：{kit.follow_up_questions.join("；")}</span>
              <span>议程：{kit.debrief_agenda.join(" → ")}</span>
              <span>时间建议：{kit.time_guidance}</span>
              <span>
                证据引用：
                {kit.causal_evidence_refs
                  .map((reference) => `${reference.resource_id}@${reference.version}`)
                  .join("；")}
              </span>
              <span>已知限制：{kit.known_limits.join("；")}</span>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
