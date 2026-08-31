import { useEffect, useRef, useState } from "react";
import type { W020AdvisoryReceipt, W020AdvisorySurface } from "@simwar/shared-contracts";

export interface GovernedIntelligenceWorkspaceProps {
  apiBase: string;
  tenantId: string;
  token: string;
  runId?: string | undefined;
  roundId?: string | undefined;
  teamId?: string | undefined;
  teamIds?: string[] | undefined;
}

const actions: readonly {
  label: string;
  path: string;
  surface: Exclude<W020AdvisorySurface, "student_role" | "student_coach">;
}[] = [
  {
    label: "请求 Teacher Copilot",
    path: "/api/v1/bff/teacher/intelligence/copilot",
    surface: "teacher_copilot"
  },
  {
    label: "生成 Debrief Rubric Assistant",
    path: "/api/v1/bff/teacher/intelligence/rubric",
    surface: "rubric_assistant"
  },
  {
    label: "运行 Competitive Challenge",
    path: "/api/v1/bff/teacher/intelligence/challenge/competitive",
    surface: "competitive_challenge"
  },
  {
    label: "运行 Stakeholder Challenge",
    path: "/api/v1/bff/teacher/intelligence/challenge/stakeholder",
    surface: "stakeholder_challenge"
  }
];

function envelope(value: unknown): W020AdvisoryReceipt {
  if (!value || typeof value !== "object" || !("data" in value))
    throw new Error("intelligence response invalid");
  const data = (value as { data?: unknown }).data;
  if (!data || typeof data !== "object") throw new Error("intelligence response missing");
  return data as W020AdvisoryReceipt;
}

export function resolveGovernedIntelligenceTeamId(
  teamId: string | undefined,
  teamIds: readonly string[] | undefined,
  currentTeamId: string,
  contextChanged: boolean
): string {
  const availableTeamIds = teamIds ?? [];
  const preferredTeamId =
    teamId && (availableTeamIds.length === 0 || availableTeamIds.includes(teamId))
      ? teamId
      : (availableTeamIds[0] ?? "");
  if (contextChanged) return preferredTeamId;
  if (
    !currentTeamId ||
    (availableTeamIds.length > 0 && !availableTeamIds.includes(currentTeamId))
  ) {
    return preferredTeamId;
  }
  return currentTeamId;
}

export function GovernedIntelligenceWorkspace({
  apiBase,
  tenantId,
  token,
  runId,
  roundId,
  teamId,
  teamIds
}: GovernedIntelligenceWorkspaceProps) {
  const [selectedTeamId, setSelectedTeamId] = useState(teamId ?? "");
  const contextKey = [runId ?? "", roundId ?? "", teamId ?? "", ...(teamIds ?? [])].join("\u001f");
  const previousContextKey = useRef(contextKey);
  const [busy, setBusy] = useState<W020AdvisorySurface | null>(null);
  const [receipt, setReceipt] = useState<W020AdvisoryReceipt | null>(null);
  const [message, setMessage] = useState("等待精确 Course / Run / Round / Team 上下文");

  useEffect(() => {
    const contextChanged = previousContextKey.current !== contextKey;
    previousContextKey.current = contextKey;
    setSelectedTeamId((current) =>
      resolveGovernedIntelligenceTeamId(teamId, teamIds, current, contextChanged)
    );
  }, [contextKey, runId, roundId, teamId, teamIds]);

  async function request(surface: (typeof actions)[number]): Promise<void> {
    if (!runId || !roundId || !selectedTeamId) {
      setMessage("等待精确 Course / Run / Round / Team 上下文");
      return;
    }
    setBusy(surface.surface);
    setMessage("正在运行受治理辅助…");
    try {
      const response = await fetch(`${apiBase}${surface.path}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-tenant-id": tenantId
        },
        body: JSON.stringify({
          discriminator: "w020_advisory_request",
          idempotency_key: `w6:${surface.surface}:${runId}:${roundId}:${selectedTeamId}`,
          round_id: roundId,
          run_id: runId,
          surface: surface.surface,
          team_id: selectedTeamId
        })
      });
      const next = envelope(await response.json());
      if (!response.ok) throw new Error("governed intelligence request rejected");
      setReceipt(next);
      setMessage(next.status === "reused" ? "已复用有界辅助结果" : "已生成有界辅助结果");
    } catch (error) {
      setReceipt(null);
      setMessage(error instanceof Error ? error.message : "governed intelligence request failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="candidate-surface" aria-label="Governed Intelligence Workspace">
      <div className="candidate-heading">
        <div>
          <p className="eyebrow">W6 Governed Intelligence</p>
          <h2>Teacher Copilot · Debrief · Bounded Challenge</h2>
        </div>
        <span>Provider OFF · advisory-only</span>
      </div>
      <p className="evidence-note">
        所有输出绑定精确上下文并展示 evidence citation、评估、fallback 与 policy；Human review
        remains the final authority。
      </p>
      <p className="lifecycle-status">
        Exact context: run {runId ?? "未选择"} · round {roundId ?? "未选择"} · team{" "}
        {selectedTeamId || "未选择"}
      </p>
      {teamIds && teamIds.length > 0 ? (
        <label className="field-label">
          <span>Team scope</span>
          <select
            aria-label="W6 intelligence team"
            value={selectedTeamId}
            onChange={(event) => setSelectedTeamId(event.target.value)}
          >
            {teamIds.map((candidate) => (
              <option key={candidate}>{candidate}</option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="button-row" aria-label="W6 intelligence actions">
        {actions.map((action) => (
          <button
            key={action.surface}
            disabled={busy !== null}
            onClick={() => void request(action)}
          >
            {busy === action.surface ? "运行中…" : action.label}
          </button>
        ))}
      </div>
      <p role="status">{message}</p>
      {receipt ? (
        <article className="candidate-preview" aria-label="W6 intelligence receipt">
          <strong>{receipt.projection.title}</strong>
          <p>{receipt.projection.recommendations[0]}</p>
          <p>
            evaluation: {receipt.projection.evaluation.status} · fallback:{" "}
            {receipt.projection.evaluation.fallback} · Provider OFF
          </p>
          <ul aria-label="evidence citations">
            {receipt.projection.evidence_citations.map((citation) => (
              <li key={citation.citation_id}>
                {citation.label} · {citation.source_id}
              </li>
            ))}
          </ul>
          <small>Human review remains the final authority; formal_truth_write: false</small>
        </article>
      ) : null}
    </section>
  );
}

export default GovernedIntelligenceWorkspace;
