const yearEl = document.getElementById("year");
if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear());
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

    const actions = el("div", { class: "recipe-actions" }, [copyBtn, readmeBtn, ghLink]);

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
    return await fetchJson("/data/recipes.json");
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

    // Try a repo lookup
    const repoInput = document.getElementById("repoInput");
    const repoGo = document.getElementById("repoGo");
    const repoResult = document.getElementById("repoResult");
    if (repoInput && repoGo && repoResult) {
      const renderLookup = async () => {
        const raw = String(repoInput.value || "").trim();
        const m = raw.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
        if (!m) {
          repoResult.innerHTML = `<div class="bad">Please enter owner/repo</div>`;
          return;
        }
        const owner = m[1];
        const repo = m[2];
        const hits = recipes.filter((r) => r.owner === owner && r.repo === repo);
        if (hits.length === 0) {
          repoResult.innerHTML = `<div class="bad">No recipe found for <b>${owner}/${repo}</b> yet.</div>`;
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
            <button id="repoCopy" class="btn primary" type="button">Copy command</button>
          </div>
        `;

        const sel = document.getElementById("repoRecipeId");
        const copy = document.getElementById("repoCopy");
        const buildCmd = () => {
          const rid = String(sel?.value || "default");
          const args = rid === "default" ? `trystack up ${owner}/${repo}` : `trystack up ${owner}/${repo} --recipe ${rid}`;
          return `npx --yes -p github:LeeJinMing/TryStack ${args}`;
        };
        if (copy) {
          copy.addEventListener("click", async () => {
            await copyToClipboard(buildCmd());
          });
        }
      };

      repoGo.addEventListener("click", renderLookup);
      repoInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") renderLookup();
      });
    }
  } catch (e) {
    setCount("failed to load");
    const list = document.getElementById("recipesList");
    if (list) list.textContent = `Failed to load recipes. ${e?.message || String(e)}`;
  }
}

initRecipes();
