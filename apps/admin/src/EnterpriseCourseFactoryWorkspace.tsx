import { useCallback, useEffect, useState } from "react";
import { CrossRoleRecoveryRail } from "@simwar/ui/cross-role-recovery-rail";
import type {
  ApiEnvelope,
  CourseFactoryCatalogProjection,
  CourseFactorySponsorProjection
} from "@simwar/shared-contracts";

export type EnterpriseCourseFactoryScope = "tenant" | "platform";

export interface EnterpriseCourseFactoryCapability {
  title: string;
  limitation: string;
  unaffected: string;
  notProven: string;
  scope: string;
}

export const enterpriseCourseFactoryCapabilities: readonly EnterpriseCourseFactoryCapability[] = [
  {
    title: "Exact source binding",
    limitation: "课程版本必须携带不可变 CourseBlueprint、ScenarioPackage 和 ParameterSet 引用。",
    unaffected: "源 authority 生命周期仍由既有服务负责。",
    notProven: "Model/Profile 引用仅作为 provenance；未声明新的模型或场景 authority。",
    scope: "当前租户 Course Factory Catalog。"
  },
  {
    title: "Versioned catalog",
    limitation: "Catalog 使用 DRAFT → VALIDATED → APPROVED → PUBLISHED → SUPERSEDED/RETIRED。",
    unaffected: "Course、Run、Decision 和 Settlement 不因 Catalog 读取而改变。",
    notProven: "JSON runtime 尚不构成 durable delivery claim。",
    scope: "Admin 可审计生命周期；Teacher 只见已发布版本。"
  },
  {
    title: "Copy and derive",
    limitation: "复制只产生新的 CoursePackage draft，并保留 exact source refs 与 lineage。",
    unaffected: "用户判断、结果和私有数据不会进入复制输入。",
    notProven: "跨租户复制仍受现有 tenant-bound source authority 限制。",
    scope: "Admin mutation；rights 和 expiry 由服务端检查。"
  },
  {
    title: "Rights and expiry",
    limitation: "copy/export rights、allowlist 和 expiry 是服务端门禁，不由前端推断。",
    unaffected: "既有访问控制和租户隔离继续有效。",
    notProven: "Provider、PostgreSQL/RLS 均未激活。",
    scope: "当前会话可见的 rights 投影。"
  },
  {
    title: "Rollback lineage",
    limitation: "Rollback 通过新 DRAFT 和 ROLLBACK provenance 表达，不覆盖已发布快照。",
    unaffected: "正式仿真真值和 replay 输入不被课程工厂写入。",
    notProven: "尚未声称外部 LMS 或生产发布回滚。",
    scope: "Admin audit projection。"
  },
  {
    title: "Sponsor-safe delivery",
    limitation:
      "Sponsor 投影只返回 bounded progress、known limits、exact digest presence 和 Catalog 元数据。",
    unaffected: "Tenant、Team、Score、Rank、Settlement 等正式事实仍留在各自 authority。",
    notProven: "不提供用户级交付名单、学习结果或私有企业明细。",
    scope: "Enterprise/Sponsor BFF projection。"
  },
  {
    title: "Audit evidence",
    limitation: "生命周期、字段差异和 lineage 可由 exact version audit 端点读取。",
    unaffected: "审计仍通过既有 audit log writer 记录。",
    notProven: "当前 evidence 仍是本地 JSON runtime 证据。",
    scope: "Admin evidence view。"
  },
  {
    title: "Known limits",
    limitation: "所有当前运行限制和未证明项必须随投影可见。",
    unaffected: "该页面不把测试通过升级为产品或无障碍 PASS。",
    notProven: "未进行 Pilot、Production 或 durable external delivery 声明。",
    scope: "每个页面请求的服务端 known_limits。"
  }
] as const;

const scopeLabels: Record<EnterpriseCourseFactoryScope, string> = {
  platform: "平台范围",
  tenant: "租户范围"
};

export interface EnterpriseCourseFactoryWorkspaceProps {
  apiBase?: string;
  scope: EnterpriseCourseFactoryScope;
  tenantId?: string;
  token?: string;
}

type LoadState = "idle" | "loading" | "ready" | "error";

const defaultApiBase = "http://localhost:3000";

async function fetchProjection<T>(
  apiBase: string,
  path: string,
  token: string,
  tenantId: string,
  signal: AbortSignal
): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      "x-tenant-id": tenantId
    },
    signal
  });
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) throw new Error(envelope.message || envelope.code);
  return envelope.data;
}

export function EnterpriseCourseFactoryWorkspace({
  apiBase = defaultApiBase,
  scope,
  tenantId = "",
  token = ""
}: EnterpriseCourseFactoryWorkspaceProps) {
  const [state, setState] = useState<LoadState>(token ? "idle" : "ready");
  const [error, setError] = useState("");
  const [catalog, setCatalog] = useState<CourseFactoryCatalogProjection | null>(null);
  const [sponsor, setSponsor] = useState<CourseFactorySponsorProjection | null>(null);

  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!token || !tenantId) return;
      setState("loading");
      setError("");
      try {
        const [nextCatalog, nextSponsor] = await Promise.all([
          fetchProjection<CourseFactoryCatalogProjection>(
            apiBase,
            "/api/v1/admin/course-factory/catalog",
            token,
            tenantId,
            signal
          ),
          fetchProjection<CourseFactorySponsorProjection>(
            apiBase,
            "/api/v1/bff/enterprise/course-factory/sponsor",
            token,
            tenantId,
            signal
          )
        ]);
        if (signal.aborted) return;
        setCatalog(nextCatalog);
        setSponsor(nextSponsor);
        setState("ready");
      } catch (cause) {
        if (signal.aborted) return;
        setState("error");
        setError(cause instanceof Error ? cause.message : "Course Factory 投影暂时不可用");
      }
    },
    [apiBase, tenantId, token]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <section
      id="admin-enterprise-course-factory"
      className="enterprise-course-factory-workspace"
      aria-labelledby="admin-enterprise-course-factory-heading"
      tabIndex={-1}
    >
      <div className="workspace-section-heading">
        <p className="eyebrow">Admin 中的逻辑位置</p>
        <h2 id="admin-enterprise-course-factory-heading">企业课程工厂与 Sponsor 投影</h2>
      </div>
      <p className="enterprise-course-factory-boundary">
        这是现有 Admin 应用中的 Course Factory 产品投影；所有版本写入、生命周期、rights 和审计均复用
        CoursePackage authority。页面不创建新的 Enterprise app、truth writer、store、模型 registry
        或正式仿真结果。
      </p>
      <CrossRoleRecoveryRail
        role="enterprise"
        status={
          !token
            ? "signed-out"
            : state === "error"
              ? "error"
              : state === "loading"
                ? "loading"
                : "ready"
        }
        contextEntries={[
          { label: "租户", value: tenantId || "未提供" },
          { label: "范围", value: scopeLabels[scope] },
          { label: "来源", value: "CoursePackage authority" }
        ]}
        onRecover={token ? () => void load(new AbortController().signal) : undefined}
      />
      <dl className="enterprise-course-factory-context" aria-label="Enterprise 投影上下文">
        <div>
          <dt>服务端范围</dt>
          <dd>{scopeLabels[scope]}</dd>
        </div>
        <div>
          <dt>课程工厂状态</dt>
          <dd>
            {state === "loading"
              ? "加载中"
              : state === "error"
                ? "受限：投影不可用"
                : "已接入现有 authority"}
          </dd>
        </div>
        <div>
          <dt>权威来源</dt>
          <dd>CoursePackage registry + 既有 audit log</dd>
        </div>
      </dl>

      {token ? (
        <button type="button" onClick={() => void load(new AbortController().signal)}>
          刷新课程工厂投影
        </button>
      ) : (
        <p role="status">当前预览未提供管理员会话；登录后将加载 Catalog 与 Sponsor 投影。</p>
      )}
      {error ? <p role="alert">{error}</p> : null}

      <section
        className="enterprise-course-factory-catalog"
        aria-labelledby="course-factory-catalog-heading"
      >
        <h3 id="course-factory-catalog-heading">Governed Course Catalog</h3>
        {catalog?.catalog.length ? (
          <ul>
            {catalog.catalog.map((entry) => (
              <li key={`${entry.course_package_reference.course_package_id}:${entry.version}`}>
                <strong>{entry.title}</strong>
                <span>
                  {" "}
                  · {entry.status} · {entry.version}
                </span>
                <small>
                  {entry.course_package_reference.course_package_id} /{" "}
                  {entry.course_package_reference.content_digest}
                </small>
                <small>
                  provenance: {entry.factory_metadata.provenance.kind}; expiry:{" "}
                  {entry.factory_metadata.rights.expires_at ?? "none"}
                </small>
                {entry.factory_metadata.source_evidence_reference ? (
                  <small data-testid="m30-admin-source-evidence">
                    source-backed: Shanghai → Hangzhou · qualification:{" "}
                    {entry.factory_metadata.source_evidence_reference.qualification_status} ·
                    calibration:{" "}
                    {entry.factory_metadata.source_evidence_reference.calibration_evidence}· M29
                    request: {entry.factory_metadata.source_evidence_reference.binding_request_id}
                  </small>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {state === "loading" ? "正在读取 exact catalog…" : "当前会话没有可见的课程工厂版本。"}
          </p>
        )}
      </section>

      <section
        className="enterprise-course-factory-sponsor"
        aria-labelledby="course-factory-sponsor-heading"
      >
        <h3 id="course-factory-sponsor-heading">Sponsor-safe delivery</h3>
        {sponsor ? (
          <>
            <dl>
              <div>
                <dt>课程数</dt>
                <dd>{sponsor.delivery_progress.course_count}</dd>
              </div>
              <div>
                <dt>运行数</dt>
                <dd>{sponsor.delivery_progress.active_runs}</dd>
              </div>
              <div>
                <dt>已发布版本</dt>
                <dd>{sponsor.delivery_progress.published_versions}</dd>
              </div>
              <div>
                <dt>回合数</dt>
                <dd>{sponsor.delivery_progress.round_count}</dd>
              </div>
            </dl>
            <p>
              exact refs present: {sponsor.evidence_pack.exact_refs_present ? "是" : "否"}；private
              data included: 否；source evidence: {sponsor.evidence_pack.source_evidence_count}
            </p>
            <ul aria-label="Course Factory known limits">
              {sponsor.known_limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </>
        ) : (
          <p>等待 Sponsor-safe aggregate。</p>
        )}
      </section>

      <section
        className="enterprise-course-factory-limits"
        aria-labelledby="enterprise-course-factory-limits-heading"
      >
        <h3 id="enterprise-course-factory-limits-heading">产品边界与证据状态</h3>
        <div className="enterprise-course-factory-capabilities">
          {enterpriseCourseFactoryCapabilities.map((capability) => (
            <article className="enterprise-course-factory-capability" key={capability.title}>
              <div className="enterprise-course-factory-capability-heading">
                <h4>{capability.title}</h4>
                <p className="enterprise-course-factory-status">证据状态：受现有 authority 约束</p>
              </div>
              <p>{capability.limitation}</p>
              <p>{capability.unaffected}</p>
              <p>{capability.notProven}</p>
              <p>{capability.scope}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
