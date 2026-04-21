import type {
  StandaloneConversationMessage,
  StandaloneLLMProvider,
} from "./standalone-executor.js";
import type { BenchmarkToolDefinition } from "./types.js";

type AnthropicTextBlock = {
  type: "text";
  text: string;
};

type AnthropicToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};

type AnthropicThinkingBlock = {
  type: "thinking";
  thinking: string;
};

type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock | AnthropicThinkingBlock;

type AnthropicResponse = {
  content?: AnthropicContentBlock[];
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
};

const REQUEST_TIMEOUT_MS = 90_000;
const MAX_OUTPUT_TOKENS = 30720;

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

function createAnthropicProvider(): StandaloneLLMProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required for benchmark provider 'anthropic'.");
  }
  const baseUrl = (process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com").replace(/\/$/, "");
  // MiniMax has two endpoints:
  // - api.minimax.io (international) - for pay-as-you-go keys
  // - api.minimaxi.com (China) - for Coding Plan keys (sk-cp-...)
  // The correct endpoint depends on the key type, not a universal rule.
  if (baseUrl.includes("minimax.io") && apiKey.startsWith("sk-cp-")) {
    console.warn("[WARNING] Coding Plan key (sk-cp-...) detected with international endpoint (api.minimax.io). China endpoint (api.minimaxi.com) may be required.");
  }
  const model = process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest";

  return {
    async call(
      messages: StandaloneConversationMessage[],
      _turnId: number,
      tools: BenchmarkToolDefinition[] = [],
    ) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      // Extract system prompt from first user message (benchmark convention)
      // MiniMax requires 'system' as a top-level field, not inside messages
      let systemPrompt: string | undefined;
      const processedMessages = messages.reduce<Array<{ role: string; content: unknown }>>((acc, message) => {
        if (message.role === "tool") {
          acc.push({
            role: "user",
            content: [{
              type: "tool_result",
              tool_use_id: message.toolUseId,
              content: message.content,
              is_error: message.isError ?? false,
            }],
          });
        } else if (message.role === "assistant_content") {
          acc.push({
            role: "assistant",
            content: message.content,
          });
        } else if (message.role === "user") {
          const text = message.content as string;
          // Extract system prompt if present (format: "system prompt\n\nUser request: ...")
          const systemMatch = text.match(/^(You are [^\n]+)\n\nUser request: /);
          if (systemMatch && !systemPrompt) {
            systemPrompt = systemMatch[1];
            acc.push({
              role: "user",
              content: [{ type: "text", text: text.replace(systemMatch[1] + "\n\n", "") }],
            });
          } else {
            acc.push({
              role: "user",
              content: [{ type: "text", text }],
            });
          }
        } else {
          acc.push({
            role: message.role,
            content: [{ type: "text", text: message.content as string }],
          });
        }
        return acc;
      }, []);

      const requestBody: Record<string, unknown> = {
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 1.0,
        messages: processedMessages,
      };

      if (systemPrompt) {
        requestBody.system = systemPrompt;
      }

      if (tools.length > 0) {
        requestBody.tools = tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        }));
      }

      let response: Response;
      try {
        response = await fetch(`${baseUrl}/v1/messages`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      const body = (await response.json()) as AnthropicResponse;
      if (!response.ok) {
        throw new Error(body.error?.message ?? `Anthropic request failed with status ${response.status}`);
      }

      // Filter out thinking blocks from the actionable response.
      // Extended-thinking providers (MiniMax, Claude) emit { type: "thinking" } blocks
      // that are part of the model's internal reasoning chain — not actionable content.
      // These blocks are excluded from the response content but the LLMResponse metadata
      // (stop_reason, usage) still reflects the full generation including thinking.
      const actionableContent = (body.content ?? []).filter(
        (block): block is AnthropicTextBlock | AnthropicToolUseBlock => block.type !== "thinking",
      );

      return {
        content: actionableContent.map((block) =>
          block.type === "tool_use"
            ? { type: "tool_use" as const, id: block.id, name: block.name, input: block.input }
            : { type: "text" as const, text: block.text },
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

export function createProvider(name: string): StandaloneLLMProvider {
  if (name === "stub") {
    return createStubProvider();
  }

  if (name === "anthropic") {
    return createAnthropicProvider();
  }

  throw new Error(
    `Unsupported benchmark provider: ${name}. Supported providers: stub, anthropic.`,
  );
}
