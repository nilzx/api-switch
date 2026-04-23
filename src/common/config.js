"use strict";

const fs = require("node:fs/promises");
const os = require("node:os");
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

async function loadConfig(configPath, options = {}) {
  const content = await fs.readFile(configPath, "utf8");
  const parsed = parseTomlString(content);
  const configDirectory = path.dirname(configPath);
  const homeDirectory = options.homeDirectory ?? os.homedir();

  return {
    claude: resolveTargetConfig(parsed.claude, configDirectory, homeDirectory),
    codex: resolveTargetConfig(parsed.codex, configDirectory, homeDirectory)
  };
}

function resolveTargetConfig(targetConfig, configDirectory, homeDirectory) {
  return {
    loadPath: targetConfig.loadPath
      ? resolveConfigPath(configDirectory, targetConfig.loadPath, homeDirectory)
      : null,
    providers: targetConfig.providers.filter(isValidProviderRecord).map((provider) => ({
      name: provider.name,
      key: provider.key,
      url: provider.url
    }))
  };
}

function resolveConfigPath(configDirectory, rawPath, homeDirectory = os.homedir()) {
  if (rawPath === "~") {
    return homeDirectory;
  }

  if (rawPath.startsWith("~/") || rawPath.startsWith("~\\")) {
    const relativeSegments = rawPath
      .slice(2)
      .split(/[\\/]+/)
      .filter(Boolean);
    return path.join(homeDirectory, ...relativeSegments);
  }

  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }

  return path.resolve(configDirectory, rawPath);
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
