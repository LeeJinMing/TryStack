# Verified Policy (v1)

目标：把 **verified** 当成“发行版”，实现 **digest pin + 自动合并 + 自动降级**，从而把维护成本压到最低。

> 本策略要求所有规则都能 **静态检测**（不依赖 docker/网络），并且可在晋升 PR 里提供“证据块”用于审计。

## 0. 触发方式（CI 自动化）

Promotion PR（community → verified）必须在 PR 描述中包含证据块，并保留以下标记行（便于 CI 可靠识别并启用严格校验）：

- `<!-- promotion:verified -->`
- `<!-- policy:verified-v1 -->`

## 1. 无风险自动合并（Risk-free change set）

满足以下条件的晋升 PR 才允许 **自动合并**；否则进入人工仲裁队列：

- **变更范围白名单**：仅允许修改 `recipes/**` 下的以下文件：
  - `recipe.yaml`
  - `compose.yaml` / `docker-compose.yml`
  - `README.md`
- **禁止修改**：`cli/**`、`portal/**`、`spec/**`、`.github/**`、任何脚本/可执行文件。

## 2. Compose：镜像必须 digest pin（强制）

- **必须**：所有 service 的 `image:` 必须包含 `@sha256:<digest>`（支持 `repo:tag@sha256:digest`，但推荐只保留 digest 并在旁边注释来源 tag）。
- **禁止**：仅使用 `:latest` 或仅 `:tag` 进入 verified（这类只能留在 community 流）。

推荐可读性写法：

```yaml
image: ghcr.io/org/app@sha256:... # from ghcr.io/org/app:v1.2.3
```

## 3. Compose：静态安全黑名单（强制）

verified 流中，命中以下任意项视为高风险，必须拒绝（或转人工）：

- `privileged: true`
- `network_mode: host`
- `pid: host`
- `cap_add: ...`（任何非空都不允许；需要能力提升的一律转人工）
- `security_opt` 包含 `unconfined`（如 `seccomp:unconfined` / `apparmor:unconfined`）

### 3.1 Host bind mount（强制）

禁止挂载宿主敏感路径（包括但不限于）：

- `/var/run/docker.sock` / `/run/docker.sock`
- `/etc`
- `/proc`
- `/sys`
- `/root`
- `/`（整个根）

同时，为了可审计与可复现性，verified 流 **不允许任何绝对宿主路径 bind mount**（例如 `/data:/app/data`、`C:\data:/data`）。

> 允许使用 **named volume**（例如 `data:/var/lib/app`）。

## 4. Healthcheck 稳定性（强制）

为避免 “`/` 重定向/登录页/安装向导” 导致 flaky：

- 若 `ui.healthcheck.path` 为 `/`，则 **必须** 配置 `ui.healthcheck.match`（关键字匹配）。

## 5. 数据门槛（晋升条件，非静态）

晋升到 verified 前需满足最小样本量与通过率（由自动化统计产生并写入晋升 PR 证据块）：

- `samples7d >= 5`
- `passRate7d >= 0.8`
- `lastSuccessAt <= 48h`

> 该部分不属于静态检查，但属于“自动合并 gating”的必备证据。

## 6. 自动降级/回滚（强制）

verified 中若出现持续失败（例如连续 3 次或 48h 内失败率超阈值）：

- 自动 PR：从 verified 降级回 community 或标记为 `disabled`
- 自动 issue：记录失败归因与复现信息

## 7. 审计：晋升 PR 证据块（强制）

晋升 PR 必须附带证据块，模板见：

- `docs/policies/promotion-evidence-template.md`
