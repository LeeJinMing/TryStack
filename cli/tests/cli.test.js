const test = require("node:test");
const assert = require("node:assert/strict");

const { parseRepo, parseOwnerRepo, sanitizeProjectName } = require("../lib/repo");
const { validateRecipe, validateRecipeV0, getMissingEnv } = require("../lib/recipe");
const { parseComposePsJson, hasRunningFromPsJson, hasRunningFromPsText } = require("../lib/docker");

test("parseRepo supports owner/repo and github urls", () => {
  assert.deepEqual(parseRepo("foo/bar"), { owner: "foo", repo: "bar" });
  assert.deepEqual(parseRepo("https://github.com/foo/bar"), { owner: "foo", repo: "bar" });
  assert.deepEqual(parseRepo("https://github.com/foo/bar.git"), { owner: "foo", repo: "bar" });
  assert.deepEqual(parseRepo("git@github.com:foo/bar.git"), { owner: "foo", repo: "bar" });
  assert.equal(parseRepo("invalid"), null);
});

test("parseOwnerRepo validates owner/repo", () => {
  assert.deepEqual(parseOwnerRepo("foo/bar"), { owner: "foo", repo: "bar" });
  assert.equal(parseOwnerRepo("foo"), null);
});

test("sanitizeProjectName lowercases and trims", () => {
  assert.equal(sanitizeProjectName("Foo/Bar"), "foo_bar");
  assert.equal(sanitizeProjectName("A".repeat(80)).length, 50);
});

test("validateRecipe flags missing fields", () => {
  const errors = validateRecipe({ apiVersion: "githubui.recipes/v0" });
  assert.ok(errors.length > 0);
});

test("validateRecipeV0 enforces apiVersion and id", () => {
  const errors = validateRecipeV0({
    apiVersion: "wrong",
    id: "",
    target: { owner: "a", repo: "b", ref: "x" },
    runtime: { type: "compose", composeFile: "compose.yaml" },
    ui: { url: "http://localhost:3000", healthcheck: { method: "GET", path: "/", expectStatus: 200 } },
    env: { required: [], optional: [] },
  });
  assert.ok(errors.some((e) => e.includes("apiVersion must be")));
  assert.ok(errors.some((e) => e.includes("id is required")));
});

test("parseComposePsJson handles docker compose ps --format json", () => {
  const input = JSON.stringify([
    { Name: "app", State: "running", Status: "Up 2 minutes", Health: "" },
  ]);
  const parsed = parseComposePsJson(input);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].name, "app");
  assert.equal(parsed[0].state, "running");
});

test("running detection works for text and json", () => {
  assert.equal(hasRunningFromPsText("app  running"), true);
  assert.equal(hasRunningFromPsText("app  exited"), false);
  assert.equal(hasRunningFromPsJson([{ state: "running" }]), true);
  assert.equal(hasRunningFromPsJson([{ status: "Exited" }]), false);
});

test("getMissingEnv returns absent required keys", () => {
  process.env.TEST_REQUIRED_A = "";
  delete process.env.TEST_REQUIRED_B;
  process.env.TEST_REQUIRED_C = "ok";
  const missing = getMissingEnv(["TEST_REQUIRED_A", "TEST_REQUIRED_B", "TEST_REQUIRED_C"]);
  assert.deepEqual(missing.sort(), ["TEST_REQUIRED_A", "TEST_REQUIRED_B"].sort());
});
