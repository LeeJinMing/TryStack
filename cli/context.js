/* eslint-disable no-console */
const path = require("node:path");
const os = require("node:os");
const { EXIT } = require("./lib/constants");
const { parseRepo, repoRoot, listRecipeIds, pickRecipeId, sanitizeProjectName } = require("./lib/repo");
const { readRecipeYaml } = require("./lib/recipe");
const { listRecipeIdsFromGithubRegistry, fetchRecipeDirFromGithubRegistry } = require("./lib/github");
const { usage } = require("./usage");

async function resolveContext(input, requestedRecipeId, projectOverride, registryOptions) {
  const repo = parseRepo(input);
  if (!repo) {
    console.error(`Unsupported repo format: ${input}`);
    usage();
    process.exit(EXIT.USAGE);
  }

  const base = repoRoot();
  const repoDir = path.join(base, "recipes", repo.owner, repo.repo);
  const localRecipeIds = listRecipeIds(repoDir);
  let recipeIds = localRecipeIds;
  let source = "local";

  if ((recipeIds.length === 0 || registryOptions?.preferRegistry) && registryOptions?.registry) {
    try {
      recipeIds = await listRecipeIdsFromGithubRegistry(registryOptions.registry, repo);
      source = "github";
    } catch (e) {
      console.error("Registry fetch failed.");
      console.error(e?.message || String(e));
      process.exit(EXIT.REGISTRY_ERROR);
    }
  }

  if (recipeIds.length === 0) {
    console.error(`No recipes found for ${repo.owner}/${repo.repo}`);
    console.error(`Expected under: ${repoDir}`);
    if (registryOptions?.registry) {
      console.error(
        `Registry fallback also found nothing: ${registryOptions.registry.owner}/${registryOptions.registry.repo}@${registryOptions.registry.ref}`,
      );
    }
    process.exit(EXIT.NOT_FOUND);
  }

  let recipeId = pickRecipeId(recipeIds);
  if (requestedRecipeId) {
    if (!recipeIds.includes(requestedRecipeId)) {
      console.error(`Recipe '${requestedRecipeId}' not found for ${repo.owner}/${repo.repo}`);
      console.error("Use `list` to see available recipes.");
      process.exit(EXIT.NOT_FOUND);
    }
    recipeId = requestedRecipeId;
  }

  let recipeDir;
  let recipe;
  let composeFile;
  let effectiveRepoDir = repoDir;

  if (source === "local") {
    recipeDir = path.join(repoDir, recipeId);
    recipe = readRecipeYaml(recipeDir);
    composeFile = recipe?.runtime?.composeFile || "compose.yaml";
  } else {
    const cacheDir = registryOptions?.cacheDir || path.join(os.homedir(), ".githubui-cache");
    let fetched;
    try {
      fetched = await fetchRecipeDirFromGithubRegistry({
        registry: registryOptions.registry,
        target: repo,
        recipeId,
        cacheDir,
      });
    } catch (e) {
      console.error("Registry download failed.");
      console.error(e?.message || String(e));
      process.exit(EXIT.REGISTRY_ERROR);
    }
    recipeDir = fetched.recipeDir;
    recipe = fetched.recipe;
    composeFile = fetched.composeFile;
    effectiveRepoDir = path.join(cacheDir, "recipes", repo.owner, repo.repo);
  }

  const projectName = sanitizeProjectName(
    projectOverride || `ghui_${repo.owner}_${repo.repo}_${recipeId}`,
  );

  return {
    repo,
    repoDir: effectiveRepoDir,
    recipeIds,
    recipeId,
    recipeDir,
    recipe,
    composeFile,
    projectName,
    source,
    registry: registryOptions?.registry || null,
    cacheDir: registryOptions?.cacheDir || null,
  };
}

module.exports = {
  resolveContext,
};
