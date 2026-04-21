import type {
  StandaloneConversationMessage,
  StandaloneLLMProvider,
} from "./standalone-executor.js";
import type { BenchmarkToolDefinition } from "./types.js";
import { loadProviderConfig, type ProviderConfig } from "./provider-config.js";

/**
 * Create a provider instance from configuration
 */
export function createProvider(
  name: string,
  customConfig?: Partial<ProviderConfig>,
): StandaloneLLMProvider {
  const config = loadProviderConfig(name, customConfig);
  
  if (config.name === "stub") {
    return createStubProvider();
  }
  
  switch (config.format) {
    case "openai":
      return createOpenAICompatibleProvider(config);
    case "anthropic":
      return createAnthropicCompatibleProvider(config);
    case "gemini":
      return createGeminiProvider(config);
    default:
      throw new Error(`Unsupported provider format: ${config.format}`);
  }
}

function createStubProvider(): StandaloneLLMProvider {
  return {
    async call(
      _messages: StandaloneConversationMessage[],
      _turnId: number,
      _tools?: BenchmarkToolDefinition[],
    ) {
      return {
        content: [{ type: "text", text: "Stub benchmark executor completed without tool use." }],
        stop_reason: "end_turn",
        usage: { input_tokens: 0, output_tokens: 0 },
      };
    },
  };
}

/**
 * Create OpenAI-compatible provider (DeepSeek, OpenAI, etc.)
 */
function createOpenAICompatibleProvider(config: ProviderConfig): StandaloneLLMProvider {
  return {
    async call(
      messages: StandaloneConversationMessage[],
      _turnId: number,
      tools: BenchmarkToolDefinition[] = [],
    ) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeout);

      // Convert messages to OpenAI format
      const processedMessages = messages.reduce<Array<{ role: string; content: string }>>((acc, message) => {
        if (message.role === "tool") {
          acc.push({
            role: "user",
            content: `[Tool Result: ${message.name}] ${message.content}`,
          });
        } else if (message.role === "assistant_content") {
          const content = message.content as Array<{ type: string; text?: string }>;
          const text = content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("\n");
          acc.push({ role: "assistant", content: text || "" });
        } else if (message.role === "user") {
          acc.push({ role: "user", content: message.content as string });
        } else if (message.role === "assistant") {
          acc.push({ role: "assistant", content: message.content as string });
        }
        return acc;
      }, []);

      // Extract system prompt
      let systemPrompt: string | undefined;
      const firstMessage = processedMessages[0];
      if (firstMessage && firstMessage.role === "user") {
        const content = firstMessage.content;
        const legacyMatch = content.match(/^(You are [^\n]+)\n\nUser request: /);
        if (legacyMatch) {
          systemPrompt = legacyMatch[1];
          firstMessage.content = content.replace(legacyMatch[1] + "\n\n", "");
        } else {
          const yamlMatch = content.match(/^(---[\s\S]*?---\n[\s\S]*?)\n\nUser request: /);
          if (yamlMatch) {
            systemPrompt = yamlMatch[1].trim();
            firstMessage.content = content.replace(yamlMatch[1] + "\n\n", "");
          }
        }
      }

      const requestBody: Record<string, unknown> = {
        model: config.model,
        messages: systemPrompt
          ? [{ role: "system", content: systemPrompt }, ...processedMessages]
          : processedMessages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
      };

      if (tools.length > 0 && config.supportsTools) {
        requestBody.tools = tools.map((tool) => ({
          type: "function" as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          },
        }));
      }

      const headers: Record<string, string> = {
        "content-type": "application/json",
        "authorization": `Bearer ${config.apiKey}`,
        ...config.headers,
      };

      let response: Response;
      try {
        response = await fetch(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      const body = await response.json() as {
        choices?: Array<{
          message: {
            content: string;
            tool_calls?: Array<{
              id: string;
              function: { name: string; arguments: string };
            }>;
          };
          finish_reason: string;
        }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
        error?: { message: string };
      };

      if (!response.ok) {
        const errorMsg = body.error?.message ?? `Request failed with status ${response.status}`;
        console.error(`[API Error] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      const choice = body.choices?.[0];
      if (!choice) {
        throw new Error("API returned empty choices");
      }

      const content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }> = [];

      if (choice.message.content) {
        content.push({ type: "text", text: choice.message.content });
      }

      if (choice.message.tool_calls) {
        for (const toolCall of choice.message.tool_calls) {
          try {
            const input = JSON.parse(toolCall.function.arguments);
            content.push({
              type: "tool_use",
              id: toolCall.id,
              name: toolCall.function.name,
              input,
            });
          } catch {
            console.error(`[API Error] Failed to parse tool call arguments: ${toolCall.function.arguments}`);
          }
        }
      }

      return {
        content: content.map((block) =>
          block.type === "tool_use"
            ? { type: "tool_use" as const, id: block.id!, name: block.name!, input: block.input! }
            : { type: "text" as const, text: block.text! },
        ),
        stop_reason: choice.finish_reason === "tool_calls" ? "tool_use" : "end_turn",
        usage: {
          input_tokens: body.usage?.prompt_tokens ?? 0,
          output_tokens: body.usage?.completion_tokens ?? 0,
        },
      };
    },
  };
}

/**
 * Create Anthropic-compatible provider (Claude, MiniMax via Anthropic format, etc.)
 */
function createAnthropicCompatibleProvider(config: ProviderConfig): StandaloneLLMProvider {
  return {
    async call(
      messages: StandaloneConversationMessage[],
      _turnId: number,
      tools: BenchmarkToolDefinition[] = [],
    ) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeout);

      // Convert messages to Anthropic format
      const processedMessages = messages.reduce<Array<{ role: string; content: string }>>((acc, message) => {
        if (message.role === "tool") {
          acc.push({
            role: "user",
            content: `[Tool Result: ${message.name}] ${message.content}`,
          });
        } else if (message.role === "assistant_content") {
          const content = message.content as Array<{ type: string; text?: string }>;
          const text = content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("\n");
          acc.push({ role: "assistant", content: text || "" });
        } else if (message.role === "user") {
          acc.push({ role: "user", content: message.content as string });
        } else if (message.role === "assistant") {
          acc.push({ role: "assistant", content: message.content as string });
        }
        return acc;
      }, []);

      // Extract system prompt
      let systemPrompt: string | undefined;
      const firstMessage = processedMessages[0];
      if (firstMessage && firstMessage.role === "user") {
        const content = firstMessage.content;
        const legacyMatch = content.match(/^(You are [^\n]+)\n\nUser request: /);
        if (legacyMatch) {
          systemPrompt = legacyMatch[1];
          firstMessage.content = content.replace(legacyMatch[1] + "\n\n", "");
        }
      }

      const requestBody: Record<string, unknown> = {
        model: config.model,
        messages: processedMessages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
      };

      if (systemPrompt && config.supportsSystemPrompt) {
        requestBody.system = systemPrompt;
      }

      if (tools.length > 0 && config.supportsTools) {
        requestBody.tools = tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        }));
      }

      const headers: Record<string, string> = {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        ...config.headers,
      };

      let response: Response;
      try {
        response = await fetch(`${config.baseUrl}/v1/messages`, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      const body = await response.json() as {
        content?: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
        stop_reason?: string;
        usage?: { input_tokens: number; output_tokens: number };
        error?: { message: string };
      };

      if (!response.ok) {
        const errorMsg = body.error?.message ?? `Request failed with status ${response.status}`;
        console.error(`[API Error] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      const content = body.content ?? [];

      return {
        content: content.map((block) =>
          block.type === "tool_use"
            ? { type: "tool_use" as const, id: block.id!, name: block.name!, input: block.input! }
            : { type: "text" as const, text: block.text! },
        ),
        stop_reason: body.stop_reason ?? "end_turn",
        usage: {
          input_tokens: body.usage?.input_tokens ?? 0,
          output_tokens: body.usage?.output_tokens ?? 0,
        },
      };
    },
  };
}

/**
 * Create Gemini provider
 */
function createGeminiProvider(config: ProviderConfig): StandaloneLLMProvider {
  return {
    async call(
      messages: StandaloneConversationMessage[],
      _turnId: number,
      tools: BenchmarkToolDefinition[] = [],
    ) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeout);

      // Convert messages to Gemini format
      const contents = messages.map((message) => {
        if (message.role === "tool") {
          return {
            role: "user",
            parts: [{ text: `[Tool Result: ${message.name}] ${message.content}` }],
          };
        } else if (message.role === "assistant_content") {
          const content = message.content as Array<{ type: string; text?: string }>;
          const text = content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("\n");
          return { role: "model", parts: [{ text: text || "" }] };
        } else if (message.role === "user") {
          return { role: "user", parts: [{ text: message.content as string }] };
        } else if (message.role === "assistant") {
          return { role: "model", parts: [{ text: message.content as string }] };
        }
        return { role: "user", parts: [{ text: "" }] };
      });

      const requestBody: Record<string, unknown> = {
        contents,
        generationConfig: {
          maxOutputTokens: config.maxTokens,
          temperature: config.temperature,
        },
      };

      if (tools.length > 0 && config.supportsTools) {
        requestBody.tools = [{
          functionDeclarations: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          })),
        }];
      }

      let response: Response;
      try {
        response = await fetch(
          `${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...config.headers,
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          },
        );
      } finally {
        clearTimeout(timeout);
      }

      const body = await response.json() as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> } }>;
          };
          finishReason?: string;
        }>;
        usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
        error?: { message: string };
      };

      if (!response.ok) {
        const errorMsg = body.error?.message ?? `Request failed with status ${response.status}`;
        console.error(`[API Error] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      const candidate = body.candidates?.[0];
      const parts = candidate?.content?.parts ?? [];

      const content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }> = [];

      for (const part of parts) {
        if (part.text) {
          content.push({ type: "text", text: part.text });
        }
        if (part.functionCall) {
          content.push({
            type: "tool_use",
            id: `gemini-${Date.now()}`,
            name: part.functionCall.name,
            input: part.functionCall.args,
          });
        }
      }

      return {
        content: content.map((block) =>
          block.type === "tool_use"
            ? { type: "tool_use" as const, id: block.id!, name: block.name!, input: block.input! }
            : { type: "text" as const, text: block.text! },
        ),
        stop_reason: candidate?.finishReason === "STOP" ? "end_turn" : "tool_use",
        usage: {
          input_tokens: body.usageMetadata?.promptTokenCount ?? 0,
          output_tokens: body.usageMetadata?.candidatesTokenCount ?? 0,
        },
      };
    },
  };
}

export { loadProviderConfig };
export type { ProviderConfig };

// Re-export from provider-config.ts for backward compatibility
export { listAvailableProviders, generateProviderConfigTemplate } from "./provider-config.js";
