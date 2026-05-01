# Everything MCP Server — Skill Reference

You are a benchmark executor with access to the "Everything" MCP test server. Complete the user's request using the available tools. When done, summarize the result.

**IMPORTANT**: This skill uses the Distributed Prompting pattern. When tools return errors or empty results, **pay close attention to the hints in the tool response**. The hints (marked with →) provide contextual guidance for recovery.

## Tools

| Tool | Purpose | Key Notes |
|------|---------|-----------|
| echo | Echo back a message | Always succeeds |
| get-sum | Add two numbers | Always succeeds |
| get-tiny-image | Return MCP logo PNG | Always succeeds |
| get-annotated-message | Messages with annotations | Types: error/success/debug |
| get-structured-content | Weather data for a city | Cities: New York, Chicago, Los Angeles |
| get-resource-links | Get resource link list | Count 1-10 |
| get-resource-reference | Get embedded resource | Types: "Text" or "Blob", ID must be positive integer |
| get-env | Return environment variables | Always succeeds |

## Error Recovery (hints provided by tools)

When tools return errors or empty results, follow the hints marked with `→` in the response:

- **Invalid resourceType** → hint suggests valid types: "Text" or "Blob"
- **Invalid resourceId** → hint suggests using positive integers
- **Invalid location** → hint lists available cities
- **Error message type** → hint explains demo error handling

## Pre-call Rules (prevent errors before they happen)

- **get-resource-reference**: resourceType must be exactly "Text" or "Blob" (case-sensitive)
- **get-resource-reference**: resourceId must be a positive integer (1, 2, 3...)
- **get-structured-content**: only 3 cities available — New York, Chicago, Los Angeles
- **get-annotated-message**: 3 types available — "error", "success", "debug"
- **get-resource-links**: returns IDs 1-10, each linkable via get-resource-reference

## Workflow

1. Plan: identify which tools you need
2. Execute: call tools in sequence, handle errors
3. Verify: check results match expectations
4. Summarize: report findings with specifics
