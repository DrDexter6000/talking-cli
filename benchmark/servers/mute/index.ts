#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolResult,
  RootsListChangedNotificationSchema,
  type Root,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { z } from "zod";
import { minimatch } from "minimatch";
import { normalizePath, expandHome } from './path-utils.js';
import { getValidRootDirectories } from './roots-utils.js';
import {
  formatSize,
  validatePath,
  getFileStats,
  readFileContent,
  writeFileContent,
  searchFilesWithValidation,
  applyFileEdits,
  tailFile,
  headFile,
  setAllowedDirectories,
} from './lib.js';

// Command line argument parsing
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: mcp-server-filesystem [allowed-directory] [additional-directories...]");
  console.error("Note: Allowed directories can be provided via:");
  console.error("  1. Command-line arguments (shown above)");
  console.error("  2. MCP roots protocol (if client supports it)");
  console.error("At least one directory must be provided by EITHER method for the server to operate.");
}

// Store allowed directories in normalized and resolved form
let allowedDirectories = (await Promise.all(
  args.map(async (dir) => {
    const expanded = expandHome(dir);
    const absolute = path.resolve(expanded);
    const normalizedOriginal = normalizePath(absolute);
    try {
      const resolved = await fs.realpath(absolute);
      const normalizedResolved = normalizePath(resolved);
      if (normalizedOriginal !== normalizedResolved) {
        return [normalizedOriginal, normalizedResolved];
      }
      return [normalizedResolved];
    } catch (error) {
      return [normalizedOriginal];
    }
  })
)).flat();

// Filter to only accessible directories
const accessibleDirectories: string[] = [];
for (const dir of allowedDirectories) {
  try {
    const stats = await fs.stat(dir);
    if (stats.isDirectory()) {
      accessibleDirectories.push(dir);
    } else {
      console.error(`Warning: ${dir} is not a directory, skipping`);
    }
  } catch (error) {
    console.error(`Warning: Cannot access directory ${dir}, skipping`);
  }
}

if (accessibleDirectories.length === 0 && allowedDirectories.length > 0) {
  console.error("Error: None of the specified directories are accessible");
  process.exit(1);
}

allowedDirectories = accessibleDirectories;

// Initialize the global allowedDirectories in lib.ts
setAllowedDirectories(allowedDirectories);

// Schema definitions
const ReadTextFileArgsSchema = z.object({
  path: z.string(),
  tail: z.number().optional().describe('If provided, returns only the last N lines of the file'),
  head: z.number().optional().describe('If provided, returns only the first N lines of the file')
});

const ReadMediaFileArgsSchema = z.object({ path: z.string() });

const ReadMultipleFilesArgsSchema = z.object({
  paths: z.array(z.string()).min(1, "At least one file path must be provided")
    .describe("Array of file paths to read. Each path must be a string pointing to a valid file within allowed directories.")
});

const WriteFileArgsSchema = z.object({ path: z.string(), content: z.string() });
const EditOperation = z.object({ oldText: z.string().describe('Text to search for - must match exactly'), newText: z.string().describe('Text to replace with') });
const EditFileArgsSchema = z.object({ path: z.string(), edits: z.array(EditOperation), dryRun: z.boolean().default(false).describe('Preview changes using git-style diff format') });
const CreateDirectoryArgsSchema = z.object({ path: z.string() });
const ListDirectoryArgsSchema = z.object({ path: z.string() });
const ListDirectoryWithSizesArgsSchema = z.object({ path: z.string(), sortBy: z.enum(['name', 'size']).optional().default('name').describe('Sort entries by name or size') });
const DirectoryTreeArgsSchema = z.object({ path: z.string(), excludePatterns: z.array(z.string()).optional().default([]) });
const MoveFileArgsSchema = z.object({ source: z.string(), destination: z.string() });
const SearchFilesArgsSchema = z.object({ path: z.string(), pattern: z.string(), excludePatterns: z.array(z.string()).optional().default([]) });
const GetFileInfoArgsSchema = z.object({ path: z.string() });

// Server setup
const server = new McpServer({ name: "secure-filesystem-server", version: "0.2.0" });

async function readFileAsBase64Stream(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(chunk as Buffer));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
    stream.on('error', (err) => reject(err));
  });
}

// Tool handlers (omitted in scaffold - these are copied verbatim from upstream)
const readTextFileHandler = async (args: z.infer<typeof ReadTextFileArgsSchema>) => {
  const validPath = await validatePath(args.path);
  if (args.head && args.tail) throw new Error("Cannot specify both head and tail parameters simultaneously");
  let content: string;
  if (args.tail) content = await tailFile(validPath, args.tail);
  else if (args.head) content = await headFile(validPath, args.head);
  else content = await readFileContent(validPath);
  return { content: [{ type: "text" as const, text: content }], structuredContent: { content } };
};

server.registerTool("read_file", { title: "Read File (Deprecated)", description: "Read the complete contents of a file as text. DEPRECATED: Use read_text_file instead.", inputSchema: ReadTextFileArgsSchema.shape, outputSchema: { content: z.string() }, annotations: { readOnlyHint: true } }, readTextFileHandler);
server.registerTool("read_text_file", { title: "Read Text File", description: "Read the complete contents of a file from the file system as text.", inputSchema: { path: z.string(), tail: z.number().optional(), head: z.number().optional() }, outputSchema: { content: z.string() }, annotations: { readOnlyHint: true } }, readTextFileHandler);
server.registerTool("read_media_file", { title: "Read Media File", description: "Read an image or audio file. Returns the base64 encoded data and MIME type.", inputSchema: { path: z.string() }, outputSchema: { content: z.array(z.object({ type: z.enum(["image", "audio", "blob"]), data: z.string(), mimeType: z.string() })) }, annotations: { readOnlyHint: true } }, async (args: z.infer<typeof ReadMediaFileArgsSchema>) => { const validPath = await validatePath(args.path); const extension = path.extname(validPath).toLowerCase(); const mimeTypes: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".flac": "audio/flac" }; const mimeType = mimeTypes[extension] || "application/octet-stream"; const data = await readFileAsBase64Stream(validPath); const type = mimeType.startsWith("image/") ? "image" : mimeType.startsWith("audio/") ? "audio" : "blob"; const contentItem = { type: type as 'image' | 'audio' | 'blob', data, mimeType }; return { content: [contentItem], structuredContent: { content: [contentItem] } } as unknown as CallToolResult; });
server.registerTool("read_multiple_files", { title: "Read Multiple Files", description: "Read the contents of multiple files simultaneously.", inputSchema: { paths: z.array(z.string()).min(1) }, outputSchema: { content: z.string() }, annotations: { readOnlyHint: true } }, async (args: z.infer<typeof ReadMultipleFilesArgsSchema>) => { const results = await Promise.all(args.paths.map(async (filePath: string) => { try { const validPath = await validatePath(filePath); const content = await readFileContent(validPath); return `${filePath}:\n${content}\n`; } catch (error) { const errorMessage = error instanceof Error ? error.message : String(error); return `${filePath}: Error - ${errorMessage}`; } })); const text = results.join("\n---\n"); return { content: [{ type: "text" as const, text }], structuredContent: { content: text } }; });
server.registerTool("write_file", { title: "Write File", description: "Create a new file or completely overwrite an existing file with new content.", inputSchema: { path: z.string(), content: z.string() }, outputSchema: { content: z.string() }, annotations: { readOnlyHint: false, idempotentHint: true, destructiveHint: true } }, async (args: z.infer<typeof WriteFileArgsSchema>) => { const validPath = await validatePath(args.path); await writeFileContent(validPath, args.content); const text = `Successfully wrote to ${args.path}`; return { content: [{ type: "text" as const, text }], structuredContent: { content: text } }; });
server.registerTool("edit_file", { title: "Edit File", description: "Make line-based edits to a text file.", inputSchema: { path: z.string(), edits: z.array(EditOperation), dryRun: z.boolean().default(false) }, outputSchema: { content: z.string() }, annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true } }, async (args: z.infer<typeof EditFileArgsSchema>) => { const validPath = await validatePath(args.path); const result = await applyFileEdits(validPath, args.edits, args.dryRun); return { content: [{ type: "text" as const, text: result }], structuredContent: { content: result } }; });
server.registerTool("create_directory", { title: "Create Directory", description: "Create a new directory or ensure a directory exists.", inputSchema: { path: z.string() }, outputSchema: { content: z.string() }, annotations: { readOnlyHint: false, idempotentHint: true, destructiveHint: false } }, async (args: z.infer<typeof CreateDirectoryArgsSchema>) => { const validPath = await validatePath(args.path); await fs.mkdir(validPath, { recursive: true }); const text = `Successfully created directory ${args.path}`; return { content: [{ type: "text" as const, text }], structuredContent: { content: text } }; });
server.registerTool("list_directory", { title: "List Directory", description: "Get a detailed listing of all files and directories in a specified path.", inputSchema: { path: z.string() }, outputSchema: { content: z.string() }, annotations: { readOnlyHint: true } }, async (args: z.infer<typeof ListDirectoryArgsSchema>) => { const validPath = await validatePath(args.path); const entries = await fs.readdir(validPath, { withFileTypes: true }); const formatted = entries.map((entry) => `${entry.isDirectory() ? "[DIR]" : "[FILE]"} ${entry.name}`).join("\n"); return { content: [{ type: "text" as const, text: formatted }], structuredContent: { content: formatted } }; });
server.registerTool("list_directory_with_sizes", { title: "List Directory with Sizes", description: "Get a detailed listing of all files and directories in a specified path, including sizes.", inputSchema: { path: z.string(), sortBy: z.enum(["name", "size"]).optional().default("name") }, outputSchema: { content: z.string() }, annotations: { readOnlyHint: true } }, async (args: z.infer<typeof ListDirectoryWithSizesArgsSchema>) => { const validPath = await validatePath(args.path); const entries = await fs.readdir(validPath, { withFileTypes: true }); const detailedEntries = await Promise.all(entries.map(async (entry) => { const entryPath = path.join(validPath, entry.name); try { const stats = await fs.stat(entryPath); return { name: entry.name, isDirectory: entry.isDirectory(), size: stats.size, mtime: stats.mtime }; } catch { return { name: entry.name, isDirectory: entry.isDirectory(), size: 0, mtime: new Date(0) }; } })); const sortedEntries = [...detailedEntries].sort((a, b) => { if (args.sortBy === 'size') return b.size - a.size; return a.name.localeCompare(b.name); }); const formattedEntries = sortedEntries.map(entry => `${entry.isDirectory ? "[DIR]" : "[FILE]"} ${entry.name.padEnd(30)} ${entry.isDirectory ? "" : formatSize(entry.size).padStart(10)}`); const totalFiles = detailedEntries.filter(e => !e.isDirectory).length; const totalDirs = detailedEntries.filter(e => e.isDirectory).length; const totalSize = detailedEntries.reduce((sum, entry) => sum + (entry.isDirectory ? 0 : entry.size), 0); const text = [...formattedEntries, "", `Total: ${totalFiles} files, ${totalDirs} directories`, `Combined size: ${formatSize(totalSize)}`].join("\n"); return { content: [{ type: "text" as const, text }], structuredContent: { content: text } }; });
server.registerTool("directory_tree", { title: "Directory Tree", description: "Get a recursive tree view of files and directories as a JSON structure.", inputSchema: { path: z.string(), excludePatterns: z.array(z.string()).optional().default([]) }, outputSchema: { content: z.string() }, annotations: { readOnlyHint: true } }, async (args: z.infer<typeof DirectoryTreeArgsSchema>) => { const rootPath = args.path; async function buildTree(currentPath: string, excludePatterns: string[] = []): Promise<{ name: string; type: 'file' | 'directory'; children?: unknown[] }[]> { const validPath = await validatePath(currentPath); const entries = await fs.readdir(validPath, { withFileTypes: true }); const result: { name: string; type: 'file' | 'directory'; children?: unknown[] }[] = []; for (const entry of entries) { const relativePath = path.relative(rootPath, path.join(currentPath, entry.name)); const shouldExclude = excludePatterns.some(pattern => minimatch(relativePath, pattern, { dot: true }) || minimatch(relativePath, `**/${pattern}`, { dot: true }) || minimatch(relativePath, `**/${pattern}/**`, { dot: true })); if (shouldExclude) continue; const entryData: { name: string; type: 'file' | 'directory'; children?: unknown[] } = { name: entry.name, type: entry.isDirectory() ? 'directory' : 'file' }; if (entry.isDirectory()) { const subPath = path.join(currentPath, entry.name); entryData.children = await buildTree(subPath, excludePatterns); } result.push(entryData); } return result; } const treeData = await buildTree(rootPath, args.excludePatterns); const text = JSON.stringify(treeData, null, 2); return { content: [{ type: "text" as const, text }], structuredContent: { content: text } }; });
server.registerTool("move_file", { title: "Move File", description: "Move or rename files and directories.", inputSchema: { source: z.string(), destination: z.string() }, outputSchema: { content: z.string() }, annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true } }, async (args: z.infer<typeof MoveFileArgsSchema>) => { const validSourcePath = await validatePath(args.source); const validDestPath = await validatePath(args.destination); await fs.rename(validSourcePath, validDestPath); const text = `Successfully moved ${args.source} to ${args.destination}`; return { content: [{ type: "text" as const, text }], structuredContent: { content: text } }; });
server.registerTool("search_files", { title: "Search Files", description: "Recursively search for files and directories matching a pattern.", inputSchema: { path: z.string(), pattern: z.string(), excludePatterns: z.array(z.string()).optional().default([]) }, outputSchema: { content: z.string() }, annotations: { readOnlyHint: true } }, async (args: z.infer<typeof SearchFilesArgsSchema>) => { const validPath = await validatePath(args.path); const results = await searchFilesWithValidation(validPath, args.pattern, allowedDirectories, { excludePatterns: args.excludePatterns }); const text = results.length > 0 ? results.join("\n") : "No matches found"; return { content: [{ type: "text" as const, text }], structuredContent: { content: text } }; });
server.registerTool("get_file_info", { title: "Get File Info", description: "Retrieve detailed metadata about a file or directory.", inputSchema: { path: z.string() }, outputSchema: { content: z.string() }, annotations: { readOnlyHint: true } }, async (args: z.infer<typeof GetFileInfoArgsSchema>) => { const validPath = await validatePath(args.path); const info = await getFileStats(validPath); const text = Object.entries(info).map(([key, value]) => `${key}: ${value}`).join("\n"); return { content: [{ type: "text" as const, text }], structuredContent: { content: text } }; });
server.registerTool("list_allowed_directories", { title: "List Allowed Directories", description: "Returns the list of directories that this server is allowed to access.", inputSchema: {}, outputSchema: { content: z.string() }, annotations: { readOnlyHint: true } }, async () => { const text = `Allowed directories:\n${allowedDirectories.join('\n')}`; return { content: [{ type: "text" as const, text }], structuredContent: { content: text } }; });

async function updateAllowedDirectoriesFromRoots(requestedRoots: Root[]) {
  const validatedRootDirs = await getValidRootDirectories(requestedRoots);
  if (validatedRootDirs.length > 0) {
    allowedDirectories = [...validatedRootDirs];
    setAllowedDirectories(allowedDirectories);
    console.error(`Updated allowed directories from MCP roots: ${validatedRootDirs.length} valid directories`);
  } else {
    console.error("No valid root directories provided by client");
  }
}

server.server.setNotificationHandler(RootsListChangedNotificationSchema, async () => {
  try {
    const response = await server.server.listRoots();
    if (response && 'roots' in response) await updateAllowedDirectoriesFromRoots(response.roots);
  } catch (error) {
    console.error("Failed to request roots from client:", error instanceof Error ? error.message : String(error));
  }
});

server.server.oninitialized = async () => {
  const clientCapabilities = server.server.getClientCapabilities();
  if (clientCapabilities?.roots) {
    try {
      const response = await server.server.listRoots();
      if (response && 'roots' in response) await updateAllowedDirectoriesFromRoots(response.roots);
      else console.error("Client returned no roots set, keeping current settings");
    } catch (error) {
      console.error("Failed to request initial roots from client:", error instanceof Error ? error.message : String(error));
    }
  } else {
    if (allowedDirectories.length > 0) console.error("Client does not support MCP Roots, using allowed directories from server args:", allowedDirectories);
    else throw new Error(`Server cannot operate: No allowed directories available.`);
  }
};

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Secure MCP Filesystem Server running on stdio");
  if (allowedDirectories.length === 0) console.error("Started without allowed directories - waiting for client to provide roots via MCP protocol");
}

runServer().catch((error) => { console.error("Fatal error running server:", error); process.exit(1); });
