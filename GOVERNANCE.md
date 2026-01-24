# Governance (project decision transparency)

This project is intentionally lightweight. The goal of governance here is:

- Make decisions **traceable** (what, why, when, who).
- Make contributions **predictable** (how to propose, how to get reviews).
- Make promotions **clear** (how to become Reviewer/Maintainer).

## Roles

- **Contributor**
  - Anyone opening issues, PRs, discussions, or helping with reviews.
  - No special permissions required.

- **Reviewer**
  - Trusted contributors who can review and approve changes.
  - Expected to help triage issues and review PRs regularly.

- **Maintainer**
  - Has merge/release permissions.
  - Accountable for project direction, security posture, and releases.

## Decision process (transparent by default)

We use **lazy consensus** for most changes:

- If there is no objection within a reasonable time window (usually 72 hours for non-urgent changes), maintainers may merge.
- Any maintainer can request an explicit approval vote if the change is controversial.

### What requires an ADR (Architecture Decision Record)

Create an ADR under `docs/decisions/` when a change:

- Alters the **recipe spec** (`spec/recipe-spec.md`) or validation rules.
- Changes the **CLI contract** (flags, exit codes, output formats).
- Changes the **security model** (e.g., protocol handler behavior, remote fetching).
- Introduces a new “system” capability (e.g., registry behavior, CI verification strategy).

Small refactors, bugfixes, recipes additions, and docs updates generally **do not** require an ADR.

### How to propose a decision

- Open a GitHub issue titled `Proposal: <short title>` describing:
  - Problem statement
  - Proposed solution
  - Trade-offs / alternatives
  - Compatibility / migration concerns
  - Test plan / verification
- If it meets the ADR criteria above, also open a PR adding an ADR.

## Merge policy

- PRs should be reviewed by at least **1 Reviewer/Maintainer** (maintainer discretion for low-risk docs/typos).
- For high-risk areas (spec/CLI/security/CI), require **2 approvals** when possible.
- Maintain “why” in commit messages and PR descriptions.

## Promotion ladder (Contributor → Reviewer → Maintainer)

Promotions are based on **sustained contributions** and **trust**, not a single PR.

### Become a Reviewer

Typical criteria (guideline, not a hard gate):

- 5+ meaningful merged PRs (recipes/portal/cli/spec/docs), with good collaboration.
- Demonstrates ability to review others’ PRs constructively (at least a few review comments/approvals).
- Shows good security hygiene (does not propose unsafe execution paths, understands threat boundaries).

Process:

- Any maintainer can nominate a contributor in an issue: `Nomination: Reviewer - @user`.
- 7-day comment window for maintainers/reviewers to raise concerns.
- If no blocking concerns, maintainer grants Reviewer rights.

### Become a Maintainer

Typical criteria:

- Consistent Reviewer activity for 4+ weeks.
- Demonstrates ownership in at least one area (Portal / CLI / Spec / CI / Recipes governance).
- Responds responsibly to security and reliability issues.

Process:

- Maintainer nomination via `Nomination: Maintainer - @user`.
- 14-day comment window.
- Requires approval from existing maintainers (simple majority; ties resolved by project owner).

## Offboarding / inactivity

- Reviewers/Maintainers inactive for 90 days may be moved to “emeritus” to keep ownership clear.
- Access can be restored upon request.

## Security

- Do not accept changes that execute untrusted code without isolation/confirmation.
- If you find a security issue, open a private report (or contact maintainers) before public disclosure.
