# TryStack

[English](README.md) | 中文

最新版本：`v0.0.2`（`https://github.com/LeeJinMing/TryStack/releases/tag/v0.0.2`）

**TryStack** 为开源项目提供一个 **“一键本地试用（try locally）”入口**。
通过经过验证的 **recipe**（Docker Compose），让任何人都能在几分钟内把应用跑起来并打开 UI。

## 快速开始（3 行）

```bash
npx --yes -p github:LeeJinMing/TryStack#v0.0.2 trystack up louislam/uptime-kuma
# 或：trystack up filebrowser/filebrowser
npx --yes -p github:LeeJinMing/TryStack#v0.0.2 trystack ps louislam/uptime-kuma
```

## 前置条件

- 如果要把应用**真正跑起来并打开 UI**，需要 **Docker + Docker Compose**。
  - Windows/macOS：通常安装 **Docker Desktop**
  - Linux：通常安装 Docker Engine（含 docker/compose）
- 如果你只是浏览 recipes，或做静态检查（如 `trystack verify-policy`、`trystack verify-recipes`），不需要 Docker。

## 宣传视频

观看：`https://github.com/LeeJinMing/TryStack/releases/download/v0.0.2/TryStack__Run_Apps_in_Minutes.mp4`

## Portal（在线入口）

在 GitHub Pages 开启后（Settings → Pages → Source: GitHub Actions），Portal 地址为：

`https://leejinming.github.io/TryStack/`

## Windows 一键入口（可选）

Portal 可以通过自定义 `trystack://` 协议提供 **一键按钮**（仅 Windows）。

```bash
# 安装 URL 协议处理器（当前用户）
npx --yes -p github:LeeJinMing/TryStack#v0.0.2 trystack protocol install
```

卸载：

```bash
npx --yes -p github:LeeJinMing/TryStack#v0.0.2 trystack protocol uninstall
```

说明：

- 协议处理器在执行前会 **要求确认**，避免误触直接执行。
- 如果 Portal 显示旧界面，请强制刷新（Ctrl+F5）或用无痕窗口打开。

## Registry（可选）

```bash
# 优先使用远端 registry recipes（用于验证）
trystack up louislam/uptime-kuma --prefer-registry

# 指定自定义 registry 仓库与 ref
trystack up louislam/uptime-kuma --registry owner/recipes-repo --registry-ref main
```

## CLI 小贴士

```bash
# 给脚本用的 JSON 输出
trystack list louislam/uptime-kuma --json

# 校验本仓库全部本地 recipes（给 CI 用；不依赖 docker）
trystack verify-recipes --json

# doctor 包含 compose config 校验与 UI 预检查
trystack doctor louislam/uptime-kuma
trystack doctor louislam/uptime-kuma --json
```

`list --json` 输出字段：`repo` / `source` / `localPath` / `registry` / `recipeIds`。

退出码：`0` ok，`1` usage，`2` not found，`3` UI timeout，`4` port in use，`5` registry error，`6` recipe invalid，`7` required env missing，`127` docker/compose missing。

## 你能得到什么

- **评估者**：几分钟完成“能不能跑起来”的验证
- **维护者**：减少“怎么运行？”类问题（recipes + CI 验证）
- **贡献者**：通过 PR 维护 recipes，自动化校验

## 工作方式（通俗版）

- 在 Portal（或 README）里选一个应用。
- 复制一条命令并执行。
- 应用在本机启动，然后在浏览器打开 UI。
- 出问题用 `trystack doctor ...` 看缺什么、怎么修。

## 路线图（后续）

- 给维护者提供可粘贴的 “Try locally” badge（链接到 Portal）。
- 做浏览器扩展：在 GitHub repo 页面显示 “Try locally” 按钮（跳到 Portal 并自动填充 repo）。
- 做 GitHub App 自动化（PR checks / comments / status），同时仍保持“在用户本地运行”。

## 固定版本（推荐）

为了可复现运行，建议 pin 到 tag（示例）：

`npx --yes -p github:LeeJinMing/TryStack#v0.0.2 trystack up louislam/uptime-kuma`

## 仓库结构

- `recipes/`：公开 recipes（按项目 / 变体）
- `cli/`：CLI 包（`trystack-cli`）— 本地开发/调试
- `spec/`：recipe 规范与示例
- `.github/workflows/`：CI 校验模板
- `portal/`：Portal 源码与脚本

## Portal 本地运行

```bash
cd portal
npm install
npm run dev
```

```bash
npm run build
node dev.js --dist
```

Portal 仅提交源码与脚本；`portal/dist/` 与 `portal/node_modules/` 不入库（已在 `.gitignore` 中忽略）。

## 提交规范（Repo hygiene）

可提交（源码与配置）：

- `recipes/**`
- `spec/**`
- `cli/**`
- `portal/**`（不含构建产物）
- `.github/workflows/**`
- `README.md` / `README.zh-CN.md`

不可提交（本地生成/缓存）：

- `**/node_modules/`
- `**/dist/`
- `.env*`
