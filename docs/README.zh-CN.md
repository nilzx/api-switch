# api-switch

一个用于切换 Claude Code / Codex CLI 第三方API和官方登录方式的简易工具。

## 运行要求

- Node.js `>= 20`

## 功能说明

- 可配置多组第三方API，并自由切换
- 有两种配置方式，一是通过单个配置文件配置，二是可以批量导入选项文件

## 安装

全局安装：

```bash
npm install -g api-switch
```

## 使用方式

用于Claude：

```bash
api-switch claude
```

用于Codex：

```bash
api-switch codex
```

在选择列表中：

- 输入id即可切换对应项
- `Enter`/`q`/`Esc`键可以取消
- 选择 `Restore official login`(id固定为`0`) 即切回官方登录方式

## 配置文件

配置文件路径：

```text
~/.api-switch/config.toml
```

### 直接配置:

通过`[[claude.providers]]`或`[[codex.providers]]`字段

每个内联 provider 需要包含：

- `name` #选项名
- `key` #第三方api key
- `url` #第三方api url

例:
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
key = "sk-ant-..."
url = "https://api.codex.com"
```

*`claude-api`和`proxy`将会出现在`api-switch claude`的选项列表中*
*`codex-api`将会出现在`api-switch codex`的选项列表中*

### 批量加载选项文件:

由`load_path`设置文件加载路径, 该路径是相对于 `config.toml` 所在目录解析。
`api-switch`会按该路径下同名前缀的成对`.key` 和 `.url`文件加载 provider

例:
```toml
[claude]
load_path = "./claude"

[codex]
load_path = "./codex"
```

文件结构：
```text
claude/work.key
claude/work.url
codex/company.key
codex/company.url
codex/gpt.key
```

*`work`和`company`会分别出现在`api-switch claude`和`api-switch codex`的选项列表中*
*`.key`或`.url`必须同名成对，否则不会加载(`gpt`将不会出现在`api-switch codex`选项列表中)*

完整配置示例：

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

