/**
 * Per-server hint configurations for the HintInjector.
 *
 * Two configs: server-memory (9 tools) and server-filesystem (11 tools).
 * Hints are extracted from the existing talking variant reimplementations
 * to ensure byte-identical behavior.
 *
 * Every hint:
 * - Is under 200 chars
 * - Is invocation-scoped (not "always do X")
 * - Follows PHILOSOPHY.md Rule 1 (whisper) and Rule 4 (suggest, not command)
 */

import { isEmptyArrayResult, isErrorResult, isNotFoundResult } from "./hint-injector.js";
import type { HintConfig } from "./hint-injector.js";

// ─── server-memory (9 tools) ────────────────────────────────────────────────────

/**
 * Hint configuration for @modelcontextprotocol/server-memory.
 *
 * Matches the hint behavior from benchmark/real-world/servers/server-memory/talking/index.mjs.
 * Hints trigger on: empty search results, empty graph, entity not found,
 * duplicate creates, missing relation targets, and generic errors.
 */
export function getMemoryHintConfig(): HintConfig {
  return {
    // ─── search_nodes ──────────────────────────────────────────────────────────
    search_nodes: {
      patterns: [
        {
          name: "empty-search-empty-graph",
          match: (text) => {
            if (!isEmptyArrayResult(text)) return false;
            // Could check full graph size but that requires another tool call;
            // keep it simple: empty result = suggest broadening
            return true;
          },
          hints: [
            "No entities matched. Try a shorter substring or different keyword, or use read_graph to see all entities.",
          ],
        },
        {
          name: "search-error",
          match: (text, isError) => isErrorResult(text, isError),
          hints: [
            "Error in search_nodes. Recovery: use read_graph to check current state, or try a different query.",
          ],
        },
      ],
    },

    // ─── open_nodes ────────────────────────────────────────────────────────────
    open_nodes: {
      patterns: [
        {
          name: "empty-open-result",
          match: (text) => isEmptyArrayResult(text),
          hints: [
            "No entities found with those names. Entity names are case-sensitive and must match exactly. Use search_nodes with a substring to find correct names.",
          ],
        },
        {
          name: "open-error",
          match: (text, isError) => isErrorResult(text, isError),
          hints: [
            "Error in open_nodes. Recovery: use read_graph to check current state, or search_nodes to find existing entities.",
          ],
        },
      ],
    },

    // ─── read_graph ────────────────────────────────────────────────────────────
    read_graph: {
      patterns: [
        {
          name: "empty-graph",
          match: (text) => isEmptyArrayResult(text),
          hints: [
            "The knowledge graph is empty (0 entities, 0 relations). Create entities first using create_entities with {name, entityType, observations}.",
          ],
        },
        {
          name: "read-graph-error",
          match: (text, isError) => isErrorResult(text, isError),
          hints: [
            "Error reading the graph. The storage file may be corrupted.",
          ],
        },
      ],
    },

    // ─── create_entities ──────────────────────────────────────────────────────
    create_entities: {
      patterns: [
        {
          name: "all-skipped-duplicates",
          match: (text) => {
            try {
              const parsed = JSON.parse(text) as unknown[];
              return Array.isArray(parsed) && parsed.length === 0;
            } catch {
              return false;
            }
          },
          hints: [
            "All entities were skipped — they already exist in the graph. Use open_nodes to inspect them, or search_nodes to find related entities.",
          ],
        },
        {
          name: "create-entities-error",
          match: (text, isError) => isErrorResult(text, isError),
          hints: [
            "Error in create_entities. Recovery: use read_graph to check current state, or search_nodes to find existing entities.",
          ],
        },
      ],
    },

    // ─── create_relations ─────────────────────────────────────────────────────
    create_relations: {
      patterns: [
        {
          name: "all-skipped-relations",
          match: (text) => {
            try {
              const parsed = JSON.parse(text) as unknown[];
              return Array.isArray(parsed) && parsed.length === 0;
            } catch {
              return false;
            }
          },
          hints: [
            "All relations were skipped — they may already exist or reference missing entities. Use read_graph to see current state.",
          ],
        },
        {
          name: "create-relations-error",
          match: (text, isError) => isErrorResult(text, isError),
          hints: [
            "Error in create_relations. Recovery: use read_graph to check current state, or search_nodes to find existing entities.",
          ],
        },
      ],
    },

    // ─── add_observations ─────────────────────────────────────────────────────
    add_observations: {
      patterns: [
        {
          name: "entity-not-found",
          match: (text, isError) => isErrorResult(text, isError) && isNotFoundResult(text),
          hints: [
            "Entity not found — observations can only be added to existing entities. Use search_nodes to find the correct name, or create_entities if it doesn't exist yet.",
          ],
        },
        {
          name: "add-observations-error",
          match: (text, isError) => isErrorResult(text, isError) && !isNotFoundResult(text),
          hints: [
            "Error in add_observations. Recovery: use read_graph to check current state, or search_nodes to find existing entities.",
          ],
        },
      ],
    },

    // ─── delete_entities ──────────────────────────────────────────────────────
    delete_entities: {
      patterns: [
        {
          name: "delete-entities-error",
          match: (text, isError) => isErrorResult(text, isError),
          hints: [
            "Error in delete_entities. Recovery: use read_graph to check current state, or search_nodes to find existing entities.",
          ],
        },
      ],
    },

    // ─── delete_observations ──────────────────────────────────────────────────
    delete_observations: {
      patterns: [
        {
          name: "delete-observations-error",
          match: (text, isError) => isErrorResult(text, isError),
          hints: [
            "An error occurred while deleting observations. Verify the entity exists with open_nodes or search_nodes.",
          ],
        },
      ],
    },

    // ─── delete_relations ─────────────────────────────────────────────────────
    delete_relations: {
      patterns: [
        {
          name: "delete-relations-error",
          match: (text, isError) => isErrorResult(text, isError),
          hints: [
            "An error occurred while deleting relations. Use read_graph to see the current state.",
          ],
        },
      ],
    },
  };
}

// ─── server-filesystem (11 tools) ───────────────────────────────────────────────

/**
 * Hint configuration for @modelcontextprotocol/server-filesystem.
 *
 * Extracted from benchmark/servers/variants/talking/hints.ts.
 * Hints trigger on: empty files, empty directories, no search matches,
 * edit failures, move failures, file info failures, and multi-file errors.
 */
export function getFilesystemHintConfig(): HintConfig {
  return {
    // ─── read_file ────────────────────────────────────────────────────────────
    read_file: {
      patterns: [
        {
          name: "empty-file",
          match: (text) => text.trim() === "",
          hints: [
            "File is empty. If you expected content, verify the path or check if this is a placeholder file.",
          ],
        },
        {
          name: "read-error",
          match: (text, isError) => isErrorResult(text, isError),
          hints: [
            "File read failed. The file may not exist or the path may be outside allowed directories. Use list_directory to verify.",
          ],
        },
      ],
    },

    // ─── read_multiple_files ──────────────────────────────────────────────────
    read_multiple_files: {
      patterns: [
        {
          name: "multi-file-error",
          match: (text, isError) => isErrorResult(text, isError),
          hints: [
            "Some files failed to read — see error messages above. Verify each path exists and is within allowed directories.",
          ],
        },
      ],
    },

    // ─── list_directory ───────────────────────────────────────────────────────
    list_directory: {
      patterns: [
        {
          name: "empty-directory",
          match: (text) => {
            // The server returns a formatted listing, check for [EMPTY] or empty result
            const trimmed = text.trim();
            return trimmed === "" || trimmed === "[EMPTY]" || trimmed === "[]";
          },
          hints: [
            "Directory is empty. Check parent directory or verify the path is correct.",
          ],
        },
        {
          name: "list-directory-error",
          match: (text, isError) => isErrorResult(text, isError),
          hints: [
            "Directory listing failed. The path may not exist or may be outside allowed directories.",
          ],
        },
      ],
    },

    // ─── list_directory_with_sizes ────────────────────────────────────────────
    directory_tree: {
      patterns: [
        {
          name: "empty-tree",
          match: (text) => text.trim() === "" || text.trim() === "[]",
          hints: [
            "Tree is empty. Try removing excludePatterns to see all entries.",
          ],
        },
      ],
    },

    // ─── search_files ─────────────────────────────────────────────────────────
    search_files: {
      patterns: [
        {
          name: "no-search-results",
          match: (text) => {
            const trimmed = text.trim();
            return trimmed === "" || trimmed === "No files found" || trimmed === "[]";
          },
          hints: [
            "No matches. Try broader patterns — e.g., '*.js' instead of 'src/app.js', or '**/*.config' for recursive search.",
          ],
        },
      ],
    },

    // ─── edit_file ────────────────────────────────────────────────────────────
    edit_file: {
      patterns: [
        {
          name: "edit-no-match",
          match: (text, isError) => isErrorResult(text, isError) && text.includes("No match"),
          hints: [
            "No text matched. Read the file first to see exact content — matching is case-sensitive and whitespace-sensitive.",
          ],
        },
        {
          name: "edit-failed",
          match: (text, isError) => isErrorResult(text, isError) && !text.includes("No match"),
          hints: [
            "Edit failed. The file may not exist, or the search text may not match exactly.",
          ],
        },
      ],
    },

    // ─── move_file ────────────────────────────────────────────────────────────
    move_file: {
      patterns: [
        {
          name: "move-failed",
          match: (text, isError) => isErrorResult(text, isError),
          hints: [
            "Move failed — source missing or destination already exists. Check both paths and remove destination if needed.",
          ],
        },
      ],
    },

    // ─── get_file_info ────────────────────────────────────────────────────────
    get_file_info: {
      patterns: [
        {
          name: "file-info-failed",
          match: (text, isError) => isErrorResult(text, isError),
          hints: [
            "File info unavailable — file may not exist or path may be outside allowed directories. Use list_directory to verify.",
          ],
        },
      ],
    },

    // ─── write_file ───────────────────────────────────────────────────────────
    write_file: {
      patterns: [
        {
          name: "write-error",
          match: (text, isError) => isErrorResult(text, isError),
          hints: [
            "File write failed. The path may be outside allowed directories. Use list_directory to verify the target directory.",
          ],
        },
      ],
    },

    // ─── create_directory ─────────────────────────────────────────────────────
    create_directory: {
      patterns: [
        {
          name: "mkdir-error",
          match: (text, isError) => isErrorResult(text, isError),
          hints: [
            "Directory creation failed. The path may be outside allowed directories or already exists.",
          ],
        },
      ],
    },

    // ─── list_allowed_directories ─────────────────────────────────────────────
    list_allowed_directories: {
      patterns: [], // No error scenarios that benefit from hints
    },
  };
}
