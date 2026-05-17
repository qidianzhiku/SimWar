import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiEnvelope, P0DemoState, Round, SettlementResult } from "@simwar/shared-contracts";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const TEACHER_TOKEN = "teacher-token";

async function apiRequest<TData>(path: string, options: { method?: string; token?: string } = {}): Promise<TData> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      authorization: `Bearer ${options.token ?? TEACHER_TOKEN}`,
      "content-type": "application/json",
      "x-tenant-id": "tenant_demo"
    }
  });
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
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("ready");

  const latestRun = state?.runs.at(-1);
  const latestRound = latestRun ? state?.rounds.find((round) => round.run_id === latestRun.run_id) : undefined;
  const resultRows = state?.latest_result?.results ?? [];
  const hasDecision = useMemo(() => {
    if (!latestRun || !latestRound || !state) {
      return false;
    }

    return state.decisions.some((decision) => decision.run_id === latestRun.run_id && decision.round_no === latestRound.round_no);
  }, [latestRun, latestRound, state]);

  const refresh = useCallback(async () => {
    setState(await apiRequest<P0DemoState>("/api/v1/demo-state"));
  }, []);

  useEffect(() => {
    refresh().catch((error: unknown) => {
      setNotice(error instanceof Error ? error.message : "load failed");
    });
  }, [refresh]);

  async function runNextStep(): Promise<void> {
    setBusy(true);
    try {
      if (!latestRun) {
        await apiRequest("/api/v1/courses/course_demo/runs", { method: "POST" });
        setNotice("run created");
      } else if (latestRound?.status === "draft") {
        await apiRequest(`/api/v1/runs/${latestRun.run_id}/rounds/1/start`, { method: "POST" });
        setNotice("round opened");
      } else if (latestRound?.status === "open") {
        if (!hasDecision) {
          setNotice("waiting for learner decision");
        } else {
          await apiRequest(`/api/v1/runs/${latestRun.run_id}/rounds/1/lock`, { method: "POST" });
          setNotice("round locked");
        }
      } else if (latestRound?.status === "locked") {
        await apiRequest<SettlementResult>(`/api/v1/runs/${latestRun.run_id}/rounds/1/settle`, { method: "POST" });
        setNotice("settlement completed");
      } else if (latestRound?.status === "settled") {
        await apiRequest(`/api/v1/runs/${latestRun.run_id}/rounds/1/publish`, { method: "POST" });
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
    ["课程", state?.courses[0]?.status ?? "loading"],
    ["队伍", `${state?.teams.length ?? 0}`],
    ["回合", latestRound?.status ?? "not created"],
    ["决策", hasDecision ? "validated" : "waiting"],
    ["Replay", state?.latest_result?.replay_hash?.slice(0, 8) ?? "pending"]
  ];

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Teacher Console</p>
          <h1>SimWar P0 教师控制台</h1>
        </div>
        <button className="primary" disabled={busy || latestRound?.status === "published"} onClick={() => void runNextStep()}>
          {busy ? "处理中" : getRoundAction(latestRound)}
        </button>
      </header>

      <section className="metrics" aria-label="P0 run status">
        {metrics.map(([label, value]) => (
          <article className="metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

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
            <h2>正式结果</h2>
            <span>{latestRound?.status ?? "not created"}</span>
          </div>
          <div className="result-grid">
            {resultRows.map((result) => (
              <div className="result-card" key={result.team_id}>
                <span>{result.team_name}</span>
                <strong>{result.state_obs.score}</strong>
                <p>Rank {result.state_obs.rank}</p>
                {"state_true" in result && result.state_true ? <small>Profit {Math.round(result.state_true.profit)}</small> : null}
              </div>
            ))}
            {resultRows.length === 0 ? <p className="muted">发布后显示结果。</p> : null}
          </div>
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
