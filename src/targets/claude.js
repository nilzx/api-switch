"use strict";

const fs = require("node:fs/promises");
const {
  DEFAULT_CLAUDE_SETTINGS,
  MISSING_CLAUDE_INSTALLATION_MESSAGE,
  RESTORE_OFFICIAL_LOGIN_LABEL
} = require("../common/constants.js");
const { pathExists } = require("../common/config.js");
const { buildSelectionOptions } = require("../common/providers.js");
const {
  isPlainObject,
  readJsonObject,
  readOrCreateJsonObject,
  writeJson
} = require("../common/json.js");

async function ensureReady(paths) {
  if (!(await pathExists(paths.claudeDir))) {
    const error = new Error(MISSING_CLAUDE_INSTALLATION_MESSAGE);
    error.code = "CLAUDE_NOT_FOUND";
    throw error;
  }
}

async function collectSelectionOptions(config) {
  return buildSelectionOptions(config, {
    actionOptions: [
      {
        id: "claude:action:restore-official-login",
        name: RESTORE_OFFICIAL_LOGIN_LABEL,
        label: RESTORE_OFFICIAL_LOGIN_LABEL,
        source: "action",
        action: "restore-official-login"
      }
    ],
    idPrefix: "claude"
  });
}

async function applySelection(paths, selection) {
  if (selection.action === "restore-official-login") {
    await disableOnboardingIfCompleted(paths.claudeStatePath);
    await removeClaudeSettingsKeys(paths.claudeSettingsPath);
    return selection;
  }

  await ensureOnboardingEnabled(paths.claudeStatePath);
  await updateClaudeSettings(paths.claudeSettingsPath, selection);
  return selection;
}

async function ensureSettingsFile(settingsPath) {
  await fs.mkdir(require("node:path").dirname(settingsPath), { recursive: true });

  try {
    await fs.access(settingsPath);
  } catch {
    await writeJson(settingsPath, structuredClone(DEFAULT_CLAUDE_SETTINGS));
  }
}

async function updateClaudeSettings(settingsPath, selection) {
  await ensureSettingsFile(settingsPath);
  const data = await readJsonObject(settingsPath, "Claude settings");
  data.env = ensureEnvObject(data);
  data.env.ANTHROPIC_AUTH_TOKEN = selection.key;
  data.env.ANTHROPIC_BASE_URL = selection.url;
  await writeJson(settingsPath, data);
  return data;
}

async function removeClaudeSettingsKeys(settingsPath) {
  let data;

  try {
    data = await readJsonObject(settingsPath, "Claude settings");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }

  if (!isPlainObject(data.env)) {
    if (data.env === undefined) {
      return data;
    }

    throw new Error("Claude settings env must be a JSON object.");
  }

  delete data.env.ANTHROPIC_AUTH_TOKEN;
  delete data.env.ANTHROPIC_BASE_URL;
  await writeJson(settingsPath, data);
  return data;
}

async function ensureOnboardingEnabled(claudeStatePath) {
  const data = await readOrCreateJsonObject(claudeStatePath, "Claude state");
  data.hasCompletedOnboarding = true;
  await writeJson(claudeStatePath, data);
  return data;
}

async function disableOnboardingIfCompleted(claudeStatePath) {
  let data;

  try {
    data = await readJsonObject(claudeStatePath, "Claude state");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }

  if (data.hasCompletedOnboarding === true) {
    data.hasCompletedOnboarding = false;
    await writeJson(claudeStatePath, data);
  }

  return data;
}

function ensureEnvObject(data) {
  if (data.env === undefined) {
    data.env = {};
  }

  if (!isPlainObject(data.env)) {
    throw new Error("Claude settings env must be a JSON object.");
  }

  return data.env;
}

module.exports = {
  applySelection,
  collectSelectionOptions,
  disableOnboardingIfCompleted,
  ensureOnboardingEnabled,
  ensureReady,
  removeClaudeSettingsKeys,
  updateClaudeSettings
};
