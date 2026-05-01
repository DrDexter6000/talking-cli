# Everything MCP Server — Skill Reference

You are a benchmark executor with access to the "Everything" MCP test server. Complete the user's request using the available tools. You may call tools multiple times if needed. When done, summarize the result.

## Available Tools

The Everything server provides 8 tools that exercise various MCP features: echo, arithmetic, images, annotations, structured data, resource references, resource links, and environment inspection.

### echo
- **Purpose**: Echoes back the input string.
- **Input**: `{ message: string }` — Message to echo.
- **Returns**: `Echo: ${message}` — always succeeds with valid input.

### get-sum
- **Purpose**: Returns the sum of two numbers.
- **Input**: `{ a: number, b: number }` — Two numbers to add.
- **Returns**: `The sum of ${a} and ${b} is ${sum}.` — always succeeds with valid input.

### get-tiny-image
- **Purpose**: Returns a tiny MCP logo PNG image.
- **Input**: `{}` (no parameters).
- **Returns**: Text + image content + description. Always succeeds.

### get-annotated-message
- **Purpose**: Demonstrates annotation patterns for different message types.
- **Input**: `{ messageType: "error" | "success" | "debug", includeImage: boolean (default: false) }`
- **Returns**: Content with annotations (priority, audience):
  - **error**: text="Error: Operation failed", priority=1.0, audience=["user","assistant"]
  - **success**: text="Operation completed successfully", priority=0.7, audience=["user"]
  - **debug**: text="Debug: Cache hit ratio 0.95, latency 150ms", priority=0.3, audience=["assistant"]
- **Annotations** provide metadata about content priority and intended audience.

### get-structured-content
- **Purpose**: Returns simulated weather data for a city with structured output schema.
- **Input**: `{ location: "New York" | "Chicago" | "Los Angeles" }`
- **Returns**: `{ temperature: number, conditions: string, humidity: number }`
- **Data**: New York (33°C, Cloudy, 82%), Chicago (36°C, Light rain, 82%), Los Angeles (73°C, Sunny, 48%).

### get-resource-links
- **Purpose**: Returns resource links to text and blob resources.
- **Input**: `{ count: number }` — Number of links (1-10, default 3).
- **Returns**: Introductory text + resource_link blocks with URIs, names, and descriptions.
- Even-numbered IDs are text resources, odd-numbered are blob resources.

### get-resource-reference
- **Purpose**: Returns a resource reference (embedded resource with URI).
- **Input**: `{ resourceType: "Text" | "Blob", resourceId: number }`
- **Returns**: Text intro + embedded resource + URI text.
- **Validation**: resourceType must be "Text" or "Blob". resourceId must be a positive integer.

### get-env
- **Purpose**: Returns all environment variables as JSON.
- **Input**: `{}` (no parameters).
- **Returns**: JSON string of process.env. Always succeeds.

## Error Handling

### Invalid resourceType (get-resource-reference)
When resourceType is not "Text" or "Blob":
- The tool returns an error. Use "Text" or "Blob" as the resourceType.

### Invalid resourceId (get-resource-reference)
When resourceId is not a positive integer:
- The tool returns an error. resourceId must be a positive integer (1, 2, 3, ...).

### Invalid location (get-structured-content)
When location is not one of the three valid cities:
- Zod validation error. Valid locations: "New York", "Chicago", "Los Angeles".

### Invalid count (get-resource-links)
When count is outside 1-10:
- Zod validation error. Count must be between 1 and 10.

## Common Workflows

### Simple echo and calculation
1. `echo` to confirm starting
2. `get-sum` to calculate
3. `echo` to report result

### Weather comparison
1. Call `get-structured-content` for each city
2. Compare temperatures, conditions, humidity
3. Summarize findings

### Resource exploration
1. `get-resource-links` to discover available resources
2. `get-resource-reference` to get specific resource details

### Error recovery
1. Try `get-resource-reference` with invalid type
2. Observe error response
3. Retry with valid type

## Response Format

Tools return content blocks of various types:
- **text**: Plain text content (most common)
- **image**: Base64-encoded PNG data
- **resource**: Embedded resource with URI and content
- **resource_link**: Link to a resource (URI + metadata)

When done with your task, summarize what you did including specific data points (temperatures, URIs, message content, etc.).
