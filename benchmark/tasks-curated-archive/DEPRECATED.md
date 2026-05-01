# ARCHIVED — Historical Synthetic Benchmark

This directory contains the **superseded synthetic benchmark** (15 hand-crafted filesystem tasks).

## Status

**Archived as of 2026-04-30.** Do not use for new benchmark runs.

The synthetic benchmark served its purpose — it provided the initial 2×2 ablation data (GLM-5.1, Kimi K2.6, DeepSeek V4 Pro) that validated the Distributed Prompting methodology. However, it has known limitations:

1. **Artificial tasks** — hand-crafted prompts targeting a vendored filesystem server, not representative of real MCP ecosystem usage
2. **Single data model** — only filesystem operations (read/write/list/search), no knowledge graph, no API calls, no streaming
3. **Vendor-locked** — the mute/talking variants are built into vendored server copies, not wrappers around real npm packages

## Replacement

All future benchmark runs use the **real-world benchmark** at `benchmark/real-world/`, which tests:

- `@modelcontextprotocol/server-memory` — knowledge graph (10 tasks)
- `@modelcontextprotocol/server-everything` — multi-tool workflows (7 tasks)
- MCP-Atlas adapted tasks — external API queries (10 tasks, external-validity artifacts)

Run via:
```bash
node benchmark/real-world/cli.mjs --provider <provider> --target all
```

## Historical Results

Historical results from synthetic runs remain in `benchmark/results/` (gitignored). They are cited in README.md and PHILOSOPHY.md as initial validation data.
