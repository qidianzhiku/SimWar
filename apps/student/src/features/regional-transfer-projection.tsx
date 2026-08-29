import { useEffect, useState } from "react";
import type { RegionalTransferStudentProjection } from "@simwar/shared-contracts";
import { WorkbenchFrame } from "@simwar/ui";
import { loadRegionalTransferStudentProjection } from "./regional-transfer-client";

export function RegionalTransferProjection({
  apiBase,
  candidateId,
  token
}: {
  apiBase: string;
  candidateId: string;
  token: string;
}) {
  const [projection, setProjection] = useState<RegionalTransferStudentProjection | null>(null);
  const [state, setState] = useState("WAITING_FOR_PUBLISHED_CANDIDATE");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!candidateId) {
      setProjection(null);
      setState("WAITING_FOR_PUBLISHED_CANDIDATE");
      return;
    }
    const controller = new AbortController();
    setState("LOADING");
    setError("");
    void loadRegionalTransferStudentProjection(apiBase, token, candidateId)
      .then((next) => {
        if (controller.signal.aborted) return;
        setProjection(next);
        setState(next.status);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setProjection(null);
        setState("NOT_AVAILABLE");
        setError(
          cause instanceof Error ? cause.message : "regional transfer projection unavailable"
        );
      });
    return () => controller.abort();
  }, [apiBase, candidateId, token]);

  return (
    <WorkbenchFrame
      className="candidate-surface regional-transfer-student-projection"
      ariaLabel="Student regional transfer projection"
      eyebrow="MAIN · RT-O1"
      title="区域场景学习提示"
      badge="published · role-safe"
      boundary="Student 只接收已激活 candidate 的有限上下文，不接收 provenance digest、Teacher/Admin 审计字段、私有数据或任何正式结算真值。"
      headingClassName="panel-title"
      state={<p aria-live="polite">状态：{state}</p>}
    >
      {error ? (
        <p className="d6-error" role="alert">
          {error}
        </p>
      ) : null}
      {projection ? (
        <>
          <p>
            当前回合：{projection.context.round_no} · Run {projection.context.run_id}
          </p>
          <p>目标区域：{projection.context.target_region}</p>
          <p className="evidence-note">
            此信息是已发布的教学上下文，不代表 REALIZED、Settlement、Score 或 Rank。
          </p>
          {projection.known_limits.map((limit) => (
            <p className="evidence-note" key={limit}>
              {limit}
            </p>
          ))}
        </>
      ) : (
        <p className="evidence-note">
          教师发布受控 candidate 后，使用 URL 参数 regionalTransferCandidateId 查看本投影。
        </p>
      )}
    </WorkbenchFrame>
  );
}
