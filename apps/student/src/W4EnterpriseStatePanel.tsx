import { useEffect, useState } from "react";
import type { W4ProjectionBase } from "@simwar/shared-contracts";

type PanelStatus =
  | "loading"
  | "empty"
  | "partial"
  | "ready"
  | "blocked"
  | "permission"
  | "stale"
  | "conflict"
  | "dependency-missing"
  | "error"
  | "retry";

interface Props {
  token: string;
  tenantId: string;
  courseId?: string | undefined;
  runId?: string | undefined;
  roundNo?: number | undefined;
  teamId?: string | undefined;
}

interface ProjectionResponse extends W4ProjectionBase {
  process_information: { status: string; activity_id: string };
  outcome_information: { status: string; opening_state_ref: unknown; closing_state_ref: unknown };
}

function statusLabel(status: PanelStatus): string {
  return {
    loading: "加载中",
    empty: "空状态",
    partial: "部分可用",
    ready: "就绪",
    blocked: "存在阻塞",
    permission: "权限受限",
    stale: "上下文过期",
    conflict: "上下文冲突",
    "dependency-missing": "依赖缺失",
    error: "加载失败",
    retry: "可重试"
  }[status];
}

export function W4EnterpriseStatePanel({
  token,
  tenantId,
  courseId = "course_demo",
  runId,
  roundNo,
  teamId
}: Props) {
  const [status, setStatus] = useState<PanelStatus>("loading");
  const [projection, setProjection] = useState<ProjectionResponse | null>(null);
  const [notice, setNotice] = useState("");
  const [projectName, setProjectName] = useState("新区康养中心");
  const [cost, setCost] = useState("300");
  const [beds, setBeds] = useState("120");
  const [leadTime, setLeadTime] = useState("2");
  const [busy, setBusy] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    if (!token || !runId || !roundNo || !teamId) {
      setStatus(token ? "dependency-missing" : "permission");
      setProjection(null);
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    fetch(
      `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"}/api/v1/bff/student/w4/runs/${runId}/rounds/${roundNo}/portfolio?course_id=${encodeURIComponent(courseId)}&team_id=${encodeURIComponent(teamId)}`,
      {
        headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId },
        signal: controller.signal
      }
    )
      .then(async (response) => {
        const envelope = (await response.json()) as { data?: ProjectionResponse; code?: string };
        if (!response.ok) {
          const code = envelope.code ?? "W4-LOAD-ERROR";
          setStatus(
            code.includes("403")
              ? "permission"
              : code.includes("409")
                ? "conflict"
                : code.includes("404")
                  ? "dependency-missing"
                  : "retry"
          );
          throw new Error(code);
        }
        setProjection(envelope.data ?? null);
        const nextStatus = envelope.data?.state
          ? envelope.data.initiatives.some((initiative) => initiative.status === "blocked")
            ? "blocked"
            : envelope.data.closing_state_ref
              ? "ready"
              : "partial"
          : "empty";
        setStatus(nextStatus);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setNotice(error instanceof Error ? error.message : "W4 状态暂时不可用");
      });
    return () => controller.abort();
  }, [courseId, reloadVersion, roundNo, runId, teamId, tenantId, token]);

  async function submitProject(): Promise<void> {
    if (!runId || !roundNo || !teamId) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"}/api/v1/w4/runs/${runId}/rounds/${roundNo}/strategic-decisions`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            "x-tenant-id": tenantId
          },
          body: JSON.stringify({
            course_id: courseId,
            team_id: teamId,
            decision: {
              decision_id: `w4-project-${runId}-${roundNo}-${Date.now()}`,
              tenant_id: tenantId,
              course_id: courseId,
              run_id: runId,
              round_id: `round_${runId}_${roundNo}`,
              round_no: roundNo,
              team_id: teamId,
              kind: "new_project",
              version: 1,
              status: "canonical",
              payload: {
                project_name: projectName,
                cost: Number(cost),
                cycle_rounds: Number(leadTime) + 1,
                area: Number(beds) * 100,
                beds: Number(beds),
                bed_mix: {
                  standard: Math.round(Number(beds) * 0.6),
                  memory_care: Math.round(Number(beds) * 0.3),
                  premium: Math.round(Number(beds) * 0.1)
                },
                ramp: 0.4,
                lead_time_rounds: Number(leadTime)
              }
            }
          })
        }
      );
      const envelope = (await response.json()) as { code?: string };
      if (!response.ok) throw new Error(envelope.code ?? "W4-DECISION-ERROR");
      setNotice("New Project 已进入 Commitment 与 Initiative 流程");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "提交失败");
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel bff-panel" aria-label="W4 Enterprise State 学员工作区">
      <div className="panel-title">
        <h2>Enterprise State · New Project</h2>
        <span>{statusLabel(status)}</span>
      </div>
      <p className="evidence-note">
        当前只消费 Role BFF 投影；Opening State、Closing State 与 Initiative 由服务端维护。
      </p>
      {projection?.opening_state_ref ? (
        <div className="status-grid">
          <div>
            <span>Opening State</span>
            <strong>{projection.opening_state_ref.enterprise_state_id}</strong>
          </div>
          <div>
            <span>Commitment</span>
            <strong>{projection.commitments.length}</strong>
          </div>
          <div>
            <span>Initiative</span>
            <strong>{projection.initiatives.length}</strong>
          </div>
          <div>
            <span>Closing State</span>
            <strong>{projection.closing_state_ref?.enterprise_state_id ?? "待结算"}</strong>
          </div>
        </div>
      ) : null}
      {projection ? (
        <div className="status-grid">
          <div>
            <span>Process Information</span>
            <strong>{projection.process_information.status}</strong>
          </div>
          <div>
            <span>Outcome Information</span>
            <strong>{projection.outcome_information.status}</strong>
          </div>
        </div>
      ) : null}
      {projection?.initiatives.length ? (
        <ul className="tag-list">
          {projection.initiatives.map((initiative) => (
            <li key={initiative.initiative_id}>
              {initiative.project?.project_name ?? initiative.kind} · {initiative.status} · 剩余{" "}
              {initiative.remaining_lead_time_rounds} 回合
            </li>
          ))}
        </ul>
      ) : null}
      <fieldset disabled={busy || !token || !runId || !roundNo || !teamId}>
        <legend>新建战略项目（canonical decision）</legend>
        <label>
          项目名称
          <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
        </label>
        <label>
          成本
          <input type="number" value={cost} onChange={(event) => setCost(event.target.value)} />
        </label>
        <label>
          床位
          <input type="number" value={beds} onChange={(event) => setBeds(event.target.value)} />
        </label>
        <label>
          Lead time（回合）
          <input
            type="number"
            min="0"
            value={leadTime}
            onChange={(event) => setLeadTime(event.target.value)}
          />
        </label>
        <button onClick={() => void submitProject()}>提交 New Project Commitment</button>
      </fieldset>
      {status === "retry" || status === "dependency-missing" || status === "error" ? (
        <button type="button" onClick={() => setReloadVersion((value) => value + 1)}>
          重新加载 W4 状态
        </button>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
    </article>
  );
}
