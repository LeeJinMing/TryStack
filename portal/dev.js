const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const root = __dirname;
const distOnly = process.argv.includes("--dist");
const baseDir = distOnly ? path.join(root, "dist") : root;
const repoRoot = path.resolve(root, "..");
const recipesRoot = path.join(repoRoot, "recipes");

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function safeText(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function snippetFromReadme(readmeMd) {
  const lines = String(readmeMd || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const first = lines.find((l) => !l.startsWith("#")) || lines[0] || "";
  return safeText(first.replace(/[`*_>#]/g, "")).slice(0, 140);
}

function buildRecipesIndex() {
  const entries = [];
  for (const owner of listDirs(recipesRoot)) {
    for (const repo of listDirs(path.join(recipesRoot, owner))) {
      for (const recipeId of listDirs(path.join(recipesRoot, owner, repo))) {
        const recipeDir = path.join(recipesRoot, owner, repo, recipeId);
        const readmePath = path.join(recipeDir, "README.md");
        const recipeYamlPath = path.join(recipeDir, "recipe.yaml");
        if (!fs.existsSync(recipeYamlPath)) continue;

        const readmeMd = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, "utf8") : "";
        const args =
          recipeId === "default"
            ? `trystack up ${owner}/${repo}`
            : `trystack up ${owner}/${repo} --recipe ${recipeId}`;
        const command = `npx --yes -p github:LeeJinMing/TryStack ${args}`;

        entries.push({
          owner,
          repo,
          recipeId,
          title: `${owner}/${repo}`,
          github: `https://github.com/${owner}/${repo}`,
          command,
          snippet: snippetFromReadme(readmeMd),
          readme: fs.existsSync(readmePath) ? `/api/readme/${owner}/${repo}/${recipeId}` : null,
        });
      }
    }
  }

  entries.sort((a, b) => {
    const ka = `${a.owner}/${a.repo}/${a.recipeId}`.toLowerCase();
    const kb = `${b.owner}/${b.repo}/${b.recipeId}`.toLowerCase();
    return ka.localeCompare(kb);
  });

  return {
    generatedAt: new Date().toISOString(),
    total: entries.length,
    recipes: entries,
  };
}

function isSafeSegment(s) {
  return typeof s === "string" && /^[A-Za-z0-9_.-]+$/.test(s);
}

function contentType(p) {
  if (p.endsWith(".html")) return "text/html; charset=utf-8";
  if (p.endsWith(".css")) return "text/css; charset=utf-8";
  if (p.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (p.endsWith(".svg")) return "image/svg+xml";
  if (p.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";

  // Dev-only API: read from repo recipes/ without exposing arbitrary filesystem.
  if (!distOnly && pathname === "/api/recipes") {
    const payload = buildRecipesIndex();
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(payload, null, 2));
    return;
  }

  if (!distOnly && pathname.startsWith("/api/readme/")) {
    const parts = pathname.split("/").filter(Boolean); // ["api","readme",owner,repo,recipeId]
    const owner = parts[2];
    const repo = parts[3];
    const recipeId = parts[4];
    if (!isSafeSegment(owner) || !isSafeSegment(repo) || !isSafeSegment(recipeId)) {
      res.writeHead(400);
      res.end("Bad Request");
      return;
    }
    const readmePath = path.join(recipesRoot, owner, repo, recipeId, "README.md");
    if (!fs.existsSync(readmePath)) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/markdown; charset=utf-8" });
    res.end(fs.readFileSync(readmePath, "utf8"));
    return;
  }

  const filePath = path.join(baseDir, pathname);
  if (!filePath.startsWith(baseDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  res.writeHead(200, { "Content-Type": contentType(filePath) });
  res.end(fs.readFileSync(filePath));
});

const port = 4173;
server.listen(port, () => {
  console.log(`Portal dev server: http://localhost:${port} ${distOnly ? "(dist)" : ""}`);
});
