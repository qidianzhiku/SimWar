# SimWar 运行与构建环境

## 文档定位

本文档用于作为 SimWar 仓库中的标准化运行、构建、部署与运维基线，建议文件名为 `docs/devops/env-setup.md` 或 `BUILD.md`。文档面向教师端、学员端、管理后台、核心仿真引擎、Python 计量求解服务、Replay / Shadow Replay、行业插件与 AI 小模型协同体系，目标是在同一份文档中统一开发环境、依赖安装、环境变量、启动方式、生产部署、数据与消息链路、日志监控以及测试验收口径。SimWar 的总体架构已在参考文档中收敛为“行业无关 kernel + 行业插件”的微内核模式，并明确采用 L1-L5 分层、核心真值唯一写入、AI 小模型只读建议、Replay / Shadow Replay 强门禁与多租户治理边界。fileciteturn0file11 fileciteturn0file12 fileciteturn0file13 fileciteturn0file14

> 重要说明：当前仓库仍处于“设计文档先行、源码工程待落地”的状态，不应假定 Node.js、Python、Docker、CI 配置或实际脚本已经完整存在。本文将服务命名、目录、端口、脚本名、部署形态与运维约定收敛为后续实现的标准基线；一旦真实代码落地与本文示例不同，应优先修改仓库脚本与配置，并同步更新本文，而不是长期保留“文档与实现分叉”的状态。fileciteturn0file10 fileciteturn0file11

## 环境要求

SimWar 参考文档已经较一致地收敛到以下组合：前端与业务服务优先采用 React / Next.js / TypeScript，计量与求解部分采用 Python + PyBLP，主事务库使用 PostgreSQL，缓存使用 Redis，事件流采用 Kafka 或等价事件总线，分析层可外接 ClickHouse / 湖仓，对象与快照包进入 S3 兼容对象存储，并通过 Docker / Kubernetes、OpenAPI-first、xAPI/LRS、审计日志与可观测性体系完成工程化落地。fileciteturn0file11 fileciteturn0file12 fileciteturn0file14

| 类别                           |                是否必需 | 推荐版本                             | 说明                                        |
| ------------------------------ | ----------------------: | ------------------------------------ | ------------------------------------------- |
| Git                            |                      是 | 当前稳定版                           | 用于拉取仓库、版本管理、CI/CD 触发          |
| Node.js                        |                      是 | **24 LTS**，兼容 **22 LTS**          | 教师端、学员端、BFF、网关与 TypeScript 服务 |
| npm                            |                      是 | **11+**                              | 随 Node.js LTS 一起安装                     |
| Python                         |                      是 | **3.11.x**                           | Python 服务统一基线，适合服务化部署         |
| Python 兼容镜像                |                    建议 | **3.9.x**                            | 仅用于 PyBLP 兼容模式或离线校准兜底镜像     |
| pip                            |                      是 | 当前稳定版                           | Python 包安装                               |
| venv                           |                      是 | Python 标准库内置                    | 用于隔离 Python 依赖                        |
| Docker Desktop / Docker Engine |                      是 | Desktop **4.73+** 或 Engine **29.x** | 本地容器化开发与生产镜像构建                |
| Docker Compose                 |                      是 | **Compose v2**                       | 推荐使用 `docker compose` 子命令            |
| Kubernetes                     |                生产必需 | **1.35+**，优先 **1.36**             | 生产集群编排、HPA、Ingress、灰度与回滚      |
| PostgreSQL                     |                      是 | **16.x**，兼容 **17.x**              | 主事务库、审计与状态快照元数据              |
| Redis                          |                      是 | **7.4.x**，评估 **8.x**              | 缓存、会话、排行榜、幂等键                  |
| Kafka                          |          可选但生产推荐 | **4.1.x / 4.2.x**                    | 事件账本、异步处理、Replay 消费链路         |
| RabbitMQ                       |                    可选 | **4.2.x / 4.3.x**                    | 仅当团队明确选择 AMQP 路线时启用            |
| ClickHouse                     |                    可选 | 当前稳定版                           | 学习诊断、运营分析、仪表盘聚合              |
| S3 兼容对象存储                |                    建议 | MinIO 本地版 / 云对象存储            | 快照包、报告包、审计导出、授权内容包        |
| OpenTelemetry Collector        |                    建议 | 当前稳定版                           | traces / metrics / logs 统一采集            |
| Prometheus                     |                    建议 | 当前稳定版                           | 指标抓取与告警                              |
| Grafana                        |                    建议 | 当前稳定版                           | 仪表盘与运维视图                            |
| Terraform / Ansible            |                    可选 | 当前稳定版                           | 云资源与环境编排                            |
| Java                           | 仅 Kafka 原生安装时必需 | **17+**                              | 使用 Kafka 官方二进制/脚本时需要            |

版本基线的选择依据如下：Node.js 当前推荐使用活跃 LTS 分支，Node 24 为最新 LTS，而 Node 20 已结束官方生命周期；Docker Compose 当前推荐作为 Docker CLI 插件使用，即 `docker compose`，独立 `docker-compose` 仅用于向后兼容；Kubernetes 当前维护最近三个小版本分支；PostgreSQL 官方当前支持 14–18 并对每个主版本提供约 5 年支持；Redis 官方当前开放的稳定线包括 7.4 与 8.x；Kafka 官方当前下载页面包含 4.2.0、4.1.2 与 3.9.2，且原生环境需要 Java 17+；RabbitMQ 当前仍有 4.2 与 4.3 受支持发布线。citeturn1search0turn1search1turn1search5turn4search8turn5search4turn7search8turn11view0turn12view0turn12view1turn13view0turn13view1turn10view0turn14search1

对于 Python，需要特别说明：项目文档建议平台统一使用 Python 3.11+，但 PyBLP 官方文档当前仍写明其测试覆盖到 Python 3.6–3.9。为降低数值依赖与 wheel 兼容风险，推荐把“在线 Python 服务运行时”与“离线校准 / Shadow Replay 兼容镜像”拆开：前者使用 Python 3.11，后者保留 Python 3.9 兼容镜像作为回退策略；CI 中必须对两套镜像都执行 solver golden tests 与 replay tests。这个安排既符合项目文档对 Python 3.11+ 的基线要求，也更贴近 PyBLP 当前公开兼容说明。fileciteturn0file11 fileciteturn0file12 fileciteturn0file14 citeturn2search1turn2search2turn3search0turn3search1turn15search0turn15search4

## 项目初始化与依赖安装

标准仓库应采用 monorepo 形态，至少包含 `apps/`、`services/`、`contracts/`、`plugins/`、`tests/`、`docs/` 等顶层目录；服务侧应至少区分 Teacher / Student Web、API Gateway / BFF、Simulation Core、Replay Service、Market Solver Python Service、Coach Orchestrator 与行业插件目录。以下步骤以文档中反复出现的服务名与目录为基线。fileciteturn0file10 fileciteturn0file11 fileciteturn0file14

### 仓库克隆

```bash
git clone <repository-url> simwar
cd simwar
```

### Node.js 依赖安装

根目录作为 npm workspace 时，优先在仓库根目录安装全部前端与 TypeScript 服务依赖；CI 场景推荐使用 `npm ci`，本地开发使用 `npm install`。当前项目文档里 `npm install`、`npm test`、`npm run build` 已被作为默认入口命名。fileciteturn0file10 fileciteturn0file11

```bash
npm install
```

如果仓库按服务拆分，也可以分目录安装：

```bash
cd apps/teacher-web && npm install && cd ../..
cd apps/student-web && npm install && cd ../..
cd services/api-gateway && npm install && cd ../..
cd services/teacher-bff && npm install && cd ../..
cd services/student-bff && npm install && cd ../..
```

### Python 依赖安装

Python 计量与求解服务建议使用独立虚拟环境；`venv` 是 Python 标准工具，`requirements.txt` 是 pip 的标准依赖文件形式。citeturn15search0turn15search1turn15search4

```bash
cd services/market-solver-py
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
cd ../..
```

Windows PowerShell:

```powershell
cd services/market-solver-py
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
cd ../..
```

### 数据库初始化

SimWar 的参考文档把 PostgreSQL 定义为主事务存储，把 Redis 定义为缓存、会话、权限裁剪缓存与幂等键存储，并将状态快照 / 结果包 / 报告包放入 PostgreSQL + 对象存储组合中。下面的初始化命令适用于本地开发环境。fileciteturn0file11 fileciteturn0file13 fileciteturn0file14

```bash
docker compose up -d postgres redis
```

```bash
psql -h localhost -U postgres <<'SQL'
CREATE ROLE simwar_app WITH LOGIN PASSWORD 'CHANGE_ME_IN_LOCAL_DEV';
CREATE DATABASE simwar OWNER simwar_app;
GRANT ALL PRIVILEGES ON DATABASE simwar TO simwar_app;
SQL
```

```bash
psql -h localhost -U simwar_app -d simwar <<'SQL'
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
SQL
```

### 迁移与种子数据

由于当前项目仍未冻结最终 ORM / migration 方案，建议把以下脚本名作为仓库标准约定固定下来。这样即使未来使用 Prisma、Knex、Drizzle、Alembic 或 Django，也可以保持环境文档与 CI 入口不变。当前推荐优先采用 TypeScript 业务服务脚本作为统一入口；如果后续后台实际落地为 Django，则将同名命令映射到 `manage.py` 即可。这个约定符合 AGENTS 中“若新增依赖清单、测试或部署配置，必须同步更新命令”的要求。fileciteturn0file10 fileciteturn0file11

```bash
# 推荐的仓库标准命令
npm run db:migrate
npm run db:seed
```

如果你的后台最终采用 Django，则迁移命令可直接替换为：

```bash
python manage.py migrate
python manage.py loaddata seed_data.json
```

如果你的 Python 服务采用 Alembic，则使用：

```bash
alembic upgrade head
```

## 环境变量配置

项目文档已经给出一组核心环境变量：数据库、Redis、JWT、LRS、内部服务 URL、LLM provider、默认场景包、默认参数集以及授权内容路径。结合 docs/architecture/system-architecture.md、API 与 README 中的服务拆分，建议使用以下 `.env.example` 作为统一基线。fileciteturn0file11 fileciteturn0file13 fileciteturn0file14

### `.env.example`

```env
APP_NAME=simwar
APP_ENV=development
DEBUG=false
PORT=3000
APP_PORT=3000
LOG_LEVEL=info

TENANT_MODE=single
DEFAULT_TENANT_ID=tenant_demo
JWT_SECRET=<JWT_SECRET>
SESSION_SECRET=<SESSION_SECRET>
INTERNAL_SERVICE_TOKEN=<INTERNAL_SERVICE_TOKEN>

DATABASE_URL=postgresql://simwar_app:<DB_PASSWORD>@localhost:5432/simwar
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=simwar
POSTGRES_USER=simwar_app
POSTGRES_PASSWORD=<DB_PASSWORD>

REDIS_URL=redis://localhost:6379/0
REDIS_PASSWORD=<REDIS_PASSWORD>

KAFKA_ENABLED=false
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=simwar-local
KAFKA_TOPIC_EVENTS=simwar.events
KAFKA_TOPIC_AUDIT=simwar.audit
KAFKA_TOPIC_REPLAY=simwar.replay

CLICKHOUSE_ENABLED=false
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=<CLICKHOUSE_PASSWORD>
CLICKHOUSE_DATABASE=simwar_analytics

OBJECT_STORAGE_ENDPOINT=http://localhost:9000
OBJECT_STORAGE_ACCESS_KEY=<MINIO_ACCESS_KEY>
OBJECT_STORAGE_SECRET_KEY=<MINIO_SECRET_KEY>
OBJECT_STORAGE_BUCKET=simwar-artifacts
AUDIT_EXPORT_BUCKET=simwar-audit

LRS_ENDPOINT=http://localhost:8081/xAPI/
LRS_KEY=<LRS_KEY>
LRS_SECRET=<LRS_SECRET>

API_GATEWAY_URL=http://localhost:3000
TEACHER_BFF_URL=http://localhost:3010
STUDENT_BFF_URL=http://localhost:3020
MARKET_SOLVER_URL=http://localhost:8100
REPLAY_SERVICE_URL=http://localhost:8200
COACH_ORCHESTRATOR_URL=http://localhost:8300

OPENAI_API_KEY=<OPENAI_API_KEY>
OPENAI_BASE_URL=<OPENAI_BASE_URL>
OPENAI_MODEL=<OPENAI_MODEL>
MODEL_GUARDRAIL_MODE=enforced

OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_SERVICE_NAME=simwar-api-gateway
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001

DEFAULT_SCENARIO_PACKAGE_ID=scenario_demo_001
DEFAULT_PARAMETER_SET_ID=param_demo_v1
LICENSED_CONTENT_ZONE_PATH=/data/licensed-content

FEATURE_ENABLE_COMMUNITY=true
FEATURE_ENABLE_COMPETITION=true
FEATURE_ENABLE_LRS=true
FEATURE_ENABLE_SHADOW_REPLAY=true
```

### 环境变量用途说明

| 变量                                                                                                                              | 用途                                                      |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `APP_NAME` / `APP_ENV` / `DEBUG` / `PORT` / `APP_PORT` / `LOG_LEVEL`                                                              | 应用名称、运行环境、调试开关、监听端口与日志级别          |
| `TENANT_MODE` / `DEFAULT_TENANT_ID`                                                                                               | 多租户模式与本地默认租户                                  |
| `JWT_SECRET` / `SESSION_SECRET` / `INTERNAL_SERVICE_TOKEN`                                                                        | 鉴权签名、会话签名、内部服务可信调用令牌                  |
| `DATABASE_URL` / `POSTGRES_*`                                                                                                     | PostgreSQL 连接串与结构化连接参数                         |
| `REDIS_URL` / `REDIS_PASSWORD`                                                                                                    | Redis 连接信息，用于缓存、会话、排行榜、幂等              |
| `KAFKA_ENABLED` / `KAFKA_BROKERS` / `KAFKA_CLIENT_ID` / `KAFKA_TOPIC_*`                                                           | Kafka 是否启用、Broker 地址、客户端名和事件主题           |
| `CLICKHOUSE_*`                                                                                                                    | 分析库连接参数，用于学习诊断与运营分析                    |
| `OBJECT_STORAGE_*` / `AUDIT_EXPORT_BUCKET`                                                                                        | S3/MinIO 对象存储连接与桶名，用于快照包、结果包、审计导出 |
| `LRS_ENDPOINT` / `LRS_KEY` / `LRS_SECRET`                                                                                         | xAPI / LRS 学习账本 endpoint 与访问密钥                   |
| `API_GATEWAY_URL` / `TEACHER_BFF_URL` / `STUDENT_BFF_URL` / `MARKET_SOLVER_URL` / `REPLAY_SERVICE_URL` / `COACH_ORCHESTRATOR_URL` | 各服务的本地或集群内访问地址                              |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` / `MODEL_GUARDRAIL_MODE`                                                    | AI provider 凭据、兼容网关地址、模型名与护栏模式          |
| `OTEL_EXPORTER_OTLP_ENDPOINT` / `OTEL_SERVICE_NAME`                                                                               | OpenTelemetry 导出地址与服务名标签                        |
| `PROMETHEUS_PORT` / `GRAFANA_PORT`                                                                                                | 本地监控面板端口                                          |
| `DEFAULT_SCENARIO_PACKAGE_ID` / `DEFAULT_PARAMETER_SET_ID`                                                                        | 默认场景包与默认参数集                                    |
| `LICENSED_CONTENT_ZONE_PATH`                                                                                                      | 授权内容存放路径；仅授权范围内可用于检索、评测或训练增强  |
| `FEATURE_ENABLE_*`                                                                                                                | 功能开关：社区、竞赛、LRS、Shadow Replay 等               |

生产环境下，所有密钥、Token、数据库口令、对象存储密钥与 LLM API Key 都必须进入 Secret Manager、KMS、Vault 或 Kubernetes Secret；不得把真实秘密值提交到 Git，也不要把 `.env` 当成可长期维护的配置真值来源。系统架构文档明确要求多租户隔离、授权内容边界、模型调用留痕与 Secret 托管。fileciteturn0file13 fileciteturn0file14

## 本地开发启动

SimWar 文档中的默认开发形态是“本地 Docker 开发 + 服务分离调试”。最小闭环必须至少跑通：创建课程、创建 run、开轮、提交决策、锁轮、结算、发布结果、复盘。fileciteturn0file11 fileciteturn0file12

### 基础依赖服务启动

本地最低配建议先拉起 PostgreSQL 与 Redis；如果你要验证事件总线、审计异步消费、Replay 队列或分析链路，再额外启用 Kafka、对象存储与 ClickHouse。

```bash
docker compose up -d postgres redis
```

启用可选依赖：

```bash
docker compose up -d postgres redis kafka minio clickhouse
```

如果你的环境仍使用 Compose 独立二进制，也可以执行：

```bash
docker-compose up -d postgres redis kafka minio clickhouse
```

Docker 官方当前推荐使用 Compose v2，即 `docker compose`；`docker-compose` 属于兼容模式。citeturn4search8turn5search4turn5search6

### 业务服务与前端启动

根据 README 中的命名，推荐按下面方式分别启动网关 / BFF / Python 求解服务；如果仓库把前端拆为多应用，还需要分别启动教师端、学员端、社区与竞赛前端。fileciteturn0file11

```bash
# 终端 1：根目录启动 TypeScript 业务服务 / 网关
npm run dev
```

```bash
# 终端 2：启动 Python 计量求解服务
cd services/market-solver-py
source .venv/bin/activate
python -m uvicorn simwar_solver.api.app:app --reload --host 0.0.0.0 --port 8100
```

```bash
# 终端 3~6：独立前端应用
npm run dev:teacher-web
npm run dev:student-web
npm run dev:community-web
npm run dev:competition-web
```

### 一键式本地联调

当仓库已提供 `compose.yaml` 或 `docker-compose.yml` 后，优先使用一键联调：

```bash
docker compose up --build
```

### 默认端口与访问入口

| 服务                         |        默认端口 | 说明                         |
| ---------------------------- | --------------: | ---------------------------- |
| API Gateway / Public Web     |          `3000` | 本地统一入口                 |
| Teacher BFF                  |          `3010` | 教师端服务                   |
| Student BFF                  |          `3020` | 学员端服务                   |
| Market Solver Python Service |          `8100` | L1 市场求解、离线校准、诊断  |
| Replay Service               |          `8200` | Replay / Shadow Replay       |
| Coach Orchestrator           |          `8300` | AI 教练、解释与复盘编排      |
| PostgreSQL                   |          `5432` | 主事务库                     |
| Redis                        |          `6379` | 缓存、会话、排行榜、幂等     |
| Kafka                        |          `9092` | 事件总线，可选               |
| MinIO / S3 兼容对象存储      |          `9000` | 快照包、审计导出、授权内容包 |
| Prometheus                   |          `9090` | 指标采集                     |
| Grafana                      |          `3001` | 监控仪表盘                   |
| OTLP gRPC / HTTP             | `4317` / `4318` | OpenTelemetry 采集           |

默认访问路径建议如下，前端若采用统一网关反向代理，应全部从 `http://localhost:3000` 进入：教师端 `/teacher`，学员端 `/student`，企业后台 `/admin`，社区 `/community`，竞赛前台 `/competition`。这些路径与项目 README 中的访问约定一致。fileciteturn0file11

## 生产构建与部署

SimWar 的目标生产形态不是“单进程大应用”，而是“Docker 镜像构建 + Kubernetes 编排 + GitOps / CI 门禁 + 参数与模型治理”。系统架构文档明确把 Kubernetes、HPA、OpenTelemetry、审计、Replay 门禁和多环境隔离写成了部署与运维基线。fileciteturn0file14

### Docker 构建与部署

CI 中建议使用 `npm ci` 代替 `npm install`；镜像标签统一使用 Git SHA、语义版本号和环境名。生产发布前，必须完成 contract / replay / shadow replay / security gates。fileciteturn0file10 fileciteturn0file14

```bash
# TypeScript 网关/业务服务
docker build -t registry.example.com/simwar/api-gateway:<git-sha> services/api-gateway
docker build -t registry.example.com/simwar/teacher-bff:<git-sha> services/teacher-bff
docker build -t registry.example.com/simwar/student-bff:<git-sha> services/student-bff

# Python 求解与治理服务
docker build -t registry.example.com/simwar/market-solver:<git-sha> services/market-solver-py
docker build -t registry.example.com/simwar/replay-service:<git-sha> services/replay-service
docker build -t registry.example.com/simwar/coach-orchestrator:<git-sha> services/coach-orchestrator

# 推送镜像
docker push registry.example.com/simwar/api-gateway:<git-sha>
docker push registry.example.com/simwar/teacher-bff:<git-sha>
docker push registry.example.com/simwar/student-bff:<git-sha>
docker push registry.example.com/simwar/market-solver:<git-sha>
docker push registry.example.com/simwar/replay-service:<git-sha>
docker push registry.example.com/simwar/coach-orchestrator:<git-sha>
```

Docker 官方文档当前把 Compose 明确为 Docker CLI 的组成部分，同时 Docker Desktop 会内置 Docker Engine、Docker CLI 和 Compose；因此本地与 CI 的命令体系应尽量统一到 `docker build` 与 `docker compose`。citeturn4search12turn4search20turn4search22

### Kubernetes 部署示例

下面给出一份可直接作为基线的 Kubernetes 样例，包含 `Namespace`、`Secret`、`ConfigMap`、`Deployment`、`Service` 与 `HorizontalPodAutoscaler`。该样例以 `api-gateway` 为例；`market-solver`、`replay-service`、`teacher-bff`、`student-bff`、`coach-orchestrator` 可按同样模式复制。HPA 对 SimWar 很重要，因为项目明确要求根据负载自动扩缩容并保持课堂期的峰值稳定性。fileciteturn0file14 citeturn7search1turn7search8

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: simwar-prod
---
apiVersion: v1
kind: Secret
metadata:
  name: simwar-secrets
  namespace: simwar-prod
type: Opaque
stringData:
  JWT_SECRET: "<JWT_SECRET>"
  SESSION_SECRET: "<SESSION_SECRET>"
  DATABASE_URL: "postgresql://simwar_app:<DB_PASSWORD>@postgres-rw:5432/simwar"
  REDIS_URL: "redis://redis-master:6379/0"
  OPENAI_API_KEY: "<OPENAI_API_KEY>"
  INTERNAL_SERVICE_TOKEN: "<INTERNAL_SERVICE_TOKEN>"
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: simwar-config
  namespace: simwar-prod
data:
  APP_ENV: "production"
  PORT: "3000"
  LOG_LEVEL: "info"
  API_GATEWAY_URL: "https://api.example.com"
  MARKET_SOLVER_URL: "http://market-solver:8100"
  REPLAY_SERVICE_URL: "http://replay-service:8200"
  COACH_ORCHESTRATOR_URL: "http://coach-orchestrator:8300"
  OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel-collector:4317"
  DEFAULT_SCENARIO_PACKAGE_ID: "scenario_default_prod"
  DEFAULT_PARAMETER_SET_ID: "param_prod_v1"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: simwar-prod
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
        - name: api-gateway
          image: registry.example.com/simwar/api-gateway:<git-sha>
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 3000
          envFrom:
            - configMapRef:
                name: simwar-config
            - secretRef:
                name: simwar-secrets
          resources:
            requests:
              cpu: "250m"
              memory: "512Mi"
            limits:
              cpu: "1000m"
              memory: "1024Mi"
          readinessProbe:
            httpGet:
              path: /healthz
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /healthz
              port: 3000
            initialDelaySeconds: 20
            periodSeconds: 15
---
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
  namespace: simwar-prod
spec:
  selector:
    app: api-gateway
  ports:
    - name: http
      port: 80
      targetPort: 3000
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway
  namespace: simwar-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

部署命令：

```bash
kubectl apply -f deploy/namespace.yaml
kubectl apply -f deploy/configmap.yaml
kubectl apply -f deploy/secret.yaml
kubectl apply -f deploy/api-gateway.yaml
kubectl apply -f deploy/market-solver.yaml
kubectl apply -f deploy/replay-service.yaml
kubectl apply -f deploy/teacher-bff.yaml
kubectl apply -f deploy/student-bff.yaml
kubectl apply -f deploy/coach-orchestrator.yaml
```

### 云平台部署建议

EKS、GKE、AKS 都是官方托管 Kubernetes 服务，适合承载 SimWar 这类多服务、含状态依赖、需要自动扩缩、参数治理、可观测性与多环境隔离的平台；这与项目文档中“云上 Kubernetes 生产 + GitOps + 多环境隔离”的目标完全一致。fileciteturn0file14 citeturn9search0turn9search1turn9search2

对于 Render 与 Railway，官方文档都支持 Dockerfile 或容器化部署，因此它们很适合作为 Preview 环境、Demo 环境、教师沙盒、低状态 BFF、文档站点或轻量演示服务的落脚点；但从 SimWar 的架构要求看，正式生产不建议把 PostgreSQL、Kafka、对象存储、Replay / Shadow Replay 治理链路和 LRS 长期留在“单平台托管容器 + 本地磁盘”的简化模式里，更稳妥的做法是外接托管数据库、托管缓存、外部对象存储与独立审计链路。这是结合平台官方部署能力与 SimWar 自身治理要求所做的工程判断。fileciteturn0file14 citeturn9search3turn9search4turn9search13turn9search14

### 灰度发布与回滚策略

SimWar 的发布门禁不能只看 HTTP 健康检查，必须把课程正确性、公平性、Replay 一致性和 AI 边界一起纳入。推荐采用下面的顺序：

1. 合并前通过 `lint / unit / contract / security`。
2. 测试环境通过 `integration / e2e / multi-tenant / plugin compatibility`。
3. 预发布环境通过 `solver golden / replay / shadow replay / performance`。
4. 生产先做 `canary 5% → 20% → 100%` 或蓝绿发布。
5. 发布期间重点观察 `settlement_duration_ms`、`replay_hash_match_rate`、`shadow_diff_count`、错误率与 AI 越权拒绝率。
6. 回滚优先级为：**镜像回滚 > 配置回滚 > 参数回滚 > 数据迁移回滚**。
7. 任何 `ParameterSet`、模型版本或评分逻辑的变更，都必须通过 Shadow Replay；正式运行中途的教学变化只能通过 `ShockEvent` 注入，不得直接改库。fileciteturn0file12 fileciteturn0file13 fileciteturn0file14

## 数据存储、队列与可观测性

SimWar 的数据层不是单一数据库，而是“主事务库 + 缓存层 + 事件流 + 分析层 + 对象存储 + 学习账本”的组合：PostgreSQL 保存租户、课程、Run、Round、Decision、Replay、Audit 等核心实体；Redis 负责会话、排行榜、幂等与热点缓存；Kafka 或等价事件总线负责事件账本与异步消费；ClickHouse / 湖仓负责运营分析与学习诊断；对象存储保存快照包、报告包与授权内容；LRS 负责学习事件沉淀。fileciteturn0file11 fileciteturn0file13 fileciteturn0file14

### 数据库与队列配置

PostgreSQL 推荐把本地开发默认版本定在 16.x，因为它仍在官方支持窗口内，支持到 2028 年，而 17、18 也处于支持状态；Redis 官方当前同时提供 7.4 与 8.x 稳定线路，本地开发建议以 7.4 起步；Kafka 官方当前发布中包含 4.2.0 与 4.1.2，本地 Docker 启动即可；如果团队坚持 AMQP，也可以使用处于支持期的 RabbitMQ 4.2 / 4.3。citeturn11view0turn12view0turn12view1turn13view0turn13view1turn10view0turn14search1

创建 Kafka topic 的示例：

```bash
docker exec -it kafka \
  kafka-topics --create \
  --if-not-exists \
  --topic simwar.events \
  --bootstrap-server localhost:9092 \
  --replication-factor 1 \
  --partitions 3
```

```bash
docker exec -it kafka \
  kafka-topics --create \
  --if-not-exists \
  --topic simwar.audit \
  --bootstrap-server localhost:9092 \
  --replication-factor 1 \
  --partitions 3
```

```bash
docker exec -it kafka \
  kafka-topics --create \
  --if-not-exists \
  --topic simwar.replay \
  --bootstrap-server localhost:9092 \
  --replication-factor 1 \
  --partitions 3
```

推荐的最小 topic 集合如下：

| Topic             | 用途                                 |
| ----------------- | ------------------------------------ |
| `simwar.events`   | 决策、锁轮、结算、发布结果等业务事件 |
| `simwar.audit`    | 审计与合规事件                       |
| `simwar.replay`   | Replay / Shadow Replay 消费链路      |
| `simwar.learning` | xAPI/LRS 同步或聚合消费              |

Redis 在 SimWar 中只应承担“缓存、会话、排行榜、幂等、权限裁剪缓存”等非真值职责，不应成为正式成绩、`state_true` 或 `SettlementResult` 的唯一存储位置。这个边界来自系统架构对真值层和缓存层的明确分工。fileciteturn0file14

### 日志与审计

生产环境建议统一使用 **stdout / stderr + OTel Collector + 集中日志系统**，不要依赖本机散落文件。若为本地裸机调试，可同时把服务日志写到 `./var/log/simwar/<service>.log`，但生产环境建议完全交由容器日志与采集器接管。fileciteturn0file14 citeturn8search0turn8search1turn8search3

推荐的 JSON 日志格式如下：

```json
{
  "ts": "2026-05-13T14:30:00Z",
  "level": "INFO",
  "service": "api-gateway",
  "trace_id": "trace_123",
  "request_id": "req_123",
  "tenant_id": "tenant_demo",
  "actor_id": "usr_001",
  "action": "ROUND_SETTLED",
  "resource": "Run/run_demo_001",
  "message": "round settled successfully"
}
```

审计日志至少应包括：参数集审批、模型部署、决策提交、锁轮、正式结算、Shock 注入、Replay、Shadow Replay、AI 工具调用、导出、权限变更与跨租户拒绝事件。API 文档已为审计查询提供 `/api/v1/audit/logs`、实体时间线与导出接口，因此应用层与运维层都要确保关键写操作进入审计链。fileciteturn0file13 fileciteturn0file14

### 指标与监控

OpenTelemetry 官方把 OTel 定义为 vendor-neutral 的可观测性框架，用于生成、采集和导出 traces、metrics 与 logs；Collector 则负责统一接收、处理并导出遥测数据。SimWar 的系统架构文档也明确把 OTel Collector + Prometheus + 集中日志 + 仪表盘作为统一方案。fileciteturn0file14 citeturn8search0turn8search1turn8search5turn8search12turn7search2turn7search6turn7search11

Prometheus 最小抓取配置示例：

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: simwar-api
    static_configs:
      - targets: ["api-gateway:3000"]

  - job_name: simwar-market-solver
    static_configs:
      - targets: ["market-solver:8100"]

  - job_name: simwar-replay
    static_configs:
      - targets: ["replay-service:8200"]

  - job_name: simwar-coach
    static_configs:
      - targets: ["coach-orchestrator:8300"]
```

建议把以下指标作为平台级 SLO 与告警基线：

| 指标                                                             | 说明                     |
| ---------------------------------------------------------------- | ------------------------ |
| `http_server_requests_total` / `http_server_request_duration_ms` | API 可用性、延迟与错误率 |
| `settlement_duration_ms`                                         | 单回合结算耗时           |
| `publish_delay_ms`                                               | 结算完成到结果发布延迟   |
| `replay_hash_match_rate`                                         | 正式 Replay 一致性       |
| `shadow_diff_count`                                              | Shadow Replay 差异数量   |
| `ai_advisory_latency_ms`                                         | AI 建议响应时延          |
| `ai_guardrail_denied_total`                                      | AI 越权拒绝次数          |
| `lrs_write_total` / `lrs_write_latency_ms`                       | 学习账本写入量与时延     |
| `db_pool_in_use` / `redis_ops_total` / `kafka_consumer_lag`      | 资源与依赖服务健康度     |

项目文档已给出一些可验收门槛：核心教学链路月可用性目标不低于 99.9%，常规读取接口 p95 不高于 300ms，决策提交 p95 不高于 800ms，教师工作台聚合页面 p95 不高于 2s，正式结算单回合端到端发布时延 p95 不高于 30s，Shadow Replay 单 Run 目标不高于 10 分钟，AI advisory p95 不高于 6s。fileciteturn0file14

## 测试、验证与运维注意事项

SimWar 的测试范围必须超出普通 CRUD 与页面渲染，至少要包括 contract test、integration、E2E、solver golden、replay、shadow replay、性能、多租户隔离、AI 边界与合规测试。Requirements 与 docs/architecture/system-architecture.md 都把这些项目列为硬性验收内容。fileciteturn0file11 fileciteturn0file12 fileciteturn0file14

### 标准测试命令

```bash
# TypeScript / Node.js
npm test
npm run test:contract
npm run test:e2e
npm run test:replay
npm run test:performance
```

```bash
# Python solver
pytest services/market-solver-py/tests -q
```

如果仓库后续提供 Makefile，统一入口建议固定为：

```bash
make test
make build
```

### 本地 Replay 验证流程

以下流程用于验证“提交决策 → 结算 → 获取快照 → 影子重放”的最小闭环。接口路径和关键 Header 直接来自项目 README 与 API 设计文档中的约定。fileciteturn0file11 fileciteturn0file13

提交决策：

```bash
curl -X POST http://localhost:3000/api/v1/runs/run_demo_001/decisions \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "X-Tenant-Id: tenant_demo" \
  -H "Idempotency-Key: decision-run_demo_001-r1-team_alpha" \
  -H "Content-Type: application/json" \
  -d @examples/decision.team_alpha.r1.json
```

触发正式结算：

```bash
curl -X POST http://localhost:3000/internal/v1/runs/run_demo_001/rounds/round_001/settle \
  -H "Authorization: Bearer <INTERNAL_SERVICE_TOKEN>" \
  -H "X-Tenant-Id: tenant_demo" \
  -H "Idempotency-Key: settle-run_demo_001-r1" \
  -H "Content-Type: application/json" \
  -d '{"parameter_set_id":"param_demo_v1","random_seed":42}'
```

读取状态快照：

```bash
curl http://localhost:3000/api/v1/runs/run_demo_001/rounds/1/state-snapshot \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "X-Tenant-Id: tenant_demo"
```

执行 Shadow Replay：

```bash
curl -X POST http://localhost:3000/api/v1/replays/shadow \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "X-Tenant-Id: tenant_demo" \
  -H "Content-Type: application/json" \
  -d '{"run_id":"run_demo_001","candidate_parameter_set_id":"param_candidate_v2"}'
```

通过标准应满足两点：正式 Replay 的 `replay_hash` 必须一致；Shadow Replay 必须输出可解释的 `diff_report`，且不得回写历史正式成绩。fileciteturn0file12 fileciteturn0file13 fileciteturn0file14

### AI 小模型边界验证说明

AI 小模型边界是本项目最重要的非功能约束之一。教师端、学员端与 AI 只能读取 `state_obs`、`state_est` 或经授权裁剪后的结果；AI 只能输出 `CoachOutput`、建议卡、风险卡、复盘草稿、推荐列表等 advisory 数据，不能直接写入 `state_true`、正式 `SettlementResult`、`Score`、`Rank` 或 `ParameterSet`。fileciteturn0file13 fileciteturn0file14

最低边界验证要求如下：

1. 向任何 AI / agent 接口提交包含 `market_share`、`cash_flow`、`profit`、`rank`、`parameter_set_id` 等真值字段的写入请求，必须返回 `403` 或 `422`。
2. 触发 AI 建议后，数据库与事件流中只能新增 advisory 类型记录，不能出现对正式成绩或真值快照的直接覆盖。
3. 学员端默认不能获取完整 `state_true`，也不能看到完整 ParameterSet、完整微观矩或内部诊断维度。
4. 任何 AI 模型升级都必须先跑 Shadow Replay 与教师沙盒验证，之后才允许灰度到正式环境。fileciteturn0file12 fileciteturn0file13 fileciteturn0file14

### 运行与配置注意事项

| 项目                | 强制要求                                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 密钥管理            | 所有密钥、Token、API Key 必须使用占位符；生产环境必须放入 Secret Manager / Vault / KMS / Kubernetes Secret                             |
| 调试模式            | 生产环境严禁启用 `DEBUG=true`；日志级别默认 `info` 或更高，调试日志仅允许短时排障窗口内开启                                            |
| 参数治理            | 正式运行前必须绑定已审批的 `ParameterSet`；运行过程中不得直接改参数，教学变化只能通过 `ShockEvent` 进入                                |
| 真值保护            | 任何用户、教师或 AI 都不得直接写正式成绩、市场份额、利润、现金流、排名与 `state_true`                                                  |
| 多租户隔离          | 所有请求都必须受 `X-Tenant-Id`、RBAC、字段可见性与导出权限共同约束；跨租户读写一律拒绝                                                 |
| 授权内容边界        | 授权内容只能进入 `LICENSED_CONTENT_ZONE_PATH` 指向的受控区域；公开社区与公开竞赛不得默认外显受限原文与品牌背书内容                     |
| 配置版本管理        | 仓库必须保留 `.env.example`；环境差异通过 `.env.development`、`.env.staging`、`.env.production` 或 Secret 管理；不要把真实 `.env` 入库 |
| CI 门禁             | 合并前至少通过 lint、unit、contract、security；预发布必须通过 replay、shadow replay、performance                                       |
| 备份恢复            | PostgreSQL、对象存储、审计导出与参数注册表都必须进入备份策略；目标基线为 RPO ≤ 15 分钟、RTO ≤ 60 分钟                                  |
| Python / PyBLP 兼容 | Python 3.11 作为平台统一基线；PyBLP 校准任务保留 Python 3.9 兼容镜像作为保底回退                                                       |
| 依赖升级            | Node、Docker、Kubernetes、PostgreSQL、Redis、Kafka、RabbitMQ 的大版本升级必须先走 staging 与 replay 验证，不允许生产直接跨版本替换     |

以上注意事项分别对应 AGENTS 的“真值保护与契约测试”、API 的“幂等与审计”、Requirements 的“多租户与 AI 边界”、docs/architecture/system-architecture.md 的“ParameterSet 冻结、Replay 门禁、可观测性与部署治理”等要求。fileciteturn0file10 fileciteturn0file12 fileciteturn0file13 fileciteturn0file14
