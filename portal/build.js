const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const dist = path.join(root, "dist");
const repoRoot = path.resolve(root, "..");
const recipesRoot = path.join(repoRoot, "recipes");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(srcDir, destDir) {
  ensureDir(destDir);
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else copyFile(src, dest);
  }
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function safeText(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function snippetFromReadme(readmeMd) {
  const lines = String(readmeMd || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const first = lines.find((l) => !l.startsWith("#")) || lines[0] || "";
  return safeText(first.replace(/[`*_>#]/g, "")).slice(0, 140);
}

function buildRecipesIndex() {
  const entries = [];
  for (const owner of listDirs(recipesRoot)) {
    for (const repo of listDirs(path.join(recipesRoot, owner))) {
      for (const recipeId of listDirs(path.join(recipesRoot, owner, repo))) {
        const recipeDir = path.join(recipesRoot, owner, repo, recipeId);
        const readmePath = path.join(recipeDir, "README.md");
        const recipeYamlPath = path.join(recipeDir, "recipe.yaml");
        if (!fs.existsSync(recipeYamlPath)) continue;

        const readmeMd = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, "utf8") : "";
        const args =
          recipeId === "default"
            ? `trystack up ${owner}/${repo}`
            : `trystack up ${owner}/${repo} --recipe ${recipeId}`;
        const command = `npx --yes -p github:LeeJinMing/TryStack ${args}`;

        entries.push({
          owner,
          repo,
          recipeId,
          title: `${owner}/${repo}`,
          github: `https://github.com/${owner}/${repo}`,
          command,
          snippet: snippetFromReadme(readmeMd),
          readme: fs.existsSync(readmePath)
            ? `data/readmes/${owner}/${repo}/${recipeId}.md`
            : null,
        });
      }
    }
  }

  entries.sort((a, b) => {
    const ka = `${a.owner}/${a.repo}/${a.recipeId}`.toLowerCase();
    const kb = `${b.owner}/${b.repo}/${b.recipeId}`.toLowerCase();
    return ka.localeCompare(kb);
  });

  return {
    generatedAt: new Date().toISOString(),
    total: entries.length,
    recipes: entries,
  };
}

if (fs.existsSync(dist)) fs.rmSync(dist, { recursive: true, force: true });
ensureDir(dist);

copyFile(path.join(root, "index.html"), path.join(dist, "index.html"));
copyDir(path.join(root, "src"), path.join(dist, "src"));

// Generate static recipes index + README copies for pure static hosting.
const index = buildRecipesIndex();
ensureDir(path.join(dist, "data"));
fs.writeFileSync(path.join(dist, "data", "recipes.json"), JSON.stringify(index, null, 2), "utf8");

for (const r of index.recipes) {
  if (!r.readme) continue;
  const src = path.join(recipesRoot, r.owner, r.repo, r.recipeId, "README.md");
  const dest = path.join(dist, r.readme);
  copyFile(src, dest);
}

console.log("Build complete: portal/dist");
