import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { StandaloneExecutor } from "./runner/standalone-executor.js";
import { createProvider } from "./runner/providers.js";
import type { BenchmarkTask } from "./runner/types.js";

const BENCHMARK_DIR = resolve(import.meta.dirname || ".");
const TASKS_DIR = resolve(BENCHMARK_DIR, "tasks");

interface BenchmarkReport {
  timestamp: string;
  config: {
    model: string;
    maxTokens: number;
    timeout: string;
    totalTasks: number;
    easyTasks: number;
    hardTasks: number;
  };
  skillSizes: {
    bloated: { characters: number; approximateTokens: number };
    talking: { characters: number; approximateTokens: number };
    savings: { characters: number; percentage: string; tokens: number };
  };
  results: {
    bloated: {
      totalInputTokens: number;
      totalOutputTokens: number;
      totalTokens: number;
      passRate: number;
      wins: number;
      tasks: Array<{
        taskId: string;
        inputTokens: number;
        outputTokens: number;
        pass: boolean;
        timeMs: number;
      }>;
    };
    talking: {
      totalInputTokens: number;
      totalOutputTokens: number;
      totalTokens: number;
      passRate: number;
      wins: number;
      tasks: Array<{
        taskId: string;
        inputTokens: number;
        outputTokens: number;
        pass: boolean;
        timeMs: number;
      }>;
    };
  };
  comparison: {
    inputTokenSavings: number;
    inputTokenSavingsPercent: string;
    outputTokenSavings: number;
    outputTokenSavingsPercent: string;
    totalTokenSavings: number;
    totalTokenSavingsPercent: string;
    initialPromptSavings: number;
    initialPromptSavingsPercent: string;
    passRateDelta: number;
    talkingWins: number;
    bloatedWins: number;
    ties: number;
  };
  verdict: {
    result: string;
    reason: string;
  };
}

async function runStandardizedBenchmark() {
  const resultDir = resolve(BENCHMARK_DIR, "results", `benchmark-${new Date().toISOString().slice(0, 10)}-${Date.now()}`);
  mkdirSync(resultDir, { recursive: true });

  // Read selected tasks
  const selectedTasksFile = resolve(BENCHMARK_DIR, "selected-tasks.txt");
  const selectedTaskNames = readFileSync(selectedTasksFile, "utf-8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const tasks: BenchmarkTask[] = [];
  let easyCount = 0;
  let hardCount = 0;

  for (const taskName of selectedTaskNames) {
    const taskPath = resolve(TASKS_DIR, taskName);
    if (existsSync(taskPath)) {
      const raw = readFileSync(taskPath, "utf-8");
      const task = JSON.parse(raw) as BenchmarkTask;
      tasks.push(task);
      if (task.difficulty === "medium") easyCount++;
      else if (task.difficulty === "hard") hardCount++;
    }
  }

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║           TALKING CLI BENCHMARK - STANDARDIZED              ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");

  // Benchmark Introduction
  console.log("📋 BENCHMARK INTRODUCTION");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`Task Count:        ${tasks.length}`);
  console.log(`  - Easy (Medium): ${easyCount}`);
  console.log(`  - Hard:          ${hardCount}`);
  console.log(`Model:             ${process.env.DEEPSEEK_MODEL || "deepseek-chat"}`);
  console.log(`Max Output Tokens: 4096`);
  console.log(`Timeout:           300 seconds`);
  console.log(`Provider:          DeepSeek (OpenAI Compatible)`);
  console.log(`Endpoint:          https://api.deepseek.com`);
  console.log("");

  const provider = createProvider("deepseek");
  const executor = new StandaloneExecutor(provider);

  const bloatedTasks: BenchmarkReport["results"]["bloated"]["tasks"] = [];
  const talkingTasks: BenchmarkReport["results"]["talking"]["tasks"] = [];

  // Run BLOATED variant
  console.log("🔴 RUNNING BLOATED VARIANT");
  console.log("─────────────────────────────────────────────────────────────");
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    console.log(`[${i + 1}/${tasks.length}] ${task.id} (${task.difficulty})`);
    const start = Date.now();
    const result = await executor.runTask(task, "bloated", {
      outputDir: resolve(resultDir, "bloated"),
      disableMcp: true,
      turnTimeout: 300_000,
    });
    const elapsed = Date.now() - start;
    bloatedTasks.push({
      taskId: task.id,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      pass: result.pass,
      timeMs: elapsed,
    });
    console.log(`    Input: ${result.inputTokens} | Output: ${result.outputTokens} | Pass: ${result.pass} | Time: ${Math.round(elapsed / 1000)}s`);
  }
  console.log("");

  // Run TALKING variant
  console.log("🟢 RUNNING TALKING VARIANT");
  console.log("─────────────────────────────────────────────────────────────");
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    console.log(`[${i + 1}/${tasks.length}] ${task.id} (${task.difficulty})`);
    const start = Date.now();
    const result = await executor.runTask(task, "talking", {
      outputDir: resolve(resultDir, "talking"),
      disableMcp: true,
      turnTimeout: 300_000,
    });
    const elapsed = Date.now() - start;
    talkingTasks.push({
      taskId: task.id,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      pass: result.pass,
      timeMs: elapsed,
    });
    console.log(`    Input: ${result.inputTokens} | Output: ${result.outputTokens} | Pass: ${result.pass} | Time: ${Math.round(elapsed / 1000)}s`);
  }
  console.log("");

  // Calculate totals
  const bloatedTotalInput = bloatedTasks.reduce((sum, t) => sum + t.inputTokens, 0);
  const bloatedTotalOutput = bloatedTasks.reduce((sum, t) => sum + t.outputTokens, 0);
  const talkingTotalInput = talkingTasks.reduce((sum, t) => sum + t.inputTokens, 0);
  const talkingTotalOutput = talkingTasks.reduce((sum, t) => sum + t.outputTokens, 0);

  const bloatedPassCount = bloatedTasks.filter((t) => t.pass).length;
  const talkingPassCount = talkingTasks.filter((t) => t.pass).length;

  // Compare each task
  let talkingWins = 0;
  let bloatedWins = 0;
  let ties = 0;

  for (let i = 0; i < tasks.length; i++) {
    const bloatedPass = bloatedTasks[i].pass;
    const talkingPass = talkingTasks[i].pass;

    if (talkingPass && !bloatedPass) {
      talkingWins++;
    } else if (bloatedPass && !talkingPass) {
      bloatedWins++;
    } else {
      ties++;
    }
  }

  // Read SKILL.md sizes
  const bloatedSkill = readFileSync(resolve(BENCHMARK_DIR, "skills", "bloated-skill.md"), "utf-8");
  const talkingSkill = readFileSync(resolve(BENCHMARK_DIR, "skills", "talking-skill.md"), "utf-8");
  const bloatedSkillTokens = Math.ceil(bloatedSkill.length / 4);
  const talkingSkillTokens = Math.ceil(talkingSkill.length / 4);

  // Calculate comparisons
  const inputSavings = bloatedTotalInput - talkingTotalInput;
  const inputSavingsPercent = ((inputSavings / bloatedTotalInput) * 100).toFixed(1);
  const outputSavings = bloatedTotalOutput - talkingTotalOutput;
  const outputSavingsPercent = ((outputSavings / bloatedTotalOutput) * 100).toFixed(1);
  const totalSavings = (bloatedTotalInput + bloatedTotalOutput) - (talkingTotalInput + talkingTotalOutput);
  const totalSavingsPercent = ((totalSavings / (bloatedTotalInput + bloatedTotalOutput)) * 100).toFixed(1);
  const initialPromptSavings = bloatedSkillTokens - talkingSkillTokens;
  const initialPromptSavingsPercent = ((initialPromptSavings / bloatedSkillTokens) * 100).toFixed(1);
  const passRateDelta = ((talkingPassCount - bloatedPassCount) / tasks.length * 100);

  // Verdict
  let verdict: { result: string; reason: string };
  if (inputSavings > 0 && passRateDelta >= 0) {
    if (passRateDelta > 0) {
      verdict = {
        result: "🎉 大成功 (GREAT SUCCESS)",
        reason: `Talking CLI 减少了 ${inputSavingsPercent}% 的 input token，同时 pass rate 提高了 ${passRateDelta.toFixed(1)}pp`,
      };
    } else {
      verdict = {
        result: "✅ 成功 (SUCCESS)",
        reason: `Talking CLI 减少了 ${inputSavingsPercent}% 的 input token，同时保持了相同的 pass rate`,
      };
    }
  } else if (inputSavings > 0 && passRateDelta < 0) {
    verdict = {
      result: "⚠️ 部分成功 (PARTIAL)",
      reason: `Talking CLI 减少了 ${inputSavingsPercent}% 的 input token，但 pass rate 下降了 ${Math.abs(passRateDelta).toFixed(1)}pp`,
    };
  } else {
    verdict = {
      result: "❌ 未达预期 (FAILED)",
      reason: `Talking CLI 没有减少 token 消耗（变化: ${inputSavingsPercent}%）`,
    };
  }

  // Generate report
  const report: BenchmarkReport = {
    timestamp: new Date().toISOString(),
    config: {
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      maxTokens: 4096,
      timeout: "300s",
      totalTasks: tasks.length,
      easyTasks: easyCount,
      hardTasks: hardCount,
    },
    skillSizes: {
      bloated: {
        characters: bloatedSkill.length,
        approximateTokens: bloatedSkillTokens,
      },
      talking: {
        characters: talkingSkill.length,
        approximateTokens: talkingSkillTokens,
      },
      savings: {
        characters: bloatedSkill.length - talkingSkill.length,
        percentage: ((bloatedSkill.length - talkingSkill.length) / bloatedSkill.length * 100).toFixed(1),
        tokens: bloatedSkillTokens - talkingSkillTokens,
      },
    },
    results: {
      bloated: {
        totalInputTokens: bloatedTotalInput,
        totalOutputTokens: bloatedTotalOutput,
        totalTokens: bloatedTotalInput + bloatedTotalOutput,
        passRate: bloatedPassCount / tasks.length,
        wins: bloatedWins,
        tasks: bloatedTasks,
      },
      talking: {
        totalInputTokens: talkingTotalInput,
        totalOutputTokens: talkingTotalOutput,
        totalTokens: talkingTotalInput + talkingTotalOutput,
        passRate: talkingPassCount / tasks.length,
        wins: talkingWins,
        tasks: talkingTasks,
      },
    },
    comparison: {
      inputTokenSavings: inputSavings,
      inputTokenSavingsPercent: inputSavingsPercent,
      outputTokenSavings: outputSavings,
      outputTokenSavingsPercent: outputSavingsPercent,
      totalTokenSavings: totalSavings,
      totalTokenSavingsPercent: totalSavingsPercent,
      initialPromptSavings: initialPromptSavings,
      initialPromptSavingsPercent: initialPromptSavingsPercent,
      passRateDelta,
      talkingWins,
      bloatedWins,
      ties,
    },
    verdict,
  };

  writeFileSync(resolve(resultDir, "report.json"), JSON.stringify(report, null, 2), "utf-8");

  // Print standardized report
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    BENCHMARK RESULTS                          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");

  console.log("📊 INITIAL PROMPT SIZE COMPARISON");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`BLOATED SKILL.md:  ${bloatedSkill.length.toLocaleString()} chars (~${bloatedSkillTokens.toLocaleString()} tokens)`);
  console.log(`TALKING SKILL.md:  ${talkingSkill.length.toLocaleString()} chars (~${talkingSkillTokens.toLocaleString()} tokens)`);
  console.log(`Savings:           ${initialPromptSavings.toLocaleString()} tokens (${initialPromptSavingsPercent}%) ⬇️`);
  console.log("");

  console.log("📊 INPUT TOKEN COMPARISON");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`BLOATED:           ${bloatedTotalInput.toLocaleString()} tokens`);
  console.log(`TALKING:           ${talkingTotalInput.toLocaleString()} tokens`);
  console.log(`Savings:           ${inputSavings.toLocaleString()} tokens (${inputSavingsPercent}%) ⬇️`);
  console.log("");

  console.log("📊 OUTPUT TOKEN COMPARISON");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`BLOATED:           ${bloatedTotalOutput.toLocaleString()} tokens`);
  console.log(`TALKING:           ${talkingTotalOutput.toLocaleString()} tokens`);
  console.log(`Savings:           ${outputSavings.toLocaleString()} tokens (${outputSavingsPercent}%) ${outputSavings >= 0 ? "⬇️" : "⬆️"}`);
  console.log("");

  console.log("📊 TOTAL TOKEN COMPARISON");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`BLOATED:           ${(bloatedTotalInput + bloatedTotalOutput).toLocaleString()} tokens`);
  console.log(`TALKING:           ${(talkingTotalInput + talkingTotalOutput).toLocaleString()} tokens`);
  console.log(`Savings:           ${totalSavings.toLocaleString()} tokens (${totalSavingsPercent}%) ${totalSavings >= 0 ? "⬇️" : "⬆️"}`);
  console.log("");

  console.log("📊 TASK COMPLETION QUALITY");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`BLOATED Pass Rate: ${(bloatedPassCount / tasks.length * 100).toFixed(1)}% (${bloatedPassCount}/${tasks.length})`);
  console.log(`TALKING Pass Rate: ${(talkingPassCount / tasks.length * 100).toFixed(1)}% (${talkingPassCount}/${tasks.length})`);
  console.log(`Pass Rate Delta:   ${passRateDelta >= 0 ? "+" : ""}${passRateDelta.toFixed(1)}pp ${passRateDelta >= 0 ? "⬆️" : "⬇️"}`);
  console.log(`BLOATED Wins:      ${bloatedWins} tasks`);
  console.log(`TALKING Wins:      ${talkingWins} tasks`);
  console.log(`Ties:              ${ties} tasks`);
  console.log("");

  console.log("📊 TASK-BY-TASK BREAKDOWN");
  console.log("─────────────────────────────────────────────────────────────");
  console.log("Task ID                          | BLOATED    | TALKING    | Winner");
  console.log("─────────────────────────────────|────────────|────────────|───────");
  for (let i = 0; i < tasks.length; i++) {
    const b = bloatedTasks[i];
    const t = talkingTasks[i];
    let winner = "Tie";
    if (t.pass && !b.pass) winner = "TALKING";
    else if (b.pass && !t.pass) winner = "BLOATED";

    const taskName = b.taskId.padEnd(32);
    const bResult = `${b.inputTokens}/${b.outputTokens} ${b.pass ? "✅" : "❌"}`.padEnd(10);
    const tResult = `${t.inputTokens}/${t.outputTokens} ${t.pass ? "✅" : "❌"}`.padEnd(10);
    console.log(`${taskName} | ${bResult} | ${tResult} | ${winner}`);
  }
  console.log("");

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║                      VERDICT                                  ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log(verdict.result);
  console.log(verdict.reason);
  console.log("");
  console.log(`📁 Full report saved to: ${resultDir}/report.json`);
}

function existsSync(path: string): boolean {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}

runStandardizedBenchmark().catch((err) => {
  console.error("❌ Benchmark failed:", err.message);
  process.exit(1);
});
