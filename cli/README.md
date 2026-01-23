# githubui-try (local)

从本仓库 `recipes/` 中解析对应项目的 recipe，并输出本地启动命令（可选直接执行）。

> 当前为仓库内 CLI 骨架：默认从 `../recipes` 读取 recipes。后续可扩展为远端 registry 拉取。

## Usage

```bash
cd cli
npm i

# 默认（up）：启动 docker compose 并自动打开 UI
node index.js up louislam/uptime-kuma

# Back-compat（仍可用）：不写子命令等价于 up
node index.js louislam/uptime-kuma

# 仅打印启动命令（不执行）
node index.js print louislam/uptime-kuma
node index.js louislam/uptime-kuma --no-run

# 查看可用 recipes / 指定 recipe
node index.js list louislam/uptime-kuma
node index.js louislam/uptime-kuma --list
node index.js louislam/uptime-kuma --recipe default

# 排障/管理（与 up 使用同一个 compose projectName）
node index.js ps louislam/uptime-kuma
node index.js logs louislam/uptime-kuma --tail 200
node index.js stop louislam/uptime-kuma
node index.js down louislam/uptime-kuma

# 自检（环境 + 当前 project 状态/端口）
node index.js doctor louislam/uptime-kuma
```
