/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const { EXIT } = require("../lib/constants");
const { resolveCacheDir } = require("../lib/args");
const { validateRecipe, getMissingEnv } = require("../lib/recipe");
const {
  getCommandOutput,
  dockerExists,
  composeExists,
  runComposeCommandCapture,
  getComposeFilesForManage,
  parseComposePsJson,
  hasRunningFromPsJson,
  hasRunningFromPsText,
} = require("../lib/docker");
const { httpGet } = require("../lib/http");

async function doctorCommand({ ctx, registryOptions, argv, jsonOutput }) {
  const composeFiles = getComposeFilesForManage(ctx.recipeDir, ctx.composeFile);
  const uiUrl = ctx.recipe?.ui?.url || null;
  const recipeErrors = validateRecipe(ctx.recipe);
  const dockerVersion = getCommandOutput("docker", ["--version"]);
  const composeVersion = getCommandOutput("docker", ["compose", "version"]);
  const hc = ctx.recipe?.ui?.healthcheck || {};
  const hcPath = (hc.path || "/").toString();
  const hcMethod = (hc.method || "GET").toString();
  const hcStatus = Number(hc.expectStatus ?? 200);
  const hcMatch = (hc.match || "").toString();
  const ports = Array.isArray(ctx.recipe?.ports) ? ctx.recipe.ports : [];
  const envRequired = Array.isArray(ctx.recipe?.env?.required) ? ctx.recipe.env.required : [];
  const envOptional = Array.isArray(ctx.recipe?.env?.optional) ? ctx.recipe.env.optional : [];
  const missingEnv = getMissingEnv(envRequired);
  let exitCode = EXIT.OK;
  const doctorJson = {
    repo: `${ctx.repo.owner}/${ctx.repo.repo}`,
    recipeId: ctx.recipeId,
    recipeDir: ctx.recipeDir,
    projectName: ctx.projectName,
    source: ctx.source,
    cacheDir: ctx.cacheDir || resolveCacheDir(argv),
    registry: ctx.registry ? `${ctx.registry.owner}/${ctx.registry.repo}@${ctx.registry.ref}` : null,
    preferRegistry: registryOptions.preferRegistry,
    uiUrl: uiUrl,
    environment: {
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      docker: dockerExists() ? "ok" : "missing",
      dockerVersion,
      compose: composeExists() ? "ok" : "missing",
      composeVersion,
    },
    recipe: {
      recipeYaml: fs.existsSync(path.join(ctx.recipeDir, "recipe.yaml")) ? "ok" : "missing",
      composeFile: fs.existsSync(path.join(ctx.recipeDir, ctx.composeFile)) ? "ok" : "missing",
      override: fs.existsSync(path.join(ctx.recipeDir, ".githubui.override.yaml")) ? "present" : "absent",
      validationErrors: recipeErrors,
    },
    checks: {
      healthcheck: {
        method: hcMethod,
        path: hcPath,
        expectStatus: Number.isFinite(hcStatus) ? hcStatus : 200,
        match: hcMatch || null,
      },
      portsCount: ports.length,
      envRequired,
      envOptional,
      envMissing: missingEnv,
    },
    composeConfig: null,
    ps: null,
    precheck: null,
  };

  if (!jsonOutput) {
    console.log(`Repo: ${ctx.repo.owner}/${ctx.repo.repo}`);
    console.log(`Recipe: ${ctx.recipeId}`);
    console.log(`Recipe dir: ${ctx.recipeDir}`);
    console.log(`Project: ${ctx.projectName}`);
    console.log(`Source: ${ctx.source}`);
    console.log(`Cache dir: ${ctx.cacheDir || resolveCacheDir(argv)}`);
    if (ctx.registry) {
      console.log(`Registry: ${ctx.registry.owner}/${ctx.registry.repo}@${ctx.registry.ref}`);
      console.log(`Prefer registry: ${registryOptions.preferRegistry ? "yes" : "no"}`);
    }
    if (uiUrl) console.log(`UI: ${uiUrl}`);
    console.log("");

    console.log("Environment:");
    console.log(`- node: ${process.version}`);
    console.log(`- platform: ${process.platform} ${process.arch}`);
    console.log(`- docker: ${dockerExists() ? "ok" : "missing"}${dockerVersion ? ` (${dockerVersion})` : ""}`);
    console.log(
      `- docker compose: ${composeExists() ? "ok" : "missing"}${composeVersion ? ` (${composeVersion})` : ""}`,
    );
    console.log("");

    console.log("Recipe:");
    console.log(`- recipe.yaml: ${doctorJson.recipe.recipeYaml}`);
    console.log(`- compose file (${ctx.composeFile}): ${doctorJson.recipe.composeFile}`);
    console.log(`- override (.githubui.override.yaml): ${doctorJson.recipe.override}`);
    if (recipeErrors.length > 0) {
      console.log("- recipe validation: failed");
      for (const err of recipeErrors) console.log(`  - ${err}`);
    } else {
      console.log("- recipe validation: ok");
    }
    console.log(
      `- ui.healthcheck: ${hcMethod} ${hcPath} expect ${Number.isFinite(hcStatus) ? hcStatus : 200}${
        hcMatch ? ` match "${hcMatch}"` : ""
      }`,
    );
    console.log(`- ports: ${ports.length > 0 ? ports.length : "none"}`);
    if (envRequired.length > 0) console.log(`- env.required: ${envRequired.join(", ")}`);
    if (envOptional.length > 0) console.log(`- env.optional: ${envOptional.join(", ")}`);
    if (missingEnv.length > 0) console.log(`- env.missing: ${missingEnv.join(", ")}`);
    console.log("");
  }

  if (recipeErrors.length > 0) exitCode = EXIT.RECIPE_INVALID;
  if (!dockerExists() || !composeExists()) exitCode = EXIT.DOCKER_MISSING;

  if (exitCode === EXIT.OK || exitCode === EXIT.ENV_MISSING) {
    if (!jsonOutput) console.log("docker compose config:");
    const cfgRes = runComposeCommandCapture(ctx.recipeDir, composeFiles, ctx.projectName, ["config"]);
    doctorJson.composeConfig = {
      ok: cfgRes.status === 0,
      exitCode: cfgRes.status ?? 1,
    };
    if (cfgRes.stderr.trim() && !jsonOutput) process.stderr.write(cfgRes.stderr);
    if (cfgRes.status !== 0) {
      if (!jsonOutput) {
        console.log("");
        console.log("Compose config validation failed.");
        console.log("Troubleshoot:");
        console.log(`  cd "${ctx.recipeDir}"`);
        console.log(
          `  docker compose -p "${ctx.projectName}" ${composeFiles.map((f) => `-f "${f}"`).join(" ")} config`,
        );
      }
      exitCode = cfgRes.status ?? 1;
    }
    if (!jsonOutput) {
      if (cfgRes.status === 0) console.log("config ok");
      console.log("");
    }
  }

  if (!jsonOutput) console.log("docker compose ps:");
  const psRes = runComposeCommandCapture(ctx.recipeDir, composeFiles, ctx.projectName, ["ps"]);
  if (psRes.stdout.trim()) process.stdout.write(psRes.stdout);
  if (psRes.stderr.trim()) process.stderr.write(psRes.stderr);
  if (psRes.status !== 0) {
    console.log("");
    console.log("Troubleshoot:");
    console.log(`  cd "${ctx.recipeDir}"`);
    console.log(
      `  docker compose -p "${ctx.projectName}" ${composeFiles.map((f) => `-f "${f}"`).join(" ")} ps`,
    );
    exitCode = psRes.status ?? 1;
  }

  const psJsonRes = runComposeCommandCapture(ctx.recipeDir, composeFiles, ctx.projectName, [
    "ps",
    "--format",
    "json",
  ]);
  const psRows = psJsonRes.status === 0 ? parseComposePsJson(psJsonRes.stdout) : null;
  const running = psRows ? hasRunningFromPsJson(psRows) : hasRunningFromPsText(psRes.stdout);
  doctorJson.ps = {
    ok: psRes.status === 0,
    running,
    services: psRows,
  };

  if (running && uiUrl) {
    const checkUrl = new URL(uiUrl);
    const basePath = checkUrl.pathname.endsWith("/") ? checkUrl.pathname.slice(0, -1) : checkUrl.pathname;
    const hcPathSafe = hcPath.startsWith("/") ? hcPath : `/${hcPath}`;
    checkUrl.pathname = `${basePath}${hcPathSafe}` || "/";
    const res = await httpGet(checkUrl.toString());
    const statusOk = res.status === (Number.isFinite(hcStatus) ? hcStatus : 200);
    const matchOk = !hcMatch || (res.body || "").toLowerCase().includes(hcMatch.toLowerCase());
    const ok = statusOk && matchOk;
    doctorJson.precheck = {
      ok,
      status: res.status || 0,
      matchOk,
      url: checkUrl.toString(),
    };
    if (!jsonOutput) {
      console.log(
        `Precheck: ${ok ? "ok" : "fail"} (status=${res.status || 0}${
          hcMatch ? `, match=${matchOk ? "ok" : "missing"}` : ""
        })`,
      );
      if (!ok) console.log(`- check: ${checkUrl.toString()}`);
      console.log("");
    }
  } else {
    doctorJson.precheck = {
      ok: null,
      status: null,
      matchOk: null,
      url: uiUrl ? new URL(uiUrl).toString() : null,
      skipped: !running,
    };
    if (!jsonOutput && uiUrl && !running) {
      console.log("Precheck: skipped (no running services)");
      console.log("");
    }
  }

  const uiPort = ports.find((p) => p && (p.name === "ui" || p.protocol === "http")) || null;
  if (uiPort?.service && uiPort?.containerPort) {
    const portRes = runComposeCommandCapture(ctx.recipeDir, composeFiles, ctx.projectName, [
      "port",
      uiPort.service,
      String(uiPort.containerPort),
    ]);
    const line = portRes.stdout.trim();
    if (line && !jsonOutput) {
      console.log("");
      console.log(`docker compose port ${uiPort.service} ${uiPort.containerPort}: ${line}`);
    }
    doctorJson.portMapping = line || null;
  }

  if (missingEnv.length > 0 && exitCode === EXIT.OK) exitCode = EXIT.ENV_MISSING;

  if (jsonOutput) {
    console.log(JSON.stringify(doctorJson, null, 2));
  } else {
    console.log("");
  }

  return exitCode;
}

module.exports = {
  doctorCommand,
};
