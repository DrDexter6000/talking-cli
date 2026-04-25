import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

/**
 * Provider configuration schema
 */
export interface ProviderConfig {
  name: string;                    // Provider identifier (e.g., "deepseek", "openai")
  baseUrl: string;                 // API base URL
  apiKey: string;                  // API key (or env var reference: "${ENV_VAR}")
  model: string;                   // Model name
  maxTokens: number;              // Max output tokens
  temperature: number;            // Temperature
  timeout: number;                // Request timeout (ms)
  headers?: Record<string, string>; // Additional headers
  // Format-specific options
  format: "openai" | "anthropic" | "gemini"; // API format
  // Provider-specific features
  supportsTools: boolean;         // Whether provider supports function calling
  supportsSystemPrompt: boolean;  // Whether provider supports system role
  contextWindow: number;          // Context window size
}

/**
 * Default provider configurations
 */
export const DEFAULT_PROVIDERS: Record<string, ProviderConfig> = {
  stub: {
    name: "stub",
    baseUrl: "",
    apiKey: "",
    model: "stub",
    maxTokens: 0,
    temperature: 0,
    timeout: 0,
    format: "openai",
    supportsTools: false,
    supportsSystemPrompt: false,
    contextWindow: 0,
  },
  deepseek: {
    name: "deepseek",
    baseUrl: "https://api.deepseek.com",
    apiKey: "${DEEPSEEK_API_KEY}",
    model: "deepseek-v4-flash",
    maxTokens: 4096,
    temperature: 1.0,
    timeout: 300_000,
    format: "openai",
    supportsTools: true,
    supportsSystemPrompt: true,
    contextWindow: 1_000_000, // DeepSeek-V4: 1M context
    // Both v4-flash and v4-pro support thinking/non-thinking mode toggle
  },
  "deepseek-reasoner": {
    name: "deepseek-reasoner",
    baseUrl: "https://api.deepseek.com",
    apiKey: "${DEEPSEEK_API_KEY}",
    model: "deepseek-v4-pro",
    maxTokens: 32768,
    temperature: 1.0,
    timeout: 300_000,
    format: "openai",
    supportsTools: true,
    supportsSystemPrompt: true,
    contextWindow: 1_000_000, // DeepSeek-V4: 1M context
  },
  openai: {
    name: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "${OPENAI_API_KEY}",
    model: "gpt-4o",
    maxTokens: 4096,
    temperature: 1.0,
    timeout: 300_000,
    format: "openai",
    supportsTools: true,
    supportsSystemPrompt: true,
    contextWindow: 128_000,
  },
  minimax: {
    name: "minimax",
    baseUrl: "https://api.minimaxi.com/anthropic",
    apiKey: "${MINIMAX_API_KEY}",
    model: "MiniMax-M2.7-highspeed",
    maxTokens: 131072,
    temperature: 1.0,
    timeout: 300_000,
    headers: {
      "anthropic-version": "2023-06-01",
    },
    format: "anthropic",
    supportsTools: true,
    supportsSystemPrompt: true,
    contextWindow: 196_608,
  },
  gemini: {
    name: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKey: "${GEMINI_API_KEY}",
    model: "gemini-1.5-pro",
    maxTokens: 8192,
    temperature: 1.0,
    timeout: 300_000,
    format: "gemini",
    supportsTools: true,
    supportsSystemPrompt: true,
    contextWindow: 1_000_000,
  },
};

/**
 * Resolve API key from config string
 * Supports: "${ENV_VAR}" syntax or literal value
 */
function resolveApiKey(keySpec: string): string {
  const envMatch = keySpec.match(/^\$\{(.+)\}$/);
  if (envMatch) {
    const envVar = envMatch[1];
    const value = process.env[envVar];
    if (!value) {
      throw new Error(`Environment variable ${envVar} is not set (required by provider config)`);
    }
    return value;
  }
  return keySpec;
}

/**
 * Load provider configuration from multiple sources
 * Priority: 1. Explicit config > 2. User config file > 3. Default configs
 */
export function loadProviderConfig(
  providerName: string,
  customConfig?: Partial<ProviderConfig>,
): ProviderConfig {
  // 1. Start with default config if available
  let config: ProviderConfig | undefined = DEFAULT_PROVIDERS[providerName];
  
  // 2. Try to load from user config file
  const userConfigPath = resolve(homedir(), ".talking-cli", "providers.json");
  if (existsSync(userConfigPath)) {
    try {
      const userConfigs = JSON.parse(readFileSync(userConfigPath, "utf-8")) as Record<string, ProviderConfig>;
      if (userConfigs[providerName]) {
        config = { ...config, ...userConfigs[providerName] };
      }
    } catch (error) {
      console.warn(`[WARNING] Failed to load user provider config from ${userConfigPath}: ${error}`);
    }
  }
  
  // 3. Try to load from project config file
  const projectConfigPath = resolve(process.cwd(), ".talking-cli-providers.json");
  if (existsSync(projectConfigPath)) {
    try {
      const projectConfigs = JSON.parse(readFileSync(projectConfigPath, "utf-8")) as Record<string, ProviderConfig>;
      if (projectConfigs[providerName]) {
        config = { ...config, ...projectConfigs[providerName] };
      }
    } catch (error) {
      console.warn(`[WARNING] Failed to load project provider config from ${projectConfigPath}: ${error}`);
    }
  }
  
  // 4. Apply explicit custom config (highest priority)
  if (customConfig) {
    config = { ...config, ...customConfig } as ProviderConfig;
  }
  
  if (!config) {
    throw new Error(
      `Unknown provider: ${providerName}. ` +
      `Built-in providers: ${Object.keys(DEFAULT_PROVIDERS).join(", ")}. ` +
      `You can also define custom providers in ~/.talking-cli/providers.json or .talking-cli-providers.json`,
    );
  }
  
  // Resolve API key (handle ${ENV_VAR} syntax)
  const resolvedConfig = {
    ...config,
    apiKey: resolveApiKey(config.apiKey),
  };
  
  return resolvedConfig;
}

/**
 * List all available providers
 */
export function listAvailableProviders(): string[] {
  const providers = new Set(Object.keys(DEFAULT_PROVIDERS));
  
  // Add from user config
  const userConfigPath = resolve(homedir(), ".talking-cli", "providers.json");
  if (existsSync(userConfigPath)) {
    try {
      const userConfigs = JSON.parse(readFileSync(userConfigPath, "utf-8")) as Record<string, ProviderConfig>;
      Object.keys(userConfigs).forEach(p => providers.add(p));
    } catch {
      // ignore
    }
  }
  
  // Add from project config
  const projectConfigPath = resolve(process.cwd(), ".talking-cli-providers.json");
  if (existsSync(projectConfigPath)) {
    try {
      const projectConfigs = JSON.parse(readFileSync(projectConfigPath, "utf-8")) as Record<string, ProviderConfig>;
      Object.keys(projectConfigs).forEach(p => providers.add(p));
    } catch {
      // ignore
    }
  }
  
  return Array.from(providers).sort();
}

/**
 * Generate sample provider config file
 */
export function generateProviderConfigTemplate(): string {
  return JSON.stringify({
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
  }, null, 2);
}
