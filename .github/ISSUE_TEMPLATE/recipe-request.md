---
name: "Recipe request"
about: "Request a new recipe for an app repo (owner/repo)."
title: "recipe-request: <owner>/<repo>"
labels: ["recipe-request"]
---

## Target repo

- GitHub repo: **owner/repo**
- Link: https://github.com/owner/repo

## Category (choose one)

- Monitoring / Status
- Notes / Knowledge base
- Files / Storage
- Passwords / Auth
- Download / Automation
- RSS / Read later
- Photos / Media
- Dashboard / Tools
- Other:

## Expected level (A0/A1/A2/A3)

- A0: no external keys, minimal deps, UI opens directly
- A1: needs local deps (Postgres/Redis...) but can be started with defaults
- A2: needs external key/OAuth but can partially try without it
- A3: production-level setup (domain/email/OAuth callbacks), not guaranteed "one-click"

## Notes

- Anything special? (ports, volumes, default creds, etc.)
- If the repo already provides docker-compose/devcontainer, paste links here.

