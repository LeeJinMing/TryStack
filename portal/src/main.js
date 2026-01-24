const yearEl = document.getElementById("year");
if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear());
}

const NPX_PACKAGE = (typeof window !== "undefined" && window.TRYSTACK_NPX_PACKAGE) || "github:LeeJinMing/TryStack#v0.0.2";

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
    "setlocal",
    "echo.",
    "echo TryStack (generated script). Review the command before running.",
    "echo.",
    `echo ${cmd.replace(/%/g, "%%")}`,
    "echo.",
    cmd,
    "echo.",
    "echo Done. Press any key to close.",
    "pause >nul",
    "",
  ].join("\r\n");
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
    cmd,
    "",
    'Write-Host ""',
    'Write-Host "Done."',
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
    const cmd = el("code", { class: "recipe-cmd", text: r.command });

    const copyBtn = el("button", { class: "btn primary", type: "button" }, []);
    copyBtn.textContent = "Copy command";
    copyBtn.addEventListener("click", async () => {
      await copyToClipboard(r.command);
    });

    const dlBtn = el("button", { class: "btn", type: "button" }, []);
    dlBtn.textContent = "Download script (.cmd/.ps1)";
    dlBtn.addEventListener("click", () => {
      downloadRunScripts({
        owner: r.owner,
        repo: r.repo,
        recipeId: r.recipeId,
        command: r.command,
        prefix: "trystack-up",
      });
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

    const readmeBtn = el("button", { class: "btn", type: "button" }, []);
    readmeBtn.textContent = "View README";
    readmeBtn.disabled = !r.readme;
    readmeBtn.addEventListener("click", async () => {
      if (!r.readme) return;
      const md = await fetchText(r.readme);
      openReadme(`${r.title} (${r.recipeId})`, md);
    });

    const ghLink = el("a", { class: "btn", href: r.github || "#", target: "_blank", rel: "noreferrer" }, []);
    ghLink.textContent = "GitHub";
    if (!r.github) ghLink.setAttribute("aria-disabled", "true");

    const actions = el("div", { class: "recipe-actions" }, [copyBtn, dlBtn, protoLink, doctorLink, readmeBtn, ghLink]);

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
          return;
        }
        const owner = parsed.owner;
        const repo = parsed.repo;
        const hits = recipes.filter((r) => r.owner === owner && r.repo === repo);
        if (hits.length === 0) {
          const scaffold = `npx --yes -p ${NPX_PACKAGE} trystack scaffold ${owner}/${repo}`;
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
            });
          }
          return;
        }

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
              <button id="repoDl" class="btn" type="button">Download script (.cmd/.ps1)</button>
              <a id="repoOpen" class="btn" href="#" style="text-decoration:none;">Open (1-click)</a>
              <a id="repoDoctor" class="btn" href="#" style="text-decoration:none;">Doctor (1-click)</a>
            </div>
          </div>
        `;

        const sel = document.getElementById("repoRecipeId");
        const copy = document.getElementById("repoCopy");
        const buildCmd = () => {
          const rid = String(sel?.value || "default");
          const args = rid === "default" ? `trystack up ${owner}/${repo}` : `trystack up ${owner}/${repo} --recipe ${rid}`;
          return `npx --yes -p ${NPX_PACKAGE} ${args}`;
        };
        if (copy) {
          copy.addEventListener("click", async () => {
            await copyToClipboard(buildCmd());
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
