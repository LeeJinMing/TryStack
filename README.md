# GitHubUI Recipes (Try locally)

为**自托管开源应用**提供可验证、可复用的本地一键启动 recipes，帮助维护者降低上手与支持成本（减少重复 issue），并让评估者几分钟内跑起来看到 UI。

## Try locally

输入任意 GitHub 仓库（A0/A1 优先），获取可用 recipe 并在本地用 Docker 启动：

- Portal（后续）：`/try/<owner>/<repo>`
- CLI（后续，npx）：`npx githubui-try <owner>/<repo>`

## For maintainers

- **减少支持成本**：把“怎么跑起来”标准化成 recipe + CI 验证
- **可控可审计**：公共 recipes/规范/验证模板永久开源，支持版本范围清晰
- **社区协作**：用 PR 贡献与更新 recipes；失败会给出可复现日志与缺口清单

## Repo structure

- `recipes/`: 公共 recipes（按项目/版本组织）
- `spec/`: recipe 规范与分诊规则
- `.github/workflows/`: CI 验证模板（PR 必须通过）
- `cli/`: npx CLI（后续）
- `portal/`: Portal（后续）
