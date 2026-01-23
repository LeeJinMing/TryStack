const fs = require("node:fs");
const path = require("node:path");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeFileIfChanged(p, content) {
  if (fs.existsSync(p)) {
    const prev = fs.readFileSync(p, "utf8");
    if (prev === content) return;
  }
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content, "utf8");
}

module.exports = {
  ensureDir,
  writeFileIfChanged,
};
