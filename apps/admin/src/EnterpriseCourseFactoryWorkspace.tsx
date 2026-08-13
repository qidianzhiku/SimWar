import { KnownLimitBanner } from "@simwar/ui";

export type EnterpriseCourseFactoryScope = "tenant" | "platform";

export interface EnterpriseCourseFactoryCapability {
  title: string;
  limitation: string;
  unaffected: string;
  notProven: string;
  scope: string;
}

/**
 * This list is deliberately a presentation contract. It does not imply that
 * an Enterprise API, route, writer, or authority exists for any capability.
 */
export const enterpriseCourseFactoryCapabilities: readonly EnterpriseCourseFactoryCapability[] = [
  {
    title: "Source Registry",
    limitation:
      "当前没有 Enterprise Source Registry 写入或运行授权；现有种子资料不能被当作可运营注册表。",
    unaffected: "现有 Admin 课程、资产与安全投影仍按各自服务端合同提供。",
    notProven: "尚未证明运行时来源注册、来源变更、跨租户来源接入或审批链。",
    scope: "Enterprise 课程工厂的 Admin 只读投影；运行时：NOT_AUTHORIZED。"
  },
  {
    title: "Canonical Mapping",
    limitation: "当前没有 Enterprise Canonical Mapping 工作区或可写映射合同。",
    unaffected: "现有课程包引用和服务端校验不因本投影改变。",
    notProven: "尚未证明跨来源规范化、映射版本治理或映射发布。",
    scope: "租户/平台 Admin 可见范围内的已知限制说明。"
  },
  {
    title: "Scenario Draft",
    limitation:
      "当前没有 Enterprise 场景草稿权威来源；现有场景资料仍受既有角色和 synthetic 边界约束。",
    unaffected: "现有受控场景与课程资产展示不新增写入路径。",
    notProven: "尚未证明 Enterprise 场景作者权、运行时草稿、跨租户复用或正式发布。",
    scope: "Enterprise 逻辑位置的只读说明；不代表场景工厂已授权。"
  },
  {
    title: "Course Recipe",
    limitation:
      "完整 Course Recipe 仍关闭；当前只可把 CoursePackageVersion 描述为不可变教学与配置快照。",
    unaffected: "现有课程包版本生命周期和 Admin 资产锚点保持原有服务端边界。",
    notProven: "尚未证明聚合式课程配方、依赖编排、企业级版本组合或配方写入。",
    scope: "Enterprise 课程工厂投影；支持能力仅链接到现有 #admin-assets。"
  },
  {
    title: "Validation Suite",
    limitation: "当前没有 Enterprise 聚合 Validation Suite 或统一执行入口。",
    unaffected: "现有分散的课程包、报告、运行和测试验证继续由各自合同负责。",
    notProven: "尚未证明一键聚合验证、跨工作区阻断规则或发布前统一门禁。",
    scope: "Enterprise 只读已知限制；现有验证不升级为 Enterprise 聚合能力。"
  },
  {
    title: "Cross-functional Review",
    limitation: "当前没有 Enterprise 跨职能审阅流程、审阅角色或审阅命令。",
    unaffected: "现有 Admin/Teacher 的职责和安全投影不因本页面扩展。",
    notProven: "尚未证明多角色意见汇总、冲突处理、审批证据或 Sponsor 签署。",
    scope: "Enterprise 逻辑位置的关闭能力；不新增角色或权限。"
  },
  {
    title: "Immutable Publication",
    limitation:
      "现有 CoursePackageVersion 生命周期不等于 Enterprise 多审阅者或 Sponsor 发布；Immutable Publication 仍关闭。",
    unaffected: "现有不可变课程包快照与既有生命周期仍可按原合同查看。",
    notProven: "尚未证明发布审批、发布回滚、跨租户分发或 Sponsor 发布回执。",
    scope: "Enterprise 只读说明；可返回 #admin-assets 查看现有快照能力。"
  },
  {
    title: "Sponsor View/Aggregation",
    limitation: "当前没有跨租户 Sponsor View 或聚合数据合同。",
    unaffected: "现有租户范围与平台范围摘要仍由服务端按会话投影。",
    notProven: "尚未证明跨租户 sponsor 数据、聚合指标、导出或比较视图。",
    scope: "Enterprise Sponsor 投影的关闭能力；不得突破租户隔离。"
  }
] as const;

const scopeLabels: Record<EnterpriseCourseFactoryScope, string> = {
  platform: "平台范围",
  tenant: "租户范围"
};

export interface EnterpriseCourseFactoryWorkspaceProps {
  scope: EnterpriseCourseFactoryScope;
}

export function EnterpriseCourseFactoryWorkspace({ scope }: EnterpriseCourseFactoryWorkspaceProps) {
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
        当前没有独立 Enterprise app、BFF 或权威来源；本页面只是现有 Admin 服务端会话的只读投影，
        不提供新的路由、API、写入者、角色或权限。Admin 外层“正式”标识仅表示当前管理员会话，
        不表示下方 Enterprise 能力已正式可用。
      </p>
      <dl className="enterprise-course-factory-context" aria-label="Enterprise 投影上下文">
        <div>
          <dt>服务端范围</dt>
          <dd>{scopeLabels[scope]}</dd>
        </div>
        <div>
          <dt>投影状态</dt>
          <dd>状态：只读、已知限制</dd>
        </div>
        <div>
          <dt>权威来源</dt>
          <dd>现有 Admin 服务端会话</dd>
        </div>
      </dl>

      <section
        className="enterprise-course-factory-supported"
        aria-labelledby="enterprise-course-factory-supported-heading"
      >
        <h3 id="enterprise-course-factory-supported-heading">当前可见的支持投影</h3>
        <p>以下链接只返回已经存在的 Admin 安全锚点，不代表 Enterprise 聚合能力已经实现：</p>
        <ul>
          <li>
            <a className="admin-inline-link" href="#admin-assets">
              查看现有课程与资产
            </a>
            <span>CoursePackageVersion 仅表示不可变教学与配置快照。</span>
          </li>
          <li>
            <a className="admin-inline-link" href="#admin-runtime-support">
              查看现有运行与支持
            </a>
            <span>synthetic D6 与现有验证仍是各自独立能力。</span>
          </li>
          <li>
            <a className="admin-inline-link" href="#admin-audit-receipts">
              查看现有审计与回执
            </a>
            <span>安全报告/D5 只按原有租户或平台安全投影提供。</span>
          </li>
        </ul>
      </section>

      <section
        className="enterprise-course-factory-limits"
        aria-labelledby="enterprise-course-factory-limits-heading"
      >
        <h3 id="enterprise-course-factory-limits-heading">Enterprise 能力状态</h3>
        <div className="enterprise-course-factory-capabilities">
          {enterpriseCourseFactoryCapabilities.map((capability) => (
            <article className="enterprise-course-factory-capability" key={capability.title}>
              <div className="enterprise-course-factory-capability-heading">
                <h4>{capability.title}</h4>
                <p className="enterprise-course-factory-status">状态：关闭</p>
              </div>
              <KnownLimitBanner
                limitation={capability.limitation}
                unaffected={capability.unaffected}
                notProven={capability.notProven}
                scope={capability.scope}
              />
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
