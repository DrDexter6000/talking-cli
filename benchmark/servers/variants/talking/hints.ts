/**
 * Centralized hint definitions for the talking variant.
 *
 * Each function returns an array of actionable hints for a specific scenario.
 * The `withHints()` helper appends them to the tool response text.
 */

export function withHints(text: string, hints: string[]): string {
  if (hints.length === 0) return text;
  return text + "\n\n" + hints.map(h => `→ ${h}`).join("\n");
}

export function emptyFileHints(): string[] {
  return [
    "File is empty. If you expected content, verify the path or check if this is a placeholder file.",
  ];
}

export function emptyDirectoryHints(): string[] {
  return [
    "Directory is empty. Check parent directory or verify the path is correct.",
  ];
}

export function emptyDirectoryWithSizesHints(): string[] {
  return [
    "The directory is empty. Verify this is the expected path, or check subdirectories.",
  ];
}

export function noSearchResultsHints(): string[] {
  return [
    "No matches. Try broader patterns — e.g., '*.js' instead of 'src/app.js', or '**/*.config' for recursive search.",
  ];
}

export function editNoMatchHints(): string[] {
  return [
    "No text matched. Read the file first to see exact content — matching is case-sensitive and whitespace-sensitive.",
  ];
}

export function editFailedHints(): string[] {
  return [
    "Edit failed. The file may not exist, or the search text may not match exactly.",
  ];
}

export function moveFailedHints(): string[] {
  return [
    "Move failed — source missing or destination already exists. Check both paths and remove destination if needed.",
  ];
}

export function fileInfoFailedHints(): string[] {
  return [
    "File info unavailable — file may not exist or path may be outside allowed directories. Use list_directory to verify.",
  ];
}

export function multiFileErrorHints(): string[] {
  return [
    "Some files failed to read — see error messages above. Verify each path exists and is within allowed directories.",
  ];
}

export function emptyTreeHints(): string[] {
  return [
    "Tree is empty. Try removing excludePatterns to see all entries.",
  ];
}

export function fileOverwriteHints(): string[] {
  return [
    "File already existed — overwritten with new content. Previous content is lost.",
  ];
}
