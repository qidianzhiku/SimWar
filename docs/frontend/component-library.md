```markdown
## 1. 文档信息

| 项目       | 内容                                     |
|-----------|-----------------------------------------|
| 文档名称   | Udocs/frontend/component-library.md                 |
| 项目名称   | SimWar (企业级商业仿真培训平台)           |
| 文档版本   | v1.0                                    |
| 文档状态   | Draft                                   |
| 最后更新   | YYYY-MM-DD                              |
| 适用范围   | docs/frontend/component-library.md / 前端开发 / Figma 设计系统    |
| 维护人     | 请根据实际项目修改                      |
| 相关文档   | docs/frontend/figma-prototype-spec.md / docs/frontend/teacher-student-architecture.md / docs/contracts/api-contract.md |

---

## 2. 组件库总览

组件库旨在为整个系统提供统一的UI元素和交互规范，实现页面视觉与交互的一致性、可维护性和高复用率。组件库分层如下：基础组件（颜色、排版、间距等基础元素）、布局组件（如布局框架、导航栏等）、业务组件（根据具体业务场景设计的复合组件）等。每个组件在Figma中对应一个组件或变量；在前端代码目录中则与实际组件文件一一映射（参见设计命名规范）。组件库应支持主题化和可定制，方便不同角色和模块组合使用。

| 组件类别           | 说明                         | 示例组件              | 适用范围             |
|------------------|----------------------------|---------------------|------------------|
| 基础组件         | 设计系统的原子元素           | Button, Typography, Badge, Tooltip, Input, Modal 等 | 所有端共用（核心 UI）  |
| 布局组件         | 页面结构相关                 | AppShell, Sidebar, TopNav, Grid, Card 等     | 跨端通用             |
| 导航组件         | 导航相关                   | MainNav, TabNav, Breadcrumb, Pagination 等   | 跨端通用             |
| 表单组件         | 表单输入和操作相关           | TextInput, Select, Switch, DatePicker 等      | 跨端通用             |
| 数据展示组件      | 列表/表格/图表等数据显示     | DataTable, StatCard, ChartCard 等            | 跨端通用             |
| 状态反馈组件      | 提示/反馈相关               | Toast, LoadingState, EmptyState, ErrorState  | 跨端通用             |
| 图表组件         | 数据可视化                 | LineChart, BarChart, RadarChart 等           | 教师端/学员端        |
| 权限组件         | 权限控制相关               | PermissionGuard, RoleBadge 等               | 跨端通用             |
| 教师端业务组件    | 教师端专属业务逻辑组件       | RoundStatusStepper, DecisionMonitorTable 等   | 教师端               |
| 学员端业务组件    | 学员端专属业务逻辑组件       | DecisionForm, TeamDashboard 等               | 学员端               |
| AI 业务组件       | AI 辅助输出相关             | AIAdviceCard, EvidenceCard 等               | 教师端、学员端       |
| Replay 组件      | Replay / Shadow Replay 相关 | ReplayDiffCard, ReplayReportPanel 等         | 教师端、模型治理端    |
| 审计与治理组件    | 审计、审批、版本管理相关     | AuditTimeline, ApprovalWorkflowPanel 等      | 管理后台、教师端     |

---

## 3. 设计 Token

### 3.1 颜色 Token

| Token                  | 用途             | 示例值        | 说明                   |
|-----------------------|----------------|-------------|----------------------|
| `color.primary`       | 主色调           | `#PLACEHOLDER` | 用于主要按钮、链接等主要元素 |
| `color.secondary`     | 次要色           | `#PLACEHOLDER` | 用于强调色、辅助按钮等       |
| `color.success`       | 成功色           | `#PLACEHOLDER` | 用于表示成功、完成状态         |
| `color.warning`       | 警告色           | `#PLACEHOLDER` | 用于警示、需要注意的元素       |
| `color.error`         | 错误色           | `#PLACEHOLDER` | 用于错误消息、删除类按钮       |
| `color.info`          | 信息色           | `#PLACEHOLDER` | 用于提示、信息提示框         |
| `color.background`    | 页面背景色       | `#PLACEHOLDER` | 页面或卡片背景               |
| `color.surface`       | 表面色           | `#PLACEHOLDER` | 卡片、弹窗背景等           |
| `color.border`        | 边框色           | `#PLACEHOLDER` | 分隔线、输入框边框           |
| `color.text.primary`  | 主要文字色       | `#PLACEHOLDER` | 主文案文字色               |
| `color.text.secondary`| 次级文字色       | `#PLACEHOLDER` | 次级文案、说明文字           |
| `color.text.disabled` | 禁用文字色       | `#PLACEHOLDER` | 禁用状态文字               |
| `color.ai.advisory`   | AI 建议色         | `#PLACEHOLDER` | 标识 AI 辅助建议的特殊色       |
| `color.replay.diff`   | Replay 差异色    | `#PLACEHOLDER` | 高亮显示 Replay 差异的颜色     |
| `color.audit`         | 审计日志强调色    | `#PLACEHOLDER` | 审计视图或重要警示颜色         |
| `color.locked`        | 锁定状态色       | `#PLACEHOLDER` | 用于表示已锁定状态的颜色       |

### 3.2 字体 Token

| 令牌                | 用途       | 示例值      | 说明             |
|--------------------|----------|-----------|----------------|
| 页面标题           | 页面主标题   | 32px / 粗体 | 页面或模块主标题    |
| 区块标题           | 区块或卡片标题 | 24px / 半粗 | 内容分区或卡片标题   |
| 卡片标题           | 卡片内标题   | 18px / 半粗 | 各类统计卡片标题     |
| 正文              | 正常文本    | 14px / 常规 | 正文或说明文本      |
| 辅助说明          | 辅助文本    | 12px / 常规 | 说明文字、提示性文本   |
| 表格文字          | 表格中的文字  | 14px / 常规 | 表格行、列标题       |
| 数字指标          | 关键数据数字  | 28px / 粗体 | 统计数字、KPI值      |
| 标签文字          | 小标签      | 12px / 常规 | 按钮/标签内部文字   |
| 错误提示          | 错误文本提示  | 12px / 常规 | 表单校验或错误提示   |

### 3.3 间距 Token

| 令牌          | 用途                  | 示例值   | 说明               |
|--------------|---------------------|--------|------------------|
| `spacing.xs` | 极小间距               | 4px    | 小型组件内边距、微间距   |
| `spacing.sm` | 小间距                | 8px    | 组件间距、表单元素间距  |
| `spacing.md` | 中间距                | 16px   | 标准组件内外边距      |
| `spacing.lg` | 大间距                | 24px   | 主要布局间距         |
| `spacing.xl` | 特大间距               | 32px   | 大型区域或分隔段        |
| `spacing.2xl`| 超大间距               | 40px   | 极大布局间隔         |

### 3.4 圆角 Token

| 令牌        | 用途        | 示例值  | 说明           |
|------------|-----------|-------|--------------|
| `radius.sm`| 小圆角      | 4px   | 小型按钮、输入框等   |
| `radius.md`| 中圆角      | 8px   | 卡片、普通按钮      |
| `radius.lg`| 大圆角      | 16px  | 弹窗、对话框       |
| `radius.xl`| 超大圆角     | 24px  | 页眉、容器大背景     |
| `radius.full`| 完全圆角    | 9999px| 用于圆形头像、徽标等 |

### 3.5 阴影 Token

| 令牌            | 用途      | 示例值                               | 说明               |
|----------------|---------|------------------------------------|------------------|
| `shadow.card`  | 卡片阴影   | `0 1px 4px rgba(0,0,0,0.1)`        | 卡片、弹窗等浮层阴影   |
| `shadow.dropdown`| 下拉阴影  | `0 2px 8px rgba(0,0,0,0.1)`        | 下拉菜单、浮层阴影    |
| `shadow.modal` | 弹窗阴影   | `0 4px 16px rgba(0,0,0,0.2)`       | 对话框、Modal阴影    |
| `shadow.drawer`| 侧边栏阴影  | `0 2px 8px rgba(0,0,0,0.15)`       | Drawer/侧滑面板阴影  |

### 3.6 Z-index Token

| 令牌             | 用途              | 示例值 | 说明               |
|-----------------|-----------------|-----|------------------|
| `zIndex.dropdown` | 下拉菜单等浮层     | 1000| 下拉菜单、Select 等    |
| `zIndex.sticky`   | 粘性头部        | 1100| 置顶导航或工具栏      |
| `zIndex.drawer`   | 侧边栏          | 1200| 侧边栏或导航抽屉      |
| `zIndex.modal`    | 模态对话框        | 1300| Modal 弹窗        |
| `zIndex.toast`    | 通知提示        | 1400| 全局提示（Toast）    |
| `zIndex.tooltip`  | 提示气泡         | 1500| Tooltip 工具提示  |

设计令牌是设计系统的基础元素，用于存储颜色、字体、间距等关键样式属性【10†L4-L9】【6†L147-L156】。通过使用统一的设计令牌，团队可以保证跨平台风格一致，主题和模式可灵活切换而不破坏设计一致性【10†L4-L9】【6†L147-L156】。此外，Token 的命名语义化有助于提高维护性和可读性。

---

## 4. 组件命名规范

- React/Vue 组件名使用 PascalCase（如 `MyComponent`）。  
- 文件命名推荐使用 PascalCase 或 kebab-case，但应与组件名保持一致（如 `Button.tsx` 或 `button.tsx`）。  
- Props 类型定义使用 `ComponentNameProps` 命名（如 `ButtonProps`）。  
- 事件回调命名使用 `on` 前缀加动词（如 `onClick`, `onSubmit`）。  
- 状态变量使用明确语义（如 `isLoading`、`hasError`）。  
- 业务组件可使用场景前缀（如 `DecisionForm`, `RoundStatusStepper`）。  
- Figma 中组件命名应与代码组件对应，例如：`Button/Button/Default` 对应 `components/base/Button/Button.tsx`。示例：  
  ```
  components/base/Button/Button.tsx
  components/forms/DecisionForm/DecisionForm.tsx
  components/teacher/RoundStatusStepper/RoundStatusStepper.tsx
  components/ai/AIAdviceCard/AIAdviceCard.tsx
  components/replay/ReplayDiffCard/ReplayDiffCard.tsx
  ```

---

## 5. 基础组件

基础组件是构建所有页面的原子单元，必须满足一致的样式和无障碍要求。所有基础组件应支持以下状态：`loading`、`disabled`、`readonly`、`error`、`empty`，并遵守语义化和ARIA规范。例如，`<button>` 元素自带键盘可访问性【12†L253-L260】；Tooltip 等组件需要提供相应的 ARIA 标签【12†L253-L260】【18†L188-L192】。

### Button

**用途**：用于触发操作的按钮。  
**使用场景**：表单提交、对话框确认、导航菜单等任何需要点击操作的场景。  
**Props**：`type` (primary/secondary/ghost/danger/link)、`disabled`、`loading`、`icon` (图标组件)、`fullWidth` (是否占满容器宽度) 等。  
**状态**：`default`、`hover`、`active`、`disabled`、`loading`。  
**事件**：`onClick`。  
**可访问性要求**：使用 `<button>` 元素或角色为 `button` 的元素，确保有 `aria-label` 时明确作用。【12†L253-L260】  
**示例用法**：`<Button type="primary" onClick={handleSave}>保存</Button>`。  
**验收标准**：按钮在不同状态下样式正确，点击触发回调，禁用时不可点击，无障碍标签正确。

### IconButton

**用途**：仅包含图标的按钮，用于节省空间的操作。  
**使用场景**：列表操作、导航栏图标、功能按钮等。  
**Props**：`icon` (图标组件)、`aria-label` (无障碍标签)、`disabled`、`onClick`。  
**状态**：`default`、`hover`、`active`、`disabled`。  
**事件**：`onClick`。  
**可访问性要求**：必须提供 `aria-label` 或 `title` 说明图标含义，以便辅助技术识别。  
**示例用法**：`<IconButton icon={<EditIcon />} aria-label="编辑" onClick={editItem} />`。  
**验收标准**：图标正确渲染，鼠标悬停有提示文本，点击事件触发，无障碍读屏支持。

### Link

**用途**：导航链接或文本型按钮样式的操作。  
**使用场景**：文中跳转链接、按钮样式的链接操作。  
**Props**：`href`、`target`、`disabled`、`onClick`。  
**状态**：`default`、`hover`、`visited`、`disabled`。  
**事件**：`onClick`（可选，用于阻止默认导航时使用）。  
**可访问性要求**：使用 `<a>` 元素或角色为 `link`，确保 `href` 可被辅助工具识别。  
**示例用法**：`<Link href="/profile">查看个人资料</Link>`。  
**验收标准**：链接样式正确，点击进行导航，禁用时无效。

### Typography

**用途**：统一文本样式，涵盖标题、段落、标签、提示文字等。  
**使用场景**：页面标题、正文文本、表单标签、提示文字等。  
**Props**：`variant` (h1, h2, body, caption 等)、`children`。  
**状态**：正常、粗体、斜体、链接样式等。  
**可访问性要求**：确保语义标签对应（如标题使用 `<h1>`-`<h6>` 标签），辅助文本使用 `<p>` 或 `<span>`。  
**示例用法**：`<Typography variant="h1">主标题</Typography>`。  
**验收标准**：文本样式（字号、行高、颜色）符合设计规范，语义正确。

### Badge

**用途**：徽章、状态标识或计数提示。  
**使用场景**：导航图标右上角提示、新消息提醒等。  
**Props**：`count` (数字或文本)、`status` (success/error/info/warning)、`dot` (只显示红点)。  
**状态**：带数字、只显示点、不同主题颜色。  
**可访问性要求**：如果仅用于视觉提示可为 `aria-hidden="true"`，必要时使用 `aria-label`描述数量变化。  
**示例用法**：`<Badge status="success" count={5} />`。  
**验收标准**：徽章位置正确、文字或点显示正确，辅助技术上标注阅读。

### Tag

**用途**：显示小型标签、状态或分类。  
**使用场景**：类型标签、用户角色标签、状态标识等。  
**Props**：`text`、`color`、`closable` (可关闭) 等。  
**状态**：正常、Hover 效果、可关闭状态。  
**可访问性要求**：标签内容可被屏幕阅读器读出，关闭按钮使用 `<button>` 并说明标签作用。  
**示例用法**：`<Tag color="info" text="已发布" />`。  
**验收标准**：样式符合预期，可关闭时点击触发回调，无障碍描述正确。

### Tooltip

**用途**：文字提示气泡。  
**使用场景**：按钮图标、禁用状态、表单说明等情况，提供额外信息。  
**Props**：`content` (提示文字)、`placement` (top/bottom/left/right)、`trigger` (hover/focus) 等。  
**状态**：默认、显示状态。  
**可访问性要求**：使用 `aria-describedby` 或 `role="tooltip"` 关联触发元素与提示内容【18†L188-L192】。  
**示例用法**：`<Tooltip content="提交课程" placement="top"><Button>提交</Button></Tooltip>`。  
**验收标准**：鼠标悬停或聚焦时弹出提示框，文本完整，屏幕阅读器提示正常。

### Popover

**用途**：弹出式内容容器，带标题和操作区域。  
**使用场景**：确认框、丰富文本提示、下拉筛选等。  
**Props**：`title`、`content` (弹出内容) 、`placement`、`trigger` 等。  
**状态**：隐藏、显示。  
**可访问性要求**：弹出容器应 `aria-modal` 或 `aria-labelledby` 关联标题，确保退出键操作可关闭。  
**示例用法**：`<Popover title="提示" content="操作成功"><Button>查看详情</Button></Popover>`。  
**验收标准**：点击触发显示弹窗，内容和标题正确，点击遮罩或ESC可关闭，无障碍可聚焦。

### Divider

**用途**：分隔线，用于分割内容区域。  
**使用场景**：列表项分隔、页脚与内容分隔、水平/垂直分隔等。  
**Props**：`orientation` (horizontal/vertical)、`dashed` (虚线)。  
**状态**：常规、虚线、带文本。  
**可访问性要求**：使用 `<hr>` 或 CSS 绘制，确保不干扰辅助工具。  
**示例用法**：`<Divider dashed />`。  
**验收标准**：在正确位置绘制分隔线，虚实样式正确。

### Avatar

**用途**：用户头像或代表性图标。  
**使用场景**：用户信息、联系人列表、评论区等。  
**Props**：`src` (图片地址)、`alt` (替代文本)、`size` (小/中/大) 等。  
**状态**：正常、加载错误（显示占位）状态。  
**可访问性要求**：提供 `alt` 文本；若无图像，可使用用户姓名首字母或占位图标，并包含描述。  
**示例用法**：`<Avatar src="/avatar.jpg" alt="用户头像" size="md" />`。  
**验收标准**：头像图片正确显示或加载失败显示默认图标，尺寸和圆角正确。

### Spinner

**用途**：加载指示器。  
**使用场景**：异步加载数据时、按钮加载状态等。  
**Props**：`size`、`color`、`tip` (提示文字) 等。  
**状态**：旋转动画、停用。  
**可访问性要求**：使用 `aria-busy="true"` 或 `role="status"`，并提供辅助文本说明。  
**示例用法**：`<Spinner size="large" tip="加载中..." />`。  
**验收标准**：动画流畅，提示文本正确显示，可在屏幕阅读器中读出。

### Skeleton

**用途**：加载时的骨架屏，占位效果。  
**使用场景**：列表、表格数据加载、卡片加载时的占位。  
**Props**：`active` (激活动画)、`count` (条目数)、`shape` 等。  
**状态**：默认、动画（闪烁）效果。  
**可访问性要求**：骨架视图应标记为加载状态，可使用 `aria-busy`。  
**示例用法**：`<Skeleton active paragraph={{rows: 3}} />`。  
**验收标准**：骨架样式匹配内容布局，加载完成后隐藏，屏幕阅读器跳过骨架内容。

### Progress

**用途**：进度条或进度环。  
**使用场景**：上传/下载进度、流程进度显示等。  
**Props**：`percent`、`status` (normal/exception/success)、`type` (line/circle) 等。  
**状态**：正常、异常、完成状态。  
**可访问性要求**：添加 `aria-valuenow`, `aria-valuemin`, `aria-valuemax` 属性。  
**示例用法**：`<Progress percent={75} status="active" />`。  
**验收标准**：进度显示正确，完成状态颜色正确，辅助技术能读取进度值。

### Toast

**用途**：全局提示通知。  
**使用场景**：操作成功/失败提示、系统消息提醒。  
**Props**：`message`、`type` (success/warning/error/info)、`duration` 等。  
**状态**：自动消失、点击关闭。  
**可访问性要求**：使用 ARIA live 区（如 `role="alert" 或 role="status"`），确保语音提示。  
**示例用法**：`Toast.success("保存成功");`。  
**验收标准**：消息正确弹出并自动或手动关闭，屏幕阅读器读出。

### Alert

**用途**：重要信息提醒框，可用于确认或警示。  
**使用场景**：表单校验错误、操作警告、系统提示。  
**Props**：`message`、`description`、`type` (success/info/warning/error)、`closable` 等。  
**状态**：普通、可关闭、折叠说明。  
**可访问性要求**：使用 `role="alert"` 或 `role="status"`，并包含明确的标题和详情文本。  
**示例用法**：`<Alert type="error" message="操作失败" description="请重试" />`。  
**验收标准**：警示框颜色和图标正确，关闭按钮可用，阅读顺序合理。

### Modal

**用途**：模态对话框。  
**使用场景**：创建/编辑表单、详细信息、确认操作等。  
**Props**：`visible`、`title`、`onOk`、`onCancel`、`footer` 等。  
**状态**：打开、关闭、确认中。  
**可访问性要求**：对话框容器应使用 `role="dialog"` 并设置 `aria-labelledby` 关联标题，按Esc可关闭【18†L188-L192】。  
**示例用法**：`<Modal title="提示" visible={isOpen} onOk={handleSave} onCancel={handleClose}>内容</Modal>`。  
**验收标准**：弹窗居中显示，遮罩阻止后台点击，可通过按钮或ESC关闭，标题正确关联。

### Drawer

**用途**：侧滑面板。  
**使用场景**：侧边筛选、侧边菜单、配置面板等。  
**Props**：`visible`、`placement` (left/right/top/bottom)、`onClose`、`width`/`height` 等。  
**状态**：打开、关闭。  
**可访问性要求**：使用 `role="dialog"` 并设置 `aria-labelledby`，确保焦点管理（打开时焦点聚焦）。  
**示例用法**：`<Drawer title="筛选" visible={showFilter} onClose={() => setShowFilter(false)}>内容</Drawer>`。  
**验收标准**：从指定方向滑出，宽度/高度符合设计，关闭按钮可用，辅助工具读出标题。

### ConfirmDialog

**用途**：确认对话框，继承自 Modal 简化调用。  
**使用场景**：删除确认、重要操作确认等。  
**Props**：`message`、`onConfirm`、`onCancel`、`confirmText`、`cancelText`。  
**状态**：正常、确认处理中。  
**可访问性要求**：使用 `role="alertdialog"`，并提供明确的问题和动作按钮标签。  
**示例用法**：`<ConfirmDialog message="确认删除该课程？" onConfirm={deleteCourse} />`。  
**验收标准**：弹出询问框，按钮顺序合适，选择后触发对应回调，无障碍提示。

---

## 6. 布局组件

布局组件用于构建页面结构，响应式支持多种屏幕尺寸。所有布局组件应兼容移动端和桌面端。

### AppShell

**用途**：应用主要框架容器，包含 Sidebar、TopNav 等。  
**使用页面**：大多数后台和端口页面的顶层容器。  
**Props**：`sidebar` (侧边栏组件)、`topBar` (顶部导航组件)、`footer` (页脚组件)、`children`。  
**响应式行为**：在移动设备自动收起 Sidebar。  
**权限差异**：根据用户角色动态调整导航菜单项。  
**验收标准**：组件嵌套正确，侧边栏和顶栏按权限显示，响应式时布局自适应。

### Sidebar

**用途**：侧边导航栏。  
**使用页面**：所有后台应用左侧导航。  
**Props**：`navItems` (菜单项列表)、`collapsed` (折叠状态)、`onToggle`。  
**响应式行为**：窄屏时自动折叠或隐藏。  
**权限差异**：根据角色决定可见菜单项（例如教师看不到管理员页面）。  
**验收标准**：菜单项层级正确，切换折叠正常，图标和文字对齐。

### TopNav

**用途**：顶部导航栏。  
**使用页面**：所有端的顶部栏。  
**Props**：`title` (当前页面标题)、`userMenu` (用户菜单)、`onMenuToggle`。  
**响应式行为**：移动端收起菜单项，仅显示 Logo 和汉堡图标。  
**权限差异**：显示当前用户角色信息和可访问的快速操作。  
**验收标准**：标题正确显示，用户菜单和通知图标正常。

### Breadcrumb

**用途**：面包屑导航。  
**使用页面**：多级页面导航（如课程 > 队伍 > 详情）。  
**Props**：`items` (面包屑项数组)。  
**响应式行为**：移动端自动折叠部分面包屑项为「...」。  
**权限差异**：仅显示有权限的导航路径。  
**验收标准**：按顺序显示路径，可点击前往，不同角色路径正确。

### PageHeader

**用途**：页面头部，包含标题与操作按钮。  
**使用页面**：列表页、详情页、表单页的页首。  
**Props**：`title`、`subtitle`、`actions` (操作按钮集合) 等。  
**响应式行为**：在小屏隐藏一些次要操作至“更多”菜单。  
**权限差异**：操作按钮根据权限显隐（如没有创建权限隐藏新增按钮）。  
**验收标准**：标题居左，操作按钮居右，对齐符合设计，权限控制正确。

### ContentContainer

**用途**：内容区容器，添加统一 padding 和背景。  
**使用页面**：页面主内容区域的容器。  
**Props**：`children`、`padding`。  
**响应式行为**：固定边距，移动端适当减小。  
**验收标准**：内容区左右留白一致，背景色正确。

### SplitPanel

**用途**：分割面板容器，左右或上下布局。  
**使用页面**：需要同时展示两个部分内容时（如编辑器 + 预览）。  
**Props**：`sideContent`、`mainContent`、`direction` (horizontal/vertical)。  
**响应式行为**：窄屏时可切换为上下布局或隐藏侧边栏。  
**权限差异**：侧边栏可根据权限展示不同内容。  
**验收标准**：分割位置可调，内容切换正确。

### Card

**用途**：带阴影/边框的容器卡片。  
**使用页面**：信息统计、聚合面板、表单项容器等。  
**Props**：`title`、`children`、`footer`。  
**响应式行为**：固定宽高或随屏幕自适应。  
**验收标准**：阴影和圆角符合设计，标题、内容布局正确。

### Section

**用途**：页面模块分区。  
**使用页面**：仪表盘版块、报表区块等。  
**Props**：`title`、`children`。  
**响应式行为**：宽度根据屏幕自动调整列数。  
**验收标准**：分区标题样式正确，分隔留白一致。

### Grid

**用途**：通用栅格布局。  
**使用页面**：多列布局的页面，如表单布局、多列卡片等。  
**Props**：`columns`、`gap`、`children`。  
**响应式行为**：设定断点时列数可变。  
**验收标准**：网格对齐，间距正确，响应式列数变化合理。

### ResponsiveStack

**用途**：响应式垂直或水平堆叠布局。  
**使用页面**：按钮组、统计卡片列表等。  
**Props**：`direction` (row/column)、`spacing`、`wrap`。  
**响应式行为**：超出宽度时自动换行或切换方向。  
**验收标准**：子元素在容器内正确排列，无溢出。

### StickyFooter

**用途**：页面底部固定区域。  
**使用页面**：系统信息、版权声明、帮助信息等固定展示。  
**Props**：`children`。  
**响应式行为**：始终贴底，移动端保持可见。  
**验收标准**：footer 始终贴底且不遮挡内容。

### RightDrawerLayout

**用途**：右侧侧滑面板布局。  
**使用页面**：侧滑筛选、详情栏、设置面板等。  
**Props**：`isOpen`、`children`、`onClose`。  
**响应式行为**：打开时占据侧边固定宽度，移动端全屏覆盖。  
**验收标准**：侧滑面板动画正常，关闭可通过遮罩或按钮，无障碍焦点归还。

---

## 7. 导航组件

导航组件负责页面跳转和上下文切换。不同角色显示不同导航选项。

### MainNav

**用途**：主导航菜单。  
**使用页面**：应用主导航，列出主要模块。  
**权限差异**：只显示当前用户有权限访问的模块（例如学员端不显示教师设置）。  
**样式**：可为垂直列表或顶部横向菜单。  
**验收标准**：菜单项正确展示，点击跳转对应页面，当前页高亮。

### RoleBasedNav

**用途**：根据用户角色动态生成导航。  
**使用页面**：教师端、学员端、管理后台等入口。  
**逻辑**：根据用户角色和权限过滤可见菜单。  
**验收标准**：不同角色登录时菜单项正确。

### CourseNav

**用途**：课程内导航。  
**使用页面**：教师查看课程详情或学员课程驾驶舱时。  
**内容**：课程信息、队伍、回合、报表等子页面链接。  
**权限差异**：教师可以编辑配置和管理队伍；学员只能查看相关内容。  
**验收标准**：链接顺序和名称正确，当前页面激活状态明显。

### RoundNav

**用途**：回合级导航。  
**使用页面**：教师管理回合流程、学员查看当前回合结果时。  
**内容**：回合列表选择或控制按钮（如开始/锁定回合）。  
**验收标准**：当前回合突出显示，切换回合顺畅。

### TabNav

**用途**：标签式导航栏。  
**使用页面**：课程详情、设置页、多步流程页等。  
**内容**：分类标签切换不同内容面板。  
**权限差异**：部分选项卡根据角色可见（如“评估报告”对学员可见，“复盘报告”对教师可见）。  
**验收标准**：标签样式一致，可点击切换内容。

### Stepper

**用途**：进度步骤条。  
**使用页面**：多步骤表单、流程控制（如比赛状态）等。  
**状态**：标明当前步骤（active），完成（completed）、待进行（inactive）、失败（error）状态。  
**验收标准**：步骤节点和连接线显示正确，对应步骤状态。

### Breadcrumb

**用途**：面包屑导航（同布局组件中定义）。  
**使用页面**：前端展示模块中多级路径。  
**验收标准**：同布局组件 Breadcrumb。

### Pagination

**用途**：分页器。  
**使用页面**：列表页面底部分页控制。  
**功能**：上一页、下一页、页码输入、每页条数选择。  
**权限差异**：无权限限制功能。  
**验收标准**：翻页和页码跳转正确，页码高亮当前页。

### QuickActionMenu

**用途**：快捷操作菜单。  
**使用页面**：页面标题旁或内容区操作按钮群。  
**功能**：下拉菜单形式展示多个操作项。  
**权限差异**：根据角色筛选操作，例如教师可“锁定回合”，学员不可。  
**验收标准**：菜单项正确，点击触发对应功能，选项权限控制。

---

## 8. 表单组件

表单组件用于数据输入和配置。表单组件需支持表单验证、值绑定和提示。

### TextInput

**用途**：单行文本输入框。  
**使用场景**：姓名、标题、简单字段。  
**Props**：`value`、`placeholder`、`maxLength`、`disabled`、`onChange` 等。  
**状态**：正常、聚焦、错误（带红框提示）。  
**校验**：支持必填、长度和格式校验。  
**可访问性要求**：关联 `<label>` 标签或 `aria-label`，报错时使用 `aria-invalid`。  
**示例用法**：`<TextInput label="课程名称" value={name} onChange={setName} required />`。  
**验收标准**：输入和清空正常，错误提示显示。

### NumberInput

**用途**：数字输入。  
**使用场景**：价格、人数、百分比等。  
**Props**：`min`, `max`, `step`, `value`, `onChange`。  
**状态**：同 TextInput。  
**校验**：自动校验数值范围和格式。  
**可访问性要求**：使用 `type="number"`，说明单位和范围。  
**示例用法**：`<NumberInput label="价格(元)" value={price} onChange={setPrice} min={0} />`。  
**验收标准**：只能输入数字，超范围提示正确。

### MoneyInput

**用途**：金额输入，格式化货币。  
**使用场景**：财务金额输入。  
**Props**：`value`、`currency`、`precision`。  
**校验**：高精度（使用 `DECIMAL` 类型），禁止浮点误差。  
**示例用法**：`<MoneyInput label="预算" value={budget} currency="CNY" precision={2} />`。  
**验收标准**：千分位格式、保留两位小数，正负校验正确。

### PercentInput

**用途**：百分比输入，显示带 % 符号。  
**使用场景**：占比、概率等。  
**Props**：`value`、`onChange`。  
**校验**：0%-100% 范围，值自动乘 100 显示 `%`。  
**示例用法**：`<PercentInput label="市场份额" value={share} onChange={setShare} />`。  
**验收标准**：输入值自动转换百分号，超出范围显示错误。

### Select

**用途**：下拉选择框。  
**使用场景**：固定选项选择，如国家、状态等。  
**Props**：`options` (选项列表)、`value`、`onChange`、`placeholder`、`disabled`。  
**状态**：展开、关闭、选中、高亮。  
**校验**：支持必选、单选。  
**可访问性要求**：使用原生 `<select>` 或 ARIA 属性。  
**示例用法**：`<Select label="课程类型" options={[{value:'A',label:'类型A'}]} value={type} onChange={setType} />`。  
**验收标准**：选项列表正确展开，选择后值更新，可键盘操作。

### MultiSelect

**用途**：多选下拉框。  
**使用场景**：多维标签、选择多个类别。  
**Props**：`options`、`values` (数组)、`onChange`。  
**校验**：可选范围内多个。  
**可访问性要求**：应确保键盘可选和 ARIA 支持。  
**示例用法**：`<MultiSelect label="选择标签" options={tags} values={selectedTags} onChange={setSelectedTags} />`。  
**验收标准**：多项可选，显示已选项，清空和删除标签正常。

### DatePicker

**用途**：日期选择器。  
**使用场景**：选择日期范围或单日期，如开课时间。  
**Props**：`value`、`onChange`、`placeholder`、`format`、`disabledDate`。  
**校验**：格式验证、范围验证。  
**可访问性要求**：使用 `aria-label` 说明日期选择内容。  
**示例用法**：`<DatePicker label="起始日期" value={startDate} onChange={setStartDate} />`。  
**验收标准**：日期弹窗正常打开关闭，选定日期格式正确。

### TimePicker

**用途**：时间选择器。  
**使用场景**：选择时间或时分秒。  
**Props**：`value`、`onChange`、`format`。  
**校验**：合理时间范围检查。  
**示例用法**：`<TimePicker label="开始时间" value={startTime} onChange={setStartTime} />`。  
**验收标准**：时间选择器正常，格式符合设定。

### Switch

**用途**：开关切换按钮。  
**使用场景**：开启/关闭选项，如通知开关。  
**Props**：`checked`、`onChange`、`disabled`。  
**状态**：开/关、禁用。  
**校验**：无特殊校验，仅同步状态。  
**可访问性要求**：提供标签和 `aria-checked`。  
**示例用法**：`<Switch label="启用功能" checked={enabled} onChange={setEnabled} />`。  
**验收标准**：点击切换状态，显示与 `checked` 同步。

### Checkbox

**用途**：复选框。  
**使用场景**：多选项设置，如同意条款。  
**Props**：`checked`、`onChange`、`label`。  
**状态**：选中/未选。  
**校验**：无特殊校验。  
**可访问性要求**：关联 `<label>` 标签或使用 `aria-label`，`aria-checked`。  
**示例用法**：`<Checkbox label="我已阅读并同意" checked={agreed} onChange={setAgreed} />`。  
**验收标准**：勾选状态正确，辅助文本读出。

### RadioGroup

**用途**：单选按钮组。  
**使用场景**：选择性别、单选题等。  
**Props**：`options` (value & label)、`value`、`onChange`。  
**状态**：选中、高亮。  
**校验**：必选校验。  
**可访问性要求**：使用 `<fieldset>` 和 `<legend>` 包裹并关联。  
**示例用法**：`<RadioGroup label="性别" options={[{label:'男',value:'M'},{label:'女',value:'F'}]} value={gender} onChange={setGender} />`。  
**验收标准**：单选功能正常，辅助说明完整。

### TextArea

**用途**：多行文本输入。  
**使用场景**：描述、备注、反馈等长文本输入。  
**Props**：`value`、`onChange`、`rows`、`maxLength`。  
**状态**：正常、焦点、错误。  
**校验**：长度限制、必填检查。  
**可访问性要求**：关联 `<label>` 或 `aria-label`。  
**示例用法**：`<TextArea label="问题描述" value={desc} onChange={setDesc} rows={4} />`。  
**验收标准**：文本输入正常，长度限制效果正确。

### FileUpload

**用途**：文件上传控件。  
**使用场景**：上传附件、导入数据、图片上传等。  
**Props**：`multiple`、`accept`、`onChange`、`showPreview` 等。  
**状态**：文件选中、上传中、上传完成。  
**可访问性要求**：使用 `<input type="file">` 并提供说明文本。  
**示例用法**：`<FileUpload label="上传文件" accept=".csv" onChange={handleFile} />`。  
**验收标准**：选择文件正常，格式过滤生效，回调获取文件列表。

### SearchInput

**用途**：带搜索图标的输入框。  
**使用场景**：搜索框。  
**Props**：`placeholder`、`value`、`onSearch`。  
**状态**：焦点、输入、空。  
**事件**：`onSearch(value)`（回车或点击搜索）。  
**示例用法**：`<SearchInput placeholder="搜索课程" onSearch={handleSearch} />`。  
**验收标准**：输入后回车或点击触发搜索回调。

### FormSection

**用途**：表单区域分组容器。  
**使用场景**：表单中的不同分组，如“基本信息”、“高级选项”等。  
**Props**：`title`、`children`、`collapsible` (是否可折叠)。  
**状态**：展开/折叠。  
**验收标准**：标题显示正确，可点击折叠/展开内容。

### FormActions

**用途**：表单底部操作按钮组。  
**使用场景**：确认/取消按钮区域。  
**Props**：`onSubmit`、`onCancel`、`submitText`、`cancelText` 等。  
**状态**：正常、提交中。  
**验收标准**：按钮布局正确，功能触发回调，提交时显示加载状态。

### ValidationMessage

**用途**：表单验证错误消息。  
**使用场景**：表单项校验未通过时提示文字。  
**Props**：`message`。  
**验收标准**：文本突出显示，颜色为设计中的错误色，辅助工具读出。

#### DecisionForm

**用途**：学员决策填写表单。  
**使用场景**：学员在回合开放时填写决策输入。  
**Props**：`teamId`、`roundId`、`onSubmit`。  
**特点**：支持保存草稿、字段校验、团队协作视图、截止时间锁定。  
**状态**：`draft`（草稿，部分填写）、`submitted`（已提交，只读）、`locked`（截止后只读）。  
**逻辑**：提交时创建 `DecisionVersion`；截止前可反复编辑草稿。【设计规范】  
**验收标准**：保存草稿后自动恢复数据，提交后页面锁定，显示已提交状态。

#### ScenarioConfigForm

**用途**：教师配置仿真场景参数表单。  
**使用场景**：教师创建/编辑课程时选择场景包和参数。  
**Props**：`scenarioPackages`、`pluginPackages`、`parameterSets`。  
**特点**：选择场景包、行业插件、参数集，配置回合数、信息可见性、注入Shock事件等。  
**校验**：必须选择至少一个场景包和参数集；回合数范围校验。  
**验收标准**：选择项更新课程模型，保存成功。

#### ParameterSetForm

**用途**：参数集详情编辑表单。  
**使用场景**：管理员或教师创建/编辑参数集。  
**Props**：`parameterSet`（当前对象）、`editable` (只有 draft 可编辑)。  
**特点**：草稿状态可修改所有参数；审批通过后只读。  
**行为**：基于动态Schema生成输入项，实时验证输入有效性。  
**验收标准**：草稿时参数可改，提交审批后展示只读视图。

#### PluginConfigForm

**用途**：行业插件配置表单。  
**使用场景**：创建/编辑行业插件包。  
**Props**：`pluginManifest` (插件描述)、`uiSchema` (配置Schema)。  
**特点**：显示插件元信息，提供动态字段输入，配置结算钩子等。  
**校验**：兼容性检查，必填字段校验。  
**验收标准**：配置项自动根据Schema生成，数据保存正确。

---

## 9. 数据展示组件

数据展示组件包括表格、图表、列表等，用于显示和交互操作数据。

### DataTable

**用途**：通用表格组件。  
**使用场景**：用户列表、决策记录、参数列表等表格展示。  
**Props**：`columns`、`dataSource`、`pagination`、`loading`、`rowSelection` 等。  
**功能**：列配置（标题、字段、渲染方式）、排序、筛选、全局搜索、分页、批量选择、行内操作按钮。  
**状态**：加载状态（Skeleton 或 Spinner）、空数据状态（EmptyState）、普通显示。  
**权限控制**：列或操作按钮根据用户权限显示/隐藏。  
**示例用法**：列示例 `{ title: '姓名', dataIndex: 'name' }`。  
**验收标准**：表头固定清晰，数据正确渲染，多选和筛选功能正常，空/加载状态友好提示。

### SimpleTable

**用途**：基础表格，用于小量数据列表。  
**使用场景**：二维 Key-Value 列表，如详情面板字段列表。  
**Props**：`columns`、`data`。  
**验收标准**：同 DataTable 的简化版。

### KeyValueList

**用途**：键值对列表。  
**使用场景**：数据显示面板，如对象属性展示。  
**Props**：`items` (数组包含 key 和 value)。  
**验收标准**：名称和值对齐，换行布局适宜。

### DescriptionList

**用途**：描述列表。  
**使用场景**：详情页，属性值说明表格。  
**Props**：`items` (label, value, optional)。  
**验收标准**：名词-值对样式清晰，辅助说明显示正确。

### MetricCard

**用途**：指标卡片。  
**使用场景**：仪表盘展示关键指标（数字和标题）。  
**Props**：`title`、`value`、`trend`、`icon`。  
**验收标准**：图标和文本对齐，数字动态更新合理。

### StatCard

**用途**：统计卡片。  
**使用场景**：趋势展示，包含折线/条形图和数字。  
**Props**：`title`、`seriesData`、`xAxis`。  
**验收标准**：图表渲染正常，数值格式正确。

### KPIGrid

**用途**：关键绩效网格。  
**使用场景**：多项数值指标汇总。  
**Props**：`metrics` (数组)。  
**验收标准**：卡片对齐一致，所有指标标题和值正确。

### Timeline

**用途**：时间线列表。  
**使用场景**：事件日志、进度步骤展示。  
**Props**：`items` (时间线条目列表)。  
**验收标准**：时间点顺序正确，内容对齐，状态区分明显。

### AuditTimeline

**用途**：审计操作时间线。  
**使用场景**：展示审批、发布、修改等事件按时间的记录。  
**Props**：`logs` (按时间排序的审计记录)。  
**验收标准**：时间顺序清晰，每条记录显示用户、操作内容。

### ActivityFeed

**用途**：活动流。  
**使用场景**：最近活动、消息中心。  
**Props**：`activities` (带时间和内容数组)。  
**验收标准**：加载更多分页可用，显示时间戳和内容。

### EmptyState

**用途**：空数据提示视图。  
**使用场景**：表格/列表无数据时展示。  
**Props**：`message`、`icon` 等。  
**验收标准**：提示内容清晰，样式符合设计。

### ErrorState

**用途**：错误提示视图。  
**使用场景**：加载失败、发生异常时展示。  
**Props**：`message`、`onRetry`。  
**验收标准**：错误信息清晰，提供重试按钮。

### LoadingState

**用途**：加载中占位视图。  
**使用场景**：数据加载期间显示的占位符。  
**Props**：无或自定义加载文案。  
**验收标准**：动画或骨架屏展示合理。

### DetailPanel

**用途**：详情面板。  
**使用场景**：显示对象详细属性列表，可折叠。  
**Props**：`title`、`sections` (可折叠区块)。  
**验收标准**：显示完整的对象字段，折叠/展开正常。

### JSONViewer

**用途**：JSON 格式数据查看器。  
**使用场景**：调试或显示原始数据。  
**Props**：`json` 对象。  
**验收标准**：格式化显示 JSON，支持折叠。

### DiffViewer

**用途**：文本差异比较视图。  
**使用场景**：对比版本差异，如参数更改前后。  
**Props**：`oldText`、`newText`。  
**验收标准**：差异高亮清晰，行号对应。

---

## 10. 状态与标签组件

状态徽章用于高亮展示各种状态和级别信息，采用语义化配色和文案。各状态应对业务明确含义。

| 状态类型    | 状态值                                     | UI 表现            | 说明                  |
|-----------|-----------------------------------------|-----------------|---------------------|
| Round Status       | `draft`                                    | 灰色背景、白字标签    | 回合草稿阶段              |
|                 | `open`                                    | 绿色背景、白字标签    | 回合进行中（开放决策）        |
|                 | `locked`                                  | 橙色背景、白字标签    | 回合锁定（决策截止）         |
|                 | `settling`                                | 蓝色背景、白字标签    | 系统正在结算               |
|                 | `settled`                                 | 蓝绿色背景、白字标签   | 已结算完成               |
|                 | `published`                               | 深绿色背景、白字标签   | 结果已发布               |
|                 | `archived`                                | 灰色背景、白字标签    | 历史已归档               |
| ParameterSet Status | `draft`                                 | 灰色标签             | 参数集草稿未提交            |
|                 | `candidate`                               | 浅蓝色标签            | 候选待审批               |
|                 | `validating`                              | 橙色标签             | 正在校验参数              |
|                 | `shadow_testing`                          | 紫色标签             | 影子测试中               |
|                 | `shadow_passed`                           | 青色标签             | 影子测试通过             |
|                 | `approved`                                | 深绿色标签            | 已批准正式使用            |
|                 | `bound`                                   | 蓝色标签             | 已绑定              |
|                 | `deprecated`                              | 红色标签             | 已弃用              |
|                 | `rolled_back`                             | 灰色标签             | 已回滚              |
| Plugin Status       | `draft`                                 | 灰色标签             | 插件草稿              |
|                 | `testing`                                 | 青色标签             | 测试中              |
|                 | `shadow_testing`                          | 紫色标签             | 影子测试中            |
|                 | `approved`                                | 深绿色标签            | 审核通过            |
|                 | `deployed`                                | 绿色标签             | 已部署              |
|                 | `deprecated`                              | 红色标签             | 已弃用              |
|                 | `rolled_back`                             | 灰色标签             | 已回滚              |
| AI Output Type      | `advisory`                              | 浅蓝色标签            | 建议/咨询型输出            |
|                 | `draft`                                   | 灰色标签             | 草稿                |
|                 | `explanation`                             | 紫色标签             | 解释型输出             |
|                 | `recommendation`                          | 绿色标签             | 建议/推荐              |
|                 | `risk_challenge`                          | 红色标签             | 风险挑战              |
| Approval Status     | `pending`                                | 橙色标签             | 待审批              |
|                 | `approved`                                | 绿色标签             | 已批准              |
|                 | `rejected`                                | 红色标签             | 拒绝              |
|                 | `cancelled`                               | 灰色标签             | 已取消              |

以上状态显示规则必须与产品含义对应，并使用一致的色彩与图标标识。举例：圆形徽章或矩形标签显示状态文字，颜色应与设计系统中的状态色相符，确保高对比度可读。各状态标签组件（如 `RoundStatusBadge`, `DecisionStatusBadge` 等）需遵循本表定义样式。

---

## 11. 图表组件

用于数据可视化的图表组件，帮助用户理解数据趋势与分布。下表列出常用图表及其使用场景和权限限制：

| 图表组件         | 使用场景               | 数据来源                   | 权限约束                 | 注意事项 |
|---------------|--------------------|-------------------------|----------------------|-------|
| 折线图 (LineChart)       | 多轮决策结果趋势      | SettlementResult、TimeSeries | 教师可全量查看，学员视图屏蔽未授权真值【10†L4-L9】 | 学员端需剔除真实竞争对手数据，只显示授权队伍数据      |
| 柱状图 (BarChart)       | 队伍对比             | SettlementResult、TeamStats | 教师可查看全部数据      | 饼图、柱状图颜色区分队伍，AI 结果用虚线或附注标出    |
| 雷达图 (RadarChart)     | 能力诊断             | LearningReport、能力模型   | 教师/学员（各自数据）      | 仅在教学诊断页面显示，学员只能看到个人/队伍视图    |
| 热力图 (Heatmap)        | 市场热度或弹性分析    | MarketAnalysis             | 教师可查看市场数据      | 图例说明热度含义，避免学员看到过于详细的商业数据    |
| 瀑布图 (WaterfallChart) | 财务利润分解         | SettlementResult          | 教师/学员（去除真值成分） | 学员端仅显示自己队伍和竞争影响因子，AI解释用灰色强调 |
| 漏斗图 (FunnelChart)    | 决策转化/市场竞争分析 | MarketResult、SalesData    | 教师可查看全部流水数据    | 强调关键转化步骤，学员只看自己团队相关漏斗         |
| 散点图 (ScatterPlot)    | 决策变量相关性       | CustomData                | 教师端                | 显示决策变量关联性，AI分析可标注异常点            |
| 趋势图 (TrendChart)     | 长期绩效趋势         | SettlementResult          | 教师/学员（各自视图）      | 学员只能看自己队伍的长期走势                  |
| 对比图 (ComparisonChart)| 对比不同条件下结果    | ReplayReport、ShadowData   | 教师/治理人员           | 差异结果以颜色标记，超阈值以红色突出             |
| 评分细目图 (ScoreBreakdownChart) | 评分规则分解      | SettlementResult          | 教师/学员（学员仅部分）    | 各评分项占比可视化，高风险项用警示色标记         |

**注意：**学员端所有图表必须剔除未授权的真正数据；AI 辅助的分析图表需标明“AI 辅助”并显示信心水平和风险提示【10†L4-L9】。图表组件应使用高对比色彩方案满足可读性和可访问性要求。

---

## 12. 教师端业务组件

教师端的业务组件包含管理课程、回合、决策监控、复盘等功能模块。

### CourseCard

**用途**：展示课程概览的信息卡片。  
**使用页面**：课程列表页中的课程项。  
**Props**：`course` 对象。  
**数据依赖**：课程名称、创建时间、状态、当前轮数等。  
**权限**：老师或管理员可见，学员不可。  
**验收标准**：显示课程标题、进度（如当前回合/总回合）和状态标签，点击跳转课程详情。

### CourseCreateWizard

**用途**：创建课程的向导组件，分步完成配置。  
**使用页面**：教师端创建课程页。  
**Props**：无 (内部管理状态)。  
**流程**：步骤包括：基本信息 -> 场景配置 -> 团队分配 -> 发布设置。  
**权限**：仅教师或管理员可使用。  
**验收标准**：流程清晰分步，前后步骤数据校验有效，所有选项在最后一步提交时生效。

### ScenarioSelector

**用途**：场景包选择下拉。  
**使用页面**：场景配置页。  
**Props**：`options` (场景包列表)、`value`、`onChange`。  
**权限**：可见所有场景包，当前课程所选显示。  
**验收标准**：下拉列表内容正确，选择后更新父组件状态。

### PluginSelector

**用途**：行业插件选择器。  
**使用页面**：场景配置页。  
**Props**：`options` (插件包列表)、`value`、`onChange`。  
**权限**：只列出已批准（approved/deployed）插件。  
**验收标准**：所选插件显示正确，支持多选或单选配置。

### ParameterSetSelector

**用途**：参数集选择器。  
**使用页面**：场景配置页。  
**Props**：`options` (参数集列表)、`value`、`onChange`。  
**权限**：列出 approved 或 candidate 状态的参数集。  
**验收标准**：选择后更新课程参数集，支持清除已选。

### TeamAssignmentPanel

**用途**：队伍管理面板。  
**使用页面**：团队管理页（教师端）。  
**Props**：`teams` (队伍列表)、`onAddTeam`、`onRemoveTeam`。  
**状态**：显示各队伍名称和成员列表，可编辑队名。  
**权限**：教师可新增、编辑、删除队伍及分配学员。  
**验收标准**：创建和删除队伍功能正常，成员拖拽或分配生效。

### RoundControlPanel

**用途**：回合控制面板。  
**使用页面**：回合控制页（教师端）。  
**Props**：`rounds` (回合列表)、`currentRound`、`onLock`、`onRelease`、`onSettle`。  
**操作**：开始、锁定、结算、发布结果等按钮。  
**权限**：教师可操作回合状态。  
**状态**：按钮依回合状态可用/禁用，例如回合 `open` 时可锁定，`locked` 时可结算。  
**验收标准**：按钮状态正确，点击后回合进入相应流程状态，并反馈成功或失败。

### DecisionMonitorTable

**用途**：决策监控表。  
**使用页面**：决策监控页（教师端）。  
**Props**：`decisions` (团队提交的决策列表)。  
**功能**：按队伍显示每轮提交的决策摘要、时间、版本等。  
**权限**：教师可查看所有队伍决策状态。  
**验收标准**：团队决策实时刷新，未提交显示提示，可手动刷新。

### SettlementResultPanel

**用途**：结算结果面板。  
**使用页面**：结算结果页（教师端）。  
**Props**：`settlementData` (本轮和累计数据)。  
**内容**：显示本轮各队收益、成本、排名等，以及累计指标。  
**权限**：正式结算后才能查看；学员端仅看自己部分。  
**验收标准**：结果数据准确，按钮可发布或隐藏结果。

### StudentPerformancePanel

**用途**：学员表现展示。  
**使用页面**：复盘报告页。  
**Props**：`teamResults` (所有队伍数据)。  
**内容**：团队比较图表、排名列表。  
**权限**：仅教师可查看团队间对比。  
**验收标准**：图表或表格数据准确，排名逻辑正确。

### ShockInjectionPanel

**用途**：注入随机事件或 Shock 设置面板。  
**使用页面**：回合控制或课程配置页。  
**Props**：`shocks` (事件列表)。  
**权限**：教师设置或启用特定 shock 事件（参见行业插件文档）。  
**验收标准**：事件开关状态保存，课程回合中会触发配置的事件。

### TeacherDebriefEditor

**用途**：教师复盘报告编辑器。  
**使用页面**：复盘报告页（教师端）。  
**Props**：`draftContent`、`onPublish`。  
**功能**：编辑包含文字、图表、示例决策等的复盘草稿。  
**权限**：教师编辑并发布复盘给学员。  
**验收标准**：草稿编辑功能完整，发布后学员可查看精简版复盘。

### RubricAssessmentPanel

**用途**：评分细则与打分面板。  
**使用页面**：教师给定型考核评分时。  
**Props**：`rubric` (评分标准列表)。  
**权限**：教师使用，学员端只读查看。  
**验收标准**：评分规则与预期一致，可以选择/计算分数。

### LearningDiagnosisPanel

**用途**：学习诊断展示。  
**使用页面**：学习诊断页。  
**Props**：`learningData` (诊断指标和建议)。  
**权限**：教师查看全局诊断结果，学员查看个人报告。  
**验收标准**：诊断图表和指标正确渲染，指导建议文本显示。

---

## 13. 学员端业务组件

学员端组件聚焦在个人/团队决策过程和结果反馈。

### StudentCourseCard

**用途**：学员端课程概览卡片。  
**使用页面**：学员“我的课程”列表。  
**Props**：`course` (含本团队队名、当前回合、截止时间)。  
**权限**：学员可见参与的课程。  
**验收标准**：显示课程名称、队伍信息、当前回合状态，点击进入团队驾驶舱。

### TeamDashboard

**用途**：团队驾驶舱。  
**使用页面**：学员进入单个课程后主页面。  
**内容**：团队名称、成员列表、当前回合状态、截止倒计时。  
**权限**：仅本队成员可见。  
**验收标准**：正确展示团队信息，刷新时更新状态。

### MarketInfoPanel

**用途**：市场信息面板。  
**使用页面**：决策填写页旁侧。  
**数据来源**：市场趋势数据、价格指数等。  
**权限**：教师可设置哪些信息公开，学员只能看到授权内容。  
**验收标准**：信息卡片渲染正确，图表数据基于已发布数据。

### DecisionForm

**用途**：学员决策填写表单（同表单组件 DecisionForm）。  
**使用页面**：决策填写页。  
**权限**：仅在回合开放时可编辑；回合锁定后只读显示最后提交版本。  
**验收标准**：可输入决策内容，保存和提交按钮正常，锁定后表单禁用。

### DecisionDraftIndicator

**用途**：决策草稿状态指示器。  
**使用页面**：团队驾驶舱顶部。  
**功能**：显示是否存在未提交草稿，提示“有未提交草稿”。  
**验收标准**：在编辑未提交时出现警示，点击可快速跳转表单。

### DecisionSubmitConfirm

**用途**：决策提交确认对话框。  
**使用页面**：学员点击提交时弹出。  
**Props**：`onConfirm`、`onCancel`。  
**可访问性要求**：确认信息明确指出这将提交最终决策并锁定编辑。  
**验收标准**：点击确认触发提交事件，取消返回表单。

### RoundResultPanel

**用途**：回合结果展示面板。  
**使用页面**：回合结算后学员查看结果页。  
**内容**：显示本队业绩及排名、可见市场结果、简要分析。  
**权限**：仅公开后的结果。`state_true` 真值数据需对学员屏蔽，只显示自己团队观察数据。  
**验收标准**：正确显示收益/现金，排名如教师端公开，未授权数据以“*”或不显示形式处理。

### ThreePartFeedbackPanel

**用途**：三段式反馈展示。  
**使用页面**：结算结果页或复盘中。  
**内容**：从“发生了什么”、“为什么发生”、“下一步风险与建议”三方面给出文本反馈。  
**权限**：教师编辑并发布，学员查看作者发布内容。  
**验收标准**：三段式内容条理清晰，学员只读。

### ReflectionForm

**用途**：学员反思输入表单。  
**使用页面**：复盘反思页。  
**Props**：`questions` (反思问题列表)。  
**功能**：学员填写回合后感想和总结。  
**验收标准**：表单提交保存反思内容，输入框校验正常。

### LearningReportCard

**用途**：学习报告卡。  
**使用页面**：学员查看学习报告页面。  
**Props**：`reportData` (诊断得分和建议)。  
**内容**：展示个性化诊断图表和改进建议。  
**权限**：学员只能查看自己数据。  
**验收标准**：数据加载正确，图表和文本完整显示。

### HistoricalPerformancePanel

**用途**：历史表现面板。  
**使用页面**：学员个人主页或课程总结页。  
**内容**：历次课程/决赛指标对比，趋势折线图等。  
**权限**：仅个人数据对本人可见。  
**验收标准**：图表数据对应个人历史，隐私数据屏蔽。

**注意：**学员端所有组件不得显示未授权的 `state_true` 真值数据，只显示 `state_obs` 或 `state_est` 等授权内容。

---

## 14. AI 业务组件

AI 业务组件用于展示 AI 小模型输出、证据和风险提示。所有 AI 输出应显式标记为“AI 辅助建议/草稿/解释”等，以免与正式结果混淆【10†L4-L9】。

| 组件               | 功能               | 输入                  | 输出            | 权限           | 注意事项                        |
|------------------|------------------|---------------------|---------------|-------------|-----------------------------|
| AIAdviceCard     | 显示 AI 建议       | `title`, `summary`, `evidenceCards`, `risks`, `confidence`, `outputType` | AI 建议摘要      | 教师可编辑/发布，学员只读 | 必须标记为“AI 辅助建议”，显示置信度和风险【10†L4-L9】 |
| EvidenceCard     | 显示证据来源       | `sourceType`, `content` | 证据文本或引用    | 教师可查看全部，学员部分裁剪 | 区分系统数据 vs 调研 vs 知识库；学员视图裁剪敏感信息 |
| RiskChallengeCard| 风险挑战描述       | `scenario`, `riskLevel`, `details` | 风险提示文本    | 教师/治理人员可见 | 高风险用红色强调，必须有行动建议         |
| FinanceExplanationCard | 财务结果解释    | `metrics`, `variations` | 瀑布图和解释文本   | 教师/学员（简化版）  | 图表标注差异来源，学员版隐藏敏感数据 |
| MarketAnalysisCard | 市场走势分析      | `marketData`         | 趋势图和要点    | 教师/学员        | 强调关键驱动因素，AI贡献用辅助色显示     |
| RoleAgentChatPanel | AI 职能助手对话   | `role`, `messages`    | 对话接口        | 教师/学员        | 模拟角色对话，输入输出区分提示           |
| DebriefDraftPanel | AI 复盘草稿        | `roundId`, `context`  | 草稿内容       | 教师          | 生成草稿供教师编辑，显示未最终化标记       |
| LearningRecommendationCard | 学习建议卡  | `performanceMetrics`  | 改进建议列表    | 教师/学员        | 基于诊断结果给出个性化建议             |
| RubricJudgeCard   | 细则评分辅助       | `rubric`, `submission` | 评分建议与依据   | 教师          | 提供参考分数，最终分仍由教师审核       |
| AIOutputAuditInfo | AI 输出审计信息    | `metadata`          | 输出模型、时间等 | 管理员/治理人员  | 记录调用模型版本和参数，审计不可篡改       |

**注意：**AI 输出组件需明确标识其辅助性质，不提供自动提交按钮。所有与 AI 相关的输出应写入专门的“建议”表或日志，而不是正式结果表【10†L4-L9】。

---

## 15. Replay / Shadow Replay 组件

用于显示和对比 Replay 或 Shadow Replay 的结果差异，不影响正式结算结果。所有 Replay 数据应独立管理，并突出差异提示。

### ReplayRunButton

**用途**：触发执行 Replay 的按钮。  
**使用场景**：回放任务入口。  
**Props**：`onRun`。  
**权限**：教师/模型治理可见。  
**验收标准**：点击触发后台 Replay 任务，显示执行状态。

### ReplayReportPanel

**用途**：展示单次 Replay 运行结果。  
**使用页面**：Replay 报告页。  
**Props**：`report` (ReplayReport 数据)。  
**内容**：包括原始输入、Replay 输出结果与正式结果对比摘要。  
**权限**：教师/治理可见。  
**验收标准**：数据完整显示，差异字段突出。

### ReplayDiffCard

**用途**：显示具体数据差异的卡片。  
**使用页面**：Replay 对比页。  
**Props**：`fieldName`、`trueValue`、`replayValue`、`threshold`。  
**权限**：教师/治理人员可见。  
**输出**：差异值及提示是否超阈。  
**验收标准**：超阈值时使用警示色，高亮对比，提供简要说明。

### ShadowReplayComparisonTable

**用途**：Shadow Replay 差异表格。  
**使用页面**：Shadow Replay 管理页。  
**Props**：`differences` (字段差异列表)。  
**权限**：模型治理/管理员可见。  
**验收标准**：所有字段差异列出，超限项显红。

### ReplayStatusTimeline

**用途**：Replay 过程状态时间轴。  
**使用页面**：Replay 运行详情页。  
**Props**：`steps` (步骤列表)。  
**权限**：教师/治理。  
**验收标准**：步骤和时间点正确，对应逻辑一致。

### ReplayHashViewer

**用途**：展示输入/输出哈希值。  
**使用页面**：Replay 报告详情。  
**Props**：`hashData`。  
**权限**：技术人员查看。  
**验收标准**：确保不同数据的哈希值差异可见。

### DiffThresholdIndicator

**用途**：差异阈值指示器。  
**使用页面**：Replay 结果页面。  
**Props**：`thresholdValue`。  
**权限**：教师/治理可见。  
**验收标准**：阈值标明差异警戒标准。

### GovernanceApprovalPanel

**用途**：差异超限后的审批面板。  
**使用页面**：Replay 差异报告页。  
**Props**：`reportId`、`onApprove`、`onReject`。  
**权限**：模型治理人员。  
**验收标准**：显示差异详情和决策按钮，记录审批结果。

**说明：**Replay 操作不影响正式结果，Shadow Replay 不覆盖主数据。若差异超阈值，需提示并进入审批流程。学员端默认不显示完整 Replay 差异内容。

---

## 16. 审计与治理组件

审计和治理组件用于记录和展示系统操作日志、审批流程和版本历史等。

### AuditLogTable

**用途**：审计日志列表表格。  
**使用页面**：管理后台审计日志页。  
**Props**：`logs` (审计记录数组)。  
**列**：时间、用户、操作对象、操作描述。  
**权限**：管理员和安全审计员可见。  
**验收标准**：按时间倒序显示，支持搜索过滤。

### AuditTimeline

**用途**：审计操作时间线（同上DataDisplay Timeline）。  
**使用页面**：详情审计查看页。  
**Props**：`auditEntries`。  
**权限**：管理员/相关角色。  
**验收标准**：操作事件按时间顺序显示。

### ApprovalCard

**用途**：审批记录卡片。  
**使用页面**：参数/插件审批详情页。  
**Props**：`approval` (审批记录)。  
**内容**：请求人、审核人、审批状态、原因。  
**权限**：涉及审批流程时展示。  
**验收标准**：信息完整可读，状态标签明确。

### ApprovalWorkflowPanel

**用途**：审批流程概览。  
**使用页面**：治理后台审批管理页。  
**Props**：`flows` (流程步骤及状态)。  
**权限**：管理员/治理人员。  
**验收标准**：多个审批节点及负责人显示。

### VersionHistoryPanel

**用途**：版本历史查看面板。  
**使用页面**：模型/参数等版本管理页。  
**Props**：`versions` (版本列表)。  
**权限**：所有涉及对象的管理/查询人员。  
**验收标准**：列出版本号、发布人、日期，支持回滚查看变更。

### ModelVersionSelector

**用途**：模型版本选择器。  
**使用页面**：AI 模型调用配置页。  
**Props**：`versions`、`value`、`onChange`。  
**权限**：模型治理/管理员。  
**验收标准**：正确列出已有模型版本，可切换。

### PromptVersionSelector

**用途**：Prompt 版本选择器。  
**使用页面**：AI 设计配置页。  
**Props**：`versions`、`value`、`onChange`。  
**权限**：AI 团队/管理员。  
**验收标准**：列出 Prompt 历史版本，可选。

### ParameterSetDiffViewer

**用途**：参数集差异查看组件。  
**使用页面**：参数集版本对比页。  
**Props**：`oldValues`、`newValues`。  
**权限**：管理员/模型治理。  
**验收标准**：显示修改前后数据差异，高亮变化字段。

### PluginValidationReport

**用途**：插件校验报告面板。  
**使用页面**：插件发布前检验页。  
**Props**：`reportData`。  
**权限**：开发/治理人员。  
**验收标准**：列出兼容性错误与警告，供用户修复。

### GovernanceGateStatus

**用途**：治理门状态显示。  
**使用页面**：仿真引擎监控或管理页。  
**Props**：`gateStatus` (如Running/Paused/Stopped)。  
**权限**：系统运维/管理员。  
**验收标准**：当前运行状态显示，警告时红色标记。

以上组件通常仅由具有相应权限的用户或管理员查看。审计记录一旦生成不可删除，审批操作必须记录在案，并且支持导出和过滤查看。

---

## 17. 权限组件

权限组件用于控制其他组件的显隐和可用性。所有权限逻辑最好在后端核实，前端仅做二次校验和提示。

### PermissionGuard

**用途**：基于权限控制渲染组件或路由。  
**Props**：`permission`、`children`。  
**功能**：如果用户缺少权限，隐藏或重定向。  
**验收标准**：仅在用户拥有指定权限时才渲染子组件。

### RoleGuard

**用途**：基于角色显示组件。  
**Props**：`roles` (允许的角色列表)、`children`。  
**功能**：用户角色不在列表时隐藏组件。  
**验收标准**：按照用户角色动态控制视图。

### FeatureFlagGuard

**用途**：功能开关控制组件。  
**Props**：`flag`、`children`。  
**功能**：根据Feature Flag开关决定是否渲染。  
**验收标准**：开发/运营可通过配置控制功能可见性。

### TenantGuard

**用途**：多租户隔离控制。  
**Props**：`tenantId`、`children`。  
**功能**：如果当前用户不属于指定租户，不渲染。  
**验收标准**：跨租户数据不会展示。

### ReadOnlyWrapper

**用途**：将子组件置为只读。  
**Props**：`readonly`、`children`。  
**功能**：将所有表单元素禁用并隐藏提交按钮。  
**验收标准**：子组件内容不可编辑。

### FieldVisibilityGuard

**用途**：字段可见性控制。  
**Props**：`permission` (或 `fieldName`)、`children`。  
**功能**：无权限时字段元素隐藏或部分掩码。  
**验收标准**：根据指定字段权限动态展示或隐藏输入框/标签。

### SensitiveDataMask

**用途**：敏感数据遮罩组件。  
**使用场景**：展示隐私信息，如电子邮箱、身份证号等，只显示部分。  
**Props**：`value`、`maskingChar`。  
**功能**：自动用 `*` 等替换中间字符。  
**验收标准**：部分数据遮盖，确保只有最后几位可见。

### DisabledWithReason

**用途**：禁用组件时附加原因提示。  
**Props**：`reason`、`children`。  
**功能**：组件置灰并显示悬浮提示原因。  
**验收标准**：禁用状态下组件不可操作，鼠标悬停显示 `reason`。

### AuthorizedActionButton

**用途**：结合权限控制的操作按钮。  
**Props**：`permission`、`onClick`、`children`。  
**功能**：无权限时按钮隐藏或禁用并提示。  
**验收标准**：根据权限渲染按钮，没有权限时显示禁止状态提示。

说明：以上权限组件需配合身份/角色管理状态使用。学员端任何字段或组件显示均需进行权限过滤，不允许越权访问后台数据。AI 小模型输出组件也要进行权限校验，仅在允许时展示对应结果。

---

## 18. 反馈与异常组件

状态组件用于统一显示空、加载、错误等全局状态。

| 状态组件            | 触发条件               | UI 文案占位                         | 用户可操作项         |
|--------------------|----------------------|---------------------------------|------------------|
| EmptyState        | 数据为空             | “暂无数据”，或业务相关空提示               | 可引导点击按钮创建数据  |
| LoadingState      | 数据加载中           | 圆形 Spinner 或骨架屏                  | 无（自动消失）       |
| ErrorState        | 加载或操作失败        | “加载失败，请重试”等错误提示              | “重试”按钮         |
| UnauthorizedState | 无权限访问            | “权限不足”，辅以图标                      | “返回”按钮或提示联系客服 |
| LockedState       | 内容已锁定（如截止）   | “已锁定”状态图标和文字提示                  | 无操作或“返回查看”   |
| ArchivedState     | 内容已归档            | “已归档，无法修改”文案和图标                 | 无操作         |
| PendingApprovalState | 待审批               | “审批中，请等待”                      | “取消申请”按钮     |
| NetworkErrorState | 网络异常             | “网络出错，请检查连接”                   | “重试”按钮        |
| ValidationErrorSummary | 表单校验失败           | 提示校验错误信息列表                     | 定位到错误字段      |
| RetryPanel        | 临时性失败            | “操作失败”提示 + “重试”按钮               | “重试”按钮        |
| MaintenanceBanner | 系统维护/升级         | 顶部横幅“系统维护中”                      | 无，或提供查询日志   |

**说明：** 
- 所有空状态和错误状态组件要清晰简洁，引导用户下一步操作。 
- 禁用按钮时要说明原因并提供帮助链接或提示。 
- 提交前若校验不通过，显示 `ValidationErrorSummary` 定位错误字段。 
- 维护/升级状态应阻止操作并说明恢复时间窗口。

---

## 19. 组件 Props 规范

组件 Props 需清晰定义类型和默认行为，以下为规范示例：

- 命名：小驼峰式 `propName`。  
- 必填/可选：通过 TypeScript 接口或 PropTypes 标明，缺省值用 `=` 在文档示例写出。  
- 回调命名：`on` 前缀加动词，如 `onSubmit`, `onCancel`, `onOpenDetail`。  
- 权限字段：如 `canEdit`, `disabledReason` 等。  
- 状态字段：`loading?: boolean`, `error?: string`, `disabled?: boolean`, `readonly?: boolean`。  
- 样式透传：接受 `className?: string` 和 `style?: React.CSSProperties`。  
- 插槽/子组件：支持 `children`。  
- 测试 ID：支持 `data-testid?: string` 用于自动化测试。

示例接口（TypeScript）：

```typescript
export interface AIAdviceCardProps {
  outputId: string;
  title: string;
  summary: string;
  evidenceCards: EvidenceCardData[];
  risks: RiskItem[];
  confidence?: number;
  outputType: "advisory" | "draft" | "explanation";
  loading?: boolean;
  disabled?: boolean;
  onOpenDetail?: (outputId: string) => void;
}
```

---

## 20. 组件事件规范

事件回调命名应与操作含义一致，以下为常见规范示例：

| 事件命名      | 用途         | 示例                     |
|-------------|------------|------------------------|
| onSubmit    | 表单提交      | `onSubmitDecision`    |
| onCancel    | 取消操作      | `onCancel`            |
| onConfirm   | 确认操作      | `onConfirmDelete`     |
| onApprove   | 审批通过      | `onApproveParameterSet` |
| onReject    | 审批拒绝      | `onRejectPlugin`      |
| onRetry     | 重试         | `onRetryReplay`       |
| onOpenDetail| 打开详情      | `onOpenDetail`        |
| onClose     | 关闭对话框    | `onCloseModal`        |
| onChange    | 值改变        | `onChangeValue`       |
| onSelect    | 选择操作      | `onSelectTeam`        |
| onLock      | 锁定回合      | `onLockRound`         |
| onSettle    | 结算回合      | `onSettleRound`       |
| onPublish   | 发布结果      | `onPublishResult`     |

---

## 21. 组件与 API 映射

下表列出部分典型页面组件与其依赖的后端 API 及请求时机：

| 组件           | 依赖 API              | 请求时机           | 数据用途                  | 错误处理         |
|---------------|---------------------|------------------|-----------------------|--------------|
| CourseCard    | GET /api/courses  | 页面加载时        | 获取课程列表              | 显示空状态或错误提示   |
| CourseCreateWizard | POST /api/courses | 点击完成创建课程时  | 创建新课程              | 表单校验失败提示     |
| RoundControlPanel | POST /api/rounds/{id}/lock <br> POST /api/rounds/{id}/settle | 点击锁定/结算按钮时 | 锁定回合并触发结算         | 显示错误原因      |
| DecisionForm   | POST /api/rounds/{id}/decisions | 点击提交决策时     | 提交决策内容             | 校验失败或请求错误提示 |
| SettlementResultPanel | GET /api/rounds/{id}/results | 回合结算完成后加载 | 获取结算结果              | 重试或显示错误   |
| AIAdviceCard   | POST /api/ai/orchestrator/generate | 学员请求 AI 建议时  | 生成并获取 AI 建议内容       | 显示失败状态      |
| DebriefDraftPanel | GET /api/rounds/{id}/debrief-draft <br> POST /api/rounds/{id}/debrief | 教师触发 AI 生成并保存复盘草稿 | 获取或保存复盘草稿内容    | 提示错误信息     |
| ReplayReportPanel | POST /api/replay/start <br> GET /api/replay/{id}/report | 触发 Replay 并拉取报告 | 执行 Replay 并获取对比报告   | 显示任务状态或错误 |
| ParameterSetSelector | GET /api/parameter-sets | 加载场景配置页时    | 获取可选参数集列表          | 无网络时提示    |
| PluginSelector  | GET /api/plugin-packages | 加载场景配置页时    | 获取可选插件包列表          | 无网络时提示    |
| AuditLogTable   | GET /api/audit-logs | 页面加载和筛选时    | 获取审计日志记录           | 显示错误消息     |

所有请求应携带用户凭证（Token），接口返回错误时应在对应组件或页面上以友好方式提示用户。

---

## 22. 组件与数据对象映射

下表列出组件与主要数据模型字段的映射，便于前后端对齐和权限裁剪：

| 组件              | 主要数据对象         | 可见字段                        | 权限裁剪                   |
|-------------------|-----------------|-----------------------------|-------------------------|
| CourseCard        | Course          | `id, name, status, currentRound` | 学员只能看到自己参与的课程   |
| RoundControlPanel | Round           | `id, status, startTime, endTime` | 学员端不可访问             |
| DecisionForm      | Decision        | `teamId, roundId, content, version` | 学员只能编辑自己团队版本；教师可查看全部 |
|                   | DecisionVersion | `id, fields, timestamp`       |                          |
| SettlementResultPanel | SettlementResult | `teamId, revenue, profit, ranking` | 学员只能看到自己队伍结果       |
| AIAdviceCard      | CoachOutput     | `id, title, summary, evidence, risk` | 学员只能查看授权建议         |
| DebriefDraftPanel | CoachOutput     | `id, draftContent`           | 学员不可查看草稿，只能查看教师发布 |
| ReplayReportPanel | ReplayReport    | `id, differences, status`     | 学生通常不可查看差异详情       |
| ParameterSetSelector | ParameterSet   | `id, name, status`            | 学员不可访问高级参数集详情     |
| PluginSelector    | PluginPackage   | `id, name, status`            | 只列出已批准插件包           |
| AuditLogTable     | AuditLog        | `user, action, objectId, timestamp` | 除管理员外不可删除审计记录    |

以上映射用于前端在渲染组件时决定显示哪些字段，同时用于后端返回接口字段说明和前端状态判断。

---

## 23. Figma 组件结构

建议在 Figma 中按功能分组管理组件库，目录示例如下：

```
01 Foundations
02 Base Components
03 Layout Components
04 Form Components
05 Data Display
06 Business Components - Teacher
07 Business Components - Student
08 AI Components
09 Replay Components
10 Governance Components
11 States
12 Templates
```

- **Foundations**：颜色、文字样式、间距、图标等基础设计令牌。  
- **Base Components**：所有基础通用组件（按钮、标签、输入框等）。  
- **Layout Components**：布局类组件（AppShell、Grid、Card 等）。  
- **Form Components**：表单相关组件（Select、Switch、DatePicker 等）。  
- **Data Display**：数据展示组件（Table、Chart、EmptyState、LoadingState）。  
- **Business Components - Teacher**：教师端特有组件集。  
- **Business Components - Student**：学员端特有组件集。  
- **AI Components**：AI 建议、解释相关组件（AIAdviceCard、EvidenceCard 等）。  
- **Replay Components**：Replay 和 Shadow Replay 组件。  
- **Governance Components**：审计和审批组件（AuditTimeline、ApprovalCard）。  
- **States**：各种状态提示组件（Empty、Error、Unauthorized 等）。  
- **Templates**：页面模板示例，用于快速搭建原型。

每组内应按照组件类型再细分文件夹，保持与代码结构一致，方便设计师和开发对齐。

---

## 24. Storybook 文档规范

每个组件应在 Storybook 中覆盖以下场景：

- **Default**：默认渲染，用于展示基本用法。  
- **Loading**：加载中状态。  
- **Empty**：无数据状态。  
- **Error**：错误提示状态。  
- **Disabled**：禁用状态。  
- **Readonly**：只读状态（不可编辑）。  
- **With Permission**：有权限（正常显示某功能）。  
- **Without Permission**：无权限（隐藏或禁用特定功能）。  
- **Mobile**：移动端视口（展示响应式）。  
- **Long Content**：超长文本或列表情况。  
- **Edge Case**：边界情况，如极大数字、特殊字符等。

示例文件结构：

```
src/stories/
├── Button.stories.tsx
├── DecisionForm.stories.tsx
├── AIAdviceCard.stories.tsx
├── ReplayDiffCard.stories.tsx
├── RoundStatusStepper.stories.tsx
└── ...其他组件Story文件
```

所有故事应包括组件名称、不同 Props 配置及注释说明，帮助开发和设计人员快速了解组件行为。

---

## 25. 组件测试规范

组件测试需覆盖渲染、交互、权限和可访问性。示例测试策略：

| 测试类型        | 测试目标              | 示例                   |
|---------------|---------------------|-----------------------|
| 单元测试 (Unit Test)      | 验证 Props 渲染     | `Button` 在不同 `type` 下渲染正确  |
| 交互测试 (Interaction Test)| 用户事件响应       | `DecisionForm` 填写并提交数据触发 `onSubmit`  |
| 权限测试 (Permission Test) | 字段/按钮可见性    | 学员角色不应看到 `state_true` 字段  |
| 可访问性测试 (Accessibility) | ARIA/键盘支持      | `Button` 应包含可聚焦和 `aria-label` |
| 视觉回归 (Visual Regression)  | 快照一致性        | 对比 `AIAdviceCard` 不同状态快照    |
| E2E 测试        | 页面流程           | 学员提交决策并查看反馈流程       |

需要特别覆盖：表单校验与错误提示、权限字段隐藏、AI 输出标识、Replay 差异渲染、回合状态变化、图表可访问性、移动端布局等场景。

---

## 26. 代码目录建议

前端代码可参考以下目录结构：

```
src/
├── components/
│   ├── base/           // 基础组件
│   ├── layout/         // 布局组件
│   ├── navigation/     // 导航组件
│   ├── forms/          // 表单组件
│   ├── data-display/   // 数据展示组件（表格、图表）
│   ├── charts/         // 图表组件
│   ├── feedback/       // 状态反馈组件 (Empty, Loading, Error)
│   ├── permissions/    // 权限控制组件
│   ├── teacher/        // 教师端业务组件
│   ├── student/        // 学员端业务组件
│   ├── ai/             // AI 业务组件
│   ├── replay/         // Replay 组件
│   ├── governance/     // 审计与审批组件
│   └── common/         // 公共组件（如 Modal, Tooltip 等）
├── hooks/              // 自定义 Hooks
├── stores/             // 状态管理 (如 MobX/Redux stores)
├── api/                // API 请求模块
├── types/              // TypeScript 类型定义
├── utils/              // 工具函数
└── stories/            // Storybook 文件
```

每个目录下以组件名或功能名组织文件，如 `Button/Button.tsx`、`DecisionForm/DecisionForm.tsx`。`common` 可放全局通用组件。遵循设计文档和命名规范，确保代码结构清晰。

---

## 27. MVP 组件范围建议

### MVP 必做

- **基础布局**：AppShell、Sidebar、TopNav、PageHeader、Breadcrumb  
- **常规组件**：Button、Modal、ConfirmDialog、DataTable、StatusBadge  
- **业务组件**：RoundStatusStepper、CourseCard、CourseCreateWizard、TeamAssignmentPanel、RoundControlPanel  
- **表单相关**：DecisionForm、TextInput、Select、Switch  
- **结果展示**：SettlementResultPanel、ThreePartFeedbackPanel  
- **AI 相关**：AIAdviceCard、EvidenceCard  
- **状态组件**：EmptyState、LoadingState、ErrorState  
- **权限组件**：PermissionGuard  

### P1 增强

- **Replay 相关**：ReplayDiffCard、DebriefDraftPanel  
- **学习诊断**：LearningDiagnosisPanel、LearningReportCard  
- **参数/插件**：ParameterSetSelector、PluginSelector、ParameterSetDiffViewer  
- **审批流程**：ApprovalWorkflowPanel、AuditTimeline、AuditLogTable  
- **图表组件**：LineChart、BarChart、RadarChart、WaterfallChart 等  
- **完整 Storybook 文档**：覆盖所有组件样例  

### P2 扩展

- **更复杂业务**：RoleAgentChatPanel、社区论坛组件、竞赛组件等  
- **移动端**：手机视图组件适配  
- **性能优化**：批量绘制列表、虚拟滚动等  
- **国际化**：支持多语言  
- **自动化**：设计Token同步、主题定制器  

---

## 28. 风险与注意事项

| 风险                          | 影响                       | 缓解措施                                |
|-----------------------------|--------------------------|---------------------------------------|
| 组件过度业务耦合                   | 复用困难，影响维护               | 明确区分基础组件与业务组件，避免将业务逻辑写入组件本体。     |
| 权限控制仅靠前端实现               | 可被绕过泄露数据                | 后端必须也校验权限，前端仅做用户体验层控制。               |
| 学员端泄露未授权真值               | 数据安全风险                  | 严格在后端过滤，只在前端保留必要字段；组件检查权限标志。       |
| AI 建议被误认为正式结果            | 用户误导                      | 所有 AI 输出必须醒目标注“建议/草稿”，UI上使用不同颜色区分。    |
| Replay 结果与正式结果混淆          | 决策判断错误                  | Replay/Shadow 视图独立标识，使用对比高亮，并提示为模拟结果。    |
| 表单字段过多导致体验差            | 用户难填写，易出错              | 分步表单，必填标记，使用智能校验和逻辑优化（如依赖选项动态显示）。 |
| 图表设计误导用户                  | 做出错误结论                  | 图表注释清晰，学员视角去除未授权数据，确保缩放与标签完整。     |
| 组件状态遗漏                     | 不一致交互                    | 每个组件列出所有状态，开发时覆盖测试；Storybook验证所有状态。    |
| Figma 与代码组件不一致           | 设计与开发脱节                  | 设计更新时同步文档，Storybook 紧跟版本；审查流程加强沟通。      |
| 缺少 Storybook                  | 难以查看组件效果                | 强制要求补充 Storybook 文档，每次新组件必须编写对应故事。       |
| 缺少可访问性测试                | 无障碍风险                    | 集成可访问性扫描工具；对重要组件执行手动无障碍测试（键盘导航、读屏）。 |
| 索引与性能不足                  | 页面渲染缓慢，查询慢              | 针对大表和复杂组件使用懒加载，列表使用虚拟滚动；优化索引与后端查询。  |
| 误删生产数据                     | 业务中断                      | 高风险操作（删除、发布）双重确认，并记录审计日志，可回滚。     |
| 迁移/升级失败                   | 服务中断                      | 预发布环境先行演练，备份回滚机制，自动化回归测试确保兼容。      |

以上风险需在开发和测试阶段纳入重点关注，制定相应应急预案和监控告警。确保开发过程遵循文档规范，以减少需求和实现不一致造成的问题。

---
```

**参考资料：** 设计令牌概念【10†L4-L9】【6†L147-L156】，可访问性和语义化建议【12†L253-L260】【18†L188-L192】，组件库文档最佳实践【18†L198-L201】 等。
