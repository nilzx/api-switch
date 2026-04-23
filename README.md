# api-switch

A minimal CLI for switching Claude Code and Codex CLI between third-party API access and official login.

[中文文档](./docs/README.zh-CN.md)

## Requirements

- Node.js `>= 20`

## Features

- Configure multiple third-party API providers and switch between them freely
- Support two configuration styles: inline providers and batch-loaded provider files
- Restore official login from the same selection list

## Installation

Global install:

```bash
npm install -g api-switch
```

## Usage

For Claude:

```bash
api-switch claude
```

For Codex:

```bash
api-switch codex
```

In the selection list:

- Enter a provider id to switch to that provider
- Press `Enter`, `q`, or `Esc` to cancel
- Select `Restore official login` (fixed id `0`) to switch back to official login

## Configuration

Configuration file path:

```text
~/.api-switch/config.toml
```

### Direct configuration

Use `[[claude.providers]]` or `[[codex.providers]]`.

Each inline provider must include:

- `name`
- `key`
- `url`

Example:

```toml
[[claude.providers]]
name = "claude-api"
key = "sk-ant-..."
url = "https://api.anthropic.com"

[[claude.providers]]
name = "proxy"
key = "proxy-key"
url = "https://example.com/anthropic"

[[codex.providers]]
name = "codex-api"
key = "token"
url = "https://api.codex.com"
```

`claude-api` and `proxy` will appear in the `api-switch claude` selection list.
`codex-api` will appear in the `api-switch codex` selection list.

### Batch loading provider files

Set `load_path` to a directory path resolved relative to the directory containing `config.toml`.

`api-switch` loads providers from matching `.key` and `.url` file pairs with the same filename prefix under that path.

Example:

```toml
[claude]
load_path = "./claude"

[codex]
load_path = "./codex"
```

File structure:

```text
claude/work.key
claude/work.url
codex/company.key
codex/company.url
codex/gpt.key
```

`work` and `company` will appear in the `api-switch claude` and `api-switch codex` selection lists.
A provider is loaded only when both `.key` and `.url` files exist with the same name, so `gpt` will not be loaded.

## Full configuration example

```toml
[[claude.providers]]
name = "official"
key = "sk-ant-..."
url = "https://api.anthropic.com"

[[claude.providers]]
name = "proxy"
key = "proxy-key"
url = "https://example.com/anthropic"

[codex]
load_path = "./codex"

[[codex.providers]]
name = "example"
key = "token"
url = "https://example.com"
```
