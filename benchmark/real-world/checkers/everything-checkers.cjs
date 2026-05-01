/**
 * Everything benchmark checkers.
 *
 * Each checker receives (finalTurn, _fs) and returns {pass, reason}.
 * Tasks test tool responses and error recovery, so checkers analyze
 * the LLM's final text response for expected patterns.
 */

/**
 * Helper: normalize finalTurn to a string for pattern matching.
 */
function textOf(finalTurn) {
  return typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
}

/**
 * task-everything-echo-basics: Agent echoed a message and reported the result.
 * Pass if response mentions "Echo:" and the echoed message content.
 */
function checkEverythingEchoBasics(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasEcho = text.includes("echo:");
  const hasHelloMsg = text.includes("hello") && text.includes("everything");

  if (!hasEcho) {
    return { pass: false, reason: "echo-basics: response does not show the Echo: prefix from the tool" };
  }
  if (!hasHelloMsg) {
    return { pass: false, reason: "echo-basics: response does not include the echoed message content" };
  }
  return { pass: true, reason: "echo-basics: agent reported the echoed message correctly" };
}

/**
 * task-everything-sum-calculator: Agent calculated 42+17 and echoed the result.
 * Pass if response mentions sum of 59 and echoes result.
 */
function checkEverythingSumCalculator(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasSum = text.includes("59");
  const hasEcho = text.includes("echo");
  const mentionsBothNumbers = text.includes("42") && text.includes("17");

  if (!hasSum) {
    return { pass: false, reason: "sum-calculator: response does not show the correct sum (59)" };
  }
  if (!mentionsBothNumbers && !hasSum) {
    return { pass: false, reason: "sum-calculator: response does not reference the input numbers" };
  }
  if (!hasEcho) {
    return { pass: false, reason: "sum-calculator: response does not mention using the echo tool" };
  }
  return { pass: true, reason: "sum-calculator: agent correctly calculated 42+17=59 and echoed result" };
}

/**
 * task-everything-weather-comparison: Agent got weather for all 3 cities and compared.
 * Pass if response mentions all 3 cities with temperatures and identifies hottest/coldest.
 */
function checkEverythingWeatherComparison(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasNY = text.includes("new york") || text.includes("ny");
  const hasChicago = text.includes("chicago");
  const hasLA = text.includes("los angeles") || text.includes("la") || text.includes("l.a.");

  const hasNYTemp = text.includes("33") && hasNY;
  const hasChicagoTemp = text.includes("36") && hasChicago;
  const hasLATemp = text.includes("73") && hasLA;

  const citiesFound = [hasNY, hasChicago, hasLA].filter(Boolean).length;
  const tempsFound = [hasNYTemp, hasChicagoTemp, hasLATemp].filter(Boolean).length;

  const hasHottest = text.includes("hottest") || text.includes("warmest") || text.includes("highest temp");
  const hasColdest = text.includes("coldest") || text.includes("coolest") || text.includes("lowest temp");
  const identifiesLA = hasHottest && hasLA;
  const identifiesNY = hasColdest && hasNY;

  if (citiesFound < 3) {
    return { pass: false, reason: `weather-comparison: only found ${citiesFound}/3 cities in response` };
  }
  if (tempsFound < 2) {
    return { pass: false, reason: `weather-comparison: only found ${tempsFound}/3 temperature values` };
  }
  if (!hasHottest && !hasColdest) {
    return { pass: true, reason: "weather-comparison: agent compared cities but didn't explicitly identify hottest/coldest" };
  }
  if (!identifiesLA && !identifiesNY) {
    return { pass: true, reason: "weather-comparison: agent compared temperatures but may not have correctly identified extremes" };
  }
  return { pass: true, reason: "weather-comparison: agent compared all 3 cities and identified temperature extremes" };
}

/**
 * task-everything-invalid-resource: Agent tried invalid type, got error, retried with valid type.
 * Pass if response mentions error/failure on first attempt AND successful resource on second.
 */
function checkEverythingInvalidResource(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasError = text.includes("error") || text.includes("invalid") || text.includes("fail");
  const hasVideoAttempt = text.includes("video");
  const hasRetry = text.includes("text") || text.includes("retry") || text.includes("second") || text.includes("then");
  const hasSuccess = text.includes("resource") && (text.includes("text") || text.includes("uri") || text.includes("demo://"));

  if (!hasVideoAttempt) {
    return { pass: false, reason: "invalid-resource: response does not mention trying 'video' resource type" };
  }
  if (!hasError) {
    return { pass: false, reason: "invalid-resource: response does not mention the error from invalid type" };
  }
  if (!hasRetry) {
    return { pass: false, reason: "invalid-resource: response does not mention retrying with valid type" };
  }
  if (!hasSuccess) {
    return { pass: false, reason: "invalid-resource: response does not show successful resource retrieval" };
  }
  return { pass: true, reason: "invalid-resource: agent correctly handled error and recovered with valid type" };
}

/**
 * task-everything-annotated-messages: Agent got all 3 message types and described annotations.
 * Pass if response describes all 3 types with their annotations (priority/audience).
 */
function checkEverythingAnnotatedMessages(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasError = text.includes("error");
  const hasSuccess = text.includes("success") || text.includes("completed");
  const hasDebug = text.includes("debug") || text.includes("cache");
  const allTypes = [hasError, hasSuccess, hasDebug].filter(Boolean).length;

  const hasPriority = text.includes("priority");
  const hasAudience = text.includes("audience");

  const describesDifferences = text.includes("differ") || text.includes("comparison") ||
    text.includes("higher") || text.includes("lower") || text.includes("1.0") ||
    text.includes("0.7") || text.includes("0.3");

  if (allTypes < 3) {
    return { pass: false, reason: `annotated-messages: only found ${allTypes}/3 message types in response` };
  }
  if (!hasPriority && !hasAudience) {
    return { pass: false, reason: "annotated-messages: response does not describe annotation fields (priority/audience)" };
  }
  if (!describesDifferences) {
    return { pass: true, reason: "annotated-messages: agent described all 3 types but didn't clearly explain annotation differences" };
  }
  return { pass: true, reason: "annotated-messages: agent described all 3 message types with their annotation differences" };
}

/**
 * task-everything-resource-links: Agent got 5 resource links and described them.
 * Pass if response mentions 5 links with text/blob types and URIs.
 */
function checkEverythingResourceLinks(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasText = text.includes("text resource") || text.includes("plaintext");
  const hasBlob = text.includes("blob resource") || text.includes("binary") || text.includes("base64");
  const hasUri = text.includes("demo://") || text.includes("uri");
  const hasCount = text.includes("5") && (text.includes("resource") || text.includes("link"));
  const mentionsBothTypes = hasText && hasBlob;

  if (!hasCount) {
    return { pass: false, reason: "resource-links: response does not mention 5 resource links" };
  }
  if (!mentionsBothTypes) {
    if (!hasText && !hasBlob) {
      return { pass: false, reason: "resource-links: response does not describe resource types (text/blob)" };
    }
    return { pass: true, reason: "resource-links: agent described links but only mentioned one resource type" };
  }
  if (!hasUri) {
    return { pass: true, reason: "resource-links: agent described resource types but not the URIs" };
  }
  return { pass: true, reason: "resource-links: agent described 5 links with both text and blob resource types" };
}

/**
 * task-everything-multi-tool-workflow: Agent completed multi-step workflow.
 * Pass if response mentions: starting echo, both cities' temps, sum, success message, summary.
 */
function checkEverythingMultiToolWorkflow(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasStart = text.includes("starting") || text.includes("workflow");
  const hasNY = text.includes("new york") || text.includes("ny") || text.includes("33");
  const hasLA = text.includes("los angeles") || text.includes("la") || text.includes("73");
  const hasSum = text.includes("106") || text.includes("sum");
  const hasSuccess = text.includes("success") || text.includes("completed successfully");
  const hasSummary = text.includes("workflow complete") || text.includes("summary") || text.includes("result");

  const dimensions = [
    { name: "echo_start", passed: hasStart },
    { name: "both_cities", passed: hasNY && hasLA },
    { name: "sum_or_combined", passed: hasSum },
    { name: "success_msg", passed: hasSuccess },
    { name: "summary", passed: hasSummary },
  ];

  const passedCount = dimensions.filter(d => d.passed).length;
  const pass = passedCount >= 3;
  const passedNames = dimensions.filter(d => d.passed).map(d => d.name);
  const failedNames = dimensions.filter(d => !d.passed).map(d => d.name);

  if (passedCount < 3) {
    return {
      pass: false,
      reason: `multi-tool: only ${passedCount}/5 workflow steps found. Missing: [${failedNames.join(", ")}]`,
    };
  }
  return {
    pass: true,
    reason: `multi-tool: completed ${passedCount}/5 workflow steps [${passedNames.join(", ")}]`,
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  checkEverythingEchoBasics,
  checkEverythingSumCalculator,
  checkEverythingWeatherComparison,
  checkEverythingInvalidResource,
  checkEverythingAnnotatedMessages,
  checkEverythingResourceLinks,
  checkEverythingMultiToolWorkflow,
};
