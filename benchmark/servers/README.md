# Benchmark MCP Servers

Vendored copies of `@modelcontextprotocol/server-filesystem` at pinned commit
`4503e2d`, provided in two variants for the evidence harness benchmark.

## Structure

```
servers/
├── core/              # Shared logic (identical in both variants)
│   ├── lib.ts         # File operations (read, write, edit, search, tail, head)
│   ├── path-utils.ts  # Path normalization (WSL-safe, cross-platform)
│   ├── path-validation.ts  # Security: path-within-allowed-dirs check
│   └── roots-utils.ts # MCP roots protocol handling
├── variants/
│   ├── mute/          # Control: upstream behavior, no hints in tool responses
│   │   ├── index.ts
│   │   └── tsconfig.json
│   └── talking/       # Treatment: tool responses include actionable hints
│       ├── index.ts
│       ├── hints.ts   # Centralized hint definitions
│       └── tsconfig.json
├── tsconfig.base.json # Shared compiler options
├── package.json       # Shared dependencies
└── scripts/
    └── build.ps1      # Build both variants
```

## Variants

| Variant | Tool responses | Purpose |
|---------|---------------|---------|
| **mute** | Raw data only | Control arm — baseline agent behavior |
| **talking** | Data + actionable hints (`→ ...`) | Treatment arm — Distributed Prompting |

The only behavioral difference: the `talking` variant appends contextual hints to
tool responses when the result is empty, an error occurs, or a special condition
is met (e.g., empty directory, no search matches). Hints are defined in
`variants/talking/hints.ts`.

## Build

```powershell
# From project root:
pwsh benchmark/servers/scripts/build.ps1

# Or manually:
cd benchmark/servers && npm install
npx tsc -p variants/mute/tsconfig.json
npx tsc -p variants/talking/tsconfig.json
```

## Usage

```bash
# Mute (control)
node benchmark/servers/variants/mute/dist/index.js /path/to/sandbox

# Talking (treatment)
node benchmark/servers/variants/talking/dist/index.js /path/to/sandbox
```

The server speaks JSON-RPC over stdio (MCP protocol). It accepts one or more
allowed directory paths as command-line arguments.

## Upstream

- **Source**: https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem
- **Pinned commit**: `4503e2d12b799448cd05f789dd40f9643a8d1a6c`
- **Delta**: `talking` variant adds hint infrastructure; `mute` is unmodified upstream
