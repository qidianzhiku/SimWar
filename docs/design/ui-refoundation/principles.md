# SimWar 前端体验重构：PR1 设计冻结原则

> **历史记录**：本文件保留早期 PR1 冻结快照。当前 Figma P1 文件、变量、组件变体和实现映射以 [`figma-p1-implementation-receipt.md`](./figma-p1-implementation-receipt.md)、[`design-tokens.json`](./design-tokens.json) 和 [`code-connect-map.json`](./code-connect-map.json) 为准；本历史快照中的旧 Figma file key、颜色值、变量数量和 Starter 限制不再描述当前实现。

**冻结对象**：`SIMWAR-FE-WAVE-001-APPLE-EDITORIAL-EXPERIENCE-REFOUNDATION-V1.0` 的 Frontend Foundation

**冻结日期**：2026-08-13（Asia/Shanghai）

**权威源码**：`bb343faf0c38e4a4a6d8b7928d0a0f35ecf8ad37`

**设计模式**：`FIGMA_CONNECTED`；Figma variables/styles 状态 `P1_PASS`；editable component variants、final screens 与 Code Connect 均为 `BLOCKED_BY_PLAN_LIMIT`；详细外部尝试记录于 `current-reality-receipt.md` 与 `code-connect-map.json`

**Figma 文件**：`SimWar Design System V6.0`，file key `g73vJXbLoQVhY87lbUaueL`；6 collections / 68 variables；WEB syntax/scope/alias PASS；3 physical pages / 12 logical sections；editable component variants、final screens 与 Code Connect `BLOCKED_BY_PLAN_LIMIT`；限制码为 `FIGMA_STARTER_3_PAGE_LIMIT` 与 `FIGMA_STARTER_MCP_RATE_LIMIT`

**PR1 责任范围**：本文件、设计 token、共享组件合同、AppShell/状态系统的设计约束与审计收据；不改变 API、结算、Replay、权限或学生投影。

## 1. 产品北极星与不可越过的边界

SimWar 的界面必须把可信经营 Truth、角色化决策、团队协同、学习证据、行业模型和受治理 AI 编译成一条可操作、可解释、可审计的 Decision Digital Thread。界面不是第二个业务引擎：服务端 BFF/安全投影提供可见字段和 `allowed_actions`，核心仿真引擎提供正式真值，前端只编排交互和呈现。

以下事项不是 PR1 的设计自由度：

- 不计算或写入 `state_true`、SettlementResult、score、rank、replay hash、canonical Decision 或 ledger。
- 不扩大 Student projection；不把教师私有证据、其他队伍/租户数据、内部 digest 或 AI 建议变成正式结果。
- 不从 URL、`localStorage`、猜测或 Figma 推断 tenant、role、scope、Authority 或 Allowed Action。
- 不从前端调用 internal settle 路由；当前源码中已有的 `apps/teacher/src/App.tsx` 结算调用是 UI debt，后续 PR 必须按 BFF/受控 command 路径治理。
- 不创建第二业务 Authority；Enterprise 仅能在现有 Admin/Teacher 合同和 BFF 能力内呈现，缺少合同时显示 Closed/Known Limit。
- 不使用 Harvard、HBS、HBR 字样、校徽、盾徽、Logo、Wordmark 或受保护字体文件。

权威顺序固定为：当前 Git 源码 > 可重复测试/浏览器运行时 > contracts/BFF 安全投影 > 已批准 ADR/产品宪法 > 历史 UI 文档 > Figma 视觉规格。Figma 只定义外观、组件、状态和交互，不定义权限或真值。

## 2. 视觉语言：系统清晰度 × 商学院案例编辑感

视觉基调是克制、内容优先、规则线和网格明确的中文企业级 SaaS。采用经典商学院案例研究的编辑精神，但不复制任何品牌资产。

### 2.1 色彩语义

颜色名称和数值以 `design-tokens.json` 为唯一 token 来源：

| 语义           | Token                    | 值        | 约束                             |
| -------------- | ------------------------ | --------- | -------------------------------- |
| 品牌章节强调   | `color.editorialCrimson` | `#A51C30` | 章节标识、关键选择；不代表错误   |
| 系统/Authority | `color.authorityNavy`    | `#162334` | Context、治理、系统来源          |
| 学习/Evidence  | `color.learningTeal`     | `#287C7A` | 解释、证据、进步                 |
| 决策重点       | `color.decisionGold`     | `#C6923B` | 需要关注的变量和选择             |
| 正式结果/风险  | `color.officialRiskRed`  | `#B64A45` | 正式结果、风险、阻断、不可逆动作 |
| 主文字         | `color.ink`              | `#171717` | 内容文字                         |
| 次级文字       | `color.secondaryGray`    | `#65727D` | 辅助说明                         |
| 页面底色       | `color.warmPaper`        | `#F7F4EE` | 纸张式背景                       |
| 表面           | `color.surface`          | `#FFFFFF` | 面板、弹窗、抽屉                 |

`Crimson ≠ Risk Red` 是强制规则：普通品牌强调不可以伪装成错误，风险颜色不可以装饰普通按钮；任何仅依赖颜色的状态都必须同时有文字、图标或结构提示。

### 2.2 字体与数字

- UI 字体栈：`-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif`。
- 编辑式大标题可使用系统已有的 `Songti SC`, `STSong`, `Noto Serif CJK SC`，不打包字体文件。
- 数字、digest 和 ExactRef 使用 `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`。
- 标题必须有真实的 `h1`/`h2` 层级；表格数字右对齐、单位和 Actual/Expected/Simulated 显式可读。

### 2.3 网格、密度与动效

- 桌面采用 12 列网格；Teacher/Admin 以 1440 px 优化，1280 px 为标准桌面，Student 支持 1024 px，移动端以 390 px 为轻任务和只读优先。
- 间距只使用 `4/8/12/16/24/32/48`；圆角只使用 `4/8/12`；阴影只使用 `0/1/2` 级。
- 动效只用于状态反馈、层级展开、因果展开和 Drawer/Dialog 空间关系，时长 `120/180/240 ms`；尊重 `prefers-reduced-motion`。
- 禁止庆祝排名、粒子、老虎机、无意义数字滚动、大幅弹跳、长时间 skeleton、玻璃拟态、霓虹渐变和大面积 blur。

## 3. 角色工作空间信息架构

四类工作空间共享同一 AppShell、ContextBar、Authority 和状态系统，但按用户要完成的任务组织导航：

1. **Admin Delivery & Trust**：交付总览、租户与权益、用户/角色/范围、课程/场景/模型资产、权限与安全投影、审计与 Receipt、运行与支持、Known Limits、启动与恢复。
2. **Teacher Course OS**：首页是“今日工作”，包含今天要做、即将阻断、课程与班级、开课准备、团队与角色、轮次控制、结果发布、Debrief Studio、Evidence Confirmation、Report Builder、Validation Session、Close & Cleanup。
3. **Student Executive Environment**：角色任务、经营驾驶舱、信息与 Evidence、个人草稿、团队协同、分歧/冲突、团队确认、最终提交、结果与因果链、复盘、学习报告与学习路径。学生只看到服务端安全投影，不能发现被裁剪的隐私对象。
4. **Enterprise Course Factory & Sponsor**：课程工厂、Source Registry、Canonical Mapping、Scenario Draft、Course Recipe、Validation Suite、Cross-functional Review、Immutable Publication、Sponsor View。当前仓库没有独立 Enterprise app；R3 在现有 Admin/Teacher 应用中提供受现有 CoursePackage authority 约束的 Enterprise/Sponsor BFF 投影，不能由该投影创建第二个 truth writer、store 或权限 authority。缺少执行合同的能力必须显示“当前限制”，不得伪造功能。

不把产品退化成孤立 Dashboard 卡片：每个页面先说明用户当前任务、Context、Authority、状态和唯一主动作，再渐进披露 Evidence、模型和 digest。

## 4. 交互原则与主组件合同

每个屏幕只有一个清晰 Primary Action。复杂任务按可理解阶段展开，但不制造无意义向导。高风险动作需要说明影响、Authority、幂等性和恢复路径；错误必须回答“发生了什么、为什么、下一步做什么”。草稿不因错误而清空，加载不导致布局跳动，过期要求重新确认，冲突提供差异对比而非只报 409，Unknown 不伪装成 Empty。

共享组件的冻结名称、代码映射和当前缺口见 `component-inventory.csv` 与 `code-connect-map.json`。最低合同如下：

| 组件                                                         | 必须呈现                                                                                                                                                                              | 关键边界                                                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `AppShell` / `RoleNavigation`                                | role、workspace、主导航、移动端折叠                                                                                                                                                   | 不自行决定权限；导航项来自服务端可见能力                                                                 |
| `ContextBar`                                                 | tenant、course、session、run、round、team、role、mode                                                                                                                                 | 只显示服务端返回 Context，不从 URL/localStorage 补齐                                                     |
| `AuthorityBadge`                                             | `official`（正式）、`draft`（草稿）、`shadow`（影子）、`advisory`（建议）、`system-result`（系统结果）、`ai-explanation`（AI 解释）、`teacher-comment`（教师点评）、`unknown`（未知） | `Crimson` 不是 Authority；AI 永远 advisory-only                                                          |
| `AllowedActionButton`                                        | action、可执行状态、禁用原因、加载/提交反馈                                                                                                                                           | 仅消费 BFF `allowed_actions`，不把 disabled 当权限判定                                                   |
| `ReceiptPanel`                                               | command、actor、timestamp、correlation_id、status、`reuse_conflict`、`exact_ref`                                                                                                      | 只读；`reused` 表示幂等命令复用既有 receipt，`conflict` 表示服务端拒绝或需要重新确认；不可重新写正式结果 |
| `EvidenceDrawer`                                             | 证据来源、ExactRef、版本、可见范围、只读说明                                                                                                                                          | 修改正式对象必须跳转到 Sole Writer 流程并创建新版本                                                      |
| `KnownLimitBanner`                                           | 当前限制、不影响什么、尚未证明什么、适用范围                                                                                                                                          | 不把内部限制伪装成生产能力                                                                               |
| `Loading/Empty/Blocked/Stale/Conflict/Unknown/ErrorRecovery` | 状态原因、下一步动作、可恢复性                                                                                                                                                        | 每个页面必须声明不适用的状态，不得遗漏                                                                   |

所有按钮、表单、表格、Drawer 和 Dialog 必须具备明确焦点环、键盘顺序、语义标签、读屏名称和状态文本；关键动作不能只依赖 hover。

## 5. 状态、证据与语言合同

每个 `角色 × Route × 页面 × BFF × DTO × Allowed Action` 都要覆盖 `Loading / Empty / Partial / Ready / Blocked / Stale / Conflict / Unknown / Permission Denied / Error`；正式 command 还覆盖 `Submitting / Committed / Reused / Conflict / Failed`。PR1 先冻结状态组件和矩阵，PR2–4 逐页填充证据，不能只交 Ready 截图。

用户可见文案默认使用简体中文。允许保留不可变产品名、标准缩写、API/ExactRef/digest/version 和 CEO/CFO/CMO/COO（首次出现给出中文解释）。按钮使用“保存草稿、提交确认、锁定本轮、开始结算、发布结果、查看证据、重新加载、安全重试”等动作词；禁止 `Submit/Confirm/Back/Refresh` 残留。技术码只能作为次级证据，不能成为错误主标题。

## 6. 可访问性与响应式验收

目标是 WCAG 2.2 AA，并以自动化证据为准：键盘完整操作、清晰 focus ring、文字与背景对比度达标、图标有名称、表单 label/description/error 关联、表格 caption/header、Dialog 焦点管理、200% 文本缩放、触控目标合理、图表文字摘要和 SVG/Canvas 替代描述。不能使用颜色作为唯一状态信号。

必须在 `1440×900`、`1280×800`、`1024×768`、`390×844` 验证。Teacher/Admin 移动端可优先只读、提醒和轻操作，不强行把复杂控制台缩成灰墙；Student 保证关键决策轻量编辑、团队状态、结果和学习报告不横向溢出。

## 7. Figma、代码和治理绑定

Figma variable name = code token name；Figma component name = code component name 或显式 mapping；Figma variant = code prop/state mapping。Figma variables/styles 当前状态为 `P1_PASS`：已验证 6 个 collections、68 个 variables，WEB syntax/scope/alias PASS；有 3 个 physical pages / 12 个 logical sections。editable component variants、final screens 与 Code Connect 均为 `BLOCKED_BY_PLAN_LIMIT`；限制码为 `FIGMA_STARTER_3_PAGE_LIMIT` 与 `FIGMA_STARTER_MCP_RATE_LIMIT`，详细外部证据见 `current-reality-receipt.md` 与 `code-connect-map.json`。Starter 计划最多 3 个物理页面，所以目标中的 12 个逻辑页面以 3 个物理页内的确定性 Section 映射，不购买升级。代码 WEB token names 必须与 Figma 已验证名逐字相同，当前真实 semantic set 包括 `--sw-color-bg-*`、`--sw-color-text-*`、`--sw-color-action-*`、`--sw-color-border-*`、5 个 role colors，以及 `--sw-space-*`、`--sw-radius-*`、`--sw-motion-*`；不得把这些名字翻译成第二套 CSS 变量。PR1 建立审计/设计合同与共享基础层；PR2/3/4 按 ownership map 串行推进。PR #372 若先于任何未合并 Product PR 合并，该 PR 必须更新到其后的最新 protected master 并重跑 runtime、视觉和可访问性验证；若 #372 仍未授权或未合并，则不得把它作为 UI Wave 的虚构前置依赖。

设计冻结的成功条件不是“看起来像一套新颜色”，而是：统一 token、角色化 AppShell、Authority/Visibility 可解释、状态可恢复、简体中文一致、响应式和 WCAG 证据可复跑，并且没有新的真值或权限来源。
