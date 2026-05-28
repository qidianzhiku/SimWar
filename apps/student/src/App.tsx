import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ApiEnvelope,
  AuthSession,
  Decision,
  DecisionPayload,
  P0DemoState
} from "@simwar/shared-contracts";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const DEFAULT_LOGIN = {
  tenantId: "tenant_demo",
  username: "student",
  password: "student"
};

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
    "content-type": "application/json",
    "x-tenant-id": options.tenantId ?? DEFAULT_LOGIN.tenantId
  };

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
  const [session, setSession] = useState<AuthSession | null>(null);
  const [login, setLogin] = useState(DEFAULT_LOGIN);
  const [decision, setDecision] = useState<DecisionPayload>(defaultDecision);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("ready");

  const latestRun = state?.runs.at(-1);
  const latestRound = latestRun
    ? state?.rounds.find((round) => round.run_id === latestRun.run_id)
    : undefined;
  const team = state?.teams.find((candidate) => candidate.team_id === state.current_user.team_id);
  const myResult = state?.latest_result?.results.find((result) => result.team_id === team?.team_id);
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

    setState(
      await apiRequest<P0DemoState>("/api/v1/demo-state", {
        token: session.access_token,
        tenantId: login.tenantId
      })
    );
  }, [login.tenantId, session]);

  async function signIn(nextLogin = login): Promise<void> {
    setBusy(true);
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
    void signIn(DEFAULT_LOGIN);
  }, []);

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
    ["队伍", team?.name ?? "not assigned"],
    ["回合", latestRound?.status ?? "not created"],
    ["决策", submittedDecision ? `v${submittedDecision.version}` : "draft"]
  ];

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Student Cockpit</p>
          <h1>SimWar P1 学员驾驶舱</h1>
          <span className="identity">
            {session ? `${session.user.roles.join(" / ")} · ${login.tenantId}` : "not signed in"}
          </span>
        </div>
        <span className="badge">advisory only</span>
      </header>

      <section className="login-strip" aria-label="student login">
        <input
          aria-label="tenant"
          value={login.tenantId}
          onChange={(event) =>
            setLogin((current) => ({ ...current, tenantId: event.target.value }))
          }
        />
        <input
          aria-label="username"
          value={login.username}
          onChange={(event) =>
            setLogin((current) => ({ ...current, username: event.target.value }))
          }
        />
        <input
          aria-label="password"
          type="password"
          value={login.password}
          onChange={(event) =>
            setLogin((current) => ({ ...current, password: event.target.value }))
          }
        />
        <button disabled={busy} onClick={() => void signIn()}>
          学员登录
        </button>
      </section>

      <section className="board" aria-label="learner status">
        {cards.map(([name, value]) => (
          <article className="row" key={name}>
            <span>{name}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

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
            <h2>三段式反馈</h2>
            <span>{myResult ? "published" : "pending"}</span>
          </div>
          {myResult ? (
            <>
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
            </>
          ) : (
            <p className="muted">结果发布后显示可见反馈。</p>
          )}
        </article>
      </section>
    </main>
  );
}
