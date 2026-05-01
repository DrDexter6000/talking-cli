import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

interface TaskJson {
  id: string;
  tier?: string;
  hint_trigger?: string;
}

const VALID_TIERS = new Set(["easy", "medium", "hard"]);
const VALID_TRIGGERS = new Set(["empty", "permission", "schema", "none"]);

const TASKS_DIR = join(import.meta.dirname, "tasks");

function loadTasks(): TaskJson[] {
  const files = readdirSync(TASKS_DIR).filter((f) => f.endsWith(".json"));
  return files.map((f) => {
    const raw = readFileSync(join(TASKS_DIR, f), "utf-8");
    return JSON.parse(raw) as TaskJson;
  });
}

describe("corpus matrix distribution", () => {
  const tasks = loadTasks();
  const matrixTasks = tasks.filter((t) => t.hint_trigger && t.hint_trigger !== "none");

  it("loads exactly 30 tasks", () => {
    expect(tasks.length).toBe(30);
  });

  it("every task has a valid tier", () => {
    for (const t of tasks) {
      expect(VALID_TIERS.has(t.tier ?? ""), `tier=${t.tier} for ${t.id}`).toBe(true);
    }
  });

  it("every task has a valid hint_trigger", () => {
    for (const t of tasks) {
      expect(
        VALID_TRIGGERS.has(t.hint_trigger ?? ""),
        `hint_trigger=${t.hint_trigger} for ${t.id}`,
      ).toBe(true);
    }
  });

  it("has 3×3 matrix tasks (excluding trigger=none)", () => {
    expect(matrixTasks.length).toBe(30);
  });

  const triggers = ["empty", "permission", "schema"] as const;
  const tiers = ["easy", "medium", "hard"] as const;
  const expected: Record<string, Record<string, number>> = {
    empty: { easy: 3, medium: 5, hard: 2 },
    permission: { easy: 3, medium: 5, hard: 2 },
    schema: { easy: 3, medium: 5, hard: 2 },
  };

  for (const trigger of triggers) {
    for (const tier of tiers) {
      const want = expected[trigger][tier];
      it(`${trigger}/${tier} has ${want} tasks`, () => {
        const count = matrixTasks.filter(
          (t) => t.hint_trigger === trigger && t.tier === tier,
        ).length;
        expect(count).toBe(want);
      });
    }
  }

  it("each trigger row sums to 10", () => {
    for (const trigger of triggers) {
      const row = matrixTasks.filter((t) => t.hint_trigger === trigger);
      expect(row.length, `${trigger} row total`).toBe(10);
    }
  });

  it("each tier column sums to 9/15/6", () => {
    const colExpected: Record<string, number> = { easy: 9, medium: 15, hard: 6 };
    for (const tier of tiers) {
      const col = matrixTasks.filter((t) => t.tier === tier);
      expect(col.length, `${tier} column total`).toBe(colExpected[tier]);
    }
  });
});
