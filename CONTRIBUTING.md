# Contributing

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
