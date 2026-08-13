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
        "Tenant-safe export only. Mock LRS is in-process; no Student route, raw evidence, email, score, rank, settlement, or replay data is exported."
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
      mapError={(cause) => (cause instanceof Error ? cause.message : "D5 导出操作失败。")}
      mapLoadError={(cause) =>
        cause instanceof Error ? cause.message : "D5 导出工作台暂时无法加载。"
      }
    />
  );
}
