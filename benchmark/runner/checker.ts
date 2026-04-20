/**
 * Deterministic, pure-function checkers over (finalTurn, fs) → {pass, reason}.
 *
 * Each checker receives:
 *   - finalTurn: the last tool-use turn output from the agent run (string or object)
 *   - fs: a virtual filesystem snapshot (Record<string, string>)
 *
 * Returns {pass: boolean; reason: string}.
 */

export interface CheckerResult {
  pass: boolean;
  reason: string;
}

export type CheckerFn = (finalTurn: unknown, fs: Record<string, string>) => CheckerResult;

/**
 * checkSearchResults: Agent used search_files; we expect either a list of *.config.js paths
 * or "No matches found". The talking variant should emit a hint when empty.
 */
export const checkSearchResults: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasResults = text.includes(".config") || text.includes(".js") || text.includes("found") || text.includes("file");
  const hasNoResults = text.includes("No matches") || text.includes("not found") || text.includes("no results") || text.includes("No files");
  if (!hasResults && !hasNoResults) {
    return { pass: false, reason: "search task: agent did not report search results or indicate no matches" };
  }
  return { pass: true, reason: "search task: agent reported search outcome" };
};

/**
 * checkReadSpecificFile: Agent read a file; the turn should contain text content.
 */
export const checkReadSpecificFile: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  if (text.includes("Error") || text.includes("Access denied")) {
    return { pass: false, reason: "read task: agent reported an error reading the file" };
  }
  if (text.length < 10) {
    return { pass: false, reason: "read task: output too short — likely did not read file" };
  }
  return { pass: true, reason: "read task: agent produced readable file content" };
};

/**
 * checkEditReplace: Agent edited a file; we expect a diff or confirmation in the turn.
 */
export const checkEditReplace: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasDiff = text.includes("diff") || text.includes("DONE") || text.includes("replaced");
  if (!hasDiff) {
    return { pass: false, reason: "edit task: no diff or confirmation detected in agent output" };
  }
  return { pass: true, reason: "edit task: agent confirmed replacements or produced diff" };
};

/**
 * checkListDirectory: Agent listed a directory; we expect structured entry output.
 */
export const checkListDirectory: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasEntries = text.includes("[DIR]") || text.includes("[FILE]") || text.includes("directory");
  if (!hasEntries) {
    return { pass: false, reason: "navigate task: no directory listing entries found" };
  }
  return { pass: true, reason: "navigate task: agent listed directory entries" };
};

/**
 * checkSearchNotFound: Agent searched for a nonexistent file; should receive "No matches found".
 * The talking variant should also offer a hint about broadening the search.
 */
export const checkSearchNotFound: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasNotFound = text.includes("No matches found") || text.includes("not found") || text.includes("No results");
  if (!hasNotFound) {
    return { pass: false, reason: "not-found task: agent did not report 'not found' result" };
  }
  return { pass: true, reason: "not-found task: agent correctly reported no matches" };
};

// ─── Checkers for expanded task set (15 new) ────────────────────────────────

export const checkAccessDenied: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  if (!text.includes("Access denied") && !text.includes("permission") && !text.includes("denied")) {
    return { pass: false, reason: "error/empty task: does not mention access denied" };
  }
  const hasHint = text.includes("Try") || text.includes("hint") || text.includes("suggestion");
  return { pass: true, reason: `error/empty task: access denied message present${hasHint ? " + hint found" : ""}` };
};

export const checkSearchEmpty: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasEmpty = text.includes("No matches found") || text.includes("not found") || text.includes("empty");
  if (!hasEmpty) return { pass: false, reason: "error/empty task: no empty-result message" };
  return { pass: true, reason: "error/empty task: empty search result" };
};

export const checkPermissionDenied: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  if (text.includes("Access denied") || text.includes("permission") || text.includes("not allowed") || text.includes("restricted") || text.includes("outside")) return { pass: true, reason: "error/empty task: permission denied" };
  return { pass: false, reason: "error/empty task: no permission error message" };
};

export const checkEditDryRun: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  if (!text.includes("diff") && !text.includes("preview") && !text.includes("dry")) return { pass: false, reason: "error/empty task: no dry-run diff" };
  return { pass: true, reason: "error/empty task: dry-run diff present" };
};

export const checkBinaryRead: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasBinaryRef = text.includes("base64") || text.includes("binary") || text.includes("image") || text.includes("media") || text.includes("blob") || text.includes("read") || text.includes("Cannot") || text.includes("Error");
  if (!hasBinaryRef) return { pass: false, reason: "error/empty task: no acknowledgment of binary file read attempt" };
  return { pass: true, reason: "error/empty task: binary file read acknowledged" };
};

export const checkCreateDirectory: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  if (!text.includes("created") && !text.includes("directory")) return { pass: false, reason: "error/empty task: no confirmation of directory creation" };
  return { pass: true, reason: "error/empty task: directory creation confirmed" };
};

export const checkPathTraversal: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  if (!text.includes("Access denied") && !text.includes("outside") && !text.includes("not allowed") && !text.includes("restricted")) return { pass: false, reason: "error/empty task: path traversal not denied with restriction message" };
  return { pass: true, reason: "error/empty task: path traversal blocked with clear message" };
};

export const checkMoveFile: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  if (!text.includes("moved") && !text.includes("Success")) return { pass: false, reason: "neutral task: no move confirmation" };
  return { pass: true, reason: "neutral task: file move confirmed" };
};

export const checkWriteFile: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  if (!text.includes("wrote") && !text.includes("Success") && !text.includes("created")) return { pass: false, reason: "neutral task: no write confirmation" };
  return { pass: true, reason: "neutral task: file write confirmed" };
};

export const checkGetFileInfo: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  if (!text.includes("size") && !text.includes("permission")) return { pass: false, reason: "neutral task: no file info returned" };
  return { pass: true, reason: "neutral task: file info returned" };
};

export const checkEditMultiple: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  if (!text.includes("diff") && !text.includes("replac")) return { pass: false, reason: "error/empty task: no edit result shown" };
  return { pass: true, reason: "error/empty task: edit result shown" };
};

export const checkTailFile: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  if (text.length < 20) return { pass: false, reason: "error/empty task: tail output too short" };
  return { pass: true, reason: "error/empty task: tail output returned" };
};

export const checkDirectoryTree: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  if (!text.includes("tree") && !text.includes("children") && text.length < 50) return { pass: false, reason: "error/empty task: no tree structure" };
  return { pass: true, reason: "error/empty task: directory tree returned" };
};

export const checkListSorted: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  if (!text.includes("[DIR]") && !text.includes("[FILE]")) return { pass: false, reason: "error/empty task: no listing entries" };
  return { pass: true, reason: "error/empty task: directory listing returned" };
};

export const checkReadMultiple: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  if (!text.includes("---") && !text.includes("Error")) return { pass: false, reason: "error/empty task: no multi-file output" };
  return { pass: true, reason: "error/empty task: multi-file read attempted" };
};

export const checkWriteOverwrite: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  if (!text.includes("wrote") && !text.includes("Success")) return { pass: false, reason: "neutral task: no overwrite confirmation" };
  return { pass: true, reason: "neutral task: file overwrite confirmed" };
};

export const checkReadEmpty: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  if (text.length < 10) return { pass: false, reason: "neutral task: output too short for empty file acknowledgment" };
  return { pass: true, reason: "neutral task: empty file read completed and acknowledged" };
};

export const checkRename: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  if (!text.includes("moved") && !text.includes("Success")) return { pass: false, reason: "error/empty task: no rename confirmation" };
  return { pass: true, reason: "error/empty task: file rename confirmed" };
};

export const checkSearchSubdir: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  if (text.length < 20) return { pass: false, reason: "search task: output too short for subdir search" };
  return { pass: true, reason: "search task: subdir search produced output" };
};

export const checkUnicodeFile: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  if (!text.includes("Hello") && !text.includes("cafe")) return { pass: false, reason: "neutral task: unicode file not read correctly" };
  return { pass: true, reason: "neutral task: unicode file handled" };
};

// ─── Recovery checkers (new tasks requiring multi-turn recovery) ─────────────

export const checkSearchRecovery: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasFound = text.includes("found") || text.includes(".py") || text.includes("python") || text.includes("file");
  const hasAttempted = text.includes("search") || text.includes("pattern") || text.includes("broad");
  if (!hasFound) return { pass: false, reason: "recovery task: did not find any files after attempting broader search" };
  if (!hasAttempted) return { pass: false, reason: "recovery task: did not show evidence of attempting broader search patterns" };
  return { pass: true, reason: "recovery task: successfully found files using broader search patterns" };
};

export const checkReadRecovery: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasRead = text.includes("content") || text.includes("read") || text.includes("file") || text.length > 50;
  const hasRecovered = text.includes("alternative") || text.includes("instead") || text.includes("found") || text.includes("config");
  if (!hasRead) return { pass: false, reason: "recovery task: did not read any file content" };
  if (!hasRecovered) return { pass: false, reason: "recovery task: did not show evidence of finding alternative file" };
  return { pass: true, reason: "recovery task: successfully found and read alternative config file" };
};

export const checkEditRecovery: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasReplaced = text.includes("replaced") || text.includes("DONE") || text.includes("implement") || text.includes("edited");
  const hasRecovered = text.includes("search") || text.includes("found") || text.includes("similar") || text.includes("pattern");
  if (!hasReplaced) return { pass: false, reason: "recovery task: did not complete the replacement" };
  if (!hasRecovered) return { pass: false, reason: "recovery task: did not show evidence of searching for alternative text" };
  return { pass: true, reason: "recovery task: successfully replaced text after finding alternative pattern" };
};

export const checkListRecovery: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasListed = text.includes("[DIR]") || text.includes("[FILE]") || text.includes("file") || text.includes("directory");
  const hasRecovered = text.includes("parent") || text.includes("alternative") || text.includes("instead") || text.includes("check");
  if (!hasListed) return { pass: false, reason: "recovery task: did not list any directory contents" };
  if (!hasRecovered) return { pass: false, reason: "recovery task: did not show evidence of checking parent directory" };
  return { pass: true, reason: "recovery task: successfully listed parent directory after finding empty target" };
};

export const checkWriteRecovery: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasWritten = text.includes("wrote") || text.includes("Success") || text.includes("created") || text.includes("overwrote");
  const hasChecked = text.includes("read") || text.includes("content") || text.includes("existing") || text.includes("previous");
  if (!hasWritten) return { pass: false, reason: "recovery task: did not confirm file write" };
  if (!hasChecked) return { pass: false, reason: "recovery task: did not show evidence of checking existing content first" };
  return { pass: true, reason: "recovery task: successfully read existing content then wrote new content" };
};

export const checkMoveRecovery: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasMoved = text.includes("moved") || text.includes("Success") || text.includes("rename");
  const hasHandled = text.includes("backup") || text.includes("existing") || text.includes("conflict") || text.includes("already");
  if (!hasMoved) return { pass: false, reason: "recovery task: did not confirm file move" };
  if (!hasHandled) return { pass: false, reason: "recovery task: did not show evidence of handling destination conflict" };
  return { pass: true, reason: "recovery task: successfully handled existing destination and moved file" };
};

export const checkTreeRecovery: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasTree = text.includes("tree") || text.includes("children") || text.includes("directory") || text.length > 100;
  const hasRecovered = text.includes("without") || text.includes("filter") || text.includes("pattern") || text.includes("exclude");
  if (!hasTree) return { pass: false, reason: "recovery task: did not produce directory tree output" };
  if (!hasRecovered) return { pass: false, reason: "recovery task: did not show evidence of removing filters" };
  return { pass: true, reason: "recovery task: successfully retrieved tree after adjusting filters" };
};

export const checkSearchNested: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasFound = text.includes("found") || text.includes("test") || text.includes(".test") || text.includes("spec");
  const hasRecovered = text.includes("recursive") || text.includes("subdirector") || text.includes("nested") || text.includes("search");
  if (!hasFound) return { pass: false, reason: "recovery task: did not find test files" };
  if (!hasRecovered) return { pass: false, reason: "recovery task: did not show evidence of recursive search" };
  return { pass: true, reason: "recovery task: successfully found test files via recursive search" };
};

export const checkReadMultipleRecovery: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasRead = text.includes("content") || text.includes("read") || text.includes("file") || text.length > 50;
  const hasRecovered = text.includes("available") || text.includes("instead") || text.includes("alternative") || text.includes("found");
  if (!hasRead) return { pass: false, reason: "recovery task: did not read any file content" };
  if (!hasRecovered) return { pass: false, reason: "recovery task: did not show evidence of handling partial read failure" };
  return { pass: true, reason: "recovery task: successfully read available files after partial failure" };
};

export const checkInfoRecovery: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasInfo = text.includes("size") || text.includes("permission") || text.includes("metadata") || text.includes("info");
  const hasRecovered = text.includes("search") || text.includes("found") || text.includes("alternative") || text.includes("instead");
  if (!hasInfo) return { pass: false, reason: "recovery task: did not retrieve file info" };
  if (!hasRecovered) return { pass: false, reason: "recovery task: did not show evidence of searching for alternative file" };
  return { pass: true, reason: "recovery task: successfully found and reported info on alternative file" };
};

export const checkEditDryRunRecovery: CheckerFn = (finalTurn, _fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasReplaced = text.includes("replaced") || text.includes("DONE") || text.includes("edited") || text.includes("diff");
  const hasRecovered = text.includes("search") || text.includes("found") || text.includes("content") || text.includes("read");
  if (!hasReplaced) return { pass: false, reason: "recovery task: did not complete the edit" };
  if (!hasRecovered) return { pass: false, reason: "recovery task: did not show evidence of searching for correct text first" };
  return { pass: true, reason: "recovery task: successfully edited after finding correct text pattern" };
};

/**
 * Checker map — registry of all available checkers.
 */
export const checkers: Record<string, CheckerFn> = {
  checkSearchResults,
  checkReadSpecificFile,
  checkEditReplace,
  checkListDirectory,
  checkSearchNotFound,
  checkAccessDenied,
  checkSearchEmpty,
  checkPermissionDenied,
  checkEditDryRun,
  checkBinaryRead,
  checkCreateDirectory,
  checkPathTraversal,
  checkMoveFile,
  checkWriteFile,
  checkGetFileInfo,
  checkEditMultiple,
  checkTailFile,
  checkDirectoryTree,
  checkListSorted,
  checkReadMultiple,
  checkWriteOverwrite,
  checkReadEmpty,
  checkRename,
  checkSearchSubdir,
  checkUnicodeFile,
  checkSearchRecovery,
  checkReadRecovery,
  checkEditRecovery,
  checkListRecovery,
  checkWriteRecovery,
  checkMoveRecovery,
  checkTreeRecovery,
  checkSearchNested,
  checkReadMultipleRecovery,
  checkInfoRecovery,
  checkEditDryRunRecovery,
};
