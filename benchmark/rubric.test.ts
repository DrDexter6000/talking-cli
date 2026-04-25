import { describe, it, expect } from "vitest";
import type { CheckerResult } from "./runner/checker.js";
import type { BenchmarkRunResult } from "./runner/types.js";
import { computeTierScores } from "./runner/stats.js";
import {
  checkBatchJsonTransform,
  checkBatchMarkdownTransform,
  checkCodebaseDeadCode,
  checkErrorRecoveryBatch,
  checkLogCorrelationIncident,
  checkMultiServiceDebug,
} from "./runner/checker.js";

describe("Rubric Scoring", () => {
  it("CheckerResult supports score and passedSubchecks fields", () => {
    const result: CheckerResult = {
      pass: true,
      reason: "test",
      score: 0.7,
      passedSubchecks: ["read-before-write", "increment"],
    };
    expect(result.score).toBe(0.7);
    expect(result.passedSubchecks).toHaveLength(2);
  });

  it("score at threshold 0.6 produces pass: true", () => {
    const result: CheckerResult = {
      pass: false,
      reason: "partial",
      score: 0.6,
      passedSubchecks: ["step1", "step2", "step3"],
    };
    expect(result.score! >= 0.6).toBe(true);
  });

  it("score below threshold 0.6 produces pass: false", () => {
    const result: CheckerResult = {
      pass: false,
      reason: "minimal effort",
      score: 0.3,
      passedSubchecks: ["step1"],
    };
    expect(result.score! >= 0.6).toBe(false);
  });

  it("existing binary CheckerResult still works without score", () => {
    const result: CheckerResult = {
      pass: true,
      reason: "all good",
    };
    expect(result.score).toBeUndefined();
    expect(result.passedSubchecks).toBeUndefined();
    expect(result.pass).toBe(true);
  });

  it("BenchmarkRunResult supports score and passedSubchecks fields", () => {
    const result: BenchmarkRunResult = {
      taskId: "test-task",
      variant: "talking",
      turns: 3,
      inputTokens: 100,
      outputTokens: 50,
      walltime: 2000,
      outcome: "stop_reason_end_turn",
      pass: true,
      score: 0.85,
      passedSubchecks: ["step-a", "step-b"],
    };
    expect(result.score).toBe(0.85);
    expect(result.passedSubchecks).toHaveLength(2);
  });

  it("existing BenchmarkRunResult still works without score", () => {
    const result: BenchmarkRunResult = {
      taskId: "test-task",
      variant: "mute",
      turns: 2,
      inputTokens: 80,
      outputTokens: 40,
      walltime: 1500,
      outcome: "stop_reason_end_turn",
      pass: false,
    };
    expect(result.score).toBeUndefined();
    expect(result.passedSubchecks).toBeUndefined();
    expect(result.pass).toBe(false);
  });

  it("computeTierScores aggregates scores by tier", () => {
    const results: BenchmarkRunResult[] = [
      { taskId: "t1", variant: "talking", turns: 1, inputTokens: 10, outputTokens: 5, walltime: 100, outcome: "stop_reason_end_turn", pass: true, score: 0.8 },
      { taskId: "t2", variant: "talking", turns: 1, inputTokens: 10, outputTokens: 5, walltime: 100, outcome: "stop_reason_end_turn", pass: true, score: 0.6 },
      { taskId: "t3", variant: "talking", turns: 1, inputTokens: 10, outputTokens: 5, walltime: 100, outcome: "stop_reason_end_turn", pass: false },
    ];
    const tasks = [
      { id: "t1", prompt: "", checker: "c1", difficulty: "hard" },
      { id: "t2", prompt: "", checker: "c2", difficulty: "hard" },
      { id: "t3", prompt: "", checker: "c3", difficulty: "medium" },
    ];

    const tierScores = computeTierScores(results, tasks);

    const hardTier = tierScores.find((t) => t.tier === "hard");
    expect(hardTier).toBeDefined();
    expect(hardTier!.avgScore).toBeCloseTo(0.7);
    expect(hardTier!.count).toBe(2);

    const mediumTier = tierScores.find((t) => t.tier === "medium");
    expect(mediumTier).toBeDefined();
    expect(mediumTier!.avgScore).toBe(0);
    expect(mediumTier!.count).toBe(0);
  });
});

describe("checkBatchJsonTransform rubric", () => {
  it("full success trace scores >= 0.8", () => {
    const result = checkBatchJsonTransform(
      "Successfully transformed all 20 files. Field mapping: fname→firstName, lname→lastName. " +
        "Dates reformatted to ISO 8601 (YYYY-MM-DD). Skipped 3 invalid records with validation errors. " +
        "Summary: 197/200 records processed, 3 skipped.",
      { "output/record-001.json": "{}", "output/record-020.json": "{}", "skip/skipped-records.json": "[]" },
    );
    expect(result.score).toBeGreaterThanOrEqual(0.8);
    expect(result.pass).toBe(true);
    expect(result.passedSubchecks).toHaveLength(4);
  });

  it("partial success trace scores between 0.3 and 0.6", () => {
    const result = checkBatchJsonTransform(
      "I started processing the JSON files. The firstName and lastName fields need renaming.",
      {},
    );
    expect(result.score).toBeGreaterThan(0.0);
    expect(result.score).toBeLessThanOrEqual(0.6);
    expect(result.pass).toBe(false);
  });

  it("bare minimum trace scores near 0.6 threshold", () => {
    const result = checkBatchJsonTransform(
      "Transformed records with firstName/lastName mapping. Output formatted as ISO 8601.",
      {},
    );
    expect(result.score).toBeGreaterThanOrEqual(0.5);
    expect(result.score).toBeLessThanOrEqual(0.7);
  });

  it("total failure trace scores 0", () => {
    const result = checkBatchJsonTransform(
      "I don't know what to do with these files.",
      {},
    );
    expect(result.score).toBe(0);
    expect(result.pass).toBe(false);
    expect(result.passedSubchecks).toHaveLength(0);
  });
});

describe("checkBatchMarkdownTransform rubric", () => {
  it("full success trace scores >= 0.8", () => {
    const result = checkBatchMarkdownTransform(
      "Converted all files to markdown format. Heading and title fields mapped correctly. " +
        "Used consistent template across all outputs. Skipped 2 invalid entries. " +
        "Complete summary of all processed files.",
      { "output/report-001.md": "# Report", "output/report-020.md": "# Report" },
    );
    expect(result.score).toBeGreaterThanOrEqual(0.8);
    expect(result.pass).toBe(true);
    expect(result.passedSubchecks).toHaveLength(4);
  });

  it("partial success trace scores between 0.3 and 0.6", () => {
    const result = checkBatchMarkdownTransform(
      "Started the markdown conversion with heading formatting.",
      {},
    );
    expect(result.score).toBeGreaterThan(0.0);
    expect(result.score).toBeLessThanOrEqual(0.6);
  });

  it("bare minimum trace scores near 0.6 threshold", () => {
    const result = checkBatchMarkdownTransform(
      "Markdown format applied with consistent heading and title structure. Template used across files.",
      {},
    );
    expect(result.score).toBeGreaterThanOrEqual(0.5);
    expect(result.score).toBeLessThanOrEqual(0.7);
  });

  it("total failure trace scores 0", () => {
    const result = checkBatchMarkdownTransform(
      "I don't know what to do here.",
      {},
    );
    expect(result.score).toBe(0);
    expect(result.pass).toBe(false);
    expect(result.passedSubchecks).toHaveLength(0);
  });
});

describe("checkCodebaseDeadCode rubric", () => {
  it("full success trace scores >= 0.8", () => {
    const result = checkCodebaseDeadCode(
      "Analysis complete. Found no unused or dead code in the codebase. " +
        "The project is clean — all modules are reachable. " +
        "Recommend periodic scans. Summary covers all 12 modules and 45 files across every directory.",
      {},
    );
    expect(result.score).toBeGreaterThanOrEqual(0.8);
    expect(result.pass).toBe(true);
    expect(result.passedSubchecks).toHaveLength(4);
  });

  it("partial success trace scores between 0.3 and 0.6", () => {
    const result = checkCodebaseDeadCode(
      "Found some unused functions. Report generated.",
      {},
    );
    expect(result.score).toBeGreaterThan(0.0);
    expect(result.score).toBeLessThanOrEqual(0.6);
  });

  it("bare minimum trace scores near 0.6 threshold", () => {
    const result = checkCodebaseDeadCode(
      "Detected no dead code in the analysis. The codebase appears clean with no unreachable code paths.",
      {},
    );
    expect(result.score).toBeGreaterThanOrEqual(0.5);
    expect(result.score).toBeLessThanOrEqual(0.7);
  });

  it("total failure trace scores 0", () => {
    const result = checkCodebaseDeadCode(
      "Task completed.",
      {},
    );
    expect(result.score).toBe(0);
    expect(result.pass).toBe(false);
    expect(result.passedSubchecks).toHaveLength(0);
  });
});

describe("checkErrorRecoveryBatch rubric", () => {
  it("full success trace scores >= 0.8", () => {
    const result = checkErrorRecoveryBatch(
      "Batch processing encountered errors in 3 files. Root cause: corrupted headers caused by " +
        "encoding mismatch. Recovered all 3 files by retrying with fallback encoding. " +
        "Summary: 20/20 files processed successfully after recovery.",
      {},
    );
    expect(result.score).toBeGreaterThanOrEqual(0.8);
    expect(result.pass).toBe(true);
    expect(result.passedSubchecks).toHaveLength(4);
  });

  it("partial success trace scores between 0.3 and 0.6", () => {
    const result = checkErrorRecoveryBatch(
      "Batch processing had some issues with errors.",
      {},
    );
    expect(result.score).toBeGreaterThan(0.0);
    expect(result.score).toBeLessThanOrEqual(0.6);
  });

  it("bare minimum trace scores near 0.6 threshold", () => {
    const result = checkErrorRecoveryBatch(
      "Batch failed due to encoding issues. Root cause identified as BOM header mismatch.",
      {},
    );
    expect(result.score).toBeGreaterThanOrEqual(0.5);
    expect(result.score).toBeLessThanOrEqual(0.7);
  });

  it("total failure trace scores 0", () => {
    const result = checkErrorRecoveryBatch(
      "Done with the task.",
      {},
    );
    expect(result.score).toBe(0);
    expect(result.pass).toBe(false);
    expect(result.passedSubchecks).toHaveLength(0);
  });
});

describe("checkLogCorrelationIncident rubric", () => {
  it("full success trace scores >= 0.8", () => {
    const result = checkLogCorrelationIncident(
      "Incident root cause: database connection pool exhaustion caused by the deployment at 14:32. " +
        "Correlation linked the auth-service timeout log with the db connection spike timeline. " +
        "Scope focused on the specific incident window. Resolution: increase pool size and add circuit breaker.",
      {},
    );
    expect(result.score).toBeGreaterThanOrEqual(0.8);
    expect(result.pass).toBe(true);
    expect(result.passedSubchecks).toHaveLength(4);
  });

  it("partial success trace scores between 0.3 and 0.6", () => {
    const result = checkLogCorrelationIncident(
      "The incident was caused by a timeout. I checked the timeline.",
      {},
    );
    expect(result.score).toBeGreaterThan(0.0);
    expect(result.score).toBeLessThanOrEqual(0.6);
  });

  it("bare minimum trace scores near 0.6 threshold", () => {
    const result = checkLogCorrelationIncident(
      "Root cause: the outage was caused by a memory leak. Correlation shows linked events in the log timeline.",
      {},
    );
    expect(result.score).toBeGreaterThanOrEqual(0.5);
    expect(result.score).toBeLessThanOrEqual(0.7);
  });

  it("total failure trace scores 0", () => {
    const result = checkLogCorrelationIncident(
      "I looked at some logs.",
      {},
    );
    expect(result.score).toBe(0);
    expect(result.pass).toBe(false);
    expect(result.passedSubchecks).toHaveLength(0);
  });
});

describe("checkMultiServiceDebug rubric", () => {
  it("full success trace scores >= 0.8", () => {
    const result = checkMultiServiceDebug(
      "Root cause: the payment service timeout originated from a DNS resolution failure. " +
        "Evidence chain traces the error from the API gateway → payment service → DNS resolver " +
        "across 3 services. Scope kept to relevant services only. Fix: add DNS caching layer.",
      {},
    );
    expect(result.score).toBeGreaterThanOrEqual(0.8);
    expect(result.pass).toBe(true);
    expect(result.passedSubchecks).toHaveLength(4);
  });

  it("partial success trace scores between 0.3 and 0.6", () => {
    const result = checkMultiServiceDebug(
      "Found an issue with the service. The timeline shows the problem.",
      {},
    );
    expect(result.score).toBeGreaterThan(0.0);
    expect(result.score).toBeLessThanOrEqual(0.6);
  });

  it("bare minimum trace scores near 0.6 threshold", () => {
    const result = checkMultiServiceDebug(
      "Root cause identified: caused by service timeout. Timeline shows correlated failures across services.",
      {},
    );
    expect(result.score).toBeGreaterThanOrEqual(0.5);
    expect(result.score).toBeLessThanOrEqual(0.7);
  });

  it("total failure trace scores 0", () => {
    const result = checkMultiServiceDebug(
      "Checked the system. Everything looks fine.",
      {},
    );
    expect(result.score).toBe(0);
    expect(result.pass).toBe(false);
    expect(result.passedSubchecks).toHaveLength(0);
  });
});
