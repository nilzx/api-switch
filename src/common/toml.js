"use strict";

function parseTomlString(input) {
  const result = {
    claude: createEmptyTargetConfig(),
    codex: createEmptyTargetConfig()
  };

  let currentSection = null;
  let currentProvider = null;
  let currentProviderTarget = null;
  const lines = input.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const providerHeaderMatch = /^\[\[(claude|codex)\.providers\]\]$/.exec(line);
    if (providerHeaderMatch) {
      currentProviderTarget = providerHeaderMatch[1];
      currentProvider = {};
      result[currentProviderTarget].providers.push(currentProvider);
      continue;
    }

    const sectionHeaderMatch = /^\[(claude|codex)\]$/.exec(line);
    if (sectionHeaderMatch) {
      currentSection = sectionHeaderMatch[1];
      currentProvider = null;
      currentProviderTarget = null;
      continue;
    }

    const match = /^([A-Za-z0-9_-]+)\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*')\s*$/.exec(line);
    if (!match) {
      throw new Error(`Unsupported TOML syntax at line ${index + 1}.`);
    }

    const [, key, rawValue] = match;
    const value = parseTomlValue(rawValue);

    if (currentProvider) {
      if (key === "name" || key === "key" || key === "url") {
        currentProvider[key] = value;
      }
      continue;
    }

    if (!currentSection) {
      throw new Error(`Unsupported TOML syntax at line ${index + 1}.`);
    }

    const targetName = currentSection;
    if (key === "load_path") {
      result[targetName].loadPath = value;
    }
  }

  return result;
}

function createEmptyTargetConfig() {
  return {
    loadPath: null,
    providers: []
  };
}

function parseTomlValue(rawValue) {
  if (rawValue.startsWith("\"")) {
    return JSON.parse(rawValue);
  }

  if (rawValue.startsWith("'")) {
    return rawValue.slice(1, -1);
  }

  throw new Error("Unsupported TOML value.");
}

module.exports = {
  parseTomlString
};
