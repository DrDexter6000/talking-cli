#!/usr/bin/env node
/**
 * Real-world benchmark CLI for MCP servers.
 *
 * Self-contained executor that runs MCP server tasks against
 * an LLM provider. Supports multiple targets (server-memory, server-everything).
 *
 * Usage:
 *   node benchmark/real-world/cli.mjs --provider glm-5.1
 *   node benchmark/real-world/cli.mjs --provider stub --limit 3 --variants mute
 *   node benchmark/real-world/cli.mjs --provider stub --target everything --limit 2
 *   node benchmark/real-world/cli.mjs --provider glm-5.1 --target all
 *
 * Requires benchmark to be built first: npm run benchmark:build
 */

import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Checkers (CJS) ──────────────────────────────────────────────────────────
const memoryCheckers = require(resolve(__dirname, "checkers", "memory-checkers.cjs"));
const everythingCheckers = require(resolve(__dirname, "checkers", "everything-checkers.cjs"));
const atlasCheckers = require(resolve(__dirname, "checkers", "atlas-checkers.cjs"));

// ─── Target configurations ────────────────────────────────────────────────────
const TARGETS = {
  memory: {
    name: "server-memory",
    muteServer: resolve(
      __dirname,
      "servers/server-memory/mute/node_modules/@modelcontextprotocol/server-memory/dist/index.js",
    ),
    talkingServer: resolve(__dirname, "servers/server-memory/talking/index.mjs"),
    taskDir: resolve(__dirname, "tasks/server-memory"),
    fullSkill: resolve(__dirname, "skills/memory-full-skill.md"),
    leanSkill: resolve(__dirname, "skills/memory-lean-skill.md"),
    checkers: memoryCheckers,
    needsMemoryFile: true,
    clientName: "talking-cli-memory-bench",
  },
  everything: {
    name: "server-everything",
    muteServer: resolve(
      __dirname,
      "servers/server-everything/mute/node_modules/@modelcontextprotocol/server-everything/dist/index.js",
    ),
    talkingServer: resolve(__dirname, "servers/server-everything/talking/index.mjs"),
    taskDir: resolve(__dirname, "tasks/server-everything"),
    fullSkill: resolve(__dirname, "skills/everything-full-skill.md"),
    leanSkill: resolve(__dirname, "skills/everything-lean-skill.md"),
    checkers: everythingCheckers,
    needsMemoryFile: false,
    clientName: "talking-cli-everything-bench",
  },
  atlas: {
    name: "mcp-atlas-adapted",
    muteServer: resolve(
      __dirname,
      "servers/server-everything/mute/node_modules/@modelcontextprotocol/server-everything/dist/index.js",
    ),
    talkingServer: resolve(__dirname, "servers/server-everything/talking/index.mjs"),
    taskDir: resolve(__dirname, "tasks/mcp-atlas"),
    fullSkill: resolve(__dirname, "skills/everything-full-skill.md"),
    leanSkill: resolve(__dirname, "skills/everything-lean-skill.md"),
    checkers: atlasCheckers,
    needsMemoryFile: false,
    clientName: "talking-cli-atlas-bench",
  },
};

// ─── Parse args ───────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
let provider = "stub";
let target = "memory";
let taskLimit;
let runVariants = ["full-skill+mute", "lean-skill+talking"];
let maxTurns = 20;
let verbose = false;

for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--provider" && argv[i + 1]) { provider = argv[++i]; }
  else if (argv[i] === "--target" && argv[i + 1]) { target = argv[++i]; }
  else if (argv[i] === "--limit" && argv[i + 1]) { taskLimit = parseInt(argv[++i], 10); }
  else if (argv[i] === "--variants" && argv[i + 1]) {
    const raw = argv[++i].split(",").map(v => v.trim());
    // Backward compat: "mute" → "full-skill+mute", "talking" → "lean-skill+talking"
    runVariants = raw.map(v => {
      if (v === "mute") return "full-skill+mute";
      if (v === "talking") return "lean-skill+talking";
      return v;
    });
  }
  else if (argv[i] === "--max-turns" && argv[i + 1]) { maxTurns = parseInt(argv[++i], 10); }
  else if (argv[i] === "--verbose") { verbose = true; }
}

// Resolve target(s) to run
// Note: "atlas" is excluded from "all" because MCP-Atlas tasks require
// external APIs (Wikipedia, OSM, etc.) and cannot run against local MCP servers.
// Run explicitly with --target atlas to validate task/checker structure only.
const targetKeys = target === "all"
  ? Object.keys(TARGETS).filter(k => k !== "atlas")
  : [target];

if (!targetKeys.every(k => k in TARGETS)) {
  const invalid = targetKeys.filter(k => !(k in TARGETS));
  console.error(`Unknown target(s): ${invalid.join(", ")}. Available: ${Object.keys(TARGETS).join(", ")}`);
  process.exit(1);
}

if (targetKeys.includes("atlas")) {
  console.warn("⚠ MCP-Atlas tasks require external APIs (Wikipedia, OSM, Met Museum, etc.).");
  console.warn("  Running against server-everything will not produce valid results.");
  console.warn("  These tasks are external-validity artifacts, not runnable benchmark cells.");
}

// ─── Results output ───────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
const OUTPUT_DIR = resolve(__dirname, "results", `${today}-${provider}`);
mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── MCP subprocess (simplified from standalone-executor) ─────────────────────
class McpSubprocess {
  constructor(command, args, env) {
    this.proc = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env,
      windowsHide: true,
    });
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = "";
    this.stderrBuf = "";
    this.dead = false;

    this.proc.stderr?.on("data", (chunk) => {
      this.stderrBuf += chunk.toString("utf-8");
    });
    this.proc.on("exit", () => {
      this.dead = true;
      const err = new Error("Server exited");
      for (const [, entry] of this.pending) entry.reject(err);
      this.pending.clear();
    });
    this.proc.on("error", (err) => {
      this.dead = true;
      for (const [, entry] of this.pending) entry.reject(err);
      this.pending.clear();
    });
    this.proc.stdout?.on("data", (chunk) => this._onData(chunk));
    this.proc.stdout?.on("end", () => {
      if (!this.dead) {
        this.dead = true;
        const err = new Error("Server stdout closed");
        for (const [, entry] of this.pending) entry.reject(err);
        this.pending.clear();
      }
    });
  }

  async waitForReady(timeoutMs = 15000) {
    const READY_SIGNALS = ["running on stdio", "Starting default (STDIO) server"];
    const isReady = () => READY_SIGNALS.some(s => this.stderrBuf.includes(s));
    if (isReady()) return;
    if (this.dead) throw new Error("Server died before ready");
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Server not ready in ${timeoutMs}ms`)), timeoutMs);
      const onData = (chunk) => {
        this.stderrBuf += chunk.toString("utf-8");
        if (isReady()) {
          clearTimeout(timer);
          this.proc?.stderr?.removeListener("data", onData);
          resolve();
        }
      };
      this.proc?.stderr?.on("data", onData);
    });
  }

  async initialize(timeoutMs = 10000, clientName = "talking-cli-bench") {
    const res = await this._request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: clientName, version: "1.0.0" },
    }, timeoutMs);
    if (res.error) throw new Error(`MCP init failed: ${res.error.message}`);
    this._notify("notifications/initialized");
  }

  async listTools(timeoutMs = 10000) {
    const res = await this._request("tools/list", {}, timeoutMs);
    if (res.error) throw new Error(`tools/list failed: ${res.error.message}`);
    return res.result.tools ?? [];
  }

  async callTool(name, args, timeoutMs = 30000) {
    const res = await this._request("tools/call", { name, arguments: args }, timeoutMs);
    if (res.error) {
      return { content: [{ type: "text", text: `Error: ${res.error.message}` }], isError: true };
    }
    const result = res.result;
    return {
      content: result?.content ?? [{ type: "text", text: "" }],
      isError: result?.isError ?? false,
    };
  }

  async close() {
    if (this.proc && !this.proc.killed) {
      this.proc.kill("SIGTERM");
      await new Promise((resolve) => {
        const timer = setTimeout(() => { this.proc?.kill("SIGKILL"); resolve(); }, 2000);
        this.proc?.on("exit", () => { clearTimeout(timer); resolve(); });
      });
    }
    this.proc = null;
  }

  _request(method, params, timeoutMs = 10000) {
    if (this.dead) return Promise.reject(new Error(`Server dead, cannot ${method}`));
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} timed out`)); }, timeoutMs);
      this.pending.set(id, {
        resolve: (msg) => { clearTimeout(timer); resolve(msg); },
        reject: (err) => { clearTimeout(timer); reject(err); },
      });
      this.proc?.stdin?.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  _notify(method) {
    this.proc?.stdin?.write(`${JSON.stringify({ jsonrpc: "2.0", method })}\n`);
  }

  _onData(chunk) {
    this.buffer += chunk.toString("utf-8");
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const entry = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          entry?.resolve(msg);
        }
      } catch { /* ignore non-JSON */ }
    }
  }
}

// ─── LLM provider (imports from compiled benchmark) ──────────────────────────
async function createLLMProvider(providerName) {
  const BENCHMARK_DIST = resolve(__dirname, "..", "dist");
  const providerPath = resolve(BENCHMARK_DIST, "runner/providers.js");
  const providerUrl = pathToFileURL(providerPath).href;
  const { createProvider } = await import(providerUrl);
  return createProvider(providerName);
}

// ─── Convert MCP tools to LLM tool format ─────────────────────────────────────
function mcpToolsToLlmFormat(mcpTools) {
  return mcpTools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}

// ─── Run a single task ────────────────────────────────────────────────────────
async function runTask(task, variant, llm, targetCfg) {
  const startTime = Date.now();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let turnCount = 0;
  let errorRecoveries = 0;

  // Parse variant: "full-skill+mute", "full-skill+talking", "lean-skill+mute", "lean-skill+talking"
  const [skillVariant, serverVariant] = variant.includes("+")
    ? variant.split("+")
    : [variant === "mute" ? "full-skill" : "lean-skill", variant];
  const serverPath = serverVariant === "mute" ? targetCfg.muteServer : targetCfg.talkingServer;
  const fullSkill = readFileSync(targetCfg.fullSkill, "utf-8");
  const leanSkill = readFileSync(targetCfg.leanSkill, "utf-8");
  const skill = skillVariant === "full-skill" ? fullSkill : leanSkill;

  // Prepare env — memory targets need a temp file
  let memoryFile;
  const env = { ...process.env };
  if (targetCfg.needsMemoryFile) {
    memoryFile = resolve(
      tmpdir(),
      `talking-cli-mem-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`,
    );
    env.MEMORY_FILE_PATH = memoryFile;
  }

  const mcp = new McpSubprocess("node", [serverPath], env);

  let mcpTools = [];
  try {
    await mcp.waitForReady(15000);
    await mcp.initialize(10000, targetCfg.clientName);
    mcpTools = await mcp.listTools(10000);
  } catch (err) {
    await mcp.close();
    if (memoryFile) { try { unlinkSync(memoryFile); } catch { /* ignore */ } }
    return {
      taskId: task.id, variant, turns: 0, inputTokens: 0, outputTokens: 0,
      walltime: Date.now() - startTime, outcome: "error", pass: false,
      checkerReason: `MCP init failed: ${err.message}`,
    };
  }

  const llmTools = mcpToolsToLlmFormat(mcpTools);
  const messages = [
    { role: "user", content: skill + "\n\nUser request: " + task.prompt },
  ];

  try {
    let finalText = "";
    for (let turn = 0; turn < maxTurns; turn++) {
      turnCount = turn + 1;

      let response;
      try {
        response = await llm.call(messages, turn, llmTools);
      } catch {
        return {
          taskId: task.id, variant, turns: turnCount,
          inputTokens: totalInputTokens, outputTokens: totalOutputTokens,
          walltime: Date.now() - startTime, outcome: "error", pass: false,
          checkerReason: "LLM call timed out",
        };
      }

      const inputToks = response.usage?.input_tokens ?? 0;
      const outputToks = response.usage?.output_tokens ?? 0;
      totalInputTokens += inputToks;
      totalOutputTokens += outputToks;

      const toolUses = response.content.filter(b => b.type === "tool_use");

      if (toolUses.length === 0) {
        finalText = response.content
          .filter(b => b.type === "text")
          .map(b => b.text)
          .join("\n");
        break;
      }

      // Add assistant response to conversation
      messages.push({ role: "assistant_content", content: response.content });

      // Execute tool calls
      for (const tool of toolUses) {
        try {
          const result = await mcp.callTool(tool.name, tool.input, 30000);
          const text = result.content
            .filter(c => c.type === "text")
            .map(c => c.text ?? "")
            .join("\n");
          messages.push({
            role: "tool", toolUseId: tool.id, name: tool.name,
            content: text, isError: result.isError,
          });
          if (result.isError) errorRecoveries++;
        } catch (err) {
          messages.push({
            role: "tool", toolUseId: tool.id, name: tool.name,
            content: err.message, isError: true,
          });
          errorRecoveries++;
        }
      }
    }

    // Evaluate using target checkers
    const checkerFn = targetCfg.checkers[task.checker];
    const checkerResult = checkerFn
      ? checkerFn(finalText, {})
      : { pass: false, reason: `Unknown checker: ${task.checker}` };

    return {
      taskId: task.id, variant, turns: turnCount,
      inputTokens: totalInputTokens, outputTokens: totalOutputTokens,
      walltime: Date.now() - startTime,
      outcome: turnCount >= maxTurns ? "timeout" : "completed",
      pass: checkerResult.pass,
      checkerReason: checkerResult.reason,
      errorRecoveries,
      target: targetCfg.name,
    };
  } finally {
    await mcp.close();
    if (memoryFile) { try { unlinkSync(memoryFile); } catch { /* ignore */ } }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const targetLabel = targetKeys.length === 1
    ? TARGETS[targetKeys[0]].name
    : `${targetKeys.length} targets (${targetKeys.join(", ")})`;

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║     TALKING CLI — REAL-WORLD BENCHMARK                      ║");
  console.log(`║     Target: ${targetLabel.padEnd(48)}║`);
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`Provider: ${provider}`);
  console.log(`Variants: ${runVariants.join(", ")} | Max turns: ${maxTurns}`);
  if (taskLimit) console.log(`Task limit: ${taskLimit} per target`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log("");

  const llm = await createLLMProvider(provider);
  const allResults = [];

  for (const tKey of targetKeys) {
    const tCfg = TARGETS[tKey];
    console.log(`\n${"─".repeat(60)}`);
    console.log(`Target: ${tCfg.name}`);
    console.log(`${"─".repeat(60)}`);

    // Load tasks for this target
    const tasks = readdirSync(tCfg.taskDir)
      .filter(f => f.endsWith(".json"))
      .sort()
      .map(f => JSON.parse(readFileSync(resolve(tCfg.taskDir, f), "utf-8")));
    const limitedTasks = taskLimit ? tasks.slice(0, taskLimit) : tasks;

    if (limitedTasks.length === 0) {
      console.error(`No tasks found in ${tCfg.taskDir}`);
      continue;
    }

    console.log(`Tasks: ${limitedTasks.length} | Total runs: ${limitedTasks.length * runVariants.length}`);
    console.log("");

    const results = [];
    let completed = 0;
    const total = limitedTasks.length * runVariants.length;

    for (const task of limitedTasks) {
      for (const variant of runVariants) {
        completed++;
        console.log(`[${completed}/${total}] ${task.id} (${variant})...`);

        const result = await runTask(task, variant, llm, tCfg);
        results.push(result);
        const status = result.pass ? "✅ PASS" : "❌ FAIL";
        console.log(`  ${status}: ${result.checkerReason}`);
        if (verbose) {
          console.log(
            `    turns=${result.turns} tokens=${result.inputTokens + result.outputTokens}` +
            ` walltime=${result.walltime}ms`,
          );
        }
      }
    }

    // Save results for this target
    const targetResultsPath = resolve(OUTPUT_DIR, `results-${tKey}.jsonl`);
    writeFileSync(targetResultsPath, results.map(r => JSON.stringify(r)).join("\n") + "\n", "utf-8");

    // Print summary for this target
    console.log(`\n  ${tCfg.name} Results:`);
    for (const variant of runVariants) {
      const vr = results.filter(r => r.variant === variant);
      const passed = vr.filter(r => r.pass).length;
      const count = vr.length;
      const avgTokens = vr.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0) / (count || 1);
      const avgWalltime = vr.reduce((s, r) => s + r.walltime, 0) / (count || 1);

      console.log(`    ${variant}: ${passed}/${count} (${((passed / (count || 1)) * 100).toFixed(0)}%) — avg tokens: ${Math.round(avgTokens).toLocaleString()}, avg walltime: ${(avgWalltime / 1000).toFixed(1)}s`);
    }

    // Per-task comparison — show first and last cell (control vs treatment)
    const controlVariant = runVariants.includes("full-skill+mute") ? "full-skill+mute" : runVariants[0];
    const treatmentVariant = runVariants.includes("lean-skill+talking") ? "lean-skill+talking" : runVariants[runVariants.length - 1];
    if (controlVariant !== treatmentVariant) {
      console.log(`\n  Per-task comparison (${controlVariant} vs ${treatmentVariant}):`);
      console.log("  " + "-".repeat(72));
      console.log("  " + "Task".padEnd(40) + controlVariant.padEnd(16) + treatmentVariant);
      console.log("  " + "-".repeat(72));
      for (const task of limitedTasks) {
        const ctrlR = results.find(r => r.taskId === task.id && r.variant === controlVariant);
        const treatR = results.find(r => r.taskId === task.id && r.variant === treatmentVariant);
        const ctrlS = ctrlR ? (ctrlR.pass ? "PASS" : "FAIL") : "-";
        const treatS = treatR ? (treatR.pass ? "PASS" : "FAIL") : "-";
        console.log(`  ${task.id.padEnd(40)}${ctrlS.padEnd(16)}${treatS}`);
      }
    }

    console.log(`\n  Results saved to: ${targetResultsPath}`);
    allResults.push(...results);
  }

  // Overall summary if multiple targets
  if (targetKeys.length > 1) {
    console.log(`\n${"═".repeat(60)}`);
    console.log("OVERALL SUMMARY");
    console.log("═".repeat(60));
    for (const tKey of targetKeys) {
      const tCfg = TARGETS[tKey];
      const tResults = allResults.filter(r => r.target === tCfg.name);
      for (const variant of runVariants) {
        const vr = tResults.filter(r => r.variant === variant);
        const passed = vr.filter(r => r.pass).length;
        const count = vr.length;
        console.log(`  ${tCfg.name} (${variant}): ${passed}/${count} (${((passed / (count || 1)) * 100).toFixed(0)}%)`);
      }
    }
  }
}

main().then(
  () => process.exit(0),
  (err) => { console.error("Fatal error:", err); process.exit(1); },
);
