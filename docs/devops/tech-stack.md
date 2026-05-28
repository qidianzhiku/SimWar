# SimWar MVP 技术栈决策

本文件冻结 Phase 0 的默认技术栈，作为后续 Codex 任务、CI 和本地启动命令的基线。若未来替换工具，必须在同一个变更中更新 `README.md`、`AGENTS.md`、`DEVELOPMENT_PLAN.md` 和 CI 配置。

## 默认决策

| 层级             | 默认技术                                 | Phase 0 落地方式                | 说明                                                        |
| ---------------- | ---------------------------------------- | ------------------------------- | ----------------------------------------------------------- |
| Monorepo         | npm workspaces                           | 根目录 `package.json`           | 与现有文档中的 npm 默认入口保持一致                         |
| 前端             | Vite + React + TypeScript                | `apps/teacher`, `apps/student`  | 先提供教师端/学员端空壳，后续接入业务 API                   |
| API 服务         | Node.js 24 + TypeScript                  | `services/api`                  | Phase 0 使用原生 HTTP 暴露健康检查，减少早期依赖            |
| 共享契约         | TypeScript 类型与常量                    | `packages/shared-contracts`     | 存放前后端共享类型、Agent 契约与真值保护字段                |
| 仿真内核         | Python 3.11 目标栈                       | `services/simulation-core` 占位 | 当前机器未提供 Python；后续初始化时必须保持真值唯一写入边界 |
| 测试             | Vitest                                   | `tests/unit`                    | Phase 0 覆盖健康检查和真值边界常量                          |
| Lint / Typecheck | ESLint 9 + TypeScript project references | 根目录统一命令                  | CI 和本地运行同一组命令                                     |
| 本地依赖         | Docker Compose                           | PostgreSQL 16 + Redis 7         | 仅启动外部依赖，不在 Phase 0 强行容器化应用                 |
| CI               | GitHub Actions                           | `.github/workflows/ci.yml`      | 运行 install、lint、typecheck、test、contract check、build  |

## 统一命令

```powershell
npm install
npm run dev:api
npm run dev:teacher
npm run dev:student
npm run lint
npm run typecheck
npm test
npm run test:contract
npm run build
```

可选 Make 入口：

```powershell
make setup
make lint
make test
make typecheck
make build
```

## 端口

| 服务       | 端口 | 命令                            |
| ---------- | ---: | ------------------------------- |
| API        | 3000 | `npm run dev:api`               |
| 教师端     | 3001 | `npm run dev:teacher`           |
| 学员端     | 3002 | `npm run dev:student`           |
| PostgreSQL | 5432 | `docker compose up -d postgres` |
| Redis      | 6379 | `docker compose up -d redis`    |

## 当前限制

- Python 未在当前本机环境中可用，因此 `services/simulation-core` 只建立边界占位。
- AI、Replay、插件运行时不在 Phase 0 初始化真实服务，只保留目录与契约边界。
- Phase 0 的 API 只暴露健康检查，不实现 Auth、Course、Team、Round 或 Decision。
