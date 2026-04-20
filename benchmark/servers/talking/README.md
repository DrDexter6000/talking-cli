# @modelcontextprotocol/server-filesystem (talking variant)

Upstream filesystem server **with agent hints** on the empty-result path, vendored for the Evidence Harness benchmark.

- **upstream**: 4503e2d12b799448cd05f789dd40f9643a8d1a6c
- **source**: https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem
- **delta**: Added `hints` field to `search_files` tool when the result set is empty. The hint suggests query broadening strategies with a concrete example.

**Exact change** (in `index.ts`, `search_files` handler):
```diff
- const text = results.length > 0 ? results.join("\n") : "No matches found";
- return { content: [{ type: "text" as const, text }], structuredContent: { content: text } };
+ const text = results.length > 0 ? results.join("\n") : "No matches found";
+ const hints = results.length === 0 ? ["Try broadening your search pattern with fewer filters, or use less specific wildcards. For example, instead of 'src/components/Button.tsx', try '**/Button.*' to match across the entire directory tree."] : [];
+ return { content: [{ type: "text" as const, text }], structuredContent: { content: text, hints } };
```

To build:
```
cd benchmark/servers/talking
npm install
npm run build
node dist/index.js <allowed-dir>
```
