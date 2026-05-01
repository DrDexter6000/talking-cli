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

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  checkFetchBasicPage,
  checkFetch404Handling,
  checkFetchTruncation,
  checkFetchRobotsDisallow,
  checkFetchPageSimplification,
};
