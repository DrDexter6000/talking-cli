#!/usr/bin/env node

/**
 * generate-server-diff.ts
 *
 * Mechanical diff between mute and talking server variants.
 * Generates benchmark/servers/DIFF.md — do not hand-edit.
 *
 * Usage: npx tsx benchmark/scripts/generate-server-diff.ts
 */

import {
	readFileSync,
	readdirSync,
	statSync,
	writeFileSync,
	existsSync,
} from "node:fs";
import { resolve, join, relative, extname } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SERVERS_DIR = resolve(__dirname, "..", "servers");
const MUTE_DIR = resolve(SERVERS_DIR, "variants", "mute");
const TALKING_DIR = resolve(SERVERS_DIR, "variants", "talking");
const OUTPUT_PATH = resolve(SERVERS_DIR, "DIFF.md");

const EXCLUDED_DIRS = new Set(["node_modules", "dist", ".git"]);
const EXCLUDED_FILES = new Set(["package-lock.json"]);
const INCLUDED_EXTENSIONS = new Set([".ts", ".json"]);

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

function collectFiles(dir: string): string[] {
	const results: string[] = [];

	function walk(current: string): void {
		const entries = readdirSync(current, { withFileTypes: true });
		for (const entry of entries) {
			const full = join(current, entry.name);
			if (entry.isDirectory()) {
				if (!EXCLUDED_DIRS.has(entry.name)) {
					walk(full);
				}
			} else if (entry.isFile()) {
				if (EXCLUDED_FILES.has(entry.name)) continue;
				if (!INCLUDED_EXTENSIONS.has(extname(entry.name))) continue;
				results.push(full);
			}
		}
	}

	walk(dir);
	// Sort for deterministic output
	results.sort();
	return results;
}

// ---------------------------------------------------------------------------
// Line-by-line diff (Myers-like LCS, simplified for readability)
// ---------------------------------------------------------------------------

interface DiffLine {
	type: "context" | "added" | "removed";
	content: string;
	oldLineNo?: number;
	newLineNo?: number;
}

function computeDiff(oldLines: string[], newLines: string[]): DiffLine[] {
	const m = oldLines.length;
	const n = newLines.length;

	// Build LCS table
	const dp: number[][] = Array.from({ length: m + 1 }, () =>
		Array(n + 1).fill(0),
	);
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			if (oldLines[i - 1] === newLines[j - 1]) {
				dp[i][j] = dp[i - 1][j - 1] + 1;
			} else {
				dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
			}
		}
	}

	// Backtrack to collect diff lines
	const result: DiffLine[] = [];
	let i = m;
	let j = n;

	const stack: DiffLine[] = [];
	while (i > 0 || j > 0) {
		if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
			stack.push({
				type: "context",
				content: oldLines[i - 1],
				oldLineNo: i,
				newLineNo: j,
			});
			i--;
			j--;
		} else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
			stack.push({ type: "added", content: newLines[j - 1], newLineNo: j });
			j--;
		} else {
			stack.push({ type: "removed", content: oldLines[i - 1], oldLineNo: i });
			i--;
		}
	}

	// Reverse to get forward order
	for (let k = stack.length - 1; k >= 0; k--) {
		result.push(stack[k]);
	}

	return result;
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

function renderDiffBlock(diffLines: DiffLine[], filename: string): string {
	const lines = diffLines.map((d) => {
		switch (d.type) {
			case "removed":
				return `- ${d.content}`;
			case "added":
				return `+ ${d.content}`;
			case "context":
				return `  ${d.content}`;
		}
	});

	// Truncate large diffs to keep DIFF.md readable
	const MAX_LINES = 200;
	if (lines.length > MAX_LINES) {
		const truncated = lines.slice(0, MAX_LINES);
		truncated.push(
			`  ... (${lines.length - MAX_LINES} more lines omitted)`,
		);
		return `### ${filename}\n\n\`\`\`diff\n${truncated.join("\n")}\n\`\`\`\n`;
	}

	return `### ${filename}\n\n\`\`\`diff\n${lines.join("\n")}\n\`\`\`\n`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function generateDiff(): string {
	const muteFiles = new Set(
		collectFiles(MUTE_DIR).map((f) => relative(MUTE_DIR, f)),
	);
	const talkingFiles = new Set(
		collectFiles(TALKING_DIR).map((f) => relative(TALKING_DIR, f)),
	);

	const allFiles = new Set([...muteFiles, ...talkingFiles]);
	const sortedFiles = [...allFiles].sort();

	let identical = 0;
	let different = 0;
	let onlyInMute = 0;
	let onlyInTalking = 0;
	const diffSections: string[] = [];

	for (const file of sortedFiles) {
		const mutePath = join(MUTE_DIR, file);
		const talkingPath = join(TALKING_DIR, file);

		const inMute = muteFiles.has(file);
		const inTalking = talkingFiles.has(file);

		if (inMute && !inTalking) {
			onlyInMute++;
			const content = readFileSync(mutePath, "utf-8");
			const lines = content.split("\n");
			const diffLines: DiffLine[] = lines.map((line, idx) => ({
				type: "removed" as const,
				content: line,
				oldLineNo: idx + 1,
			}));
			diffSections.push(renderDiffBlock(diffLines, `${file} (removed in talking)`));
		} else if (!inMute && inTalking) {
			onlyInTalking++;
			const content = readFileSync(talkingPath, "utf-8");
			const lines = content.split("\n");
			const diffLines: DiffLine[] = lines.map((line, idx) => ({
				type: "added" as const,
				content: line,
				newLineNo: idx + 1,
			}));
			diffSections.push(renderDiffBlock(diffLines, `${file} (added in talking)`));
		} else {
			const muteContent = readFileSync(mutePath, "utf-8");
			const talkingContent = readFileSync(talkingPath, "utf-8");

			if (muteContent === talkingContent) {
				identical++;
			} else {
				different++;
				const muteLines = muteContent.split("\n");
				const talkingLines = talkingContent.split("\n");
				const diffLines = computeDiff(muteLines, talkingLines);
				diffSections.push(renderDiffBlock(diffLines, file));
			}
		}
	}

	const total = sortedFiles.length;
	const timestamp = new Date().toISOString();

	const header = [
		"# Server Diff — Mute vs Talking",
		"",
		"> Auto-generated by `benchmark/scripts/generate-server-diff.ts`. Do not hand-edit.",
		`> Generated: ${timestamp}`,
		"",
		"## Summary",
		"",
		`- **${total}** files compared`,
		`- **${identical}** identical`,
		`- **${different}** different`,
		`- **${onlyInMute}** only in mute (removed in talking)`,
		`- **${onlyInTalking}** only in talking (added in talking)`,
		"",
		"## Differences",
		"",
	];

	if (diffSections.length === 0) {
		header.push("*No differences found.*\n");
	} else {
		header.push(...diffSections);
	}

	if (identical > 0) {
		header.push("", "## Identical Files", "");
		const identicalFiles = sortedFiles.filter((f) => {
			if (!muteFiles.has(f) || !talkingFiles.has(f)) return false;
			return readFileSync(join(MUTE_DIR, f), "utf-8") ===
				readFileSync(join(TALKING_DIR, f), "utf-8");
		});
		for (const f of identicalFiles) {
			header.push(`- \`${f}\``);
		}
		header.push("");
	}

	return header.join("\n");
}

// Run
const diff = generateDiff();
writeFileSync(OUTPUT_PATH, diff, "utf-8");
console.log(`Generated ${relative(resolve("."), OUTPUT_PATH)}`);
