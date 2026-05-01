import { describe, it, expect } from "vitest";
import {
  buildThreeSignalResult,
  enforceAntiCheat,
  type SignalScore,
  type ThreeSignalResult,
} from "./three-signal.js";

describe("A.2.1 · ThreeSignalChecker types and buildThreeSignalResult", () => {
  it("aggregates weighted signals into composite score", () => {
    const result = buildThreeSignalResult("test-task", [
      { name: "toolCall", weight: 0.4, score: 0.8 },
      { name: "taskCompletion", weight: 0.4, score: 0.5 },
      { name: "processQuality", weight: 0.2, score: 1.0 },
    ]);
    // 0.4*0.8 + 0.4*0.5 + 0.2*1.0 = 0.32 + 0.20 + 0.20 = 0.72
    expect(result.score).toBeCloseTo(0.72);
    expect(result.pass).toBe(true); // >= 0.6
  });

  it("returns pass false when score is below threshold", () => {
    const result = buildThreeSignalResult("low-score-task", [
      { name: "toolCall", weight: 0.4, score: 0.0 },
      { name: "taskCompletion", weight: 0.4, score: 0.3 },
      { name: "processQuality", weight: 0.2, score: 0.5 },
    ]);
    // 0.4*0.0 + 0.4*0.3 + 0.2*0.5 = 0 + 0.12 + 0.10 = 0.22
    expect(result.score).toBeCloseTo(0.22);
    expect(result.pass).toBe(false); // < 0.6
  });

  it("scores exactly at threshold as pass", () => {
    const result = buildThreeSignalResult("threshold-task", [
      { name: "toolCall", weight: 0.5, score: 0.6 },
      { name: "taskCompletion", weight: 0.5, score: 0.6 },
    ]);
    expect(result.score).toBeCloseTo(0.6);
    expect(result.pass).toBe(true); // >= 0.6
  });

  it("produces a human-readable reason with breakdown", () => {
    const result = buildThreeSignalResult("reason-test", [
      { name: "toolCall", weight: 0.4, score: 1.0 },
      { name: "taskCompletion", weight: 0.4, score: 0.0 },
      { name: "processQuality", weight: 0.2, score: 0.5 },
    ]);
    expect(result.reason).toContain("reason-test");
    expect(result.reason).toContain("toolCall");
    expect(result.reason).toContain("taskCompletion");
  });

  it("supports custom pass threshold", () => {
    const result = buildThreeSignalResult("custom-threshold", [
      { name: "toolCall", weight: 0.5, score: 0.6 },
      { name: "taskCompletion", weight: 0.5, score: 0.6 },
    ], { passThreshold: 0.7 });
    expect(result.score).toBeCloseTo(0.6);
    expect(result.pass).toBe(false); // < 0.7 custom threshold
  });

  it("preserves signal details including optional reason", () => {
    const signals: SignalScore[] = [
      { name: "toolCall", weight: 0.4, score: 0.8, reason: "Correct tool, partial params" },
      { name: "taskCompletion", weight: 0.4, score: 1.0 },
      { name: "processQuality", weight: 0.2, score: 0.9, reason: "1 redundant call" },
    ];
    const result = buildThreeSignalResult("detail-test", signals);
    expect(result.signals).toEqual(signals);
  });

  it("is backward-compatible with CheckerResult (pass, reason, score, passedSubchecks)", () => {
    const result = buildThreeSignalResult("compat-test", [
      { name: "toolCall", weight: 0.4, score: 1.0 },
      { name: "taskCompletion", weight: 0.4, score: 1.0 },
      { name: "processQuality", weight: 0.2, score: 1.0 },
    ]);
    // Must have all CheckerResult fields
    expect(typeof result.pass).toBe("boolean");
    expect(typeof result.reason).toBe("string");
    expect(typeof result.score).toBe("number");
    expect(Array.isArray(result.passedSubchecks)).toBe(true);
  });

  it("builds passedSubchecks from signals that meet a minimum score", () => {
    const result = buildThreeSignalResult("subcheck-test", [
      { name: "toolCall", weight: 0.4, score: 1.0 },
      { name: "taskCompletion", weight: 0.4, score: 0.3 },
      { name: "processQuality", weight: 0.2, score: 0.7 },
    ]);
    // Signals with score >= 0.6 count as passed
    expect(result.passedSubchecks).toContain("toolCall");
    expect(result.passedSubchecks).toContain("processQuality");
    expect(result.passedSubchecks).not.toContain("taskCompletion");
  });

  it("handles empty signals array", () => {
    const result = buildThreeSignalResult("empty-signals", []);
    expect(result.score).toBe(0);
    expect(result.pass).toBe(false);
  });

  it("produces a signalBreakdown string", () => {
    const result = buildThreeSignalResult("breakdown-test", [
      { name: "toolCall", weight: 0.4, score: 0.8 },
      { name: "taskCompletion", weight: 0.4, score: 0.5 },
      { name: "processQuality", weight: 0.2, score: 1.0 },
    ]);
    expect(result.signalBreakdown).toBeDefined();
    expect(result.signalBreakdown).toContain("toolCall");
    expect(result.signalBreakdown).toContain("taskCompletion");
    expect(result.signalBreakdown).toContain("processQuality");
    expect(result.signalBreakdown).toContain("Score");
  });
});

describe("A.2.4 · enforceAntiCheat", () => {
  it("overrides passing score to fail when zero tool calls", () => {
    const inner = buildThreeSignalResult("cheat-task", [
      { name: "toolCall", weight: 0.4, score: 0.0 },
      { name: "taskCompletion", weight: 0.4, score: 0.9 },
      { name: "processQuality", weight: 0.2, score: 0.8 },
    ]);
    const result = enforceAntiCheat(inner, 0);
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reason).toContain("Zero tool calls");
  });

  it("preserves original signal scores for analysis", () => {
    const inner = buildThreeSignalResult("preserve-signals", [
      { name: "toolCall", weight: 0.4, score: 0.0 },
      { name: "taskCompletion", weight: 0.4, score: 0.9 },
    ]);
    const result = enforceAntiCheat(inner, 0);
    // Signal scores still reported despite fail override
    expect(result.signals.length).toBe(2);
    expect(result.signals[1].score).toBe(0.9);
  });

  it("does not override when tool calls present", () => {
    const inner = buildThreeSignalResult("legit-task", [
      { name: "toolCall", weight: 0.4, score: 0.8 },
      { name: "taskCompletion", weight: 0.4, score: 0.9 },
      { name: "processQuality", weight: 0.2, score: 0.7 },
    ]);
    const result = enforceAntiCheat(inner, 3);
    expect(result.pass).toBe(true);
    expect(result.score).toBeCloseTo(0.82);
  });

  it("adds warning for suspiciously low tool call count", () => {
    const inner = buildThreeSignalResult("suspicious-task", [
      { name: "toolCall", weight: 0.4, score: 1.0 },
      { name: "taskCompletion", weight: 0.4, score: 1.0 },
      { name: "processQuality", weight: 0.2, score: 1.0 },
    ]);
    const result = enforceAntiCheat(inner, 1);
    // Should not fail (score is high), but should contain a warning
    expect(result.pass).toBe(true);
    expect(result.reason).toContain("warning");
    expect(result.reason).toContain("low tool-call");
  });

  it("excludes informational calls from count", () => {
    // This tests the informationalCalls parameter
    const inner = buildThreeSignalResult("info-calls", [
      { name: "toolCall", weight: 0.4, score: 0.8 },
      { name: "taskCompletion", weight: 0.4, score: 0.9 },
    ]);
    // 3 total calls, but 2 are informational (list_tools, list_allowed_directories)
    // So substantive = 1 → should get warning
    const result = enforceAntiCheat(inner, 3, { informationalCalls: 2 });
    expect(result.reason).toContain("warning");
  });
});
