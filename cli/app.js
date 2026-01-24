/* eslint-disable no-console */
const { COMMANDS, EXIT } = require("./lib/constants");
const { getArgValue, splitCommand, resolveRepoInput, parseRegistryOptions } = require("./lib/args");
const { resolveContext } = require("./context");
const { usage } = require("./usage");
const { listCommand } = require("./commands/list");
const { doctorCommand } = require("./commands/doctor");
const { verifyRecipesCommand } = require("./commands/verify-recipes");
const { scaffoldCommand, usageScaffold } = require("./commands/scaffold");
const { manageCommand } = require("./commands/manage");
const { runCommand } = require("./commands/run");
const { protocolCommand, usageProtocol } = require("./commands/protocol");

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes("-h") || argv.includes("--help")) {
    usage();
    process.exit(EXIT.OK);
  }

  const { command: rawCommand, args } = splitCommand(argv);
  if (!rawCommand || !COMMANDS.has(rawCommand)) {
    usage();
    process.exit(EXIT.USAGE);
  }

  const legacyList = args.includes("--list");
  const noRun = args.includes("--no-run");
  const noOpen = args.includes("--no-open");
  const requestedRecipeId = getArgValue(args, "--recipe");
  const projectOverride = getArgValue(args, "--project");
  const jsonOutput = args.includes("--json");

  const run = !noRun;
  const open = !noOpen;

  const command = legacyList ? "list" : rawCommand;
  if (command === "protocol") {
    const sub = args[0];
    if (!sub || args.includes("-h") || args.includes("--help")) {
      usageProtocol();
      process.exit(EXIT.OK);
    }
    const code = await protocolCommand({ args });
    process.exit(code);
  }

  if (command === "verify-recipes") {
    console.log(`Command: ${command}`);
    console.log("");
    const code = await verifyRecipesCommand({ args, jsonOutput });
    process.exit(code);
  }

  if (command === "scaffold") {
    const input = resolveRepoInput(args);
    if (!input) {
      usageScaffold();
      process.exit(EXIT.USAGE);
    }
    const code = await scaffoldCommand({ input, args });
    process.exit(code);
  }

  const input = resolveRepoInput(args);
  if (!input) {
    usage();
    process.exit(EXIT.USAGE);
  }

  console.log(`Command: ${command}`);
  console.log("");

  const registryOptions = parseRegistryOptions(args);

  if (command === "list") {
    const code = await listCommand({
      input,
      registryOptions,
      jsonOutput,
      usage,
    });
    process.exit(code);
  }

  let ctx;
  try {
    ctx = await resolveContext(input, requestedRecipeId, projectOverride, registryOptions);
  } catch (e) {
    console.error("Failed to resolve recipe context.");
    console.error(e?.message || String(e));
    process.exit(EXIT.NOT_FOUND);
  }

  const effectiveCommand = noRun ? "print" : command;

  if (effectiveCommand === "doctor") {
    const code = await doctorCommand({
      ctx,
      registryOptions,
      argv,
      jsonOutput,
    });
    process.exit(code);
  }

  if (effectiveCommand === "ps" || effectiveCommand === "logs" || effectiveCommand === "stop" || effectiveCommand === "down") {
    const code = manageCommand({ ctx, args, effectiveCommand });
    process.exit(code);
  }

  const code = await runCommand({ ctx, run, open, effectiveCommand });
  process.exit(code);
}

module.exports = {
  main,
};
