import { useEffect, useState } from "react";
import type { ApiEnvelope, FreshLearnerAdmissionReadiness } from "@simwar/shared-contracts";

type Props = {
  apiBase: string;
  courseId?: string | undefined;
  runId?: string | undefined;
  teamIds: string[];
  tenantId: string;
  token: string;
};

export function FreshLearnerAdmissionPanel({
  apiBase,
  courseId,
  runId,
  teamIds,
  tenantId,
  token
}: Props) {
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [readiness, setReadiness] = useState<FreshLearnerAdmissionReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const teamIdsKey = teamIds.join(",");

  useEffect(() => {
    if (!courseId || !runId || teamIds.length === 0) {
      setPhase("idle");
      setReadiness(null);
      return;
    }
    const controller = new AbortController();
    setPhase("loading");
    setError(null);
    const query = new URLSearchParams({ course_id: courseId, run_id: runId });
    query.set("team_ids", teamIdsKey);
    fetch(`${apiBase}/api/v1/bff/teacher/fresh-learner-admission?${query.toString()}`, {
      headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId },
      signal: controller.signal
    })
      .then(async (response) => {
        const envelope = (await response.json()) as ApiEnvelope<FreshLearnerAdmissionReadiness>;
        if (!response.ok) throw new Error(`${envelope.code}: ${envelope.message}`);
        return envelope.data;
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setReadiness(data);
          setPhase("ready");
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "admission readiness unavailable");
          setPhase("error");
        }
      });
    return () => controller.abort();
  }, [apiBase, courseId, runId, teamIdsKey, tenantId, token]);

  return (
    <section className="panel bff-panel" aria-label="Fresh learner E4 admission readiness">
      <div className="panel-title">
        <h2>Fresh Learner E4 入场准备</h2>
        <span>{readiness?.admission_status ?? phase}</span>
      </div>
      {phase === "idle" ? (
        <p className="muted">选择 exact Course / Run / Team 后读取准备状态。</p>
      ) : null}
      {phase === "loading" ? <p role="status">正在读取队伍成员与角色准备状态。</p> : null}
      {phase === "error" ? <p role="alert">{error}</p> : null}
      {readiness ? (
        <>
          <div className="status-grid">
            <div>
              <span>Teams</span>
              <strong>{readiness.team_count}</strong>
            </div>
            <div>
              <span>Fresh learners</span>
              <strong>{readiness.fresh_learner_count}</strong>
            </div>
            <div>
              <span>Roster</span>
              <strong>
                {readiness.assigned_roster_count}/{readiness.required_roster_count}
              </strong>
            </div>
            <div>
              <span>Auth</span>
              <strong>{readiness.auth_ready ? "ready" : "blocked"}</strong>
            </div>
          </div>
          <div className="table">
            {readiness.teams.map((team) => (
              <div className="table-row" key={team.team_id}>
                <span>{team.team_name}</span>
                <span>
                  {team.member_count}/{team.required_member_count} members
                </span>
                <span>{team.assigned_role_count}/4 roles</span>
                <strong>{team.ready ? "ready" : "blocked"}</strong>
              </div>
            ))}
          </div>
          <ul className="tag-list">
            {readiness.known_limits.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
