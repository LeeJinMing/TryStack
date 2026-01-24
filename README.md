# TryStack

English | [Chinese](README.zh-CN.md)

Latest release: `v0.0.2` (`https://github.com/LeeJinMing/TryStack/releases/tag/v0.0.2`)

**TryStack** gives open-source projects a **one-click “try locally” entry point**.
It uses a verified **recipe** (Docker Compose) so anyone can run an app locally and open its UI in minutes.

## Quick start (3 lines)

```bash
npx --yes -p github:LeeJinMing/TryStack#v0.0.2 trystack up louislam/uptime-kuma
# Or: trystack up filebrowser/filebrowser
npx --yes -p github:LeeJinMing/TryStack#v0.0.2 trystack ps louislam/uptime-kuma
```

## Portal (online)

After you enable GitHub Pages (Settings → Pages → Source: GitHub Actions), the Portal is available at:

`https://leejinming.github.io/TryStack/`

## Registry (optional)

```bash
# Prefer remote registry recipes (for validation)
trystack up louislam/uptime-kuma --prefer-registry

# Use a custom registry repo and ref
trystack up louislam/uptime-kuma --registry owner/recipes-repo --registry-ref main
```

## CLI tips

```bash
# JSON output for scripts
trystack list louislam/uptime-kuma --json

# Validate all local recipes (for CI)
trystack verify-recipes --json

# Doctor includes compose config validation and UI precheck
trystack doctor louislam/uptime-kuma
trystack doctor louislam/uptime-kuma --json
```

`list --json` fields: `repo` / `source` / `localPath` / `registry` / `recipeIds`.

Exit codes: `0` ok, `1` usage, `2` not found, `3` UI timeout, `4` port in use, `5` registry error, `6` recipe invalid, `7` required env missing, `127` docker/compose missing.

## What you get

- **For evaluators**: “does it work?” in minutes, not hours of setup
- **For maintainers**: fewer “how do I run this?” issues (recipes + CI verification)
- **For contributors**: add/maintain recipes via PR, with automated validation

## How it works (plain language)

- Pick an app from the Portal (or README).
- Copy one command and run it.
- The app starts on your machine, and you open its page in your browser.
- If something goes wrong, you run `trystack doctor ...` to see what is missing and how to fix it.

## Roadmap (later)

- Add a small “Try locally” badge maintainers can paste into their GitHub README (links to the Portal).
- Add a browser extension that shows a “Try locally” button on GitHub repo pages (opens the Portal with repo pre-filled).
- Add GitHub App automation for maintainers (PR checks / comments / status), while still keeping everything running locally.

## Version pinning (recommended)

For reproducible runs, pin to a tag (example):

`npx --yes -p github:LeeJinMing/TryStack#v0.0.2 trystack up louislam/uptime-kuma`

## Repository layout

- `recipes/`: public recipes (by project / variant)
- `cli/`: CLI package (`trystack-cli`) — local dev/debug
- `spec/`: recipe spec (`recipe.yaml`) and examples
- `.github/workflows/`: CI verification template for recipes
- `portal/`: minimal web portal (entry + docs)

## Portal usage

```bash
cd portal
npm install
npm run dev
```

```bash
npm run build
node dev.js --dist
```

Portal source only is committed; `portal/dist/` and `portal/node_modules/` are ignored by `.gitignore`.

## Repo hygiene

Allowed to commit (source + config):

- `recipes/**`
- `spec/**`
- `cli/**`
- `portal/**` (without build artifacts)
- `.github/workflows/**`
- `README.md` / `README.zh-CN.md`

Do not commit (generated / local-only):

- `**/node_modules/`
- `**/dist/`
- `.env*`
