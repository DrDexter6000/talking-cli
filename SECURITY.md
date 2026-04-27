# Security Policy

## Threat Model

`talking-cli` has two execution modes with different security profiles.

### Static analysis (default, safe)

`audit` and `audit-mcp` (without `--deep`) perform **local file analysis only**. They read source files, parse code, and evaluate heuristics. No code is executed. No network requests are made. This is safe to run on any directory.

### Runtime analysis (`--deep`, elevated trust)

`audit-mcp --deep` **spawns the MCP server you point it at** and sends test calls to it. This means:

- **We execute the server you point us at.** If that server contains malicious code, it will run with your user privileges.
- **Do not run `--deep` on untrusted servers.** Only audit servers whose source code you have reviewed or that come from a trusted source.
- The server process inherits your environment variables, filesystem access, and network access.

### `--no-spawn` (explicit static-only)

If you want to guarantee no server is spawned, use `--no-spawn`:

```bash
talking-cli audit-mcp ./server --no-spawn
```

This runs only static heuristics (M1, M2) and skips all runtime heuristics (M3, M4). It is equivalent to running without `--deep`, but makes the intent explicit in CI scripts and automation.

## Resource limits

`talking-cli` does not impose resource limits on spawned servers. If you are auditing a server that may consume excessive memory or CPU:

- Run it in a container or sandbox (Docker, bubblewrap, etc.)
- Set OS-level resource limits before running `--deep`
- Use `--no-spawn` if you only need static analysis

## Reporting

Report security vulnerabilities via GitHub Issues or direct message. Do not publicly disclose unpatched vulnerabilities.
