/**
 * Filesystem benchmark checkers (Round 4).
 *
 * Each checker receives (finalTurn, _fs) and returns {pass, reason, score?, passedSubchecks?}.
 * Filesystem tasks analyze the LLM's final text response.
 */

function textOf(finalTurn) {
  return typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
}

// ─── Easy checkers ─────────────────────────────────────────────────────────────

function checkFsReadAndSearch(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();
  const hasFileRead = text.includes("notes") || text.includes("file") || text.includes("content") || text.includes("read");
  // Tightened: must report specific search results (actual content found, not just "I searched")
  const hasSpecificResult = text.includes("meeting") || text.includes("standup") || text.includes("sprint")
    || text.includes("agenda") || text.includes("action item") || text.includes("deadline")
    || text.includes("review") || text.includes("launch") || (text.includes("found") && (text.includes("line") || text.includes("match") || text.includes("result")));
  const hasSearch = text.includes("search") || text.includes("found") || text.includes("match") || text.includes("grep");
  if (!hasFileRead && !hasSearch) {
    return { pass: false, reason: "read-and-search: response does not mention reading or search" };
  }
  if (!hasSpecificResult) {
    return { pass: false, reason: "read-and-search: response mentions search but does not report specific content found" };
  }
  return { pass: true, reason: "read-and-search: agent read file and reported specific search results" };
}

function checkFsDirectoryVsFile(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();
  const hasDirectory = text.includes("director") || text.includes("folder") || text.includes("listing");
  const hasContents = text.includes("contents") || text.includes("file") || text.includes("entries");
  const hasGithub = text.includes(".github") || text.includes("github");
  if (!hasDirectory && !hasContents) {
    return { pass: false, reason: "directory-vs-file: response does not recognize .github as a directory" };
  }
  return { pass: true, reason: `directory-vs-file: agent handled .github as directory${hasGithub ? " and listed contents" : ""}` };
}

function checkFsWriteAndVerify(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();
  const hasCreated = text.includes("creat") || text.includes("wrote") || text.includes("writ");
  // Tightened: verification must confirm actual file content (not just "I wrote the file")
  const hasContentVerify = text.includes("verif") && (text.includes("content") || text.includes("q1") || text.includes("revenue") || text.includes("15%"));
  const hasReadBack = text.includes("read") && (text.includes("content") || text.includes("confirm"));
  const hasConfirmed = hasContentVerify || hasReadBack || (text.includes("q1") && text.includes("revenue"));
  if (!hasCreated) {
    return { pass: false, reason: "write-and-verify: response does not mention creating/writing" };
  }
  if (!hasConfirmed) {
    return { pass: false, reason: "write-and-verify: response mentions creation but does not confirm file content was verified" };
  }
  return { pass: true, reason: "write-and-verify: agent created file and verified content" };
}

// ─── Medium checkers ────────────────────────────────────────────────────────────

function checkFsEditMissingText(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();
  const hasAttempt = text.includes("edit") || text.includes("change") || text.includes("config");
  const hasNotFound = text.includes("not found") || text.includes("no match") || text.includes("does not exist") || text.includes("error") || text.includes("fail");
  const hasRead = text.includes("read") || text.includes("content") || text.includes("current");
  if (!hasAttempt) {
    return { pass: false, reason: "edit-missing-text: response does not mention attempting edit" };
  }
  if (!hasNotFound && !hasRead) {
    return { pass: false, reason: "edit-missing-text: response does not indicate text was not found or read file first" };
  }
  return { pass: true, reason: `edit-missing-text: agent attempted edit${hasNotFound ? " and handled missing text" : " and read file"}` };
}

function checkFsBatchReadPartial(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();
  const hasReadme = text.includes("readme");
  const hasChangelog = text.includes("changelog");
  const hasError = text.includes("error") || text.includes("not found") || text.includes("nonexistent") || text.includes("fail") || text.includes("does not exist");
  // Tightened: must explicitly report BOTH successful reads AND failed reads
  const hasSuccessfulRead = hasReadme || hasChangelog;
  // Must mention which specific file succeeded and which failed
  const hasSuccessExplicitly = (hasReadme || hasChangelog) && (text.includes("success") || text.includes("read") || text.includes("content") || text.includes("contain"));
  const hasFailureExplicitly = hasError && (text.includes("nonexistent") || text.includes("missing") || text.includes("not found") || text.includes("could not") || text.includes("does not exist"));
  if (!hasSuccessfulRead && !hasError) {
    return { pass: false, reason: "batch-read-partial: response does not mention any file content or errors" };
  }
  if (!hasSuccessExplicitly || !hasFailureExplicitly) {
    return { pass: false, reason: `batch-read-partial: response does not explicitly report both successful reads and failed reads (success: ${hasSuccessExplicitly}, failure: ${hasFailureExplicitly})` };
  }
  return { pass: true, reason: "batch-read-partial: agent reported both successful and failed reads" };
}

function checkFsMoveToExisting(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();
  const hasMove = text.includes("move") || text.includes("mov");
  const hasConflict = text.includes("conflict") || text.includes("exist") || text.includes("overwrite") || text.includes("error") || text.includes("fail");
  const hasArchive = text.includes("archive");
  if (!hasMove) {
    return { pass: false, reason: "move-to-existing: response does not mention move operation" };
  }
  return { pass: true, reason: `move-to-existing: agent attempted move${hasConflict ? " and handled conflict" : ""}${hasArchive ? " with archive dir" : ""}` };
}

function checkFsSearchNoMatches(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();
  const hasSearch = text.includes("search") || text.includes("found") || text.includes("quantum") || text.includes("roadmap");
  const hasNoMatch = text.includes("no ") && (text.includes("match") || text.includes("result") || text.includes("found"));
  // Tightened: must ALSO suggest alternatives or next steps
  const hasSuggestion = text.includes("suggest") || text.includes("try") || text.includes("alternat")
    || (text.includes("could") && (text.includes("search") || text.includes("try") || text.includes("use") || text.includes("pattern")))
    || text.includes("might") || text.includes("broaden") || text.includes("different pattern")
    || text.includes("widen") || text.includes("other director") || text.includes("check other");
  if (!hasSearch && !hasNoMatch) {
    return { pass: false, reason: "search-no-matches: response does not mention search or results" };
  }
  if (!hasNoMatch) {
    return { pass: false, reason: "search-no-matches: response does not report that no matches were found" };
  }
  if (!hasSuggestion) {
    return { pass: false, reason: "search-no-matches: response reports no matches but does not suggest alternatives or next steps" };
  }
  return { pass: true, reason: "search-no-matches: agent searched, found nothing, and suggested alternatives" };
}

function checkFsMultiStepCreate(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();
  // Tightened: require ALL THREE elements: src/, component/, AND app/ directories
  const hasSrc = text.includes("src");
  const hasComponent = text.includes("component");
  const hasApp = text.includes("app");
  const hasIndex = text.includes("index") || text.includes("import");
  // Must confirm all 3 directories were created
  const allDirsCreated = hasSrc && hasComponent && hasApp;
  // Must have some verification that they exist
  const hasVerify = text.includes("list") || text.includes("verif") || text.includes("struct") || text.includes("creat") || text.includes("exist") || text.includes("tree");

  const dimensions = [
    { name: "src_dir", weight: 0.3, passed: hasSrc },
    { name: "component_dir", weight: 0.3, passed: hasComponent },
    { name: "app_dir", weight: 0.15, passed: hasApp && hasIndex },
    { name: "structure_verified", weight: 0.25, passed: hasVerify },
  ];

  const passedSubchecks = dimensions.filter(d => d.passed).map(d => d.name);
  const score = dimensions.reduce((sum, d) => sum + (d.passed ? d.weight : 0), 0);
  // Tightened: must have all 3 dirs AND some verification (score alone isn't enough)
  const pass = allDirsCreated && hasVerify;
  const failedNames = dimensions.filter(d => !d.passed).map(d => d.name);

  return {
    pass,
    reason: failedNames.length === 0
      ? `multi-step-create: all dimensions passed (score ${score.toFixed(2)})`
      : `multi-step-create: passed [${passedSubchecks.join(", ")}], missed [${failedNames.join(", ")}] (score ${score.toFixed(2)})`,
    score,
    passedSubchecks,
  };
}

function checkFsPathTraversal(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();
  const hasDenied = text.includes("denied") || text.includes("forbidden") || text.includes("not allowed") || text.includes("access denied") || text.includes("refused");
  // Tightened: must explain WHY the path was denied (specific reason about path scope)
  const hasSpecificReason = text.includes("outside allowed") || text.includes("outside the allowed") || text.includes("not in allowed")
    || text.includes("outside permitted") || text.includes("not within") || text.includes("beyond the allowed")
    || text.includes("security restriction") || text.includes("security reason") || text.includes("path traversal")
    || (text.includes("security") && (text.includes("path") || text.includes("access") || text.includes("restrict")))
    || (text.includes("allowed") && text.includes("director"));
  if (!hasDenied) {
    return { pass: false, reason: "path-traversal: response does not recognize access denial" };
  }
  if (!hasSpecificReason) {
    return { pass: false, reason: "path-traversal: response mentions denial but does not explain why (must mention 'outside allowed directory', 'not in allowed paths', or 'security restriction')" };
  }
  return { pass: true, reason: "path-traversal: agent recognized access denial and explained the security reason" };
}

function checkFsBinaryAsText(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();
  // Tightened: must mention SPECIFIC binary format AND that it cannot be displayed as text
  const hasSpecificFormat = text.includes("png") || text.includes("bmp") || text.includes("jpeg") || text.includes("gif") || text.includes("image file");
  const hasBinary = text.includes("binary") || text.includes("non-text") || text.includes("unreadable") || text.includes("cannot be read");
  const cannotDisplayAsText = text.includes("cannot be display") || text.includes("cannot be read") || text.includes("not a text") || text.includes("unreadable") || text.includes("not display") || text.includes("not readable") || text.includes("non-text") || text.includes("binary") && (text.includes("cannot") || text.includes("unable") || text.includes("not"));
  if (!hasSpecificFormat && !hasBinary) {
    return { pass: false, reason: "binary-as-text: response does not identify the specific binary format (PNG, BMP, image)" };
  }
  if (!cannotDisplayAsText) {
    return { pass: false, reason: "binary-as-text: response mentions binary/image but does not explain it cannot be displayed as text" };
  }
  return { pass: true, reason: `binary-as-text: agent identified ${hasSpecificFormat ? "specific binary format" : "binary content"} and explained it cannot be displayed as text` };
}

// ─── Hard checkers ──────────────────────────────────────────────────────────────

function checkFsEmptyDirListing(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();
  const hasStaging = text.includes("staging") || text.includes("creat") || text.includes("director");
  // Tightened: must explicitly confirm the directory listing is empty (specific wording)
  const hasEmptyExplicitly = text.includes("empty") || (text.includes("no ") && (text.includes("file") || text.includes("items") || text.includes("entries") || text.includes("content")))
    || text.includes("0 items") || text.includes("0 files") || text.includes("nothing") || text.includes("no files");
  const hasExplain = text.includes("mean") || text.includes("recently") || text.includes("new") || text.includes("nothing yet") || text.includes("can") || text.includes("possible");

  const dimensions = [
    { name: "dir_created", weight: 0.3, passed: hasStaging },
    { name: "empty_detected", weight: 0.35, passed: hasEmptyExplicitly },
    { name: "interpreted", weight: 0.35, passed: hasExplain },
  ];

  const passedSubchecks = dimensions.filter(d => d.passed).map(d => d.name);
  const score = dimensions.reduce((sum, d) => sum + (d.passed ? d.weight : 0), 0);
  // Tightened: MUST explicitly confirm empty listing (not just score-based)
  const pass = hasEmptyExplicitly && score >= 0.5;
  const failedNames = dimensions.filter(d => !d.passed).map(d => d.name);

  return {
    pass,
    reason: failedNames.length === 0
      ? `empty-dir-listing: all dimensions passed (score ${score.toFixed(2)})`
      : `empty-dir-listing: passed [${passedSubchecks.join(", ")}], missed [${failedNames.join(", ")}] (score ${score.toFixed(2)})`,
    score,
    passedSubchecks,
  };
}

function checkFsComplexEditVerify(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();
  // Tightened: require evidence of BOTH reading original AND confirming edit with specific text changed
  const hasReadOriginal = text.includes("read") || text.includes("original") || text.includes("current") || text.includes("before");
  // Must mention the specific text that was changed (port 3000→8080, debug true→false, etc.)
  const hasSpecificChange = (text.includes("8080") || text.includes("port")) && (text.includes("debug") || text.includes("false"));
  const hasVerify = text.includes("verif") || text.includes("confirm") || text.includes("after") || text.includes("change") || text.includes("updat");

  const dimensions = [
    { name: "read_original", weight: 0.25, passed: hasReadOriginal },
    { name: "edit_applied", weight: 0.35, passed: hasSpecificChange },
    { name: "verified", weight: 0.4, passed: hasVerify },
  ];

  const passedSubchecks = dimensions.filter(d => d.passed).map(d => d.name);
  const score = dimensions.reduce((sum, d) => sum + (d.passed ? d.weight : 0), 0);
  // Tightened: must have BOTH read original AND specific change mentioned
  const pass = hasReadOriginal && hasSpecificChange && hasVerify;
  const failedNames = dimensions.filter(d => !d.passed).map(d => d.name);

  return {
    pass,
    reason: failedNames.length === 0
      ? `complex-edit-verify: all dimensions passed (score ${score.toFixed(2)})`
      : `complex-edit-verify: passed [${passedSubchecks.join(", ")}], missed [${failedNames.join(", ")}] (score ${score.toFixed(2)})`,
    score,
    passedSubchecks,
  };
}

function checkFsSearchSkipTrees(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();
  const hasSearch = text.includes("search") || text.includes("python") || text.includes(".py");
  // Tightened: must report a SPECIFIC count number (digit in context of files found)
  const hasSpecificCount = /\d+/.test(text) && (text.includes("found") || text.includes("file") || text.includes("result") || text.includes("match") || text.includes("count"));
  // Tightened: must mention the exclude pattern
  const hasExcludePattern = text.includes("node_modules") || text.includes(".git") || text.includes("exclude") || text.includes("skip") || text.includes("ignor");
  const hasListing = text.includes("list") || text.includes("src") || text.includes("director");
  const hasDiscrepancy = text.includes("discrepan") || text.includes("miss") || text.includes("differ") || text.includes("more") || text.includes("additional") || text.includes("incomplete");

  const dimensions = [
    { name: "search_performed", weight: 0.2, passed: hasSearch },
    { name: "specific_count", weight: 0.3, passed: hasSpecificCount },
    { name: "exclude_mentioned", weight: 0.2, passed: hasExcludePattern },
    { name: "cross_check_or_discrepancy", weight: 0.3, passed: hasListing || hasDiscrepancy },
  ];

  const passedSubchecks = dimensions.filter(d => d.passed).map(d => d.name);
  const score = dimensions.reduce((sum, d) => sum + (d.passed ? d.weight : 0), 0);
  // Tightened: must have specific count AND exclude pattern mention
  const pass = hasSpecificCount && hasExcludePattern && score >= 0.5;
  const failedNames = dimensions.filter(d => !d.passed).map(d => d.name);

  return {
    pass,
    reason: failedNames.length === 0
      ? `search-skip-trees: all dimensions passed (score ${score.toFixed(2)})`
      : `search-skip-trees: passed [${passedSubchecks.join(", ")}], missed [${failedNames.join(", ")}] (score ${score.toFixed(2)})`,
    score,
    passedSubchecks,
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  checkFsReadAndSearch,
  checkFsDirectoryVsFile,
  checkFsWriteAndVerify,
  checkFsEditMissingText,
  checkFsBatchReadPartial,
  checkFsMoveToExisting,
  checkFsSearchNoMatches,
  checkFsMultiStepCreate,
  checkFsPathTraversal,
  checkFsBinaryAsText,
  checkFsEmptyDirListing,
  checkFsComplexEditVerify,
  checkFsSearchSkipTrees,
};
