/**
 * Fetch benchmark checkers (Round 4).
 *
 * Each checker receives (finalTurn, _fs) and returns {pass, reason, score?, passedSubchecks?}.
 * Fetch tasks analyze the LLM's final text response.
 */

function textOf(finalTurn) {
  return typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
}

function checkFetchBasicPage(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();
  const hasExample = text.includes("example") || text.includes("domain") || text.includes("iana");
  // Tightened: must mention at least one specific thing from the page content
  const hasSpecificContent = text.includes("reserved") || text.includes("iana") || text.includes("internet assigned")
    || text.includes("registration") || text.includes("dns") || text.includes("top-level domain") || text.includes("tld")
    || text.includes("example.com") || text.includes("documentat") || text.includes("test") || text.includes("placeholder");
  const hasSummary = text.includes("summar") || text.includes("page") || text.includes("about") || text.includes("describ");
  if (!hasExample && !hasSummary) {
    return { pass: false, reason: "basic-page: response does not mention the fetched page or its content" };
  }
  if (!hasSpecificContent) {
    return { pass: false, reason: "basic-page: response mentions the page but does not include any specific content from it" };
  }
  return { pass: true, reason: "basic-page: agent fetched page and summarized specific content" };
}

function checkFetch404Handling(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();
  const has404 = text.includes("404") || text.includes("not found");
  const hasExplain = text.includes("error") || text.includes("fail") || text.includes("does not exist") || text.includes("http") || text.includes("status");
  if (!has404 && !hasExplain) {
    return { pass: false, reason: "404-handling: response does not mention 404 or error" };
  }
  return { pass: true, reason: `404-handling: agent reported${has404 ? " 404 error" : " error"}${hasExplain ? " and explained meaning" : ""}` };
}

function checkFetchTruncation(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();
  // Tightened: must mention truncation AND a concrete next step (not just "truncated")
  const hasTruncation = text.includes("truncat") || text.includes("cut off") || text.includes("incomplete") || text.includes("partial");
  // Must provide a concrete next step like pagination, offset, or fetching the rest
  const hasConcreteNextStep = (text.includes("offset") || text.includes("pagination") || text.includes("paginate")
    || text.includes("fetch the rest") || text.includes("continu") || text.includes("next page")
    || text.includes("get more") || text.includes("fetch more") || text.includes("request the rest")
    || text.includes("subsequen") || text.includes("next chunk") || text.includes("remaining"));
  const hasLength = text.includes("length") || text.includes("char") || text.includes("total") || text.includes("size");

  const dimensions = [
    { name: "truncation_detected", weight: 0.3, passed: hasTruncation },
    { name: "concrete_next_step", weight: 0.4, passed: hasConcreteNextStep },
    { name: "length_reported", weight: 0.3, passed: hasLength },
  ];

  const passedSubchecks = dimensions.filter(d => d.passed).map(d => d.name);
  const score = dimensions.reduce((sum, d) => sum + (d.passed ? d.weight : 0), 0);
  // Tightened: must have BOTH truncation mention AND concrete next step
  const pass = hasTruncation && hasConcreteNextStep;
  const failedNames = dimensions.filter(d => !d.passed).map(d => d.name);

  return {
    pass,
    reason: failedNames.length === 0
      ? `truncation: all dimensions passed (score ${score.toFixed(2)})`
      : `truncation: passed [${passedSubchecks.join(", ")}], missed [${failedNames.join(", ")}] (score ${score.toFixed(2)})`,
    score,
    passedSubchecks,
  };
}

function checkFetchRobotsDisallow(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();
  const hasRobots = text.includes("robots") || text.includes("disallow") || text.includes("blocked") || text.includes("forbidden") || text.includes("not allowed");
  const hasError = text.includes("error") || text.includes("fail") || text.includes("could not") || text.includes("unable");
  const hasExplain = text.includes("google") || text.includes("search") || text.includes("crawl") || text.includes("policy");
  if (!hasRobots && !hasError) {
    return { pass: false, reason: "robots-disallow: response does not mention robots.txt or fetch error" };
  }
  return { pass: true, reason: `robots-disallow: agent reported${hasRobots ? " robots.txt block" : " fetch error"}${hasExplain ? " and explained" : ""}` };
}

function checkFetchPageSimplification(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();
  const hasFirstAttempt = text.includes("nonexistent") || text.includes("first") || text.includes("error") || text.includes("404") || text.includes("fail") || text.includes("not found");
  const hasAlternative = text.includes("example.com") || text.includes("alternative") || text.includes("instead") || text.includes("homepage") || text.includes("main page");
  const hasDifference = text.includes("differ") || text.includes("compar") || text.includes("contrast") || text.includes("vs") || text.includes("whereas") || text.includes("while") || text.includes("but");
  // Tightened: must include actual simplified content or key points from the fetched page
  const hasSimplifiedContent = text.includes("example") && (text.includes("domain") || text.includes("iana") || text.includes("reserved")
    || text.includes("test") || text.includes("placeholder") || text.includes("documentat") || text.includes("registrat"))
    || text.includes("simplified") || text.includes("key point") || text.includes("main point");

  const dimensions = [
    { name: "first_attempt_handled", weight: 0.2, passed: hasFirstAttempt },
    { name: "alternative_fetched", weight: 0.3, passed: hasAlternative },
    { name: "simplified_content_shown", weight: 0.3, passed: hasSimplifiedContent },
    { name: "difference_reported", weight: 0.2, passed: hasDifference },
  ];

  const passedSubchecks = dimensions.filter(d => d.passed).map(d => d.name);
  const score = dimensions.reduce((sum, d) => sum + (d.passed ? d.weight : 0), 0);
  // Tightened: raised threshold from 0.5 to 0.85
  const pass = score >= 0.85;
  const failedNames = dimensions.filter(d => !d.passed).map(d => d.name);

  return {
    pass,
    reason: failedNames.length === 0
      ? `page-simplification: all dimensions passed (score ${score.toFixed(2)})`
      : `page-simplification: passed [${passedSubchecks.join(", ")}], missed [${failedNames.join(", ")}] (score ${score.toFixed(2)})`,
    score,
    passedSubchecks,
  };
}

// ─── Round 5 Hard Checkers ────────────────────────────────────────────────────

function checkFetchRedirectChain(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();
  const hasRedirect = text.includes("redirect") || text.includes("302") || text.includes("301") || text.includes("303");
  const hasFollowed = text.includes("follow") || text.includes("final") || text.includes("destination")
    || text.includes("landed") || text.includes("end") || text.includes("after redirect");
  const hasContent = text.includes("httpbin") || text.includes("content") || text.includes("page")
    || text.includes("response") || text.includes("html");
  const hasMultiple = text.includes("twice") || text.includes("2 redirect") || text.includes("chain")
    || text.includes("first") || text.includes("second");

  const dimensions = [
    { name: "redirect_detected", weight: 0.25, passed: hasRedirect },
    { name: "redirects_followed", weight: 0.3, passed: hasFollowed || hasMultiple },
    { name: "final_content_shown", weight: 0.3, passed: hasContent },
    { name: "chain_described", weight: 0.15, passed: hasMultiple || hasRedirect },
  ];

  const passedSubchecks = dimensions.filter(d => d.passed).map(d => d.name);
  const score = dimensions.reduce((sum, d) => sum + (d.passed ? d.weight : 0), 0);
  const pass = score >= 0.6;
  const failedNames = dimensions.filter(d => !d.passed).map(d => d.name);

  return {
    pass,
    reason: failedNames.length === 0
      ? `redirect-chain: all dimensions passed (score ${score.toFixed(2)})`
      : `redirect-chain: passed [${passedSubchecks.join(", ")}], missed [${failedNames.join(", ")}] (score ${score.toFixed(2)})`,
    score,
    passedSubchecks,
  };
}

function checkFetchComparePages(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();
  const hasFirst = text.includes("example.com") || text.includes("first") || text.includes("iana");
  const hasSecond = text.includes("example.org") || text.includes("second") || text.includes(".org");
  const hasCompare = text.includes("differ") || text.includes("same") || text.includes("compar")
    || text.includes("similar") || text.includes("both") || text.includes("whereas")
    || text.includes("while") || text.includes("contrast");
  const hasContent = text.includes("domain") || text.includes("reserved") || text.includes("iana")
    || text.includes("internet") || text.includes("example");

  const dimensions = [
    { name: "both_fetched", weight: 0.3, passed: hasFirst && hasSecond },
    { name: "content_shown", weight: 0.25, passed: hasContent },
    { name: "comparison_made", weight: 0.35, passed: hasCompare },
    { name: "specific_details", weight: 0.1, passed: hasContent && hasCompare },
  ];

  const passedSubchecks = dimensions.filter(d => d.passed).map(d => d.name);
  const score = dimensions.reduce((sum, d) => sum + (d.passed ? d.weight : 0), 0);
  const pass = score >= 0.6;
  const failedNames = dimensions.filter(d => !d.passed).map(d => d.name);

  return {
    pass,
    reason: failedNames.length === 0
      ? `compare-pages: all dimensions passed (score ${score.toFixed(2)})`
      : `compare-pages: passed [${passedSubchecks.join(", ")}], missed [${failedNames.join(", ")}] (score ${score.toFixed(2)})`,
    score,
    passedSubchecks,
  };
}

function checkFetchErrorRetry(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();
  const has500 = text.includes("500") || text.includes("server error") || text.includes("internal server");
  const hasError = text.includes("error") || text.includes("fail") || text.includes("httpbin");
  const hasRetry = text.includes("retry") || text.includes("again") || text.includes("second attempt")
    || text.includes("re-attempt") || text.includes("try once more");
  const hasExplain = text.includes("server") || text.includes("upstream") || text.includes("backend")
    || text.includes("overload") || text.includes("temporary") || text.includes("explain");

  const dimensions = [
    { name: "error_detected", weight: 0.25, passed: has500 || hasError },
    { name: "error_explained", weight: 0.25, passed: hasExplain || has500 },
    { name: "retry_attempted", weight: 0.25, passed: hasRetry },
    { name: "outcome_reported", weight: 0.25, passed: hasError || hasRetry },
  ];

  const passedSubchecks = dimensions.filter(d => d.passed).map(d => d.name);
  const score = dimensions.reduce((sum, d) => sum + (d.passed ? d.weight : 0), 0);
  const pass = score >= 0.6;
  const failedNames = dimensions.filter(d => !d.passed).map(d => d.name);

  return {
    pass,
    reason: failedNames.length === 0
      ? `error-retry: all dimensions passed (score ${score.toFixed(2)})`
      : `error-retry: passed [${passedSubchecks.join(", ")}], missed [${failedNames.join(", ")}] (score ${score.toFixed(2)})`,
    score,
    passedSubchecks,
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  checkFetchBasicPage,
  checkFetch404Handling,
  checkFetchTruncation,
  checkFetchRobotsDisallow,
  checkFetchPageSimplification,
  checkFetchRedirectChain,
  checkFetchComparePages,
  checkFetchErrorRetry,
};
