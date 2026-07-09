import { useCallback, useEffect, useMemo, useState } from "react";
import {
  M1_TEACHING_OFFICIAL_RESULT_LABEL,
  M1_TEACHING_PRODUCT_PACKAGE
} from "@simwar/shared-contracts";
import type {
  ApiEnvelope,
  AuthSession,
  P0DemoState,
  Round,
  SettlementResult,
  TeacherBffWorkspaceDTO
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

function getRoundAction(round?: Round): string {
  if (!round) {
    return "创建 Run";
  }

  if (round.status === "draft") {
    return "开启回合";
  }

  if (round.status === "open") {
    return "锁定回合";
  }

  if (round.status === "locked") {
    return "请求结算";
  }

  if (round.status === "settled") {
    return "发布结果";
  }

  return "已发布";
}

export function App() {
  const [state, setState] = useState<P0DemoState | null>(null);
  const [workspace, setWorkspace] = useState<TeacherBffWorkspaceDTO | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [login, setLogin] = useState<LoginForm>(EMPTY_LOGIN);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("ready");

  const latestRun = state?.runs.at(-1);
  const latestRound = latestRun
    ? state?.rounds.find((round) => round.run_id === latestRun.run_id)
    : undefined;
  const resultRows = workspace?.teacher_replay_summary.authorized_result_snapshot ?? [];
  const resultLabel = state?.latest_result?.result_label ?? M1_TEACHING_OFFICIAL_RESULT_LABEL;
  const runtimeBoundary =
    workspace?.teacher_replay_summary.visible_state.runtime_boundary ??
    state?.latest_result?.runtime_boundary ??
    "current_json_active_runtime";
  const runtimeLimitations = state?.latest_result?.runtime_limitations ?? [
    "not_production_durable_settlement",
    "not_cross_process_idempotency",
    "not_database_transaction_recovery",
    "not_postgresql_active_runtime"
  ];
  const debriefPrompts = state?.latest_result?.classroom_debrief_prompts ?? [];
  const teachingPackage = M1_TEACHING_PRODUCT_PACKAGE;
  const teacherDashboard = workspace?.teacher_dashboard;
  const courseWorkspace = workspace?.course_workspace;
  const roundControl = workspace?.round_control;
  const teamMonitor = workspace?.team_monitor;
  const replaySummary = workspace?.teacher_replay_summary;
  const hasDecision = useMemo(() => {
    if (!latestRun || !latestRound || !state) {
      return false;
    }

    return state.decisions.some(
      (decision) =>
        decision.run_id === latestRun.run_id && decision.round_no === latestRound.round_no
    );
  }, [latestRun, latestRound, state]);

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
      setWorkspace(null);
      return;
    }

    setWorkspace(
      await apiRequest<TeacherBffWorkspaceDTO>(
        `/api/v1/bff/teacher/runs/${nextRun.run_id}/rounds/${nextRound.round_no}/workspace`,
        auth
      )
    );
  }, [login.tenantId, session]);

  function updateLogin(field: keyof LoginForm, value: string): void {
    setLogin((current) => ({ ...current, [field]: value }));
    setSession(null);
    setState(null);
    setWorkspace(null);
    setNotice("context changed");
  }

  async function signIn(nextLogin = login): Promise<void> {
    setBusy(true);
    setSession(null);
    setState(null);
    setWorkspace(null);
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

  async function runNextStep(): Promise<void> {
    if (!session) {
      setNotice("please sign in first");
      return;
    }

    setBusy(true);
    try {
      const auth = { token: session.access_token, tenantId: login.tenantId };

      if (!latestRun) {
        await apiRequest("/api/v1/courses/course_demo/runs", { ...auth, method: "POST" });
        setNotice("run created");
      } else if (latestRound?.status === "draft") {
        await apiRequest(`/api/v1/runs/${latestRun.run_id}/rounds/1/start`, {
          ...auth,
          method: "POST"
        });
        setNotice("round opened");
      } else if (latestRound?.status === "open") {
        if (!hasDecision) {
          setNotice("waiting for learner decision");
        } else {
          await apiRequest(`/api/v1/runs/${latestRun.run_id}/rounds/1/lock`, {
            ...auth,
            method: "POST"
          });
          setNotice("round locked");
        }
      } else if (latestRound?.status === "locked") {
        await apiRequest<SettlementResult>(`/api/v1/runs/${latestRun.run_id}/rounds/1/settle`, {
          ...auth,
          method: "POST"
        });
        setNotice("settlement completed");
      } else if (latestRound?.status === "settled") {
        await apiRequest(`/api/v1/runs/${latestRun.run_id}/rounds/1/publish`, {
          ...auth,
          method: "POST"
        });
        setNotice("result published");
      }

      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "action failed");
    } finally {
      setBusy(false);
    }
  }

  const metrics = [
    ["身份", session?.user.display_name ?? "anonymous"],
    ["课程", courseWorkspace?.visible_state.course_title ?? state?.courses[0]?.title ?? "loading"],
    ["队伍", `${teacherDashboard?.visible_state.team_count ?? state?.teams.length ?? 0}`],
    ["回合", roundControl?.status ?? latestRound?.status ?? "not created"],
    [
      "决策",
      roundControl?.visible_state.decision_count
        ? "validated"
        : hasDecision
          ? "validated"
          : "waiting"
    ],
    ["运行时", runtimeBoundary],
    ["Replay", replaySummary?.replay_status ?? "pending"],
    ["BFF", teacherDashboard?.evidence_label ?? "pending"]
  ];

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Teacher Console</p>
          <h1>SimWar M1 教师控制台</h1>
          <span className="official-label">{resultLabel}</span>
          <span className="identity">
            {session ? `${session.user.roles.join(" / ")} · ${login.tenantId}` : "not signed in"}
          </span>
        </div>
        <button
          className="primary"
          disabled={busy || latestRound?.status === "published" || !session}
          onClick={() => void runNextStep()}
        >
          {busy ? "处理中" : getRoundAction(latestRound)}
        </button>
      </header>

      <section className="login-strip" aria-label="teacher login">
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
          教师登录
        </button>
        {DEMO_LOGIN_ENABLED ? (
          <button disabled={busy} onClick={() => void signIn(DEMO_LOGIN)}>
            演示登录
          </button>
        ) : null}
      </section>

      <section className="metrics" aria-label="M1 run status">
        {metrics.map(([label, value]) => (
          <article className="metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="teaching-pack" aria-label="M1 teaching product package">
        <article className="panel teaching-panel">
          <div className="panel-title">
            <h2>{teachingPackage.courseBlueprint.timing}</h2>
            <span>{teachingPackage.courseBlueprint.title}</span>
          </div>
          <p className="package-brief">{teachingPackage.instructorKit.briefing}</p>
          <div className="phase-list">
            {teachingPackage.courseBlueprint.phases.map((phase) => (
              <div className="phase-row" key={phase.label}>
                <span>{phase.label}</span>
                <strong>{phase.title}</strong>
                <p>{phase.guidance}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel teaching-panel">
          <div className="panel-title">
            <h2>教师操作清单</h2>
            <span>{teachingPackage.instructorKit.title}</span>
          </div>
          <ul className="compact-list">
            {teachingPackage.instructorKit.operationChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3>回合指导语</h3>
          <ul className="compact-list">
            {teachingPackage.instructorKit.roundScript.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="panel teaching-panel">
          <div className="panel-title">
            <h2>最小学习证据 Rubric</h2>
            <span>{teachingPackage.minimumAssessmentEvidence.title}</span>
          </div>
          <div className="rubric-list">
            {teachingPackage.minimumAssessmentEvidence.rubric.map((item) => (
              <div className="rubric-row" key={item.dimension}>
                <strong>{item.dimension}</strong>
                <p>{item.evidence}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      {workspace ? (
        <section className="bff-surface" aria-label="teacher bff dto surface">
          <article className="panel bff-panel">
            <div className="panel-title">
              <h2>BFF 教师工作台</h2>
              <span>{teacherDashboard?.evidence_label}</span>
            </div>
            <div className="status-grid">
              <div>
                <span>Course</span>
                <strong>{courseWorkspace?.visible_state.course_title}</strong>
              </div>
              <div>
                <span>Run</span>
                <strong>{courseWorkspace?.visible_state.run_status}</strong>
              </div>
              <div>
                <span>Teams</span>
                <strong>{teacherDashboard?.visible_state.team_count}</strong>
              </div>
            </div>
            <p className="evidence-note">{courseWorkspace?.evidence_label}</p>
            <ul className="tag-list">
              {teacherDashboard?.allowed_actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </article>

          <article className="panel bff-panel">
            <div className="panel-title">
              <h2>BFF 回合控制</h2>
              <span>{roundControl?.evidence_label}</span>
            </div>
            <div className="status-grid">
              <div>
                <span>Round</span>
                <strong>{roundControl?.round_no}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{roundControl?.status}</strong>
              </div>
              <div>
                <span>Settlement</span>
                <strong>
                  {roundControl?.visible_state.settlement_available ? "available" : "pending"}
                </strong>
              </div>
            </div>
            <p className="evidence-note">
              Decisions {roundControl?.visible_state.decision_count} / Teams{" "}
              {roundControl?.visible_state.team_count}
            </p>
          </article>

          <article className="panel bff-panel">
            <div className="panel-title">
              <h2>BFF 队伍监控</h2>
              <span>{teamMonitor?.evidence_label}</span>
            </div>
            <div className="table">
              {teamMonitor?.teams.map((team) => (
                <div className="table-row" key={team.team_id}>
                  <span>{team.team_name}</span>
                  <span>{team.members} members</span>
                  <strong>{team.decision_submitted ? "submitted" : "waiting"}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="panel bff-panel">
            <div className="panel-title">
              <h2>BFF Replay 摘要</h2>
              <span>{replaySummary?.evidence_label}</span>
            </div>
            <div className="status-grid">
              <div>
                <span>Results</span>
                <strong>{replaySummary?.visible_state.result_count}</strong>
              </div>
              <div>
                <span>Replay</span>
                <strong>{replaySummary?.replay_status ?? "pending"}</strong>
              </div>
              <div>
                <span>Non-overwrite</span>
                <strong>
                  {replaySummary?.replay_writes_formal_results === false ? "read-only" : "pending"}
                </strong>
              </div>
            </div>
            <p className="evidence-note">formal_truth_write_allowed: false</p>
            <ul className="tag-list">
              {replaySummary?.redacted_fields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </article>
        </section>
      ) : null}

      <section className="workspace">
        <article className="panel">
          <div className="panel-title">
            <h2>队伍监控</h2>
            <span>{notice}</span>
          </div>
          <div className="table">
            <div className="table-row table-head">
              <span>队伍</span>
              <span>成员</span>
              <span>提交</span>
            </div>
            {(state?.teams ?? []).map((team) => (
              <div className="table-row" key={team.team_id}>
                <span>{team.name}</span>
                <span>{team.members.map((member) => member.display_name).join(", ")}</span>
                <span>{hasDecision ? "已校验" : "待提交"}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-title">
            <h2>M1 教学正式结果</h2>
            <span>{latestRound?.status ?? "not created"}</span>
          </div>
          <div className="result-grid">
            {resultRows.map((result) => (
              <div className="result-card" key={result.team_id}>
                <span>{result.team_name}</span>
                <strong>{result.state_obs.score}</strong>
                <p>Rank {result.state_obs.rank}</p>
                {"state_true" in result && result.state_true ? (
                  <small>Profit {Math.round(result.state_true.profit)}</small>
                ) : null}
                <p className="result-explain">{result.state_est.recommended_focus}</p>
              </div>
            ))}
            {resultRows.length === 0 ? <p className="muted">发布后显示结果。</p> : null}
          </div>
          {resultRows.length > 0 ? (
            <div className="debrief-box" aria-label="classroom debrief materials">
              <h3>课堂复盘材料</h3>
              <p>{resultLabel}</p>
              <ul>
                {[...debriefPrompts, ...teachingPackage.debriefKit.teacherDiscussionPoints].map(
                  (prompt) => (
                    <li key={prompt}>{prompt}</li>
                  )
                )}
              </ul>
              <small>当前限制：{runtimeLimitations.join(" / ")}</small>
            </div>
          ) : null}
        </article>
      </section>

      <section className="panel audit">
        <div className="panel-title">
          <h2>审计链</h2>
          <span>{state?.audit_logs.length ?? 0} events</span>
        </div>
        <div className="timeline">
          {(state?.audit_logs ?? []).slice(-8).map((event) => (
            <div className="timeline-item" key={event.audit_id}>
              <span>{event.action}</span>
              <strong>{event.resource_type}</strong>
              <small>{new Date(event.created_at).toLocaleTimeString()}</small>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
