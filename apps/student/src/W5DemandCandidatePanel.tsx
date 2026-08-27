import type {
  W5GovernedDemandCandidateProjection,
  W5GovernedModelStudentProjection
} from "@simwar/shared-contracts";

export function formatW5DemandCandidate(candidate: W5GovernedDemandCandidateProjection): string {
  return [
    `受控需求候选：${candidate.status}`,
    `市场数=${candidate.market_count}`,
    candidate.markets
      .map((market) => `${market.market_id} outside=${market.outside_option_share.toFixed(4)}`)
      .join(" · "),
    "该候选不写入正式真值，REALIZED 仍由 Simulation Core 负责。"
  ].join(" · ");
}

export function W5DemandCandidatePanel({
  candidate
}: {
  candidate: W5GovernedDemandCandidateProjection;
}) {
  return (
    <p className="evidence-note" data-testid="student-governed-demand-candidate">
      {formatW5DemandCandidate(candidate)}
    </p>
  );
}

export function W5DemandConvergencePanel({
  projection
}: {
  projection: W5GovernedModelStudentProjection;
}) {
  const convergence = projection.convergence;
  const demand = convergence.demand_realization;

  return (
    <>
      <p className="evidence-note">
        {projection.visibility} · {demand.readiness} · CAN=
        {convergence.can.eligible ? "eligible" : "blocked"} · REALIZED=
        {convergence.realized.authority} ·{" "}
        {demand.explanation.map((item) => `${item.stage}: ${item.summary}`).join(" · ")} · 限制：
        {demand.known_limits.join(" · ")}
      </p>
      <W5DemandCandidatePanel candidate={demand.candidate} />
    </>
  );
}
