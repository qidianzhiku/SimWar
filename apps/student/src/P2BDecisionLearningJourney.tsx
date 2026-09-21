import { useEffect, useRef, useState } from "react";
import type {
  M2P5DecisionLearningResponse,
  StudentDecisionContextEvidence,
  W3OfficialConsequenceContext,
  W3OfficialConsequenceRecord,
  W3OfficialConsequenceResponse
} from "@simwar/shared-contracts";
import { isStudentDecisionContextEvidenceScope } from "@simwar/shared-contracts";
import { DecisionThreadEvidenceSpine } from "@simwar/ui";
import "@simwar/ui/decision-thread-evidence-spine.css";
import M4MultipathCounterfactualTransferPanel from "@simwar/ui/m4-multipath-counterfactual-transfer-panel";
import "./p2b-decision-learning.css";

export const P2B_STUDENT_STAGES = [
  "result",
  "story",
  "mechanism",
  "what_if",
  "reflection",
  "transfer"
] as const;

export type StudentLearningGate = "blocked" | "ready";

export function getStudentLearningGate(published: boolean): StudentLearningGate {
  return published ? "ready" : "blocked";
}

type Props = {
  apiBase: string;
  token: string;
  tenantId: string;
  context?: W3OfficialConsequenceContext | undefined;
  published: boolean;
  crossRoundEnabled?: boolean;
  evidenceSpineEnabled?: boolean;
  evidenceSpineContext?: W3OfficialConsequenceContext | undefined;
  decisionContextEvidence?: StudentDecisionContextEvidence | null;
  decisionContextEvidenceRequired?: boolean;
  m4?: readonly [courseId: string, runId: string, roundNo: number] | undefined;
  onReauthenticate?: (() => void) | undefined;
};

type JourneyState =
  | { phase: "blocked" | "idle" | "loading" }
  | { phase: "empty"; message: string }
  | { phase: "ready"; record: W3OfficialConsequenceRecord }
  | { phase: "stale"; record: W3OfficialConsequenceRecord }
  | { phase: "error"; message: string };

type CrossRoundState =
  | { phase: "idle" | "loading" }
  | { phase: "ready" | "stale"; data: M2P5DecisionLearningResponse }
  | { phase: "error"; message: string };

function contextQuery(
  context: W3OfficialConsequenceContext,
  decisionContextEvidenceId?: string
): string {
  const params = new URLSearchParams(
    Object.entries(context).map(([key, value]) => [key, String(value)])
  );
  if (decisionContextEvidenceId) {
    params.set("decision_context_evidence_id", decisionContextEvidenceId);
  }
  return params.toString();
}

function safeMessage(value: unknown): string {
  if (value instanceof Error && value.message) return value.message;
  return "学习投影暂不可用，请稍后重试。";
}

const EMPTY_REFLECTION = { judgment: "", learning: "", next: "" };
export function StudentDecisionLearningJourney({
  apiBase,
  token,
  tenantId,
  context,
  published,
  crossRoundEnabled = false,
  evidenceSpineEnabled = false,
  evidenceSpineContext,
  decisionContextEvidence,
  decisionContextEvidenceRequired = false,
  m4,
  onReauthenticate
}: Props) {
  const tokenEpochRef = useRef({ token, epoch: 0 });
  if (tokenEpochRef.current.token !== token) {
    tokenEpochRef.current = { token, epoch: tokenEpochRef.current.epoch + 1 };
  }
  const identityKey = [
    apiBase,
    tenantId,
    tokenEpochRef.current.epoch,
    published,
    context ? contextQuery(context) : "",
    decisionContextEvidence?.evidence_id ?? "",
    decisionContextEvidence?.status ?? "missing",
    decisionContextEvidenceRequired
  ].join(":");
  const [state, setState] = useState<JourneyState>({
    phase: getStudentLearningGate(published) === "blocked" ? "blocked" : "idle"
  });
  const [reflection, setReflection] = useState(EMPTY_REFLECTION);
  const [reflectionNotice, setReflectionNotice] = useState("");
  const [reflectionBusy, setReflectionBusy] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [crossRoundRetryNonce, setCrossRoundRetryNonce] = useState(0);
  const [crossRound, setCrossRound] = useState<CrossRoundState>({ phase: "idle" });
  const stateIdentityRef = useRef(identityKey);
  const crossRoundStateIdentityRef = useRef(identityKey);
  const recordRef = useRef<W3OfficialConsequenceRecord | undefined>(undefined);
  const recordIdentityRef = useRef<string | null>(null);
  const crossRoundRef = useRef<M2P5DecisionLearningResponse | undefined>(undefined);
  const crossRoundIdentityRef = useRef<string | null>(null);
  const reflectionIdentityRef = useRef(identityKey);
  const reflectionNoticeIdentityRef = useRef(identityKey);
  const reflectionBusyIdentityRef = useRef(identityKey);
  const requestEpochRef = useRef(0);
  const crossRoundRequestEpochRef = useRef(0);
  const reflectionController = useRef<AbortController | null>(null);
  const currentIdentity = useRef(identityKey);
  currentIdentity.current = identityKey;
  const decisionContextEvidenceIdentityRef = useRef(identityKey);
  const previousDecisionContextEvidenceRef = useRef(decisionContextEvidence);
  if (previousDecisionContextEvidenceRef.current !== decisionContextEvidence) {
    previousDecisionContextEvidenceRef.current = decisionContextEvidence;
    decisionContextEvidenceIdentityRef.current = identityKey;
  }
  useEffect(() => () => reflectionController.current?.abort(), [identityKey]);
  const previousIdentityKey = useRef<string | null>(null);

  const setStateForIdentity = (next: JourneyState, requestIdentity: string = identityKey): void => {
    stateIdentityRef.current = requestIdentity;
    setState(next);
  };
  const setCrossRoundForIdentity = (
    next: CrossRoundState,
    requestIdentity: string = identityKey
  ): void => {
    crossRoundStateIdentityRef.current = requestIdentity;
    setCrossRound(next);
  };

  useEffect(() => {
    if (previousIdentityKey.current && previousIdentityKey.current !== identityKey) {
      reflectionIdentityRef.current = identityKey;
      reflectionNoticeIdentityRef.current = identityKey;
      reflectionBusyIdentityRef.current = identityKey;
      setReflection(EMPTY_REFLECTION);
      setReflectionNotice("");
      setReflectionBusy(false);
      recordRef.current = undefined;
      recordIdentityRef.current = null;
      crossRoundRef.current = undefined;
      crossRoundIdentityRef.current = null;
      setCrossRoundForIdentity({ phase: "idle" });
    }
    previousIdentityKey.current = identityKey;
  }, [identityKey]);
  useEffect(() => {
    const controller = new AbortController();
    const requestEpoch = ++requestEpochRef.current;
    const requestIdentity = identityKey;
    if (!published) {
      setStateForIdentity({ phase: "blocked" });
      return () => controller.abort();
    }
    if (!context || !token || !tenantId) {
      setStateForIdentity({ phase: "idle" });
      return () => controller.abort();
    }

    setStateForIdentity(
      recordRef.current && recordIdentityRef.current === requestIdentity
        ? { phase: "stale", record: recordRef.current }
        : { phase: "loading" }
    );
    fetch(`${apiBase}/api/v1/bff/student/w3/consequence?${contextQuery(context)}`, {
      headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId },
      signal: controller.signal
    })
      .then(async (response) => {
        const envelope = (await response.json()) as {
          data?: W3OfficialConsequenceResponse;
          message?: string;
        };
        if (requestEpoch !== requestEpochRef.current) return;
        if (response.status === 404) {
          setStateForIdentity({
            phase: "empty",
            message: envelope.message ?? "等待教师确认学习投影"
          });
          return;
        }
        if (!response.ok || !envelope.data) {
          throw new Error(envelope.message ?? "学习投影读取失败");
        }
        recordRef.current = envelope.data.record;
        recordIdentityRef.current = requestIdentity;
        setStateForIdentity({ phase: "ready", record: envelope.data.record }, requestIdentity);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (requestEpoch !== requestEpochRef.current) return;
        setStateForIdentity({ phase: "error", message: safeMessage(error) });
      });

    return () => controller.abort();
  }, [apiBase, identityKey, retryNonce]);

  useEffect(() => {
    const controller = new AbortController();
    const requestEpoch = ++crossRoundRequestEpochRef.current;
    const requestIdentity = identityKey;
    if (!crossRoundEnabled || !published || !context || !token || !tenantId) {
      setCrossRoundForIdentity({ phase: "idle" });
      return () => controller.abort();
    }
    if (decisionContextEvidenceRequired && !decisionContextEvidence) {
      setCrossRoundForIdentity({
        phase: "error",
        message: "决策上下文证据尚未就绪，请刷新后重试。"
      });
      return () => controller.abort();
    }
    if (decisionContextEvidence && decisionContextEvidence.status !== "READY") {
      setCrossRoundForIdentity({
        phase: "error",
        message: "决策上下文证据被服务端阻断，当前回合不会读取连续学习投影。"
      });
      return () => controller.abort();
    }
    const evidenceId = decisionContextEvidence?.evidence_id;
    setCrossRoundForIdentity(
      crossRoundRef.current && crossRoundIdentityRef.current === requestIdentity
        ? { phase: "stale", data: crossRoundRef.current }
        : { phase: "loading" }
    );
    fetch(
      `${apiBase}/api/v1/bff/student/m2p5/runs/${encodeURIComponent(context.run_id)}/rounds/${context.round_no}/decision-learning?${contextQuery(context, evidenceId)}`,
      {
        headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId },
        signal: controller.signal
      }
    )
      .then(async (response) => {
        const envelope = (await response.json()) as {
          data?: M2P5DecisionLearningResponse;
          message?: string;
        };
        if (requestEpoch !== crossRoundRequestEpochRef.current) return;
        if (
          !response.ok ||
          !envelope.data ||
          !envelope.data.cross_round ||
          !envelope.data.learning_loop
        ) {
          throw new Error(envelope.message ?? "跨回合学习投影读取失败");
        }
        if (evidenceId) {
          const responseEvidence = envelope.data.decision_context_evidence;
          if (
            !responseEvidence ||
            responseEvidence.status !== "READY" ||
            responseEvidence.evidence_id !== evidenceId ||
            !isStudentDecisionContextEvidenceScope(responseEvidence, context)
          ) {
            throw new Error("决策上下文连续证据校验失败，请刷新后重试。");
          }
        }
        crossRoundRef.current = envelope.data;
        crossRoundIdentityRef.current = requestIdentity;
        setCrossRoundForIdentity({ phase: "ready", data: envelope.data }, requestIdentity);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (requestEpoch !== crossRoundRequestEpochRef.current) return;
        setCrossRoundForIdentity({
          phase: "error",
          message: safeMessage(error)
        });
      });
    return () => controller.abort();
  }, [
    apiBase,
    context,
    crossRoundEnabled,
    crossRoundRetryNonce,
    decisionContextEvidence,
    decisionContextEvidenceRequired,
    published,
    tenantId,
    token
  ]);

  const currentState: JourneyState =
    stateIdentityRef.current === identityKey
      ? state
      : !published
        ? { phase: "blocked" }
        : !context || !token || !tenantId
          ? { phase: "idle" }
          : { phase: "loading" };
  const currentCrossRound: CrossRoundState =
    crossRoundStateIdentityRef.current === identityKey ? crossRound : { phase: "loading" };
  const currentReflection =
    reflectionIdentityRef.current === identityKey ? reflection : EMPTY_REFLECTION;
  const currentReflectionNotice =
    reflectionNoticeIdentityRef.current === identityKey ? reflectionNotice : "";
  const currentReflectionBusy =
    reflectionBusyIdentityRef.current === identityKey ? reflectionBusy : false;
  const currentDecisionContextEvidence =
    decisionContextEvidenceIdentityRef.current === identityKey
      ? decisionContextEvidence
      : undefined;
  const record =
    currentState.phase === "ready" || currentState.phase === "stale"
      ? currentState.record
      : undefined;
  const displayedDecisionContextEvidence =
    (currentCrossRound.phase === "ready" || currentCrossRound.phase === "stale"
      ? currentCrossRound.data.decision_context_evidence
      : undefined) ?? currentDecisionContextEvidence;
  function scrollToStage(stage: string): void {
    const target = document.getElementById(`student-p2b-${stage}`);
    target?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  async function submitReflection(): Promise<void> {
    if (!record || !context || !reflectionText.trim() || currentReflectionBusy) return;
    reflectionController.current?.abort();
    const controller = new AbortController();
    reflectionController.current = controller;
    const requestIdentity = identityKey;
    const isCurrent = () =>
      !controller.signal.aborted &&
      currentIdentity.current === requestIdentity &&
      reflectionController.current === controller;
    reflectionBusyIdentityRef.current = identityKey;
    reflectionNoticeIdentityRef.current = identityKey;
    setReflectionBusy(true);
    setReflectionNotice("正在保存 AI-off 学习草稿");
    try {
      const response = await fetch(`${apiBase}/api/v1/bff/student/w3/reflection`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-tenant-id": tenantId
        },
        body: JSON.stringify({
          context,
          idempotency_key: `w3-reflection-${record.record_id}`,
          prompt_id: "w3-reflection-off-v1",
          response: reflectionText.trim()
        })
      });
      const envelope = (await response.json()) as {
        data?: W3OfficialConsequenceResponse;
        message?: string;
      };
      if (!isCurrent()) return;
      if (!response.ok || !envelope.data) {
        throw new Error(envelope.message ?? "学习草稿保存失败");
      }
      requestEpochRef.current += 1;
      setCrossRoundRetryNonce((current) => current + 1);
      recordRef.current = envelope.data.record;
      recordIdentityRef.current = identityKey;
      setStateForIdentity({ phase: "ready", record: envelope.data.record }, identityKey);
      setReflectionNotice("学习草稿已保存；它不会进入正式结算。");
    } catch (error: unknown) {
      if (!isCurrent()) return;
      setReflectionNotice(safeMessage(error));
    } finally {
      if (isCurrent()) setReflectionBusy(false);
    }
  }

  const reflectionText = [
    `判断：${currentReflection.judgment.trim()}`,
    `学习：${currentReflection.learning.trim()}`,
    `下一轮：${currentReflection.next.trim()}`
  ]
    .filter((value) => !value.endsWith("："))
    // W3 safeText rejects all ASCII control characters, including LF. Keep
    // the three learner prompts readable without sending rejected separators.
    .join("；");

  return (
    <section
      className="panel p2b-student-journey"
      aria-label="学员决策学习旅程"
      aria-busy={currentState.phase === "loading"}
    >
      <div className="panel-title p2b-journey-heading">
        <div>
          <p className="eyebrow">FE-19 / DECISION LEARNING</p>
          <h2>从正式结果回到可行动的学习</h2>
        </div>
        <span role="status" aria-live="polite">
          {currentState.phase === "blocked"
            ? "等待发布"
            : currentState.phase === "loading"
              ? "读取中"
              : currentState.phase === "ready"
                ? "已读取"
                : currentState.phase === "stale"
                  ? "正在刷新"
                  : currentState.phase === "error"
                    ? "加载失败"
                    : "学习旅程"}
        </span>
      </div>
      {evidenceSpineEnabled ? (
        <DecisionThreadEvidenceSpine
          apiBase={apiBase}
          context={published ? evidenceSpineContext : undefined}
          heading="本轮证据时间线"
          surface="student"
          tenantId={tenantId}
          token={token}
          onReauthenticate={onReauthenticate}
        />
      ) : null}

      {displayedDecisionContextEvidence ? (
        <section
          className="p2b-context-evidence"
          data-testid="student-decision-context-continuity"
          data-evidence-status={displayedDecisionContextEvidence.status}
          data-evidence-version={displayedDecisionContextEvidence.evidence_version}
          aria-label="学员决策上下文连续证据"
        >
          <div>
            <span className="p2b-stage-kicker">M31 · DECISION CONTEXT THREAD</span>
            <strong>
              {displayedDecisionContextEvidence.status === "READY"
                ? "当前决策已绑定同一份安全证据上下文"
                : "当前决策上下文被安全阻断"}
            </strong>
          </div>
          <p>
            回合 {displayedDecisionContextEvidence.scope.round_no} · 团队{" "}
            {displayedDecisionContextEvidence.scope.team_id} · 证据版本{" "}
            {displayedDecisionContextEvidence.evidence_version}
          </p>
          {displayedDecisionContextEvidence.source_context ? (
            <p>
              目标区域：{displayedDecisionContextEvidence.source_context.target_region} · 证据周期：
              {displayedDecisionContextEvidence.source_context.epoch_version} · 资格：
              {displayedDecisionContextEvidence.source_context.qualification_status}
            </p>
          ) : null}
          <div className="p2b-learning-loop-grid" data-testid="student-decision-context-stages">
            {Object.entries(displayedDecisionContextEvidence.continuity).map(([stage, status]) => (
              <div key={stage}>
                <span>{stage}</span>
                <strong>{status}</strong>
              </div>
            ))}
          </div>
          {displayedDecisionContextEvidence.blocker_codes?.length ? (
            <p className="p2b-known-limit">
              阻断：{displayedDecisionContextEvidence.blocker_codes.join(" / ")}
            </p>
          ) : null}
        </section>
      ) : decisionContextEvidenceRequired ? (
        <section
          className="p2b-context-evidence p2b-context-evidence--blocked"
          data-testid="student-decision-context-continuity"
          data-evidence-status="BLOCKED"
          aria-label="学员决策上下文连续证据"
        >
          <span className="p2b-stage-kicker">M31 · DECISION CONTEXT THREAD</span>
          <strong>决策上下文证据尚未就绪</strong>
          <p>服务端尚未返回当前 exact scope 的安全证据；页面不会读取连续学习投影。</p>
        </section>
      ) : null}

      {currentState.phase === "blocked" ? (
        <div className="p2b-state-card p2b-state-card--blocked" data-testid="student-p2b-blocked">
          <strong>结果发布后，学习旅程才会开放</strong>
          <p>结算但未发布时，学员不读取、不预取、不缓存正式结果或学习报告。</p>
        </div>
      ) : null}
      {currentState.phase === "idle" ? (
        <div className="p2b-state-card" data-testid="student-p2b-idle">
          <strong>等待 exact Course / Run / Round / Team 上下文</strong>
          <p>上下文准备好后，页面才会读取服务端安全投影。</p>
        </div>
      ) : null}
      {currentState.phase === "loading" ? (
        <div className="p2b-state-card" data-testid="student-p2b-loading">
          <strong>正在读取已发布结果</strong>
          <p>只读取当前学员、当前团队和当前回合的 safe projection。</p>
        </div>
      ) : null}
      {currentState.phase === "stale" ? (
        <div className="p2b-state-card p2b-state-card--stale" data-testid="student-p2b-stale">
          <strong>正在刷新学习投影</strong>
          <p>上一份安全结果仍保留在页面中；刷新完成后会替换为最新版本。</p>
        </div>
      ) : null}
      {currentState.phase === "empty" ? (
        <div className="p2b-state-card" data-testid="student-p2b-empty">
          <strong>{currentState.message}</strong>
          <p>教师确认学习证据后，这里会出现对应的复盘阶段。</p>
        </div>
      ) : null}
      {currentState.phase === "error" ? (
        <div className="p2b-state-card p2b-state-card--error" data-testid="student-p2b-error">
          <strong>学习投影暂不可用</strong>
          <p>{currentState.message}</p>
          <button
            className="secondary p2b-retry-button"
            data-testid="student-p2b-retry"
            type="button"
            onClick={() => setRetryNonce((current) => current + 1)}
          >
            重试读取
          </button>
        </div>
      ) : null}

      {record ? (
        <div className="p2b-stage-stack">
          <article
            className="p2b-stage p2b-stage--result"
            data-testid="student-p2b-result"
            id="student-p2b-result"
          >
            <div className="p2b-stage-kicker">01 · PUBLISHED RESULT</div>
            <div className="p2b-stage-heading">
              <div>
                <h3>本轮经营结果</h3>
                <p>正式结果先于解释；下面所有学习内容都不会改写它。</p>
              </div>
              <span className="p2b-authority-badge p2b-authority-badge--official">已发布</span>
            </div>
            <div className="p2b-metric-grid">
              <div>
                <span>利润区间</span>
                <strong>{record.official_result.profit_band}</strong>
              </div>
              <div>
                <span>市场排名</span>
                <strong>第 {record.official_result.rank} 名</strong>
              </div>
              <div>
                <span>结果状态</span>
                <strong>
                  {record.official_result.outcome_label === "official_published"
                    ? "已发布"
                    : "已结算"}
                </strong>
              </div>
              <div>
                <span>学习入口</span>
                <strong>6 个阶段</strong>
              </div>
            </div>
            <button
              className="secondary p2b-stage-cta"
              data-testid="student-p2b-result-story-cta"
              type="button"
              onClick={() => scrollToStage("story")}
            >
              查看决策故事
            </button>
          </article>

          <article className="p2b-stage" data-testid="student-p2b-story" id="student-p2b-story">
            <div className="p2b-stage-kicker">02 · DECISION STORY</div>
            <h3>从决策到结果</h3>
            <p>{record.decision_story.decision_summary}</p>
            <p>{record.decision_story.consequence_summary}</p>
            <div className="p2b-source-note">
              来源：confirmed decision · published result · student-safe projection
            </div>
          </article>

          <article className="p2b-stage" data-testid="student-p2b-mechanism">
            <div className="p2b-stage-kicker">03 · BOUNDED MECHANISM</div>
            <h3>为什么可能发生</h3>
            <div className="p2b-mechanism-chain">
              <div>
                <span>条件</span>
                <strong>你的行动</strong>
                <p>{record.decision_story.decision_summary}</p>
              </div>
              <div>
                <span>机制</span>
                <strong>中间响应</strong>
                <p>{record.causal_debrief.statements[0] ?? "服务端未提供机制摘要"}</p>
              </div>
              <div>
                <span>边界</span>
                <strong>不是因果证明</strong>
                <p>解释保持为 model-conditioned association。</p>
              </div>
            </div>
            {record.operating_world_consequence_trace ? (
              <div className="p2b-known-limit" data-testid="student-p2b-operating-world-trace">
                Operating World 后果链：{record.operating_world_consequence_trace.official_delta} ·
                {record.operating_world_consequence_trace.allowed_effects.length > 0
                  ? record.operating_world_consequence_trace.allowed_effects
                      .map((effect) => `${effect.family}/${effect.key} ${effect.effect_direction}`)
                      .join("；")
                  : "未产生官方 W4 变化"}
                <br />
                该链路来自确定性系统事实，不是 AI 因果证明，也不写入官方状态。
              </div>
            ) : null}
          </article>

          <article className="p2b-stage" data-testid="student-p2b-what_if">
            <div className="p2b-stage-kicker">04 · ONE-CHANGE WHAT-IF</div>
            <h3>如果当时只改一项</h3>
            <p className="p2b-boundary-note">
              非正式结果 · 只读预览 · 学员不能发起 counterfactual writer。
            </p>
            {record.counterfactual ? (
              <div className="p2b-compare-grid">
                <div>
                  <span>正式结果</span>
                  <strong>
                    {record.counterfactual.comparison.official_score} / 第{" "}
                    {record.counterfactual.comparison.official_rank} 名
                  </strong>
                </div>
                <div>
                  <span>教师生成的预览</span>
                  <strong>
                    {record.counterfactual.comparison.counterfactual_score} / 第{" "}
                    {record.counterfactual.comparison.counterfactual_rank} 名
                  </strong>
                </div>
                <div>
                  <span>变化</span>
                  <strong>
                    分数 Δ {record.counterfactual.comparison.score_delta} · 排名 Δ{" "}
                    {record.counterfactual.comparison.rank_delta}
                  </strong>
                </div>
              </div>
            ) : (
              <div className="p2b-empty-inline">暂无教师生成的单变量预览；不在客户端自行计算。</div>
            )}
          </article>

          <article className="p2b-stage" data-testid="student-p2b-reflection">
            <div className="p2b-stage-kicker">05 · REFLECTION</div>
            <h3>我的经营复盘</h3>
            <p>AI off · advisory only · 这是学习输入，不进入正式结算。</p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitReflection();
              }}
            >
              <label className="p2b-field" htmlFor="student-p2b-reflection-judgment">
                <span>我原本的判断</span>
                <textarea
                  id="student-p2b-reflection-judgment"
                  value={currentReflection.judgment}
                  maxLength={600}
                  onChange={(event) => {
                    reflectionIdentityRef.current = identityKey;
                    setReflection((current) => ({ ...current, judgment: event.target.value }));
                  }}
                  placeholder="我原本认为……"
                />
              </label>
              <label className="p2b-field" htmlFor="student-p2b-reflection-learning">
                <span>结果让我学到</span>
                <textarea
                  id="student-p2b-reflection-learning"
                  value={currentReflection.learning}
                  maxLength={600}
                  onChange={(event) => {
                    reflectionIdentityRef.current = identityKey;
                    setReflection((current) => ({ ...current, learning: event.target.value }));
                  }}
                  placeholder="结果让我看到……"
                />
              </label>
              <label className="p2b-field" htmlFor="student-p2b-reflection-next">
                <span>下一轮我会检查</span>
                <textarea
                  id="student-p2b-reflection-next"
                  value={currentReflection.next}
                  maxLength={600}
                  onChange={(event) => {
                    reflectionIdentityRef.current = identityKey;
                    setReflection((current) => ({ ...current, next: event.target.value }));
                  }}
                  placeholder="下一轮我会验证……"
                />
              </label>
              <button
                className="primary"
                type="submit"
                disabled={currentReflectionBusy || !reflectionText.trim()}
              >
                {currentReflectionBusy ? "保存中" : "保存学习草稿"}
              </button>
              <p role="status" aria-live="polite" className="p2b-inline-status">
                {currentReflectionNotice ||
                  (record.reflection ? "已有一份 AI-off 学习草稿" : "尚未保存学习草稿")}
              </p>
            </form>
          </article>

          <article className="p2b-stage" data-testid="student-p2b-transfer">
            <div className="p2b-stage-kicker">06 · TRANSFER</div>
            <h3>下一轮假设</h3>
            <div className="p2b-transfer-card">
              <strong>
                {record.next_round_hypothesis?.hypothesis ?? "等待教师确认下一轮学习假设"}
              </strong>
              <span>{record.next_round_hypothesis?.basis ?? "当前学习报告尚未生成"}</span>
            </div>
            {record.operating_world_consequence_trace ? (
              <div className="p2b-known-limit" data-testid="student-p2b-transfer-trace">
                下一轮验证线索：{record.operating_world_consequence_trace.constraints.join("；")}
              </div>
            ) : null}
            {currentCrossRound.phase === "ready" || currentCrossRound.phase === "stale" ? (
              <div className="p2b-cross-round-card" data-testid="student-m2p5-cross-round">
                <span className="p2b-stage-kicker">M2-P5 · CROSS-ROUND ENTRY</span>
                <strong>
                  {currentCrossRound.data.cross_round.entry_status === "OPEN"
                    ? "下一回合已开放，可进入精确上下文"
                    : currentCrossRound.data.cross_round.status === "READY_TO_CONTINUE"
                      ? "学习链已就绪，等待服务端开启下一回合"
                      : "下一回合入口仍被前置条件阻断"}
                </strong>
                <p>
                  项目：{currentCrossRound.data.project_context.title ?? "未解析"} · 学习门禁：
                  {currentCrossRound.data.learning.gate}
                </p>
                <p>
                  Closing：
                  {currentCrossRound.data.cross_round.predecessor_closing_state_ref
                    ?.enterprise_state_id ?? "未提供"}
                  {currentCrossRound.data.cross_round.next_round?.source_closing_state_ref
                    ? ` → Opening：${currentCrossRound.data.cross_round.next_round.source_closing_state_ref.enterprise_state_id}`
                    : ""}
                </p>
                {currentCrossRound.data.cross_round.blocker_codes.length > 0 ? (
                  <p className="p2b-known-limit">
                    阻断：{currentCrossRound.data.cross_round.blocker_codes.join(" / ")}
                  </p>
                ) : null}
                <section
                  className="p2b-learning-loop"
                  data-testid="student-m2p6-learning-loop"
                  data-phase={currentCrossRound.phase}
                  data-status={currentCrossRound.data.learning_loop.status}
                  aria-label="学员 M2P6 学习闭环"
                >
                  <span className="p2b-stage-kicker">M2P6 · GOVERNED LEARNING LOOP</span>
                  <strong>
                    Published Consequence → D4 → mechanism → Reflection → What-if → Transfer → Next
                    Opening
                  </strong>
                  {currentCrossRound.phase === "stale" ? (
                    <p className="p2b-learning-loop-stale" role="status">
                      STALE · 正在刷新同一精确身份；保留上一份 student-safe 投影。
                    </p>
                  ) : null}
                  <div className="p2b-learning-loop-grid">
                    <div>
                      <span>服务端状态</span>
                      <strong>{currentCrossRound.data.learning_loop.status}</strong>
                    </div>
                    <div>
                      <span>D4 / Reflection</span>
                      <strong>
                        {currentCrossRound.data.learning_loop.student_learning_report_status} /{" "}
                        {currentCrossRound.data.learning_loop.reflection_status}
                      </strong>
                    </div>
                    <div>
                      <span>What-if / Transfer</span>
                      <strong>
                        {currentCrossRound.data.learning_loop.what_if_availability} /{" "}
                        {currentCrossRound.data.learning_loop.transfer_status}
                      </strong>
                    </div>
                    <div>
                      <span>Next Opening</span>
                      <strong>
                        {currentCrossRound.data.learning_loop.next_opening_state_readiness}
                      </strong>
                    </div>
                  </div>
                  <p>
                    允许动作：
                    {currentCrossRound.data.learning_loop.allowed_actions.length > 0
                      ? currentCrossRound.data.learning_loop.allowed_actions.join(" / ")
                      : "无"}
                  </p>
                  {currentCrossRound.data.learning_loop.blockers.length > 0 ? (
                    <p className="p2b-known-limit">
                      学习闭环阻断：{currentCrossRound.data.learning_loop.blockers.join(" / ")}
                    </p>
                  ) : null}
                  <p data-testid="student-m2p6-recovery" className="p2b-learning-loop-recovery">
                    Recovery：{currentCrossRound.data.learning_loop.recovery_state}
                  </p>
                </section>
              </div>
            ) : currentCrossRound.phase === "loading" ? (
              <div
                className="p2b-learning-loop p2b-learning-loop--network"
                data-testid="student-m2p6-learning-loop"
                data-phase="loading"
                role="status"
              >
                LOADING · 正在读取精确 M2P6 学习闭环。
              </div>
            ) : currentCrossRound.phase === "error" ? (
              <div
                className="p2b-learning-loop p2b-learning-loop--network"
                data-testid="student-m2p6-learning-loop"
                data-phase="error"
                role="status"
              >
                ERROR · 跨回合入口暂不可用：{currentCrossRound.message}
              </div>
            ) : null}
            <div className="p2b-known-limit">当前边界：{record.known_limits.join(" / ")}</div>
          </article>
        </div>
      ) : null}
      {m4 ? (
        <M4MultipathCounterfactualTransferPanel
          apiBase={apiBase}
          courseId={m4[0]}
          runId={m4[1]}
          roundNo={m4[2]}
          surface="student"
          tenantId={tenantId}
          token={token}
        />
      ) : null}
    </section>
  );
}

export default StudentDecisionLearningJourney;
