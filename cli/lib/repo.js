const fs = require("node:fs");
const path = require("node:path");

function parseRepo(input) {
  const m1 = input.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (m1) return { owner: m1[1], repo: m1[2] };

  const m2 = input.match(
    /^https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/,
  );
  if (m2) return { owner: m2[1], repo: m2[2] };

  const m3 = input.match(
    /^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/,
  );
  if (m3) return { owner: m3[1], repo: m3[2] };

  return null;
}

function parseOwnerRepo(input) {
  const m = (input || "").match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

function repoRoot() {
  return path.resolve(__dirname, "..", "..");
}

function listRecipeIds(repoDir) {
  if (!fs.existsSync(repoDir)) return [];
  return fs
    .readdirSync(repoDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function pickRecipeId(recipeIds) {
  if (recipeIds.includes("default")) return "default";
  return recipeIds.sort()[0] || null;
}

function sanitizeProjectName(name) {
  const s = name.toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  return s.length > 50 ? s.slice(0, 50) : s;
}

module.exports = {
  parseRepo,
  parseOwnerRepo,
  repoRoot,
  listRecipeIds,
  pickRecipeId,
  sanitizeProjectName,
};
