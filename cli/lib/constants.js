const COMMANDS = new Set(["up", "ps", "logs", "stop", "down", "list", "print", "doctor", "verify-recipes", "scaffold"]);
const DEFAULT_REGISTRY = { owner: "LeeJinMing", repo: "TryStack", ref: "main" };
const EXIT = Object.freeze({
  OK: 0,
  USAGE: 1,
  NOT_FOUND: 2,
  UI_TIMEOUT: 3,
  PORT_IN_USE: 4,
  REGISTRY_ERROR: 5,
  RECIPE_INVALID: 6,
  ENV_MISSING: 7,
  DOCKER_MISSING: 127,
});

module.exports = {
  COMMANDS,
  DEFAULT_REGISTRY,
  EXIT,
};
