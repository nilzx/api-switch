"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { PassThrough } = require("node:stream");

const { ensureInitialized, loadConfig } = require("../src/common/config.js");
const { parseTomlString } = require("../src/common/toml.js");
const { removeTomlAssignment, setTomlAssignment } = require("../src/common/toml-edit.js");
const { promptSelection } = require("../src/common/prompt.js");
const { RESTORE_OFFICIAL_LOGIN_LABEL } = require("../src/common/constants.js");
const {
  applySelection,
  collectSelectionOptions,
  disableOnboardingIfCompleted,
  ensureOnboardingEnabled,
  ensureReady,
  removeClaudeSettingsKeys,
  updateClaudeSettings
} = require("../src/targets/claude.js");
const {
  applySelection: applyCodexSelection,
  applyThirdPartyProvider,
  collectSelectionOptions: collectCodexSelectionOptions,
  ensureReady: ensureCodexReady,
  restoreOfficialLogin
} = require("../src/targets/codex.js");
const { parseTargetName, run } = require("../src/index.js");

test("parseTomlString parses claude and codex sections", () => {
  const parsed = parseTomlString(`
[claude]
load_path = "./claude"

[[claude.providers]]
name = "alpha"
key = "key-a"
url = "url-a"

[codex]
load_path = './codex'

[[codex.providers]]
name = 'beta'
key = 'key-b'
url = 'url-b'
`);

  assert.equal(parsed.claude.loadPath, "./claude");
  assert.equal(parsed.codex.loadPath, "./codex");
  assert.deepEqual(parsed.claude.providers, [
    {
      name: "alpha",
      key: "key-a",
      url: "url-a"
    }
  ]);
  assert.deepEqual(parsed.codex.providers, [
    {
      name: "beta",
      key: "key-b",
      url: "url-b"
    }
  ]);
});

test("parseTomlString rejects legacy root-level config", () => {
  assert.throws(
    () =>
      parseTomlString(`
load_path = "./providers"

[[provider]]
name = 'legacy'
key = 'legacy-key'
url = 'legacy-url'
`),
    {
      message: "Unsupported TOML syntax at line 2."
    }
  );
});

test("ensureInitialized creates new config template", async () => {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "api-switch-init-"));
  const paths = await ensureInitialized(homeDir);
  const configContent = await fs.readFile(paths.configPath, "utf8");

  assert.match(configContent, /\[claude\]/);
  assert.match(configContent, /\[codex\]/);
});

test("loadConfig resolves nested target config paths", async () => {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "api-switch-config-"));
  const configPath = path.join(homeDir, "config.toml");

  await fs.writeFile(
    configPath,
    [
      "[claude]",
      'load_path = "./claude-providers"',
      "",
      "[[claude.providers]]",
      'name = "inline-claude"',
      'key = "claude-key"',
      'url = "claude-url"',
      "",
      "[codex]",
      'load_path = "./codex-providers"',
      "",
      "[[codex.providers]]",
      'name = "inline-codex"',
      'key = "codex-key"',
      'url = "codex-url"',
      ""
    ].join("\n"),
    "utf8"
  );

  const config = await loadConfig(configPath);

  assert.equal(config.claude.loadPath, path.join(homeDir, "claude-providers"));
  assert.equal(config.codex.loadPath, path.join(homeDir, "codex-providers"));
  assert.equal(config.claude.providers[0].name, "inline-claude");
  assert.equal(config.codex.providers[0].name, "inline-codex");
});

test("loadConfig expands current-user home prefixes and preserves other path forms", async () => {
  const configDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "api-switch-config-paths-"));
  const injectedHomeDirectory = path.join(configDirectory, "fake-home");
  const absoluteClaudePath = path.join(configDirectory, "absolute-claude");
  const configPath = path.join(configDirectory, "config.toml");

  await fs.writeFile(
    configPath,
    [
      "[claude]",
      `load_path = "${absoluteClaudePath.replace(/\\/g, "\\\\")}"`,
      "",
      "[[claude.providers]]",
      'name = "inline-claude"',
      'key = "claude-key"',
      'url = "claude-url"',
      "",
      "[codex]",
      'load_path = "~"',
      "",
      "[[codex.providers]]",
      'name = "inline-codex"',
      'key = "codex-key"',
      'url = "codex-url"',
      ""
    ].join("\n"),
    "utf8"
  );

  let config = await loadConfig(configPath, {
    homeDirectory: injectedHomeDirectory
  });

  assert.equal(config.claude.loadPath, absoluteClaudePath);
  assert.equal(config.codex.loadPath, injectedHomeDirectory);

  await fs.writeFile(
    configPath,
    [
      "[claude]",
      'load_path = "./claude-providers"',
      "",
      "[[claude.providers]]",
      'name = "inline-claude"',
      'key = "claude-key"',
      'url = "claude-url"',
      "",
      "[codex]",
      'load_path = "~/codex-providers"',
      "",
      "[[codex.providers]]",
      'name = "inline-codex"',
      'key = "codex-key"',
      'url = "codex-url"',
      ""
    ].join("\n"),
    "utf8"
  );

  config = await loadConfig(configPath, {
    homeDirectory: injectedHomeDirectory
  });

  assert.equal(config.claude.loadPath, path.join(configDirectory, "claude-providers"));
  assert.equal(config.codex.loadPath, path.join(injectedHomeDirectory, "codex-providers"));

  await fs.writeFile(
    configPath,
    [
      "[claude]",
      'load_path = "~\\\\claude-providers"',
      "",
      "[[claude.providers]]",
      'name = "inline-claude"',
      'key = "claude-key"',
      'url = "claude-url"',
      "",
      "[codex]",
      'load_path = "~otheruser/providers"',
      "",
      "[[codex.providers]]",
      'name = "inline-codex"',
      'key = "codex-key"',
      'url = "codex-url"',
      ""
    ].join("\n"),
    "utf8"
  );

  config = await loadConfig(configPath, {
    homeDirectory: injectedHomeDirectory
  });

  assert.equal(config.claude.loadPath, path.join(injectedHomeDirectory, "claude-providers"));
  assert.equal(config.codex.loadPath, path.join(configDirectory, "~otheruser/providers"));
});

test("toml-edit upserts and removes targeted assignments while keeping unrelated content", () => {
  let content = [
    'theme = "dark"',
    "",
    "[model_providers.active]",
    'wire_api = "chat"',
    ""
  ].join("\n");

  content = setTomlAssignment(content, [], "model_provider", "\"active\"");
  content = setTomlAssignment(content, ["model_providers", "active"], "base_url", "\"https://example.com\"");
  content = removeTomlAssignment(content, ["model_providers", "active"], "wire_api");

  assert.match(content, /theme = "dark"/);
  assert.match(content, /model_provider = "active"/);
  assert.match(content, /base_url = "https:\/\/example\.com"/);
  assert.doesNotMatch(content, /wire_api = "chat"/);
});

test("ensureReady rejects missing claude directory", async () => {
  await assert.rejects(
    () =>
      ensureReady({
        claudeDir: path.join(os.tmpdir(), "missing-claude-dir")
      }),
    {
      message: "Claude Code installation path not found."
    }
  );
});

test("collectSelectionOptions builds claude options with restore entry first", async () => {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "api-switch-claude-options-"));
  const providersDir = path.join(homeDir, "providers");
  await fs.mkdir(providersDir, { recursive: true });
  await fs.writeFile(path.join(providersDir, "from-file.key"), "file-key\n", "utf8");
  await fs.writeFile(path.join(providersDir, "from-file.url"), "file-url\n", "utf8");

  const selections = await collectSelectionOptions({
    loadPath: providersDir,
    providers: [
      {
        name: "from-config",
        key: "config-key",
        url: "config-url"
      }
    ]
  });

  assert.deepEqual(
    selections.map((item) => ({
      action: item.action,
      label: item.label,
      source: item.source
    })),
    [
      {
        action: "restore-official-login",
        label: RESTORE_OFFICIAL_LOGIN_LABEL,
        source: "action"
      },
      {
        action: undefined,
        label: "from-file",
        source: "file"
      },
      {
        action: undefined,
        label: "from-config",
        source: "provider"
      }
    ]
  );
});

test("collectCodexSelectionOptions builds codex options with restore entry first", async () => {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "api-switch-codex-options-"));
  const providersDir = path.join(homeDir, "providers");
  await fs.mkdir(providersDir, { recursive: true });
  await fs.writeFile(path.join(providersDir, "from-file.key"), "file-key\n", "utf8");
  await fs.writeFile(path.join(providersDir, "from-file.url"), "file-url\n", "utf8");

  const selections = await collectCodexSelectionOptions({
    loadPath: providersDir,
    providers: [
      {
        name: "from-config",
        key: "config-key",
        url: "config-url"
      }
    ]
  });

  assert.equal(selections[0].action, "restore-official-login");
  assert.equal(selections[1].name, "from-file");
  assert.equal(selections[2].name, "from-config");
});

test("updateClaudeSettings creates settings file and preserves unrelated env keys", async () => {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "api-switch-settings-"));
  const settingsPath = path.join(homeDir, ".claude", "settings.json");

  await updateClaudeSettings(settingsPath, {
    key: "first-key",
    url: "first-url"
  });

  let written = JSON.parse(await fs.readFile(settingsPath, "utf8"));
  assert.equal(written.env.ANTHROPIC_AUTH_TOKEN, "first-key");
  assert.equal(written.env.ANTHROPIC_BASE_URL, "first-url");

  await fs.writeFile(
    settingsPath,
    JSON.stringify(
      {
        env: {
          KEEP_ME: "1"
        }
      },
      null,
      2
    ),
    "utf8"
  );

  await updateClaudeSettings(settingsPath, {
    key: "second-key",
    url: "second-url"
  });

  written = JSON.parse(await fs.readFile(settingsPath, "utf8"));
  assert.equal(written.env.KEEP_ME, "1");
  assert.equal(written.env.ANTHROPIC_AUTH_TOKEN, "second-key");
  assert.equal(written.env.ANTHROPIC_BASE_URL, "second-url");
});

test("claude onboarding helpers update .claude.json correctly", async () => {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "api-switch-onboarding-"));
  const claudeStatePath = path.join(homeDir, ".claude.json");

  await ensureOnboardingEnabled(claudeStatePath);
  let written = JSON.parse(await fs.readFile(claudeStatePath, "utf8"));
  assert.equal(written.hasCompletedOnboarding, true);

  await fs.writeFile(
    claudeStatePath,
    JSON.stringify({ hasCompletedOnboarding: true, keep: "x" }, null, 2),
    "utf8"
  );
  await disableOnboardingIfCompleted(claudeStatePath);

  written = JSON.parse(await fs.readFile(claudeStatePath, "utf8"));
  assert.equal(written.hasCompletedOnboarding, false);
  assert.equal(written.keep, "x");
});

test("removeClaudeSettingsKeys only removes managed env keys", async () => {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "api-switch-remove-"));
  const settingsPath = path.join(homeDir, ".claude", "settings.json");

  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(
    settingsPath,
    JSON.stringify(
      {
        env: {
          ANTHROPIC_AUTH_TOKEN: "a",
          ANTHROPIC_BASE_URL: "b",
          KEEP_ME: "1"
        },
        model: "opus"
      },
      null,
      2
    ),
    "utf8"
  );

  await removeClaudeSettingsKeys(settingsPath);
  const written = JSON.parse(await fs.readFile(settingsPath, "utf8"));

  assert.deepEqual(written, {
    env: {
      KEEP_ME: "1"
    },
    model: "opus"
  });
});

test("applySelection handles restore and provider flows", async () => {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "api-switch-apply-"));
  const paths = {
    claudeSettingsPath: path.join(homeDir, ".claude", "settings.json"),
    claudeStatePath: path.join(homeDir, ".claude.json")
  };

  await applySelection(paths, {
    name: "provider",
    key: "provider-key",
    url: "provider-url"
  });

  let settings = JSON.parse(await fs.readFile(paths.claudeSettingsPath, "utf8"));
  let state = JSON.parse(await fs.readFile(paths.claudeStatePath, "utf8"));
  assert.equal(settings.env.ANTHROPIC_AUTH_TOKEN, "provider-key");
  assert.equal(settings.env.ANTHROPIC_BASE_URL, "provider-url");
  assert.equal(state.hasCompletedOnboarding, true);

  await applySelection(paths, {
    action: "restore-official-login",
    label: RESTORE_OFFICIAL_LOGIN_LABEL
  });

  settings = JSON.parse(await fs.readFile(paths.claudeSettingsPath, "utf8"));
  state = JSON.parse(await fs.readFile(paths.claudeStatePath, "utf8"));
  assert.deepEqual(settings.env, {});
  assert.equal(state.hasCompletedOnboarding, false);
});

test("ensureCodexReady creates codex directory", async () => {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "api-switch-codex-ready-"));
  const codexDir = path.join(homeDir, ".codex");

  await ensureCodexReady({
    codexDir
  });

  const stat = await fs.stat(codexDir);
  assert.equal(stat.isDirectory(), true);
});

test("applyThirdPartyProvider writes codex config and auth while preserving unrelated config", async () => {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "api-switch-codex-apply-"));
  const codexDir = path.join(homeDir, ".codex");
  const codexConfigPath = path.join(codexDir, "config.toml");
  const codexAuthPath = path.join(codexDir, "auth.json");
  await fs.mkdir(codexDir, { recursive: true });
  await fs.writeFile(
    codexConfigPath,
    [
      'theme = "dark"',
      "",
      "[model_providers.other]",
      'name = "other"',
      ""
    ].join("\n"),
    "utf8"
  );

  await applyThirdPartyProvider(
    {
      codexDir,
      codexConfigPath,
      codexAuthPath
    },
    {
      key: "codex-key",
      url: "https://codex.example.com"
    }
  );

  const configContent = await fs.readFile(codexConfigPath, "utf8");
  const authContent = JSON.parse(await fs.readFile(codexAuthPath, "utf8"));

  assert.match(configContent, /theme = "dark"/);
  assert.match(configContent, /model_provider = "active"/);
  assert.match(configContent, /disable_response_storage = true/);
  assert.match(configContent, /preferred_auth_method = "apikey"/);
  assert.match(configContent, /\[model_providers\.active\]/);
  assert.match(configContent, /base_url = "https:\/\/codex\.example\.com"/);
  assert.equal(authContent.OPENAI_API_KEY, "codex-key");
});

test("restoreOfficialLogin removes codex managed config and auth only", async () => {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "api-switch-codex-restore-"));
  const codexDir = path.join(homeDir, ".codex");
  const codexConfigPath = path.join(codexDir, "config.toml");
  const codexAuthPath = path.join(codexDir, "auth.json");
  await fs.mkdir(codexDir, { recursive: true });
  await fs.writeFile(
    codexConfigPath,
    [
      'theme = "dark"',
      'model_provider = "active"',
      "disable_response_storage = true",
      'preferred_auth_method = "apikey"',
      "",
      "[model_providers.active]",
      'name = "active"',
      'base_url = "https://codex.example.com"',
      'wire_api = "responses"',
      "requires_openai_auth = true",
      "",
      "[model_providers.other]",
      'name = "other"',
      ""
    ].join("\n"),
    "utf8"
  );
  await fs.writeFile(
    codexAuthPath,
    JSON.stringify({ OPENAI_API_KEY: "codex-key" }, null, 2),
    "utf8"
  );

  await restoreOfficialLogin({
    codexConfigPath,
    codexAuthPath
  });

  const configContent = await fs.readFile(codexConfigPath, "utf8");
  assert.match(configContent, /theme = "dark"/);
  assert.match(configContent, /\[model_providers\.other\]/);
  assert.doesNotMatch(configContent, /^model_provider = /m);
  assert.doesNotMatch(configContent, /^disable_response_storage = /m);
  assert.doesNotMatch(configContent, /^preferred_auth_method = /m);
  assert.doesNotMatch(configContent, /\[model_providers\.active\][\s\S]*base_url = /m);
  await assert.rejects(() => fs.access(codexAuthPath), { code: "ENOENT" });
});

test("applyCodexSelection dispatches provider and restore flows", async () => {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "api-switch-codex-dispatch-"));
  const codexDir = path.join(homeDir, ".codex");
  const paths = {
    codexDir,
    codexAuthPath: path.join(codexDir, "auth.json"),
    codexConfigPath: path.join(codexDir, "config.toml")
  };

  await applyCodexSelection(paths, {
    key: "dispatch-key",
    url: "https://dispatch.example.com"
  });

  let auth = JSON.parse(await fs.readFile(paths.codexAuthPath, "utf8"));
  let configContent = await fs.readFile(paths.codexConfigPath, "utf8");
  assert.equal(auth.OPENAI_API_KEY, "dispatch-key");
  assert.match(configContent, /base_url = "https:\/\/dispatch\.example\.com"/);

  await applyCodexSelection(paths, {
    action: "restore-official-login"
  });

  configContent = await fs.readFile(paths.codexConfigPath, "utf8");
  assert.doesNotMatch(configContent, /^model_provider = /m);
  await assert.rejects(() => fs.access(paths.codexAuthPath), { code: "ENOENT" });
});

test("promptSelection uses array indexes as displayed numbers", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  let outputBuffer = "";
  output.on("data", (chunk) => {
    outputBuffer += chunk.toString("utf8");
  });

  const selectionPromise = promptSelection(
    [
      {
        label: "Restore official login",
        action: "restore-official-login"
      },
      {
        label: "alpha"
      },
      {
        label: "beta"
      }
    ],
    { input, output }
  );
  input.end("0\n");

  const selected = await selectionPromise;

  assert.equal(selected.action, "restore-official-login");
  assert.match(outputBuffer, /0\. Restore official login/);
  assert.match(outputBuffer, /1\. alpha/);
  assert.match(outputBuffer, /2\. beta/);
  input.destroy();
  output.destroy();
});

test("parseTargetName only accepts supported targets", () => {
  assert.equal(parseTargetName(["claude"]), "claude");
  assert.equal(parseTargetName(["codex"]), "codex");
  assert.throws(() => parseTargetName([]), {
    message: "Usage: api-switch <claude|codex>"
  });
});

test("run executes claude flow with nested config", async () => {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "api-switch-run-"));
  const claudeDir = path.join(homeDir, ".claude");
  const configDir = path.join(homeDir, ".api-switch");
  const providersDir = path.join(configDir, "claude");

  await fs.mkdir(claudeDir, { recursive: true });
  await fs.mkdir(providersDir, { recursive: true });
  await fs.writeFile(path.join(providersDir, "file.key"), "file-key\n", "utf8");
  await fs.writeFile(path.join(providersDir, "file.url"), "file-url\n", "utf8");
  await fs.writeFile(
    path.join(configDir, "config.toml"),
    [
      "[claude]",
      'load_path = "./claude"',
      "",
      "[codex]",
      'load_path = "./codex"',
      ""
    ].join("\n"),
    "utf8"
  );

  const input = new PassThrough();
  const output = new PassThrough();
  const resultPromise = run({
    argv: ["claude"],
    homeDir,
    input,
    output
  });
  input.end("1\n");

  const result = await resultPromise;
  const settings = JSON.parse(
    await fs.readFile(path.join(claudeDir, "settings.json"), "utf8")
  );

  assert.equal(result.target, "claude");
  assert.equal(result.selection.name, "file");
  assert.equal(settings.env.ANTHROPIC_AUTH_TOKEN, "file-key");
  assert.equal(settings.env.ANTHROPIC_BASE_URL, "file-url");
  input.destroy();
  output.destroy();
});

test("run executes codex flow with nested config", async () => {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "api-switch-run-codex-"));
  const configDir = path.join(homeDir, ".api-switch");
  const providersDir = path.join(configDir, "codex");

  await fs.mkdir(providersDir, { recursive: true });
  await fs.writeFile(path.join(providersDir, "file.key"), "codex-key\n", "utf8");
  await fs.writeFile(path.join(providersDir, "file.url"), "https://codex.example.com\n", "utf8");
  await fs.writeFile(
    path.join(configDir, "config.toml"),
    [
      "[claude]",
      'load_path = "./claude"',
      "",
      "[codex]",
      'load_path = "./codex"',
      ""
    ].join("\n"),
    "utf8"
  );

  const input = new PassThrough();
  const output = new PassThrough();
  const resultPromise = run({
    argv: ["codex"],
    homeDir,
    input,
    output
  });
  input.end("1\n");

  const result = await resultPromise;
  const auth = JSON.parse(
    await fs.readFile(path.join(homeDir, ".codex", "auth.json"), "utf8")
  );
  const configContent = await fs.readFile(
    path.join(homeDir, ".codex", "config.toml"),
    "utf8"
  );

  assert.equal(result.target, "codex");
  assert.equal(result.selection.name, "file");
  assert.equal(auth.OPENAI_API_KEY, "codex-key");
  assert.match(configContent, /base_url = "https:\/\/codex\.example\.com"/);
  input.destroy();
  output.destroy();
});
