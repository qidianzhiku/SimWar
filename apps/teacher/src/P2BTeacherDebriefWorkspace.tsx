import { useEffect, useRef, useState } from "react";
import type {
  M2P5DecisionLearningResponse,
  W3OfficialConsequenceContext,
  W3OfficialConsequenceRecord,
  W3OfficialConsequenceResponse
} from "@simwar/shared-contracts";
import "./p2b-teacher-debrief.css";

export const P2B_TEACHER_STAGES = [
  "today",
  "highest_blocker",
  "cohort_progress",
  "teachable_moment",
  "debrief_prep"
] as const;

type Props = {
  apiBase: string;
  token: string;
  tenantId: string;
  context?: W3OfficialConsequenceContext | undefined;
  response?: W3OfficialConsequenceResponse;
  blockerSummary?: string;
  teamCount?: number;
  crossRoundEnabled?: boolean;
};

type WorkspaceState =
  | { phase: "idle" | "loading" }
  | { phase: "empty"; message: string }
  | { phase: "ready"; record: W3OfficialConsequenceRecord }
  | { phase: "stale"; record: W3OfficialConsequenceRecord }
  | { phase: "error"; message: string };

type CrossRoundState =
  | { phase: "idle" | "loading" }
  | { phase: "ready"; data: M2P5DecisionLearningResponse }
  | { phase: "error"; message: string };

function contextQuery(context: W3OfficialConsequenceContext): string {
  return new URLSearchParams(
    Object.entries(context).map(([key, value]) => [key, String(value)])
  ).toString();
}

export function TeacherDebriefWorkspace({
  apiBase,
  token,
  tenantId,
  context,
  response,
  blockerSummary = "当前没有可用的回合阻断",
  teamCount = 0,
  crossRoundEnabled = false
}: Props) {
  const [state, setState] = useState<WorkspaceState>(
    response ? { phase: "ready", record: response.record } : { phase: "idle" }
  );
  const [note, setNote] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);
  const [teachableMode, setTeachableMode] = useState<"ask" | "show" | "listen">("ask");
  const [crossRound, setCrossRound] = useState<CrossRoundState>({ phase: "idle" });
  const recordRef = useRef<W3OfficialConsequenceRecord | undefined>(response?.record);
  const identityKey = `${tenantId}:${token}:${context ? contextQuery(context) : ""}`;
  const previousIdentityKey = useRef<string | null>(null);

  useEffect(() => {
    if (previousIdentityKey.current && previousIdentityKey.current !== identityKey) {
      setNote("");
      recordRef.current = undefined;
    }
    previousIdentityKey.current = identityKey;
  }, [identityKey]);

  useEffect(() => {
    if (response) {
      setState({ phase: "ready", record: response.record });
      return;
    }
    const controller = new AbortController();
    if (!context || !token || !tenantId) {
      setState({ phase: "idle" });
      return () => controller.abort();
    }
    setState(
      recordRef.current ? { phase: "stale", record: recordRef.current } : { phase: "loading" }
    );
    fetch(`${apiBase}/api/v1/bff/teacher/w3/consequence?${contextQuery(context)}`, {
      headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId },
      signal: controller.signal
    })
      .then(async (result) => {
        const envelope = (await result.json()) as {
          data?: W3OfficialConsequenceResponse;
          message?: string;
        };
        if (result.status === 404) {
          setState({ phase: "empty", message: envelope.message ?? "等待已发布结果" });
          return;
        }
        if (!result.ok || !envelope.data)
          throw new Error(envelope.message ?? "教师复盘投影读取失败");
        recordRef.current = envelope.data.record;
        setState({ phase: "ready", record: envelope.data.record });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          phase: "error",
          message: error instanceof Error ? error.message : "教师复盘投影读取失败"
        });
      });
    return () => controller.abort();
  }, [apiBase, context, response, retryNonce, tenantId, token]);

  useEffect(() => {
    const controller = new AbortController();
    if (!crossRoundEnabled || !context || !token || !tenantId) {
      setCrossRound({ phase: "idle" });
      return () => controller.abort();
    }
    setCrossRound({ phase: "loading" });
    fetch(
      `${apiBase}/api/v1/bff/teacher/m2p5/runs/${encodeURIComponent(context.run_id)}/rounds/${context.round_no}/decision-learning?${contextQuery(context)}`,
      {
        headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId },
        signal: controller.signal
      }
    )
      .then(async (result) => {
        const envelope = (await result.json()) as {
          data?: M2P5DecisionLearningResponse;
          message?: string;
        };
        if (!result.ok || !envelope.data || !envelope.data.cross_round) {
          throw new Error(envelope.message ?? "教师跨回合学习投影读取失败");
        }
        setCrossRound({ phase: "ready", data: envelope.data });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCrossRound({
          phase: "error",
          message: error instanceof Error ? error.message : "教师跨回合学习投影读取失败"
        });
      });
    return () => controller.abort();
  }, [apiBase, context, crossRoundEnabled, tenantId, token]);

  const record = state.phase === "ready" || state.phase === "stale" ? state.record : undefined;

  function scrollToStage(stage: string): void {
    const target = document.getElementById(`teacher-p2b-${stage}`);
    target?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  return (
    <section
      className="panel p2b-teacher-debrief"
      aria-label="教师复盘工作台"
      aria-busy={state.phase === "loading"}
    >
      <div className="panel-title p2b-journey-heading">
        <div>
          <p className="eyebrow">FE-20 / TEACHER DEBRIEF</p>
          <h2>把结果变成下一轮课堂行动</h2>
        </div>
        <span role="status" aria-live="polite">
          {state.phase === "ready"
            ? "已读取"
            : state.phase === "loading"
              ? "读取中"
              : state.phase === "stale"
                ? "正在刷新"
                : state.phase === "error"
                  ? "加载失败"
                  : "课堂复盘"}
        </span>
      </div>
      {state.phase === "idle" ? (
        <div className="p2b-state-card">
          <strong>等待 exact Course / Run / Round / Team 上下文</strong>
          <p>教师端只读取当前课程与回合的 teacher-safe projection。</p>
        </div>
      ) : null}
      {state.phase === "loading" ? (
        <div className="p2b-state-card">
          <strong>正在整理课堂复盘材料</strong>
          <p>读取结果、阻断和安全的学习进度。</p>
        </div>
      ) : null}
      {state.phase === "stale" ? (
        <div className="p2b-state-card p2b-state-card--stale" data-testid="teacher-p2b-stale">
          <strong>正在刷新课堂复盘投影</strong>
          <p>上一份 teacher-safe 材料仍保留在页面中；刷新完成后会替换。</p>
        </div>
      ) : null}
      {state.phase === "empty" ? (
        <div className="p2b-state-card">
          <strong>{state.message}</strong>
          <p>结果发布后，教师可以开始准备复盘。</p>
        </div>
      ) : null}
      {state.phase === "error" ? (
        <div className="p2b-state-card p2b-state-card--error">
          <strong>教师复盘投影暂不可用</strong>
          <p>{state.message}</p>
          <button
            className="secondary p2b-retry-button"
            data-testid="teacher-p2b-retry"
            type="button"
            onClick={() => setRetryNonce((current) => current + 1)}
          >
            重试读取
          </button>
        </div>
      ) : null}

      <div className="p2b-teacher-stage-stack">
        <article
          className="p2b-teacher-stage"
          data-testid="teacher-p2b-today"
          id="teacher-p2b-today"
        >
          <div className="p2b-stage-kicker">01 · TODAY</div>
          <h3>今日课堂</h3>
          <div className="p2b-metric-grid">
            <div>
              <span>回合</span>
              <strong>{record?.publication.status === "PUBLISHED" ? "已发布" : "等待发布"}</strong>
            </div>
            <div>
              <span>团队</span>
              <strong>{teamCount} 个团队</strong>
            </div>
            <div>
              <span>复盘状态</span>
              <strong>{record ? "可准备" : "待投影"}</strong>
            </div>
            <div>
              <span>课堂边界</span>
              <strong>只读安全投影</strong>
            </div>
          </div>
          <p className="p2b-safe-copy">
            今天不需要重算结果，只需要帮助团队把结果变成下一轮行动。teacher-safe projection。
          </p>
          <button
            className="secondary p2b-stage-cta"
            data-testid="teacher-p2b-today-blocker-cta"
            type="button"
            onClick={() => scrollToStage("highest_blocker")}
          >
            查看阻断
          </button>
        </article>

        <article
          className="p2b-teacher-stage p2b-teacher-stage--critical"
          data-testid="teacher-p2b-highest_blocker"
          id="teacher-p2b-highest_blocker"
        >
          <div className="p2b-stage-kicker">02 · HIGHEST BLOCKER</div>
          <h3>最高阻断</h3>
          <p className="p2b-blocker-title">{blockerSummary}</p>
          <div className="p2b-blocker-grid">
            <div>
              <span>负责对象</span>
              <strong>当前阻断团队</strong>
            </div>
            <div>
              <span>严重度</span>
              <strong>优先引导</strong>
            </div>
            <div>
              <span>下一步安全动作</span>
              <strong>展示结果与机制链</strong>
            </div>
          </div>
          <button
            className="primary p2b-stage-cta"
            data-testid="teacher-p2b-blocker-prep-cta"
            type="button"
            onClick={() => scrollToStage("debrief_prep")}
          >
            准备复盘
          </button>
        </article>

        <article className="p2b-teacher-stage" data-testid="teacher-p2b-cohort_progress">
          <div className="p2b-stage-kicker">03 · COHORT PROGRESS</div>
          <h3>团队学习进度</h3>
          <p>聚合课堂信号，不展示学生私有判断正文。</p>
          <div className="p2b-empty-inline" role="status">
            暂无 teacher-safe 团队学习进度投影；当前仅确认 {teamCount}{" "}
            个团队存在，未编造团队级判断。
          </div>
        </article>

        <article
          className="p2b-teacher-stage"
          data-testid="teacher-p2b-teachable_moment"
          id="teacher-p2b-teachable_moment"
        >
          <div className="p2b-stage-kicker">04 · TEACHABLE MOMENT</div>
          <h3>可教学时刻</h3>
          <div className="p2b-teachable-card">
            <strong>“结果改善了，但为什么履约压力也一起上升？”</strong>
            <span>先问中间机制，再展示 bounded mechanism。</span>
          </div>
          <div className="p2b-teachable-actions" role="group" aria-label="可教学时刻动作">
            {(["ask", "show", "listen"] as const).map((mode) => (
              <button
                className={teachableMode === mode ? "primary" : "secondary"}
                data-testid={`teacher-p2b-teachable-${mode}`}
                key={mode}
                type="button"
                onClick={() => setTeachableMode(mode)}
              >
                {mode === "ask" ? "先问" : mode === "show" ? "展示机制" : "听取回应"}
              </button>
            ))}
          </div>
          <p className="p2b-teachable-mode" role="status" aria-live="polite">
            当前课堂动作：
            {teachableMode === "ask" ? "先问" : teachableMode === "show" ? "展示机制" : "听取回应"}
          </p>
          <label className="p2b-field" htmlFor="teacher-p2b-local-note">
            <span>课堂笔记草稿（本地）</span>
            <textarea
              id="teacher-p2b-local-note"
              value={note}
              maxLength={1000}
              onChange={(event) => setNote(event.target.value)}
              placeholder="记录一个提问或观察…… · 不上传、不进入 D4、不会写入正式结果"
            />
          </label>
          <p className="p2b-safe-copy">
            Teacher action only · advisory facilitation · official result remains read-only。
          </p>
          <button
            className="primary p2b-stage-cta"
            data-testid="teacher-p2b-teachable-prep-cta"
            type="button"
            onClick={() => scrollToStage("debrief_prep")}
          >
            生成复盘准备
          </button>
        </article>

        <article
          className="p2b-teacher-stage"
          data-testid="teacher-p2b-debrief_prep"
          id="teacher-p2b-debrief_prep"
        >
          <div className="p2b-stage-kicker">05 · DEBRIEF PREP</div>
          <h3>复盘准备</h3>
          <div className="p2b-prep-grid">
            <div data-testid="teacher-p2b-prep-blocker">
              <span>最高阻断</span>
              <strong>与最高阻断卡片保持一致</strong>
            </div>
            <div>
              <span>正式结果</span>
              <strong>{record?.official_result.outcome_label ?? "等待投影"}</strong>
            </div>
            <div>
              <span>机制</span>
              <strong>{record?.causal_debrief.label ?? "等待摘要"}</strong>
            </div>
            <div>
              <span>下一轮问题</span>
              <strong>{record?.next_round_hypothesis?.hypothesis ?? "等待教师确认"}</strong>
            </div>
          </div>
          <div className="p2b-known-limit">
            仅保存 teacher-safe debrief draft；不写入 canonical Decision 或正式结算。
          </div>
          {record?.operating_world_consequence_trace ? (
            <div className="p2b-known-limit" data-testid="teacher-p2b-operating-world-trace">
              Operating World → W4 → Replay：
              {record.operating_world_consequence_trace.official_delta} · W4 action=
              {record.operating_world_consequence_trace.w4_action_ref ?? "未提供"} · manifest=
              {record.operating_world_consequence_trace.w4_replay_manifest_ref ?? "未提供"} ·
              settlement digest={record.operating_world_consequence_trace.replay_relevant_digest}
            </div>
          ) : null}
          {crossRound.phase === "ready" ? (
            <div className="p2b-cross-round-card" data-testid="teacher-m2p5-cross-round">
              <span className="p2b-stage-kicker">M2-P5 · CROSS-ROUND HANDOFF</span>
              <strong>
                {crossRound.data.cross_round.entry_status === "OPEN"
                  ? "下一回合已开放，Student 可进入精确上下文"
                  : crossRound.data.cross_round.status === "READY_TO_CONTINUE"
                    ? "学习与状态链已就绪，等待现有 Round authority"
                    : "跨回合入口被前置条件阻断"}
              </strong>
              <p>
                ProjectProfile：{crossRound.data.project_context.title ?? "未解析"} · 学习门禁：
                {crossRound.data.learning.gate}
              </p>
              <p>
                Closing：
                {crossRound.data.cross_round.predecessor_closing_state_ref?.enterprise_state_id ??
                  "未提供"}
                {crossRound.data.cross_round.next_round?.source_closing_state_ref
                  ? ` → Opening：${crossRound.data.cross_round.next_round.source_closing_state_ref.enterprise_state_id}`
                  : ""}
              </p>
              {crossRound.data.cross_round.blocker_codes.length > 0 ? (
                <p className="p2b-known-limit">
                  阻断：{crossRound.data.cross_round.blocker_codes.join(" / ")}
                </p>
              ) : null}
            </div>
          ) : crossRound.phase === "error" ? (
            <p className="p2b-known-limit" role="status">
              跨回合入口暂不可用：{crossRound.message}
            </p>
          ) : null}
        </article>
      </div>
    </section>
  );
}

export default TeacherDebriefWorkspace;
