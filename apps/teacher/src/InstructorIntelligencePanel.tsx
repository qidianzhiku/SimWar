import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiEnvelope } from "@simwar/shared-contracts";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

type InstructorAssetStatus = "draft" | "teacher_published" | "rejected";

interface InstructorAsset {
  asset_id: string;
  course_id: string;
  course_blueprint_ref: {
    content_digest: string;
    resource_id: string;
    version: string;
  };
  status: InstructorAssetStatus;
  title: string;
}

interface ExactReference {
  content_digest: string;
  resource_id: string;
  resource_type: string;
  tenant_id: string;
  version: string;
}

interface InstructorIntelligenceKit {
  ai_status: "off";
  anomaly_status:
    | "baseline_unavailable"
    | "result_pending"
    | "no_material_delta"
    | "material_delta";
  causal_evidence_refs: readonly ExactReference[];
  debrief_agenda: readonly string[];
  discussion_points: readonly string[];
  follow_up_questions: readonly string[];
  known_limits: readonly string[];
  result_delta: {
    average_score_delta?: number;
    baseline_round_no?: number;
    rank_change_count?: number;
  };
  time_guidance: string;
}

interface InstructorIntelligencePanelProps {
  courseId: string | undefined;
  disabled: boolean;
  roundNo: number | undefined;
  runId: string | undefined;
  tenantId: string;
  token: string | undefined;
}

async function request<T>(
  path: string,
  props: Pick<InstructorIntelligencePanelProps, "tenantId" | "token">,
  options: { body?: unknown; method?: "GET" | "POST" } = {}
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
  const response = await fetch(`${API_BASE}${path}`, init);
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
  return envelope.data;
}

export function InstructorIntelligencePanel(props: InstructorIntelligencePanelProps) {
  const [assets, setAssets] = useState<InstructorAsset[]>([]);
  const [assetId, setAssetId] = useState("");
  const [kit, setKit] = useState<InstructorIntelligenceKit | null>(null);
  const [notice, setNotice] = useState("等待课程与 Run");
  const [title, setTitle] = useState("本回合教学复盘");
  const [busy, setBusy] = useState(false);
  const scopeReady = Boolean(props.courseId && props.runId && props.roundNo && props.token);
  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.asset_id === assetId) ?? null,
    [assetId, assets]
  );

  const refresh = useCallback(async () => {
    if (!props.token || !props.courseId) {
      setAssets([]);
      setAssetId("");
      return;
    }
    const next = await request<InstructorAsset[]>(
      `/api/v1/bff/teacher/instructor-assets?${new URLSearchParams({ course_id: props.courseId })}`,
      props
    );
    setAssets(next);
    setAssetId((current) =>
      next.some((asset) => asset.asset_id === current) ? current : (next.at(-1)?.asset_id ?? "")
    );
  }, [props.courseId, props.tenantId, props.token]);

  useEffect(() => {
    void refresh().catch((error: unknown) =>
      setNotice(error instanceof Error ? error.message : "无法读取教学复盘资产")
    );
  }, [refresh]);

  useEffect(() => {
    setKit(null);
  }, [assetId, props.runId, props.roundNo]);

  async function createDraft(): Promise<void> {
    if (!props.courseId) return;
    setBusy(true);
    try {
      const created = await request<InstructorAsset>(
        "/api/v1/bff/teacher/instructor-assets/drafts",
        props,
        {
          body: { course_id: props.courseId, title },
          method: "POST"
        }
      );
      await refresh();
      setAssetId(created.asset_id);
      setNotice("草稿已创建；需显式发布后才能用于教学复盘");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "创建草稿失败");
    } finally {
      setBusy(false);
    }
  }

  async function publish(): Promise<void> {
    if (!selectedAsset) return;
    setBusy(true);
    try {
      await request<InstructorAsset>(
        `/api/v1/bff/teacher/instructor-assets/${encodeURIComponent(selectedAsset.asset_id)}/publish`,
        props,
        { body: {}, method: "POST" }
      );
      await refresh();
      setNotice("教学复盘资产已发布");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "发布失败");
    } finally {
      setBusy(false);
    }
  }

  async function reject(): Promise<void> {
    if (!selectedAsset) return;
    setBusy(true);
    try {
      await request<InstructorAsset>(
        `/api/v1/bff/teacher/instructor-assets/${encodeURIComponent(selectedAsset.asset_id)}/reject`,
        props,
        { body: {}, method: "POST" }
      );
      await refresh();
      setNotice("教学复盘草稿已拒绝；终态不可原地修改");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "拒绝失败");
    } finally {
      setBusy(false);
    }
  }

  async function createRevision(): Promise<void> {
    if (!selectedAsset) return;
    setBusy(true);
    try {
      const revision = await request<InstructorAsset>(
        `/api/v1/bff/teacher/instructor-assets/${encodeURIComponent(selectedAsset.asset_id)}/revisions`,
        props,
        { body: { title }, method: "POST" }
      );
      await refresh();
      setAssetId(revision.asset_id);
      setNotice("已创建独立修订草稿");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "创建修订失败");
    } finally {
      setBusy(false);
    }
  }

  async function loadKit(): Promise<void> {
    if (!selectedAsset || !props.runId || !props.roundNo) return;
    setBusy(true);
    try {
      const query = new URLSearchParams({
        asset_id: selectedAsset.asset_id,
        round_no: String(props.roundNo),
        run_id: props.runId
      });
      setKit(
        await request<InstructorIntelligenceKit>(
          `/api/v1/bff/teacher/instructor-intelligence?${query}`,
          props
        )
      );
      setNotice("已生成确定性教学复盘包；未调用 AI");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "教学复盘包不可用");
    } finally {
      setBusy(false);
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
                创建草稿
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
