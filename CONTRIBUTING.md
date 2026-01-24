# Contributing

## Governance / decision transparency

- Governance: `GOVERNANCE.md` (English) / `GOVERNANCE.zh-CN.md` (中文)
- Decisions / ADRs: `docs/decisions/README.md`

## Add a new recipe (quick guide)

1) Pick the target repo (GitHub `owner/repo`) and choose a `recipeId` (use `default` for the main variant).

1) Create a new folder:

`recipes/<owner>/<repo>/<recipeId>/`

1) Add these files:

- `recipe.yaml` (required)
- `compose.yaml` or `docker-compose.yml` (required)
- `README.md` (required, one page)

1) Validate locally:

```bash
cd cli
node entry.js verify-recipes --json
```

1) Open a Pull Request. CI will run checks automatically.

## Spec

Read the spec here: `spec/recipe-spec.md`

## Proposals (spec / CLI / security)

If your change impacts spec/CLI/security boundaries, please open an issue first:

- Title: `Proposal: <short title>`
- Include: problem, proposal, trade-offs, compatibility, verification plan
- If it meets ADR criteria, add an ADR under `docs/decisions/`
