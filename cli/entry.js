#!/usr/bin/env node
const { main } = require("./app");

if (require.main === module) {
  main().catch((err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
  });
}

