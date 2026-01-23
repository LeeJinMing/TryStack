/* eslint-disable no-console */
const { EXIT } = require("../lib/constants");
const { ensureUiPortAvailable, runCompose, openUrl } = require("../lib/docker");
const { waitForUi } = require("../lib/http");
const { printRunInfo } = require("../lib/print");

async function runCommand({ ctx, run, open, effectiveCommand }) {
  const baseUiUrl = ctx.recipe?.ui?.url || null;
  const shouldRunDocker = effectiveCommand === "up" && run;
  const shouldOpen = effectiveCommand === "up" && open;

  let composeFiles = [ctx.composeFile];
  let uiUrl = baseUiUrl;
  if (shouldRunDocker) {
    const portAdjusted = await ensureUiPortAvailable(ctx.recipeDir, ctx.recipe, ctx.composeFile);
    composeFiles = portAdjusted.composeFiles;
    uiUrl = portAdjusted.uiUrl ?? baseUiUrl;
  }

  const effectiveRecipe = { ...ctx.recipe, ui: { ...(ctx.recipe?.ui || {}), url: uiUrl } };

  const { filesForPrint } = printRunInfo({
    repo: ctx.repo,
    recipeId: ctx.recipeId,
    recipeDir: ctx.recipeDir,
    projectName: ctx.projectName,
    composeFiles,
    uiUrl,
  });

  if (effectiveCommand === "print") return EXIT.OK;

  const code = runCompose(ctx.recipeDir, composeFiles, ctx.projectName);
  if (code !== 0) return code;

  if (uiUrl) {
    console.log("");
    console.log("Waiting for UI to become ready (up to 5 minutes)...");
  }
  const res = await waitForUi(effectiveRecipe);
  if (!res.ok) {
    console.error("");
    console.error("UI did not become ready in time.");
    console.error(`- check: ${res.checkUrl}`);
    console.error(`- expected status: ${res.expectStatus}`);
    if (res.match) console.error(`- expected match: ${res.match}`);
    console.error("");
    console.error("Troubleshoot:");
    console.error(`  cd "${ctx.recipeDir}"`);
    console.error(`  docker compose -p "${ctx.projectName}" ${filesForPrint} ps`);
    console.error(`  docker compose -p "${ctx.projectName}" ${filesForPrint} logs --tail 200`);
    return EXIT.UI_TIMEOUT;
  }
  if (uiUrl) console.log("UI is ready.");

  if (shouldOpen && uiUrl) {
    console.log(`Opening: ${uiUrl}`);
    openUrl(uiUrl);
  }

  return EXIT.OK;
}

module.exports = {
  runCommand,
};
