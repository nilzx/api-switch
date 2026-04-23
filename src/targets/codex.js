"use strict";

const fs = require("node:fs/promises");
const { RESTORE_OFFICIAL_LOGIN_LABEL } = require("../common/constants.js");
const { buildSelectionOptions } = require("../common/providers.js");
const { writeJson } = require("../common/json.js");
const { removeTomlAssignment, setTomlAssignment } = require("../common/toml-edit.js");

async function ensureReady(paths) {
  await fs.mkdir(paths.codexDir, { recursive: true });
}

async function collectSelectionOptions(config) {
  return buildSelectionOptions(config, {
    actionOptions: [
      {
        id: "codex:action:restore-official-login",
        name: RESTORE_OFFICIAL_LOGIN_LABEL,
        label: RESTORE_OFFICIAL_LOGIN_LABEL,
        source: "action",
        action: "restore-official-login"
      }
    ],
    idPrefix: "codex"
  });
}

async function applySelection(paths, selection) {
  if (selection.action === "restore-official-login") {
    await restoreOfficialLogin(paths);
    return selection;
  }

  await applyThirdPartyProvider(paths, selection);
  return selection;
}

async function applyThirdPartyProvider(paths, selection) {
  await fs.mkdir(paths.codexDir, { recursive: true });

  let configContent = "";
  try {
    configContent = await fs.readFile(paths.codexConfigPath, "utf8");
  } catch (error) {
    if (!error || error.code !== "ENOENT") {
      throw error;
    }
  }

  configContent = setTomlAssignment(configContent, [], "model_provider", "\"active\"");
  configContent = setTomlAssignment(
    configContent,
    [],
    "disable_response_storage",
    "true"
  );
  configContent = setTomlAssignment(
    configContent,
    [],
    "preferred_auth_method",
    "\"apikey\""
  );
  configContent = setTomlAssignment(
    configContent,
    ["model_providers", "active"],
    "name",
    "\"active\""
  );
  configContent = setTomlAssignment(
    configContent,
    ["model_providers", "active"],
    "base_url",
    formatTomlString(selection.url)
  );
  configContent = setTomlAssignment(
    configContent,
    ["model_providers", "active"],
    "wire_api",
    "\"responses\""
  );
  configContent = setTomlAssignment(
    configContent,
    ["model_providers", "active"],
    "requires_openai_auth",
    "true"
  );

  await fs.writeFile(paths.codexConfigPath, configContent, "utf8");
  await writeJson(paths.codexAuthPath, {
    OPENAI_API_KEY: selection.key
  });
}

async function restoreOfficialLogin(paths) {
  let configContent;

  try {
    configContent = await fs.readFile(paths.codexConfigPath, "utf8");
  } catch (error) {
    if (!error || error.code !== "ENOENT") {
      throw error;
    }
    configContent = null;
  }

  if (configContent !== null) {
    configContent = removeTomlAssignment(configContent, [], "model_provider");
    configContent = removeTomlAssignment(configContent, [], "disable_response_storage");
    configContent = removeTomlAssignment(configContent, [], "preferred_auth_method");
    configContent = removeTomlAssignment(configContent, ["model_providers", "active"], "name");
    configContent = removeTomlAssignment(
      configContent,
      ["model_providers", "active"],
      "base_url"
    );
    configContent = removeTomlAssignment(
      configContent,
      ["model_providers", "active"],
      "wire_api"
    );
    configContent = removeTomlAssignment(
      configContent,
      ["model_providers", "active"],
      "requires_openai_auth"
    );
    await fs.writeFile(paths.codexConfigPath, configContent, "utf8");
  }

  try {
    await fs.unlink(paths.codexAuthPath);
  } catch (error) {
    if (!error || error.code !== "ENOENT") {
      throw error;
    }
  }
}

function formatTomlString(value) {
  return JSON.stringify(value);
}

module.exports = {
  applySelection,
  applyThirdPartyProvider,
  collectSelectionOptions,
  ensureReady,
  restoreOfficialLogin
};
