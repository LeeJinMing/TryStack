---
name: "Bug: run failed"
about: "Report a failure when running or doctoring a recipe."
title: "bug: <short summary>"
labels: ["bug", "triage"]
---

## What happened?

Describe what you expected vs what happened.

## Steps to reproduce

1.
2.
3.

## Environment

- OS: (Windows/macOS/Linux)
- Node: `node --version`
- Docker: `docker --version`
- Docker Compose: `docker compose version`

## Target

- Repo: **owner/repo**
- recipeId: `default` (or another)
- Command you ran:

```bash
# paste the exact command
```

## Doctor output (recommended)

Run:

```bash
npx --yes -p github:LeeJinMing/TryStack#main trystack doctor owner/repo --recipe default
```

Paste output here:

```text
<doctor output>
```

