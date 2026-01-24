/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const { EXIT } = require("../lib/constants");
const { getArgValue } = require("../lib/args");
const { repoRoot } = require("../lib/repo");
const { readRecipeYaml } = require("../lib/recipe");
const { getDefaultRecipesRoot, verifyRecipeDirAgainstPolicy } = require("../lib/policy");

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function safeRel(from, to) {
  try {
    return path.relative(from, to) || ".";
  } catch {
    return to;
  }
}

function normalizeErrorMessage(err) {
  const msg = err?.message || String(err);
  return msg.replace(/\s+/g, " ").trim();
}

async function verifyPolicyCommand({ args, jsonOutput }) {
  const mode = (getArgValue(args, "--mode") || "verified").trim().toLowerCase();
  if (!["verified", "community"].includes(mode)) {
    console.error(`Invalid --mode: ${mode} (expected: verified|community)`);
    return EXIT.USAGE;
  }

  const recipesDirArg = getArgValue(args, "--recipes-dir");
  const recipesRoot = getDefaultRecipesRoot({ recipesDirArg, repoRoot, cwd: process.cwd() });

  if (!fs.existsSync(recipesRoot)) {
    console.error(`recipes dir not found: ${recipesRoot}`);
    return EXIT.NOT_FOUND;
  }

  const owners = listDirs(recipesRoot);
  const results = [];

  for (const owner of owners) {
    const ownerDir = path.join(recipesRoot, owner);
    const repos = listDirs(ownerDir);
    for (const repo of repos) {
      const repoDir = path.join(ownerDir, repo);
      const recipeIds = listDirs(repoDir);
      for (const recipeId of recipeIds) {
        const recipeDir = path.join(repoDir, recipeId);
        const errors = [];
        const warnings = [];

        const recipeYamlPath = path.join(recipeDir, "recipe.yaml");
        if (!fs.existsSync(recipeYamlPath)) {
          errors.push("missing recipe.yaml");
          results.push({
            owner,
            repo,
            recipeId,
            recipeDir: safeRel(repoRoot(), recipeDir),
            mode,
            ok: false,
            errors,
            warnings,
          });
          continue;
        }

        let recipe = null;
        try {
          recipe = readRecipeYaml(recipeDir);
        } catch (e) {
          errors.push(`invalid recipe.yaml: ${normalizeErrorMessage(e)}`);
        }

        if (recipe) {
          try {
            const res = verifyRecipeDirAgainstPolicy({ recipeDir, owner, repo, recipeId, mode });
            errors.push(...res.errors);
            warnings.push(...res.warnings);
          } catch (e) {
            errors.push(normalizeErrorMessage(e));
          }
        }

        results.push({
          owner,
          repo,
          recipeId,
          recipeDir: safeRel(repoRoot(), recipeDir),
          mode,
          ok: errors.length === 0,
          errors,
          warnings,
        });
      }
    }
  }

  if (results.length === 0) {
    console.error(`No recipes found under: ${recipesRoot}`);
    console.error("Expected: recipes/<owner>/<repo>/<recipeId>/recipe.yaml");
    return EXIT.NOT_FOUND;
  }

  const ok = results.every((r) => r.ok);
  const summary = {
    ok,
    mode,
    total: results.length,
    failed: results.filter((r) => !r.ok).length,
    recipesRoot: safeRel(repoRoot(), recipesRoot),
    results,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`mode: ${mode}`);
    console.log(`recipesRoot: ${summary.recipesRoot}`);
    console.log(`total: ${summary.total}`);
    console.log(`failed: ${summary.failed}`);
    console.log("");

    for (const r of summary.results) {
      if (r.ok && r.warnings.length === 0) continue;
      console.log(`- ${r.owner}/${r.repo}/${r.recipeId} (${r.recipeDir})`);
      for (const e of r.errors) console.log(`  - ERROR: ${e}`);
      for (const w of r.warnings) console.log(`  - WARN:  ${w}`);
    }
    console.log("");
  }

  return ok ? EXIT.OK : EXIT.RECIPE_INVALID;
}

module.exports = {
  verifyPolicyCommand,
};

