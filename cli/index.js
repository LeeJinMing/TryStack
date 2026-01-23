#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const os = require("node:os");
const zlib = require("node:zlib");
const YAML = require("yaml");

const COMMANDS = new Set(["up", "ps", "logs", "stop", "down", "list", "print", "doctor"]);
const DEFAULT_REGISTRY = { owner: "LeeJinMing", repo: "TryStack", ref: "main" };

function usage() {
  console.log(
    [
      "githubui-try [command] <owner/repo|repo-url> [options]",
      "",
      "Examples:",
      "  githubui-try up louislam/uptime-kuma",
      "  githubui-try ps louislam/uptime-kuma",
      "  githubui-try logs louislam/uptime-kuma --tail 200",
      "  githubui-try down louislam/uptime-kuma",
      "  githubui-try list louislam/uptime-kuma",
      "",
      "Back-compat (still works):",
      "  githubui-try louislam/uptime-kuma",
      "  githubui-try louislam/uptime-kuma --list",
      "",
      "Commands:",
      "  up     Start with docker compose up -d (default)",
      "  ps     Show docker compose ps",
      "  logs   Show docker compose logs (supports --tail N, --follow)",
      "  stop   Stop services (docker compose stop)",
      "  down   Stop and remove resources (docker compose down)",
      "  list   List available recipeIds for this repo",
      "  print  Print instructions only (no docker)",
      "  doctor Diagnose environment and project status",
      "",
      "Options:",
      "  --recipe <id>   Choose recipeId (default: prefer 'default')",
      "  --project <name> Override docker compose project name",
      `  --registry <owner/repo>   Fetch recipes from a GitHub registry repo (default: ${DEFAULT_REGISTRY.owner}/${DEFAULT_REGISTRY.repo})`,
      "  --registry-ref <ref>      Git ref for registry (default: main)",
      "  --cache-dir <path>        Cache directory for downloaded recipes (default: ~/.githubui-cache)",
      "  --prefer-registry         Prefer registry recipes even if local exists (useful for validating remote)",
      "  --no-run        Print instructions only (do not run docker)",
      "  --no-open       Do not open the UI in browser",
      "  --run           (legacy) same as default behavior",
      "  --open          (legacy) same as default behavior",
      "",
    ].join("\n"),
  );
}

function parseRepo(input) {
  // owner/repo
  const m1 = input.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (m1) return { owner: m1[1], repo: m1[2] };

  // https://github.com/owner/repo(.git)?
  const m2 = input.match(
    /^https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?\/?$/,
  );
  if (m2) return { owner: m2[1], repo: m2[2] };

  // git@github.com:owner/repo(.git)?
  const m3 = input.match(
    /^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?$/,
  );
  if (m3) return { owner: m3[1], repo: m3[2] };

  return null;
}

function repoRoot() {
  // cli/ is at repoRoot/cli
  return path.resolve(__dirname, "..");
}

function listRecipeIds(repoDir) {
  if (!fs.existsSync(repoDir)) return [];
  return fs
    .readdirSync(repoDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function pickRecipeId(recipeIds) {
  if (recipeIds.includes("default")) return "default";
  return recipeIds.sort()[0] || null;
}

function getArgValue(args, name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}

function parseOwnerRepo(input) {
  const m = (input || "").match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

function resolveCacheDir(args) {
  const override = getArgValue(args, "--cache-dir");
  if (override) return path.resolve(override);
  return path.join(os.homedir(), ".githubui-cache");
}

function sanitizeProjectName(name) {
  // docker compose project name: lowercase alnum + _- are safe
  const s = name.toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  // keep it reasonably short
  return s.length > 50 ? s.slice(0, 50) : s;
}

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

function openUrl(url) {
  const platform = process.platform;
  if (platform === "win32") {
    spawnSync("cmd", ["/c", "start", "", url], { stdio: "ignore" });
  } else if (platform === "darwin") {
    spawnSync("open", [url], { stdio: "ignore" });
  } else {
    spawnSync("xdg-open", [url], { stdio: "ignore" });
  }
}

function dockerExists() {
  const r = spawnSync("docker", ["--version"], { stdio: "ignore" });
  return r.status === 0;
}

function composeExists() {
  const r = spawnSync("docker", ["compose", "version"], { stdio: "ignore" });
  return r.status === 0;
}

function runCompose(recipeDir, composeFiles, projectName) {
  if (!dockerExists()) {
    console.error("docker not found. Please install Docker Desktop first.");
    return 127;
  }

  if (!composeExists()) {
    console.error("docker compose not available. Please update Docker.");
    return 127;
  }

  const fileArgs = [];
  for (const f of composeFiles) fileArgs.push("-f", f);

  const r = spawnSync(
    "docker",
    ["compose", "-p", projectName, ...fileArgs, "up", "-d", "--remove-orphans"],
    { cwd: recipeDir, stdio: "inherit" },
  );
  return r.status ?? 1;
}

function runComposeCommand(recipeDir, composeFiles, projectName, cmdArgs) {
  if (!dockerExists()) {
    console.error("docker not found. Please install Docker Desktop first.");
    return 127;
  }

  if (!composeExists()) {
    console.error("docker compose not available. Please update Docker.");
    return 127;
  }

  const fileArgs = [];
  for (const f of composeFiles) fileArgs.push("-f", f);

  const r = spawnSync("docker", ["compose", "-p", projectName, ...fileArgs, ...cmdArgs], {
    cwd: recipeDir,
    stdio: "inherit",
  });
  return r.status ?? 1;
}

function runComposeCommandCapture(recipeDir, composeFiles, projectName, cmdArgs) {
  if (!dockerExists()) {
    return { status: 127, stdout: "", stderr: "docker not found. Please install Docker Desktop first.\n" };
  }

  if (!composeExists()) {
    return { status: 127, stdout: "", stderr: "docker compose not available. Please update Docker.\n" };
  }

  const fileArgs = [];
  for (const f of composeFiles) fileArgs.push("-f", f);

  const r = spawnSync("docker", ["compose", "-p", projectName, ...fileArgs, ...cmdArgs], {
    cwd: recipeDir,
    encoding: "utf8",
  });

  return { status: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
}

function getComposeFilesForManage(recipeDir, composeFile) {
  const files = [composeFile];
  const override = path.join(recipeDir, ".githubui.override.yaml");
  if (fs.existsSync(override)) files.push(".githubui.override.yaml");
  return files;
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(false));
    server.listen({ port, host: "0.0.0.0" }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function ensureUiPortAvailable(recipeDir, recipe, composeFile) {
  const ports = Array.isArray(recipe?.ports) ? recipe.ports : [];
  const uiPort = ports.find((p) => p && (p.name === "ui" || p.protocol === "http")) || null;
  if (!uiPort || !uiPort.hostPort || !uiPort.containerPort) {
    return { composeFiles: [composeFile], uiUrl: recipe?.ui?.url || null };
  }

  const requestedHostPort = Number(uiPort.hostPort);
  const containerPort = Number(uiPort.containerPort);
  if (!Number.isFinite(requestedHostPort) || !Number.isFinite(containerPort)) {
    return { composeFiles: [composeFile], uiUrl: recipe?.ui?.url || null };
  }

  const free = await isPortFree(requestedHostPort);
  if (free) return { composeFiles: [composeFile], uiUrl: recipe?.ui?.url || null };

  // Find a nearby free port to avoid failure.
  let chosen = null;
  for (let p = requestedHostPort + 1; p <= requestedHostPort + 50; p += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(p)) {
      chosen = p;
      break;
    }
  }

  if (!chosen) {
    console.error(`Port ${requestedHostPort} is already in use and no free port found nearby.`);
    console.error("Try stopping the other service or choose a different port.");
    process.exit(4);
  }

  // Create a compose override to remap ports for the target service.
  const compose = readComposeYaml(recipeDir, composeFile);
  const services = compose?.services && typeof compose.services === "object" ? compose.services : {};
  const serviceName =
    (uiPort.service && typeof uiPort.service === "string" && uiPort.service.trim()) ||
    Object.keys(services)[0];
  if (!serviceName) {
    return { composeFiles: [composeFile], uiUrl: recipe?.ui?.url || null };
  }
  if (!services[serviceName]) {
    console.warn(
      `ports[].service '${serviceName}' not found in compose services; falling back to first service.`,
    );
    const fallback = Object.keys(services)[0];
    if (!fallback) return { composeFiles: [composeFile], uiUrl: recipe?.ui?.url || null };
    // eslint-disable-next-line no-param-reassign
    uiPort.service = fallback;
  }

  const override = {
    services: {
      [uiPort.service || serviceName]: {
        ports: [`${chosen}:${containerPort}`],
      },
    },
  };

  const overrideFile = ".githubui.override.yaml";
  fs.writeFileSync(path.join(recipeDir, overrideFile), YAML.stringify(override), "utf8");

  const baseUrl = recipe?.ui?.url || `http://localhost:${requestedHostPort}`;
  const u = new URL(baseUrl);
  u.port = String(chosen);

  console.warn(`Port ${requestedHostPort} is in use; using ${chosen} instead.`);
  return { composeFiles: [composeFile, overrideFile], uiUrl: u.toString().replace(/\/$/, "") };
}

function isRedirectStatus(status) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function httpGet(url, extraHeaders = null) {
  const doRequest = (u, overrideHostname) =>
    new Promise((resolve) => {
      const hostname = overrideHostname || u.hostname;
      const lib = u.protocol === "https:" ? https : http;
      const req = lib.request(
        {
          protocol: u.protocol,
          hostname,
          port: u.port,
          path: u.pathname + u.search,
          method: "GET",
          timeout: 5000,
          // On Windows, "localhost" may resolve to ::1 first; Docker published ports
          // are often bound on IPv4. Prefer IPv4 to avoid false "connection refused".
          family: hostname === "localhost" ? 4 : undefined,
          headers: {
            "User-Agent": "githubui-try",
            "Accept-Encoding": "identity",
            ...(extraHeaders && typeof extraHeaders === "object" ? extraHeaders : {}),
          },
        },
        (res) => {
          const chunks = [];
          let total = 0;
          const location = (res.headers.location || "").toString();

          res.on("data", (chunk) => {
            const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            chunks.push(b);
            total += b.length;
            if (total > 1024 * 1024) {
              res.destroy();
            }
          });

          res.on("end", () => {
            const status = res.statusCode || 0;
            const encoding = (res.headers["content-encoding"] || "").toString().toLowerCase();
            const buf = Buffer.concat(chunks);

            try {
              let decoded = buf;
              if (encoding === "gzip") decoded = zlib.gunzipSync(buf);
              else if (encoding === "deflate") decoded = zlib.inflateSync(buf);
              else if (encoding === "br") decoded = zlib.brotliDecompressSync(buf);

              const body = decoded.toString("utf8");
              resolve({ status, body, location, headers: res.headers });
            } catch {
              resolve({ status, body: buf.toString("utf8"), location, headers: res.headers });
            }
          });
        },
      );
      req.on("timeout", () => {
        req.destroy();
        resolve({ status: 0, body: "" });
      });
      req.on("error", () => resolve({ status: 0, body: "" }));
      req.end();
    });

  const u = new URL(url);
  const getOnce = async () => {
    const res = await doRequest(u);
    if (res.status !== 0) return res;
    if (u.hostname === "localhost") return doRequest(u, "127.0.0.1");
    return res;
  };

  const getWithRedirects = async (maxRedirects = 5) => {
    let currentUrl = u.toString();
    for (let i = 0; i <= maxRedirects; i += 1) {
      const cur = new URL(currentUrl);
      const r = await doRequest(cur);
      if (r.status === 0 && cur.hostname === "localhost") {
        // retry once with IPv4 loopback
        const r2 = await doRequest(cur, "127.0.0.1");
        if (!isRedirectStatus(r2.status)) return r2;
        if (!r2.location) return r2;
        currentUrl = new URL(r2.location, cur).toString();
        continue;
      }

      if (!isRedirectStatus(r.status)) return r;
      if (!r.location) return r;
      currentUrl = new URL(r.location, cur).toString();
    }
    return getOnce();
  };

  return getWithRedirects();
}

async function waitForUi(recipe) {
  const uiUrl = recipe?.ui?.url;
  if (!uiUrl) return { ok: true, url: null };

  const pathPart = recipe?.ui?.healthcheck?.path || "/";
  const expectStatus = Number(recipe?.ui?.healthcheck?.expectStatus ?? 200);
  const match = (recipe?.ui?.healthcheck?.match || "").toString();

  const checkUrl = new URL(uiUrl);
  // join path safely
  const basePath = checkUrl.pathname.endsWith("/") ? checkUrl.pathname.slice(0, -1) : checkUrl.pathname;
  const hcPath = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  checkUrl.pathname = `${basePath}${hcPath}` || "/";

  const deadline = Date.now() + 5 * 60 * 1000; // 5 minutes
  while (Date.now() < deadline) {
    const { status, body } = await httpGet(checkUrl.toString());
    if (status === expectStatus) {
      if (!match || body.toLowerCase().includes(match.toLowerCase())) {
        return { ok: true, url: uiUrl };
      }
    }
    // 2s cadence keeps it responsive without hammering
    await new Promise((r) => setTimeout(r, 2000));
  }

  return { ok: false, url: uiUrl, checkUrl: checkUrl.toString(), expectStatus, match };
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

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeFileIfChanged(p, content) {
  if (fs.existsSync(p)) {
    const prev = fs.readFileSync(p, "utf8");
    if (prev === content) return;
  }
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content, "utf8");
}

async function githubApiGetJson(url) {
  const { status, body } = await httpGet(url, {
    Accept: "application/vnd.github+json",
    "User-Agent": "githubui-try",
  });
  if (status !== 200) {
    const snippet = (body || "").slice(0, 400);
    throw new Error(`GitHub API request failed (${status}) for ${url}\n${snippet}`);
  }
  return JSON.parse(body);
}

async function githubDownloadText(url) {
  const { status, body } = await httpGet(url, { "User-Agent": "githubui-try" });
  if (status !== 200) {
    const snippet = (body || "").slice(0, 200);
    throw new Error(`Download failed (${status}) for ${url}\n${snippet}`);
  }
  return body;
}

function encodeGithubPath(p) {
  return (p || "")
    .split("/")
    .filter((s) => s.length > 0)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

async function listRecipeIdsFromGithubRegistry(registry, target) {
  const { owner: ro, repo: rr, ref } = registry;
  const p = `recipes/${target.owner}/${target.repo}`;
  const url = `https://api.github.com/repos/${ro}/${rr}/contents/${encodeGithubPath(p)}?ref=${encodeURIComponent(ref)}`;
  const items = await githubApiGetJson(url);
  if (!Array.isArray(items)) return [];
  return items.filter((it) => it && it.type === "dir").map((it) => it.name).filter(Boolean);
}

async function fetchRecipeDirFromGithubRegistry({ registry, target, recipeId, cacheDir }) {
  const { owner: ro, repo: rr, ref } = registry;
  const basePath = `recipes/${target.owner}/${target.repo}/${recipeId}`;
  const localDir = path.join(cacheDir, "recipes", target.owner, target.repo, recipeId);

  // recipe.yaml
  const recipeMetaUrl = `https://api.github.com/repos/${ro}/${rr}/contents/${encodeGithubPath(`${basePath}/recipe.yaml`)}?ref=${encodeURIComponent(ref)}`;
  const recipeMeta = await githubApiGetJson(recipeMetaUrl);
  const recipeYaml = await githubDownloadText(recipeMeta.download_url);
  writeFileIfChanged(path.join(localDir, "recipe.yaml"), recipeYaml);

  const recipe = YAML.parse(recipeYaml);
  const composeFile = recipe?.runtime?.composeFile || "compose.yaml";

  // compose file
  const composeMetaUrl = `https://api.github.com/repos/${ro}/${rr}/contents/${encodeGithubPath(`${basePath}/${composeFile}`)}?ref=${encodeURIComponent(ref)}`;
  const composeMeta = await githubApiGetJson(composeMetaUrl);
  const composeYaml = await githubDownloadText(composeMeta.download_url);
  writeFileIfChanged(path.join(localDir, composeFile), composeYaml);

  // README.md (optional)
  try {
    const readmeMetaUrl = `https://api.github.com/repos/${ro}/${rr}/contents/${encodeGithubPath(`${basePath}/README.md`)}?ref=${encodeURIComponent(ref)}`;
    const readmeMeta = await githubApiGetJson(readmeMetaUrl);
    const readme = await githubDownloadText(readmeMeta.download_url);
    writeFileIfChanged(path.join(localDir, "README.md"), readme);
  } catch {
    // ignore
  }

  return { recipeDir: localDir, recipe, composeFile };
}

function parseRegistryOptions(args) {
  const cacheDir = resolveCacheDir(args);
  const regRaw = getArgValue(args, "--registry");
  const preferRegistry = args.includes("--prefer-registry");
  if (!regRaw) return { cacheDir, registry: DEFAULT_REGISTRY, preferRegistry };
  const parsed = parseOwnerRepo(regRaw);
  if (!parsed) {
    console.error(`Invalid --registry value (expected owner/repo): ${regRaw}`);
    process.exit(2);
  }
  const ref = getArgValue(args, "--registry-ref") || "main";
  return { cacheDir, registry: { owner: parsed.owner, repo: parsed.repo, ref }, preferRegistry };
}

async function resolveContext(input, requestedRecipeId, projectOverride, registryOptions) {
  const repo = parseRepo(input);
  if (!repo) {
    console.error(`Unsupported repo format: ${input}`);
    usage();
    process.exit(1);
  }

  const base = repoRoot();
  const repoDir = path.join(base, "recipes", repo.owner, repo.repo);
  const localRecipeIds = listRecipeIds(repoDir);
  let recipeIds = localRecipeIds;
  let source = "local";

  if ((recipeIds.length === 0 || registryOptions?.preferRegistry) && registryOptions?.registry) {
    recipeIds = await listRecipeIdsFromGithubRegistry(registryOptions.registry, repo);
    source = "github";
  }

  if (recipeIds.length === 0) {
    console.error(`No recipes found for ${repo.owner}/${repo.repo}`);
    console.error(`Expected under: ${repoDir}`);
    if (registryOptions?.registry) {
      console.error(
        `Registry fallback also found nothing: ${registryOptions.registry.owner}/${registryOptions.registry.repo}@${registryOptions.registry.ref}`,
      );
    }
    process.exit(2);
  }

  let recipeId = pickRecipeId(recipeIds);
  if (requestedRecipeId) {
    if (!recipeIds.includes(requestedRecipeId)) {
      console.error(`Recipe '${requestedRecipeId}' not found for ${repo.owner}/${repo.repo}`);
      console.error("Use `list` to see available recipes.");
      process.exit(2);
    }
    recipeId = requestedRecipeId;
  }

  let recipeDir;
  let recipe;
  let composeFile;
  let effectiveRepoDir = repoDir;

  if (source === "local") {
    recipeDir = path.join(repoDir, recipeId);
    recipe = readRecipeYaml(recipeDir);
    composeFile = recipe?.runtime?.composeFile || "compose.yaml";
  } else {
    const cacheDir = registryOptions?.cacheDir || path.join(os.homedir(), ".githubui-cache");
    const fetched = await fetchRecipeDirFromGithubRegistry({
      registry: registryOptions.registry,
      target: repo,
      recipeId,
      cacheDir,
    });
    recipeDir = fetched.recipeDir;
    recipe = fetched.recipe;
    composeFile = fetched.composeFile;
    effectiveRepoDir = path.join(cacheDir, "recipes", repo.owner, repo.repo);
  }

  const projectName = sanitizeProjectName(
    projectOverride || `ghui_${repo.owner}_${repo.repo}_${recipeId}`,
  );

  return {
    repo,
    repoDir: effectiveRepoDir,
    recipeIds,
    recipeId,
    recipeDir,
    recipe,
    composeFile,
    projectName,
    source,
    registry: registryOptions?.registry || null,
    cacheDir: registryOptions?.cacheDir || null,
  };
}

function printRunInfo({ repo, recipeId, recipeDir, projectName, composeFiles, uiUrl }) {
  console.log(`Repo: ${repo.owner}/${repo.repo}`);
  console.log(`Recipe: ${recipeId}`);
  console.log(`Recipe dir: ${recipeDir}`);
  console.log("");
  console.log("Run locally:");
  console.log(`  cd "${recipeDir}"`);
  const filesForPrint = composeFiles.map((f) => `-f "${f}"`).join(" ");
  console.log(`  docker compose -p "${projectName}" ${filesForPrint} up -d`);
  console.log("");
  if (uiUrl) console.log(`UI: ${uiUrl}`);
  console.log("");
  return { filesForPrint };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes("-h") || argv.includes("--help")) {
    usage();
    process.exit(0);
  }

  const { command: rawCommand, args } = splitCommand(argv);
  if (!rawCommand) {
    usage();
    process.exit(1);
  }

  // Back-compat flags
  const legacyList = args.includes("--list");
  const noRun = args.includes("--no-run");
  const noOpen = args.includes("--no-open");
  const requestedRecipeId = getArgValue(args, "--recipe");
  const projectOverride = getArgValue(args, "--project");

  // Default behavior: run + open (one-click). Legacy flags are accepted.
  const run = !noRun;
  const open = !noOpen;

  const command = legacyList ? "list" : rawCommand;

  const input = resolveRepoInput(args);
  if (!input) {
    usage();
    process.exit(1);
  }

  console.log(`Command: ${command}`);
  console.log("");

  const registryOptions = parseRegistryOptions(args);

  if (command === "list") {
    const repo = parseRepo(input);
    if (!repo) {
      console.error(`Unsupported repo format: ${input}`);
      usage();
      process.exit(1);
    }

    const localDir = path.join(repoRoot(), "recipes", repo.owner, repo.repo);
    let ids = listRecipeIds(localDir);
    if ((ids.length === 0 || registryOptions.preferRegistry) && registryOptions.registry) {
      try {
        ids = await listRecipeIdsFromGithubRegistry(registryOptions.registry, repo);
      } catch (e) {
        console.error("Registry fetch failed.");
        console.error(e?.message || String(e));
        process.exit(2);
      }
    }

    if (ids.length === 0) {
      console.error(`No recipes found for ${repo.owner}/${repo.repo}`);
      console.error(`Expected under: ${localDir}`);
      if (registryOptions.registry) {
        console.error(
          `Registry fallback also found nothing: ${registryOptions.registry.owner}/${registryOptions.registry.repo}@${registryOptions.registry.ref}`,
        );
      }
      process.exit(2);
    }

    console.log(`Repo: ${repo.owner}/${repo.repo}`);
    console.log("Available recipes:");
    for (const id of ids.sort()) console.log(`- ${id}`);
    console.log("");
    process.exit(0);
  }

  let ctx;
  try {
    ctx = await resolveContext(input, requestedRecipeId, projectOverride, registryOptions);
  } catch (e) {
    console.error("Failed to resolve recipe context.");
    console.error(e?.message || String(e));
    process.exit(2);
  }

  // "print" is a first-class command; "--no-run" is legacy alias.
  const effectiveCommand = noRun ? "print" : command;

  if (effectiveCommand === "doctor") {
    const composeFiles = getComposeFilesForManage(ctx.recipeDir, ctx.composeFile);
    const uiUrl = ctx.recipe?.ui?.url || null;

    console.log(`Repo: ${ctx.repo.owner}/${ctx.repo.repo}`);
    console.log(`Recipe: ${ctx.recipeId}`);
    console.log(`Recipe dir: ${ctx.recipeDir}`);
    console.log(`Project: ${ctx.projectName}`);
    if (uiUrl) console.log(`UI: ${uiUrl}`);
    console.log("");

    console.log("Checks:");
    console.log(`- docker: ${dockerExists() ? "ok" : "missing"}`);
    console.log(`- docker compose: ${composeExists() ? "ok" : "missing"}`);
    console.log(`- recipe.yaml: ${fs.existsSync(path.join(ctx.recipeDir, "recipe.yaml")) ? "ok" : "missing"}`);
    console.log(`- compose file (${ctx.composeFile}): ${fs.existsSync(path.join(ctx.recipeDir, ctx.composeFile)) ? "ok" : "missing"}`);
    console.log(`- override (.githubui.override.yaml): ${fs.existsSync(path.join(ctx.recipeDir, ".githubui.override.yaml")) ? "present" : "absent"}`);
    console.log("");

    if (!dockerExists() || !composeExists()) process.exit(127);

    console.log("docker compose ps:");
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
      process.exit(psRes.status);
    }

    // Try to surface published UI port mapping if configured.
    const ports = Array.isArray(ctx.recipe?.ports) ? ctx.recipe.ports : [];
    const uiPort = ports.find((p) => p && (p.name === "ui" || p.protocol === "http")) || null;
    if (uiPort?.service && uiPort?.containerPort) {
      const portRes = runComposeCommandCapture(ctx.recipeDir, composeFiles, ctx.projectName, [
        "port",
        uiPort.service,
        String(uiPort.containerPort),
      ]);
      const line = portRes.stdout.trim();
      if (line) {
        console.log("");
        console.log(`docker compose port ${uiPort.service} ${uiPort.containerPort}: ${line}`);
      }
    }

    console.log("");
    process.exit(0);
  }

  if (effectiveCommand === "ps" || effectiveCommand === "logs" || effectiveCommand === "stop" || effectiveCommand === "down") {
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

    const code = runComposeCommand(ctx.recipeDir, composeFiles, ctx.projectName, cmdArgs);
    process.exit(code);
  }

  // up / print
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

  // Use the adjusted url for wait/open (only meaningful for up).
  const effectiveRecipe = { ...ctx.recipe, ui: { ...(ctx.recipe?.ui || {}), url: uiUrl } };

  const { filesForPrint } = printRunInfo({
    repo: ctx.repo,
    recipeId: ctx.recipeId,
    recipeDir: ctx.recipeDir,
    projectName: ctx.projectName,
    composeFiles,
    uiUrl,
  });

  if (effectiveCommand === "print") process.exit(0);

  const code = runCompose(ctx.recipeDir, composeFiles, ctx.projectName);
  if (code !== 0) process.exit(code);

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
    process.exit(3);
  }
  if (uiUrl) console.log("UI is ready.");

  if (shouldOpen && uiUrl) {
    console.log(`Opening: ${uiUrl}`);
    openUrl(uiUrl);
  }
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});

