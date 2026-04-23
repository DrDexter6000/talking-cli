import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { computeStats } from "./runner/stats.ts";

describe("Phase 1 Task 1.4 · Stats + summary emission", () => {
  it("produces correct stats from a fixture raw.jsonl", () => {
    const fixtureDir = resolve(__dirname, "fixtures", "stats-basic");

    const summary = computeStats(fixtureDir);

    // Fixture has 4 paired tasks:
    //   task-a: mute=FAIL, talking=PASS  (talking wins)
    //   task-b: mute=PASS, talking=PASS  (tie)
    //   task-c: mute=FAIL, talking=PASS  (talking wins)
    //   task-d: mute=PASS, talking=FAIL  (mute wins)
    //
    // Sign test: 2 talking wins, 1 mute win, 1 tie → n=3 (ties excluded), k=2
    // p-value (two-tailed, n=3, k=2) = 2 * C(3,2) * 0.5^3 + ... = 2*(3/8 + 1/8) = 1.0
    // (Small n, so p-value is high — that's correct statistically)

    expect(summary.perTask.length).toBe(4);
    expect(summary.perTask[0].taskId).toBe("task-a");
    expect(summary.perTask[0].mute.pass).toBe(false);
    expect(summary.perTask[0].talking.pass).toBe(true);
    expect(summary.perTask[0].delta).toBe("talking_win");

    expect(summary.perTask[1].delta).toBe("tie");
    expect(summary.perTask[2].delta).toBe("talking_win");
    expect(summary.perTask[3].delta).toBe("mute_win");

    // Aggregate
    expect(summary.aggregate.talkingWins).toBe(2);
    expect(summary.aggregate.muteWins).toBe(1);
    expect(summary.aggregate.ties).toBe(1);
    expect(summary.aggregate.signTestN).toBe(3); // excluding ties
    expect(typeof summary.aggregate.signTestPValue).toBe("number");
    expect(summary.aggregate.signTestPValue).toBeGreaterThanOrEqual(0);
    expect(summary.aggregate.signTestPValue).toBeLessThanOrEqual(1);

    // Per-task token deltas
    for (const row of summary.perTask) {
      expect(row.mute.inputTokens).toBeGreaterThanOrEqual(0);
      expect(row.talking.inputTokens).toBeGreaterThanOrEqual(0);
    }
  });

  it("handles all-tie pairs edge case", () => {
    const fixtureDir = resolve(__dirname, "fixtures", "stats-all-tie");
    const summary = computeStats(fixtureDir);

    expect(summary.aggregate.talkingWins).toBe(0);
    expect(summary.aggregate.muteWins).toBe(0);
    expect(summary.aggregate.ties).toBe(3);
    expect(summary.aggregate.signTestN).toBe(0);
  });

  it("handles all-win pairs edge case", () => {
    const fixtureDir = resolve(__dirname, "fixtures", "stats-all-win");
    const summary = computeStats(fixtureDir);

    expect(summary.aggregate.talkingWins).toBe(3);
    expect(summary.aggregate.muteWins).toBe(0);
    expect(summary.aggregate.ties).toBe(0);
    expect(summary.aggregate.signTestN).toBe(3);
    // 3/3, p = 2 * 0.5^3 = 0.25
    expect(summary.aggregate.signTestPValue).toBeCloseTo(0.25, 4);
  });

  it("handles all-fail pairs edge case", () => {
    const fixtureDir = resolve(__dirname, "fixtures", "stats-all-fail");
    const summary = computeStats(fixtureDir);

    expect(summary.aggregate.talkingWins).toBe(0);
    expect(summary.aggregate.muteWins).toBe(0);
    expect(summary.aggregate.ties).toBe(3);
  });
});
