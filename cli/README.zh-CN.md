# trystack-cli（本地开发）

[English](README.md) | 中文

从本仓库 `recipes/` 或 GitHub registry 中解析对应项目的 recipe，并输出本地启动命令（可选直接执行）。

> 默认优先本地 `../recipes`，缺失时回退到 registry（可用 `--prefer-registry` 强制优先远端）。

## Package 说明

- 根目录包：`trystack`（`npx trystack ...`，面向用户）
- 本目录包：`trystack-cli`（本地开发/调试）

## Usage

```bash
cd cli
npm i

# 或本地安装后直接使用 bin：
# npx trystack-cli up louislam/uptime-kuma

# 默认（up）：启动 docker compose 并自动打开 UI
node entry.js up louislam/uptime-kuma

# Back-compat（仍可用）：不写子命令等价于 up
node entry.js louislam/uptime-kuma

# 仅打印启动命令（不执行）
node entry.js print louislam/uptime-kuma
node entry.js louislam/uptime-kuma --no-run

# 查看可用 recipes / 指定 recipe
node entry.js list louislam/uptime-kuma
node entry.js louislam/uptime-kuma --list
node entry.js louislam/uptime-kuma --recipe default
node entry.js list louislam/uptime-kuma --json

# 排障/管理（与 up 使用同一个 compose projectName）
node entry.js ps louislam/uptime-kuma
node entry.js logs louislam/uptime-kuma --tail 200
node entry.js stop louislam/uptime-kuma
node entry.js down louislam/uptime-kuma

# 自检（环境 + 当前 project 状态/端口/校验）
node entry.js doctor louislam/uptime-kuma
node entry.js doctor louislam/uptime-kuma --json

# 校验本仓库全部本地 recipes（给 CI 用；不依赖 docker）
node entry.js verify-recipes --json
```

## list --json 输出

```json
{
  "repo": "owner/repo",
  "source": "local|github",
  "localPath": "D:\\path\\to\\recipes\\owner\\repo",
  "registry": "owner/recipes-repo@main",
  "recipeIds": ["default", "v2"]
}
```

## doctor 输出字段

- 基本信息：`Repo` / `Recipe` / `Recipe dir` / `Project` / `Source` / `Cache dir`
- 环境：`node` / `platform` / `docker` / `docker compose`
- 配方：`recipe.yaml` / `compose file` / `override` / `recipe validation`
- 检查项：`ui.healthcheck` / `ports` / `env.required` / `env.optional`
- 运行态：`docker compose config` 结果、`docker compose ps`、可用时的 `Precheck`
  - `--json` 额外包含 `envMissing` / `composeConfig` / `ps` / `precheck`

## doctor --json 输出

字段清单：

- `repo` / `recipeId` / `recipeDir` / `projectName` / `source` / `cacheDir`
- `registry` / `preferRegistry` / `uiUrl`
- `environment.node` / `environment.platform` / `environment.docker` / `environment.compose`
- `recipe.recipeYaml` / `recipe.composeFile` / `recipe.override` / `recipe.validationErrors`
- `checks.healthcheck` / `checks.portsCount` / `checks.envRequired` / `checks.envOptional` / `checks.envMissing`
- `composeConfig` / `ps` / `precheck`

## 退出码

- `0` ok
- `1` usage / invalid input
- `2` recipe not found / resolve failed
- `3` UI not ready
- `4` port conflict (no free port)
- `5` registry/network error
- `6` recipe invalid
- `7` required env missing
- `127` docker or compose missing

## Registry 相关

```bash
# 指定 registry 仓库与 ref
node entry.js up louislam/uptime-kuma --registry owner/recipes-repo --registry-ref main

# 强制优先从 registry 拉取（用于验证远端 recipes）
node entry.js up louislam/uptime-kuma --prefer-registry

# 指定本地缓存目录
node entry.js up louislam/uptime-kuma --cache-dir "D:\cache\trystack"
```
