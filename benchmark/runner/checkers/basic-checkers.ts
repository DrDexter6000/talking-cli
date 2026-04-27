import type { CheckerFn, CheckerResult } from "./types.js";

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
