import type {
  W4CapitalAction,
  W4CapitalLifecycle,
  W4ProjectionBase
} from "@simwar/shared-contracts";
import { useState } from "react";

interface Props {
  token: string;
  tenantId: string;
  courseId: string;
  runId: string;
  roundId: string;
  roundNo: number;
  teamId: string;
  latestStrategicAction: W4ProjectionBase["latest_strategic_action"];
  capitalActions: W4CapitalAction[];
  capitalLifecycles: W4CapitalLifecycle[];
  onChanged: () => void;
}

function statusLabel(status: string): string {
  return (
    (
      {
        ELIGIBLE: "可提案",
        PROPOSED: "已提案",
        APPROVED: "已批准",
        EXECUTING: "执行中",
        CLOSED: "已关闭",
        WITHDRAWN: "已撤回",
        DEFAULTED: "已违约"
      } as Record<string, string>
    )[status] ?? status
  );
}

export function GovernedCapitalLifecycleWorkbench({
  token,
  tenantId,
  courseId,
  runId,
  roundId,
  roundNo,
  teamId,
  latestStrategicAction,
  capitalActions,
  capitalLifecycles,
  onChanged
}: Props) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const selectedCapitalAction = latestStrategicAction
    ? capitalActions.find((action) => action.decision_id === latestStrategicAction.decision_id)
    : undefined;
  const lifecycle = capitalLifecycles[0];
  const command = lifecycle
    ? lifecycle.status === "PROPOSED"
      ? "approve"
      : lifecycle.status === "APPROVED"
        ? "execute"
        : ""
    : "propose";

  async function advance(): Promise<void> {
    if (!latestStrategicAction || !command) return;
    setBusy(true);
    setNotice("");
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
      const path = lifecycle
        ? `/api/v1/w4/runs/${runId}/rounds/${roundNo}/capital-lifecycles/${lifecycle.lifecycle_id}/${command}`
        : `/api/v1/w4/runs/${runId}/rounds/${roundNo}/capital-lifecycles/propose`;
      const body = lifecycle
        ? {
            command_id: `teacher-capital-${command}-${Date.now()}`,
            course_id: courseId,
            team_id: teamId,
            round_id: roundId,
            ...(command === "execute" ? { decision_id: latestStrategicAction.decision_id } : {})
          }
        : {
            command_id: `teacher-capital-propose-${Date.now()}`,
            lifecycle_id: `teacher-capital-lifecycle-${Date.now()}`,
            decision_id: latestStrategicAction.decision_id,
            instrument: "loan",
            principal: selectedCapitalAction?.principal ?? Math.max(0, latestStrategicAction.cost),
            cost_bps: selectedCapitalAction?.rate_or_cost_bps ?? 250,
            fee: selectedCapitalAction?.fees ?? 10,
            term_rounds: selectedCapitalAction?.term_rounds ?? 2,
            covenant_min_cash: selectedCapitalAction?.covenant_min_cash ?? 500,
            source_digest: "teacher-ui-capital-source-v1",
            course_id: courseId,
            team_id: teamId,
            round_id: roundId
          };
      const response = await fetch(apiBase + path, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-tenant-id": tenantId
        },
        body: JSON.stringify(body)
      });
      const envelope = (await response.json()) as { code?: string; data?: { status?: string } };
      if (!response.ok) throw new Error(envelope.code ?? "W4-CAPITAL-LIFECYCLE-ERROR");
      setNotice(`治理资本生命周期已更新：${envelope.data?.status ?? command}`);
      onChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "治理资本生命周期更新失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sw-w4-panel__note" aria-label="治理资本生命周期工作台">
      <strong>治理资本生命周期工作台</strong>
      {capitalLifecycles.length ? (
        <ul className="sw-w4-list" aria-label="治理资本生命周期列表">
          {capitalLifecycles.map((item) => (
            <li key={item.lifecycle_id}>
              {item.instrument} · {statusLabel(item.status)} · 本金 {item.principal} ·{" "}
              {item.transition_history.length} 次迁移
            </li>
          ))}
        </ul>
      ) : (
        <p>尚未创建治理资本提案。</p>
      )}
      {latestStrategicAction?.kind === "capital_action" &&
      selectedCapitalAction?.status !== "blocked" &&
      (!capitalLifecycles.length ||
        lifecycle?.status === "PROPOSED" ||
        lifecycle?.status === "APPROVED") ? (
        <button
          className="sw-w4-panel__action"
          type="button"
          disabled={busy}
          onClick={() => void advance()}
        >
          {busy
            ? "正在更新治理状态"
            : !capitalLifecycles.length
              ? "创建治理资本提案"
              : lifecycle?.status === "PROPOSED"
                ? "批准治理资本提案"
                : "进入资本执行状态"}
        </button>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      <p>教师可以推进提案、批准与执行；正式现金和结算仍只由现有 W4 service 写入。</p>
    </section>
  );
}
