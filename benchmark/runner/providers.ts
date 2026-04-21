import type {
  StandaloneConversationMessage,
  StandaloneLLMProvider,
} from "./standalone-executor.js";
import type { BenchmarkToolDefinition } from "./types.js";

// DeepSeek API specifications:
// - Base URL: https://api.deepseek.com
// - Format: OpenAI compatible
// - Models: deepseek-chat (non-thinking), deepseek-reasoner (thinking)
// - Auth: Bearer token in Authorization header
// - Context Window: 64K tokens
const REQUEST_TIMEOUT_MS = 300_000; // 5 minutes for complex tasks
const MAX_OUTPUT_TOKENS = 4096; // 4K tokens limit as requested

export function createStubProvider(): StandaloneLLMProvider {
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

function createDeepSeekProvider(): StandaloneLLMProvider {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is required for benchmark provider 'deepseek'.");
  }
  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

  // Validate model name
  const validModels = ["deepseek-chat", "deepseek-reasoner"];
  if (!validModels.includes(model)) {
    console.warn(`[WARNING] Unknown DeepSeek model '${model}'. Valid models: ${validModels.join(", ")}`);
  }

  return {
    async call(
      messages: StandaloneConversationMessage[],
      _turnId: number,
      tools: BenchmarkToolDefinition[] = [],
    ) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      // Convert messages to OpenAI format
      const processedMessages = messages.reduce<Array<{ role: string; content: string }>>((acc, message) => {
        if (message.role === "tool") {
          acc.push({
            role: "user",
            content: `[Tool Result: ${message.name}] ${message.content}`,
          });
        } else if (message.role === "assistant_content") {
          // Extract text content from assistant_content
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

      // Extract system prompt if present
      // Supports two formats:
      // 1. "You are xxx\n\nUser request: ..." (legacy format)
      // 2. "---\nname: xxx\n...\n---\n# Title\n...\n\nUser request: ..." (YAML frontmatter format)
      let systemPrompt: string | undefined;
      const firstMessage = processedMessages[0];
      if (firstMessage && firstMessage.role === "user") {
        const content = firstMessage.content;
        
        // Try legacy format first
        const legacyMatch = content.match(/^(You are [^\n]+)\n\nUser request: /);
        if (legacyMatch) {
          systemPrompt = legacyMatch[1];
          firstMessage.content = content.replace(legacyMatch[1] + "\n\n", "");
        } else {
          // Try YAML frontmatter format: extract everything before "User request:"
          const yamlMatch = content.match(/^(---[\s\S]*?---\n[\s\S]*?)\n\nUser request: /);
          if (yamlMatch) {
            systemPrompt = yamlMatch[1].trim();
            firstMessage.content = content.replace(yamlMatch[1] + "\n\n", "");
          }
        }
      }

      const requestBody: Record<string, unknown> = {
        model,
        messages: systemPrompt 
          ? [{ role: "system", content: systemPrompt }, ...processedMessages]
          : processedMessages,
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 1.0,
      };

      // Add tools if provided (DeepSeek supports function calling)
      if (tools.length > 0) {
        requestBody.tools = tools.map((tool) => ({
          type: "function" as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          },
        }));
      }

      let response: Response;
      try {
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${apiKey}`,
          },
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
            reasoning_content?: string;
          };
          finish_reason: string;
        }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
        error?: { message: string };
      };

      if (!response.ok) {
        const errorMsg = body.error?.message ?? `DeepSeek request failed with status ${response.status}`;
        console.error(`[API Error] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      const choice = body.choices?.[0];
      if (!choice) {
        throw new Error("DeepSeek returned empty choices");
      }

      const content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }> = [];

      // Add text content
      if (choice.message.content) {
        content.push({ type: "text", text: choice.message.content });
      }

      // Add tool calls
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

export function createProvider(name: string): StandaloneLLMProvider {
  if (name === "stub") {
    return createStubProvider();
  }

  if (name === "deepseek") {
    return createDeepSeekProvider();
  }

  throw new Error(
    `Unsupported benchmark provider: ${name}. Supported providers: stub, deepseek.`,
  );
}
