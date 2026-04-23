"use strict";

const os = require("node:os");
const { ensureInitialized, loadConfig } = require("./common/config.js");
const { promptSelection } = require("./common/prompt.js");
const { SUPPORTED_TARGETS } = require("./common/constants.js");
const claudeTarget = require("./targets/claude.js");
const codexTarget = require("./targets/codex.js");

async function run(options = {}) {
  const argv = options.argv ?? process.argv.slice(2);
  const targetName = parseTargetName(argv);
  const homeDir = options.homeDir ?? os.homedir();
  const paths = await ensureInitialized(homeDir);
  const target = getTarget(targetName);

  await target.ensureReady(paths);

  const config = await loadConfig(paths.configPath);
  const selectionOptions = await target.collectSelectionOptions(config[targetName]);
  const selected = await promptSelection(selectionOptions, {
    input: options.input,
    output: options.output
  });

  if (!selected) {
    return null;
  }

  await target.applySelection(paths, selected);
  return {
    selection: selected,
    target: targetName
  };
}

module.exports = {
  getTarget,
  parseTargetName,
  run
};

function parseTargetName(argv) {
  const targetName = argv[0];

  if (!SUPPORTED_TARGETS.includes(targetName)) {
    throw new Error(`Usage: api-switch <${SUPPORTED_TARGETS.join("|")}>`);
  }

  return targetName;
}

function getTarget(targetName) {
  if (targetName === "claude") {
    return claudeTarget;
  }

  if (targetName === "codex") {
    return codexTarget;
  }

  throw new Error(`Unsupported target: ${targetName}`);
}
