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
 * checkStalePathConfig: Agent must handle stale/moved config file path.
 * The talking variant should hint about the file being moved/renamed.
 */
export const checkStalePathConfig: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasDbPort = text.match(/port\s*[:=]\s*\d+/i) || text.includes("3306") || text.includes("5432") || text.includes("27017");
  const hasConfigContent = text.includes("database") || text.includes("db") || text.includes("host") || text.includes("connection");
  if (!hasDbPort && !hasConfigContent) {
    return { pass: false, reason: "stale path task: did not find or report database configuration" };
  }
  return { pass: true, reason: "stale path task: successfully located and read config" };
};

/**
 * checkPermissionCascade: Agent must handle permission cascade (can't access parent dir).
 * The talking variant should hint about alternative paths or elevated permissions.
 */
export const checkPermissionCascade: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasBackup = fs["/tmp/benchmark-sandbox/backup/important.db"] !== undefined;
  const hasAlternative = text.includes("backup") || text.includes("alternative") || text.includes("permission") || text.includes("access");
  if (!hasBackup && !hasAlternative) {
    return { pass: false, reason: "permission cascade task: did not create backup or handle permission issue" };
  }
  return { pass: true, reason: "permission cascade task: handled permission or created backup" };
};

/**
 * checkAmbiguousSearch: Agent must disambiguate between multiple candidate files.
 * The talking variant should hint about which file is the actual entry point.
 */
export const checkAmbiguousSearch: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasEntryPoint = text.includes("index.js") || text.includes("main.js") || text.includes("app.js") || text.includes("server.js");
  const hasStartupLogic = text.includes("listen") || text.includes("start") || text.includes("init") || text.includes("bootstrap");
  if (!hasEntryPoint) {
    return { pass: false, reason: "ambiguous search task: did not identify entry point file" };
  }
  if (!hasStartupLogic) {
    return { pass: false, reason: "ambiguous search task: did not confirm startup logic" };
  }
  return { pass: true, reason: "ambiguous search task: found and verified entry point" };
};

/**
 * checkHiddenDependency: Agent must discover and resolve hidden dependencies.
 * The talking variant should hint about missing dependencies after test failure.
 */
export const checkHiddenDependency: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasTestResult = text.includes("pass") || text.includes("fail") || text.includes("test") || text.includes("error");
  const hasDependency = text.includes("install") || text.includes("dependency") || text.includes("module") || text.includes("package");
  if (!hasTestResult) {
    return { pass: false, reason: "hidden dependency task: did not run or report test results" };
  }
  if (!hasDependency) {
    return { pass: false, reason: "hidden dependency task: did not identify or resolve dependency issue" };
  }
  return { pass: true, reason: "hidden dependency task: ran tests and handled dependencies" };
};

/**
 * checkEncodingTrap: Agent must handle file with encoding issues or special characters.
 * The talking variant should hint about encoding problems.
 */
export const checkEncodingTrap: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasDate = text.match(/\d{4}-\d{2}-\d{2}/) || text.match(/\d{1,2}\/\d{1,2}\/\d{4}/) || text.includes("January") || text.includes("February");
  const hasEncoding = text.includes("encoding") || text.includes("UTF") || text.includes("unicode") || text.includes("binary");
  if (!hasDate && !hasEncoding) {
    return { pass: false, reason: "encoding trap task: did not extract date or handle encoding" };
  }
  return { pass: true, reason: "encoding trap task: handled file with potential encoding issues" };
};

/**
 * checkSymlinkResolution: Agent must resolve symbolic links to find actual file location.
 * The talking variant should hint about the symlink.
 */
export const checkSymlinkResolution: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasActualPath = text.includes("actual") || text.includes("real") || text.includes("target") || text.includes("/data/");
  const hasContent = text.includes("{") || text.includes("database") || text.includes("config") || text.length > 50;
  if (!hasActualPath && !hasContent) {
    return { pass: false, reason: "symlink task: did not resolve symlink or read actual file" };
  }
  return { pass: true, reason: "symlink task: resolved symlink and read content" };
};

/**
 * checkPartialRead: Agent must handle large file where relevant content is not at the start.
 * The talking variant should hint about using search or offset.
 */
export const checkPartialRead: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasDbConfig = text.includes("database") || text.includes("db_") || text.includes("host") || text.includes("port");
  const hasSearch = text.includes("search") || text.includes("offset") || text.includes("grep") || text.includes("find");
  if (!hasDbConfig) {
    return { pass: false, reason: "partial read task: did not find database configuration" };
  }
  return { pass: true, reason: "partial read task: found DB config in large file" };
};

/**
 * checkWriteConflict: Agent must handle write conflict (read-modify-write pattern).
 * The talking variant should hint about atomicity or locking.
 */
export const checkWriteConflict: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasIncrement = text.match(/\b4\b/) || text.includes("increment") || text.includes("updated") || text.includes("counter");
  const hasReadFirst = text.includes("read") || text.includes("current") || text.includes("original") || text.includes("before");
  if (!hasIncrement) {
    return { pass: false, reason: "write conflict task: did not increment counter" };
  }
  if (!hasReadFirst) {
    return { pass: false, reason: "write conflict task: did not read before writing" };
  }
  return { pass: true, reason: "write conflict task: read before writing and incremented counter" };
};

/**
 * checkContextPollution: Agent must handle corrupted/partially written files from previous failures.
 * The talking variant should hint about file corruption.
 */
export const checkContextPollution: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasSummary = text.includes("summary") || text.includes("report") || text.includes("total") || text.includes("count");
  const hasCorruption = text.includes("corrupt") || text.includes("invalid") || text.includes("error") || text.includes("fix");
  if (!hasSummary && !hasCorruption) {
    return { pass: false, reason: "context pollution task: did not create summary or handle corruption" };
  }
  return { pass: true, reason: "context pollution task: handled corrupted file and produced summary" };
};

/**
 * checkArgumentHallucination: Agent must handle wrong tool arguments.
 * The talking variant should hint about correct parameter names.
 */
export const checkArgumentHallucination: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasDeleted = text.includes("deleted") || text.includes("removed") || text.includes("clean") || text.includes("done");
  const hasError = text.includes("error") || text.includes("invalid") || text.includes("argument");
  if (!hasDeleted && !hasError) {
    return { pass: false, reason: "argument hallucination task: did not delete files or handle error" };
  }
  return { pass: true, reason: "argument hallucination task: handled argument error or deleted files" };
};

/**
 * checkReentrantFailure: Agent must avoid infinite retry loops on persistent errors.
 * The talking variant should hint about giving up or alternative approaches.
 */
export const checkReentrantFailure: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasFixed = text.includes("fixed") || text.includes("corrected") || text.includes("updated") || text.includes("edit");
  const hasError = text.includes("error") || text.includes("syntax") || text.includes("parse") || text.includes("invalid");
  if (!hasFixed && !hasError) {
    return { pass: false, reason: "reentrant failure task: did not fix error or report syntax issue" };
  }
  return { pass: true, reason: "reentrant failure task: fixed syntax error or diagnosed issue" };
};

/**
 * checkSchemaDrift: Agent must handle API/schema changes.
 * The talking variant should hint about deprecated parameters.
 */
export const checkSchemaDrift: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasFiles = text.includes("file") || text.includes("directory") || text.includes(".") || text.includes("size");
  const hasError = text.includes("error") || text.includes("deprecated") || text.includes("schema") || text.includes("parameter");
  if (!hasFiles && !hasError) {
    return { pass: false, reason: "schema drift task: did not list files or handle schema error" };
  }
  return { pass: true, reason: "schema drift task: listed files or handled schema change" };
};

/**
 * checkRateLimitRecovery: Agent must handle rate limiting by throttling or batching.
 * The talking variant should hint about rate limits.
 */
export const checkRateLimitRecovery: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasTodos = text.includes("TODO") || text.includes("FIXME") || text.includes("HACK") || text.includes("task");
  const hasRateLimit = text.includes("rate") || text.includes("limit") || text.includes("throttle") || text.includes("wait");
  if (!hasTodos) {
    return { pass: false, reason: "rate limit task: did not find TODO comments" };
  }
  return { pass: true, reason: "rate limit task: found TODOs despite potential rate limiting" };
};

/**
 * checkMultiStepState: Agent must maintain state across multiple tool calls.
 * The talking variant should hint about state dependencies between steps.
 */
export const checkMultiStepState: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasBuild = text.includes("build") || text.includes("compile") || text.includes("run") || text.includes("script");
  const hasError = text.includes("error") || text.includes("fail") || text.includes("missing") || text.includes("not found");
  if (!hasBuild && !hasError) {
    return { pass: false, reason: "multi-step state task: did not attempt build or report build status" };
  }
  return { pass: true, reason: "multi-step state task: attempted build and reported results" };
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
  checkStalePathConfig,
  checkPermissionCascade,
  checkAmbiguousSearch,
  checkHiddenDependency,
  checkEncodingTrap,
  checkSymlinkResolution,
  checkPartialRead,
  checkWriteConflict,
  checkContextPollution,
  checkArgumentHallucination,
  checkReentrantFailure,
  checkSchemaDrift,
  checkRateLimitRecovery,
  checkMultiStepState,
};
