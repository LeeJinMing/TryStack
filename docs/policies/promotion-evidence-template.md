# Promotion Evidence (required)

> This block is intended to be **machine-generated** and kept consistent for auditing.

<!-- promotion:verified -->
<!-- policy:verified-v1 -->

## Identity

- **source**: community
- **target**: verified
- **recipe**: `<owner>/<repo>/<recipeId>`
- **promotionId**: `<yyyymmdd-hhmm>-<short-hash>`

## Static policy (Verified Policy v1)

- **scope**: only `recipes/**` + { `recipe.yaml`, `compose.yaml`/`docker-compose.yml`, `README.md` }
- **verify-policy**: `PASS|FAIL`
- **findings**:
  - `<none>` (or list of policy errors)

## Images (digest pinned)

- `<service>`: `<image>@sha256:<digest>`  (optional `from tag: vX.Y.Z`)

## Verification stats (last 7d / 30d)

- **samples7d**: `N`
- **passRate7d**: `0.xx`
- **samples30d**: `N`
- **passRate30d**: `0.xx`
- **lastSuccessAt**: `YYYY-MM-DDTHH:mm:ssZ`

## Performance (best-effort)

- **startupP50**: `<seconds>`
- **pullBytesEstimate**: `<bytes>`

## Decision

- **autoMergeEligible**: `true|false`
- **reason**: `<policy|stats|manual>`
