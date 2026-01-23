# trystack-cli (local development)

English | [Chinese](README.zh-CN.md)

Local CLI package for developing/debugging TryStack. It resolves recipes from `../recipes` (local) or a GitHub registry and prints (or runs) the Docker Compose commands.

> Default behavior: prefer local `../recipes`, and fall back to the registry when missing (use `--prefer-registry` to force remote first).

## Packages

- Root package: `trystack` (end-user entry point via `npx trystack ...`)
- This folder: `trystack-cli` (local dev/debug)

## Usage

```bash
cd cli
npm i

# Or use the local package bin:
# npx trystack-cli up louislam/uptime-kuma

# Default (up): start docker compose and open the UI
node entry.js up louislam/uptime-kuma

# Back-compat: omitting subcommand is equivalent to `up`
node entry.js louislam/uptime-kuma

# Print only (no docker)
node entry.js print louislam/uptime-kuma
node entry.js louislam/uptime-kuma --no-run

# List available recipes / choose a recipeId
node entry.js list louislam/uptime-kuma
node entry.js louislam/uptime-kuma --list
node entry.js louislam/uptime-kuma --recipe default
node entry.js list louislam/uptime-kuma --json

# Manage (shares the same compose projectName with `up`)
node entry.js ps louislam/uptime-kuma
node entry.js logs louislam/uptime-kuma --tail 200
node entry.js stop louislam/uptime-kuma
node entry.js down louislam/uptime-kuma

# Diagnose (environment + project status / ports / validation)
node entry.js doctor louislam/uptime-kuma
node entry.js doctor louislam/uptime-kuma --json

# Validate all local recipes (for CI; no docker required)
node entry.js verify-recipes --json
```

## list --json output

```json
{
  "repo": "owner/repo",
  "source": "local|github",
  "localPath": "D:\\path\\to\\recipes\\owner\\repo",
  "registry": "owner/recipes-repo@main",
  "recipeIds": ["default", "v2"]
}
```

## doctor fields (plain text)

- Basics: `Repo` / `Recipe` / `Recipe dir` / `Project` / `Source` / `Cache dir`
- Environment: `node` / `platform` / `docker` / `docker compose`
- Recipe: `recipe.yaml` / `compose file` / `override` / `recipe validation`
- Checks: `ui.healthcheck` / `ports` / `env.required` / `env.optional`
- Runtime: `docker compose config` result, `docker compose ps`, and (when available) `Precheck`
  - `--json` also includes `envMissing` / `composeConfig` / `ps` / `precheck`

## Exit codes

- `0` ok
- `1` usage / invalid input
- `2` recipe not found / resolve failed
- `3` UI not ready
- `4` port conflict (no free port)
- `5` registry/network error
- `6` recipe invalid
- `7` required env missing
- `127` docker or compose missing

## Registry options

```bash
# Choose registry repo and ref
node entry.js up louislam/uptime-kuma --registry owner/recipes-repo --registry-ref main

# Force registry-first (for validating remote recipes)
node entry.js up louislam/uptime-kuma --prefer-registry

# Set a custom cache dir
node entry.js up louislam/uptime-kuma --cache-dir "D:\cache\trystack"
```
