# src/mcp/ — MCP Server Audit Subsystem

**Parent**: [../AGENTS.md](../AGENTS.md)

## OVERVIEW

Parallel audit engine (M1-M4) for MCP servers — mirrors `src/` structure but targets MCP server packages instead of skill directories.

## STRUCTURE

```
src/mcp/
├── engine.ts          # runMcpEngine() — shallow (M1+M2) or deep (M1-M4)
├── discovery.ts       # Static parse of server.registerTool() / server.tool() call sites
├── types.ts           # McpToolDefinition, McpEngineOutput
├── rules/
│   ├── m1.ts          # Contract Purity — description free of strategy/guidance phrases
│   ├── m2.ts          # Annotation Completeness — readOnlyHint, idempotentHint, destructiveHint
│   ├── m3.ts          # Runtime Guidance — tool responses contain actionable guidance (deep only)
│   └── m4.ts          # Error Actionability — errors not raw stack traces/HTTP dumps (deep only)
├── renderers/
│   ├── coach.ts       # renderMcpCoach(output, persona)
│   ├── ci.ts          # renderMcpCI(output) + getMcpExitCode(output)
│   └── json.ts        # renderMcpJSON(output)
└── runtime/
    ├── stdio-transport.ts      # StdioMcpTransport — JSON-RPC 2024-11-05 over stdio
    ├── scenario-generator.ts   # generateScenarios(tool) — error ({}) + empty-result (readOnly only)
    ├── executor.ts             # executeScenarios(transport, tools) → ScenarioResult[]
    ├── detect-server-command.ts # Auto-detect Node/Python server launch command
    └── types.ts                # RuntimeConfig, McpTransport, TestScenario, ScenarioResult
```

## M1-M4 THRESHOLDS

| Rule | Evaluates | Method | Threshold |
|------|-----------|--------|-----------|
| M1 | Contract Purity | 40+ regex patterns for strategy/guidance phrases in descriptions | 100 all-pass, 0 any-fail |
| M2 | Annotation Completeness | Checks 3 annotations present per tool | ≥80 PASS, ≥50 PARTIAL |
| M3 | Runtime Guidance | 18 guidance patterns in tool responses (deep) | ≥80 PASS, ≥50 PARTIAL |
| M4 | Error Actionability | Filters stack traces, HTTP dumps, bare SDK errors (deep) | ≥80 PASS, ≥50 PARTIAL |

**Total**: average of applicable heuristics (M3/M4 excluded if `NOT_APPLICABLE`)

## DISCOVERY vs src/discovery.ts

| | `src/discovery.ts` | `src/mcp/discovery.ts` |
|--|-------------------|----------------------|
| Target | Skill dirs (SKILL.md + tools/) | MCP server entry point |
| Method | File walk | Regex parse of `server.registerTool()` / `server.tool()` |
| Output | `{skillMdPath, tools[], fixtures[]}` | `McpToolDefinition[]` |

## RUNTIME DETAILS

- **StdioMcpTransport**: Windows bare-command resolution via `where` + `cmd /c`. Initialize timeout 30s, call timeout 10s.
- **Scenario generator**: Never generates scenarios for `destructiveHint===true` tools. Empty-result only for `readOnlyHint===true`.
- **Executor**: calls `transport.callTool()` per scenario, extracts text content from results.
- **Server command detection**: `package.json` (Node) → `pyproject.toml` → `setup.py` → Python heuristics.

## ANTI-PATTERNS

- **M1 `NOT_APPLICABLE`**: returned for Python servers without `package.json` in deep mode — can't parse statically
- **M3/M4 require `--deep`**: shallow mode only runs M1+M2, returns `NOT_APPLICABLE` for M3/M4 with score 100
