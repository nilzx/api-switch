"use strict";

const path = require("node:path");

const API_SWITCH_DIR_NAME = ".api-switch";
const CLAUDE_DIR_NAME = ".claude";
const CODEX_DIR_NAME = ".codex";
const CLAUDE_STATE_FILE_NAME = ".claude.json";
const CONFIG_FILE_NAME = "config.toml";
const SETTINGS_FILE_NAME = "settings.json";
const AUTH_FILE_NAME = "auth.json";
const MISSING_CLAUDE_INSTALLATION_MESSAGE = "Claude Code installation path not found.";
const RESTORE_OFFICIAL_LOGIN_LABEL = "Restore official login";
const SUPPORTED_TARGETS = ["claude", "codex"];

const DEFAULT_CLAUDE_SETTINGS = {
  env: {
    ANTHROPIC_AUTH_TOKEN: "",
    ANTHROPIC_BASE_URL: ""
  }
};

const DEFAULT_CONFIG_TEMPLATE = [
  "[claude]",
  "# load_path = \"./claude\"",
  "",
  "# [[claude.providers]]",
  "# name = \"example\"",
  "# key = \"sk-ant-...\"",
  "# url = \"https://api.anthropic.com\"",
  "",
  "[codex]",
  "# load_path = \"./codex\"",
  "",
  "# [[codex.providers]]",
  "# name = \"example\"",
  "# key = \"token\"",
  "# url = \"https://example.com\"",
  ""
].join("\n");

function buildPaths(homeDir) {
  const apiSwitchDir = path.join(homeDir, API_SWITCH_DIR_NAME);
  const claudeDir = path.join(homeDir, CLAUDE_DIR_NAME);
  const codexDir = path.join(homeDir, CODEX_DIR_NAME);

  return {
    apiSwitchDir,
    claudeDir,
    claudeSettingsPath: path.join(claudeDir, SETTINGS_FILE_NAME),
    claudeStatePath: path.join(homeDir, CLAUDE_STATE_FILE_NAME),
    configPath: path.join(apiSwitchDir, CONFIG_FILE_NAME),
    codexAuthPath: path.join(codexDir, AUTH_FILE_NAME),
    codexConfigPath: path.join(codexDir, CONFIG_FILE_NAME),
    codexDir
  };
}

module.exports = {
  DEFAULT_CLAUDE_SETTINGS,
  DEFAULT_CONFIG_TEMPLATE,
  MISSING_CLAUDE_INSTALLATION_MESSAGE,
  RESTORE_OFFICIAL_LOGIN_LABEL,
  SUPPORTED_TARGETS,
  buildPaths
};
