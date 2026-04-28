# DocFlow — 企业文档管理平台

基于 **Nuxt 3 + Nitro + Prisma + MySQL + Redis + MinIO** 的全栈文档管理系统。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 Composition API + Element Plus + Pinia |
| 后端 | Nitro (H3) + Prisma + Zod |
| 数据库 | MySQL 8.0 |
| 缓存 | Redis 7 |
| 对象存储 | MinIO (S3 兼容) |
| 认证 | JWT 双令牌 (accessToken + refreshToken) |
| 权限 | RBAC (角色 → 权限映射) |

## 环境准备

- **Node.js** ≥ 18
- **Docker Desktop**（用于启动 MySQL、Redis、MinIO）

## 快速启动

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，至少确认以下配置：

| 变量 | 说明 | 默认值 |
|---|---|---|
| `DATABASE_URL` | MySQL 连接串 | `mysql://root:docflow_pwd@127.0.0.1:3306/docflow` |
| `REDIS_URL` | Redis 连接串 | `redis://127.0.0.1:6379` |
| `JWT_SECRET` | JWT 签名密钥（≥32 字符随机字符串） | 需自行设置 |
| `STORAGE_ENDPOINT` | MinIO S3 API 地址 | `http://localhost:9100` |
| `STORAGE_ACCESS_KEY` | MinIO 访问密钥 | `minioadmin` |
| `STORAGE_SECRET_KEY` | MinIO 私有密钥 | `minioadmin` |
| `STORAGE_BUCKET` | 存储桶名称 | `docflow-files` |
| `FORMAT_CONVERTER_ENDPOINT` | office2md 转换服务地址（可选） | 空 |
| `FORMAT_CONVERTER_TOKEN` | office2md 鉴权 token（可选） | 空 |

### 3. 启动基础服务（Docker）

```bash
# 启动 MySQL + Redis + MinIO
docker compose up -d db redis minio
```

等待容器健康检查通过（约 10-15 秒）：

```bash
docker ps   # 确认三个容器 STATUS 均为 healthy
```

### 4. 初始化数据库

首次搭建时，按顺序执行 SQL：

```bash
# 1. 表结构
mysql -h 127.0.0.1 -u root -pdocflow_pwd docflow < docs/doc.sql

# 2. RBAC 权限 + 角色
mysql -h 127.0.0.1 -u root -pdocflow_pwd docflow < docs/rbac.sql

# 3. 种子数据（演示账号等）
mysql -h 127.0.0.1 -u root -pdocflow_pwd docflow < docs/doc_seed.sql
```

### 5. 创建 MinIO 存储桶

首次启动后需手动创建存储桶。打开 MinIO Web 控制台：

- 地址：http://localhost:9101
- 账号：`minioadmin` / `minioadmin`

登录后在 **Buckets** 页面点击 **Create Bucket**，名称填 `docflow-files`。

或使用 MinIO Client 命令行：

```bash
# 如果已安装 mc (MinIO Client)
mc alias set local http://localhost:9100 minioadmin minioadmin
mc mb local/docflow-files
```

### 6. 生成 Prisma Client

```bash
npm run prisma:generate
```

### 7. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3001 即可使用。

## 常用命令

```bash
npm run dev                    # 启动开发服务器
npm run build                  # 生产构建
npm run lint                   # ESLint 检查
npm run lint:fix               # ESLint 自动修复
npm test                       # 运行所有测试
npm run test:unit              # 仅单元测试
npm run test:coverage          # 覆盖率报告
npm run prisma:generate        # 重新生成 Prisma Client
```

## Docker 服务说明

`docker-compose.yml` 包含以下服务：

| 服务 | 端口映射 | 说明 |
|---|---|---|
| `db` | 3306:3306 | MySQL 8.0 |
| `redis` | 6379:6379 | Redis 7 |
| `minio` | 9100:9000 (S3 API), 9101:9001 (Web 控制台) | 对象存储 |
| `app` | 3000:3000 | 生产部署用，开发时不需要 |

> MinIO 端口使用 9100/9101 而非默认 9000/9001，避免和 phpStudy / Xdebug 等工具冲突。

## 文件格式转换（可选）

配置 `FORMAT_CONVERTER_ENDPOINT` 和 `FORMAT_CONVERTER_TOKEN` 后，上传文件支持 `.docx`、`.xlsx`、`.pdf` 格式，系统会自动调用外部服务将其转换为 Markdown 存储。未配置时仅支持 `.md` 上传。

## 数据库变更

数据库补丁以 SQL 文件交付，存放在 `docs/patch-NNN-<topic>.sql`。不使用 Prisma migration。详见 [CLAUDE.md](CLAUDE.md) 中的数据库变更约定。
