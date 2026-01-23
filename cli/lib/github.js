const path = require("node:path");
const os = require("node:os");
const YAML = require("yaml");
const { httpGet } = require("./http");
const { writeFileIfChanged } = require("./files");

function encodeGithubPath(p) {
  return (p || "")
    .split("/")
    .filter((s) => s.length > 0)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

async function githubApiGetJson(url) {
  const { status, body } = await httpGet(url, {
    Accept: "application/vnd.github+json",
    "User-Agent": "trystack",
  });
  if (status !== 200) {
    const snippet = (body || "").slice(0, 400);
    throw new Error(`GitHub API request failed (${status}) for ${url}\n${snippet}`);
  }
  return JSON.parse(body);
}

async function githubDownloadText(url) {
  const { status, body } = await httpGet(url, { "User-Agent": "trystack" });
  if (status !== 200) {
    const snippet = (body || "").slice(0, 200);
    throw new Error(`Download failed (${status}) for ${url}\n${snippet}`);
  }
  return body;
}

async function listRecipeIdsFromGithubRegistry(registry, target) {
  const { owner: ro, repo: rr, ref } = registry;
  const p = `recipes/${target.owner}/${target.repo}`;
  const url = `https://api.github.com/repos/${ro}/${rr}/contents/${encodeGithubPath(p)}?ref=${encodeURIComponent(ref)}`;
  const items = await githubApiGetJson(url);
  if (!Array.isArray(items)) return [];
  return items.filter((it) => it && it.type === "dir").map((it) => it.name).filter(Boolean);
}

async function fetchRecipeDirFromGithubRegistry({ registry, target, recipeId, cacheDir }) {
  const { owner: ro, repo: rr, ref } = registry;
  const basePath = `recipes/${target.owner}/${target.repo}/${recipeId}`;
  const localDir = path.join(cacheDir, "recipes", target.owner, target.repo, recipeId);

  const recipeMetaUrl = `https://api.github.com/repos/${ro}/${rr}/contents/${encodeGithubPath(`${basePath}/recipe.yaml`)}?ref=${encodeURIComponent(ref)}`;
  const recipeMeta = await githubApiGetJson(recipeMetaUrl);
  const recipeYaml = await githubDownloadText(recipeMeta.download_url);
  writeFileIfChanged(path.join(localDir, "recipe.yaml"), recipeYaml);

  const recipe = YAML.parse(recipeYaml);
  const composeFile = recipe?.runtime?.composeFile || "compose.yaml";

  const composeMetaUrl = `https://api.github.com/repos/${ro}/${rr}/contents/${encodeGithubPath(`${basePath}/${composeFile}`)}?ref=${encodeURIComponent(ref)}`;
  const composeMeta = await githubApiGetJson(composeMetaUrl);
  const composeYaml = await githubDownloadText(composeMeta.download_url);
  writeFileIfChanged(path.join(localDir, composeFile), composeYaml);

  try {
    const readmeMetaUrl = `https://api.github.com/repos/${ro}/${rr}/contents/${encodeGithubPath(`${basePath}/README.md`)}?ref=${encodeURIComponent(ref)}`;
    const readmeMeta = await githubApiGetJson(readmeMetaUrl);
    const readme = await githubDownloadText(readmeMeta.download_url);
    writeFileIfChanged(path.join(localDir, "README.md"), readme);
  } catch {
    // ignore
  }

  return { recipeDir: localDir, recipe, composeFile };
}

module.exports = {
  encodeGithubPath,
  githubApiGetJson,
  githubDownloadText,
  listRecipeIdsFromGithubRegistry,
  fetchRecipeDirFromGithubRegistry,
};
