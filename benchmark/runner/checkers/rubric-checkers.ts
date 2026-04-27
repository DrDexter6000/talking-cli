import type { CheckerFn, CheckerResult, RubricDimension } from "./types.js";

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
