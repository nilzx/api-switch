"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

async function buildSelectionOptions(config, options = {}) {
  const actionOptions = options.actionOptions ?? [];
  const idPrefix = options.idPrefix ?? "provider";
  const fileProviders = config.loadPath
    ? await loadProvidersFromDirectory(config.loadPath, idPrefix)
    : [];
  const inlineProviders = config.providers.map((provider) => ({
    id: `${idPrefix}:provider:${provider.name}`,
    name: provider.name,
    key: provider.key,
    url: provider.url,
    source: "provider"
  }));

  return [...actionOptions, ...decorateDuplicateNames([...fileProviders, ...inlineProviders])];
}

async function loadProvidersFromDirectory(directoryPath, idPrefix = "provider") {
  let entries;

  try {
    entries = await fs.readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const pairs = new Map();

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name);
    if (extension !== ".key" && extension !== ".url") {
      continue;
    }

    const baseName = path.basename(entry.name, extension);
    const bucket = pairs.get(baseName) ?? {};
    bucket[extension] = path.join(directoryPath, entry.name);
    pairs.set(baseName, bucket);
  }

  const providers = [];

  for (const [baseName, files] of pairs.entries()) {
    if (!files[".key"] || !files[".url"]) {
      continue;
    }

    const [key, url] = await Promise.all([
      readTrimmedFile(files[".key"]),
      readTrimmedFile(files[".url"])
    ]);

    providers.push({
      id: `${idPrefix}:file:${baseName}`,
      name: baseName,
      key,
      url,
      source: "file"
    });
  }

  providers.sort((left, right) => left.name.localeCompare(right.name));
  return providers;
}

async function readTrimmedFile(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return content.trim();
}

function decorateDuplicateNames(options) {
  const counts = new Map();

  for (const option of options) {
    counts.set(option.name, (counts.get(option.name) ?? 0) + 1);
  }

  return options.map((option) => ({
    ...option,
    label:
      counts.get(option.name) > 1
        ? `${option.name} [${option.source}]`
        : option.name
  }));
}

module.exports = {
  buildSelectionOptions,
  loadProvidersFromDirectory
};
