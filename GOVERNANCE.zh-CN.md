# 项目治理（决策透明）

本项目治理目标是“轻量但可追溯”：

- **决策可追溯**：做了什么、为什么、什么时候、由谁决定。
- **贡献可预期**：怎么提案、怎么评审、怎么合并。
- **晋升可清晰**：如何成为 Reviewer / Maintainer。

## 角色定义

- **Contributor（贡献者）**
  - 任何提交 issue/PR/讨论、参与评审的人。
  - 不需要特殊权限。

- **Reviewer（评审者）**
  - 受信任的贡献者，负责 review/approve 变更。
  - 期望定期参与 issue 分诊与 PR 评审。

- **Maintainer（维护者）**
  - 拥有合并/发布权限。
  - 对项目方向、安全边界、发布质量负责。

## 决策流程（默认透明）

大多数变更采用 **懒共识（lazy consensus）**：

- 如果在合理时间窗口内（通常 72 小时，非紧急）无人提出反对意见，维护者可合并。
- 若存在争议，维护者可要求显式同意（例如要求更多审批/投票）。

### 何时必须写 ADR（架构决策记录）

以下变更需要在 `docs/decisions/` 新增 ADR：

- 影响 **recipe spec**（`spec/recipe-spec.md`）或校验规则。
- 影响 **CLI 契约**（参数、退出码、输出格式）。
- 影响 **安全模型**（如协议处理器行为、远端拉取策略）。
- 引入新的系统能力（如 registry 行为、CI 验证策略变化）。

小型重构、bugfix、新增 recipes、普通文档更新，一般 **不需要** ADR。

### 如何发起提案

- 先开一个 GitHub issue：`Proposal: <标题>`，至少包含：
  - 问题描述
  - 方案
  - 关键取舍/替代方案
  - 兼容性/迁移影响
  - 验收方式
- 若命中 ADR 条件，同时开 PR 增加 ADR 文件。

## 合并策略

- PR 通常需要至少 **1 位 Reviewer/Maintainer** 审批（低风险文档/拼写修正可由维护者酌情直接合并）。
- spec/CLI/security/CI 等高风险区域，尽量做到 **2 个审批**。
- PR 描述和提交信息优先写清楚“为什么”。

## 晋升机制（Contributor → Reviewer → Maintainer）

晋升看 **持续贡献与可信度**，不是单次 PR。

### 成为 Reviewer

典型参考（非硬门槛）：

- 5 个以上有意义的合并 PR（recipes/portal/cli/spec/docs 均可）。
- 能给出建设性的 review（至少有一些 review 评论/approve 记录）。
- 有安全意识：不推动不安全执行路径，理解威胁边界。

流程：

- 任意维护者在 issue 发起提名：`Nomination: Reviewer - @user`
- 7 天评论窗口（维护者/评审者可提出顾虑）
- 无阻塞顾虑则授予 Reviewer 权限

### 成为 Maintainer

典型参考：

- 担任 Reviewer 并持续活跃 4 周以上。
- 至少在一个领域具备 owner 意识（Portal / CLI / Spec / CI / Recipes 治理）。
- 对安全与稳定性问题响应负责。

流程：

- 维护者提名：`Nomination: Maintainer - @user`
- 14 天评论窗口
- 现有维护者同意后授予（多数通过；平票由项目 owner 决定）

## 退出/不活跃

- Reviewer/Maintainer 连续 90 天不活跃，可转为“emeritus”以保持责任清晰。
- 需要时可申请恢复权限。

## 安全

- 不接受“默认执行不受信任代码”的变更（必须隔离/确认/可审计）。
- 发现安全问题建议先私下报告维护者，再公开披露。
