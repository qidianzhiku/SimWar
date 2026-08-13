import type { D5ExactRef } from "@simwar/shared-contracts";
import { D5ExportWorkbenchView } from "@simwar/ui";
import {
  cancelD5Job,
  createD5Job,
  loadD5Exports,
  loadD5Reports,
  previewD5Export,
  retryD5Job,
  sealD5Export
} from "./d5-export-client";

type D5ErrorPhase = "load" | "operation";

export function getAdminD5ErrorMessage(cause: unknown, phase: D5ErrorPhase): string {
  const raw = cause instanceof Error ? cause.message : "";
  if (/AUTH[-_]|401|403|FORBIDDEN|UNAUTHORIZED/u.test(raw)) {
    return phase === "load" ? "当前会话无权加载 D5 导出数据。" : "当前会话无权执行 D5 导出操作。";
  }
  if (/404|NOT_FOUND|OUT_OF_SCOPE/u.test(raw)) {
    return "D5 导出数据不可用或超出当前范围。";
  }
  if (/409|CONFLICT|STALE/u.test(raw)) {
    return "D5 导出状态已变化，请刷新后重试。";
  }
  if (/5\d\d|SERVICE|NETWORK|TIMEOUT|failed|failure/u.test(raw)) {
    return phase === "load"
      ? "D5 导出数据暂时无法加载，请稍后重试。"
      : "D5 导出操作暂时无法完成，请稍后重试。";
  }
  return phase === "load" ? "D5 导出数据暂时无法加载。" : "D5 导出操作暂时无法完成。";
}

export function D5ExportWorkbench({
  apiBase,
  tenantId,
  token
}: {
  apiBase: string;
  tenantId: string;
  token: string;
}) {
  const loadList = async () => {
    const [reportData, list] = await Promise.all([
      loadD5Reports(apiBase, token),
      loadD5Exports(apiBase, token)
    ]);
    return { reports: reportData.reports, list };
  };
  const refreshExports = () => loadD5Exports(apiBase, token);

  return (
    <D5ExportWorkbenchView
      ariaLabel="D5 admin evidence export workbench"
      eyebrow="L1+ 课程项目 · D5"
      title="证据导出工作台"
      badge=""
      boundary={
        "仅限租户范围的导出。Mock LRS 在进程内运行，不导出学员路由、原始证据、邮件、评分、排名、结算或回放数据。"
      }
      sessionKey={`${apiBase}:${tenantId}:${token}`}
      headingClassName="candidate-heading"
      loadList={loadList}
      refreshExports={refreshExports}
      generate={(selected) => previewD5Export(apiBase, token, selected as readonly D5ExactRef[])}
      submit={(selected) => sealD5Export(apiBase, token, selected as readonly D5ExactRef[])}
      deliver={(bundleRef) => createD5Job(apiBase, token, bundleRef as D5ExactRef)}
      retry={(jobId) => retryD5Job(apiBase, token, jobId)}
      cancel={(jobId) => cancelD5Job(apiBase, token, jobId)}
      mapError={(cause) => getAdminD5ErrorMessage(cause, "operation")}
      mapLoadError={(cause) => getAdminD5ErrorMessage(cause, "load")}
    />
  );
}
