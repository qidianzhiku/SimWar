import { useCallback, useEffect, useState } from "react";
import type {
  ApiEnvelope,
  MarketWorldRef,
  ProjectProfile,
  ProjectProfileTeacherProjection,
  TeacherMarketWorldProjection
} from "@simwar/shared-contracts";

interface ProjectLibraryPanelProps {
  apiBase: string;
  courseId: string | null | undefined;
  runId: string | null | undefined;
  tenantId: string;
  token: string;
  teamIds?: readonly string[];
}

type PanelState =
  | { phase: "idle" | "loading" }
  | { phase: "ready"; profiles: ProjectProfileTeacherProjection[]; marketWorld: MarketWorldRef }
  | { phase: "error"; message: string };

async function readEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) throw new Error(`${String(envelope.code)}: ${envelope.message}`);
  return envelope;
}

function reference(profile: ProjectProfileTeacherProjection) {
  return profile.project_profile_reference;
}

export function ProjectLibraryPanel({
  apiBase,
  courseId,
  runId,
  tenantId,
  token,
  teamIds = []
}: ProjectLibraryPanelProps) {
  const [state, setState] = useState<PanelState>({ phase: "idle" });
  const [busy, setBusy] = useState(false);
  const [teamId, setTeamId] = useState(teamIds[0] ?? "team_alpha");
  const [title, setTitle] = useState("Shanghai Care Project");
  const [profileId, setProfileId] = useState("shanghai-project-teacher");
  const [description, setDescription] = useState("Safe normalized teaching project.");
  const teamIdsKey = teamIds.join("\u0000");

  useEffect(() => {
    const fallback = teamIds[0] ?? "team_alpha";
    setTeamId((current) => (teamIds.includes(current) ? current : fallback));
  }, [courseId, teamIdsKey]);

  const load = useCallback(async () => {
    if (!courseId || !token) {
      setState({ phase: "idle" });
      return;
    }
    setState({ phase: "loading" });
    try {
      const headers = { authorization: `Bearer ${token}`, "x-tenant-id": tenantId };
      const [libraryResponse, marketWorldResponse] = await Promise.all([
        fetch(
          `${apiBase}/api/v1/bff/teacher/courses/${encodeURIComponent(courseId)}/project-library`,
          {
            headers
          }
        ),
        fetch(
          `${apiBase}/api/v1/bff/teacher/courses/${encodeURIComponent(courseId)}/market-world`,
          {
            headers
          }
        )
      ]);
      const library = await readEnvelope<{ profiles: ProjectProfileTeacherProjection[] }>(
        libraryResponse
      );
      const marketWorld = await readEnvelope<TeacherMarketWorldProjection>(marketWorldResponse);
      const exact = marketWorld.data.available_market_worlds[0]?.market_world_reference;
      if (!exact) throw new Error("MARKET_WORLD_EXACT_REFERENCE_MISSING");
      setState({ phase: "ready", marketWorld: exact, profiles: library.data.profiles });
    } catch (error) {
      setState({
        phase: "error",
        message: error instanceof Error ? error.message : "Project Library 暂不可用"
      });
    }
  }, [apiBase, courseId, tenantId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createDraft(): Promise<void> {
    if (state.phase !== "ready" || !courseId || busy) return;
    setBusy(true);
    try {
      const response = await fetch(
        `${apiBase}/api/v1/bff/teacher/courses/${encodeURIComponent(courseId)}/project-library`,
        {
          body: JSON.stringify({
            project_profile: {
              customer_segment: "上海城市养老照护家庭",
              description,
              geography: "Shanghai",
              industry: "eldercare",
              market_world_reference: state.marketWorld,
              positioning: "连续可信的照护服务",
              project_profile_id: profileId,
              service_bundle: "社区照护与居家支持",
              starting_capacity: 100,
              starting_cash: 100000,
              template_id: "shanghai-eldercare-safe-v1",
              title,
              version: `2026-08-21.${Date.now()}`
            }
          }),
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            "x-tenant-id": tenantId
          },
          method: "POST"
        }
      );
      await readEnvelope<ProjectProfile>(response);
      await load();
    } catch (error) {
      setState({
        phase: "error",
        message: error instanceof Error ? error.message : "Project Profile 创建失败"
      });
    } finally {
      setBusy(false);
    }
  }

  async function validate(profile: ProjectProfileTeacherProjection): Promise<void> {
    if (state.phase !== "ready" || !courseId || busy) return;
    setBusy(true);
    try {
      const response = await fetch(
        `${apiBase}/api/v1/bff/teacher/courses/${encodeURIComponent(courseId)}/project-library/validate`,
        {
          body: JSON.stringify({ project_profile_ref: reference(profile) }),
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            "x-tenant-id": tenantId
          },
          method: "POST"
        }
      );
      await readEnvelope<ProjectProfile>(response);
      await load();
    } catch (error) {
      setState({ phase: "error", message: error instanceof Error ? error.message : "校验失败" });
    } finally {
      setBusy(false);
    }
  }

  async function assign(profile: ProjectProfileTeacherProjection): Promise<void> {
    if (state.phase !== "ready" || !courseId || !runId || busy) return;
    setBusy(true);
    try {
      const response = await fetch(
        `${apiBase}/api/v1/bff/teacher/courses/${encodeURIComponent(courseId)}/project-library/assign`,
        {
          body: JSON.stringify({
            project_profile_ref: reference(profile),
            run_id: runId,
            team_id: teamId
          }),
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            "x-tenant-id": tenantId
          },
          method: "POST"
        }
      );
      await readEnvelope(response);
      await load();
    } catch (error) {
      setState({
        phase: "error",
        message: error instanceof Error ? error.message : "Assignment 失败"
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="summary-panel" aria-label="Project Library and assignment">
      <div className="summary-heading">
        <div>
          <p className="eyebrow">M2-P2 · W1 configuration seam</p>
          <h2>Project Library · Playable Company</h2>
        </div>
        {state.phase === "ready" ? <strong className="summary-badge">EXACT REF</strong> : null}
      </div>
      {state.phase === "idle" ? <p className="muted">选择课程后加载项目档案库。</p> : null}
      {state.phase === "loading" ? <p role="status">正在读取项目档案与 MarketWorldRef…</p> : null}
      {state.phase === "error" ? (
        <div className="summary-error" role="alert">
          <strong>Project Library 读取失败</strong>
          <span>{state.message}</span>
          <button type="button" className="secondary" onClick={() => void load()}>
            重试
          </button>
        </div>
      ) : null}
      {state.phase === "ready" ? (
        <>
          <div className="summary-grid">
            <article>
              <span>档案数</span>
              <strong>{state.profiles.length}</strong>
            </article>
            <article>
              <span>MarketWorld</span>
              <strong>{state.marketWorld.version}</strong>
            </article>
            <article>
              <span>运行时权威</span>
              <strong>CoursePackage / Run Binding</strong>
            </article>
          </div>
          <div className="form-grid">
            <label>
              项目标题
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              项目标识
              <input value={profileId} onChange={(event) => setProfileId(event.target.value)} />
            </label>
            <label>
              描述
              <input value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <label>
              Assignment 队伍
              <select value={teamId} onChange={(event) => setTeamId(event.target.value)}>
                {(teamIds.length ? teamIds : ["team_alpha"]).map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {candidate}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="button" disabled={busy} onClick={() => void createDraft()}>
            {busy ? "处理中…" : "新增安全项目档案"}
          </button>
          <div className="summary-grid" role="region" aria-label="project profiles">
            {state.profiles.map((profile) => (
              <article
                key={`${profile.project_profile_reference.project_profile_id}:${profile.version}`}
              >
                <span>{profile.title}</span>
                <strong>{profile.status}</strong>
                <small>{profile.version}</small>
                <small>{profile.readiness.join(" · ")}</small>
                {profile.status === "DRAFT" ? (
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => void validate(profile)}
                  >
                    校验并冻结来源
                  </button>
                ) : null}
                {profile.status === "VALIDATED" ? (
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy || !runId}
                    onClick={() => void assign(profile)}
                  >
                    分配到当前 Run / Team
                  </button>
                ) : null}
              </article>
            ))}
          </div>
          <p className="evidence-note">
            Project Profile 只解释来源与安全配置；不会直接写 W4 Enterprise
            State、结算、分数、排名或其他队伍数据。
          </p>
        </>
      ) : null}
    </section>
  );
}
