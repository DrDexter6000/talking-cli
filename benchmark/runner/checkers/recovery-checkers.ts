import type { CheckerFn, CheckerResult } from "./types.js";

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
