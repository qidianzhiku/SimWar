import { useCallback, useEffect, useMemo, useState } from "react";

type AdoptionReference = { adoption_id: string; adoption_digest: string };
type Blocker = { code: string; course_id: string | null; related_ids: string[] };
type PortfolioCourse = {
  course: { course_id: string; tenant_id: string; title: string };
  blockers: Blocker[];
  current_adoption: AdoptionReference | null;
  qualification: { qualification_id: string; content_digest: string } | null;
  qualification_consistency: string;
  known_limits: string[];
  o8_outcomes: Array<{
    outcome_status: string;
    current_effect: string;
    resolution_id: string;
  }>;
};
type Portfolio = {
  tenant_id: string;
  courses: PortfolioCourse[];
  blockers: Blocker[];
  portfolio_state_digest: string;
  portfolio_status: "READY" | "BLOCKED";
  derived: true;
  query_only: true;
  provider: "OFF";
  known_limits: string[];
};
type Preview = {
  status: string;
  blockers: string[];
  course_previews: Array<{
    course_id: string;
    status: string;
    reasons: string[];
    current_adoption: AdoptionReference | null;
  }>;
  expected_portfolio_state_digest: string;
  current_portfolio_state_digest: string;
  preview_applied: false;
  query_only: true;
  derived: true;
};

interface Envelope<T> {
  data: T;
}

export interface ModelQualificationCoursePortfolioPanelProps {
  apiBase: string;
  tenantId: string;
  token: string;
}

function endpoint(apiBase: string, path: string): string {
  return `${apiBase.replace(/\/$/u, "")}${path}`;
}

async function readEnvelope<T>(response: Response): Promise<T> {
  const body = (await response.json()) as Envelope<T>;
  if (!response.ok || !body?.data) throw new Error(`O9_PORTFOLIO_HTTP_${response.status}`);
  return body.data;
}

export function ModelQualificationCoursePortfolioPanel({
  apiBase,
  tenantId,
  token
}: ModelQualificationCoursePortfolioPanelProps) {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [message, setMessage] = useState("");

  const requestInit = useMemo(
    () => ({
      headers: {
        authorization: `Bearer ${token}`,
        "x-tenant-id": tenantId
      }
    }),
    [tenantId, token]
  );

  const loadPortfolio = useCallback(async () => {
    setStatus("loading");
    setMessage("");
    setPreview(null);
    try {
      const response = await fetch(
        endpoint(apiBase, "/api/v1/bff/admin/model-qualification/course-portfolio"),
        requestInit
      );
      const next = await readEnvelope<Portfolio>(response);
      setPortfolio(next);
      setSelectedCourseIds(next.courses.slice(0, 1).map((entry) => entry.course.course_id));
      setStatus(next.courses.length === 0 ? "empty" : "ready");
    } catch {
      setPortfolio(null);
      setStatus("error");
      setMessage("课程组合暂时无法读取，请保持当前租户范围后重试。");
    }
  }, [apiBase, requestInit]);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

  const toggleCourse = (courseId: string) => {
    setSelectedCourseIds((current) =>
      current.includes(courseId)
        ? current.filter((id) => id !== courseId)
        : [...current, courseId].sort((left, right) => left.localeCompare(right))
    );
    setPreview(null);
  };

  const previewSelection = async () => {
    if (!portfolio || selectedCourseIds.length === 0) return;
    setMessage("");
    try {
      const response = await fetch(
        endpoint(
          apiBase,
          "/api/v1/bff/admin/model-qualification/course-portfolio/supersession-preview"
        ),
        {
          ...requestInit,
          method: "POST",
          headers: { ...requestInit.headers, "content-type": "application/json" },
          body: JSON.stringify({
            course_ids: selectedCourseIds,
            expected_portfolio_state_digest: portfolio.portfolio_state_digest
          })
        }
      );
      const next = await readEnvelope<Preview>(response);
      setPreview(next);
      if (next.status === "REBASE_REQUIRED") {
        setMessage("组合状态已变化，请重新加载后再查看精确预览。");
      }
    } catch {
      setMessage("预览读取失败；未执行任何组合或治理变更，请重试。");
    }
  };

  return (
    <section
      id="admin-model-qualification-portfolio"
      className="o9-course-portfolio"
      aria-labelledby="admin-model-qualification-portfolio-heading"
    >
      <div className="panel-title">
        <div>
          <p className="eyebrow">O9 · Model Qualification</p>
          <h2 id="admin-model-qualification-portfolio-heading">模型资格课程组合</h2>
        </div>
        <span className="o9-query-badge">derived · query-only · Provider OFF</span>
      </div>
      <p className="o9-boundary">
        课程成员来自当前租户 Course
        Authority；本视图只读取逐课治理状态，不创建课程、不执行采纳、回退或批量变更。
      </p>

      {status === "loading" ? <p role="status">正在读取当前租户课程组合…</p> : null}
      {status === "error" ? (
        <div className="o9-state-panel o9-error" role="alert">
          <p>{message}</p>
          <button type="button" onClick={() => void loadPortfolio()}>
            重新加载
          </button>
        </div>
      ) : null}
      {status === "empty" ? (
        <div className="o9-state-panel">
          <p>当前租户没有可展示的授权课程。</p>
          <button type="button" onClick={() => void loadPortfolio()}>
            刷新
          </button>
        </div>
      ) : null}

      {portfolio && status === "ready" ? (
        <>
          <div className="o9-portfolio-summary" aria-label="课程组合摘要">
            <span>租户：{portfolio.tenant_id}</span>
            <span>状态：{portfolio.portfolio_status}</span>
            <code>{portfolio.portfolio_state_digest}</code>
          </div>
          {portfolio.blockers.length > 0 ? (
            <div className="o9-state-panel o9-warning" role="status">
              组合存在 {portfolio.blockers.length} 个完整性限制；下方课程卡片保留具体原因。
            </div>
          ) : null}
          <div className="o9-course-grid">
            {portfolio.courses.map((entry) => {
              const courseId = entry.course.course_id;
              const selected = selectedCourseIds.includes(courseId);
              return (
                <article className="panel o9-course-card" key={courseId}>
                  <label className="o9-course-select">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleCourse(courseId)}
                    />
                    <span>
                      <strong>{entry.course.title}</strong>
                      <small>{courseId}</small>
                    </span>
                  </label>
                  <dl>
                    <dt>资格一致性</dt>
                    <dd>{entry.qualification_consistency}</dd>
                    <dt>当前采纳</dt>
                    <dd>{entry.current_adoption?.adoption_id ?? "无精确当前采纳"}</dd>
                    <dt>Qualification</dt>
                    <dd>{entry.qualification?.qualification_id ?? "未解析"}</dd>
                  </dl>
                  {entry.blockers.length > 0 ? (
                    <ul className="o9-blockers">
                      {entry.blockers.map((blocker) => (
                        <li key={`${blocker.code}-${blocker.course_id ?? "portfolio"}`}>
                          {blocker.code}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {entry.o8_outcomes.length > 0 ? (
                    <p className="o9-outcome-note">
                      O8 outcome：
                      {entry.o8_outcomes.map((outcome) => outcome.outcome_status).join("、")}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
          <div className="o9-actions">
            <button type="button" onClick={() => void loadPortfolio()}>
              重新读取组合
            </button>
            <button
              type="button"
              disabled={selectedCourseIds.length === 0}
              onClick={() => void previewSelection()}
            >
              生成选中课程的只读 Supersession Preview
            </button>
          </div>
          {preview ? (
            <section className="o9-preview" aria-live="polite" aria-label="Supersession Preview">
              <h3>只读预览：{preview.status}</h3>
              <p>
                expected={preview.expected_portfolio_state_digest}；current=
                {preview.current_portfolio_state_digest}
              </p>
              <p>preview_applied=false · 不写入治理或正式真值。</p>
              {preview.course_previews.map((course) => (
                <div className="o9-preview-row" key={course.course_id}>
                  <strong>{course.course_id}</strong>
                  <span>{course.status}</span>
                  {course.reasons.length > 0 ? <small>{course.reasons.join("、")}</small> : null}
                </div>
              ))}
            </section>
          ) : null}
          {message ? (
            <p className="o9-recovery-message" role="status">
              {message}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
