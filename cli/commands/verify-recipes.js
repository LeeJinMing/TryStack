/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const { EXIT } = require("../lib/constants");
const { getArgValue } = require("../lib/args");
const { repoRoot } = require("../lib/repo");
const { readRecipeYaml, readComposeYaml, validateRecipeV0 } = require("../lib/recipe");

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

function listServicesFromCompose(compose) {
  const services = compose?.services && typeof compose.services === "object" ? compose.services : null;
  if (!services) return [];
  return Object.entries(services).map(([name, svc]) => ({
    name,
    image: typeof svc?.image === "string" ? svc.image : "",
  }));
}

function detectLocalDeps(services) {
  const hits = [];
  const needles = [
    "postgres",
    "postgis",
    "redis",
    "mysql",
    "mariadb",
    "mongo",
    "mssql",
    "elasticsearch",
    "minio",
    "rabbitmq",
  ];
  for (const s of services) {
    const img = (s.image || "").toLowerCase();
    const name = (s.name || "").toLowerCase();
    const hit = needles.find((n) => img.includes(n) || name.includes(n));
    if (hit) hits.push(hit);
  }
  return Array.from(new Set(hits)).sort();
}

function classifyTier(recipe, localDeps) {
  const required = Array.isArray(recipe?.env?.required) ? recipe.env.required : [];
  const requiredUpper = required.map((k) => String(k).toUpperCase());

  // A3:明显生产级/域名/邮件/回调等必填配置
  const productionKeys = ["DOMAIN", "SMTP", "S3", "OAUTH", "CLIENT_ID", "CLIENT_SECRET", "WEBHOOK"];
  if (requiredUpper.some((k) => productionKeys.some((p) => k.includes(p)))) return "A3";

  // A2:需要外部必填配置（key/token 等）
  if (required.length > 0) return "A2";

  // A1:需要本地依赖（db/cache 等）但仍是一键起
  if (localDeps.length > 0) return "A1";

  // A0:最省心（无必填外部配置 + 无明显依赖）
  return "A0";
}

async function verifyRecipesCommand({ args, jsonOutput }) {
  const recipesDirArg = getArgValue(args, "--recipes-dir");
  const recipesRoot = recipesDirArg
    ? path.resolve(recipesDirArg)
    : path.join(repoRoot(), "recipes");

  if (!fs.existsSync(recipesRoot)) {
    console.error(`recipes dir not found: ${recipesRoot}`);
    return EXIT.NOT_FOUND;
  }

  const owners = listDirs(recipesRoot);
  const results = [];
  const tiers = { A0: 0, A1: 0, A2: 0, A3: 0, C: 0 };

  for (const owner of owners) {
    const ownerDir = path.join(recipesRoot, owner);
    const repos = listDirs(ownerDir);
    for (const repo of repos) {
      const repoDir = path.join(ownerDir, repo);
      const recipeIds = listDirs(repoDir);
      for (const recipeId of recipeIds) {
        const recipeDir = path.join(repoDir, recipeId);
        const errors = [];

        const recipeYamlPath = path.join(recipeDir, "recipe.yaml");
        if (!fs.existsSync(recipeYamlPath)) {
          errors.push("missing recipe.yaml");
        }

        const readmePath = path.join(recipeDir, "README.md");
        if (!fs.existsSync(readmePath)) {
          errors.push("missing README.md");
        }

        let recipe = null;
        if (errors.length === 0) {
          try {
            recipe = readRecipeYaml(recipeDir);
          } catch (e) {
            errors.push(`invalid recipe.yaml: ${normalizeErrorMessage(e)}`);
          }
        }

        let compose = null;
        let services = [];
        let localDeps = [];

        if (recipe) {
          errors.push(
            ...validateRecipeV0(recipe, {
              expectedId: recipeId,
              expectedOwner: owner,
              expectedRepo: repo,
            }),
          );

          const composeFile = recipe?.runtime?.composeFile;
          if (typeof composeFile === "string" && composeFile.trim()) {
            const allowed = ["compose.yaml", "docker-compose.yml"];
            if (!allowed.includes(composeFile)) {
              errors.push(`runtime.composeFile must be one of: ${allowed.join(", ")}`);
            }
            const composePath = path.join(recipeDir, composeFile);
            if (!fs.existsSync(composePath)) {
              errors.push(`missing compose file '${composeFile}'`);
            } else {
              try {
                compose = readComposeYaml(recipeDir, composeFile);
                services = listServicesFromCompose(compose);
                localDeps = detectLocalDeps(services);
              } catch (e) {
                errors.push(`invalid compose file '${composeFile}': ${normalizeErrorMessage(e)}`);
              }
            }
          }

          // Spec expects at least one service in compose
          if (compose && services.length === 0) {
            errors.push("compose has no services");
          }

          // healthcheck expectStatus sanity range
          const status = Number(recipe?.ui?.healthcheck?.expectStatus);
          if (Number.isFinite(status) && (status < 100 || status > 599)) {
            errors.push("ui.healthcheck.expectStatus must be within 100..599");
          }
        }

        const tier = recipe ? classifyTier(recipe, localDeps) : null;
        if (tier && tiers[tier] != null) tiers[tier] += 1;

        results.push({
          owner,
          repo,
          recipeId,
          recipeDir: safeRel(repoRoot(), recipeDir),
          ok: errors.length === 0,
          tier,
          localDeps,
          composeServices: services.map((s) => s.name),
          uiUrl: typeof recipe?.ui?.url === "string" ? recipe.ui.url : null,
          errors,
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
    total: results.length,
    failed: results.filter((r) => !r.ok).length,
    recipesRoot: safeRel(repoRoot(), recipesRoot),
    tiers,
    results,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`recipesRoot: ${summary.recipesRoot}`);
    console.log(`total: ${summary.total}`);
    console.log(`failed: ${summary.failed}`);
    console.log("");

    for (const r of summary.results) {
      if (r.ok) continue;
      console.log(`- ${r.owner}/${r.repo}/${r.recipeId} (${r.recipeDir})`);
      for (const e of r.errors) console.log(`  - ${e}`);
    }
    console.log("");
  }

  return ok ? EXIT.OK : EXIT.RECIPE_INVALID;
}

module.exports = {
  verifyRecipesCommand,
};

