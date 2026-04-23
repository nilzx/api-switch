#!/usr/bin/env node

const { run } = require("../src/index.js");

run({
  argv: process.argv.slice(2)
}).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
