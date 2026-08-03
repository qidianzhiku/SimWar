import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ApiEnvelope,
  CoursePackageVersionTeacherDto,
  LearningDesignListDto,
  LearningGoalVersion,
  RubricVersion
} from "@simwar/shared-contracts";

type WorkbenchProps = { tenantId: string; token: string };
type SurfaceState = { phase: "IDLE" | "LOADING" | "READY" | "ERROR"; message?: string };

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const EMPTY_DESIGN: LearningDesignListDto = {
  explicit_non_proofs: [],
  learning_goals: [],
  rubrics: [],
  runtime_authority: "JSON_INTERNAL_ONLY"
};

function authHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, "content-type": "application/json" };
}

export function LearningDesignWorkbench({ tenantId, token }: WorkbenchProps) {
  const [packages, setPackages] = useState<readonly CoursePackageVersionTeacherDto[]>([]);
  const [design, setDesign] = useState<LearningDesignListDto>(EMPTY_DESIGN);
  const [state, setState] = useState<SurfaceState>({ phase: "IDLE" });
  const [goalTitle, setGoalTitle] = useState("Market observation");
  const [goalStatement, setGoalStatement] = useState(
    "Compare observed demand with a stated hypothesis."
  );
  const [goalId, setGoalId] = useState("goal_measure_market");
  const [version, setVersion] = useState("1.0.0");
  const [revisionVersion, setRevisionVersion] = useState("2.0.0");
  const [activityId, setActivityId] = useState("activity_observe_v1");
  const [roleScope, setRoleScope] = useState("teacher");
  const [selectedPackageKey, setSelectedPackageKey] = useState("");

  const selectedPackage =
    packages.find(
      (candidate) =>
        `${candidate.course_package_reference.course_package_id}:${candidate.course_package_reference.version}` ===
        selectedPackageKey
    ) ?? packages[0];
  const packageReference = useMemo(
    () => selectedPackage?.course_package_reference,
    [selectedPackage]
  );

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      setState({ phase: "LOADING" });
      try {
        const headers = { ...authHeaders(token), "x-tenant-id": tenantId };
        const requestInit: RequestInit = { headers };
        if (signal) requestInit.signal = signal;
        const [packageResponse, designResponse] = await Promise.all([
          fetch(`${API_BASE}/api/v1/bff/teacher/course-package-versions`, requestInit),
          fetch(`${API_BASE}/api/v1/bff/teacher/learning-designs`, requestInit)
        ]);
        if (!packageResponse.ok || !designResponse.ok) throw new Error("D1 工作台读取失败");
        const packageEnvelope = (await packageResponse.json()) as ApiEnvelope<{
          course_package_versions: CoursePackageVersionTeacherDto[];
        }>;
        const designEnvelope = (await designResponse.json()) as ApiEnvelope<LearningDesignListDto>;
        setPackages(packageEnvelope.data.course_package_versions);
        setDesign(designEnvelope.data);
        setState({ phase: "READY" });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          phase: "ERROR",
          message: error instanceof Error ? error.message : "D1 工作台读取失败"
        });
      }
    },
    [tenantId, token]
  );

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  async function createGoal() {
    if (!packageReference) {
      setState({ phase: "ERROR", message: "请先准备一个 AVAILABLE CoursePackageVersion" });
      return;
    }
    setState({ phase: "LOADING" });
    const response = await fetch(`${API_BASE}/api/v1/bff/teacher/learning-goals/drafts`, {
      body: JSON.stringify({
        activity_refs: [
          {
            activity_id: activityId,
            content_digest: packageReference.content_digest,
            version: "1.0.0"
          }
        ],
        course_package_reference: packageReference,
        expected_evidence_classes: ["reflection"],
        goal_id: goalId,
        observable_behaviors: ["compare observed demand with a stated hypothesis"],
        role_scope: roleScope
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        statement: goalStatement,
        title: goalTitle,
        version
      }),
      headers: { ...authHeaders(token), "x-tenant-id": tenantId },
      method: "POST"
    });
    if (!response.ok) {
      setState({ phase: "ERROR", message: "Goal DRAFT 创建失败" });
      return;
    }
    await refresh();
  }

  async function reviseGoal(goal: LearningGoalVersion) {
    setState({ phase: "LOADING" });
    const response = await fetch(`${API_BASE}/api/v1/bff/teacher/learning-goals/revisions`, {
      body: JSON.stringify({
        source_reference: {
          content_digest: goal.content_digest,
          goal_id: goal.goal_id,
          tenant_id: goal.tenant_id,
          version: goal.version
        },
        version: revisionVersion
      }),
      headers: { ...authHeaders(token), "x-tenant-id": tenantId },
      method: "POST"
    });
    if (!response.ok) {
      setState({ phase: "ERROR", message: "LearningGoal 新版本创建失败" });
      return;
    }
    await refresh();
  }

  async function transitionGoal(
    goal: LearningGoalVersion,
    action: "validate" | "publish" | "reject"
  ) {
    setState({ phase: "LOADING" });
    await fetch(
      `${API_BASE}/api/v1/bff/teacher/learning-goals/${goal.goal_id}/versions/${goal.version}/${action}`,
      {
        body: JSON.stringify({ content_digest: goal.content_digest }),
        headers: { ...authHeaders(token), "x-tenant-id": tenantId },
        method: "POST"
      }
    );
    await refresh();
  }

  async function createRubric() {
    if (!packageReference) {
      setState({ phase: "ERROR", message: "请先准备一个 AVAILABLE CoursePackageVersion" });
      return;
    }
    const publishedGoal = design.learning_goals.find((goal) => goal.status === "PUBLISHED");
    if (!publishedGoal) {
      setState({ phase: "ERROR", message: "请先发布一个 LearningGoalVersion" });
      return;
    }
    setState({ phase: "LOADING" });
    const response = await fetch(`${API_BASE}/api/v1/bff/teacher/rubrics/drafts`, {
      body: JSON.stringify({
        course_package_reference: packageReference,
        criteria: [
          {
            criterion_id: "criterion_reasoning",
            levels: [
              { description: "evidence is connected", label: "developing", ordinal: 1 },
              { description: "evidence is qualified", label: "proficient", ordinal: 2 }
            ],
            prompt: "How clearly is evidence connected to the claim?"
          }
        ],
        learning_goal_references: [
          {
            content_digest: publishedGoal.content_digest,
            goal_id: publishedGoal.goal_id,
            tenant_id: publishedGoal.tenant_id,
            version: publishedGoal.version
          }
        ],
        rubric_id: "rubric_market_reasoning",
        title: "Market reasoning",
        version: "1.0.0"
      }),
      headers: { ...authHeaders(token), "x-tenant-id": tenantId },
      method: "POST"
    });
    if (!response.ok) {
      setState({ phase: "ERROR", message: "Rubric DRAFT 创建失败" });
      return;
    }
    await refresh();
  }

  async function transitionRubric(
    rubric: RubricVersion,
    action: "validate" | "publish" | "reject"
  ) {
    setState({ phase: "LOADING" });
    await fetch(
      `${API_BASE}/api/v1/bff/teacher/rubrics/${rubric.rubric_id}/versions/${rubric.version}/${action}`,
      {
        body: JSON.stringify({ content_digest: rubric.content_digest }),
        headers: { ...authHeaders(token), "x-tenant-id": tenantId },
        method: "POST"
      }
    );
    await refresh();
  }

  async function reviseRubric(rubric: RubricVersion) {
    setState({ phase: "LOADING" });
    const response = await fetch(`${API_BASE}/api/v1/bff/teacher/rubrics/revisions`, {
      body: JSON.stringify({
        source_reference: {
          content_digest: rubric.content_digest,
          rubric_id: rubric.rubric_id,
          tenant_id: rubric.tenant_id,
          version: rubric.version
        },
        version: revisionVersion
      }),
      headers: { ...authHeaders(token), "x-tenant-id": tenantId },
      method: "POST"
    });
    if (!response.ok) {
      setState({ phase: "ERROR", message: "Rubric 新版本创建失败" });
      return;
    }
    await refresh();
  }

  return (
    <section className="candidate-surface" aria-label="D1 Learning Goal and Rubric workbench">
      <div className="candidate-heading">
        <div>
          <p className="eyebrow">L1+ Program D · D1</p>
          <h2>Learning Goals &amp; Rubrics</h2>
        </div>
        <button
          className="secondary"
          onClick={() => void refresh()}
          disabled={state.phase === "LOADING"}
        >
          Refresh D1
        </button>
      </div>
      <p className="evidence-note">
        D1 只管理不可变 Goal/Rubric 版本与教师审核流。当前评分策略为
        NOT_ACTIVE_D1，不产生最终成绩，不写 Truth、Settlement、Score 或 Rank。
      </p>
      {state.phase === "ERROR" ? (
        <p className="readiness-message" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.phase === "LOADING" ? <p role="status">Loading D1 learning design...</p> : null}
      <div className="candidate-preview">
        <label>
          Approved CoursePackageVersion
          <select
            aria-label="D1 CoursePackageVersion"
            value={
              selectedPackage
                ? `${selectedPackage.course_package_reference.course_package_id}:${selectedPackage.course_package_reference.version}`
                : ""
            }
            onChange={(event) => setSelectedPackageKey(event.target.value)}
            disabled={state.phase === "LOADING" || packages.length === 0}
          >
            {packages.map((candidate) => (
              <option
                key={`${candidate.course_package_reference.course_package_id}:${candidate.course_package_reference.version}`}
                value={`${candidate.course_package_reference.course_package_id}:${candidate.course_package_reference.version}`}
              >
                {candidate.course_package_reference.course_package_id} /{" "}
                {candidate.course_package_reference.version}
              </option>
            ))}
          </select>
        </label>
        <label>
          Activity
          <input
            aria-label="D1 activity id"
            value={activityId}
            onChange={(event) => setActivityId(event.target.value)}
          />
        </label>
        <label>
          Role scope
          <input
            aria-label="D1 role scope"
            value={roleScope}
            onChange={(event) => setRoleScope(event.target.value)}
          />
        </label>
        <label>
          Goal ID
          <input
            aria-label="D1 goal id"
            value={goalId}
            onChange={(event) => setGoalId(event.target.value)}
          />
        </label>
        <label>
          Goal title
          <input
            aria-label="D1 goal title"
            value={goalTitle}
            onChange={(event) => setGoalTitle(event.target.value)}
          />
        </label>
        <label>
          Goal statement
          <input
            aria-label="D1 goal statement"
            value={goalStatement}
            onChange={(event) => setGoalStatement(event.target.value)}
          />
        </label>
        <label>
          Version
          <input
            aria-label="D1 goal version"
            value={version}
            onChange={(event) => setVersion(event.target.value)}
          />
        </label>
        <label>
          Revision version
          <input
            aria-label="D1 revision version"
            value={revisionVersion}
            onChange={(event) => setRevisionVersion(event.target.value)}
          />
        </label>
        <small>
          {packageReference
            ? `Using ${packageReference.course_package_id} / ${packageReference.version}`
            : "No AVAILABLE CoursePackageVersion"}
        </small>
        <button
          onClick={() => void createGoal()}
          disabled={state.phase === "LOADING" || !packageReference}
        >
          Create Goal DRAFT
        </button>
        <button
          className="secondary"
          onClick={() => void createRubric()}
          disabled={
            state.phase === "LOADING" ||
            !packageReference ||
            !design.learning_goals.some((goal) => goal.status === "PUBLISHED")
          }
        >
          Create Rubric DRAFT
        </button>
      </div>
      <div className="candidate-list">
        {design.learning_goals.map((goal) => (
          <article className="candidate-card" key={`${goal.goal_id}:${goal.version}`}>
            <span>{goal.status}</span>
            <strong>{goal.title}</strong>
            <small>
              {goal.goal_id} / {goal.version} / digest {goal.content_digest}
            </small>
            <p>{goal.statement}</p>
            {goal.status === "DRAFT" ? (
              <button className="secondary" onClick={() => void transitionGoal(goal, "validate")}>
                Validate
              </button>
            ) : null}
            {goal.status === "VALIDATED" ? (
              <button className="secondary" onClick={() => void transitionGoal(goal, "publish")}>
                Publish
              </button>
            ) : null}
            {goal.status === "DRAFT" || goal.status === "VALIDATED" ? (
              <button className="secondary" onClick={() => void transitionGoal(goal, "reject")}>
                Reject
              </button>
            ) : null}
            {goal.status === "PUBLISHED" ? (
              <button className="secondary" onClick={() => void reviseGoal(goal)}>
                Create Goal Revision
              </button>
            ) : null}
          </article>
        ))}
        {design.rubrics.map((rubric: RubricVersion) => (
          <article className="candidate-card" key={`${rubric.rubric_id}:${rubric.version}`}>
            <span>{rubric.status}</span>
            <strong>{rubric.title}</strong>
            <small>
              {rubric.rubric_id} / {rubric.version} / digest {rubric.content_digest}
            </small>
            <p>Scoring policy: {rubric.scoring_policy}</p>
            {rubric.status === "DRAFT" ? (
              <button
                className="secondary"
                onClick={() => void transitionRubric(rubric, "validate")}
              >
                Validate Rubric
              </button>
            ) : null}
            {rubric.status === "VALIDATED" ? (
              <button
                className="secondary"
                onClick={() => void transitionRubric(rubric, "publish")}
              >
                Publish Rubric
              </button>
            ) : null}
            {rubric.status === "DRAFT" || rubric.status === "VALIDATED" ? (
              <button className="secondary" onClick={() => void transitionRubric(rubric, "reject")}>
                Reject Rubric
              </button>
            ) : null}
            {rubric.status === "PUBLISHED" ? (
              <button className="secondary" onClick={() => void reviseRubric(rubric)}>
                Create Rubric Revision
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
