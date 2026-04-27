# Real-World Benchmark: server-memory

Real-world validation benchmark using `@modelcontextprotocol/server-memory` — a knowledge graph MCP server with 9 tools. This proves that adding Distributed Prompting hints to a **real audited MCP server** improves agent behavior.

## What this tests

Unlike the synthetic benchmark (`benchmark/`) which tests a vendored filesystem server with hand-crafted mute/talking variants, this benchmark tests a **real, npm-published MCP server** (`@modelcontextprotocol/server-memory`) with minimal modifications.

**Key finding from Phase 1 audit**: server-memory scored M3=0 (zero hint guidance across all 9 scenarios). All responses are raw JSON like `{"entities":[],"relations":[]}`.

### Server-memory tools (9 total)

| Tool | Purpose | Hint trigger |
|------|---------|-------------|
| create_entities | Create entities with name, type, observations | Duplicate names |
| create_relations | Create directed relations between entities | Missing entities |
| add_observations | Add facts to existing entities | Entity not found |
| delete_entities | Remove entities + cascade relations | Non-existent names |
| delete_observations | Remove specific observations | — |
| delete_relations | Remove specific relations | — |
| read_graph | Read entire knowledge graph | Empty graph |
| search_nodes | Search by name/type/observations | No results |
| open_nodes | Get entities by exact name | Not found |

### Variants

- **mute**: Original `@modelcontextprotocol/server-memory` — returns raw JSON, zero hints
- **talking**: Wrapper that adds contextual hints on error/empty results (e.g., "The knowledge graph is empty. Use create_entities to add entities first.")

## Directory structure

```
benchmark/real-world/
├── cli.mjs                           # Self-contained benchmark executor
├── checkers/memory-checkers.js       # 10 checker functions for task validation
├── servers/server-memory/
│   ├── mute/                         # npm install of original server
│   │   └── node_modules/@modelcontextprotocol/server-memory/
│   └── talking/                      # Talking variant with hints
│       ├── index.mjs                 # Wrapper with hint logic
│       └── node_modules/             # Same npm dependencies
├── tasks/server-memory/              # 10 task JSON files
├── skills/
│   ├── memory-full-skill.md          # Full skill (~120 lines)
│   └── memory-lean-skill.md          # Lean skill (~40 lines)
├── scripts/
│   └── run-memory-benchmark.ps1      # PowerShell runner
├── results/                          # Dated run output (gitignored)
└── README.md                         # This file
```

## How to run

### Prerequisites

1. Build the benchmark infrastructure:
   ```bash
   npm run benchmark:build
   ```

2. For non-stub providers, set the appropriate API key:
   ```bash
   $env:ZHIPU_API_KEY = "your-key-here"  # for glm-5.1
   ```

### Run with PowerShell script

```powershell
# Full run with GLM-5.1
.\benchmark\real-world\scripts\run-memory-benchmark.ps1

# Quick test with stub provider (no API key needed)
.\benchmark\real-world\scripts\run-memory-benchmark.ps1 -Provider stub -Limit 2

# Specific variants only
.\benchmark\real-world\scripts\run-memory-benchmark.ps1 -Provider glm-5.1 -Variants mute
```

### Run directly

```bash
node benchmark/real-world/cli.mjs --provider glm-5.1
node benchmark/real-world/cli.mjs --provider stub --limit 3 --variants mute
```

## Tasks (10 total)

| Task | Difficulty | Hint trigger | What it tests |
|------|-----------|-------------|---------------|
| task-memory-create-and-query | easy | none | Basic create + search |
| task-memory-relations | medium | none | Entity-relation traversal |
| task-memory-empty-search | easy | empty | Search on empty graph |
| task-memory-update-observations | medium | none | Add observations + verify |
| task-memory-complex-query | hard | none | Multi-hop relation traversal |
| task-memory-delete-cleanup | medium | none | Delete + verify remaining |
| task-memory-nonexistent-entity | easy | empty | Error handling for missing entity |
| task-memory-empty-graph-operations | easy | empty | All operations on empty graph |
| task-memory-duplicate-create | easy | none | Duplicate entity handling |
| task-memory-full-crud-cycle | hard | none | Complete CRUD + verification |

## How it differs from the synthetic benchmark

| Aspect | Synthetic benchmark | Real-world benchmark |
|--------|-------------------|---------------------|
| Server | Vendored server-filesystem | npm-published server-memory |
| Tool count | 11 (filesystem) | 9 (knowledge graph) |
| Data model | Files and directories | Entities, relations, observations |
| Skill domain | File operations | Knowledge graph operations |
| Hint implementation | Built into vendored server | Wrapper around unmodified npm package |
| State management | Filesystem sandbox | JSONL memory file (fresh per run) |

## Design decisions

1. **No filesystem sandbox**: Knowledge graph tasks use in-memory/JSONL storage, not filesystem paths. No sandbox directory needed.

2. **Fresh graph per task**: Each task run gets a fresh `MEMORY_FILE_PATH` temp file, ensuring clean state.

3. **Self-contained executor**: The `cli.mjs` includes its own MCP subprocess handler rather than depending on the compiled `StandaloneExecutor`. This makes the real-world benchmark independently runnable.

4. **Text-based checkers**: Since knowledge graph tasks don't produce files, checkers analyze the LLM's final text response for expected patterns (entity names, observation mentions, error descriptions, recovery suggestions).
