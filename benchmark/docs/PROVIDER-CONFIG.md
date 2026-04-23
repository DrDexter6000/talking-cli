# Benchmark Provider Configuration

> **SSOT (Single Source of Truth)** for all benchmark provider configurations.
> Last updated: 2026-04-22

---

## Available Providers

| Provider | Format | Model | Context Window | Max Tokens | Base URL |
|----------|--------|-------|----------------|------------|----------|
| **stub** | openai | stub | 0 | 0 | (local) |
| **deepseek** | openai | deepseek-chat | 128K | 4096 | `https://api.deepseek.com` |
| **deepseek-reasoner** | openai | deepseek-reasoner | 128K | 32768 | `https://api.deepseek.com` |
| **openai** | openai | gpt-4o | 128K | 4096 | `https://api.openai.com/v1` |
| **minimax** | anthropic | MiniMax-M2.7-highspeed | 196K | 131072 | `https://api.minimaxi.com/anthropic` |
| **gemini** | gemini | gemini-1.5-pro | 1M | 8192 | `https://generativelanguage.googleapis.com/v1beta` |

---

## Environment Variables

### Required API Keys

```bash
# DeepSeek (国内服务器)
export DEEPSEEK_API_KEY="sk-..."
# 获取地址: https://platform.deepseek.com/api_keys
# 国内直连: https://api.deepseek.com
# 模型: deepseek-chat (DeepSeek-V3.2, 128K上下文)

# OpenAI
export OPENAI_API_KEY="sk-..."
# 获取地址: https://platform.openai.com/api-keys

# MiniMax
export MINIMAX_API_KEY="sk-..."
# 获取地址: https://www.minimaxi.com/platform
# 注意: 使用 Anthropic API 格式
# Base URL: https://api.minimaxi.com/anthropic

# Gemini
export GEMINI_API_KEY="..."
# 获取地址: https://aistudio.google.com/app/apikey
```

### Current Environment (This Machine)

```bash
# ✅ DEEPSEEK_API_KEY - 已配置
# ✅ MINIMAX_API_KEY - 已配置 (原 ANTHROPIC_API_KEY, 已重命名)
# ❌ OPENAI_API_KEY - 未配置
# ❌ GEMINI_API_KEY - 未配置
```

---

## Provider Details

### DeepSeek

- **Base URL**: `https://api.deepseek.com`
- **Model**: `deepseek-chat` (DeepSeek-V3.2)
- **Context Window**: 128K
- **Max Tokens**: 4096 (default), up to 8192
- **Format**: OpenAI-compatible
- **Temperature**: 1.0
- **Timeout**: 300s

**国内访问**:
- 国内服务器: `https://api.deepseek.com`
- 无需代理，直连可用

### DeepSeek Reasoner

- **Base URL**: `https://api.deepseek.com`
- **Model**: `deepseek-reasoner` (DeepSeek-V3.2 thinking mode)
- **Context Window**: 128K
- **Max Tokens**: 32768 (default), up to 65536
- **Format**: OpenAI-compatible
- **Temperature**: 1.0 (ignored — reasoner does not support temperature/top_p)
- **Timeout**: 300s
- **注意**: 传 `tools` 参数会静默回退到 `deepseek-chat`。返回 `reasoning_content` + `content` 两个字段。

### MiniMax

- **Base URL**: `https://api.minimaxi.com/anthropic`
- **Model**: `MiniMax-M2.7-highspeed`
- **Context Window**: 196K
- **Max Tokens**: 131072
- **Format**: Anthropic-compatible
- **Headers**: `anthropic-version: 2023-06-01`
- **Temperature**: 1.0
- **Timeout**: 300s

**注意**: MiniMax M2.7 Highspeed 使用 Anthropic API 格式，但有自己的 base URL。230B 总参数 (~10B active per token, MoE 256 experts)，与 MiniMax-M2.7 完全相同智能水平但速度更快 (~100 tokens/s)。

### OpenAI

- **Base URL**: `https://api.openai.com/v1`
- **Model**: `gpt-4o`
- **Context Window**: 128K
- **Max Tokens**: 4096
- **Format**: OpenAI-native
- **Temperature**: 1.0
- **Timeout**: 300s

### Gemini

- **Base URL**: `https://generativelanguage.googleapis.com/v1beta`
- **Model**: `gemini-1.5-pro`
- **Context Window**: 1M
- **Max Tokens**: 8192
- **Format**: Gemini-native
- **Temperature**: 1.0
- **Timeout**: 300s

---

## Usage

### List Available Providers

```bash
npm run benchmark -- --list-providers
```

### Run Benchmark with Specific Provider

```bash
# DeepSeek (推荐，国内可用)
npm run benchmark -- --provider deepseek --parallel --max-concurrency 3

# MiniMax
npm run benchmark -- --provider minimax --parallel --max-concurrency 3

# OpenAI (需要 API key)
npm run benchmark -- --provider openai --parallel --max-concurrency 3

# Gemini (需要 API key)
npm run benchmark -- --provider gemini --parallel --max-concurrency 3

# Smoke test (无需 API key)
npm run benchmark:smoke
```

### Generate Provider Config Template

```bash
npm run benchmark -- --init-config
# 生成 .talking-cli-providers.json 模板
```

---

## Custom Providers

You can define custom providers in:

1. `~/.talking-cli/providers.json` (user-level)
2. `.talking-cli-providers.json` (project-level)

Example:

```json
{
  "my-custom-provider": {
    "name": "my-custom-provider",
    "baseUrl": "https://api.example.com/v1",
    "apiKey": "${MY_API_KEY}",
    "model": "model-name",
    "maxTokens": 4096,
    "temperature": 1.0,
    "timeout": 300000,
    "format": "openai",
    "supportsTools": true,
    "supportsSystemPrompt": true,
    "contextWindow": 128000
  }
}
```

---

## Troubleshooting

### "Environment variable X is not set"

- 检查环境变量是否正确设置
- Windows: `[Environment]::SetEnvironmentVariable("NAME", "value", "User")`
- Linux/Mac: `export NAME=value`

### "Request failed with status 401"

- API key 无效或过期
- 检查 provider 的 base URL 是否正确

### "Request failed with status 429"

- 请求频率过高，触发限流
- 降低 `--max-concurrency` 或减少并行任务数

---

## Changelog

- **2026-04-22**: Synced all parameter values with provider-config.ts. Added deepseek-reasoner. Updated MiniMax contextWindow 32K→196K, maxTokens 30720→131072. Updated DeepSeek contextWindow 64K→128K. Moved to benchmark/docs/.
- **2026-04-21**: 添加 DeepSeek 配置文档，重命名 MINIMAX_API_KEY
- **2026-04-21**: 初始版本，支持 5 个内置 provider
