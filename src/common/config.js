"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { DEFAULT_CONFIG_TEMPLATE, buildPaths } = require("./constants.js");
const { parseTomlString } = require("./toml.js");

async function ensureInitialized(homeDir) {
  const paths = buildPaths(homeDir);
  await fs.mkdir(paths.apiSwitchDir, { recursive: true });

  if (!(await pathExists(paths.configPath))) {
    await fs.writeFile(paths.configPath, DEFAULT_CONFIG_TEMPLATE, "utf8");
  }

  return paths;
}

async function loadConfig(configPath) {
  const content = await fs.readFile(configPath, "utf8");
  const parsed = parseTomlString(content);
  const configDirectory = path.dirname(configPath);

  return {
    claude: resolveTargetConfig(parsed.claude, configDirectory),
    codex: resolveTargetConfig(parsed.codex, configDirectory)
  };
}

function resolveTargetConfig(targetConfig, configDirectory) {
  return {
    loadPath: targetConfig.loadPath
      ? path.resolve(configDirectory, targetConfig.loadPath)
      : null,
    providers: targetConfig.providers.filter(isValidProviderRecord).map((provider) => ({
      name: provider.name,
      key: provider.key,
      url: provider.url
    }))
  };
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function isValidProviderRecord(provider) {
  return Boolean(
    provider &&
      typeof provider.name === "string" &&
      provider.name &&
      typeof provider.key === "string" &&
      typeof provider.url === "string"
  );
}

module.exports = {
  ensureInitialized,
  loadConfig,
  pathExists
};
