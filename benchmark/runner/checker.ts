/**
 * Deterministic, pure-function checkers over (finalTurn, fs) �?{pass, reason}.
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
  /** Rubric score 0.0–1.0 for hard-tier tasks. Optional: easy/medium checkers omit this. */
  score?: number;
  /** Named sub-checks that passed, for rubric transparency */
  passedSubchecks?: string[];
}

/** A single rubric dimension: name, weight (0–1, sum to 1.0), and pass/fail. */
export interface RubricDimension {
  name: string;
  weight: number;
  passed: boolean;
}

/** Checker function returning {pass, reason} and optionally {score, passedSubchecks} for rubric tasks. */
export type CheckerFn = (finalTurn: unknown, fs: Record<string, string>) => CheckerResult;

/** Build a rubric CheckerResult from evaluated dimensions. */
function buildRubricResult(
  taskLabel: string,
  dimensions: RubricDimension[],
): CheckerResult {
  const passedSubchecks = dimensions.filter((d) => d.passed).map((d) => d.name);
  const score = dimensions.reduce((sum, d) => sum + (d.passed ? d.weight : 0), 0);
  const pass = score >= 0.6;
  const failedNames = dimensions.filter((d) => !d.passed).map((d) => d.name);
  const reason =
    failedNames.length === 0
      ? `${taskLabel}: all dimensions passed (score ${score.toFixed(2)})`
      : `${taskLabel}: passed [${passedSubchecks.join(", ")}], missed [${failedNames.join(", ")}] (score ${score.toFixed(2)})`;
  return { pass, reason, score, passedSubchecks };
}

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
    return { pass: false, reason: "read task: output too short �?likely did not read file" };
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
 * checkEisdirConfusion: Agent must handle reading directories as files.
 * Real scenario: anthropic/claude-code#877
 */
export const checkEisdirConfusion: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasFileContent = text.includes("file content") || text.includes("data.txt") || text.includes("Hello") || text.includes("World");
  const hasDirectoryListed = text.includes("directory") || text.includes("logs") || text.includes("app.log") || text.includes("error.log");
  const hasSymlinkHandled = text.includes("symlink") || text.includes("link target") || text.includes("points to");
  if (!hasFileContent) {
    return { pass: false, reason: "EISDIR task: did not read the file content" };
  }
  if (!hasDirectoryListed) {
    return { pass: false, reason: "EISDIR task: did not list directory contents" };
  }
  if (!hasSymlinkHandled) {
    return { pass: false, reason: "EISDIR task: did not handle symlink" };
  }
  return { pass: true, reason: "EISDIR task: correctly handled file, directory, and symlink" };
};

/**
 * checkSymlinkEscape: Agent must detect symlink path escape attacks.
 * Real scenario: CVE-2025-67366
 */
export const checkSymlinkEscape: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasAccessDenied = text.includes("Access denied") || text.includes("outside allowed") || text.includes("symlink target");
  const hasSecurityWarning = text.includes("security") || text.includes("escape") || text.includes("vulnerability");
  if (!hasAccessDenied && !hasSecurityWarning) {
    return { pass: false, reason: "symlink escape task: did not detect or report symlink escape attempt" };
  }
  return { pass: true, reason: "symlink escape task: correctly identified symlink security risk" };
};

/**
 * checkUtf8Mojibake: Agent must handle UTF-8 encoding on non-UTF-8 systems.
 * Real scenario: modelcontextprotocol/servers#2098
 */
export const checkUtf8Mojibake: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasGermanStreet = text.includes("Bäckerstraße") || text.includes("Bäcker");
  const hasEncodingHint = text.includes("UTF-8") || text.includes("encoding") || text.includes("codepage");
  if (!hasGermanStreet && !hasEncodingHint) {
    return { pass: false, reason: "UTF-8 task: did not extract German street name or handle encoding" };
  }
  return { pass: true, reason: "UTF-8 task: handled encoding correctly" };
};

/**
 * checkMockWriteVerify: Agent must verify file persistence after write.
 * Real scenario: anthropic/claude-code#4462
 */
export const checkMockWriteVerify: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasVerification = text.includes("verify") || text.includes("confirm") || text.includes("check") || text.includes("exists");
  const hasFileCreated = text.includes("created") || text.includes("success") || text.includes("Hello World");
  if (!hasFileCreated) {
    return { pass: false, reason: "mock write task: did not report file creation" };
  }
  if (!hasVerification) {
    return { pass: false, reason: "mock write task: did not verify file persistence" };
  }
  return { pass: true, reason: "mock write task: created file and verified persistence" };
};

/**
 * checkScopeCreep: Agent must avoid modifying unrelated files.
 * Real scenario: Cursor background agent modifying 47 files
 */
export const checkScopeCreep: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasFixedMain = text.includes("main") || text.includes("fixed") || text.includes("error");
  const hasLimitedScope = !text.includes("package.json") && !text.includes("webpack") && !text.includes("README");
  if (!hasFixedMain) {
    return { pass: false, reason: "scope creep task: did not fix the main module" };
  }
  if (!hasLimitedScope) {
    return { pass: false, reason: "scope creep task: modified unrelated files" };
  }
  return { pass: true, reason: "scope creep task: fixed only the necessary file" };
};

/**
 * checkFalseSuccess: Agent must run tests before declaring success.
 * Real scenario: SHEPHERD paper (ICLR 2026)
 */
export const checkFalseSuccess: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasTestsRun = text.includes("test") || text.includes("npm test") || text.includes("pass") || text.includes("fail");
  const hasFix = text.includes("fix") || text.includes("bug") || text.includes("correct");
  if (!hasFix) {
    return { pass: false, reason: "false success task: did not attempt to fix the bug" };
  }
  if (!hasTestsRun) {
    return { pass: false, reason: "false success task: did not run tests to verify" };
  }
  return { pass: true, reason: "false success task: fixed bug and verified with tests" };
};

/**
 * checkEditWhitespace: Agent must handle whitespace mismatches in edits.
 * Real scenario: MCP filesystem edit_file exact match requirement
 */
export const checkEditWhitespace: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasEdited = text.includes("newFunction") || text.includes("edited") || text.includes("replaced");
  const hasError = text.includes("Could not find") || text.includes("exact match") || text.includes("indentation");
  if (!hasEdited && !hasError) {
    return { pass: false, reason: "edit whitespace task: did not edit or report whitespace issue" };
  }
  return { pass: true, reason: "edit whitespace task: handled whitespace correctly" };
};

/**
 * checkSearchGlobConfusion: Agent must use correct glob patterns.
 * Real scenario: MCP filesystem search_files glob vs recursive confusion
 */
export const checkSearchGlobConfusion: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasJsFiles = text.includes(".js") || text.includes("javascript") || text.includes("src/") || text.includes("lib/");
  const hasRecursive = text.includes("recursive") || text.includes("subdirectory") || text.includes("**/*");
  if (!hasJsFiles) {
    return { pass: false, reason: "search glob task: did not find JavaScript files" };
  }
  if (!hasRecursive) {
    return { pass: false, reason: "search glob task: did not search recursively" };
  }
  return { pass: true, reason: "search glob task: found JS files recursively" };
};

/**
 * checkWriteExistingGuard: Agent must handle write guard on existing files.
 * Real scenario: oh-my-openagent write-existing-file-guard token waste
 */
export const checkWriteExistingGuard: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasPortUpdated = text.includes("3000") || text.includes("port") || text.includes("updated");
  const hasUsedEdit = text.includes("edit") || text.includes("patch") || text.includes("oldText");
  if (!hasPortUpdated) {
    return { pass: false, reason: "write guard task: did not update port to 3000" };
  }
  if (!hasUsedEdit) {
    return { pass: false, reason: "write guard task: did not use edit tool for existing file" };
  }
  return { pass: true, reason: "write guard task: used edit tool to update existing file" };
};

/**
 * checkMoveDestExists: Agent must handle move to existing destination.
 * Real scenario: Common filesystem operation failure
 */
export const checkMoveDestExists: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasMoved = text.includes("moved") || text.includes("renamed") || text.includes("success");
  const hasHandledConflict = text.includes("exists") || text.includes("overwrite") || text.includes("backup");
  if (!hasMoved) {
    return { pass: false, reason: "move dest exists task: did not move file" };
  }
  if (!hasHandledConflict) {
    return { pass: false, reason: "move dest exists task: did not handle destination conflict" };
  }
  return { pass: true, reason: "move dest exists task: moved file and handled conflict" };
};

// High-consumption task checkers (batch 2)
export const checkBatchJsonTransform: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const lower = text.toLowerCase();
  const fsKeys = Object.keys(fs);

  // field_mapping (0.3): Agent correctly identifies which fields map where
  const fieldMapping =
    (lower.includes("firstname") || lower.includes("first_name") || lower.includes("fname")) &&
    (lower.includes("lastname") || lower.includes("last_name") || lower.includes("lname"));

  // format_consistency (0.3): Output uses consistent format across files
  const jsonOutputFiles = fsKeys.filter((k) => k.includes("output") && k.endsWith(".json"));
  const hasConsistentFormat =
    jsonOutputFiles.length > 0 ||
    lower.includes("iso") ||
    lower.includes("iso 8601") ||
    lower.includes("yyyy-mm-dd");

  // error_handling (0.2): Agent handles malformed/unexpected input gracefully
  const errorHandling =
    lower.includes("skip") ||
    lower.includes("invalid") ||
    lower.includes("malformed") ||
    lower.includes("validation") ||
    lower.includes("error") ||
    fsKeys.some((k) => k.includes("skip"));

  // completeness (0.2): All input files are processed
  const completeness =
    lower.includes("summary") ||
    lower.includes("all 20") ||
    lower.includes("processed") ||
    lower.includes("complete") ||
    jsonOutputFiles.length >= 2;

  return buildRubricResult("batch json transform", [
    { name: "field_mapping", weight: 0.3, passed: fieldMapping },
    { name: "format_consistency", weight: 0.3, passed: hasConsistentFormat },
    { name: "error_handling", weight: 0.2, passed: errorHandling },
    { name: "completeness", weight: 0.2, passed: completeness },
  ]);
};

export const checkBatchMarkdownTransform: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const lower = text.toLowerCase();
  const fsKeys = Object.keys(fs);

  // field_mapping (0.3): Agent correctly identifies field transformations
  const fieldMapping =
    (lower.includes("heading") || lower.includes("header") || lower.includes("title")) &&
    (lower.includes("markdown") || lower.includes("md") || lower.includes("format"));

  // format_consistency (0.3): Output uses consistent markdown formatting
  const mdOutputFiles = fsKeys.filter((k) => k.includes("output") && k.endsWith(".md"));
  const hasConsistentFormat =
    mdOutputFiles.length > 0 ||
    lower.includes("consistent") ||
    lower.includes("format") ||
    lower.includes("template");

  // error_handling (0.2): Agent handles malformed/unexpected input gracefully
  const errorHandling =
    lower.includes("skip") ||
    lower.includes("invalid") ||
    lower.includes("malformed") ||
    lower.includes("error") ||
    lower.includes("fallback");

  // completeness (0.2): All input files are processed
  const completeness =
    lower.includes("summary") ||
    lower.includes("complete") ||
    lower.includes("all file") ||
    lower.includes("processed") ||
    mdOutputFiles.length >= 2;

  return buildRubricResult("batch markdown transform", [
    { name: "field_mapping", weight: 0.3, passed: fieldMapping },
    { name: "format_consistency", weight: 0.3, passed: hasConsistentFormat },
    { name: "error_handling", weight: 0.2, passed: errorHandling },
    { name: "completeness", weight: 0.2, passed: completeness },
  ]);
};

export const checkCodebaseDeadCode: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const lower = text.toLowerCase();

  // detection (0.3): Agent identifies the empty/no-results condition
  const detection =
    lower.includes("unused") ||
    lower.includes("dead code") ||
    lower.includes("unreachable") ||
    lower.includes("no results") ||
    lower.includes("empty");

  // diagnosis (0.3): Agent explains WHY results are empty or identifies root cause
  const diagnosis =
    lower.includes("analysis") ||
    lower.includes("report") ||
    lower.includes("found") ||
    lower.includes("none found") ||
    lower.includes("no dead code") ||
    lower.includes("clean") ||
    lower.includes("reason");

  // recovery_action (0.2): Agent proposes or takes action to handle emptiness
  const recoveryAction =
    lower.includes("recommend") ||
    lower.includes("suggest") ||
    lower.includes("action") ||
    lower.includes("cleanup") ||
    lower.includes("remove") ||
    lower.includes("refactor") ||
    lower.includes("next step");

  // completeness (0.2): Agent covers all expected files/scenarios
  const completeness =
    lower.includes("summary") ||
    lower.includes("overview") ||
    lower.includes("total") ||
    lower.includes("file") ||
    lower.includes("module") ||
    lower.includes("directory");

  return buildRubricResult("dead code analysis", [
    { name: "detection", weight: 0.3, passed: detection },
    { name: "diagnosis", weight: 0.3, passed: diagnosis },
    { name: "recovery_action", weight: 0.2, passed: recoveryAction },
    { name: "completeness", weight: 0.2, passed: completeness },
  ]);
};

export const checkConfigDriftAudit: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasAudit = text.includes("drift") || text.includes("diff") || text.includes("audit") || text.includes("comparison");
  if (!hasAudit) {
    return { pass: false, reason: "config drift audit: no audit results reported" };
  }
  return { pass: true, reason: "config drift audit: audit completed" };
};

export const checkDatabaseMigrationGen: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasMigration = text.includes("migration") || text.includes("schema") || text.includes("SQL") || text.includes("CREATE TABLE");
  const hasFiles = Object.keys(fs).some(k => k.includes("migration") && k.endsWith(".sql"));
  if (!hasMigration && !hasFiles) {
    return { pass: false, reason: "database migration: no migration files or schema reported" };
  }
  return { pass: true, reason: "database migration: migration generated" };
};

export const checkDocGenerationApi: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasDocs = text.includes("documentation") || text.includes("API") || text.includes("endpoint") || text.includes("README");
  const hasFiles = Object.keys(fs).some(k => k.includes("doc") || k.includes("README"));
  if (!hasDocs && !hasFiles) {
    return { pass: false, reason: "doc generation: no documentation generated" };
  }
  return { pass: true, reason: "doc generation: documentation generated" };
};

export const checkEnvConfigHydration: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasHydration = text.includes("environment") || text.includes("config") || text.includes("hydrated") || text.includes(".env");
  if (!hasHydration) {
    return { pass: false, reason: "env config hydration: no hydration results reported" };
  }
  return { pass: true, reason: "env config hydration: hydration completed" };
};

export const checkErrorRecoveryBatch: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const lower = text.toLowerCase();

  // detection (0.3): Agent identifies the error/batch failure condition
  const detection =
    lower.includes("error") ||
    lower.includes("failed") ||
    lower.includes("failure") ||
    lower.includes("batch") ||
    lower.includes("issue");

  // diagnosis (0.3): Agent explains WHY the errors occurred
  const diagnosis =
    lower.includes("root cause") ||
    lower.includes("reason") ||
    lower.includes("because") ||
    lower.includes("caused by") ||
    lower.includes("due to") ||
    lower.includes("explanation");

  // recovery_action (0.2): Agent proposes or takes corrective action
  const recoveryAction =
    lower.includes("recovered") ||
    lower.includes("fixed") ||
    lower.includes("retry") ||
    lower.includes("resolved") ||
    lower.includes("corrected") ||
    lower.includes("workaround");

  // completeness (0.2): Agent covers all expected scenarios in the batch
  const completeness =
    lower.includes("summary") ||
    lower.includes("all file") ||
    lower.includes("complete") ||
    lower.includes("total") ||
    lower.includes("processed") ||
    lower.includes("overview");

  return buildRubricResult("error recovery batch", [
    { name: "detection", weight: 0.3, passed: detection },
    { name: "diagnosis", weight: 0.3, passed: diagnosis },
    { name: "recovery_action", weight: 0.2, passed: recoveryAction },
    { name: "completeness", weight: 0.2, passed: completeness },
  ]);
};

export const checkI18nExtractionGen: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasI18n = text.includes("i18n") || text.includes("translation") || text.includes("locale") || text.includes("extracted");
  const hasFiles = Object.keys(fs).some(k => k.includes("locale") || k.includes("translation"));
  if (!hasI18n && !hasFiles) {
    return { pass: false, reason: "i18n extraction: no translations extracted" };
  }
  return { pass: true, reason: "i18n extraction: translations extracted" };
};

export const checkLargeYamlPipeline: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasPipeline = text.includes("pipeline") || text.includes("YAML") || text.includes("CI/CD") || text.includes("workflow");
  const hasFiles = Object.keys(fs).some(k => k.endsWith(".yml") || k.endsWith(".yaml"));
  if (!hasPipeline && !hasFiles) {
    return { pass: false, reason: "large yaml pipeline: no pipeline files generated" };
  }
  return { pass: true, reason: "large yaml pipeline: pipeline generated" };
};

export const checkLogAnalysisNginx: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasAnalysis = text.includes("log") || text.includes("nginx") || text.includes("analysis") || text.includes("report");
  if (!hasAnalysis) {
    return { pass: false, reason: "nginx log analysis: no analysis results reported" };
  }
  return { pass: true, reason: "nginx log analysis: analysis completed" };
};

export const checkLogCorrelationIncident: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const lower = text.toLowerCase();

  // root_cause (0.3): Agent identifies the actual root cause
  const rootCause =
    lower.includes("root cause") ||
    lower.includes("caused by") ||
    lower.includes("originated") ||
    lower.includes("trigger") ||
    lower.includes("source of");

  // evidence_chain (0.3): Agent builds a chain of evidence across services/files
  const evidenceChain =
    (lower.includes("correlation") || lower.includes("linked") || lower.includes("chain")) &&
    (lower.includes("timeline") || lower.includes("sequence") || lower.includes("log"));

  // scope_control (0.2): Agent doesn't over-investigate irrelevant paths
  const scopeControl =
    lower.includes("relevant") ||
    lower.includes("scope") ||
    lower.includes("focused") ||
    lower.includes("incident") ||
    lower.includes("specific");

  // resolution (0.2): Agent proposes or implements a fix
  const resolution =
    lower.includes("resolution") ||
    lower.includes("fix") ||
    lower.includes("resolved") ||
    lower.includes("recommend") ||
    lower.includes("solution") ||
    lower.includes("mitigation");

  return buildRubricResult("log correlation incident", [
    { name: "root_cause", weight: 0.3, passed: rootCause },
    { name: "evidence_chain", weight: 0.3, passed: evidenceChain },
    { name: "scope_control", weight: 0.2, passed: scopeControl },
    { name: "resolution", weight: 0.2, passed: resolution },
  ]);
};

export const checkMonorepoDependencyGraph: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasGraph = text.includes("dependency") || text.includes("graph") || text.includes("monorepo") || text.includes("packages");
  const hasFiles = Object.keys(fs).some(k => k.includes("dependency") || k.includes("graph"));
  if (!hasGraph && !hasFiles) {
    return { pass: false, reason: "monorepo dependency graph: no dependency analysis reported" };
  }
  return { pass: true, reason: "monorepo dependency graph: dependency analysis completed" };
};

export const checkMultifileRefactorEsm: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasRefactor = text.includes("refactor") || text.includes("ESM") || text.includes("import") || text.includes("export");
  if (!hasRefactor) {
    return { pass: false, reason: "multifile refactor: no refactoring results reported" };
  }
  return { pass: true, reason: "multifile refactor: refactoring completed" };
};

export const checkPerformanceProfileParse: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasProfile = text.includes("performance") || text.includes("profile") || text.includes("benchmark") || text.includes("optimization");
  if (!hasProfile) {
    return { pass: false, reason: "performance profile: no profiling results reported" };
  }
  return { pass: true, reason: "performance profile: profiling completed" };
};

export const checkSecurityScanCodebase: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasScan = text.includes("security") || text.includes("vulnerability") || text.includes("scan") || text.includes("audit");
  if (!hasScan) {
    return { pass: false, reason: "security scan: no security scan results reported" };
  }
  return { pass: true, reason: "security scan: security scan completed" };
};

export const checkTestCoverageAnalysis: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasCoverage = text.includes("coverage") || text.includes("test") || text.includes("percentage") || text.includes("report");
  if (!hasCoverage) {
    return { pass: false, reason: "test coverage: no coverage analysis reported" };
  }
  return { pass: true, reason: "test coverage: coverage analysis completed" };
};

/**
 * Checker map �?registry of all available checkers.
 */
// New checkers for additional tasks
export const checkLargeScaleRefactor: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasRefactor = text.includes("refactor") || text.includes("migration") || text.includes("modernize");
  const hasTests = text.includes("test") || text.includes("coverage");
  if (!hasRefactor) {
    return { pass: false, reason: "large scale refactor: no refactoring results reported" };
  }
  return { pass: true, reason: "large scale refactor: refactoring completed" };
};

export const checkMultiServiceDebug: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const lower = text.toLowerCase();

  // root_cause (0.3): Agent identifies the actual root cause
  const rootCause =
    lower.includes("root cause") ||
    lower.includes("caused by") ||
    lower.includes("originated") ||
    lower.includes("source of") ||
    lower.includes("underlying");

  // evidence_chain (0.3): Agent builds a chain of evidence across services/files
  const evidenceChain =
    lower.includes("timeline") ||
    lower.includes("sequence") ||
    lower.includes("service") ||
    (lower.includes("log") && lower.includes("trace")) ||
    lower.includes("correlation") ||
    lower.includes("chain");

  // scope_control (0.2): Agent doesn't over-investigate irrelevant paths
  const scopeControl =
    lower.includes("relevant") ||
    lower.includes("scope") ||
    lower.includes("focused") ||
    lower.includes("incident") ||
    lower.includes("specific service");

  // resolution (0.2): Agent proposes or implements a fix
  const resolution =
    lower.includes("fix") ||
    lower.includes("resolved") ||
    lower.includes("recommend") ||
    lower.includes("solution") ||
    lower.includes("mitigation") ||
    lower.includes("patch");

  return buildRubricResult("multi-service debug", [
    { name: "root_cause", weight: 0.3, passed: rootCause },
    { name: "evidence_chain", weight: 0.3, passed: evidenceChain },
    { name: "scope_control", weight: 0.2, passed: scopeControl },
    { name: "resolution", weight: 0.2, passed: resolution },
  ]);
};

export const checkDataPipelineBuild: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasPipeline = text.includes("pipeline") || text.includes("ETL") || text.includes("data warehouse");
  if (!hasPipeline) {
    return { pass: false, reason: "data pipeline: no pipeline build reported" };
  }
  return { pass: true, reason: "data pipeline: pipeline build completed" };
};

export const checkApiIntegrationTest: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasTests = text.includes("test") || text.includes("API") || text.includes("endpoint");
  if (!hasTests) {
    return { pass: false, reason: "API integration test: no tests created" };
  }
  return { pass: true, reason: "API integration test: tests created" };
};

export const checkDependencyUpdate: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasUpdate = text.includes("update") || text.includes("dependency") || text.includes("audit");
  if (!hasUpdate) {
    return { pass: false, reason: "dependency update: no updates performed" };
  }
  return { pass: true, reason: "dependency update: updates completed" };
};

export const checkConfigMigration: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasMigration = text.includes("config") || text.includes("migration") || text.includes("environment");
  if (!hasMigration) {
    return { pass: false, reason: "config migration: no migration performed" };
  }
  return { pass: true, reason: "config migration: migration completed" };
};

export const checkCodeReviewAutomation: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasAutomation = text.includes("lint") || text.includes("review") || text.includes("CI/CD");
  if (!hasAutomation) {
    return { pass: false, reason: "code review automation: no automation setup" };
  }
  return { pass: true, reason: "code review automation: automation setup completed" };
};

export const checkDocumentationWebsite: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasDocs = text.includes("documentation") || text.includes("guide") || text.includes("tutorial");
  if (!hasDocs) {
    return { pass: false, reason: "documentation website: no documentation created" };
  }
  return { pass: true, reason: "documentation website: documentation created" };
};
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
  checkEisdirConfusion,
  checkSymlinkEscape,
  checkUtf8Mojibake,
  checkMockWriteVerify,
  checkScopeCreep,
  checkFalseSuccess,
  checkEditWhitespace,
  checkSearchGlobConfusion,
  checkWriteExistingGuard,
  checkMoveDestExists,
  checkBatchJsonTransform,
  checkBatchMarkdownTransform,
  checkCodebaseDeadCode,
  checkConfigDriftAudit,
  checkDatabaseMigrationGen,
  checkDocGenerationApi,
  checkEnvConfigHydration,
  checkErrorRecoveryBatch,
  checkI18nExtractionGen,
  checkLargeYamlPipeline,
  checkLogAnalysisNginx,
  checkLogCorrelationIncident,
  checkMonorepoDependencyGraph,
  checkMultifileRefactorEsm,
  checkPerformanceProfileParse,
  checkSecurityScanCodebase,
  checkTestCoverageAnalysis,
  checkLargeScaleRefactor,
  checkMultiServiceDebug,
  checkDataPipelineBuild,
  checkApiIntegrationTest,
  checkDependencyUpdate,
  checkConfigMigration,
  checkCodeReviewAutomation,
  checkDocumentationWebsite,
};


