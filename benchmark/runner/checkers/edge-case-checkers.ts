import type { CheckerFn, CheckerResult } from "./types.js";

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
