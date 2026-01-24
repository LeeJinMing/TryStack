/* eslint-disable no-console */
const path = require("node:path");
const { EXIT } = require("../lib/constants");
const { getArgValue } = require("../lib/args");
const { parseRepo, sanitizeProjectName } = require("../lib/repo");
const { ensureDir, writeFileIfChanged } = require("../lib/files");

function usageScaffold() {
  console.log(
    [
      "trystack scaffold <owner/repo|repo-url> [options]",
      "",
      "Options:",
      "  --recipe <id>   recipeId folder name (default: default)",
      "  --dry-run       Print what would be created (no files written)",
      "",
      "Example:",
      "  trystack scaffold louislam/uptime-kuma",
      "  trystack scaffold https://github.com/louislam/uptime-kuma --recipe default",
      "  trystack scaffold filebrowser/filebrowser --dry-run",
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

async function scaffoldCommand({ input, args }) {
  const repo = parseRepo(input);
  if (!repo) {
    usageScaffold();
    return EXIT.USAGE;
  }

  const recipeId = getArgValue(args, "--recipe") || "default";
  const dryRun = args.includes("--dry-run");

  // IMPORTANT:
  // Scaffold should write into the user's current directory (not into the CLI install folder).
  // This allows `npx ... trystack scaffold ...` to generate files in-place.
  const base = process.cwd();
  const recipeDir = path.join(base, "recipes", repo.owner, repo.repo, recipeId);

  // Compose project name is used elsewhere; keep it stable for future docs.
  // (Not used by scaffold itself.)
  const projectName = sanitizeProjectName(`ghui_${repo.owner}_${repo.repo}_${recipeId}`);

  const files = [
    { rel: path.join("recipes", repo.owner, repo.repo, recipeId, "recipe.yaml"), content: templateRecipeYaml({ owner: repo.owner, repo: repo.repo, recipeId }) },
    { rel: path.join("recipes", repo.owner, repo.repo, recipeId, "compose.yaml"), content: templateComposeYaml() },
    { rel: path.join("recipes", repo.owner, repo.repo, recipeId, "README.md"), content: templateReadmeMd({ owner: repo.owner, repo: repo.repo, recipeId }) },
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

