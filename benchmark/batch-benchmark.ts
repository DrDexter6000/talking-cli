import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { StandaloneExecutor } from "./runner/standalone-executor.js";
import { createProvider } from "./runner/providers.js";
import type { BenchmarkTask } from "./runner/types.js";

const BENCHMARK_DIR = resolve(import.meta.dirname || ".");
const TASKS_DIR = resolve(BENCHMARK_DIR, "tasks");

async function runHealthCheck(): Promise<boolean> {
  console.log("=== Running API Health Check ===");
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const baseUrl = (process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com").replace(/\/$/, "");
  
  if (!apiKey) {
    console.error("‚ù?ANTHROPIC_API_KEY not set");
    return false;
  }
  
  try {
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest",
        max_tokens: 50,
        messages: [{ role: "user", content: "Hello" }],
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error(`‚ù?API Health Check Failed: ${error.error?.message ?? response.statusText}`);
      return false;
    }
    
    const data = await response.json();
    if (data.content && data.content.length > 0) {
      console.log("‚ú?API Health Check Passed");
      console.log(`   Model: ${data.model}`);
      console.log(`   Response: ${data.content[data.content.length - 1].text ?? "[thinking block]"}`);
      return true;
    } else {
      console.error("‚ù?API returned empty content");
      return false;
    }
  } catch (error) {
    console.error(`‚ù?API Health Check Failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

interface BatchResult {
  taskId: string;
  variant: string;
  turns: number;
  inputTokens: number;
  outputTokens: number;
  pass: boolean;
}

async function runBatch(
  startIndex: number, 
  batchSize: number,
  resultDir: string
): Promise<BatchResult[]> {
  const taskFiles = readdirSync(TASKS_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right));

  const tasks = taskFiles.map((file) => {
    const raw = readFileSync(resolve(TASKS_DIR, file), "utf-8");
    return JSON.parse(raw) as BenchmarkTask;
  });

  const batchTasks = tasks.slice(startIndex, startIndex + batchSize);
  console.log(`Running batch: tasks ${startIndex + 1} to ${startIndex + batchTasks.length} of ${tasks.length}`);

  const provider = createProvider("anthropic");
  const executor = new StandaloneExecutor(provider);

  const results: BatchResult[] = [];

  // Run bloated variant
  console.log("\n=== Running BLOATED variant ===");
  for (const task of batchTasks) {
    console.log(`Task: ${task.id}`);
    const result = await executor.runTask(task, "bloated", {
      outputDir: resolve(resultDir, "bloated"),
      disableMcp: true,
    });
    results.push({ ...result, variant: "bloated" });
    console.log(`  Turns: ${result.turns}, Input: ${result.inputTokens}, Output: ${result.outputTokens}, Pass: ${result.pass}`);
  }

  // Run talking variant
  console.log("\n=== Running TALKING variant ===");
  for (const task of batchTasks) {
    console.log(`Task: ${task.id}`);
    const result = await executor.runTask(task, "talking", {
      outputDir: resolve(resultDir, "talking"),
      disableMcp: true,
    });
    results.push({ ...result, variant: "talking" });
    console.log(`  Turns: ${result.turns}, Input: ${result.inputTokens}, Output: ${result.outputTokens}, Pass: ${result.pass}`);
  }

  console.log(`\nBatch ${startIndex + 1}-${startIndex + batchTasks.length} completed`);
  return results;
}

async function runBenchmarkWithBatches() {
  // Run health check first
  const healthy = await runHealthCheck();
  if (!healthy) {
    console.error("\n‚ù?Benchmark aborted due to API health check failure");
    console.error("Please check:");
    console.error("  1. ANTHROPIC_API_KEY is set correctly");
    console.error("  2. ANTHROPIC_BASE_URL is correct (https://api.minimaxi.com/anthropic for MiniMax)");
    console.error("  3. ANTHROPIC_MODEL is correct (MiniMax-M2.7-highspeed for MiniMax Highspeed)");
    process.exit(1);
  }
  
  console.log("");
  
  const resultDir = resolve(BENCHMARK_DIR, "results", `token-efficiency-${new Date().toISOString().slice(0, 10)}`);
  mkdirSync(resultDir, { recursive: true });

  const taskFiles = readdirSync(TASKS_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right));

  const totalTasks = taskFiles.length;
  const batchSize = 3; // Run 3 tasks at a time to avoid timeout
  const allResults: BatchResult[] = [];

  console.log(`Total tasks: ${totalTasks}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Estimated time: ${Math.ceil(totalTasks / batchSize) * 2} minutes\n`);

  for (let i = 0; i < totalTasks; i += batchSize) {
    const batchResults = await runBatch(i, batchSize, resultDir);
    allResults.push(...batchResults);
    
    if (i + batchSize < totalTasks) {
      console.log("\n--- Waiting 5 seconds before next batch ---\n");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Generate report
  const bloatedResults = allResults.filter((r) => r.variant === "bloated");
  const talkingResults = allResults.filter((r) => r.variant === "talking");

  const bloatedTotalInput = bloatedResults.reduce((sum, r) => sum + r.inputTokens, 0);
  const bloatedTotalOutput = bloatedResults.reduce((sum, r) => sum + r.outputTokens, 0);
  const talkingTotalInput = talkingResults.reduce((sum, r) => sum + r.inputTokens, 0);
  const talkingTotalOutput = talkingResults.reduce((sum, r) => sum + r.outputTokens, 0);

  // Read SKILL.md sizes
  const bloatedSkill = readFileSync(resolve(BENCHMARK_DIR, "skills", "bloated-skill.md"), "utf-8");
  const talkingSkill = readFileSync(resolve(BENCHMARK_DIR, "skills", "talking-skill.md"), "utf-8");

  const bloatedSkillTokens = Math.ceil(bloatedSkill.length / 4);
  const talkingSkillTokens = Math.ceil(talkingSkill.length / 4);

  const report = {
    timestamp: new Date().toISOString(),
    taskCount: totalTasks,
    batchSize,
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
    runtimeResults: {
      bloated: {
        totalInputTokens: bloatedTotalInput,
        totalOutputTokens: bloatedTotalOutput,
        totalTokens: bloatedTotalInput + bloatedTotalOutput,
        passRate: bloatedResults.filter((r) => r.pass).length / bloatedResults.length,
      },
      talking: {
        totalInputTokens: talkingTotalInput,
        totalOutputTokens: talkingTotalOutput,
        totalTokens: talkingTotalInput + talkingTotalOutput,
        passRate: talkingResults.filter((r) => r.pass).length / talkingResults.length,
      },
    },
    totalSavings: {
      initialPromptSavings: bloatedSkillTokens - talkingSkillTokens,
      runtimeSavings: (bloatedTotalInput + bloatedTotalOutput) - (talkingTotalInput + talkingTotalOutput),
      totalSavings: (bloatedSkillTokens - talkingSkillTokens) + ((bloatedTotalInput + bloatedTotalOutput) - (talkingTotalInput + talkingTotalOutput)),
    },
  };

  writeFileSync(resolve(resultDir, "report.json"), JSON.stringify(report, null, 2), "utf-8");

  console.log("\n=== TOKEN EFFICIENCY REPORT ===");
  console.log(`Tasks tested: ${report.taskCount}`);
  console.log(`\nSKILL.md Size Comparison:`);
  console.log(`  Bloated: ${report.skillSizes.bloated.characters.toLocaleString()} chars (~${report.skillSizes.bloated.approximateTokens.toLocaleString()} tokens)`);
  console.log(`  Talking: ${report.skillSizes.talking.characters.toLocaleString()} chars (~${report.skillSizes.talking.approximateTokens.toLocaleString()} tokens)`);
  console.log(`  Savings: ${report.skillSizes.savings.percentage}% (${report.skillSizes.savings.tokens.toLocaleString()} tokens)`);
  console.log(`\nRuntime Token Usage:`);
  console.log(`  Bloated: ${report.runtimeResults.bloated.totalTokens.toLocaleString()} tokens (input: ${report.runtimeResults.bloated.totalInputTokens}, output: ${report.runtimeResults.bloated.totalOutputTokens})`);
  console.log(`  Talking: ${report.runtimeResults.talking.totalTokens.toLocaleString()} tokens (input: ${report.runtimeResults.talking.totalInputTokens}, output: ${report.runtimeResults.talking.totalOutputTokens})`);
  console.log(`\nPass Rates:`);
  console.log(`  Bloated: ${(report.runtimeResults.bloated.passRate * 100).toFixed(1)}%`);
  console.log(`  Talking: ${(report.runtimeResults.talking.passRate * 100).toFixed(1)}%`);
  console.log(`\nTotal Savings: ${report.totalSavings.totalSavings.toLocaleString()} tokens`);
  console.log(`\nReport saved to: ${resultDir}/report.json`);
}

// Run benchmark with batching
runBenchmarkWithBatches().catch(console.error);

