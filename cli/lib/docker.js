const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { spawnSync } = require("node:child_process");
const YAML = require("yaml");
const { EXIT } = require("./constants");
const { readComposeYaml } = require("./recipe");

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

function getCommandOutput(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.status !== 0) return null;
  return (r.stdout || r.stderr || "").toString().trim() || null;
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
    process.exit(EXIT.PORT_IN_USE);
  }

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

function parseComposePsJson(stdout) {
  try {
    const data = JSON.parse(stdout);
    if (!Array.isArray(data)) return null;
    return data.map((row) => ({
      name: row.Name || row.name || "",
      state: row.State || row.state || "",
      status: row.Status || row.status || "",
      health: row.Health || row.health || "",
    }));
  } catch {
    return null;
  }
}

function hasRunningFromPsText(stdout) {
  return (
    typeof stdout === "string" &&
    stdout
      .toLowerCase()
      .split("\n")
      .some((line) => line.includes("running"))
  );
}

function hasRunningFromPsJson(rows) {
  if (!Array.isArray(rows)) return false;
  return rows.some((row) => {
    const state = (row.state || "").toString().toLowerCase();
    const status = (row.status || "").toString().toLowerCase();
    return state.includes("running") || status.includes("running");
  });
}

module.exports = {
  openUrl,
  getCommandOutput,
  dockerExists,
  composeExists,
  runCompose,
  runComposeCommand,
  runComposeCommandCapture,
  getComposeFilesForManage,
  ensureUiPortAvailable,
  parseComposePsJson,
  hasRunningFromPsText,
  hasRunningFromPsJson,
};
