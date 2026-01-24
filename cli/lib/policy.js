const path = require("node:path");
const { readRecipeYaml, readComposeYaml, validateRecipeV0 } = require("./recipe");

function hasImageDigest(image) {
  if (typeof image !== "string") return false;
  // Allow "repo@sha256:<digest>" or "repo:tag@sha256:<digest>".
  return /@sha256:[0-9a-fA-F]{64}\b/.test(image.trim());
}

function listServicesFromCompose(compose) {
  const services = compose?.services && typeof compose.services === "object" ? compose.services : null;
  if (!services) return [];
  return Object.entries(services).map(([name, svc]) => ({
    name,
    svc: svc && typeof svc === "object" ? svc : {},
  }));
}

function normalizeHostSource(s) {
  return String(s || "")
    .trim()
    .replace(/\\/g, "/")
    .toLowerCase();
}

function isAbsolutePathLike(src) {
  const s = normalizeHostSource(src);
  if (!s) return false;
  // linux absolute
  if (s.startsWith("/")) return true;
  // windows drive path: c:/...
  if (/^[a-z]:\//.test(s)) return true;
  return false;
}

function volumeSourceFromSpec(vol) {
  // Compose supports:
  // - "source:target[:mode]"
  // - { type: "bind", source: "...", target: "...", read_only: true }
  if (typeof vol === "string") {
    const raw = vol.split(":")[0];
    return raw ?? "";
  }
  if (vol && typeof vol === "object") {
    const src = vol.source ?? vol.src ?? "";
    return src;
  }
  return "";
}

function checkComposeSecurity({ compose, mode }) {
  const errors = [];
  const warnings = [];

  const services = listServicesFromCompose(compose);
  if (services.length === 0) {
    errors.push("compose has no services");
    return { errors, warnings };
  }

  for (const { name, svc } of services) {
    const prefix = `service '${name}': `;

    // Verified: require image digest pin.
    const image = typeof svc.image === "string" ? svc.image : "";
    if (mode === "verified") {
      if (!image) errors.push(`${prefix}missing image`);
      else if (!hasImageDigest(image)) errors.push(`${prefix}image must be pinned by digest (@sha256:...)`);
    }

    const privileged = svc.privileged === true;
    if (privileged) (mode === "verified" ? errors : warnings).push(`${prefix}privileged=true is not allowed`);

    const networkMode = typeof svc.network_mode === "string" ? svc.network_mode.trim().toLowerCase() : "";
    if (networkMode === "host") (mode === "verified" ? errors : warnings).push(`${prefix}network_mode=host is not allowed`);

    const pid = typeof svc.pid === "string" ? svc.pid.trim().toLowerCase() : "";
    if (pid === "host") (mode === "verified" ? errors : warnings).push(`${prefix}pid=host is not allowed`);

    const capAdd = Array.isArray(svc.cap_add) ? svc.cap_add : null;
    if (capAdd && capAdd.length > 0) {
      (mode === "verified" ? errors : warnings).push(`${prefix}cap_add is not allowed in verified (manual review required)`);
    }

    const securityOpt = Array.isArray(svc.security_opt) ? svc.security_opt : null;
    if (securityOpt && securityOpt.some((x) => String(x || "").toLowerCase().includes("unconfined"))) {
      (mode === "verified" ? errors : warnings).push(`${prefix}security_opt contains 'unconfined' (not allowed)`);
    }

    // Host bind mounts: deny a minimal sensitive list, and (for verified) deny any absolute host path binds.
    const volumes = Array.isArray(svc.volumes) ? svc.volumes : [];
    for (const v of volumes) {
      const srcRaw = volumeSourceFromSpec(v);
      const src = normalizeHostSource(srcRaw);
      if (!src) continue;

      const sensitive = [
        "/var/run/docker.sock",
        "/run/docker.sock",
        "/etc",
        "/proc",
        "/sys",
        "/root",
        "/",
      ];
      if (sensitive.some((p) => src === p || src.startsWith(`${p}/`))) {
        (mode === "verified" ? errors : warnings).push(`${prefix}host bind mount '${srcRaw}' is not allowed`);
        continue;
      }

      if (mode === "verified" && isAbsolutePathLike(srcRaw)) {
        errors.push(`${prefix}host absolute bind mount '${srcRaw}' is not allowed in verified`);
      }
    }
  }

  return { errors, warnings };
}

function checkRecipeHealthcheckStability({ recipe, mode }) {
  const errors = [];
  const warnings = [];

  const hc = recipe?.ui?.healthcheck || {};
  const path0 = typeof hc.path === "string" ? hc.path.trim() : "";
  const match = typeof hc.match === "string" ? hc.match.trim() : "";

  if (mode === "verified") {
    // Keep it simple and deterministic: "/" must have a match to avoid login/redirect false positives.
    if (path0 === "/" && !match) {
      errors.push("ui.healthcheck.path is '/' but ui.healthcheck.match is missing (verified requires match for '/')");
    }
  } else {
    if (path0 === "/" && !match) warnings.push("ui.healthcheck.path is '/' with no match (may be flaky)");
  }

  return { errors, warnings };
}

function verifyRecipeDirAgainstPolicy({ recipeDir, owner, repo, recipeId, mode }) {
  const errors = [];
  const warnings = [];

  const recipe = readRecipeYaml(recipeDir);
  errors.push(
    ...validateRecipeV0(recipe, {
      expectedId: recipeId,
      expectedOwner: owner,
      expectedRepo: repo,
    }),
  );

  const hcRes = checkRecipeHealthcheckStability({ recipe, mode });
  errors.push(...hcRes.errors);
  warnings.push(...hcRes.warnings);

  const composeFile = recipe?.runtime?.composeFile;
  if (typeof composeFile !== "string" || !composeFile.trim()) {
    errors.push("missing runtime.composeFile");
    return { ok: errors.length === 0, errors, warnings };
  }

  const compose = readComposeYaml(recipeDir, composeFile);
  const sec = checkComposeSecurity({ compose, mode });
  errors.push(...sec.errors);
  warnings.push(...sec.warnings);

  return { ok: errors.length === 0, errors, warnings };
}

function getDefaultRecipesRoot({ recipesDirArg, repoRoot, cwd }) {
  if (recipesDirArg) return path.resolve(recipesDirArg);
  const cwdRecipes = path.join(cwd, "recipes");
  if (cwdRecipes && require("node:fs").existsSync(cwdRecipes)) return cwdRecipes;
  return path.join(repoRoot(), "recipes");
}

module.exports = {
  hasImageDigest,
  checkComposeSecurity,
  checkRecipeHealthcheckStability,
  verifyRecipeDirAgainstPolicy,
  getDefaultRecipesRoot,
};

