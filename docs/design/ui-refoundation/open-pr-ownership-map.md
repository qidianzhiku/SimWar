# FE_OPEN_PR_OWNERSHIP_MAP

**审计绑定 SHA**：`bb343faf0c38e4a4a6d8b7928d0a0f35ecf8ad37`

**规则**：Product Outcome WIP = 1；PR 串行合并；不把 UI Wave 塞入已有 PR；所有后续 PR 在 predecessor 合并后的 exact head rebase 并重跑门禁。

**Post-W025 integration readback (2026-08-13)**：#372 已于
`2026-08-13T00:33:12Z` 合并；final head 为
`a24dad3f8d3aca905fafb0a42f05b2309e16e02f`，merge commit/protected
`origin/master` 为 `93883f47af9d1ee8892eeabf40f78240c186589a`。其 36 个文件
变更的 CI `quality`/`browser-smoke` 与 CodeQL `Analyze JavaScript and
TypeScript`/`CodeQL` 均 SUCCESS，6 个 review threads 均已 resolved。PR1
已在本地重放到该 protected master（implementation commit
`639b063ea8f6f535a9114fbd558c841191c776e7`）；远端 PR #373 的
`a43609dc0011c655bc1b6f7850ab68cf8027b1de` 仍是 historical/stale draft，
直到 Sol 重新发布前不作为当前 head。

## 1. 当前开放 PR

| PR   | 工作流           | base → head                                                                                                                                                                           | 当前状态/检查                                                                                                                                 | 变更文件边界                                                                                                                                                                                                          | 本 Wave 处理                                                                                                                                                                                             |
| ---- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #372 | W025             | historical base `bb343faf0c38e4a4a6d8b7928d0a0f35ecf8ad37` → final head `a24dad3f8d3aca905fafb0a42f05b2309e16e02f`；merge/protected master `93883f47af9d1ee8892eeabf40f78240c186589a` | merged `2026-08-13T00:33:12Z`；36 files；CI quality/browser-smoke/Analyze JavaScript and TypeScript/CodeQL SUCCESS；6 resolved review threads | 未修改 `apps/*`；主要是 package/shared-contracts/OpenAPI/API/services/tests；以已合并 changed-file manifest 为准                                                                                                      | 不修改、不评论无关事实、不关闭；保留旧 head `64fac64bca2138abb33e2db731714ba9bc864254` 与旧 browser-smoke failure 为 historical capture；PR1 已在本地 rebase 到 protected master 并重跑本地/浏览器验证。 |
| #365 | W020 remediation | `base=675f…` → `head=0fd0…`（connector capture 仅提供前缀）                                                                                                                           | OPEN、CONFLICTING；与前端/测试/服务端/OpenAPI 有重叠；不是本 Wave 的 predecessor                                                              | 不修改、不关闭、不抢占 ownership。至少冲突/重叠文件：`apps/student/src/StudentRoleAdvisor.tsx`、`apps/teacher/src/TeacherDebriefAdvisor.tsx`、W020 E2E 与对应 backend/OpenAPI。PR3/4 只能在确认其状态后处理这些文件。 |

Open PR 的 checks、review thread、mergeability 会漂移；上表已区分 #372 的
historical preflight 与 post-W025 merge readback。旧 browser-smoke failure 仅作
historical context，不得解释成当前 live failure，也不得在 UI PR 中修复与其
ownership 无关的测试竞态。#365 仍为 OPEN/CONFLICTING，exact head
`0fd0cd2c85b5012512716c53b89951cc442db748`，其 Advisor/W020 ownership 保持受保护。

## 2. 本 Wave Product PR ownership

| Product PR                                   | 负责人范围                                                                                                           | 明确允许                                                                               | 明确禁止                                                                                          | 前置/后置                                                                                                                                                                                                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR1 `codex/fe-wave-001-foundation`           | Design tokens、`@simwar/ui`、AppShell/Context/Authority/AllowedAction/Receipt/Evidence/State contracts、设计审计收据 | 冻结原则、tokens、CSV 矩阵、code-connect map、视觉基线索引；以严格 TDD 建立共享基础层  | 修改 `apps/*`、services/contracts、#372/#365；复制截图二进制；改变真值/权限                       | 历史审计起点为 exact `bb343faf0c38e4a4a6d8b7928d0a0f35ecf8ad37`；post-W025 本地 rebase 基于 protected `93883f47af9d1ee8892eeabf40f78240c186589a`，implementation replay `639b063ea8f6f535a9114fbd558c841191c776e7`；必须通过 docs/JSON/CSV 结构检查和共享层门禁 |
| PR2 Admin + Teacher migration                | Admin Delivery & Trust、Teacher Course OS 的共享 shell 消费和页面迁移                                                | 重构布局、文案、状态、响应式、可访问性；仅消费已有 BFF/allowed_actions                 | 新增 Authority、写 settlement/truth、修改 #365 advisor ownership、扩大 Student projection         | 只能在 PR1 合并后起新 exact head；若 #372 先合并，从最新 protected master 起步                                                                                                                                                                                  |
| PR3 Student + Enterprise logical workspace   | Student Executive Environment；Enterprise 仅在当前 Admin/Teacher 合同内的隔离 workspace                              | Student safe cockpit/role workflow/report 体验迁移；Enterprise closed/known-limit 状态 | 放宽 Student forbidden fields、创建独立 Enterprise business authority、修改 #365 未解决 ownership | 只能在 PR2 合并后起步；#365 overlap 必须先核对                                                                                                                                                                                                                  |
| PR4 Integration / Responsive / A11y / Visual | 全端状态覆盖、WCAG 2.2 AA 自动证据、1440/1280/1024/390、visual regression、性能/清理                                 | 统一最终 token、修复布局/键盘/文案/视觉回归、补测试与报告                              | 改 settlement/replay/权限；以人工验证代替自动证据                                                 | PR2/PR3 合并后；在最终 rebase SHA 上重跑所有 browser/contract/build 门禁                                                                                                                                                                                        |

## 3. Governance Closure ownership

只创建 **一个** docs-only Governance Closure PR，且在所有 Product PR 串行合并、fresh-clone browser acceptance 和 exact-head required checks 结束后创建。它只记录：最终 master SHA、Product PR 列表、Design System/Figma 或 code-first 状态、页面/状态覆盖率、简体中文、WCAG、visual regression、role journeys、Authority/Visibility、Known Limits、资源锁、`automatic_next_start=false`。这里的 docs-only 仅指最终 Governance Closure；PR1 的 Product scope 包含本目录文档与 `@simwar/ui` foundation。

不得在每个 Product PR 后做 Governance Reclosure；不得把“人类审阅/生产发布”写成已完成，因为目标文档明确禁止 production deployment、pilot claim 和 human validation claim。

## 4. 资源与文件锁

- 受保护的 `D:\codex\SimWar` 保持只读；本表绑定的 audit clone、Graphify 外部 index、产品 worktree 分离。
- PR1 shared design-system writer = 1；heavy browser validation = 1。其它 agent 只能在不重叠目录或独立 worktree 工作，不回滚他人改动。
- #372/#365 的远端分支、review thread 和 CI artifacts 不复制到产品工作树；只记录事实与链接/引用。
