/* eslint-disable no-console */
const path = require("node:path");
const { EXIT } = require("../lib/constants");
const { getArgValue } = require("../lib/args");
const { parseRepo, sanitizeProjectName } = require("../lib/repo");
const { ensureDir, writeFileIfChanged } = require("../lib/files");
const { verifyRecipeDirAgainstPolicy } = require("../lib/policy");
const YAML = require("yaml");

async function generateWithAiOpenAiCompatible({ owner, repo, recipeId, model, baseUrl }) {
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey.trim()) throw new Error("Missing OPENAI_API_KEY for --ai");

  const effectiveBaseUrl = String(baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  const effectiveModel = model || process.env.OPENAI_MODEL || "gpt-4o-mini";

  const url = `${effectiveBaseUrl}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: effectiveModel,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You generate minimal, safe, local-evaluation docker compose recipes. Output must be STRICT JSON only.",
        },
        {
          role: "user",
          content: [
            `Target GitHub repo: ${owner}/${repo}`,
            `recipeId: ${recipeId}`,
            "",
            "Generate 3 files for a TryStack recipe:",
            "- recipe.yaml (githubui.recipes/v0)",
            "- compose.yaml (Docker Compose)",
            "- README.md (1 page)",
            "",
            "Hard constraints:",
            "- recipe.yaml: apiVersion githubui.recipes/v0; id must equal recipeId; target.owner/target.repo must match.",
            "- runtime.type must be compose; runtime.composeFile must be compose.yaml.",
            "- Provide ports/ui.url/ui.healthcheck. Prefer a stable healthcheck path (NOT just '/'). If you must use '/', include a non-empty match.",
            "- compose.yaml: minimal services needed to run locally. No privileged, no host network, no docker.sock mounts.",
            "",
            "Return JSON with keys: recipeYaml, composeYaml, readmeMd.",
          ].join("\n"),
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI request failed (${res.status}): ${text || res.statusText}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") throw new Error("AI response missing choices[0].message.content");

  let obj;
  try {
    obj = JSON.parse(content);
  } catch (e) {
    throw new Error(`AI response is not valid JSON: ${e?.message || String(e)}`);
  }

  const recipeYaml = typeof obj.recipeYaml === "string" ? obj.recipeYaml : "";
  const composeYaml = typeof obj.composeYaml === "string" ? obj.composeYaml : "";
  const readmeMd = typeof obj.readmeMd === "string" ? obj.readmeMd : "";

  if (!recipeYaml.trim() || !composeYaml.trim() || !readmeMd.trim()) {
    throw new Error("AI JSON must include non-empty recipeYaml/composeYaml/readmeMd strings");
  }

  return { recipeYaml, composeYaml, readmeMd, effectiveModel, effectiveBaseUrl };
}

function normalizeRecipeYaml({ recipeYaml, owner, repo, recipeId }) {
  let y;
  try {
    y = YAML.parse(recipeYaml);
  } catch (e) {
    throw new Error(`AI recipeYaml is not valid YAML: ${e?.message || String(e)}`);
  }

  if (!y || typeof y !== "object") throw new Error("AI recipeYaml is empty/invalid YAML");
  y.apiVersion = "githubui.recipes/v0";
  y.id = recipeId;
  y.target = y.target && typeof y.target === "object" ? y.target : {};
  y.target.owner = owner;
  y.target.repo = repo;
  if (!y.target.ref) y.target.ref = ">=0.0.0";
  y.runtime = { type: "compose", composeFile: "compose.yaml" };
  return YAML.stringify(y).trimEnd() + "\n";
}

function usageScaffold() {
  console.log(
    [
      "trystack scaffold <owner/repo|repo-url> [options]",
      "",
      "Options:",
      "  --recipe <id>   recipeId folder name (default: default)",
      "  --ai            Use BYOK AI to fill recipe.yaml/compose.yaml/README.md",
      "  --ai-model <m>  AI model name (OpenAI compatible)",
      "  --ai-base-url <url> OpenAI compatible base URL (default: https://api.openai.com/v1)",
      "  --policy-mode <community|verified> Validate generated recipe against policy (default: community)",
      "  --dry-run       Print what would be created (no files written)",
      "",
      "Example:",
      "  trystack scaffold louislam/uptime-kuma",
      "  trystack scaffold https://github.com/louislam/uptime-kuma --recipe default",
      "  trystack scaffold filebrowser/filebrowser --dry-run",
      "  trystack scaffold filebrowser/filebrowser --ai --policy-mode community",
      "",
    ].join("\n"),
  );
}

function templateRecipeYaml({ owner, repo, recipeId }) {
  // Keep this intentionally simple (MVP). Maintainers edit ports/image/ref.
  return [
    "apiVersion: githubui.recipes/v0",
    `id: ${recipeId}`,
    "",
    "target:",
    `  owner: ${owner}`,
    `  repo: ${repo}`,
    '  ref: "CHANGE_ME"',
    "",
    "runtime:",
    "  type: compose",
    "  composeFile: compose.yaml",
    "",
    "ports:",
    "  - name: ui",
    "    service: app",
    "    protocol: http",
    "    hostPort: 3000",
    "    containerPort: 3000",
    "",
    "ui:",
    '  url: "http://localhost:3000"',
    "  healthcheck:",
    "    method: GET",
    "    path: /",
    "    expectStatus: 200",
    '    match: ""',
    "",
    "env:",
    "  required: []",
    "  optional: []",
    "",
    "notes:",
    "  setup: |",
    "    CHANGE_ME: first-run setup steps",
    "  limitations: |",
    "    CHANGE_ME: limitations / what this recipe does not cover",
    "",
  ].join("\n");
}

function templateComposeYaml() {
  return [
    "services:",
    "  app:",
    "    image: REPLACE_ME",
    '    ports: ["3000:3000"]',
    "",
  ].join("\n");
}

function templateReadmeMd({ owner, repo, recipeId }) {
  return [
    `# ${owner}/${repo} (${recipeId})`,
    "",
    "- Try locally: run the command below, then open the printed URL in your browser.",
    "",
    "```bash",
    recipeId === "default"
      ? `npx --yes -p github:LeeJinMing/TryStack#v0.0.2 trystack up ${owner}/${repo}`
      : `npx --yes -p github:LeeJinMing/TryStack#v0.0.2 trystack up ${owner}/${repo} --recipe ${recipeId}`,
    "```",
    "",
    "## Notes",
    "",
    "- Fill in `recipe.yaml` (`target.ref`, ports, healthcheck match).",
    "- Update `compose.yaml` with the real image and any required volumes/env.",
    "",
  ].join("\n");
}

function buildProvenance({ effectiveModel, effectiveBaseUrl }) {
  const generatedAt = new Date().toISOString();
  return {
    generatedAt,
    generatedBy: "trystack scaffold --ai",
    aiModel: effectiveModel || null,
    aiBaseUrl: effectiveBaseUrl || null,
  };
}

function appendProvenanceToReadme(readmeMd, provenance) {
  const p = provenance || {};
  return [
    readmeMd.trimEnd(),
    "",
    "## Provenance",
    "",
    "- generatedBy: `trystack scaffold --ai`",
    `- generatedAt: \`${p.generatedAt || ""}\``,
    p.aiModel ? `- aiModel: \`${p.aiModel}\`` : "- aiModel: `<unknown>`",
    p.aiBaseUrl ? `- aiBaseUrl: \`${p.aiBaseUrl}\`` : "- aiBaseUrl: `<unknown>`",
    "",
  ].join("\n");
}

function prependProvenanceToCompose(composeYaml, provenance) {
  const p = provenance || {};
  const header = `# Generated by trystack scaffold --ai at ${p.generatedAt || ""}${p.aiModel ? ` (model=${p.aiModel})` : ""}`;
  const body = String(composeYaml || "").trimStart();
  return `${header}\n${body.trimEnd()}\n`;
}

async function scaffoldCommand({ input, args }) {
  const repo = parseRepo(input);
  if (!repo) {
    usageScaffold();
    return EXIT.USAGE;
  }

  const recipeId = getArgValue(args, "--recipe") || "default";
  const useAi = args.includes("--ai");
  const aiModel = getArgValue(args, "--ai-model");
  const aiBaseUrl = getArgValue(args, "--ai-base-url");
  const policyMode = (getArgValue(args, "--policy-mode") || "community").trim().toLowerCase();
  if (!["community", "verified"].includes(policyMode)) {
    console.error(`Invalid --policy-mode: ${policyMode} (expected: community|verified)`);
    return EXIT.USAGE;
  }
  const dryRun = args.includes("--dry-run");

  // IMPORTANT:
  // Scaffold should write into the user's current directory (not into the CLI install folder).
  // This allows `npx ... trystack scaffold ...` to generate files in-place.
  const base = process.cwd();
  const recipeDir = path.join(base, "recipes", repo.owner, repo.repo, recipeId);

  // Compose project name is used elsewhere; keep it stable for future docs.
  // (Not used by scaffold itself.)
  const projectName = sanitizeProjectName(`ghui_${repo.owner}_${repo.repo}_${recipeId}`);

  let recipeYaml = templateRecipeYaml({ owner: repo.owner, repo: repo.repo, recipeId });
  let composeYaml = templateComposeYaml();
  let readmeMd = templateReadmeMd({ owner: repo.owner, repo: repo.repo, recipeId });
  let provenance = null;

  if (useAi) {
    try {
      const ai = await generateWithAiOpenAiCompatible({
        owner: repo.owner,
        repo: repo.repo,
        recipeId,
        model: aiModel,
        baseUrl: aiBaseUrl,
      });
      recipeYaml = normalizeRecipeYaml({ recipeYaml: ai.recipeYaml, owner: repo.owner, repo: repo.repo, recipeId });

      provenance = buildProvenance({ effectiveModel: ai.effectiveModel, effectiveBaseUrl: ai.effectiveBaseUrl });

      composeYaml = prependProvenanceToCompose(ai.composeYaml, provenance);
      readmeMd = appendProvenanceToReadme(ai.readmeMd, provenance);
    } catch (e) {
      console.error(`AI scaffold failed: ${e?.message || String(e)}`);
      return EXIT.USAGE;
    }
  }

  const files = [
    { rel: path.join("recipes", repo.owner, repo.repo, recipeId, "recipe.yaml"), content: recipeYaml },
    { rel: path.join("recipes", repo.owner, repo.repo, recipeId, "compose.yaml"), content: composeYaml },
    { rel: path.join("recipes", repo.owner, repo.repo, recipeId, "README.md"), content: readmeMd },
  ];

  if (dryRun) {
    console.log(`Repo: ${repo.owner}/${repo.repo}`);
    console.log(`recipeId: ${recipeId}`);
    console.log(`dir: ${recipeDir}`);
    console.log(`projectName: ${projectName}`);
    console.log("");
    console.log("Would write:");
    for (const f of files) console.log(`- ${f.rel}`);
    console.log("");
    return EXIT.OK;
  }

  ensureDir(recipeDir);
  for (const f of files) {
    const abs = path.join(base, f.rel);
    writeFileIfChanged(abs, f.content);
  }

  // Policy validation (static, local): fail-fast for verified mode; warn-only for community mode.
  try {
    const res = verifyRecipeDirAgainstPolicy({
      recipeDir,
      owner: repo.owner,
      repo: repo.repo,
      recipeId,
      mode: policyMode,
    });
    if (res.errors.length > 0) {
      console.error("");
      console.error(`Policy check (${policyMode}) failed:`);
      for (const e of res.errors) console.error(`- ERROR: ${e}`);
      for (const w of res.warnings) console.error(`- WARN:  ${w}`);
      return EXIT.RECIPE_INVALID;
    }
    if (res.warnings.length > 0) {
      console.log("");
      console.log(`Policy warnings (${policyMode}):`);
      for (const w of res.warnings) console.log(`- WARN: ${w}`);
    }
  } catch (e) {
    console.error(`Policy check failed to run: ${e?.message || String(e)}`);
    return EXIT.RECIPE_INVALID;
  }

  console.log(`Created scaffold for ${repo.owner}/${repo.repo} (${recipeId})`);
  console.log(`- ${path.join("recipes", repo.owner, repo.repo, recipeId)}`);
  console.log(`dir: ${recipeDir}`);
  console.log("");
  console.log("Next:");
  console.log("- Edit recipe.yaml + compose.yaml + README.md");
  console.log("- Run: node cli/entry.js verify-recipes --json");
  console.log("- Open a PR");
  console.log("");
  return EXIT.OK;
}

module.exports = {
  scaffoldCommand,
  usageScaffold,
};

