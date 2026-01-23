/* eslint-disable no-console */
const path = require("node:path");
const { EXIT } = require("../lib/constants");
const { parseRepo, repoRoot, listRecipeIds } = require("../lib/repo");
const { listRecipeIdsFromGithubRegistry } = require("../lib/github");

async function listCommand({ input, registryOptions, jsonOutput, usage }) {
  const repo = parseRepo(input);
  if (!repo) {
    console.error(`Unsupported repo format: ${input}`);
    usage();
    return EXIT.USAGE;
  }

  const localDir = path.join(repoRoot(), "recipes", repo.owner, repo.repo);
  let ids = listRecipeIds(localDir);
  let source = "local";
  if ((ids.length === 0 || registryOptions.preferRegistry) && registryOptions.registry) {
    try {
      ids = await listRecipeIdsFromGithubRegistry(registryOptions.registry, repo);
      source = "github";
    } catch (e) {
      console.error("Registry fetch failed.");
      console.error(e?.message || String(e));
      return EXIT.REGISTRY_ERROR;
    }
  }

  if (ids.length === 0) {
    console.error(`No recipes found for ${repo.owner}/${repo.repo}`);
    console.error(`Expected under: ${localDir}`);
    if (registryOptions.registry) {
      console.error(
        `Registry fallback also found nothing: ${registryOptions.registry.owner}/${registryOptions.registry.repo}@${registryOptions.registry.ref}`,
      );
    }
    return EXIT.NOT_FOUND;
  }

  const sorted = ids.sort();
  if (jsonOutput) {
    const payload = {
      repo: `${repo.owner}/${repo.repo}`,
      source,
      localPath: localDir,
      registry: registryOptions.registry
        ? `${registryOptions.registry.owner}/${registryOptions.registry.repo}@${registryOptions.registry.ref}`
        : null,
      recipeIds: sorted,
    };
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`Repo: ${repo.owner}/${repo.repo}`);
    console.log(`Source: ${source}`);
    console.log(`Local path: ${localDir}`);
    if (registryOptions.registry) {
      console.log(
        `Registry: ${registryOptions.registry.owner}/${registryOptions.registry.repo}@${registryOptions.registry.ref}`,
      );
    }
    console.log("Available recipes:");
    for (const id of sorted) console.log(`- ${id}`);
    console.log("");
  }

  return EXIT.OK;
}

module.exports = {
  listCommand,
};
