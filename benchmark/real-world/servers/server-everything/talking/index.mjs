#!/usr/bin/env node
/**
 * Talking variant of @modelcontextprotocol/server-everything.
 *
 * Self-contained wrapper that reimplements the 8 simple core tools with
 * the SAME logic PLUS contextual hints on error/validation scenarios.
 * Implements the Distributed Prompting (Prompt-On-Call) pattern.
 *
 * Skipped tools (too complex or require special client capabilities):
 * - gzip-file-as-resource: complex fetch + gzip logic
 * - trigger-long-running-operation: requires progressToken support
 * - toggle-simulated-logging: toggle, no error scenario
 * - toggle-subscriber-updates: toggle, no error scenario
 *
 * Hints are added when:
 * - get-resource-reference throws invalid type → suggest valid types
 * - get-resource-reference throws invalid ID → suggest positive integers
 * - get-annotated-message with error type → note about error handling
 * - get-structured-content → hint about available cities
 * - Any Zod/validation error → wrap with recovery hint
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ─── withHints helper ─────────────────────────────────────────────────────────
function withHints(text, hints) {
  if (!hints || hints.length === 0) return text;
  return text + "\n\n" + hints.map(h => `→ ${h}`).join("\n");
}

// ─── Resource template helpers (inlined from original) ────────────────────────
const RESOURCE_TYPE_TEXT = "Text";
const RESOURCE_TYPE_BLOB = "Blob";
const RESOURCE_TYPES = [RESOURCE_TYPE_TEXT, RESOURCE_TYPE_BLOB];

function textResourceUri(resourceId) {
  return new URL(`demo://resource/dynamic/text/${resourceId}`);
}

function blobResourceUri(resourceId) {
  return new URL(`demo://resource/dynamic/blob/${resourceId}`);
}

function textResource(uri, resourceId) {
  const timestamp = new Date().toLocaleTimeString();
  return {
    uri: uri.toString(),
    mimeType: "text/plain",
    text: `Resource ${resourceId}: This is a plaintext resource created at ${timestamp}`,
  };
}

function blobResource(uri, resourceId) {
  const timestamp = new Date().toLocaleTimeString();
  const resourceText = Buffer.from(
    `Resource ${resourceId}: This is a base64 blob created at ${timestamp}`,
  ).toString("base64");
  return {
    uri: uri.toString(),
    mimeType: "text/plain",
    blob: resourceText,
  };
}

// ─── MCP tiny image (from original) ───────────────────────────────────────────
const MCP_TINY_IMAGE = "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";

// ─── Server setup ─────────────────────────────────────────────────────────────
const server = new McpServer({
  name: "everything-server",
  version: "0.1.0",
});

// ─── echo ──────────────────────────────────────────────────────────────────────
server.registerTool("echo", {
  title: "Echo Tool",
  description: "Echoes back the input string",
  inputSchema: { message: z.string().describe("Message to echo") },
}, async ({ message }) => {
  return {
    content: [{ type: "text", text: `Echo: ${message}` }],
  };
});

// ─── get-sum ───────────────────────────────────────────────────────────────────
server.registerTool("get-sum", {
  title: "Get Sum Tool",
  description: "Returns the sum of two numbers",
  inputSchema: {
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
  },
}, async ({ a, b }) => {
  const sum = a + b;
  return {
    content: [{ type: "text", text: `The sum of ${a} and ${b} is ${sum}.` }],
  };
});

// ─── get-tiny-image ────────────────────────────────────────────────────────────
server.registerTool("get-tiny-image", {
  title: "Get Tiny Image Tool",
  description: "Returns a tiny MCP logo image.",
  inputSchema: {},
}, async () => {
  return {
    content: [
      { type: "text", text: "Here's the image you requested:" },
      { type: "image", data: MCP_TINY_IMAGE, mimeType: "image/png" },
      { type: "text", text: "The image above is the MCP logo." },
    ],
  };
});

// ─── get-annotated-message ─────────────────────────────────────────────────────
server.registerTool("get-annotated-message", {
  title: "Get Annotated Message Tool",
  description: "Demonstrates how annotations can be used to provide metadata about content.",
  inputSchema: {
    messageType: z.enum(["error", "success", "debug"])
      .describe("Type of message to demonstrate different annotation patterns"),
    includeImage: z.boolean().default(false)
      .describe("Whether to include an example image"),
  },
}, async ({ messageType, includeImage }) => {
  const content = [];
  const hints = [];

  if (messageType === "error") {
    content.push({
      type: "text",
      text: "Error: Operation failed",
      annotations: {
        priority: 1.0,
        audience: ["user", "assistant"],
      },
    });
    hints.push(
      "This is a demonstration error message. For real error handling, check the tool's response and take appropriate action.",
    );
  } else if (messageType === "success") {
    content.push({
      type: "text",
      text: withHints("Operation completed successfully", [
        "Received success annotated message. **See all types**: call get-annotated-message with type='error', 'success', and 'debug' to compare.",
      ]),
      annotations: {
        priority: 0.7,
        audience: ["user"],
      },
    });
  } else if (messageType === "debug") {
    content.push({
      type: "text",
      text: withHints("Debug: Cache hit ratio 0.95, latency 150ms", [
        "Received debug annotated message. **See all types**: call get-annotated-message with type='error', 'success', and 'debug' to compare.",
      ]),
      annotations: {
        priority: 0.3,
        audience: ["assistant"],
      },
    });
  }

  if (includeImage) {
    content.push({
      type: "image",
      data: MCP_TINY_IMAGE,
      mimeType: "image/png",
      annotations: {
        priority: 0.5,
        audience: ["user"],
      },
    });
  }

  // Add hint text block if we have hints
  if (hints.length > 0) {
    const lastBlock = content[content.length - 1];
    if (lastBlock.type === "text") {
      lastBlock.text = withHints(lastBlock.text, hints);
    } else {
      content.push({ type: "text", text: hints.map(h => `→ ${h}`).join("\n") });
    }
  }

  return { content };
});

// ─── get-structured-content ────────────────────────────────────────────────────
server.registerTool("get-structured-content", {
  title: "Get Structured Content Tool",
  description: "Returns structured content along with an output schema for client data validation",
  inputSchema: {
    location: z.enum(["New York", "Chicago", "Los Angeles"])
      .describe("Choose city"),
  },
  outputSchema: {
    temperature: z.number().describe("Temperature in celsius"),
    conditions: z.string().describe("Weather conditions description"),
    humidity: z.number().describe("Humidity percentage"),
  },
}, async ({ location }) => {
  let weather;
  switch (location) {
    case "New York":
      weather = { temperature: 33, conditions: "Cloudy", humidity: 82 };
      break;
    case "Chicago":
      weather = { temperature: 36, conditions: "Light rain / drizzle", humidity: 82 };
      break;
    case "Los Angeles":
      weather = { temperature: 73, conditions: "Sunny / Clear", humidity: 48 };
      break;
  }

  const text = JSON.stringify(weather);
  const hintText = withHints(text, [
    `Weather for ${location}: ${weather.temperature}°C, ${weather.conditions}. Available cities: New York, Chicago, Los Angeles. **Compare**: call get-structured-content for other cities to build a comparison.`,
  ]);

  return {
    content: [{ type: "text", text: hintText }],
    structuredContent: weather,
  };
});

// ─── get-resource-links ────────────────────────────────────────────────────────
server.registerTool("get-resource-links", {
  title: "Get Resource Links Tool",
  description: "Returns up to ten resource links that reference different types of resources",
  inputSchema: {
    count: z.number().min(1).max(10).default(3)
      .describe("Number of resource links to return (1-10)"),
  },
}, async ({ count }) => {
  const content = [];
  content.push({
    type: "text",
    text: `Here are ${count} resource links to resources available in this server:`,
  });

  for (let resourceId = 1; resourceId <= count; resourceId++) {
    const isOdd = resourceId % 2 === 0;
    const uri = isOdd ? textResourceUri(resourceId) : blobResourceUri(resourceId);
    const resource = isOdd ? textResource(uri, resourceId) : blobResource(uri, resourceId);
    content.push({
      type: "resource_link",
      uri: resource.uri,
      name: `${isOdd ? "Text" : "Blob"} Resource ${resourceId}`,
      description: `Resource ${resourceId}: ${resource.mimeType === "text/plain" ? "plaintext resource" : "binary blob resource"}`,
      mimeType: resource.mimeType,
    });
  }

  // Add happy-path hint
  const lastBlock = content[content.length - 1];
  if (lastBlock.type === "text") {
    lastBlock.text = withHints(lastBlock.text, [
      `Found ${count} resource links (IDs 1-10). **Explore**: use get-resource-reference(resourceType, resourceId) to read individual resources. Type must be 'Text' or 'Blob'.`,
    ]);
  }

  return { content };
});

// ─── get-resource-reference ────────────────────────────────────────────────────
server.registerTool("get-resource-reference", {
  title: "Get Resource Reference Tool",
  description: "Returns a resource reference that can be used by MCP clients",
  inputSchema: {
    resourceType: z.enum([RESOURCE_TYPE_TEXT, RESOURCE_TYPE_BLOB])
      .default(RESOURCE_TYPE_TEXT),
    resourceId: z.number().default(1)
      .describe("ID of the text resource to fetch"),
  },
}, async (args) => {
  const { resourceType } = args;

  // Validate resource type
  if (!RESOURCE_TYPES.includes(resourceType)) {
    return {
      content: [{
        type: "text",
        text: withHints(`Error: Invalid resourceType: ${args?.resourceType}`, [
          "Invalid resourceType: '${args?.resourceType}'. **Valid types**: 'Text' (plain text content) or 'Blob' (base64-encoded content). Even-numbered resourceIds return Text, odd-numbered return Blob.",
        ]),
      }],
      isError: true,
    };
  }

  // Validate resourceId
  const resourceId = Number(args?.resourceId);
  if (!Number.isFinite(resourceId) || !Number.isInteger(resourceId) || resourceId < 1) {
    return {
      content: [{
        type: "text",
        text: withHints(`Error: Invalid resourceId: ${args?.resourceId}`, [
          "Invalid resourceId: '${args?.resourceId}'. Must be a **positive integer** (1, 2, 3...). Resource links with IDs 1-10 are available — use get-resource-links to see them.",
        ]),
      }],
      isError: true,
    };
  }

  // Get resource based on type
  const uri = resourceType === RESOURCE_TYPE_TEXT
    ? textResourceUri(resourceId)
    : blobResourceUri(resourceId);
  const resource = resourceType === RESOURCE_TYPE_TEXT
    ? textResource(uri, resourceId)
    : blobResource(uri, resourceId);

  return {
    content: [
      { type: "text", text: `Returning resource reference for Resource ${resourceId}:` },
      { type: "resource", resource },
      { type: "text", text: `You can access this resource using the URI: ${resource.uri}` },
    ],
  };
});

// ─── get-env ───────────────────────────────────────────────────────────────────
server.registerTool("get-env", {
  title: "Print Environment Tool",
  description: "Returns all environment variables, helpful for debugging MCP server configuration",
  inputSchema: {},
}, async () => {
  return {
    content: [{ type: "text", text: JSON.stringify(process.env, null, 2) }],
  };
});

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Everything MCP Server (talking variant) running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
