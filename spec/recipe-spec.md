# Recipe Spec (v0)

本规范定义了 `recipes/` 目录中的 recipe 结构与 `recipe.yaml` 字段，用于：

- 在本地用 Docker/Compose 一键启动上游自托管应用
- 在 CI 中自动验证“UI 可打开”
- 支持版本范围匹配与长期维护

> 约定：我们不分发上游项目本体，只分发“薄层 recipe”（启动/补齐/验证）。

## 目录结构

每个 recipe 位于：

`recipes/<owner>/<repo>/<recipeId>/`

其中 `<recipeId>` 建议包含目标版本范围与变体，例如：

- `default`
- `v2`
- `>=2.3,<3.0-default`

最小文件集：

- `recipe.yaml`（必需）
- `compose.yaml` 或 `docker-compose.yml`（二选一，必需）
- `README.md`（必需，1 页纸）

可选文件：

- `compose.override.yaml`（可选）
- `env.sample`（可选，推荐）
- `smoke/`（可选：UI 验证脚本/配置）
- `patches/`（可选：对上游的最小补丁，默认不使用）

## recipe.yaml（字段）

### 最小必需字段（v0）

- `apiVersion`: 固定为 `githubui.recipes/v0`
- `id`: recipeId（与目录名一致）
- `target`:
  - `owner`: GitHub owner
  - `repo`: GitHub repo
  - `ref`: 目标版本（tag/commit/semver range，v0 允许自由字符串；建议使用 semver range）
- `runtime`:
  - `type`: `compose`
  - `composeFile`: `compose.yaml` 或 `docker-compose.yml`
- `ui`:
  - `url`: UI 地址模板（默认 `http://localhost:<port>`）
  - `healthcheck`:
    - `method`: `GET`
    - `path`: `/`（或项目首页路径）
    - `expectStatus`: `200`
    - `match`: 可选，页面关键字（如 title/文本），用于更可靠的“UI 可打开”

### 推荐字段（v0）

- `ports`: 暴露端口信息，便于 Portal/CLI 展示
  - `name`: `ui`
  - `service`: 可选。Compose 中对应的 service 名称（用于端口重映射/排障）。若不提供，工具会回退到 compose 的第一个 service。
  - `containerPort`: number
  - `hostPort`: number
  - `protocol`: `http`
- `env`:
  - `required`: 必填环境变量键列表（尽量为空，A0 目标）
  - `optional`: 可选环境变量键列表
- `notes`:
  - `setup`: 初始化说明（如首次启动创建管理员账号）
  - `limitations`: 限制（如不支持生产配置）

## 兼容性与验证口径

### A0 目标（第一阶段优先）

- 无外部 API key / OAuth
- 5 分钟内完成 `docker compose up` 并可访问 UI
- CI 验证至少满足：
  - `GET ui.url + healthcheck.path` 返回 `expectStatus`
  - 若 `match` 配置存在，响应体必须包含 `match`

## 变更策略

当 recipe 因上游变更失效：

- 更新 `target.ref` 范围或新增新 recipeId
- 保留旧 recipe（如仍可用于旧版本），不要破坏历史可复现性
