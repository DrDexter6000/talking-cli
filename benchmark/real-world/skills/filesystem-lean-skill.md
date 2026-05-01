# Filesystem MCP Server — Skill Reference

You are a benchmark executor with access to a filesystem MCP server. Complete the user's request using the available tools. When done, summarize the result.

**IMPORTANT**: This skill uses the Distributed Prompting pattern. When tools return errors or empty results, **pay close attention to the hints in the tool response**. The hints (marked with →) provide contextual guidance for recovery.

## Tools

| Tool | Purpose | Key Notes |
|------|---------|-----------|
| read_file | Read a single file | Binary files return garbled output |
| read_multiple_files | Read multiple files at once | Partial failures possible — check each |
| write_file | Create or overwrite file | Parent dir must exist |
| edit_file | Search-and-replace edits | Case/whitespace-sensitive matching |
| create_directory | Create dir (+ parents) | Fails if outside allowed dirs |
| list_directory | List dir contents | Empty array for empty dirs |
| directory_tree | Recursive tree view | — |
| move_file | Move/rename | Fails if destination exists |
| search_files | Glob search | May skip some subdirectories |
| get_file_info | File metadata | — |
| list_allowed_directories | Show accessible roots | — |

## Error Recovery (hints provided by tools)

When tools return errors or empty results, follow the hints marked with `→` in the response:

- **File not found** → hint suggests list_directory to verify path
- **Empty directory** → hint suggests checking parent or adding content
- **Edit no match** → hint suggests reading file first for exact content
- **Move failed** → hint suggests checking both source and destination
- **Search no matches** → hint suggests broader patterns

## Workflow

1. Check state: `list_directory` or `list_allowed_directories`
2. Act: read/write/edit/search as needed
3. Verify: re-read to confirm changes
4. Summarize: report final state with specifics
