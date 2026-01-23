const path = require("node:path");
const os = require("node:os");
const { COMMANDS, DEFAULT_REGISTRY, EXIT } = require("./constants");
const { parseOwnerRepo } = require("./repo");

function getArgValue(args, name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}

function resolveCacheDir(args) {
  const override = getArgValue(args, "--cache-dir");
  if (override) return path.resolve(override);
  return path.join(os.homedir(), ".githubui-cache");
}

function splitCommand(argv) {
  if (argv.length === 0) return { command: null, args: [] };
  const first = argv[0];
  if (COMMANDS.has(first)) return { command: first, args: argv.slice(1) };
  return { command: "up", args: argv };
}

function resolveRepoInput(args) {
  return args.find((a) => !a.startsWith("-")) || null;
}

function parseRegistryOptions(args) {
  const cacheDir = resolveCacheDir(args);
  const regRaw = getArgValue(args, "--registry");
  const preferRegistry = args.includes("--prefer-registry");
  if (!regRaw) return { cacheDir, registry: DEFAULT_REGISTRY, preferRegistry };
  const parsed = parseOwnerRepo(regRaw);
  if (!parsed) {
    console.error(`Invalid --registry value (expected owner/repo): ${regRaw}`);
    process.exit(EXIT.USAGE);
  }
  const ref = getArgValue(args, "--registry-ref") || "main";
  return { cacheDir, registry: { owner: parsed.owner, repo: parsed.repo, ref }, preferRegistry };
}

module.exports = {
  getArgValue,
  resolveCacheDir,
  splitCommand,
  resolveRepoInput,
  parseRegistryOptions,
};
