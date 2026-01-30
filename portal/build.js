const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const dist = path.join(root, "dist");
const repoRoot = path.resolve(root, "..");
const recipesRoot = path.join(repoRoot, "recipes");

const DEFAULT_NPX_PACKAGE = "github:LeeJinMing/TryStack#v0.0.2";
const NPX_PACKAGE = process.env.TRYSTACK_NPX_PACKAGE || DEFAULT_NPX_PACKAGE;

function buildId() {
  const sha = String(process.env.GITHUB_SHA || "").trim();
  if (sha) return sha.slice(0, 8);
  // fallback for local builds
  return String(Date.now());
}

function injectCacheBustingIntoIndexHtml(html, id) {
  const v = encodeURIComponent(String(id || "").trim() || "dev");
  return String(html || "")
    .replace(/href="\.\/src\/style\.css(?:\?[^"]*)?"/g, `href="./src/style.css?v=${v}"`)
    .replace(/src="\.\/src\/main\.js(?:\?[^"]*)?"/g, `src="./src/main.js?v=${v}"`);
}

function injectAnalyticsIntoIndexHtml(html) {
  const endpoint = String(process.env.TRYSTACK_ANALYTICS_ENDPOINT || "").trim();
  // Keep analytics disabled if not provided (or left as placeholder).
  const safeEndpoint = endpoint || "";
  return String(html || "").replace(/__TRYSTACK_ANALYTICS_ENDPOINT__/g, safeEndpoint);
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(srcDir, destDir) {
  ensureDir(destDir);
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else copyFile(src, dest);
  }
}

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

function parseRecipeYaml(yamlText) {
  const lines = String(yamlText || "").split(/\r?\n/);
  const out = {
    uiUrl: "",
    uiPath: "/",
    uiExpectStatus: 200,
    uiMatch: "",
    envRequired: [],
    envOptional: [],
  };

  // Very small YAML subset parser for our consistent recipe.yaml files.
  // We intentionally avoid adding extra dependencies to the portal build.
  const pickQuoted = (s) => {
    const m = String(s || "").match(/"([^"]*)"/);
    return m ? m[1] : String(s || "").trim();
  };

  let section = "";
  let envSub = "";
  for (const raw of lines) {
    const line = String(raw);
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;

    if (/^ui:\s*$/.test(t)) {
      section = "ui";
      continue;
    }
    if (/^env:\s*$/.test(t)) {
      section = "env";
      envSub = "";
      continue;
    }
    if (section === "env") {
      if (/^required:\s*\[\]\s*$/.test(t)) {
        out.envRequired = [];
        continue;
      }
      if (/^optional:\s*\[\]\s*$/.test(t)) {
        out.envOptional = [];
        continue;
      }
      if (/^required:\s*$/.test(t)) {
        envSub = "required";
        continue;
      }
      if (/^optional:\s*$/.test(t)) {
        envSub = "optional";
        continue;
      }
      const m = t.match(/^-+\s*(.+)\s*$/);
      if (m && envSub) {
        const v = String(m[1] || "").trim().replace(/^["']|["']$/g, "");
        if (v) {
          if (envSub === "required") out.envRequired.push(v);
          else out.envOptional.push(v);
        }
      }
      continue;
    }

    if (section === "ui") {
      const mUrl = t.match(/^url:\s*(.+)$/);
      if (mUrl) {
        out.uiUrl = pickQuoted(mUrl[1]);
        continue;
      }
      if (/^healthcheck:\s*$/.test(t)) {
        section = "ui.healthcheck";
        continue;
      }
      continue;
    }

    if (section === "ui.healthcheck") {
      const mPath = t.match(/^path:\s*(.+)$/);
      if (mPath) {
        out.uiPath = pickQuoted(mPath[1]) || "/";
        continue;
      }
      const mStatus = t.match(/^expectStatus:\s*(\d+)\s*$/);
      if (mStatus) {
        out.uiExpectStatus = Number(mStatus[1]) || 200;
        continue;
      }
      const mMatch = t.match(/^match:\s*(.+)$/);
      if (mMatch) {
        out.uiMatch = pickQuoted(mMatch[1]);
        continue;
      }
      continue;
    }
  }

  return out;
}

function countComposeServices(composeText) {
  const lines = String(composeText || "").split(/\r?\n/);
  let inServices = false;
  let baseIndent = null;
  const names = new Set();

  for (const raw of lines) {
    const line = String(raw);
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;

    if (!inServices) {
      if (t === "services:") {
        inServices = true;
        baseIndent = line.indexOf("s"); // indent of "services:"
      }
      continue;
    }

    // exit when we hit a new top-level key with same indent as services
    const indent = line.search(/\S|$/);
    if (baseIndent != null && indent <= baseIndent && /^[A-Za-z0-9_.-]+:\s*$/.test(t) && t !== "services:") {
      break;
    }

    // service key is usually 2-space indented under services
    if (/^[A-Za-z0-9_.-]+:\s*$/.test(t) && indent > (baseIndent ?? 0)) {
      names.add(t.replace(/:\s*$/, ""));
    }
  }

  return names.size;
}

function guessTier({ envRequiredCount, composeServicesCount }) {
  if (envRequiredCount > 0) return "A2";
  return composeServicesCount > 1 ? "A1" : "A0";
}

function guessCategory(owner, repo) {
  const key = `${owner}/${repo}`.toLowerCase();
  const map = {
    "louislam/uptime-kuma": "Monitoring",
    "grafana/grafana": "Monitoring",
    "healthchecks/healthchecks": "Monitoring",
    "freshRSS/freshrss": "RSS",
    "miniflux/v2": "RSS",
    "zadam/trilium": "Notes",
    "usememos/memos": "Notes",
    "jellyfin/jellyfin": "Media",
    "benphelps/homepage": "Dashboard",
    "portainer/portainer": "DevOps",
    "searxng/searxng": "Search",
    "nextcloud/server": "Files",
    "seafileltd/seafile": "Files",
    "photoprism/photoprism": "Photos",
    "qbittorrent/qbittorrent": "Download",
    "transmission/transmission": "Download",
    "nzbget/nzbget": "Download",
    "n8n-io/n8n": "Automation",
    "openclaw/openclaw": "AI",
  };
  return map[key] || "Other";
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
        const recipeYaml = fs.readFileSync(recipeYamlPath, "utf8");
        const parsed = parseRecipeYaml(recipeYaml);
        const composePath = path.join(recipeDir, "compose.yaml");
        const composeText = fs.existsSync(composePath) ? fs.readFileSync(composePath, "utf8") : "";
        const composeServicesCount = composeText ? countComposeServices(composeText) : 0;
        const tier = guessTier({ envRequiredCount: parsed.envRequired.length, composeServicesCount });
        const category = guessCategory(owner, repo);

        const args =
          recipeId === "default"
            ? `trystack up ${owner}/${repo}`
            : `trystack up ${owner}/${repo} --recipe ${recipeId}`;
        const command = `npx --yes -p ${NPX_PACKAGE} ${args}`;

        entries.push({
          owner,
          repo,
          recipeId,
          title: `${owner}/${repo}`,
          github: `https://github.com/${owner}/${repo}`,
          command,
          snippet: snippetFromReadme(readmeMd),
          tier,
          category,
          ui: {
            url: parsed.uiUrl || "",
            path: parsed.uiPath || "/",
            expectStatus: parsed.uiExpectStatus || 200,
            match: parsed.uiMatch || "",
          },
          env: {
            required: parsed.envRequired,
            optional: parsed.envOptional,
          },
          readme: fs.existsSync(readmePath)
            ? `data/readmes/${owner}/${repo}/${recipeId}.md`
            : null,
        });
      }
    }
  }

  entries.sort((a, b) => {
    const tierRank = (t) => ({ A0: 0, A1: 1, A2: 2, A3: 3 }[String(t || "A0")] ?? 9);
    const ra = tierRank(a.tier);
    const rb = tierRank(b.tier);
    if (ra !== rb) return ra - rb;
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

if (fs.existsSync(dist)) fs.rmSync(dist, { recursive: true, force: true });
ensureDir(dist);

{
  const srcIndex = path.join(root, "index.html");
  const dstIndex = path.join(dist, "index.html");
  const html = fs.readFileSync(srcIndex, "utf8");
  const patched = injectAnalyticsIntoIndexHtml(injectCacheBustingIntoIndexHtml(html, buildId()));
  ensureDir(path.dirname(dstIndex));
  fs.writeFileSync(dstIndex, patched, "utf8");
}
copyDir(path.join(root, "src"), path.join(dist, "src"));

// Optional: sitemap for SEO / GSC
{
  const src = path.join(root, "sitemap.xml");
  const dst = path.join(dist, "sitemap.xml");
  if (fs.existsSync(src)) copyFile(src, dst);
}

// Optional: ship promo video with Pages artifact (kept at repo root).
// This keeps the Portal demo playable without relying on Release assets.
{
  const videos = [
    "AI captions - TryStack__Run_Apps_in_Minutes.mp4.mp4",
    "TryStack__Run_Apps_in_Minutes.mp4",
  ];
  for (const videoName of videos) {
    const srcVideo = path.join(repoRoot, videoName);
    const dstVideo = path.join(dist, videoName);
    if (fs.existsSync(srcVideo)) {
      copyFile(srcVideo, dstVideo);
    }
  }
}

// Generate static recipes index + README copies for pure static hosting.
const index = buildRecipesIndex();
ensureDir(path.join(dist, "data"));
fs.writeFileSync(path.join(dist, "data", "recipes.json"), JSON.stringify(index, null, 2), "utf8");

for (const r of index.recipes) {
  if (!r.readme) continue;
  const src = path.join(recipesRoot, r.owner, r.repo, r.recipeId, "README.md");
  const dest = path.join(dist, r.readme);
  copyFile(src, dest);
}

console.log("Build complete: portal/dist");
