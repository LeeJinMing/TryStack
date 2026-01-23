/* eslint-disable no-console */
const { runComposeCommand, getComposeFilesForManage } = require("../lib/docker");
const { getArgValue } = require("../lib/args");

function manageCommand({ ctx, args, effectiveCommand }) {
  const composeFiles = getComposeFilesForManage(ctx.recipeDir, ctx.composeFile);
  console.log(`Repo: ${ctx.repo.owner}/${ctx.repo.repo}`);
  console.log(`Recipe: ${ctx.recipeId}`);
  console.log(`Recipe dir: ${ctx.recipeDir}`);
  console.log(`Project: ${ctx.projectName}`);
  console.log("");

  let cmdArgs = [];
  if (effectiveCommand === "ps") cmdArgs = ["ps"];
  if (effectiveCommand === "stop") cmdArgs = ["stop"];
  if (effectiveCommand === "down") {
    const volumes = args.includes("--volumes") || args.includes("-v");
    cmdArgs = volumes ? ["down", "-v"] : ["down"];
  }
  if (effectiveCommand === "logs") {
    const tailRaw = getArgValue(args, "--tail");
    const tail = Number(tailRaw ?? 200);
    const follow = args.includes("--follow");
    cmdArgs = ["logs", "--tail", String(Number.isFinite(tail) ? tail : 200)];
    if (follow) cmdArgs.push("--follow");
  }

  return runComposeCommand(ctx.recipeDir, composeFiles, ctx.projectName, cmdArgs);
}

module.exports = {
  manageCommand,
};
