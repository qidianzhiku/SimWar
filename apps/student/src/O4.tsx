import { lazy, Suspense } from "react";

const O4CrossRoundDynamicsPanel = lazy(() =>
  import("@simwar/ui/o4-cross-round-dynamics-panel")
);

type StudentO4Context = readonly [
  { access_token: string } | null | undefined,
  { course_id: string; run_id: string } | null | undefined,
  { team_id: string } | null | undefined,
  string
];

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

const O4_ENABLED =
  import.meta.env.VITE_SIMWAR_O4_ENABLED === "true" ||
  (typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("o4") === "true");

export function O4CrossRoundDynamicsFeature({ c }: { c: StudentO4Context }) {
  const [activeSession, latestRun, team, tenantId] = c;
  if (!O4_ENABLED || !activeSession || !latestRun || !team) return null;
  return (
    <Suspense fallback={<p className="muted">正在载入 O4 跨回合动力…</p>}>
      <O4CrossRoundDynamicsPanel
        apiBase={API_BASE}
        courseId={latestRun.course_id}
        runId={latestRun.run_id}
        surface="student"
        teamId={team.team_id}
        tenantId={tenantId}
        token={activeSession.access_token}
      />
    </Suspense>
  );
}

export default O4CrossRoundDynamicsFeature;
