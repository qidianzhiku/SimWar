import { useCallback, useEffect, useMemo, useState } from "react";
import {
  M1_TEACHING_OFFICIAL_RESULT_LABEL,
  M1_TEACHING_PRODUCT_PACKAGE
} from "@simwar/shared-contracts";
import type {
  ApiEnvelope,
  AuthSession,
  Decision,
  DecisionPayload,
  P0DemoState,
  StudentBffCockpitDTO
} from "@simwar/shared-contracts";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
type LoginForm = {
  tenantId: string;
  username: string;
  password: string;
};

const EMPTY_LOGIN: LoginForm = {
  tenantId: "",
  username: "",
  password: ""
};

const DEMO_LOGIN: LoginForm = {
  tenantId: import.meta.env.VITE_SIMWAR_DEMO_TENANT_ID ?? "",
  username: import.meta.env.VITE_SIMWAR_DEMO_USERNAME ?? "",
  password: import.meta.env.VITE_SIMWAR_DEMO_PASSWORD ?? ""
};

const DEMO_LOGIN_ENABLED =
  import.meta.env.VITE_SIMWAR_DEMO_MODE === "true" &&
  Boolean(DEMO_LOGIN.tenantId && DEMO_LOGIN.username && DEMO_LOGIN.password);

function toStudentSafeCopy(value: string): string {
  return value.replaceAll("state_true", "正式真值字段");
}

const defaultDecision: DecisionPayload = {
  pricing: { base_price: 12800 },
  marketing_budget: 180000,
  service_quality_budget: 160000,
  capacity_plan: "expand",
  cash_buffer_target: 0.16,
  strategy_statement: "守住中高端康养客群并优先保证交付能力"
};

async function apiRequest<TData>(
  path: string,
  options: { method?: string; token?: string; tenantId?: string; body?: unknown } = {}
): Promise<TData> {
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };
  const tenantId = options.tenantId?.trim();

  if (tenantId) {
    headers["x-tenant-id"] = tenantId;
  }

  if (options.token) {
    headers.authorization = `Bearer ${options.token}`;
  }

  const init: RequestInit = {
    method: options.method ?? "GET",
    headers
  };

  if (options.body) {
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE}${path}`, init);
  const envelope = (await response.json()) as ApiEnvelope<TData>;

  if (!response.ok) {
    throw new Error(`${envelope.code}: ${envelope.message}`);
  }

  return envelope.data;
}

export function App() {
  const [state, setState] = useState<P0DemoState | null>(null);
  const [cockpit, setCockpit] = useState<StudentBffCockpitDTO | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [login, setLogin] = useState<LoginForm>(EMPTY_LOGIN);
  const [decision, setDecision] = useState<DecisionPayload>(defaultDecision);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("ready");

  const latestRun = state?.runs.at(-1);
  const latestRound = latestRun
    ? state?.rounds.find((round) => round.run_id === latestRun.run_id)
    : undefined;
  const team = state?.teams.find((candidate) => candidate.team_id === state.current_user.team_id);
  const publishedResult = cockpit?.published_result;
  const myResult = publishedResult?.redacted_result;
  const resultLabel = publishedResult?.result_label ?? M1_TEACHING_OFFICIAL_RESULT_LABEL;
  const learnerKit = M1_TEACHING_PRODUCT_PACKAGE.learnerOnboarding;
  const submittedDecision = useMemo(() => {
    if (!latestRun || !latestRound || !team || !state) {
      return undefined;
    }

    return state.decisions.find(
      (candidate) =>
        candidate.run_id === latestRun.run_id &&
        candidate.round_no === latestRound.round_no &&
        candidate.team_id === team.team_id
    );
  }, [latestRun, latestRound, team, state]);

  const refresh = useCallback(async () => {
    if (!session) {
      return;
    }

    const auth = { token: session.access_token, tenantId: login.tenantId };
    const nextState = await apiRequest<P0DemoState>("/api/v1/demo-state", auth);
    const nextRun = nextState.runs.at(-1);
    const nextRound = nextRun
      ? nextState.rounds.find((round) => round.run_id === nextRun.run_id)
      : undefined;

    setState(nextState);

    if (!nextRun || !nextRound) {
      setCockpit(null);
      return;
    }

    setCockpit(
      await apiRequest<StudentBffCockpitDTO>(
        `/api/v1/bff/student/runs/${nextRun.run_id}/rounds/${nextRound.round_no}/cockpit`,
        auth
      )
    );
  }, [login.tenantId, session]);

  function updateLogin(field: keyof LoginForm, value: string): void {
    setLogin((current) => ({ ...current, [field]: value }));
    setSession(null);
    setState(null);
    setCockpit(null);
    setNotice("context changed");
  }

  async function signIn(nextLogin = login): Promise<void> {
    setBusy(true);
    setSession(null);
    setState(null);
    setCockpit(null);
    try {
      const nextSession = await apiRequest<AuthSession>("/api/v1/auth/login", {
        method: "POST",
        tenantId: nextLogin.tenantId,
        body: {
          username: nextLogin.username,
          password: nextLogin.password
        }
      });
      setSession(nextSession);
      setNotice("signed in");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "login failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh().catch((error: unknown) => {
      setNotice(error instanceof Error ? error.message : "load failed");
    });
  }, [refresh]);

  async function submitDecision(): Promise<void> {
    if (!session || !latestRun || !latestRound || !team) {
      setNotice("waiting for round");
      return;
    }

    setBusy(true);
    try {
      await apiRequest<Decision>(
        `/api/v1/runs/${latestRun.run_id}/rounds/${latestRound.round_no}/decisions`,
        {
          method: "POST",
          token: session.access_token,
          tenantId: login.tenantId,
          body: {
            team_id: team.team_id,
            decision_payload: decision
          }
        }
      );
      setNotice("decision submitted");
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "submit failed");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = Boolean(latestRound?.status === "open" && team && session);
  const cards = [
    ["身份", session?.user.display_name ?? "anonymous"],
    ["课程", state?.courses[0]?.title ?? "loading"],
    ["队伍", cockpit?.student_cockpit.visible_state.team_name ?? team?.name ?? "not assigned"],
    [
      "回合",
      cockpit?.student_cockpit.visible_state.round_status ?? latestRound?.status ?? "not created"
    ],
    ["决策", submittedDecision ? `v${submittedDecision.version}` : "draft"],
    ["BFF", cockpit?.student_cockpit.evidence_label ?? "pending"]
  ];

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Student Cockpit</p>
          <h1>SimWar M1 学员驾驶舱</h1>
          <span className="official-label">{resultLabel}</span>
          <span className="identity">
            {session ? `${session.user.roles.join(" / ")} · ${login.tenantId}` : "not signed in"}
          </span>
        </div>
        <span className="badge">JSON active runtime</span>
      </header>

      <section className="login-strip" aria-label="student login">
        <input
          aria-label="tenant"
          value={login.tenantId}
          onChange={(event) => updateLogin("tenantId", event.target.value)}
        />
        <input
          aria-label="username"
          value={login.username}
          onChange={(event) => updateLogin("username", event.target.value)}
        />
        <input
          aria-label="password"
          type="password"
          value={login.password}
          onChange={(event) => updateLogin("password", event.target.value)}
        />
        <button disabled={busy} onClick={() => void signIn()}>
          学员登录
        </button>
        {DEMO_LOGIN_ENABLED ? (
          <button disabled={busy} onClick={() => void signIn(DEMO_LOGIN)}>
            演示登录
          </button>
        ) : null}
      </section>

      <section className="board" aria-label="learner status">
        {cards.map(([name, value]) => (
          <article className="row" key={name}>
            <span>{name}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="learner-guide" aria-label="M1 learner onboarding">
        <article className="panel guide-panel">
          <div className="panel-title">
            <h2>学员试讲导入</h2>
            <span>{learnerKit.title}</span>
          </div>
          <p>{learnerKit.roleBriefing}</p>
          <ul>
            {learnerKit.decisionRules.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="panel guide-panel">
          <div className="panel-title">
            <h2>提交前检查</h2>
            <span>Team decision</span>
          </div>
          <ul>
            {learnerKit.submissionChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="panel guide-panel">
          <div className="panel-title">
            <h2>反馈怎么读</h2>
            <span>safe result view</span>
          </div>
          <ul>
            {learnerKit.resultReadingGuide.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="visibility-note">{toStudentSafeCopy(learnerKit.visibilityBoundary)}</p>
        </article>
      </section>

      {cockpit ? (
        <section className="bff-surface" aria-label="student bff dto surface">
          <article className="panel bff-panel">
            <div className="panel-title">
              <h2>BFF 学员驾驶舱</h2>
              <span>{cockpit.student_cockpit.evidence_label}</span>
            </div>
            <div className="status-grid">
              <div>
                <span>Team</span>
                <strong>{cockpit.student_cockpit.visible_state.team_name}</strong>
              </div>
              <div>
                <span>Round</span>
                <strong>{cockpit.student_cockpit.visible_state.round_status}</strong>
              </div>
              <div>
                <span>Tenant</span>
                <strong>{cockpit.student_cockpit.tenant_id}</strong>
              </div>
            </div>
            <p className="evidence-note">
              Protected fields hidden: {cockpit.student_cockpit.forbidden_fields.length}
            </p>
          </article>

          <article className="panel bff-panel">
            <div className="panel-title">
              <h2>BFF 决策表单</h2>
              <span>{cockpit.decision_form.evidence_label}</span>
            </div>
            <div className="status-grid">
              <div>
                <span>Schema</span>
                <strong>{cockpit.decision_form.decision_schema_version}</strong>
              </div>
              <div>
                <span>Editable</span>
                <strong>{cockpit.decision_form.editable_fields.length}</strong>
              </div>
              <div>
                <span>Actions</span>
                <strong>{cockpit.decision_form.allowed_actions.length}</strong>
              </div>
            </div>
            <ul className="tag-list">
              {cockpit.decision_form.editable_fields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </article>

          <article className="panel bff-panel">
            <div className="panel-title">
              <h2>BFF 发布结果</h2>
              <span>{cockpit.published_result.evidence_label}</span>
            </div>
            {myResult ? (
              <div className="status-grid">
                <div>
                  <span>Rank</span>
                  <strong>{myResult.state_obs.rank}</strong>
                </div>
                <div>
                  <span>Score</span>
                  <strong>{myResult.state_obs.score}</strong>
                </div>
                <div>
                  <span>Band</span>
                  <strong>{myResult.state_obs.profit_band}</strong>
                </div>
              </div>
            ) : (
              <p className="muted">结果发布后显示可见反馈。</p>
            )}
            <p className="evidence-note">{cockpit.published_result.result_label}</p>
          </article>

          <article className="panel bff-panel">
            <div className="panel-title">
              <h2>三段式反馈</h2>
              <span>{cockpit.three_part_feedback.evidence_label}</span>
            </div>
            {cockpit.three_part_feedback.feedback.what_happened ? (
              <div className="feedback-stack">
                <div>
                  <span>What happened</span>
                  <strong>
                    Rank {cockpit.three_part_feedback.feedback.what_happened.rank} / Score{" "}
                    {cockpit.three_part_feedback.feedback.what_happened.score}
                  </strong>
                </div>
                <div>
                  <span>Why it happened</span>
                  <p>{cockpit.three_part_feedback.feedback.why_it_happened}</p>
                </div>
                <div>
                  <span>Next step risk</span>
                  <strong>{cockpit.three_part_feedback.feedback.next_step_risk}</strong>
                </div>
              </div>
            ) : (
              <p className="muted">等待发布后的三段式反馈。</p>
            )}
          </article>

          <article className="panel bff-panel">
            <div className="panel-title">
              <h2>Learning Report</h2>
              <span>{cockpit.learning_report.evidence_label}</span>
            </div>
            <div className="status-grid">
              <div>
                <span>Advisory</span>
                <strong>advisory_only: true</strong>
              </div>
              <div>
                <span>Formal grade</span>
                <strong>
                  {cockpit.learning_report.learning_evidence.formal_grade ? "yes" : "no"}
                </strong>
              </div>
              <div>
                <span>Prompts</span>
                <strong>{cockpit.learning_report.learning_evidence.prompts.length}</strong>
              </div>
            </div>
            <ul className="compact-list">
              {cockpit.learning_report.learning_evidence.prompts.map((prompt) => (
                <li key={prompt}>{toStudentSafeCopy(prompt)}</li>
              ))}
            </ul>
          </article>
        </section>
      ) : null}

      <section className="workspace">
        <article className="panel form-panel">
          <div className="panel-title">
            <h2>结构化决策</h2>
            <span>{notice}</span>
          </div>
          <label>
            定价
            <input
              min="6000"
              max="30000"
              type="number"
              value={decision.pricing.base_price}
              onChange={(event) =>
                setDecision((current) => ({
                  ...current,
                  pricing: { base_price: Number(event.target.value) }
                }))
              }
            />
          </label>
          <label>
            营销预算
            <input
              min="0"
              max="1000000"
              type="number"
              value={decision.marketing_budget}
              onChange={(event) =>
                setDecision((current) => ({
                  ...current,
                  marketing_budget: Number(event.target.value)
                }))
              }
            />
          </label>
          <label>
            服务质量预算
            <input
              min="0"
              max="1000000"
              type="number"
              value={decision.service_quality_budget}
              onChange={(event) =>
                setDecision((current) => ({
                  ...current,
                  service_quality_budget: Number(event.target.value)
                }))
              }
            />
          </label>
          <label>
            产能计划
            <select
              value={decision.capacity_plan}
              onChange={(event) =>
                setDecision((current) => ({
                  ...current,
                  capacity_plan: event.target.value as DecisionPayload["capacity_plan"]
                }))
              }
            >
              <option value="contract">收缩</option>
              <option value="hold">保持</option>
              <option value="expand">扩张</option>
            </select>
          </label>
          <label>
            现金缓冲
            <input
              max="0.6"
              min="0"
              step="0.01"
              type="number"
              value={decision.cash_buffer_target}
              onChange={(event) =>
                setDecision((current) => ({
                  ...current,
                  cash_buffer_target: Number(event.target.value)
                }))
              }
            />
          </label>
          <label>
            策略说明
            <textarea
              value={decision.strategy_statement}
              onChange={(event) =>
                setDecision((current) => ({
                  ...current,
                  strategy_statement: event.target.value
                }))
              }
            />
          </label>
          <button
            className="primary"
            disabled={!canSubmit || busy}
            onClick={() => void submitDecision()}
          >
            {busy ? "提交中" : "提交决策"}
          </button>
        </article>

        <article className="panel feedback">
          <div className="panel-title">
            <h2>M1 安全结果反馈</h2>
            <span>{myResult ? "published" : "pending"}</span>
          </div>
          {myResult ? (
            <>
              <div className="feedback-block runtime-note">
                <span>结果边界</span>
                <strong>{resultLabel}</strong>
                <p>学员视图只展示可见结果与反馈，不暴露正式真值字段。</p>
              </div>
              <div className="feedback-block">
                <span>发生了什么</span>
                <strong>
                  Rank {myResult.state_obs.rank} / Score {myResult.state_obs.score}
                </strong>
                <p>
                  服务需求 {myResult.state_obs.served_demand}，利润状态{" "}
                  {myResult.state_obs.profit_band}。
                </p>
              </div>
              <div className="feedback-block">
                <span>为什么发生</span>
                <p>{myResult.state_est.explanation}</p>
              </div>
              <div className="feedback-block">
                <span>下一步风险</span>
                <strong>{myResult.state_est.next_round_risk}</strong>
                <p>建议关注 {myResult.state_est.recommended_focus}。</p>
              </div>
              <p className="runtime-limits">
                当前边界：{publishedResult?.explicit_non_proof.join(" / ")}
              </p>
            </>
          ) : (
            <p className="muted">结果发布后显示可见反馈。</p>
          )}
        </article>
      </section>
    </main>
  );
}
