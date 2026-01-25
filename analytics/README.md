# TryStack Analytics (Vercel + KV)

这是一个给 TryStack Portal 用的**极简埋点后端**：

- `POST /api/track`：收集事件（白名单 + 限流 + Origin 校验）
- `GET /api/stats?days=7`：输出近 N 天聚合统计
- `/admin`：中文表格看板（不依赖英文后台）

## 部署方式（推荐）

1. 在 Vercel 新建项目，Root Directory 选择本目录：`analytics/`
2. 给该项目启用 **Vercel KV**
3. 设置环境变量（可选，但建议）：
   - `ALLOWED_ORIGINS`: `https://leejinming.github.io,http://localhost:4173`
   - `RATE_LIMIT_PER_MIN`: `120`
   - `ADMIN_TOKEN`: 访问 `/api/stats` 与 `/admin` 的口令（强烈建议设置，避免数据裸奔）

部署后：

- 管理页：`https://<your-app>.vercel.app/admin`
- 埋点入口：`https://<your-app>.vercel.app/api/track`
  - 统计接口：`https://<your-app>.vercel.app/api/stats?days=7&token=...`

## Portal 侧如何启用

在 Portal 的构建（GitHub Pages workflow）里设置：

- `TRYSTACK_ANALYTICS_ENDPOINT=https://<your-app>.vercel.app/api/track`

未设置时默认不启用（不会发送任何埋点）。
