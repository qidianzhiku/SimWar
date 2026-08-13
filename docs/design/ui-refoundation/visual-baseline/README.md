# FE_VISUAL_BASELINE

**基线状态**：current-product `CAPTURED_WITH_LIMITS` + PR1 lab `AUTOMATED_WITH_LIMITS`（均不是设计、WCAG 或生产通过证明）

**绑定源码 SHA**：`bb343faf0c38e4a4a6d8b7928d0a0f35ecf8ad37`

**捕获时间**：2026-08-12 16:41:54.714Z

**捕获工具/证据目录**：`C:\Users\Marshall\.codex\visualizations\2026\08\12\019ff6ce-99bb-7100-b86c-f47b294d077a\fe-current-baseline-luna`

**临时运行端口**：API `3310`；Admin `3311`；Teacher `3312`；Student `3313`

**视口**：`1440×900`

**本 PR 处理**：只登记外部证据索引，不复制 PNG 或其他二进制到产品工作树。

## 0. PR1 code-first DesignSystemLab evidence

The tracked `@simwar/ui` DesignSystemLab is served by
`npm run dev:lab -w @simwar/ui` at `http://localhost:3004`; its
production-like lab bundle is built with `npm run build:lab -w @simwar/ui`
to ignored `packages/ui/dist/lab`. This is a code-first implementation
receipt, not a Figma Code Connect completion claim.

**证据目录**：
`C:\Users\Marshall\.codex\visualizations\2026\08\12\019ff6ce-99bb-7100-b86c-f47b294d077a\fe-pr1-design-system-lab`

**runtime JSON hash**：`E5CD...3764F`

| viewport | full-page screenshot SHA | document height | automated readback                     |
| -------- | ------------------------ | --------------: | -------------------------------------- |
| 1440×900 | `664C...A933`            |            2993 | horizontalOverflow=false; focusables=8 |
| 1280×800 | `4DD2...E636`            |            2993 | horizontalOverflow=false; focusables=8 |
| 1024×768 | `9534...7002`            |            4598 | horizontalOverflow=false; focusables=8 |
| 390×844  | `6208...AE4D`            |            4808 | horizontalOverflow=false; focusables=8 |

All four captures report `duplicateIds=[]`, `missingAriaRefs=[]`,
landmarks `header=2/nav=1/main=1`, authority=8, states=10,
receiptFields=7, disabledButtons=2, `consoleErrors=[]`, and
`pageErrors=[]`. Visual readback confirmed post-fix navigation text
visibility with the authority token. These are automated/product-lab facts only:
not WCAG 2.2 AA, human validation, pilot, production, or Figma Code Connect
proof. No binary evidence is copied into the repository.

## 1. 截图清单（外部路径，不复制）

| 文件                                      | 角色/状态                    | 备注                                                             |
| ----------------------------------------- | ---------------------------- | ---------------------------------------------------------------- |
| `admin-entry-1440x900.png`                | Admin 未认证入口             | 登录表单、tenant/username/password、管理员登录                   |
| `admin-core-1440x900.png`                 | Admin 认证后主表面           | 1440 宽首屏；长页 workbench 的顶部                               |
| `admin-core-top-1440x900.png`             | Admin 认证后顶部             | 用于与 core 截图对照                                             |
| `admin-teacher-cross-role-1440x900.png`   | Admin/Teacher 权限边界观察   | 只读 cross-role 证据，不代表权限扩大                             |
| `admin-wrong-password-1440x900.png`       | Admin 错误态                 | 错误恢复和文案基线                                               |
| `teacher-entry-1440x900.png`              | Teacher 未认证入口           | login 与 M1 teaching package 首屏                                |
| `teacher-core-1440x900.png`               | Teacher 认证后主表面         | Golden Journey、Validation、D2/D3/D5/D6 等长页顶部               |
| `teacher-core-top-1440x900.png`           | Teacher 认证后顶部           | 用于首屏布局对照                                                 |
| `teacher-student-cross-role-1440x900.png` | Teacher/Student 权限边界观察 | 验证安全投影文案；不代表跨角色可见                               |
| `student-entry-1440x900.png`              | Student 未认证入口           | onboarding 与 login 首屏                                         |
| `student-core-1440x900.png`               | Student 认证后主表面         | Golden Journey、role workflow、advisor、D4 report、decision form |
| `student-core-top-1440x900.png`           | Student 认证后顶部           | 用于首屏布局对照                                                 |
| `student-wrong-password-1440x900.png`     | Student 错误态               | 错误恢复和 safe copy 基线                                        |

## 2. 机器收据清单（外部路径，不复制）

| 文件                                                                                | 内容                                                                                              |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `FE_VISUAL_BASELINE.runtime.json`                                                   | source SHA、三 app entry/authenticated DOM 摘要、尺寸、focus、overflow、console/page/request 事件 |
| `admin-runtime.json` / `teacher-runtime.json` / `student-runtime.json`              | 各 app 的运行时状态与证据明细                                                                     |
| `admin-entry-dom.html` / `admin-core-dom.html`                                      | Admin 初始/认证 DOM                                                                               |
| `teacher-entry-dom.html` / `teacher-core-dom.html`                                  | Teacher 初始/认证 DOM                                                                             |
| `student-entry-dom.html` / `student-core-dom.html`                                  | Student 初始/认证 DOM                                                                             |
| `admin-entry-aria.txt` / `admin-core-aria.txt`                                      | Admin 可访问性快照                                                                                |
| `teacher-entry-aria.txt` / `teacher-core-aria.txt`                                  | Teacher 可访问性快照                                                                              |
| `student-entry-aria.txt` / `student-core-aria.txt`                                  | Student 可访问性快照                                                                              |
| `network-har-summary.json`                                                          | 关键网络请求摘要                                                                                  |
| `negative-auth-permission.json`                                                     | 登录/权限 negative evidence                                                                       |
| `simwar-playwright-store.json` / `live-simwar-playwright-store.json`                | 本地自动化运行快照；不得提交                                                                      |
| `admin.stdout.log` / `teacher.stdout.log` / `student.stdout.log` / `api.stdout.log` | 运行日志；stderr 为空                                                                             |
| `live-*` logs / `live-service-pids.json`                                            | live runtime 辅助证据；不得提交                                                                   |

## 3. 观察结果

| app     | 初始                                                 | 认证后                                                                             | 观察到的限制                                                                                          |
| ------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Admin   | HTTP 200；1440×900；4 focusable；无横向/纵向溢出     | HTTP 200；1440×4541；48 focusable；vertical overflow；24 surfaces（8 个 section）  | 长单页；英文 `Refresh/Preview/Freeze/Export` 残留；D5/D6/package/report 混在同一根页面                |
| Teacher | HTTP 200；1440×1288；4 focusable；vertical overflow  | HTTP 200；1440×5888；79 focusable；vertical overflow；66 surfaces（19 个 section） | 工作台数量多；D3 STALE、D6 synthetic-only、W023 Human Validation 未执行；长页与旧 next-step flow 共存 |
| Student | HTTP 200；1440×1242；10 focusable；vertical overflow | HTTP 200；1440×2539；13 focusable；vertical overflow；15 surfaces（8 个 section）  | safe projection 正常显示；private evidence 隐藏；Advisor/D4 等状态仍以单页 section 展示               |

三 app 认证基线 `consoleCount=0`、`pageErrorCount=0`、`httpErrorCount=0`。运行收据记录了 refresh/golden journey 或 learning-report 请求被浏览器取消（`net::ERR_ABORTED`）的事件，属于本次捕获流程的请求生命周期事实，不得改写成“所有请求通过”。

## 4. Current-product limits versus lab limits

The current-product Admin/Teacher/Student baseline above remains 1440×900 only.
The four viewport results in section 0 belong to the PR1 DesignSystemLab and must
not be generalized to migrated product workbenches.

## 5. 尚未测量的基线

- 未捕获 `1280×800`、`1024×768`、`390×844`，因此不能宣称响应式或无横向溢出。
- 未运行像素 diff、Axe、200% text zoom 或真实屏幕阅读器；ARIA 文本快照不是 WCAG 2.2 AA 通过证明。
- 未覆盖每个 workbench 的全部 `Loading/Empty/Partial/Ready/Blocked/Stale/Conflict/Unknown/Permission Denied/Error` 和 command `Submitting/Committed/Reused/Conflict/Failed`；详见 `route-state-matrix.csv` 的 evidence level。
- 未做人工视觉批准、Human Validation、Pilot 或 Production；目标文档明确这些不是本 Wave 的可伪造终态。

## 6. 使用规则

1. 后续 PR 只能以新的 exact source SHA 生成 candidate screenshots，并把本目录（或新的 `visual-final/`）作为 diff 的基线索引。
2. 预期的 token/IA 变化要在设计合同、component mapping 和 route-state matrix 中先有记录，再更新截图；不得只替换一张 hero screenshot。
3. PNG、HTML、HAR、store snapshot、运行日志均保留在外部 evidence root；产品仓库仅提交可审计的 Markdown/CSV/JSON 索引，避免把真实运行快照和生成二进制带入 PR。
