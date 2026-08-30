import { useEffect, useState } from "react";
import type {
  ApiEnvelope,
  CourseFactoryTeacherCatalogProjection
} from "@simwar/shared-contracts";

export interface CourseFactoryCatalogPanelProps {
  apiBase: string;
  tenantId: string;
  token: string;
}

export function CourseFactoryCatalogPanel({
  apiBase,
  tenantId,
  token
}: CourseFactoryCatalogPanelProps) {
  const [projection, setProjection] = useState<CourseFactoryTeacherCatalogProjection | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    void fetch(apiBase + "/api/v1/bff/teacher/course-factory/catalog", {
      headers: {
        authorization: "Bearer " + token,
        "x-tenant-id": tenantId
      },
      signal: controller.signal
    })
      .then(async (response) => {
        const envelope = (await response.json()) as ApiEnvelope<CourseFactoryTeacherCatalogProjection>;
        if (!response.ok) throw new Error(envelope.message || envelope.code);
        return envelope.data;
      })
      .then((nextProjection) => {
        if (controller.signal.aborted) return;
        setProjection(nextProjection);
        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, [apiBase, tenantId, token]);

  return (
    <section aria-labelledby="teacher-course-factory-heading" className="panel">
      <div className="panel-title">
        <h3 id="teacher-course-factory-heading">Governed Course Catalog</h3>
        <span>Teacher-safe · published only</span>
      </div>
      {status === "loading" ? <p role="status">正在读取课程工厂 Catalog…</p> : null}
      {status === "error" ? (
        <p role="alert">课程工厂 Catalog 暂时不可用；当前 Teacher 工作区不受影响。</p>
      ) : null}
      {status === "ready" && projection?.catalog.length === 0 ? (
        <p>当前没有已发布的 governed course version。</p>
      ) : null}
      {projection?.catalog.length ? (
        <ul aria-label="Teacher governed course catalog">
          {projection.catalog.map((entry) => (
            <li key={entry.course_package_reference.course_package_id + ":" + entry.version}>
              <strong>{entry.title}</strong>
              <span>
                {" "}
                · {entry.version} · {entry.status}
              </span>
              <small>exact package digest: {entry.course_package_reference.content_digest}</small>
              {entry.source_context ? (
                <>
                  <small>
                    source refs: blueprint {entry.source_context.source_reference_versions.course_blueprint},
                    scenario {entry.source_context.source_reference_versions.scenario_package},
                    parameter {entry.source_context.source_reference_versions.parameter_set}
                  </small>
                  <small data-testid="m30-teacher-source-evidence">
                    上海 → 杭州 · qualification:{" "}
                    {entry.source_context.qualification_status} · calibration: NOT_PROVEN · exact
                    binding required
                  </small>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {projection ? (
        <ul aria-label="Teacher course factory known limits">
          {projection.known_limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
