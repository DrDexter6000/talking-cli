import { describe, it, expect } from "vitest";
import { scoreTaskCompletion, scoreProcessQuality } from "./task-quality-signals.js";

describe("A.2.3 · scoreTaskCompletion", () => {
  it("scores 1.0 when all criteria met", () => {
    const text = "The quarterly revenue report has been generated with all data from Q1.";
    const result = scoreTaskCompletion(text, ["quarterly", "revenue", "Q1"]);
    expect(result.score).toBe(1.0);
  });

  it("scores 0.0 when no criteria met", () => {
    const text = "I couldn't find the file you were looking for.";
    const result = scoreTaskCompletion(text, ["quarterly", "revenue"]);
    expect(result.score).toBe(0.0);
  });

  it("scores 0.5 when half criteria met", () => {
    const text = "The quarterly report is done but I couldn't find revenue data.";
    const result = scoreTaskCompletion(text, ["quarterly", "revenue", "summary"]);
    // 1/3 met — rounds to nearest tier (0, 0.5, 1.0)
    expect(result.score).toBe(0.5);
  });

  it("is case-insensitive", () => {
    const text = "QUARTERLY REVENUE REPORT";
    const result = scoreTaskCompletion(text, ["quarterly", "revenue"]);
    expect(result.score).toBe(1.0);
  });

  it("handles empty criteria list", () => {
    const result = scoreTaskCompletion("some text", []);
    expect(result.score).toBe(1.0); // nothing to check = all passed
  });

  it("handles empty text", () => {
    const result = scoreTaskCompletion("", ["revenue"]);
    expect(result.score).toBe(0.0);
  });

  it("provides reason with met/unmet criteria", () => {
    const result = scoreTaskCompletion("quarterly data found", ["quarterly", "revenue"]);
    expect(result.reason).toContain("quarterly");
  });
});

describe("A.2.3 · scoreProcessQuality", () => {
  it("scores high for optimal execution", () => {
    const result = scoreProcessQuality({
      turns: 2,
      optimalTurns: 2,
      errors: 0,
      recoveries: 0,
      redundantCalls: 0,
    });
    expect(result.score).toBeGreaterThanOrEqual(0.9);
  });

  it("does not penalize error recovery — recovery is positive", () => {
    const happyPath = scoreProcessQuality({
      turns: 2,
      optimalTurns: 2,
      errors: 0,
      recoveries: 0,
      redundantCalls: 0,
    });
    const recoveryPath = scoreProcessQuality({
      turns: 4,
      optimalTurns: 2,
      errors: 1,
      recoveries: 1,
      redundantCalls: 0,
    });
    // Recovery should NOT tank the score — it's a positive signal
    expect(recoveryPath.score).toBeGreaterThanOrEqual(happyPath.score * 0.8);
  });

  it("penalizes redundant calls", () => {
    const noRedundancy = scoreProcessQuality({
      turns: 3,
      optimalTurns: 3,
      errors: 0,
      recoveries: 0,
      redundantCalls: 0,
    });
    const withRedundancy = scoreProcessQuality({
      turns: 5,
      optimalTurns: 3,
      errors: 0,
      recoveries: 0,
      redundantCalls: 2,
    });
    expect(withRedundancy.score).toBeLessThan(noRedundancy.score);
  });

  it("penalizes excessive turns", () => {
    const optimal = scoreProcessQuality({
      turns: 2,
      optimalTurns: 2,
      errors: 0,
      recoveries: 0,
      redundantCalls: 0,
    });
    const excessive = scoreProcessQuality({
      turns: 10,
      optimalTurns: 2,
      errors: 0,
      recoveries: 0,
      redundantCalls: 0,
    });
    expect(excessive.score).toBeLessThan(optimal.score);
  });

  it("provides reason with breakdown", () => {
    const result = scoreProcessQuality({
      turns: 3,
      optimalTurns: 2,
      errors: 1,
      recoveries: 1,
      redundantCalls: 0,
    });
    expect(result.reason).toContain("3/2");
    expect(result.reason).toContain("1/1");
  });

  it("handles missing optimalTurns gracefully", () => {
    const result = scoreProcessQuality({
      turns: 3,
      errors: 0,
      recoveries: 0,
      redundantCalls: 0,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});
