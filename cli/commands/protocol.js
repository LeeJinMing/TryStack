/* eslint-disable no-console */
const childProcess = require("node:child_process");
const readline = require("node:readline");
const { EXIT } = require("../lib/constants");
const { getArgValue, parseRegistryOptions } = require("../lib/args");
const { parseRepo } = require("../lib/repo");
const { resolveContext } = require("../context");
const { manageCommand } = require("./manage");
const { runCommand } = require("./run");
const { doctorCommand } = require("./doctor");

function usageProtocol() {
  console.log(
    [
      "trystack protocol <install|uninstall|run> [options]",
      "",
      "Windows URL scheme integration for one-click runs from the Portal.",
      "",
      "Install (register trystack:// handler for current user):",
      "  trystack protocol install",
      "  trystack protocol install --scheme trystack",
      "  trystack protocol install --package github:LeeJinMing/TryStack#v0.0.2",
      "  trystack protocol install --dry-run",
      "",
      "Uninstall (remove handler):",
      "  trystack protocol uninstall",
      "",
      "Run (invoked by Windows when clicking a trystack:// link):",
      '  trystack protocol run "trystack://up?repo=louislam/uptime-kuma&recipe=default"',
      "",
      "Options:",
      "  --scheme <name>   URL scheme (default: trystack)",
      "  --package <pkg>   npx package spec used by handler (default: github:LeeJinMing/TryStack#v0.0.2)",
      "  --dry-run         Print what would be changed (install only)",
      "  --yes             Skip confirmation (run only; NOT recommended)",
      "",
    ].join("\n"),
  );
}

function isWindows() {
  return process.platform === "win32";
}

function regExe(args) {
  const res = childProcess.spawnSync("reg", args, { stdio: "inherit", windowsHide: false });
  return res.status ?? 1;
}

function buildWindowsHandlerCommand({ pkg }) {
  const p = String(pkg || "").trim();
  // Use cmd.exe /k so the console stays open after the run finishes.
  // "%1" is substituted by Windows with the clicked URI.
  return `cmd.exe /d /s /k "npx --yes -p ${p} trystack protocol run \\"%1\\""`;
}

function parseProtocolUri(raw) {
  const input = String(raw || "").trim();
  if (!input) return null;

  let u;
  try {
    u = new URL(input);
  } catch {
    // Some shells may pass without slashes: trystack:up?repo=...
    try {
      u = new URL(input.replace(/^([A-Za-z][A-Za-z0-9+\-.]*):/, "$1://"));
    } catch {
      return null;
    }
  }

  const scheme = (u.protocol || "").replace(/:$/, "");
  const action = (u.hostname || "").trim() || (u.pathname || "").replace(/^\//, "").split("/")[0] || "";
  const repoRaw = u.searchParams.get("repo") || "";
  const recipeId = u.searchParams.get("recipe") || "";
  const noOpen = u.searchParams.get("noOpen") === "1" || u.searchParams.get("open") === "0";
  const noRun = u.searchParams.get("noRun") === "1" || u.searchParams.get("run") === "0";
  const project = u.searchParams.get("project") || "";
  const preferRegistry = u.searchParams.get("preferRegistry") === "1";
  const json = u.searchParams.get("json") === "1";
  const registry = u.searchParams.get("registry") || "";
  const registryRef = u.searchParams.get("registryRef") || "";
  const cacheDir = u.searchParams.get("cacheDir") || "";

  return {
    raw: input,
    scheme,
    action,
    repoRaw,
    recipeId,
    noOpen,
    noRun,
    project,
    preferRegistry,
    json,
    registry,
    registryRef,
    cacheDir,
  };
}

function hasControlChars(s) {
  return /[\u0000-\u001F\u007F]/.test(String(s || ""));
}

function isSafeSegment(s, maxLen = 80) {
  const v = String(s || "");
  return v.length > 0 && v.length <= maxLen && /^[A-Za-z0-9_.-]+$/.test(v);
}

function isSafeRef(s, maxLen = 128) {
  const v = String(s || "");
  // Allow typical git refs: main, feature/x, tags/v1.2.3
  return v.length > 0 && v.length <= maxLen && /^[A-Za-z0-9_.\-/]+$/.test(v);
}

async function promptYesNo(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await new Promise((resolve) => rl.question(question, resolve));
    const s = String(answer || "").trim().toLowerCase();
    return s === "y" || s === "yes";
  } finally {
    rl.close();
  }
}

async function protocolInstall({ args }) {
  if (!isWindows()) {
    console.error("protocol install is only supported on Windows.");
    return EXIT.USAGE;
  }

  const scheme = (getArgValue(args, "--scheme") || "trystack").trim();
  const pkg = (getArgValue(args, "--package") || "github:LeeJinMing/TryStack#v0.0.2").trim();
  const dryRun = args.includes("--dry-run");
  if (!scheme || !/^[a-zA-Z][a-zA-Z0-9+\-.]*$/.test(scheme)) {
    console.error(`Invalid --scheme: ${scheme}`);
    return EXIT.USAGE;
  }
  if (!pkg) {
    console.error("Missing --package");
    return EXIT.USAGE;
  }

  const baseKey = `HKCU\\Software\\Classes\\${scheme}`;
  const cmd = buildWindowsHandlerCommand({ pkg });

  console.log("TryStack protocol install (current user):");
  console.log(`- scheme: ${scheme}://`);
  console.log(`- handler: ${cmd}`);
  console.log("");

  if (dryRun) {
    console.log("Dry-run. Would run:");
    console.log(`- reg add "${baseKey}" /ve /d "URL:TryStack Protocol" /f`);
    console.log(`- reg add "${baseKey}" /v "URL Protocol" /d "" /f`);
    console.log(`- reg add "${baseKey}\\shell\\open\\command" /ve /d "${cmd}" /f`);
    return EXIT.OK;
  }

  let code = 0;
  code ||= regExe(["add", baseKey, "/ve", "/d", "URL:TryStack Protocol", "/f"]);
  code ||= regExe(["add", baseKey, "/v", "URL Protocol", "/d", "", "/f"]);
  code ||= regExe(["add", `${baseKey}\\shell\\open\\command`, "/ve", "/d", cmd, "/f"]);
  if (code !== 0) return code;

  console.log("");
  console.log("Installed.");
  console.log("Test:");
  console.log(`  start "" "${scheme}://up?repo=louislam/uptime-kuma&recipe=default"`);
  console.log("");
  return EXIT.OK;
}

async function protocolUninstall({ args }) {
  if (!isWindows()) {
    console.error("protocol uninstall is only supported on Windows.");
    return EXIT.USAGE;
  }
  const scheme = (getArgValue(args, "--scheme") || "trystack").trim();
  if (!scheme || !/^[a-zA-Z][a-zA-Z0-9+\-.]*$/.test(scheme)) {
    console.error(`Invalid --scheme: ${scheme}`);
    return EXIT.USAGE;
  }
  const baseKey = `HKCU\\Software\\Classes\\${scheme}`;
  const code = regExe(["delete", baseKey, "/f"]);
  if (code !== 0) return code;
  console.log("Uninstalled.");
  return EXIT.OK;
}

async function protocolRun({ args }) {
  const rawUri = args.find((a) => !a.startsWith("-")) || null;
  if (!rawUri) {
    console.error("Missing URI.");
    usageProtocol();
    return EXIT.USAGE;
  }

  if (String(rawUri).length > 2048 || hasControlChars(rawUri)) {
    console.error("Invalid URI (too long or contains control characters).");
    return EXIT.USAGE;
  }

  const yes = args.includes("--yes");
  const parsed = parseProtocolUri(rawUri);
  if (!parsed) {
    console.error(`Invalid URI: ${rawUri}`);
    return EXIT.USAGE;
  }

  if (String(parsed.repoRaw || "").length > 200 || hasControlChars(parsed.repoRaw)) {
    console.error("Invalid repo parameter.");
    return EXIT.USAGE;
  }

  if (parsed.recipeId && !isSafeSegment(parsed.recipeId, 80)) {
    console.error(`Invalid recipe parameter: ${parsed.recipeId}`);
    return EXIT.USAGE;
  }

  if (parsed.project && (!isSafeSegment(parsed.project, 60) || parsed.project.toLowerCase().startsWith("docker"))) {
    console.error(`Invalid project parameter: ${parsed.project}`);
    return EXIT.USAGE;
  }

  if (parsed.registry && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(parsed.registry)) {
    console.error(`Invalid registry parameter: ${parsed.registry}`);
    return EXIT.USAGE;
  }

  if (parsed.registryRef && !isSafeRef(parsed.registryRef, 128)) {
    console.error(`Invalid registryRef parameter: ${parsed.registryRef}`);
    return EXIT.USAGE;
  }

  const repo = parseRepo(parsed.repoRaw);
  if (!repo) {
    console.error(`Invalid repo: ${parsed.repoRaw}`);
    return EXIT.USAGE;
  }

  const action = (parsed.action || "up").toLowerCase();
  const allowed = new Set(["up", "print", "doctor", "ps", "logs", "stop", "down"]);
  if (!allowed.has(action)) {
    console.error(`Unsupported action: ${action}`);
    console.error(`Supported: ${Array.from(allowed).join(", ")}`);
    return EXIT.USAGE;
  }

  // Build a compatible args array so we can reuse existing parsers consistently.
  const forwardedArgs = [];
  if (parsed.recipeId) forwardedArgs.push("--recipe", parsed.recipeId);
  if (parsed.project) forwardedArgs.push("--project", parsed.project);
  if (parsed.cacheDir) {
    // Intentionally not supported via URL for safety.
    console.error("Warning: cacheDir is ignored when provided via trystack:// URI.");
  }
  if (parsed.registry) forwardedArgs.push("--registry", parsed.registry);
  if (parsed.registryRef) forwardedArgs.push("--registry-ref", parsed.registryRef);
  if (parsed.preferRegistry) forwardedArgs.push("--prefer-registry");
  const jsonOutput = Boolean(parsed.json);
  if (jsonOutput) forwardedArgs.push("--json");

  const registryOptions = parseRegistryOptions(forwardedArgs);

  const ctx = await resolveContext(
    `${repo.owner}/${repo.repo}`,
    parsed.recipeId || null,
    parsed.project || null,
    registryOptions,
  );

  const summary = `action=${action} repo=${repo.owner}/${repo.repo} recipe=${ctx.recipeId} run=${
    parsed.noRun ? "0" : "1"
  } open=${parsed.noOpen ? "0" : "1"}${action === "doctor" ? ` json=${jsonOutput ? "1" : "0"}` : ""}`;

  console.log("TryStack one-click request:");
  console.log(`- uri: ${parsed.raw}`);
  console.log(`- action: ${action}`);
  console.log(`- repo: ${repo.owner}/${repo.repo}`);
  console.log(`- recipe: ${ctx.recipeId}`);
  console.log(`- run: ${parsed.noRun ? "no" : "yes"}`);
  console.log(`- open: ${parsed.noOpen ? "no" : "yes"}`);
  if (action === "doctor") console.log(`- json: ${jsonOutput ? "yes" : "no"}`);
  console.log(`- summary: ${summary}`);
  console.log("");

  if (!yes) {
    // If no TTY (rare for protocol), default to NO for safety.
    if (!process.stdin.isTTY) {
      console.error("No TTY available. Refusing to run without --yes.");
      return EXIT.USAGE;
    }
    const ok = await promptYesNo("Proceed? (y/N) ");
    if (!ok) {
      console.log("Cancelled.");
      return EXIT.OK;
    }
  }

  if (action === "doctor") {
    return await doctorCommand({
      ctx,
      registryOptions,
      argv: forwardedArgs,
      jsonOutput,
    });
  }

  if (action === "ps" || action === "logs" || action === "stop" || action === "down") {
    return manageCommand({ ctx, args: forwardedArgs, effectiveCommand: action });
  }

  const run = !parsed.noRun && action === "up";
  const open = !parsed.noOpen && action === "up";
  return await runCommand({ ctx, run, open, effectiveCommand: action });
}

async function protocolCommand({ args }) {
  const sub = String(args[0] || "").trim().toLowerCase();
  const rest = args.slice(1);
  if (!sub) {
    usageProtocol();
    return EXIT.USAGE;
  }
  if (sub === "install") return await protocolInstall({ args: rest });
  if (sub === "uninstall") return await protocolUninstall({ args: rest });
  if (sub === "run") return await protocolRun({ args: rest });
  usageProtocol();
  return EXIT.USAGE;
}

module.exports = {
  usageProtocol,
  protocolCommand,
};

