const yearEl = document.getElementById("year");
if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear());
}

function getAnalyticsEndpoint() {
  try {
    const cfg = (typeof window !== "undefined" && window.TRYSTACK_ANALYTICS) || null;
    const endpoint = cfg && typeof cfg === "object" ? String(cfg.endpoint || "").trim() : "";
    if (!endpoint || endpoint.startsWith("__TRYSTACK_")) return "";
    return endpoint;
  } catch {
    return "";
  }
}

let analyticsEndpoint = "";

function initAnalytics() {
  analyticsEndpoint = getAnalyticsEndpoint();
}

function track(name, props = {}) {
  try {
    if (!analyticsEndpoint) return;
    const n = String(name || "").trim();
    if (!n) return;

    const payload = {
      name: n,
      ts: Date.now(),
      props: typeof props === "object" && props ? props : {},
    };

    // Prefer sendBeacon (non-blocking); fall back to fetch.
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(analyticsEndpoint, blob);
      return;
    }
    fetch(analyticsEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }
}

const DEFAULT_NPX_PACKAGE =
  (typeof window !== "undefined" && window.TRYSTACK_NPX_PACKAGE) || "github:LeeJinMing/TryStack#main";

let currentNpxPackage = DEFAULT_NPX_PACKAGE;
let currentReleaseTag = null; // e.g. "v0.0.2"

function getNpxPackage() {
  return currentNpxPackage || DEFAULT_NPX_PACKAGE;
}

function parseTagFromNpxPackage(pkg) {
  const s = String(pkg || "");
  const m = s.match(/#(v\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?)$/);
  return m ? m[1] : null;
}

function setNpxPackage({ npxPackage, tag }) {
  const pkg = String(npxPackage || "").trim();
  if (!pkg) return;
  currentNpxPackage = pkg;
  currentReleaseTag = String(tag || "").trim() || parseTagFromNpxPackage(pkg);
  updatePinnedUi();
}

function updatePinnedUi() {
  const tag = currentReleaseTag || parseTagFromNpxPackage(getNpxPackage()) || "main";
  const releaseLink = document.getElementById("releaseLink");
  const releaseTag = document.getElementById("releaseTag");
  const pinnedTag = document.getElementById("pinnedTag");
  const tryLocallyCmd = document.getElementById("tryLocallyCmd");
  const protocolInstallInline = document.getElementById("protocolInstallInline");

  if (releaseTag) releaseTag.textContent = tag;
  if (pinnedTag) pinnedTag.textContent = tag;
  if (releaseLink) {
    const isSemver = /^v\d+\.\d+\.\d+/.test(tag);
    releaseLink.setAttribute(
      "href",
      isSemver ? `https://github.com/LeeJinMing/TryStack/releases/tag/${tag}` : "https://github.com/LeeJinMing/TryStack",
    );
  }

  if (tryLocallyCmd) {
    tryLocallyCmd.textContent = `npx --yes -p github:LeeJinMing/TryStack#${tag} trystack up louislam/uptime-kuma\ntrystack ps louislam/uptime-kuma`;
  }
  if (protocolInstallInline) {
    protocolInstallInline.textContent = `npx --yes -p github:LeeJinMing/TryStack#${tag} trystack protocol install --package github:LeeJinMing/TryStack#${tag}`;
  }

  // Promo video: prefer same-origin asset shipped with Pages.
  const promoVideo = document.getElementById("promoVideo");
  const promoSource = document.getElementById("promoVideoSource");
  const promoLink = document.getElementById("promoVideoLink");
  const promoHint = document.getElementById("promoVideoHint");
  const url = "./AI%20captions%20-%20TryStack__Run_Apps_in_Minutes.mp4.mp4";

  if (promoLink) {
    promoLink.setAttribute(
      "href",
      url,
    );
  }

  if (promoSource) {
    const cur = String(promoSource.getAttribute("src") || "");
    if (cur !== url) {
      promoSource.setAttribute("src", url);
      if (promoVideo && typeof promoVideo.load === "function") promoVideo.load();
    }
  }

  if (promoVideo && !promoVideo.dataset?.trystackBound) {
    promoVideo.dataset.trystackBound = "1";
    promoVideo.addEventListener("error", () => {
      if (promoHint) {
        promoHint.textContent =
          "Video failed to load. Ensure the promo mp4 exists in the GitHub Pages build artifact (portal/dist).";
      }
    });
  }
}

function cacheGet(key) {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function cacheSet(key, value) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

async function resolveLatestReleaseTag() {
  const cacheKey = "trystack_latest_release_v1";
  const cached = cacheGet(cacheKey);
  const now = Date.now();
  if (cached?.tag && typeof cached?.ts === "number" && now - cached.ts < 6 * 60 * 60 * 1000) {
    return String(cached.tag);
  }

  try {
    const data = await fetchJson("https://api.github.com/repos/LeeJinMing/TryStack/releases/latest");
    const tag = String(data?.tag_name || "").trim();
    if (!/^v\d+\.\d+\.\d+/.test(tag)) return null;
    cacheSet(cacheKey, { tag, ts: now });
    return tag;
  } catch {
    return null;
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return await res.json();
}

async function fetchText(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return await res.text();
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = String(v);
    else node.setAttribute(k, String(v));
  }
  for (const c of children) node.appendChild(c);
  return node;
}

function setCount(text) {
  const countEl = document.getElementById("recipeCount");
  if (countEl) countEl.textContent = text;
}

function openReadme(title, content) {
  const dlg = document.getElementById("readmeDialog");
  const titleEl = document.getElementById("readmeTitle");
  const contentEl = document.getElementById("readmeContent");
  if (!dlg || !titleEl || !contentEl) return;
  titleEl.textContent = title;
  contentEl.textContent = content;
  if (typeof dlg.showModal === "function") dlg.showModal();
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback
    window.prompt("Copy command:", text);
    return false;
  }
}

function isProbablyWindows() {
  const ua = String(navigator.userAgent || "");
  return ua.includes("Windows");
}

function openProtocolHelp({ uri }) {
  const dlg = document.getElementById("protocolDialog");
  const cmdEl = document.getElementById("protocolInstallCmd");
  const uriEl = document.getElementById("protocolUri");
  const copyBtn = document.getElementById("protocolCopyBtn");
  if (!dlg || !cmdEl || !uriEl) return;

  const installCmd = `npx --yes -p ${getNpxPackage()} trystack protocol install`;
  cmdEl.textContent = installCmd;
  uriEl.textContent = String(uri || "");

  if (copyBtn) {
    copyBtn.onclick = async () => {
      await copyToClipboard(installCmd);
    };
  }

  if (!isProbablyWindows()) {
    cmdEl.textContent = `${installCmd}\n\n(note: protocol install is Windows-only)`;
  }

  if (typeof dlg.showModal === "function") dlg.showModal();
}

function tryOpenProtocol(uri) {
  const target = String(uri || "").trim();
  if (!target) return;

  // Best-effort heuristic:
  // If the app handler exists, browser typically triggers a native prompt / switches focus.
  // If nothing happens, we show a help dialog after a short delay.
  let didBlur = false;
  const onBlur = () => {
    didBlur = true;
  };
  window.addEventListener("blur", onBlur, { once: true });

  try {
    window.location.href = target;
  } catch {
    // ignore
  }

  setTimeout(() => {
    try {
      window.removeEventListener("blur", onBlur);
    } catch {
      // ignore
    }
    if (!didBlur && document.visibilityState === "visible") {
      openProtocolHelp({ uri: target });
    }
  }, 1200);
}

function buildUpArgs(owner, repo, recipeId) {
  const rid = String(recipeId || "default");
  return rid === "default" ? `trystack up ${owner}/${repo}` : `trystack up ${owner}/${repo} --recipe ${rid}`;
}

function buildUpCommand(owner, repo, recipeId) {
  return `npx --yes -p ${getNpxPackage()} ${buildUpArgs(owner, repo, recipeId)}`;
}

function buildScaffoldCommand(owner, repo) {
  return `npx --yes -p ${getNpxPackage()} trystack scaffold ${owner}/${repo}`;
}

function buildMoreActions(children) {
  const details = document.createElement("details");
  details.className = "recipe-more";
  const summary = document.createElement("summary");
  summary.className = "btn";
  summary.textContent = "More";
  const panel = el("div", { class: "recipe-more-panel" }, children);
  details.appendChild(summary);
  details.appendChild(panel);
  return details;
}

function downloadTextFile({ filename, content, mime = "text/plain;charset=utf-8" }) {
  const name = String(filename || "download.txt").trim() || "download.txt";
  const text = String(content ?? "");
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // revoke after click so the download can start
  setTimeout(() => URL.revokeObjectURL(url), 250);
}

function safeFileSegment(s) {
  return String(s || "")
    .replace(/[^A-Za-z0-9_.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildCmdScript(command) {
  const cmd = String(command || "").trim();
  return [
    "@echo off",
    "setlocal EnableExtensions",
    "title TryStack (generated script)",
    "echo.",
    "echo TryStack (generated script). Review the command before running.",
    "echo.",
    `echo ${cmd.replace(/%/g, "%%")}`,
    "echo.",
    "where npx >nul 2>nul",
    "if errorlevel 1 (",
    "  echo ERROR: 'npx' was not found. Please install Node.js (includes npx) and try again.",
    "  echo - Download: https://nodejs.org/",
    "  echo.",
    "  pause",
    "  exit /b 127",
    ")",
    "echo.",
    // NOTE: on Windows, `npx` is typically `npx.cmd` (a batch file).
    // Calling another batch file requires `call`, otherwise control doesn't return
    // and this script ends before reaching the final pause.
    `call ${cmd}`,
    "echo.",
    "echo Done. Press any key to close.",
    "pause >nul",
    "",
  ].join("\r\n");
}

function parseSemverTag(tag) {
  const m = String(tag || "").trim().match(/^v(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function compareSemver(a, b) {
  if (!a || !b) return 0;
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

function buildPs1Script(command) {
  const cmd = String(command || "").trim();
  return [
    "# TryStack (generated script). Review the command before running.",
    '$ErrorActionPreference = "Stop"',
    "",
    'Write-Host ""',
    'Write-Host "Running:"',
    `Write-Host ${JSON.stringify(cmd)}`,
    'Write-Host ""',
    "",
    "try {",
    `  ${cmd}`,
    "} catch {",
    '  Write-Host ""',
    '  Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red',
    "  if ($_.ScriptStackTrace) { Write-Host $_.ScriptStackTrace }",
    "  exit 1",
    "} finally {",
    '  Write-Host ""',
    '  Write-Host "Press Enter to close..."',
    "  [void](Read-Host)",
    "}",
    "",
  ].join("\r\n");
}

function downloadRunScripts({ owner, repo, recipeId, command, prefix = "trystack" }) {
  const o = safeFileSegment(owner);
  const r = safeFileSegment(repo);
  const rid = safeFileSegment(recipeId || "default") || "default";
  const base = `${safeFileSegment(prefix)}-${o}-${r}-${rid}`;

  downloadTextFile({
    filename: `${base}.cmd`,
    content: buildCmdScript(command),
    mime: "application/octet-stream",
  });

  downloadTextFile({
    filename: `${base}.ps1`,
    content: buildPs1Script(command),
    mime: "text/plain;charset=utf-8",
  });
}

function parseRepoInput(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;

  // owner/repo
  let m = s.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (m) return { owner: m[1], repo: m[2] };

  // https://github.com/owner/repo(.git)?(/)?
  m = s.match(/^https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
  if (m) return { owner: m[1], repo: m[2] };

  // git@github.com:owner/repo(.git)?
  m = s.match(/^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
  if (m) return { owner: m[1], repo: m[2] };

  return null;
}

function getRepoFromQuery() {
  try {
    const u = new URL(window.location.href);
    const repo = u.searchParams.get("repo");
    if (repo) return repo;
    const url = u.searchParams.get("url") || u.searchParams.get("github");
    if (url) return url;
  } catch {
    // ignore
  }
  return null;
}

function renderRecipes(recipes, filterText) {
  const list = document.getElementById("recipesList");
  if (!list) return;
  list.innerHTML = "";

  const q = String(filterText || "").toLowerCase().trim();
  const filtered = q
    ? recipes.filter((r) => {
        const hay = `${r.title} ${r.recipeId} ${r.snippet || ""}`.toLowerCase();
        return hay.includes(q);
      })
    : recipes;

  setCount(`${filtered.length} / ${recipes.length}`);

  if (filtered.length === 0) {
    list.appendChild(el("div", { class: "muted", text: "No matches." }));
    return;
  }

  for (const r of filtered) {
    const header = el("div", { class: "recipe-title", text: r.title });
    const meta = el("div", { class: "recipe-meta muted", text: `recipe: ${r.recipeId}` });
    const snippet = el("div", { class: "recipe-snippet", text: r.snippet || "" });
    const command = buildUpCommand(r.owner, r.repo, r.recipeId);
    const cmd = el("code", { class: "recipe-cmd", text: command });
    const repoId = `${r.owner}/${r.repo}`;

    const copyBtn = el("button", { class: "btn primary", type: "button" }, []);
    copyBtn.textContent = "Copy command";
    copyBtn.addEventListener("click", async () => {
      await copyToClipboard(command);
      track("copy_command", { source: "recipe_card", repo: repoId, recipeId: r.recipeId || "default" });
    });

    const protoLink = el(
      "a",
      {
        class: "btn",
        href: `trystack://up?repo=${encodeURIComponent(`${r.owner}/${r.repo}`)}&recipe=${encodeURIComponent(
          r.recipeId || "default",
        )}`,
      },
      [],
    );
    protoLink.textContent = "Open (1-click)";
    protoLink.addEventListener("click", (e) => {
      e.preventDefault();
      tryOpenProtocol(protoLink.getAttribute("href"));
      track("open_one_click", { action: "up", source: "recipe_card", repo: repoId, recipeId: r.recipeId || "default" });
    });

    const doctorLink = el(
      "a",
      {
        class: "btn",
        href: `trystack://doctor?repo=${encodeURIComponent(`${r.owner}/${r.repo}`)}&recipe=${encodeURIComponent(
          r.recipeId || "default",
        )}`,
      },
      [],
    );
    doctorLink.textContent = "Doctor (1-click)";
    doctorLink.addEventListener("click", (e) => {
      e.preventDefault();
      tryOpenProtocol(doctorLink.getAttribute("href"));
      track("open_one_click", {
        action: "doctor",
        source: "recipe_card",
        repo: repoId,
        recipeId: r.recipeId || "default",
      });
    });

    const dlBtn = el("button", { class: "btn", type: "button" }, []);
    dlBtn.textContent = "Download script (.cmd/.ps1)";
    dlBtn.addEventListener("click", () => {
      downloadRunScripts({
        owner: r.owner,
        repo: r.repo,
        recipeId: r.recipeId,
        command: command,
        prefix: "trystack-up",
      });
      track("download_script", { source: "recipe_card", repo: repoId, recipeId: r.recipeId || "default" });
    });

    const readmeBtn = el("button", { class: "btn", type: "button" }, []);
    readmeBtn.textContent = "View README";
    readmeBtn.disabled = !r.readme;
    readmeBtn.addEventListener("click", async () => {
      if (!r.readme) return;
      const md = await fetchText(r.readme);
      openReadme(`${r.title} (${r.recipeId})`, md);
      track("view_readme", { source: "recipe_card", repo: repoId, recipeId: r.recipeId || "default" });
    });

    const ghLink = el("a", { class: "btn", href: r.github || "#", target: "_blank", rel: "noreferrer" }, []);
    ghLink.textContent = "GitHub";
    if (!r.github) ghLink.setAttribute("aria-disabled", "true");

    const more = buildMoreActions([dlBtn, doctorLink, readmeBtn, ghLink]);
    const actions = el("div", { class: "recipe-actions" }, [copyBtn, protoLink, more]);

    const card = el("div", { class: "recipe-card" }, [
      header,
      meta,
      snippet,
      el("pre", { class: "recipe-pre" }, [cmd]),
      actions,
    ]);
    list.appendChild(card);
  }
}

async function loadRecipes() {
  // Prefer static build artifact; fall back to dev API.
  try {
    return await fetchJson("./data/recipes.json");
  } catch {
    return await fetchJson("/api/recipes");
  }
}

async function initRecipes() {
  const search = document.getElementById("recipeSearch");
  if (!search) return;

  try {
    initAnalytics();
    track("page_view", {});

    // Keep the UI stable but refresh to latest release tag (best-effort).
    updatePinnedUi();
    const latestTag = await resolveLatestReleaseTag();
    if (latestTag) {
      const pinnedTag = currentReleaseTag || parseTagFromNpxPackage(getNpxPackage());
      const latestVer = parseSemverTag(latestTag);
      const pinnedVer = parseSemverTag(pinnedTag);
      const shouldUseLatest = !pinnedVer || (latestVer && compareSemver(latestVer, pinnedVer) >= 0);
      if (shouldUseLatest) {
        setNpxPackage({
          npxPackage: `github:LeeJinMing/TryStack#${latestTag}`,
          tag: latestTag,
        });
      }
    }

    const data = await loadRecipes();
    const recipes = Array.isArray(data?.recipes) ? data.recipes : [];
    renderRecipes(recipes, "");
    search.addEventListener("input", () => renderRecipes(recipes, search.value));

    const CONTRIBUTING_URL = "https://github.com/LeeJinMing/TryStack/blob/main/CONTRIBUTING.md";

    // Try a repo lookup
    const repoInput = document.getElementById("repoInput");
    const repoGo = document.getElementById("repoGo");
    const repoResult = document.getElementById("repoResult");
    if (repoInput && repoGo && repoResult) {
      const renderLookup = async () => {
        const raw = String(repoInput.value || "").trim();
        const parsed = parseRepoInput(raw);
        if (!parsed) {
          repoResult.innerHTML = `<div class="bad">Please enter owner/repo or a GitHub URL</div>`;
          track("repo_lookup", { result: "invalid_input" });
          return;
        }
        const owner = parsed.owner;
        const repo = parsed.repo;
        const hits = recipes.filter((r) => r.owner === owner && r.repo === repo);
        if (hits.length === 0) {
          const scaffold = buildScaffoldCommand(owner, repo);
          track("repo_lookup", { result: "not_found", repo: `${owner}/${repo}` });
          repoResult.innerHTML = `<div class="bad">No recipe found for <b>${owner}/${repo}</b> yet.</div>
            <div class="row muted">You (or the maintainer) can add one via a PR to this repo.</div>
            <div class="row" style="display:flex;gap:10px;flex-wrap:wrap;">
              <button id="repoScaffoldCopy" class="btn primary" type="button">Copy scaffold command</button>
              <button id="repoScaffoldDl" class="btn" type="button">Download scaffold script (.cmd/.ps1)</button>
            </div>
            <div class="row"><a class="btn" href="${CONTRIBUTING_URL}" target="_blank" rel="noreferrer">How to add a recipe</a></div>`;
          const scaffoldBtn = document.getElementById("repoScaffoldCopy");
          if (scaffoldBtn) {
            scaffoldBtn.addEventListener("click", async () => {
              await copyToClipboard(scaffold);
              track("copy_command", { source: "repo_lookup_scaffold", repo: `${owner}/${repo}` });
            });
          }
          const scaffoldDl = document.getElementById("repoScaffoldDl");
          if (scaffoldDl) {
            scaffoldDl.addEventListener("click", () => {
              downloadRunScripts({
                owner,
                repo,
                recipeId: "default",
                command: scaffold,
                prefix: "trystack-scaffold",
              });
              track("download_script", { source: "repo_lookup_scaffold", repo: `${owner}/${repo}` });
            });
          }
          return;
        }

        track("repo_lookup", { result: "found", repo: `${owner}/${repo}`, recipes: hits.length });

        const options = hits
          .map((h) => `<option value="${h.recipeId}">${h.recipeId}</option>`)
          .join("");
        repoResult.innerHTML = `
          <div class="ok">Found ${hits.length} recipe(s) for <b>${owner}/${repo}</b>.</div>
          <div class="row">
            <label class="muted">recipeId</label><br/>
            <select id="repoRecipeId" class="input" style="max-width: 260px;">
              ${options}
            </select>
          </div>
          <div class="row">
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <button id="repoCopy" class="btn primary" type="button">Copy command</button>
              <a id="repoOpen" class="btn" href="#" style="text-decoration:none;">Open (1-click)</a>
              <details class="recipe-more">
                <summary class="btn">More</summary>
                <div class="recipe-more-panel">
                  <button id="repoDl" class="btn" type="button">Download script (.cmd/.ps1)</button>
                  <a id="repoDoctor" class="btn" href="#" style="text-decoration:none;">Doctor (1-click)</a>
                </div>
              </details>
            </div>
          </div>
        `;

        const sel = document.getElementById("repoRecipeId");
        const copy = document.getElementById("repoCopy");
        const buildCmd = () => {
          const rid = String(sel?.value || "default");
          return buildUpCommand(owner, repo, rid);
        };
        if (copy) {
          copy.addEventListener("click", async () => {
            await copyToClipboard(buildCmd());
            track("copy_command", { source: "repo_lookup", repo: `${owner}/${repo}`, recipeId: String(sel?.value || "default") });
          });
        }
        const dl = document.getElementById("repoDl");
        if (dl) {
          dl.addEventListener("click", () => {
            downloadRunScripts({
              owner,
              repo,
              recipeId: String(sel?.value || "default"),
              command: buildCmd(),
              prefix: "trystack-up",
            });
            track("download_script", { source: "repo_lookup", repo: `${owner}/${repo}`, recipeId: String(sel?.value || "default") });
          });
        }
        const open1 = document.getElementById("repoOpen");
        if (open1) {
          const buildUri = () => {
            const rid = String(sel?.value || "default");
            const repoParam = encodeURIComponent(`${owner}/${repo}`);
            const recipeParam = encodeURIComponent(rid);
            return `trystack://up?repo=${repoParam}&recipe=${recipeParam}`;
          };
          open1.setAttribute("href", buildUri());
          if (sel) sel.addEventListener("change", () => open1.setAttribute("href", buildUri()));
          open1.addEventListener("click", (e) => {
            e.preventDefault();
            tryOpenProtocol(open1.getAttribute("href"));
            track("open_one_click", { action: "up", source: "repo_lookup", repo: `${owner}/${repo}`, recipeId: String(sel?.value || "default") });
          });
        }

        const doctor1 = document.getElementById("repoDoctor");
        if (doctor1) {
          const buildUri = () => {
            const rid = String(sel?.value || "default");
            const repoParam = encodeURIComponent(`${owner}/${repo}`);
            const recipeParam = encodeURIComponent(rid);
            return `trystack://doctor?repo=${repoParam}&recipe=${recipeParam}`;
          };
          doctor1.setAttribute("href", buildUri());
          if (sel) sel.addEventListener("change", () => doctor1.setAttribute("href", buildUri()));
          doctor1.addEventListener("click", (e) => {
            e.preventDefault();
            tryOpenProtocol(doctor1.getAttribute("href"));
            track("open_one_click", { action: "doctor", source: "repo_lookup", repo: `${owner}/${repo}`, recipeId: String(sel?.value || "default") });
          });
        }
      };

      repoGo.addEventListener("click", renderLookup);
      repoInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") renderLookup();
      });

      const fromQuery = getRepoFromQuery();
      if (fromQuery) {
        repoInput.value = fromQuery;
        renderLookup();
      }
    }
  } catch (e) {
    setCount("failed to load");
    const list = document.getElementById("recipesList");
    if (list) list.textContent = `Failed to load recipes. ${e?.message || String(e)}`;
  }
}

initRecipes();
