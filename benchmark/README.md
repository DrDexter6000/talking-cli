# Benchmark Harness

This directory contains the research benchmark harness used to produce the 2×2 ablation results cited in [README.md](../README.md).

**You don't need to build or run this to use `talking-cli`.** The `talking-cli audit` and `talking-cli optimize` commands are fully local and have zero dependency on anything in `benchmark/`.

## What's here

- **`runner/`** — Standalone executor that spawns MCP servers and runs LLM-driven task loops
- **`tasks/`** — 25 hand-curated benchmark tasks (filesystem operations)
- **`tasks-curated/`** — 15-task curated subset used for 2×2 ablation
- **`servers/`** — Vendored mute/talking variants of `@modelcontextprotocol/server-filesystem`
- **`skills/`** — Full-skill (873 lines) and lean-skill (168 lines) variants used as experimental factors
- **`real-world/`** — Additional benchmark against real npm-published `server-memory`

## Reproduction

```bash
# Quick smoke test (stub provider, no API key needed)
npm run benchmark:smoke

# Full 2×2 ablation on GLM-5.1
npm run benchmark -- --provider glm-5.1 --task-dir benchmark/tasks-curated \
  --variants full-skill+lean-skill+mute+hinting
```

Full design and methodology → [docs/BENCHMARK-METHODOLOGY.md](../docs/BENCHMARK-METHODOLOGY.md)
