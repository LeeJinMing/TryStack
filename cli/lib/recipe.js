const fs = require("node:fs");
const path = require("node:path");
const YAML = require("yaml");

const API_VERSION_V0 = "githubui.recipes/v0";

function readRecipeYaml(recipeDir) {
  const p = path.join(recipeDir, "recipe.yaml");
  if (!fs.existsSync(p)) throw new Error(`Missing recipe.yaml at ${p}`);
  const raw = fs.readFileSync(p, "utf8");
  return YAML.parse(raw);
}

function readComposeYaml(recipeDir, composeFile) {
  const p = path.join(recipeDir, composeFile);
  if (!fs.existsSync(p)) throw new Error(`Missing compose file at ${p}`);
  const raw = fs.readFileSync(p, "utf8");
  return YAML.parse(raw);
}

function validateRecipe(recipe) {
  const errors = [];
  if (!recipe || typeof recipe !== "object") {
    errors.push("recipe.yaml is empty or invalid");
    return errors;
  }
  if (!recipe.apiVersion) errors.push("apiVersion is required");
  if (!recipe.id) errors.push("id is required");
  const target = recipe.target || {};
  if (!target.owner) errors.push("target.owner is required");
  if (!target.repo) errors.push("target.repo is required");
  const runtime = recipe.runtime || {};
  if (!runtime.type) errors.push("runtime.type is required");
  if (runtime.type && runtime.type !== "compose") errors.push("runtime.type must be 'compose'");
  if (!runtime.composeFile) errors.push("runtime.composeFile is required");
  const ui = recipe.ui || {};
  if (!ui.url) errors.push("ui.url is required");
  return errors;
}

function validateRecipeV0(recipe, expectations = null) {
  const errors = [];
  if (!recipe || typeof recipe !== "object") {
    errors.push("recipe.yaml is empty or invalid");
    return errors;
  }

  if (recipe.apiVersion !== API_VERSION_V0) {
    errors.push(`apiVersion must be '${API_VERSION_V0}'`);
  }

  if (typeof recipe.id !== "string" || !recipe.id.trim()) {
    errors.push("id is required");
  } else if (expectations?.expectedId && recipe.id !== expectations.expectedId) {
    errors.push(`id mismatch (expected '${expectations.expectedId}', got '${recipe.id}')`);
  }

  const target = recipe.target;
  if (!target || typeof target !== "object") {
    errors.push("target is required");
  } else {
    if (typeof target.owner !== "string" || !target.owner.trim()) errors.push("target.owner is required");
    if (typeof target.repo !== "string" || !target.repo.trim()) errors.push("target.repo is required");
    if (typeof target.ref !== "string" || !target.ref.trim()) errors.push("target.ref is required");

    if (expectations?.expectedOwner && target.owner && target.owner !== expectations.expectedOwner) {
      errors.push(`target.owner mismatch (expected '${expectations.expectedOwner}', got '${target.owner}')`);
    }
    if (expectations?.expectedRepo && target.repo && target.repo !== expectations.expectedRepo) {
      errors.push(`target.repo mismatch (expected '${expectations.expectedRepo}', got '${target.repo}')`);
    }
  }

  const runtime = recipe.runtime;
  if (!runtime || typeof runtime !== "object") {
    errors.push("runtime is required");
  } else {
    if (runtime.type !== "compose") errors.push("runtime.type must be 'compose'");
    if (typeof runtime.composeFile !== "string" || !runtime.composeFile.trim()) {
      errors.push("runtime.composeFile is required");
    }
  }

  const ui = recipe.ui;
  if (!ui || typeof ui !== "object") {
    errors.push("ui is required");
  } else {
    if (typeof ui.url !== "string" || !ui.url.trim()) errors.push("ui.url is required");
    const hc = ui.healthcheck;
    if (!hc || typeof hc !== "object") {
      errors.push("ui.healthcheck is required");
    } else {
      if (String(hc.method || "") !== "GET") errors.push("ui.healthcheck.method must be 'GET'");
      if (typeof hc.path !== "string" || !hc.path.startsWith("/")) errors.push("ui.healthcheck.path must start with '/'");
      if (!Number.isFinite(Number(hc.expectStatus))) errors.push("ui.healthcheck.expectStatus must be a number");
      if (hc.match != null && typeof hc.match !== "string") errors.push("ui.healthcheck.match must be a string");
    }
  }

  const ports = recipe.ports;
  if (ports != null) {
    if (!Array.isArray(ports)) {
      errors.push("ports must be an array");
    } else {
      for (const p of ports) {
        if (!p || typeof p !== "object") {
          errors.push("ports[] must be an object");
          continue;
        }
        if (typeof p.name !== "string" || !p.name.trim()) errors.push("ports[].name is required");
        if (p.service != null && typeof p.service !== "string") errors.push("ports[].service must be a string");
        if (p.protocol != null && typeof p.protocol !== "string") errors.push("ports[].protocol must be a string");
        if (!Number.isFinite(Number(p.containerPort))) errors.push("ports[].containerPort must be a number");
        if (!Number.isFinite(Number(p.hostPort))) errors.push("ports[].hostPort must be a number");
      }
    }
  }

  const env = recipe.env;
  if (env != null) {
    if (!env || typeof env !== "object") {
      errors.push("env must be an object");
    } else {
      if (env.required != null && !Array.isArray(env.required)) errors.push("env.required must be an array");
      if (env.optional != null && !Array.isArray(env.optional)) errors.push("env.optional must be an array");
      for (const k of env.required || []) {
        if (typeof k !== "string" || !k.trim()) errors.push("env.required[] must be non-empty strings");
      }
      for (const k of env.optional || []) {
        if (typeof k !== "string" || !k.trim()) errors.push("env.optional[] must be non-empty strings");
      }
    }
  }

  return errors;
}

function getMissingEnv(requiredKeys) {
  if (!Array.isArray(requiredKeys)) return [];
  return requiredKeys.filter((key) => {
    if (!key || typeof key !== "string") return false;
    return process.env[key] === undefined || process.env[key] === "";
  });
}

module.exports = {
  readRecipeYaml,
  readComposeYaml,
  validateRecipe,
  validateRecipeV0,
  getMissingEnv,
};
