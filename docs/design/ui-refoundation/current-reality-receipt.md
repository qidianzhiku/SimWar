# FE_CURRENT_REALITY_RECEIPT

**收据 ID**：`FE_CURRENT_REALITY_RECEIPT-2026-08-13`

**审计范围**：SimWar 前端 UI/UX Wave 001；包含 exact-source current-product baseline 与 Product PR1 foundation implementation receipt

**权威源码 SHA**：`bb343faf0c38e4a4a6d8b7928d0a0f35ecf8ad37`

**权威来源**：`https://github.com/qidianzhiku/SimWar` 的 `master`；独立审计克隆 `D:\codex\SimWar-fe-wave-001-reality-20260813`

**产品 PR1 工作树**：`D:\codex\SimWar-fe-wave-001-p1-foundation`，分支 `codex/fe-wave-001-foundation`

**审计日期**：2026-08-13（运行时基线文件记录于 2026-08-12 16:41:54Z）

本收据只记录观察到的事实、来源和限制，不把预期设计或历史文档当作现状。后续 PR 必须在新的 exact head 重新生成或更新收据。

## 1. 证据索引

| 证据                                    | 位置/来源                                                                                                          | 结论                                                                                                                                                                                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git source                              | `bb343faf0c38e4a4a6d8b7928d0a0f35ecf8ad37`                                                                         | 本轮所有源码、路由和组件事实的绑定 SHA                                                                                                                                                                                                                                                |
| Graphify                                | 外部索引 `D:\codex\SimWar-fe-wave-001-graphify-bb343faf\graphify-out\graph.json`                                   | `built_at_commit=bb343faf0c38e4a4a6d8b7928d0a0f35ecf8ad37`；11,745 nodes / 18,781 links / 18,643 extracted / 138 inferred / 796 communities / 10 gods / 5 surprises；manifest 未写 SHA，故 commit 绑定来自 graph.json 与外部审计记录                                                  |
| CodeGraph                               | 审计克隆本地 `.codegraph`                                                                                          | CodeGraph v1.2.0；`lastIndexed=2026-08-12T16:39:12.596Z`；473 files / 7,514 nodes / 30,596 edges / pending=0 / mismatch=null；未写入产品工作树                                                                                                                                        |
| Current-product runtime visual evidence | `C:\Users\Marshall\.codex\visualizations\2026\08\12\019ff6ce-99bb-7100-b86c-f47b294d077a\fe-current-baseline-luna` | 3 个 app 的登录、认证、DOM、ARIA、截图、网络和运行时收据；1440×900 current-product baseline；本 PR 不复制二进制                                                                                                                                                                       |
| PR1 DesignSystemLab browser evidence    | `C:\Users\Marshall\.codex\visualizations\2026\08\12\019ff6ce-99bb-7100-b86c-f47b294d077a\fe-pr1-design-system-lab` | tracked `@simwar/ui` lab at the exact branch；runtime JSON hash `E5CD...3764F`；automated four-viewport readback；本 PR 不复制二进制                                                                                                                                                  |
| Post-W025 PR1 DesignSystemLab readback  | `C:\Users\Marshall\.codex\visualizations\2026\08\12\019ff6ce-99bb-7100-b86c-f47b294d077a\fe-pr1-post-w025-rebase`  | source `639b063ea8f6f535a9114fbd558c841191c776e7`；four fresh viewport screenshots、keyboard/reduced-motion/health checks；`receipt.json` SHA-256 `AD7D29B1742F958392C7AD949EBEDD2F409036F9A61FF3D2F33A5CC2CB32871B`；本 PR 不复制二进制                                              |
| Target authorization                    | `C:\Users\Marshall\Downloads\SimWar_UI_Frontend_Experience_Refoundation_Codex_Goal_Mode_Prompt_V1.0_20260813.md`   | Owner signed Macro Wave；允许前端范围内自主变更，禁止真值/权限/生产越界                                                                                                                                                                                                               |
| Figma                                   | `SimWar Design System V6.0`，file key `g73vJXbLoQVhY87lbUaueL`                                                     | variables/styles `P1_PASS`；6 collections / 68 variables；WEB syntax/scope/alias PASS；3 physical pages / 12 logical sections；editable component variants/final screens/Code Connect `BLOCKED_BY_PLAN_LIMIT`；保留 `FIGMA_STARTER_3_PAGE_LIMIT`，新增 `FIGMA_STARTER_MCP_RATE_LIMIT` |

Graphify/CodeGraph 结果只描述审计克隆的 exact SHA；CodeGraph 曾在受污染工作树中出现 `isolated/` 历史副本，这些副本仅作 historical background、不是当前图谱证据。当前收据只采信上述独立审计克隆、graph.json 的 commit 字段和源读回，不把图谱目录本身当作产品 readiness 证明。

### Figma external attempt (local date 2026-08-13)

After the Figma variables/styles `P1_PASS` capture, the external attempt first
retrieved Core Components metadata successfully (`get_metadata`, node `4:2`).
The mandatory `get_design_context` attempt then returned the exact Starter plan
limit message:

> You've reached the Figma MCP tool call limit on the Starter plan. Upgrade your plan for more tool calls: https://www.figma.com/files/team/1638371820161259734/all-projects?upgrade=mcp_rate_limit_paywall

This records `FIGMA_STARTER_MCP_RATE_LIMIT`; `FIGMA_STARTER_3_PAGE_LIMIT` remains
the physical-page limit. Per owner constraint, no paid upgrade and no repeated
retry were performed. Editable component variants, final screens, and Code
Connect are `BLOCKED_BY_PLAN_LIMIT`, not complete. Until the limit changes,
`design-tokens.json`, `code-connect-map.json`, and the PR1 code-first Design
System Lab remain the current mapping authority.

## PR1 code-first implementation receipt

The tracked `@simwar/ui` core components and `DesignSystemLab` are implemented in
the Product PR1 working tree at the exact branch. Durable source mappings are:

- `packages/ui/src/components/AppShell.tsx`
- `packages/ui/src/components/ContextBar.tsx`
- `packages/ui/src/components/AuthorityBadge.tsx`
- `packages/ui/src/components/AllowedActionButton.tsx`
- `packages/ui/src/components/ReceiptPanel.tsx`
- `packages/ui/src/components/KnownLimitBanner.tsx`
- `packages/ui/src/components/StatePanel.tsx`
- `packages/ui/src/DesignSystemLab.tsx`
- `packages/ui/lab/main.tsx`

`RoleNavigation` and `EvidenceDrawer` remain target-not-present. The package
exports the implemented components from `packages/ui/src/index.ts`. The local
commands are `npm run dev:lab -w @simwar/ui` (Vite at
`http://localhost:3004`) and `npm run build:lab -w @simwar/ui` (ignored output
`packages/ui/dist/lab`).

The lab evidence was produced from the tracked dev entry at the exact branch
with documentation/base provenance still bound to
`bb343faf0c38e4a4a6d8b7928d0a0f35ecf8ad37`; the original PR1 implementation
state was uncommitted at capture time. The post-W025 rebase and fresh lab
readback are recorded below; the frozen baseline evidence remains unchanged.
External evidence root:
`C:\Users\Marshall\.codex\visualizations\2026\08\12\019ff6ce-99bb-7100-b86c-f47b294d077a\fe-pr1-design-system-lab`.
Runtime JSON hash: `E5CD...3764F`.

| viewport | screenshot SHA | document height | automated readback                     |
| -------- | -------------- | --------------: | -------------------------------------- |
| 1440×900 | `664C...A933`  |            2993 | horizontalOverflow=false; focusables=8 |
| 1280×800 | `4DD2...E636`  |            2993 | horizontalOverflow=false; focusables=8 |
| 1024×768 | `9534...7002`  |            4598 | horizontalOverflow=false; focusables=8 |
| 390×844  | `6208...AE4D`  |            4808 | horizontalOverflow=false; focusables=8 |

Across all four lab captures: `duplicateIds=[]`, `missingAriaRefs=[]`,
landmarks `header=2/nav=1/main=1`, `authority=8`, `states=10`,
`receiptFields=7`, `disabledButtons=2`, `consoleErrors=[]`, and
`pageErrors=[]`. This is automated/product-lab evidence only; it is not WCAG
2.2 AA, human validation, production, or a claim that Figma Code Connect is
complete.

## 2. 当前前端形态

### 2.1 应用、入口和路由

| app        | package dev port | browser path         | React Router | 入口                                | 当前事实                                                                                     |
| ---------- | ---------------: | -------------------- | ------------ | ----------------------------------- | -------------------------------------------------------------------------------------------- |
| Admin      |             3003 | `/`                  | 无           | `apps/admin/src/main.tsx` → `App`   | 单一根页面内组合管理、导出、报告、CoursePackageVersion 和 D6 workbench                       |
| Teacher    |             3001 | `/`                  | 无           | `apps/teacher/src/main.tsx` → `App` | 单一根页面内组合教学 Journey、Validation、Evidence、Confirmation、报告、课程设计和治理工作台 |
| Student    |             3002 | `/`                  | 无           | `apps/student/src/main.tsx` → `App` | 单一根页面内组合驾驶舱、角色工作区、Advisor、学习报告和决策表单                              |
| Enterprise |   不存在独立 app | 无独立 browser route | 无           | 现有 Admin/Teacher 内部表面         | 不得伪造第二业务 Authority；只能在现有 BFF 合同中形成隔离 workspace 或显式 Known Limit       |

源码没有 React Router、路由守卫或多页面入口；所谓“路由”目前主要是 API/BFF path 和单页内的 workbench section。`page-inventory.csv` 将 browser root、UI section 和 BFF path 分开记录，避免把 API endpoint 误称为前端 route。

### 2.2 代码规模和大文件

| 指标                                      |           Admin |         Teacher |       Student | 合计/口径                                                      |
| ----------------------------------------- | --------------: | --------------: | ------------: | -------------------------------------------------------------- |
| `*.ts`/`*.tsx`/`*.css` source files       |              13 |              23 |             8 | 44 个；仅统计 `apps/*/src`，包含入口、client、workbench 与样式 |
| app source lines (`*.ts`/`*.tsx`/`*.css`) |           3,837 |           9,355 |         2,193 | 15,385 行，按 exact SHA 的 `apps/*/src` 统计                   |
| CSS files                                 |               1 |               1 |             1 | 各 app 一套独立 `styles.css`                                   |
| 最大文件                                  | `App.tsx` 1,190 | `App.tsx` 2,068 | `App.tsx` 669 | 3 个 App 都承担数据请求、状态和布局组合                        |
| 根入口                                    |      `main.tsx` |      `main.tsx` |    `main.tsx` | 无共享 AppShell                                                |

### 2.3 运行时基线（1440×900）

基线启动于审计克隆，使用临时端口 `3311/3312/3313`，API `3310`；这些端口不是源码 package 的 dev port。所有认证路径返回 HTTP 200，console/page error 为 0；以下是加载/认证后文档尺寸和焦点事实：

| app     | 初始 scroll      | 认证后 scroll | horizontal overflow | 认证后 vertical overflow | 认证后 focusable | 认证后 section surfaces |
| ------- | ---------------- | ------------- | ------------------- | ------------------------ | ---------------: | ----------------------: |
| Admin   | 1440×900；无溢出 | 1440×4541     | false               | true                     |               48 |                       8 |
| Teacher | 1440×1288        | 1440×5888     | false               | true                     |               79 |                      19 |
| Student | 1440×1242        | 1440×2539     | false               | true                     |               13 |                       8 |

认证后运行时可见的 section labels、字段和控件已在 `page-inventory.csv` 和 `visual-baseline/README.md` 列出。当前 product 页面依赖长纵向滚动；这一段 1440×900 数据是 current-product baseline。PR1 DesignSystemLab 的四视口横向安全性另见上面的 code-first lab receipt，不把 lab 结果冒充三端 product migration 结果。

## 3. API/BFF 事实

- Admin BFF client 当前调用 tenant summary、platform authority、run lifecycle controls、course reports、CoursePackageVersions、D5 exports 和 D6 transfer research。平台 scope 与 tenant scope 是服务端返回的不同投影。
- Teacher BFF client 当前调用 `teacher/runs/:runId/rounds/:roundNo/workspace`、Golden Journey、Validation Session、Teaching Closure、Evidence、Confirmation、Learning Design、Course Blueprint/Scenario readiness、Role Workflow、Instructor Intelligence、Debrief Advisor、Course Report、D5、D6 和 CoursePackageVersion。
- Student BFF client 当前调用 `student/runs/:runId/rounds/:roundNo/cockpit`、Golden Journey、Role Workflow、Role Advisor 和 Learning Report；决策表单字段由 BFF DTO 的 `editable_fields` 提供。
- `services/api/src/teacher-student-bff-dto.ts` 的 Student forbidden list 明确包含 `state_true`、`replay_hash`、`full_manifest`、`private_parameter_set`、`private_scenario_assumption`、`private_plugin_trace`、`other_team_data`、`other_tenant_data`、`teacher_private_evidence`、`admin_private_metadata` 等字段。
- Teacher BFF runtime path 记录了受控的 settle boundary；前端 UI 不得把 `POST /internal/v1/.../settle` 或等价 settle endpoint 作为独立主动作。当前 `apps/teacher/src/App.tsx` 的旧 `runNextStep` 结算调用是后续治理债务，不是 PR1 新 Authority。
- 所有 BFF DTO 的 `allowed_actions`、`audit_reference`、`source_runtime_path` 和 `redacted_fields` 是设计系统中 `AllowedActionButton`、`ReceiptPanel` 和 `AuthorityBadge` 的数据来源。

## 4. FE_UI_DEBT_BASELINE

以下数字是 exact SHA 的可复查静态/运行时快照；带“未测量”的项目明确表示本收据没有伪造结果。重复组件家族和状态覆盖细节见对应 CSV。

| 指标                                                  |                                                                         当前值 | 口径/证据                                                                                                                                                            |
| ----------------------------------------------------- | -----------------------------------------------------------------------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| browser route count                                   |                                                                              3 | Admin/Teacher/Student 各只有 `/`；无 React Router                                                                                                                    |
| root page count                                       |                                                                              3 | 三个 `main.tsx` 根入口                                                                                                                                               |
| authenticated section surfaces                        |                                                                             35 | 运行时 `section`：Admin 8、Teacher 19、Student 8；含 login/known limits                                                                                              |
| frontend source files                                 |                                                                             44 | `apps/*/src/**/*.{ts,tsx,css}`；Admin 13、Teacher 23、Student 8                                                                                                      |
| duplicate component families                          |                                                                              8 | Auth/login、Known Limits、CSS token layer、Course Report、D5 export、D6 transfer research、Golden Journey、BFF request/status patterns；见 `component-inventory.csv` |
| inline style declarations                             |                                                                              0 | 对 `apps/**/*.{tsx,ts,css}` 做 `style=`/`.style.` 静态计数                                                                                                           |
| hard-coded color references                           |                                                                            258 | exact-SHA scope `apps/*/src/**/*.{ts,tsx,css}`；精确 regex 与复现命令见根目录 README；包含 CSS/状态色，需用 token 语义替换后复测                                     |
| unit-like literals                                    |                                                                            682 | exact-SHA scope 同上；精确 regex 与复现命令见根目录 README；是 unit-like 上限，不等同于 spacing                                                                      |
| ASCII UI-string scan                                  |                                                          heuristic upper bound | plain JSX/quoted ASCII scan；只能用于定位潜在英文残留，不是语言覆盖率或可见文案计数；复现命令见根目录 README                                                         |
| largest component                                     |                                                  Teacher `App.tsx` 2,068 lines | 单文件同时承担请求、状态、工作台和布局                                                                                                                               |
| missing loading/empty/blocked/permission/error states |                                                                         未测量 | 基线只观察初始/认证和部分 empty/known-limit；不得推断完整覆盖率                                                                                                      |
| missing accessible labels                             |                                                                         未测量 | DOM/ARIA 快照已保存；需在 PR4 运行 Playwright/Axe 或等价门禁                                                                                                         |
| keyboard failures / contrast failures                 |                                                                         未测量 | 本轮只记录焦点顺序和低对比候选，不宣称 WCAG PASS                                                                                                                     |
| responsive overflow                                   | current product 1440 未发现横向溢出；PR1 lab 四视口均 horizontalOverflow=false | product 与 lab 证据分开记录；见下方 Known Limits                                                                                                                     |
| visual inconsistency                                  |                                                                         已观察 | 三 app 各自 CSS、长单页 workbench、英文残留和重复组件；像素差需后续 baseline/final diff                                                                              |

## 5. PR 与串行集成事实

- #372 的 `updatedAt=2026-08-12T16:42:29Z` OPEN/MERGEABLE/non-draft capture、head `64fac64bca2138abb33e2db731714ba9bc864254`、6 unresolved threads 与当时 SUCCESS checks 是 historical pre-W025 evidence only. Its old head `574ce707fcca77fec74f5dc3c3a9969f39b3de14` and browser-smoke failure are also historical and do not describe current live state.
- Fresh post-W025 readback confirms PR #372 (W025) merged at `2026-08-13T00:33:12Z`; final head `a24dad3f8d3aca905fafb0a42f05b2309e16e02f`; merge commit and protected `origin/master` are exactly `93883f47af9d1ee8892eeabf40f78240c186589a`; the merge changed 36 files. CI `quality` and `browser-smoke`, plus CodeQL `Analyze JavaScript and TypeScript` and `CodeQL`, all concluded SUCCESS. All 6 review threads are resolved.
- PR1 was locally rebased onto that protected master. The replayed implementation commit is `639b063ea8f6f535a9114fbd558c841191c776e7`; the remote PR #373 head `a43609dc0011c655bc1b6f7850ab68cf8027b1de` remains a historical/stale draft until Sol republishes it. No push or PR mutation occurred in this readback.
- Fresh post-rebase Lab evidence is stored outside the repository at `C:\Users\Marshall\.codex\visualizations\2026\08\12\019ff6ce-99bb-7100-b86c-f47b294d077a\fe-pr1-post-w025-rebase`; all four viewports reported no horizontal overflow, 44px action targets, expected authority/state/receipt examples, keyboard focus rings, no console/page errors, healthy static requests, and reduced-motion durations of `0.001s`. The evidence receipt hash is `AD7D29B1742F958392C7AD949EBEDD2F409036F9A61FF3D2F33A5CC2CB32871B`.
- PR #365 (W020 remediation) remains OPEN/CONFLICTING with exact head `0fd0cd2c85b5012512716c53b89951cc442db748`. Its Advisor/W020 ownership and UI/测试重叠至少包括 `apps/student/src/StudentRoleAdvisor.tsx`、`apps/teacher/src/TeacherDebriefAdvisor.tsx` 和 W020 E2E/服务端/OpenAPI。PR1 ownership includes the design freeze and `@simwar/ui` foundation; later Student/Teacher migration must respect that ownership and must not close or modify #365.
- PR1 scope 包含本目录审计/设计文档、已实现的 `@simwar/ui` foundation 与 code-first `DesignSystemLab` contract/implementation ownership；本次收据同步文档冻结与共享基础层实现事实，不把“docs-only”误写成 Product PR scope。current-product app migrations 仍由后续 PR2/PR3 负责；最终每个 Product PR 必须在 predecessor 合并后的 exact head 重新 rebase、运行门禁和浏览器验证。

## 6. Known Limits 与下一步证据

1. Figma 文件的 variables/styles 当前为 `P1_PASS`：已验证 6 个 collections、68 个 variables，WEB syntax/scope/alias PASS；当前有 3 个 physical pages / 12 个 logical sections。editable component variants、final screens 与 Code Connect 均为 `BLOCKED_BY_PLAN_LIMIT`。2026-08-13（本地日期）先成功读取 Core Components metadata（node `4:2`），随后 mandatory `get_design_context` 返回 Starter paywall；记录稳定限制码 `FIGMA_STARTER_MCP_RATE_LIMIT`，并保留物理页面限制码 `FIGMA_STARTER_3_PAGE_LIMIT`。按 owner constraint 不购买升级、不重复重试；`design-tokens.json`、`code-connect-map.json` 与 PR1 code-first Design System Lab 仍是当前 mapping authority，不宣称 Figma 组件或 Code Connect 已完成。
2. Enterprise 当前没有独立 app/BFF/route；任何 Enterprise UI 只能通过现有合同承载，不能为了视觉完整补造业务能力。
3. Current-product 三端视觉基线仍只有 `1440×900`；PR1 DesignSystemLab 已有 `1440×900`、`1280×800`、`1024×768`、`390×844` 自动化证据，但两者都未运行像素 diff、Axe、200% text zoom 或真实屏幕阅读器，也不构成 WCAG AA、Human Validation 或 production proof。
4. 运行时基线记录了 refresh/learning-report 请求被浏览器取消（`ERR_ABORTED`）的事件，但没有 HTTP error 或 page error；这不是功能通过证明。
5. 该收据不包含真实用户、生产数据、模型私有权重或生产部署；Human Validation、Pilot、Production 均未执行/未授权。
6. CodeGraph/Graphify 是 exact SHA 的辅助证据；Graphify manifest 未写 SHA，CodeGraph 仅由 version/timestamp/clean status 绑定；不存在把图谱目录当成代码 readiness 的结论。所有高风险真值/权限结论仍需源码、契约、测试和最终 rebase 后的浏览器验证。
